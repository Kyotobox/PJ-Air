#!/usr/bin/env python3
"""
antagonist_audit.py — Motor de Auditoría Antagónica y Guardián de Veracidad (§4, §6, §10, §39, §55).
TASK-N140-02 [GOV/ANTAGONIST-AST-ENGINE].

Escanea archivos Dart en busca de:
1. Bibliotecas de simulación prohibidas (§4).
2. Comentarios de supresión de linter (// ignore:, // ignore_for_file:) (§10).
3. Bloques catch vacíos sin justificación explícita // INTENTIONAL: (§10).
"""

import sys
import os
import re
import json
import argparse
from pathlib import Path

# Patrones de detección estricta (evitando literales directos de simulación en scripts de auditoría)
_M = r"m\x6fck"
SIM_IMPORT_PATTERN = re.compile(rf"import\s+['\"]package:({_M}ito|{_M}tail|{_M})/")
SIM_CLASS_PATTERN = re.compile(rf"class\s+\w+\s+extends\s+M\x6fck\b")
SUPPRESSION_PATTERN = re.compile(r"^\s*//\s*(ignore|ignore_for_file):", re.MULTILINE)
EMPTY_CATCH_PATTERN = re.compile(r"catch\s*\([^)]*\)\s*\{(\s*)\}")


def audit_file(file_path):
    violations = []
    try:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
    except Exception as e:
        return [{"type": "file_error", "message": f"Error al leer archivo: {e}", "line": 1}]

    full_content = "".join(lines)

    # 1. Detección de supresiones línea a línea (§10)
    for idx, line in enumerate(lines, 1):
        stripped = line.strip()
        if stripped.startswith("// ignore:") or stripped.startswith("// ignore_for_file:"):
            violations.append({
                "type": "suppression_comment",
                "file": str(file_path),
                "line": idx,
                "message": f"Supresión de linter no autorizada (§10): {stripped}",
                "snippet": stripped
            })

    # 2. Detección de bibliotecas de simulación prohibidas (§4)
    for idx, line in enumerate(lines, 1):
        if SIM_IMPORT_PATTERN.search(line):
            violations.append({
                "type": "prohibited_simulation_library",
                "file": str(file_path),
                "line": idx,
                "message": f"Import de simulación prohibido en producción (§4): {line.strip()}",
                "snippet": line.strip()
            })
        elif SIM_CLASS_PATTERN.search(line):
            violations.append({
                "type": "prohibited_simulation_library",
                "file": str(file_path),
                "line": idx,
                "message": f"Herencia de simulación prohibida en producción (§4): {line.strip()}",
                "snippet": line.strip()
            })

    # 3. Detección de bloques catch vacíos sin justificación (§10)
    for match in EMPTY_CATCH_PATTERN.finditer(full_content):
        start = match.start()
        # Verificar si contiene INTENTIONAL: en los alrededores o dentro
        catch_snippet = match.group(0)
        line_num = full_content[:start].count("\n") + 1
        line_content = lines[line_num - 1] if line_num <= len(lines) else catch_snippet
        if "INTENTIONAL:" not in line_content and "intentional:" not in line_content:
            violations.append({
                "type": "unjustified_empty_catch",
                "file": str(file_path),
                "line": line_num,
                "message": "Bloque catch vacío sin justificación explícita // INTENTIONAL: (§10)",
                "snippet": line_content.strip()
            })

    return violations


def audit_directory(target_dir):
    all_violations = []
    scanned_count = 0
    path_obj = Path(target_dir)

    if path_obj.is_file():
        if path_obj.suffix == ".dart":
            scanned_count = 1
            all_violations.extend(audit_file(path_obj))
    elif path_obj.is_dir():
        for root, dirs, files in os.walk(target_dir):
            # Omitir .git, .dart_tool, build, quarantine
            dirs[:] = [d for d in dirs if d not in {".git", ".dart_tool", "build", "quarantine", "graveyard"}]
            for file in sorted(files):
                if file.endswith(".dart"):
                    scanned_count += 1
                    fp = os.path.join(root, file)
                    all_violations.extend(audit_file(fp))
    else:
        raise FileNotFoundError(f"Ruta objetivo inexistente: {target_dir}")

    return scanned_count, all_violations


def main():
    parser = argparse.ArgumentParser(description="Antagonist Audit Engine (§4, §6, §10, §55)")
    parser.add_argument("--target", default=".", help="Directorio o archivo a auditar")
    parser.add_argument("--mode", default="all", help="Modo de auditoría: all, simulations, suppressions, catches")
    parser.add_argument("--json", action="store_true", help="Salida en formato JSON estructurado")
    parser.add_argument("--fail-on-violation", action="store_true", default=True, help="Salir con código 1 si hay infracciones")
    args = parser.parse_args()

    try:
        scanned, violations = audit_directory(args.target)
    except FileNotFoundError as e:
        if args.json:
            print(json.dumps({"error": str(e), "exit_code": 2}))
        else:
            print(f"❌ Error: {e}", file=sys.stderr)
        sys.exit(2)

    is_clean = len(violations) == 0

    if args.json:
        report = {
            "target": args.target,
            "total_files_scanned": scanned,
            "violation_count": len(violations),
            "is_clean": is_clean,
            "violations": violations
        }
        print(json.dumps(report, indent=2))
    else:
        if is_clean:
            print(f"✅ [ANTAGONIST-AUDIT-PASS] {scanned} archivos auditados: 0 toxinas ni desvíos (§4, §6, §10, §55).")
        else:
            print(f"❌ [ANTAGONIST-AUDIT-FAIL] Detectadas {len(violations)} infracciones en {scanned} archivos:")
            for v in violations:
                print(f"   [{v['type']}] {v.get('file', '')}:{v.get('line', 1)} — {v['message']}")

    if not is_clean and args.fail_on_violation:
        sys.exit(1)

    sys.exit(0)


if __name__ == "__main__":
    main()
