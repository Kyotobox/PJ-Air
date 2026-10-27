#!/usr/bin/env python3
"""
CONEXT Fleet Security Scanner (security_scanner.py)
Motor de escaneo estatico para Safe-Harvesting y Supply Chain Security.
Audita codigo fuente (Python, JS, Shell) y artefactos de documentacion (Markdown)
en busca de:
1. Secretos y credenciales expuestas (API keys, tokens).
2. Funciones de alto riesgo y ejecucion arbitraria via AST (eval, exec, shell=True).
3. Inyecciones indirectas de prompts y caracteres Unicode invisibles.
"""

import ast
import json
import os
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

# Patrones Regex de Secretos Conocidos
SECRET_PATTERNS = {
    "openai_api_key": re.compile(r"sk-[A-Za-z0-9]{20,T3BlbkFJ[A-Za-z0-9]{20,}"),
    "aws_access_key": re.compile(r"(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}"),
    "generic_secret_key": re.compile(r"(?i)(?:api_key|access_token|secret_key|private_key)\s*[:=]\s*['\"][A-Za-z0-9_\-]{24,}['\"]"),
    "stripe_live_key": re.compile(r"sk_live_[0-9a-zA-Z]{24}"),
    "jwt_token": re.compile(r"ey[A-Za-z0-9_-]{10,}\.ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"),
    "github_token": re.compile(r"(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36}")
}

# Indicadores de Inyeccion de Prompts
PROMPT_INJECTION_PATTERNS = [
    re.compile(r"(?i)ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions"),
    re.compile(r"(?i)system\s+override"),
    re.compile(r"(?i)disregard\s+(?:all\s+)?safety\s+guidelines"),
    re.compile(r"(?i)you\s+are\s+now\s+in\s+developer\s+mode"),
    re.compile(r"(?i)dan\s+mode\s+enabled"),
    re.compile(r"(?i)exfiltrat(?:e|ing)\s+(?:the\s+)?(?:env|secrets|keys)")
]

# Caracteres Unicode Invisibles / Zero-Width
ZERO_WIDTH_CHARS = re.compile(r"[\u200B\u200C\u200D\uFEFF\u200E\u200F]")

# Funciones y modulos prohibidos por AST
BANNED_AST_CALLS = {
    "eval",
    "exec",
    "compile"
}

BANNED_AST_ATTRS = {
    ("os", "system"),
    ("os", "popen"),
    ("pickle", "loads"),
    ("pickle", "load"),
    ("shutil", "rmtree")
}


class ASTSecurityVisitor(ast.NodeVisitor):
    """Visita nodos AST de Python para detectar funciones peligrosas y ejecucion arbitraria."""

    def __init__(self, filename: str):
        self.filename = filename
        self.issues: List[Dict[str, Any]] = []

    def visit_Call(self, node: ast.Call):
        # 1. Llamadas directas a funciones builtin prohibidas: eval(), exec()
        if isinstance(node.func, ast.Name):
            if node.func.id in BANNED_AST_CALLS:
                self.issues.append({
                    "type": "BANNED_BUILTIN",
                    "severity": "CRITICAL",
                    "file": self.filename,
                    "line": node.lineno,
                    "detail": f"Uso prohibido de funcion peligrosa '{node.func.id}()'"
                })

        # 2. Llamadas a atributos: os.system(), pickle.loads(), etc.
        elif isinstance(node.func, ast.Attribute):
            if isinstance(node.func.value, ast.Name):
                module_name = node.func.value.id
                attr_name = node.func.attr
                if (module_name, attr_name) in BANNED_AST_ATTRS:
                    self.issues.append({
                        "type": "DANGEROUS_CALL",
                        "severity": "CRITICAL",
                        "file": self.filename,
                        "line": node.lineno,
                        "detail": f"Invocacion de alto riesgo '{module_name}.{attr_name}()'"
                    })

            # 3. Deteccion de subprocess.*(..., shell=True)
            if isinstance(node.func.value, ast.Name) and node.func.value.id == "subprocess":
                for kw in node.keywords:
                    if kw.arg == "shell":
                        if isinstance(kw.value, ast.Constant) and kw.value.value is True:
                            self.issues.append({
                                "type": "SHELL_TRUE_EXEC",
                                "severity": "CRITICAL",
                                "file": self.filename,
                                "line": node.lineno,
                                "detail": "Uso de 'subprocess' con 'shell=True' permite RCE arbitrario"
                            })

        self.generic_visit(node)


def scan_file_for_secrets(content: str, filename: str) -> List[Dict[str, Any]]:
    """Escanea el contenido de un archivo en busca de secretos hardcoded."""
    issues = []
    lines = content.splitlines()
    for line_idx, line in enumerate(lines, 1):
        for secret_type, pattern in SECRET_PATTERNS.items():
            if pattern.search(line):
                issues.append({
                    "type": "EXPOSED_SECRET",
                    "severity": "CRITICAL",
                    "file": filename,
                    "line": line_idx,
                    "detail": f"Detectado patron de secreto expuesto '{secret_type}'"
                })
    return issues


