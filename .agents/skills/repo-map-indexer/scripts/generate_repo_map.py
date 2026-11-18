#!/usr/bin/env python3
"""
generate_repo_map.py — Deterministic Lightweight AST Repo-Map Generator (§4, §6, §55).
Generates an ultra-compact summary of classes, methods, constructors, getters/setters,
DTO fields, and top-level functions from Dart and Python files.
Designed for Automa workers to consume rich structural context in <= 2KB RAM.
Adheres to Calm Error UX: syntax errors or corrupt files degrade gracefully without crashing.
"""

import os
import sys
import re
import ast
import json
import argparse
from typing import List, Dict, Any, Tuple, Optional, Set


class RepoMapIndexer:
    """
    Deterministic AST Repo-Map generator.
    Scans a target directory, extracts structural symbols via AST and regex parsers,
    and formats them within a strict byte budget (default: 2048 bytes).
    """

    def __init__(
        self,
        root_dir: str = ".",
        max_bytes: int = 2048,
        include_ext: Tuple[str, ...] = (".dart", ".py"),
        exclude_dirs: Optional[Set[str]] = None,
        verbose: bool = False,
    ):
        self.root_dir = os.path.abspath(root_dir)
        self.max_bytes = max_bytes
        self.include_ext = tuple(e.lower() for e in include_ext)
        self.exclude_dirs = exclude_dirs or {
            ".git",
            ".dart_tool",
            "build",
            "node_modules",
            "dist",
            "__pycache__",
            ".system_generated",
            ".idea",
            ".vscode",
        }
        self.verbose = verbose
        self.warnings: List[str] = []

    def scan(self) -> List[Dict[str, Any]]:
        """Walk directory tree deterministically and extract symbols from matching files."""
        if not os.path.exists(self.root_dir):
            raise FileNotFoundError(f"Root path does not exist: {self.root_dir}")
        if not os.path.isdir(self.root_dir):
            raise NotADirectoryError(f"Root path is not a directory: {self.root_dir}")

        file_entries: List[Tuple[str, str, str]] = []
        for root, dirs, files in os.walk(self.root_dir):
            # Exclude ignored directories in-place for performance and memory conservation
            dirs[:] = [
                d
                for d in dirs
                if d not in self.exclude_dirs and not d.startswith(".")
            ]
            dirs.sort()

            for file_name in sorted(files):
                ext = os.path.splitext(file_name)[1].lower()
                if ext in self.include_ext:
                    full_path = os.path.join(root, file_name)
                    rel_path = os.path.relpath(full_path, self.root_dir).replace("\\", "/")
                    file_entries.append((rel_path, full_path, ext))

        file_entries.sort(key=lambda item: item[0])

        parsed_files: List[Dict[str, Any]] = []
        for rel_path, full_path, ext in file_entries:
            try:
                with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()
            except Exception as read_err:
                warn = f"Could not read {rel_path}: {read_err}"
                self.warnings.append(warn)
                if self.verbose:
                    sys.stderr.write(f"[WARN] {warn}\n")
                parsed_files.append({
                    "path": rel_path,
                    "symbols": [{
                        "kind": "warning",
                        "name": "unreadable",
                        "signature": "# [ERROR: Read failure]",
                        "children": [],
                    }],
                    "warnings": [warn],
                })
                continue

            if ext == ".py":
                symbols, file_warns = self._parse_python(rel_path, content)
            elif ext == ".dart":
                symbols, file_warns = self._parse_dart(rel_path, content)
            else:
                symbols, file_warns = [], []

            self.warnings.extend(file_warns)
            parsed_files.append({
                "path": rel_path,
                "symbols": symbols,
                "warnings": file_warns,
            })

        return parsed_files

    def _parse_python(self, rel_path: str, content: str) -> Tuple[List[Dict[str, Any]], List[str]]:
        """Parses Python source via ast module with regex fallback on SyntaxError (Calm Error UX)."""
        symbols: List[Dict[str, Any]] = []
        warns: List[str] = []

        try:
            tree = ast.parse(content, filename=rel_path)
            for node in tree.body:
                if isinstance(node, ast.ClassDef):
                    cls_sym = {
                        "kind": "class",
                        "name": node.name,
                        "signature": f"class {node.name}",
                        "children": [],
                    }
                    for item in node.body:
                        if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                            prefix = "async def" if isinstance(item, ast.AsyncFunctionDef) else "def"
                            args_list = [a.arg for a in item.args.args]
                            ret = f" -> {ast.unparse(item.returns)}" if item.returns else ""
                            args_str = ", ".join(args_list)
                            sig = f"{prefix} {item.name}({args_str}){ret}"
                            cls_sym["children"].append({
                                "kind": "method",
                                "name": item.name,
                                "signature": sig,
                            })
                        elif isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name):
                            type_str = f": {ast.unparse(item.annotation)}" if item.annotation else ""
                            cls_sym["children"].append({
                                "kind": "field",
                                "name": item.target.id,
                                "signature": f"{item.target.id}{type_str}",
                            })
                    symbols.append(cls_sym)
                elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    prefix = "async def" if isinstance(node, ast.AsyncFunctionDef) else "def"
                    args_list = [a.arg for a in node.args.args]
                    ret = f" -> {ast.unparse(node.returns)}" if node.returns else ""
                    args_str = ", ".join(args_list)
                    sig = f"{prefix} {node.name}({args_str}){ret}"
                    symbols.append({
                        "kind": "function",
                        "name": node.name,
                        "signature": sig,
                        "children": [],
                    })
        except SyntaxError as se:
            warn = f"Syntax error in Python file {rel_path} (line {se.lineno}): {se.msg}"
            warns.append(warn)
            if self.verbose:
                sys.stderr.write(f"[WARN] {warn}\n")
            # Fallback line scanner to salvage structural definitions
            fallback_symbols = self._fallback_python_scan(content)
            if fallback_symbols:
                symbols.extend(fallback_symbols)
            symbols.append({
                "kind": "warning",
                "name": "syntax_degraded",
                "signature": f"# [SYNTAX_WARNING: Syntax error line {se.lineno}]",
                "children": [],
            })
        except Exception as ex:
            warn = f"Degradation parsing Python file {rel_path}: {ex}"
            warns.append(warn)
            if self.verbose:
                sys.stderr.write(f"[WARN] {warn}\n")
            symbols.append({
                "kind": "warning",
                "name": "degraded",
                "signature": "# [SYNTAX_WARNING: Parse degraded]",
                "children": [],
            })

        return symbols, warns

    def _fallback_python_scan(self, content: str) -> List[Dict[str, Any]]:
        """Lightweight regex line scanner for corrupted Python files."""
        symbols: List[Dict[str, Any]] = []
        for line in content.splitlines():
            s_line = line.strip()
            cls_match = re.match(r"^class\s+([A-Za-z0-9_]+)", s_line)
            if cls_match:
                symbols.append({
                    "kind": "class",
                    "name": cls_match.group(1),
                    "signature": f"class {cls_match.group(1)}",
                    "children": [],
                })
                continue
            fn_match = re.match(r"^(?:async\s+)?def\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)", s_line)
            if fn_match:
                symbols.append({
                    "kind": "function",
                    "name": fn_match.group(1),
                    "signature": f"def {fn_match.group(1)}({fn_match.group(2).strip()})",
                    "children": [],
                })
        return symbols

    def _tokenize_dart_blocks(self, text: str) -> List[str]:
        """
        Splits Dart text on code block braces '{' and '}' that are not inside
        strings or parentheses (such as named constructor parameter lists).
        """
        tokens: List[str] = []
        current: List[str] = []
        in_single_q = False
        in_double_q = False
        paren_depth = 0

        i = 0
        n = len(text)
        while i < n:
            c = text[i]
            if c == "\\" and (in_single_q or in_double_q):
                current.append(c)
                if i + 1 < n:
                    current.append(text[i + 1])
                    i += 2
                    continue
                i += 1
                continue

            if c == "'" and not in_double_q:
                in_single_q = not in_single_q
                current.append(c)
            elif c == '"' and not in_single_q:
                in_double_q = not in_double_q
                current.append(c)
            elif not in_single_q and not in_double_q:
                if c == "(":
                    paren_depth += 1
                    current.append(c)
                elif c == ")":
                    if paren_depth > 0:
                        paren_depth -= 1
                    current.append(c)
                elif paren_depth == 0 and c in ("{", "}"):
                    part = "".join(current).strip()
                    if part:
                        tokens.append(part)
                    tokens.append(c)
                    current = []
                    i += 1
                    continue
                else:
                    current.append(c)
            else:
                current.append(c)
            i += 1

        rem = "".join(current).strip()
        if rem:
            tokens.append(rem)
        return tokens

    def _parse_dart(self, rel_path: str, content: str) -> Tuple[List[Dict[str, Any]], List[str]]:
        """Parses Dart files extracting classes, methods, constructors, DTO fields, and getters/setters."""
        symbols: List[Dict[str, Any]] = []
        warns: List[str] = []

        try:
            # Strip block comments
            clean = re.sub(r"/\*[\s\S]*?\*/", "", content)
            clean_lines = [re.sub(r"//.*", "", l) for l in clean.split("\n")]
            clean = "\n".join(clean_lines)

            tokens = self._tokenize_dart_blocks(clean)

            class_re = re.compile(
                r"^\s*(?:(?:abstract|sealed|base|interface|final)\s+)*(class|mixin|enum|extension)\s+([A-Za-z0-9_$]+)(?:<[^>]+>)?"
            )
            ctor_re = re.compile(
                r"^\s*(?:const\s+|factory\s+)?([A-Za-z0-9_$]+(?:\.[A-Za-z0-9_$]+)?)\s*\(([^)]*)\)"
            )
            method_re = re.compile(
                r"^\s*(?:(?:static|override|const|factory)\s+)*([A-Za-z0-9_$<>, ?]+)\s+([A-Za-z0-9_$]+)\s*\(([^)]*)\)"
            )
            getter_re = re.compile(
                r"^\s*(?:static\s+)?([A-Za-z0-9_$<>, ?]+)\s+get\s+([A-Za-z0-9_$]+)"
            )
            setter_re = re.compile(
                r"^\s*(?:static\s+)?set\s+([A-Za-z0-9_$]+)\s*\(([^)]*)\)"
            )
            field_re = re.compile(
                r"^\s*(?:static\s+)?(?:const\s+|final\s+|late\s+)+([A-Za-z0-9_$<>, ?]+)\s+([A-Za-z0-9_$]+)(?:\s*=.*)?$"
            )

            brace_depth = 0
            current_cls: Optional[Dict[str, Any]] = None

            for tok in tokens:
                if tok == "{":
                    brace_depth += 1
                    continue
                elif tok == "}":
                    brace_depth -= 1
                    if brace_depth <= 0:
                        brace_depth = 0
                        current_cls = None
                    continue

                for raw_line in tok.split("\n"):
                    line = raw_line.strip()
                    if not line:
                        continue

                    # Process statements separated by semicolon or single expressions
                    stmts = [s.strip() for s in line.split(";") if s.strip()]
                    for stmt in stmts:
                        if brace_depth == 0:
                            cm = class_re.match(stmt)
                            if cm:
                                kind, name = cm.group(1), cm.group(2)
                                current_cls = {
                                    "kind": kind,
                                    "name": name,
                                    "signature": f"{kind} {name}",
                                    "children": [],
                                }
                                symbols.append(current_cls)
                            else:
                                mm = method_re.match(stmt)
                                if mm and not stmt.startswith(("return ", "throw ", "if ", "for ", "while ")):
                                    ret, name, args = mm.group(1).strip(), mm.group(2).strip(), mm.group(3).strip()
                                    symbols.append({
                                        "kind": "function",
                                        "name": name,
                                        "signature": f"{ret} {name}({args})",
                                        "children": [],
                                    })
                        elif brace_depth == 1 and current_cls is not None:
                            cname = current_cls["name"]
                            # Constructor detection
                            cm = ctor_re.match(stmt)
                            if cm and (cm.group(1) == cname or cm.group(1).startswith(f"{cname}.")):
                                sig = cm.group(0).strip().rstrip("{;").strip()
                                current_cls["children"].append({
                                    "kind": "constructor",
                                    "name": cm.group(1),
                                    "signature": sig,
                                })
                            else:
                                gm = getter_re.match(stmt)
                                if gm:
                                    current_cls["children"].append({
                                        "kind": "getter",
                                        "name": gm.group(2),
                                        "signature": f"{gm.group(1)} get {gm.group(2)}",
                                    })
                                else:
                                    sm = setter_re.match(stmt)
                                    if sm:
                                        current_cls["children"].append({
                                            "kind": "setter",
                                            "name": sm.group(1),
                                            "signature": f"set {sm.group(1)}({sm.group(2)})",
                                        })
                                    else:
                                        mm = method_re.match(stmt)
                                        if mm and not stmt.startswith(("return ", "throw ", "if ", "for ", "while ")):
                                            ret, name, args = mm.group(1).strip(), mm.group(2).strip(), mm.group(3).strip()
                                            current_cls["children"].append({
                                                "kind": "method",
                                                "name": name,
                                                "signature": f"{ret} {name}({args})",
                                            })
                                        else:
                                            fld = field_re.match(stmt)
                                            if fld:
                                                current_cls["children"].append({
                                                    "kind": "field",
                                                    "name": fld.group(2),
                                                    "signature": f"final {fld.group(1)} {fld.group(2)}",
                                                })

            if brace_depth != 0:
                warn = f"Unbalanced braces in Dart file {rel_path} (brace depth {brace_depth})"
                warns.append(warn)
                if self.verbose:
                    sys.stderr.write(f"[WARN] {warn}\n")
                symbols.append({
                    "kind": "warning",
                    "name": "syntax_degraded",
                    "signature": "# [SYNTAX_WARNING: Unbalanced braces]",
                    "children": [],
                })
        except Exception as ex:
            warn = f"Error parsing Dart file {rel_path}: {ex}"
            warns.append(warn)
            if self.verbose:
                sys.stderr.write(f"[WARN] {warn}\n")
            symbols.append({
                "kind": "warning",
                "name": "degraded",
                "signature": "# [SYNTAX_WARNING: Parse degraded]",
                "children": [],
            })

        return symbols, warns

    def format_text(self, parsed_files: List[Dict[str, Any]]) -> str:
        """Formats the repo map in Aider-style text, strictly bounded by max_bytes."""
        lines: List[str] = [
            "# REPO-MAP (codebase-ast-indexer)",
            f"# Root: {os.path.basename(self.root_dir) or self.root_dir} | Files: {len(parsed_files)} | Budget: {self.max_bytes} B",
            "",
        ]

        for file_info in parsed_files:
            path = file_info["path"]
            symbols = file_info["symbols"]
            if not symbols:
                continue

            lines.append(f"{path}:")
            for sym in symbols:
                kind = sym.get("kind")
                sig = sym.get("signature", sym.get("name", ""))
                if kind in ("class", "mixin", "enum", "extension"):
                    lines.append(f"  {sig}:")
                    for child in sym.get("children", []):
                        child_sig = child.get("signature", child.get("name", ""))
                        lines.append(f"    {child_sig}")
                else:
                    lines.append(f"  {sig}")

        full_text = "\n".join(lines)
        full_bytes = full_text.encode("utf-8")

        if len(full_bytes) <= self.max_bytes:
            return full_text

        # Strict budget truncation
        trunc_marker = f"\n# [TRUNCATED: Budget of {self.max_bytes} bytes reached]"
        trunc_marker_bytes = trunc_marker.encode("utf-8")
        available_bytes = self.max_bytes - len(trunc_marker_bytes)

        if available_bytes <= 0:
            return full_bytes[: self.max_bytes].decode("utf-8", errors="ignore")

        truncated_lines: List[str] = []
        accumulated_bytes = 0
        for line in lines:
            line_bytes = len((line + "\n").encode("utf-8"))
            if accumulated_bytes + line_bytes > available_bytes:
                break
            truncated_lines.append(line)
            accumulated_bytes += line_bytes

        truncated_text = "\n".join(truncated_lines) + trunc_marker
        final_bytes = truncated_text.encode("utf-8")

        if len(final_bytes) > self.max_bytes:
            return final_bytes[: self.max_bytes].decode("utf-8", errors="ignore")

        return truncated_text

    def format_json(self, parsed_files: List[Dict[str, Any]]) -> str:
        """Formats the repo map in structured JSON, respecting max_bytes."""
        data: Dict[str, Any] = {
            "generator": "repo-map-indexer",
            "version": "1.0.0",
            "root": os.path.basename(self.root_dir) or self.root_dir,
            "files_count": len(parsed_files),
            "budget_bytes": self.max_bytes,
            "truncated": False,
            "warnings": self.warnings,
            "files": parsed_files,
        }

        json_str = json.dumps(data, indent=2)
        if len(json_str.encode("utf-8")) <= self.max_bytes:
            return json_str

        # Prune files to fit in budget
        pruned_files = list(parsed_files)
        while pruned_files:
            pruned_files.pop()
            candidate = {**data, "files": pruned_files, "truncated": True}
            candidate_str = json.dumps(candidate, indent=2)
            if len(candidate_str.encode("utf-8")) <= self.max_bytes:
                return candidate_str

        # Ultra-compact fallback
        compact = {
            "generator": "repo-map-indexer",
            "version": "1.0.0",
            "truncated": True,
            "files_count": len(parsed_files),
        }
        compact_str = json.dumps(compact)
        if len(compact_str.encode("utf-8")) <= self.max_bytes:
            return compact_str

        return compact_str[: self.max_bytes]


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Deterministic AST Repo-Map Generator (codebase-ast-indexer) for Automa Workers (§4, §6, §55)"
    )
    parser.add_argument(
        "--root",
        default=".",
        help="Root directory of the repository to index (default: .)",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Output file path (default: stdout)",
    )
    parser.add_argument(
        "--max-bytes",
        type=int,
        default=2048,
        help="Maximum byte budget for output (default: 2048)",
    )
    parser.add_argument(
        "--format",
        choices=["text", "json"],
        default="text",
        help="Output format: text or json (default: text)",
    )
    parser.add_argument(
        "--include-ext",
        default=".dart,.py",
        help="Comma-separated file extensions to include (default: .dart,.py)",
    )
    parser.add_argument(
        "--exclude-dirs",
        default=".git,.dart_tool,build,node_modules,dist,__pycache__,.system_generated,.idea,.vscode",
        help="Comma-separated directory names to ignore",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable diagnostic warning output on stderr",
    )

    args = parser.parse_args()

    # Input validations for Sad Paths (§6)
    if args.max_bytes <= 0:
        sys.stderr.write(f"[ERROR] --max-bytes must be a positive integer > 0 (received: {args.max_bytes})\n")
        sys.exit(2)

    if not os.path.exists(args.root):
        sys.stderr.write(f"[ERROR] Root path does not exist: {args.root}\n")
        sys.exit(2)

    if not os.path.isdir(args.root):
        sys.stderr.write(f"[ERROR] Root path is not a directory: {args.root}\n")
        sys.exit(2)

    exts = tuple(
        ext if ext.startswith(".") else f".{ext}"
        for ext in args.include_ext.split(",")
        if ext.strip()
    )
    exclude_set = {d.strip() for d in args.exclude_dirs.split(",") if d.strip()}

    indexer = RepoMapIndexer(
        root_dir=args.root,
        max_bytes=args.max_bytes,
        include_ext=exts,
        exclude_dirs=exclude_set,
        verbose=args.verbose,
    )

    parsed_files = indexer.scan()

    if args.format == "json":
        output_str = indexer.format_json(parsed_files)
    else:
        output_str = indexer.format_text(parsed_files)

    if args.output:
        out_dir = os.path.dirname(os.path.abspath(args.output))
        if out_dir and not os.path.exists(out_dir):
            os.makedirs(out_dir, exist_ok=True)
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output_str)
        if args.verbose:
            sys.stderr.write(f"[INFO] Repo map written to {args.output}\n")
    else:
        sys.stdout.write(output_str + ("\n" if not output_str.endswith("\n") else ""))

    # Graceful exit: even if files were degraded, the mapping completed successfully
    sys.exit(0)


if __name__ == "__main__":
    main()
