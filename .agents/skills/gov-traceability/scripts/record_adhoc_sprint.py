#!/usr/bin/env python3
"""
Auto-Recorder de Sprints en Caliente con Reconciliación Bidireccional SSSoT
(TASK-N40-02 - CMMI-5 Trazabilidad Inmutable).
"""

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime

def get_git_commits(limit: int = 15, since_commit: str = None) -> list:
    cmd = ["git", "log", f"-n{limit}", "--pretty=format:%H|||%s|||%an|||%ad", "--date=iso"]
    if since_commit:
        cmd = ["git", "log", f"{since_commit}..HEAD", "--pretty=format:%H|||%s|||%an|||%ad", "--date=iso"]
    try:
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        commits = []
        for line in res.stdout.strip().split("\n"):
            if not line:
                continue
            parts = line.split("|||")
            if len(parts) >= 4:
                commits.append({
                    "hash": parts[0],
                    "subject": parts[1],
                    "author": parts[2],
                    "date": parts[3]
                })
        return commits
    except Exception as e:
        sys.stderr.write(f"ERROR: Fallo al consultar git log: {e}\n")
        return []

def load_backlog(backlog_path: str) -> dict:
    if not os.path.exists(backlog_path):
        raise FileNotFoundError(f"Backlog no encontrado en: {backlog_path}")
    with open(backlog_path, "r", encoding="utf-8") as f:
        return json.load(f)

def save_backlog(backlog_path: str, data: dict):
    with open(backlog_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

def extract_registered_tasks(backlog: dict) -> set:
    registered = set()
    for s in backlog.get("sprints", []):
        for t in s.get("tasks", []):
            if "id" in t:
                registered.add(t["id"])
    return registered

def reconcile_adhoc_sprint(
    backlog_path: str,
    explicit_task: dict = None,
    since_commit: str = None,
    limit: int = 15,
    scan_git: bool = True,
    dry_run: bool = False
) -> dict:
    backlog = load_backlog(backlog_path)
    registered_task_ids = extract_registered_tasks(backlog)

    orphan_tasks = []

    # 1. Si se pasó una tarea ad-hoc explícita
    if explicit_task:
        task_id = explicit_task.get("id")
        if task_id and task_id not in registered_task_ids:
            orphan_tasks.append({
                "id": task_id,
                "label": explicit_task.get("label", "ADHOC/PATCH"),
                "title": explicit_task.get("title", f"Ad-hoc hotfix {task_id}"),
                "desc": explicit_task.get("desc", "Tarea ejecutada en caliente formalizada por SSSoT Recorder."),
                "status": "COMPLETED",
                "zone": explicit_task.get("zone", "AMBER"),
                "detail_doc": None
            })

    # 2. Escanear commits recientes en busca de tareas no registradas
    if scan_git and limit > 0:
        commits = get_git_commits(limit=limit, since_commit=since_commit)
        task_regex = re.compile(r'\b(TASK-[A-Za-z0-9_-]+)\b')

        for c in commits:
            subj = c["subject"]
            matches = task_regex.findall(subj)
            for m in matches:
                if m not in registered_task_ids and not any(t["id"] == m for t in orphan_tasks):
                    orphan_tasks.append({
                        "id": m,
                        "label": "ADHOC/HOTFIX",
                        "title": f"Formalización ad-hoc: {subj}",
                        "desc": f"Commit {c['hash'][:8]} ({c['date']}): {subj}",
                        "status": "COMPLETED",
                        "zone": "GREEN",
                        "detail_doc": None
                    })

    if not orphan_tasks:
        return {"status": "NO_ORPHANS", "reconciled_tasks": 0, "sprint_id": None}

    now_ts = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    sprint_id = f"ADHOC-{now_ts}"
    new_sprint = {
        "id": sprint_id,
        "name": f"Sprint Ad-hoc {sprint_id} (Reconciliación SSSoT)",
        "title": f"Micro-Sprint Ad-hoc: Reconciliación en Caliente ({len(orphan_tasks)} tareas)",
        "status": "COMPLETED",
        "tasks": orphan_tasks
    }

    if not dry_run:
        backlog.setdefault("sprints", []).append(new_sprint)
        save_backlog(backlog_path, backlog)

    return {
        "status": "RECONCILED",
        "reconciled_tasks": len(orphan_tasks),
        "sprint_id": sprint_id,
        "tasks": [t["id"] for t in orphan_tasks]
    }

def main():
    parser = argparse.ArgumentParser(description="Auto-Recorder de Sprints en Caliente (SSSoT Reconciler)")
    parser.add_argument("--backlog", default="backlog.json", help="Ruta al backlog.json")
    parser.add_argument("--task-id", help="ID de tarea ad-hoc explícita")
    parser.add_argument("--task-title", default="", help="Título de tarea ad-hoc")
    parser.add_argument("--task-desc", default="", help="Descripción de tarea ad-hoc")
    parser.add_argument("--since-commit", help="Commit base para diff de git log")
    parser.add_argument("--limit", type=int, default=15, help="Límite de commits a escanear")
    parser.add_argument("--no-git", action="store_true", help="Omitir escaneo de git log")
    parser.add_argument("--dry-run", action="store_true", help="Simulación sin escritura en disco")

    args = parser.parse_args()

    explicit_task = None
    if args.task_id:
        explicit_task = {
            "id": args.task_id,
            "title": args.task_title or f"Adhoc {args.task_id}",
            "desc": args.task_desc or "Ejecución ad-hoc registrada en caliente.",
            "label": "ADHOC/PATCH",
            "zone": "GREEN"
        }

    try:
        res = reconcile_adhoc_sprint(
            backlog_path=args.backlog,
            explicit_task=explicit_task,
            since_commit=args.since_commit,
            limit=args.limit,
            scan_git=not args.no_git,
            dry_run=args.dry_run
        )
        print(json.dumps(res, indent=2))
        sys.exit(0)
    except FileNotFoundError as e:
        sys.stderr.write(f"ERROR: {e}\n")
        sys.exit(1)
    except Exception as e:
        sys.stderr.write(f"ERROR inesperado: {e}\n")
        sys.exit(2)

if __name__ == "__main__":
    main()