def scan_file_for_prompt_injection(content: str, filename: str) -> List[Dict[str, Any]]:
    """Escanea texto en busca de indicadores de prompt injection y caracteres invisibles."""
    issues = []
    lines = content.splitlines()

    # Deteccion de caracteres zero-width
    for line_idx, line in enumerate(lines, 1):
        if ZERO_WIDTH_CHARS.search(line):
            issues.append({
                "type": "ZERO_WIDTH_CHARACTER",
                "severity": "WARNING",
                "file": filename,
                "line": line_idx,
                "detail": "Detectados caracteres Unicode invisibles (potencial ofuscacion de prompt)"
            })

        for pattern in PROMPT_INJECTION_PATTERNS:
            if pattern.search(line):
                issues.append({
                    "type": "PROMPT_INJECTION",
                    "severity": "CRITICAL",
                    "file": filename,
                    "line": line_idx,
                    "detail": f"Detectado intento de inyeccion de prompt: '{pattern.pattern}'"
                })

    return issues


def scan_python_ast(content: str, filename: str) -> List[Dict[str, Any]]:
    """Parsea el AST de un archivo Python y busca llamadas peligrosas."""
    issues = []
    try:
        tree = ast.parse(content, filename=filename)
        visitor = ASTSecurityVisitor(filename)
        visitor.visit(tree)
        issues.extend(visitor.issues)
    except SyntaxError as e:
        issues.append({
            "type": "SYNTAX_ERROR",
            "severity": "WARNING",
            "file": filename,
            "line": e.lineno or 1,
            "detail": f"Error de sintaxis al parsear AST: {e.msg}"
        })
    return issues


def scan_path(target_path: Path) -> Dict[str, Any]:
    """Escanea un archivo individual o un directorio recursivamente."""
    all_issues: List[Dict[str, Any]] = []
    files_scanned = 0

    if not target_path.exists():
        return {
            "target": str(target_path),
            "files_scanned": 0,
            "critical_issues": 1,
            "warning_issues": 0,
            "is_clean": False,
            "issues": [{
                "type": "PATH_NOT_FOUND",
                "severity": "CRITICAL",
                "file": str(target_path),
                "line": 0,
                "detail": "La ruta especificada no existe en disco"
            }]
        }

    files_to_scan = [target_path] if target_path.is_file() else [
        p for p in target_path.rglob("*")
        if p.is_file() and not any(part.startswith(".") for part in p.parts)
    ]

    for fpath in files_to_scan:
        files_scanned += 1
        try:
            with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
        except Exception as e:
            all_issues.append({
                "type": "FILE_READ_ERROR",
                "severity": "WARNING",
                "file": str(fpath),
                "line": 0,
                "detail": f"No se pudo leer el archivo: {str(e)}"
            })
            continue

        filename_str = str(fpath)

        # 1. Escaneo de secretos (todos los archivos)
        all_issues.extend(scan_file_for_secrets(content, filename_str))

        # 2. Escaneo de prompt injection (markdown y archivos de texto)
        if fpath.suffix.lower() in [".md", ".txt", ".json", ".yaml", ".yml"]:
            all_issues.extend(scan_file_for_prompt_injection(content, filename_str))

        # 3. Escaneo AST de Python
        if fpath.suffix.lower() == ".py":
            all_issues.extend(scan_python_ast(content, filename_str))

    critical_count = sum(1 for i in all_issues if i.get("severity") == "CRITICAL")
    warning_count = sum(1 for i in all_issues if i.get("severity") == "WARNING")

    return {
        "target": str(target_path),
        "files_scanned": files_scanned,
        "critical_issues": critical_count,
        "warning_issues": warning_count,
        "is_clean": critical_count == 0,
        "issues": all_issues
    }


def main():
    import argparse
    parser = argparse.ArgumentParser(description="CONEXT Security Scanner for Safe-Harvesting")
    parser.add_argument("target", help="Ruta del archivo o directorio a escanear")
    parser.add_argument("--json", action="store_true", help="Salida en formato JSON")
    args = parser.parse_args()

    target_path = Path(args.target)
    report = scan_path(target_path)

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print("=== CONEXT FLEET SECURITY SCANNER ===")
        print(f"Objetivo: {report['target']}")
        print(f"Archivos analizados: {report['files_scanned']}")
        print(f"Vulnerabilidades Criticas: {report['critical_issues']}")
        print(f"Advertencias: {report['warning_issues']}")
        print("-" * 50)

        if report["issues"]:
            for issue in report["issues"]:
                sev = issue["severity"]
                tag = "[CRITICAL]" if sev == "CRITICAL" else "[WARNING]"
                print(f"{tag} {issue['file']}:{issue['line']} - {issue['type']}: {issue['detail']}")
            print("-" * 50)

        if report["is_clean"]:
            print("[OK] ESTADO: LIMPIO (Apto para admision)")
            sys.exit(0)
        else:
            print("[FAIL] ESTADO: VULNERABILIDADES DETECTADAS (Bloqueo preventivo)")
            sys.exit(1)


if __name__ == "__main__":
    main()
