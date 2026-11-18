#!/usr/bin/env python3
"""worktree_guardian.py - Guardian y Gestor de Git Worktrees para Workers de Flota.

Herramienta canonica para auditar, crear, purgar y remover worktrees efimeros
utilizados por workers de ejecucion autonoma (Automa, Smart y satelites).
Conforme a las reglas constitucionales de gobernanza (§4, §6, §12.b, §45, §55).
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


class WorktreeGuardianError(Exception):
    """Excepcion base para errores del guardian de worktrees."""


class RepositoryNotFoundError(WorktreeGuardianError):
    """Arrojada cuando la ruta indicada no es un repositorio Git valido."""


class WorktreeNotFoundError(WorktreeGuardianError):
    """Arrojada cuando se busca un worktree que no esta registrado."""


class WorktreeCreationError(WorktreeGuardianError):
    """Arrojada cuando falla la creacion de un worktree."""


def run_git_command(
    args: List[str],
    repo_path: Optional[str] = None,
    check: bool = True,
) -> Tuple[int, str, str]:
    """Ejecuta un comando git real y retorna (exit_code, stdout, stderr)."""
    cwd = repo_path if repo_path else os.getcwd()
    cmd = ["git"] + args
    result = subprocess.run(
        cmd,
        cwd=cwd,
        capture_output=True,
        text=True,
    )
    if check and result.returncode != 0:
        err_msg = result.stderr.strip() or result.stdout.strip()
        raise WorktreeGuardianError(
            f"Fallo en comando git {' '.join(cmd)} (exit {result.returncode}): {err_msg}"
        )
    return result.returncode, result.stdout.strip(), result.stderr.strip()


def find_git_root(start_path: Optional[str] = None) -> str:
    """Encuentra la raiz del repositorio git mas cercano."""
    target = os.path.abspath(start_path) if start_path else os.getcwd()
    if not os.path.exists(target):
        raise RepositoryNotFoundError(f"La ruta especificada no existe: {target}")

    ret, stdout, _ = run_git_command(
        ["rev-parse", "--show-toplevel"],
        repo_path=target,
        check=False,
    )
    if ret != 0 or not stdout:
        raise RepositoryNotFoundError(
            f"La ruta no forma parte de un repositorio Git valido: {target}"
        )
    return stdout


def parse_worktree_porcelain(raw_output: str) -> List[Dict[str, Any]]:
    """Parsea la salida de `git worktree list --porcelain` en diccionarios estructurados."""
    worktrees: List[Dict[str, Any]] = []
    if not raw_output.strip():
        return worktrees

    blocks = raw_output.strip().split("\n\n")
    for block in blocks:
        if not block.strip():
            continue
        entry: Dict[str, Any] = {
            "path": "",
            "head": "",
            "branch": "",
            "bare": False,
            "locked": False,
            "lock_reason": "",
            "prunable": False,
            "prune_reason": "",
        }
        lines = block.strip().split("\n")
        for line in lines:
            if line.startswith("worktree "):
                entry["path"] = line[len("worktree ") :].strip()
            elif line.startswith("HEAD "):
                entry["head"] = line[len("HEAD ") :].strip()
            elif line.startswith("branch "):
                ref = line[len("branch ") :].strip()
                # Remover prefijo refs/heads/ si existe
                if ref.startswith("refs/heads/"):
                    entry["branch"] = ref[len("refs/heads/") :]
                else:
                    entry["branch"] = ref
            elif line == "bare":
                entry["bare"] = True
            elif line.startswith("locked"):
                entry["locked"] = True
                reason = line[len("locked") :].strip()
                entry["lock_reason"] = reason
            elif line.startswith("prunable"):
                entry["prunable"] = True
                reason = line[len("prunable") :].strip()
                entry["prune_reason"] = reason

        if entry["path"]:
            worktrees.append(entry)

    return worktrees


def audit_worktrees(
    repo_path: str,
    max_age_hours: float = 24.0,
) -> Dict[str, Any]:
    """Audita todos los worktrees del repositorio y clasifica su estado de salud."""
    root = find_git_root(repo_path)
    ret, stdout, _ = run_git_command(
        ["worktree", "list", "--porcelain"],
        repo_path=root,
        check=True,
    )

    parsed = parse_worktree_porcelain(stdout)
    now = time.time()
    audited_list: List[Dict[str, Any]] = []
    zombie_count = 0
    active_count = 0
    locked_count = 0
    stale_count = 0

    for idx, wt in enumerate(parsed):
        path = wt["path"]
        exists_on_disk = os.path.isdir(path)
        is_main = idx == 0 or os.path.samefile(path, root) if (exists_on_disk and os.path.exists(root)) else (idx == 0)

        age_seconds: Optional[float] = None
        age_hours: Optional[float] = None
        is_stale = False

        if exists_on_disk:
            try:
                mtime = os.path.getmtime(path)
                age_seconds = round(now - mtime, 2)
                age_hours = round(age_seconds / 3600.0, 2)
                if not is_main and age_hours > max_age_hours:
                    is_stale = True
                    stale_count += 1
            except OSError:
                pass

        # Determinar status sintetico
        if is_main:
            status = "MAIN"
            active_count += 1
        elif not exists_on_disk or wt["prunable"]:
            status = "ZOMBIE"
            zombie_count += 1
        elif wt["locked"]:
            status = "LOCKED"
            locked_count += 1
        elif is_stale:
            status = "STALE"
            active_count += 1
        else:
            status = "ACTIVE"
            active_count += 1

        item = {
            "path": path,
            "branch": wt["branch"],
            "head": wt["head"],
            "is_main": is_main,
            "exists_on_disk": exists_on_disk,
            "status": status,
            "locked": wt["locked"],
            "lock_reason": wt["lock_reason"],
            "prunable": wt["prunable"],
            "prune_reason": wt["prune_reason"],
            "age_hours": age_hours,
        }
        audited_list.append(item)

    return {
        "repo_root": root,
        "total_count": len(audited_list),
        "active_count": active_count,
        "zombie_count": zombie_count,
        "locked_count": locked_count,
        "stale_count": stale_count,
        "worktrees": audited_list,
    }


def prune_worktrees(repo_path: str, verbose: bool = True) -> Dict[str, Any]:
    """Ejecuta prune sobre el repositorio para limpiar referencias a worktrees eliminados."""
    root = find_git_root(repo_path)
    ret, stdout, stderr = run_git_command(
        ["worktree", "prune", "--verbose"],
        repo_path=root,
        check=True,
    )
    details = stdout or stderr or "Prune completado sin cambios."
    return {
        "repo_root": root,
        "pruned": True,
        "details": details,
    }


def remove_worktree(
    repo_path: str,
    target: str,
    force: bool = True,
) -> Dict[str, Any]:
    """Remueve un worktree por su ruta o por el nombre de su rama."""
    audit = audit_worktrees(repo_path)
    matched: Optional[Dict[str, Any]] = None

    target_norm = os.path.abspath(target) if os.path.exists(target) else target
    for wt in audit["worktrees"]:
        wt_path_norm = os.path.abspath(wt["path"])
        if wt["path"] == target or wt_path_norm == target_norm or wt["branch"] == target:
            matched = wt
            break

    if not matched:
        raise WorktreeNotFoundError(
            f"No se encontro ningun worktree con ruta o rama: {target}"
        )

    if matched["is_main"]:
        raise WorktreeGuardianError(
            "Seguridad violada: Prohibido remover el worktree principal (MAIN)."
        )

    target_path = matched["path"]
    root = audit["repo_root"]
    remove_args = ["worktree", "remove"]
    if force:
        remove_args.append("--force")
    remove_args.append(target_path)

    ret, stdout, stderr = run_git_command(remove_args, repo_path=root, check=False)

    # Si git fallo porque la carpeta ya no existia, forzar prune manual
    if ret != 0:
        prune_worktrees(root)
        if os.path.exists(target_path):
            shutil.rmtree(target_path, ignore_errors=True)

    return {
        "removed_path": target_path,
        "branch": matched["branch"],
        "status": "REMOVED",
    }


def clean_zombies(
    repo_path: str,
    worker_dir: Optional[str] = None,
    dry_run: bool = False,
) -> Dict[str, Any]:
    """Elimina worktrees zombies (sin directorio fisico) y directorios huerfanos."""
    audit = audit_worktrees(repo_path)
    cleaned_worktrees: List[str] = []
    cleaned_orphan_dirs: List[str] = []

    # 1. Limpiar worktrees zombies registrados
    for wt in audit["worktrees"]:
        if wt["status"] == "ZOMBIE" and not wt["is_main"]:
            cleaned_worktrees.append(wt["path"])
            if not dry_run:
                try:
                    remove_worktree(repo_path, wt["path"], force=True)
                except WorktreeGuardianError:
                    pass

    # 2. Prune para sincronizar metadatos administrativos
    if not dry_run and cleaned_worktrees:
        prune_worktrees(repo_path)

    # 3. Limpiar carpetas huerfanas en el directorio de workers si se especifico
    if worker_dir and os.path.isdir(worker_dir):
        known_paths = {os.path.abspath(wt["path"]) for wt in audit["worktrees"]}
        for entry in os.listdir(worker_dir):
            full_path = os.path.abspath(os.path.join(worker_dir, entry))
            if os.path.isdir(full_path) and full_path not in known_paths:
                # Directorio sin asociacion de worktree activo
                cleaned_orphan_dirs.append(full_path)
                if not dry_run:
                    shutil.rmtree(full_path, ignore_errors=True)

    return {
        "dry_run": dry_run,
        "cleaned_worktrees": cleaned_worktrees,
        "cleaned_orphan_dirs": cleaned_orphan_dirs,
        "count": len(cleaned_worktrees) + len(cleaned_orphan_dirs),
    }


def create_worktree(
    repo_path: str,
    worktree_path: str,
    branch: str,
    base_ref: str = "HEAD",
    force_branch: bool = False,
) -> Dict[str, Any]:
    """Crea un nuevo git worktree aislado en la ruta indicada con la rama especificada."""
    root = find_git_root(repo_path)
    target_abs = os.path.abspath(worktree_path)

    if os.path.exists(target_abs):
        raise WorktreeCreationError(
            f"El directorio de destino para el worktree ya existe fisicamente: {target_abs}"
        )

    # Asegurar que el directorio padre exista
    parent_dir = os.path.dirname(target_abs)
    if parent_dir:
        os.makedirs(parent_dir, exist_ok=True)

    # Verificar si la rama ya existe en el repositorio
    ret, _, _ = run_git_command(
        ["show-ref", "--verify", f"refs/heads/{branch}"],
        repo_path=root,
        check=False,
    )
    branch_exists = (ret == 0)

    add_args = ["worktree", "add"]
    if branch_exists:
        if force_branch:
            add_args.extend(["-B", branch, target_abs, base_ref])
        else:
            add_args.extend([target_abs, branch])
    else:
        add_args.extend(["-b", branch, target_abs, base_ref])

    ret, stdout, stderr = run_git_command(add_args, repo_path=root, check=False)
    if ret != 0:
        err = stderr or stdout
        raise WorktreeCreationError(
            f"Fallo al crear git worktree en '{target_abs}' (rama: {branch}): {err}"
        )

    return {
        "status": "CREATED",
        "repo_root": root,
        "worktree_path": target_abs,
        "branch": branch,
        "base_ref": base_ref,
    }


def build_arg_parser() -> argparse.ArgumentParser:
    """Construye el analizador de argumentos de linea de comandos."""
    parser = argparse.ArgumentParser(
        description="Guardian y Gestor de Git Worktrees para Workers de Flota (§55, §4, §6)."
    )
    parser.add_argument(
        "--repo",
        default=None,
        help="Ruta al repositorio Git (por defecto: directorio actual).",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="Audita y lista todos los worktrees registrados.",
    )
    parser.add_argument(
        "--prune",
        action="store_true",
        help="Ejecuta git worktree prune para depurar referencias caducas.",
    )
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Limpia worktrees zombies y directorios huerfanos.",
    )
    parser.add_argument(
        "--create",
        action="store_true",
        help="Crea un nuevo worktree efimero.",
    )
    parser.add_argument(
        "--path",
        help="Ruta de destino para el worktree (usado con --create o --remove).",
    )
    parser.add_argument(
        "--branch",
        help="Nombre de la rama a asociar al worktree (usado con --create o --remove).",
    )
    parser.add_argument(
        "--base",
        default="HEAD",
        help="Punto de partida/base ref para la nueva rama (por defecto: HEAD).",
    )
    parser.add_argument(
        "--force-branch",
        action="store_true",
        help="Sobrescribe la rama existente si ya existia (-B).",
    )
    parser.add_argument(
        "--remove",
        help="Remueve un worktree especifico por ruta o rama.",
    )
    parser.add_argument(
        "--worker-dir",
        help="Directorio base de workers (ej. /tmp/workers) para escanear huerfanos.",
    )
    parser.add_argument(
        "--max-age-hours",
        type=float,
        default=24.0,
        help="Umbral de horas para catalogar un worktree como STALE (por defecto: 24.0).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simula las operaciones de limpieza sin mutar disco.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emite la respuesta en formato JSON estandar.",
    )
    return parser


def main() -> int:
    """Punto de entrada principal para CLI."""
    parser = build_arg_parser()
    args = parser.parse_args()

    repo = args.repo or os.getcwd()

    try:
        if args.create:
            if not args.path or not args.branch:
                sys.stderr.write("Error: --create requiere --path y --branch.\n")
                return 2
            result = create_worktree(
                repo_path=repo,
                worktree_path=args.path,
                branch=args.branch,
                base_ref=args.base,
                force_branch=args.force_branch,
            )
            if args.json:
                print(json.dumps(result, indent=2))
            else:
                print(f"[CREATED] Worktree creado en {result['worktree_path']} (rama: {result['branch']})")
            return 0

        elif args.remove:
            result = remove_worktree(repo_path=repo, target=args.remove, force=True)
            if args.json:
                print(json.dumps(result, indent=2))
            else:
                print(f"[REMOVED] Worktree removido exitosamente: {result['removed_path']}")
            return 0

        elif args.prune:
            result = prune_worktrees(repo_path=repo)
            if args.json:
                print(json.dumps(result, indent=2))
            else:
                print(f"[PRUNED] {result['details']}")
            return 0

        elif args.clean:
            result = clean_zombies(
                repo_path=repo,
                worker_dir=args.worker_dir,
                dry_run=args.dry_run,
            )
            if args.json:
                print(json.dumps(result, indent=2))
            else:
                print(
                    f"[CLEANED] Limpieza completada: {len(result['cleaned_worktrees'])} worktrees zombies, "
                    f"{len(result['cleaned_orphan_dirs'])} carpetas huerfanas."
                )
            return 0

        else:
            # Por defecto o con --list: auditar
            result = audit_worktrees(repo_path=repo, max_age_hours=args.max_age_hours)
            if args.json:
                print(json.dumps(result, indent=2))
            else:
                print("=== WORKTREE GUARDIAN: AUDITORIA DE REPOSITORIO ===")
                print(f"Repo Root: {result['repo_root']}")
                print(
                    f"Total: {result['total_count']} | Activos: {result['active_count']} | "
                    f"Zombies: {result['zombie_count']} | Bloqueados: {result['locked_count']} | "
                    f"Caducos: {result['stale_count']}"
                )
                print("-" * 75)
                for wt in result["worktrees"]:
                    flag = f"[{wt['status']}]"
                    print(f"{flag:<10} Rama: {wt['branch']:<30} Ruta: {wt['path']}")
            return 0

    except RepositoryNotFoundError as e:
        sys.stderr.write(f"[ERROR-REPO] {e}\n")
        return 2
    except WorktreeNotFoundError as e:
        sys.stderr.write(f"[ERROR-NOTFOUND] {e}\n")
        return 2
    except WorktreeCreationError as e:
        sys.stderr.write(f"[ERROR-CREATE] {e}\n")
        return 1
    except WorktreeGuardianError as e:
        sys.stderr.write(f"[ERROR-GUARDIAN] {e}\n")
        return 1
    except Exception as e:
        sys.stderr.write(f"[FATAL] Error inesperado en worktree_guardian: {e}\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
