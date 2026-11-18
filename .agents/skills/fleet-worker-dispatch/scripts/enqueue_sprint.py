#!/usr/bin/env python3
from __future__ import annotations
"""
enqueue_sprint.py — Despachador universal de sprints hacia la cola SQLite WAL de Automa (§12.b, §44, §45, §48, §51, TASK-N55-03).
Soporta despacho multi-sprint paralelo para saturación de los 3 slots de workers y encadenamiento secuencial opcional.
"""

import os
import re
import sys
import json
import time
import shlex
import sqlite3
import argparse
from pathlib import Path
from datetime import datetime, timezone

DEFAULT_DB_PATH = os.path.join("/opt", "automa", "data", "inference_queue.db")
DEFAULT_MODEL = "gemini-3.8-flash-high"


def resolve_db_path(repo_dir: Path, custom_path: str | None = None) -> str:
    """Resuelve la ruta canónica hacia inference_queue.db (§45)."""
    if custom_path and custom_path.strip() and custom_path != DEFAULT_DB_PATH:
        return str(Path(custom_path).resolve())

    if "AUTOMA_QUEUE_DB" in os.environ and os.environ["AUTOMA_QUEUE_DB"].strip():
        return str(Path(os.environ["AUTOMA_QUEUE_DB"].strip()).resolve())

    # Producción VM Automa / Host
    if os.path.exists(DEFAULT_DB_PATH) and os.access(os.path.dirname(DEFAULT_DB_PATH), os.W_OK):
        return DEFAULT_DB_PATH

    # Fallback local bunker offline-first
    return str((repo_dir / "vault" / "runtime" / "inference_queue.db").resolve())


def ensure_queue_table(conn: sqlite3.Connection):
    """Garantiza la existencia del contrato DDL de inference_queue (§45)."""
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS inference_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id TEXT NOT NULL UNIQUE,
            task_id TEXT NOT NULL,
            source_node TEXT NOT NULL,
            sprint_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'PENDING_INFERENCE',
            payload TEXT NOT NULL,
            retry_count INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
    """)
    conn.commit()


def detect_node_info(repo_dir: Path) -> tuple[str, str]:
    """Detecta el identificador y nombre del nodo a partir de bunker_profile.json o el directorio."""
    bunker_file = repo_dir / "bunker_profile.json"
    if bunker_file.exists():
        try:
            data = json.loads(bunker_file.read_text(encoding="utf-8"))
            node_name = data.get("node_name") or data.get("bunker_id") or data.get("project") or repo_dir.name
            return node_name, str(repo_dir.resolve())
        except Exception:
            # INTENTIONAL: Fallback a nombre de directorio si bunker_profile.json está ausente o corrupto (§45).
            pass
    return repo_dir.name, str(repo_dir.resolve())


def fetch_episodic_memory_snippet(
    conn: sqlite3.Connection | None,
    task: dict,
    node_id: str,
    db_path: str | None = None,
) -> str | None:
    """
    Extrae en <5ms lecciones aprendidas o recetas previas de la tabla episodic_reflections (§45, §52).
    Genera un bloque conciso de 3 líneas para inyección contextual JIT en el prompt.
    """
    close_conn = False
    active_conn = conn
    if active_conn is None:
        if db_path and os.path.exists(db_path):
            try:
                active_conn = sqlite3.connect(db_path, timeout=1.0)
                close_conn = True
            except Exception:
                return None
        else:
            return None

    try:
        cur = active_conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='episodic_reflections';")
        if not cur.fetchone():
            return None

        title = task.get("title", "")
        desc = task.get("desc", task.get("description", ""))
        raw_words = re.findall(r"[a-zA-Z0-9_\-\.]{3,}", f"{title} {desc}")
        stop_words = {
            "task", "para", "como", "con", "del", "las", "los", "una", "uno",
            "que", "por", "sprint", "test", "suite", "and", "the", "from",
        }
        keywords = [w.lower() for w in raw_words if w.lower() not in stop_words]

        candidates = []
        if keywords:
            search_kws = keywords[:3]
            like_clauses = " OR ".join(
                ["error_signature LIKE ? OR reflection_text LIKE ? OR lesson_learned LIKE ?"] * len(search_kws)
            )
            params = []
            for kw in search_kws:
                pat = f"%{kw}%"
                params.extend([pat, pat, pat])

            query = f"""
                SELECT error_signature, category, reflection_text, lesson_learned, resolved_by_task
                FROM episodic_reflections
                WHERE ({like_clauses})
                ORDER BY CASE WHEN UPPER(status) = 'RESOLVED' THEN 0 ELSE 1 END, timestamp DESC
                LIMIT 1;
            """
            cur.execute(query, params)
            row = cur.fetchone()
            if row:
                candidates.append(row)

        if not candidates:
            cur.execute("""
                SELECT error_signature, category, reflection_text, lesson_learned, resolved_by_task
                FROM episodic_reflections
                WHERE node_id = ? OR UPPER(status) = 'RESOLVED'
                ORDER BY timestamp DESC
                LIMIT 1;
            """, (node_id,))
            row = cur.fetchone()
            if row:
                candidates.append(row)

        if not candidates:
            return None

        sig, cat, refl, lesson, resolved = candidates[0]
        recipe_text = (lesson or "").strip() if (lesson and lesson.strip()) else (refl or "").strip()
        if len(recipe_text) > 100:
            recipe_text = recipe_text[:97] + "..."
        antipattern = (sig or "").strip() if (sig and sig.strip()) else (cat or "").strip()
        if len(antipattern) > 60:
            antipattern = antipattern[:57] + "..."
        ref_task = (resolved or "").strip() if (resolved and resolved.strip()) else "Patrón validado"
        if len(ref_task) > 50:
            ref_task = ref_task[:47] + "..."

        return (
            f"- Lección/Receta: {recipe_text}\n"
            f"- Antipatrón Evitado: {antipattern}\n"
            f"- Resolución Referencia: {ref_task}"
        )
    except Exception:
        # INTENTIONAL: Failsafe offline-first <5ms ante cualquier inconsistencia de BD (§45).
        return None
    finally:
        if close_conn and active_conn:
            try:
                active_conn.close()
            except Exception:
                pass


def build_task_prompt(
    node_name: str,
    repo_path: str,
    sprint_id: str,
    task: dict,
    conn: sqlite3.Connection | None = None,
    db_path: str | None = None,
) -> str:
    """Construye un prompt de alta precisión e inmunizado contra alucinaciones con memoria episódica JIT (§4, §6, §12.b, §45, §48, §52)."""
    task_id = task.get("id", "TASK-UNKNOWN")
    title = task.get("title", "")
    desc = task.get("desc", task.get("description", ""))
    predicted_files = task.get("predicted_files", task.get("allowed_files", []))
    files_str = "\n".join(f"- {f}" for f in predicted_files) if predicted_files else "- Según especificación técnica"

    memory_snippet = fetch_episodic_memory_snippet(conn, task, node_name, db_path)
    memory_section = ""
    if memory_snippet:
        memory_section = f"\n=== MEMORIA EPISÓDICA Y RECETAS PREVIAS (§45, §52) ===\n{memory_snippet}\n"

    return f"""Eres un agente de desarrollo autónomo operando en el nodo "{node_name}" ({repo_path}).
Debes implementar de forma atómica y completa la tarea:
[{task_id}] {title}

=== DESCRIPCIÓN Y OBJETIVO ===
{desc}
{memory_section}
=== ARCHIVOS DE ALCANCE PERMITIDOS (MÁXIMO 5, §12.b) ===
{files_str}

=== CRITERIOS DE EJECUCIÓN LEAN (§4, §6, §48) ===
1. Cero mocks en código de producción ni dominio (§4). Pruebas físicas con SQLite o repositorios reales.
2. Sad path mandatorio (§6): al menos una aserción negativa real (throwsA o excepción esperada).
3. Paridad multi-OS: usar PlatformGuard o contextos agnósticos.
4. Al pasar los tests con exit code 0, ejecutar commit atómico inmediato (§48).
"""


def is_live_harvest_task(task: dict) -> tuple[bool, str]:
    """Detecta si una tarea implica ejecución de recolección/harvest/crawling masivo en vivo (§57)."""
    title = task.get("title", "")
    desc = task.get("desc", task.get("description", ""))
    full_text = f"{title} {desc}".lower()

    exec_patterns = [
        "[data/harvest]",
        "[harvest-exec]",
        "[crawl-exec]",
        "[scraping-exec]",
        "ejecución de barrido",
        "barrido dinámico de bots",
        "cosecha masiva en vivo",
        "cosecha desasistida",
        "extracción dinámica sobre",
        "ejecución de cosecha masiva",
        "live crawl",
        "live harvest",
        "live scraping",
    ]

    for pattern in exec_patterns:
        if pattern in full_text:
            if ("construcción" in title.lower() or "suite de certificación" in title.lower()) and pattern not in [
                "[data/harvest]",
                "[harvest-exec]",
                "ejecución de barrido",
                "barrido dinámico de bots",
            ]:
                continue
            return True, pattern

    return False, ""


def is_interactive_lifecycle_task(task: dict) -> tuple[bool, str]:
    """
    Detecta si una tarea modifica el ciclo de vida interactivo de sesión (§50, §50.c, §59).
    Workers efímeros de Automa corriendo en Docker o Git worktrees aislados no deben
    tocar session.relay, handover_halt.lock ni el odómetro del hilo activo del PO.
    """
    title = task.get("title", "")
    desc = task.get("desc", task.get("description", ""))
    full_text = f"{title} {desc}".lower()

    # 1. Comprobación por archivos predichos o permitidos
    predicted_files = [str(f).lower() for f in task.get("predicted_files", task.get("allowed_files", []))]
    sensitive_file_patterns = [
        ".meta/session.relay",
        "handover_halt.lock",
        "session_odometer.json",
        "takeover_gate.dart",
        "logix_takeover.dart",
        "logix_handover.dart",
        "amnesia_immunization_gate.dart",
    ]
    for p_file in predicted_files:
        for sens in sensitive_file_patterns:
            if sens in p_file:
                return True, f"archivo sensible: {p_file}"

    # 2. Comprobación por patrones semánticos en título y descripción
    lifecycle_patterns = [
        "[relay/",
        "[takeover/",
        "[handover/",
        "session.relay",
        "handover_halt.lock",
        "amnesia inter-sesión",
        "amnesia intersesión",
        "inmunización contra amnesia",
        "ciclo de vida de sesión",
        "relevo de sesión",
    ]
    for pattern in lifecycle_patterns:
        if pattern in full_text:
            return True, f"patrón semántico: '{pattern}'"

    return False, ""


def enqueue_sprint(
    sprint_id: str | list[str],
    repo_dir: Path,
    db_path: str = DEFAULT_DB_PATH,
    model: str = DEFAULT_MODEL,
    force: bool = False,
    force_harvest: bool = False,
    force_lifecycle: bool = False,
    dry_run: bool = False,
    wait_for_ticket: str | None = None,
    parallel: bool = True,
    sequential: bool = False,
    max_parallel: int = 3,
    print_prompt: str | None = None,
) -> bool:
    """
    Encola uno o más sprints hacia la cola de inferencia de Automa (§12.b, §44, §45, §48, §51, TASK-N55-03).
    Soporta despacho multi-sprint paralelo (saturando los 3 slots de workers de Automa sin dependencias cruzadas)
    y encadenamiento secuencial inter-sprint cuando se solicita explícitamente.
    """
    repo_dir = repo_dir.resolve()
    backlog_path = repo_dir / "backlog.json"

    if not backlog_path.exists():
        print(f"❌ [ERROR] No se encontró backlog.json en: {repo_dir}")
        return False

    resolved_db_path = resolve_db_path(repo_dir, db_path)
    node_name, repo_path = detect_node_info(repo_dir)

    # Normalizar lista de sprint_ids
    if isinstance(sprint_id, str):
        target_sprint_ids = [s.strip() for s in sprint_id.split(",") if s.strip()]
    elif isinstance(sprint_id, (list, tuple)):
        target_sprint_ids = []
        for item in sprint_id:
            for s in str(item).split(","):
                clean = s.strip()
                if clean and clean not in target_sprint_ids:
                    target_sprint_ids.append(clean)
    else:
        target_sprint_ids = [str(sprint_id).strip()]

    if not target_sprint_ids:
        print("❌ [ERROR] No se especificó ningún identificador de sprint válido.")
        return False

    try:
        backlog_data = json.loads(backlog_path.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"❌ [ERROR] Error leyendo backlog.json: {e}")
        return False

    sprints_catalog: dict[str, dict] = {}
    for s in backlog_data.get("sprints", []):
        s_id = s.get("id", "").upper()
        if s_id:
            sprints_catalog[s_id] = s

    # Fallback transparente a backlog_archive.json si algún sprint no está en backlog activo
    missing_ids = [sid for sid in target_sprint_ids if sid.upper() not in sprints_catalog]
    if missing_ids:
        archive_path = repo_dir / "vault" / "runtime" / "backlog_archive.json"
        if archive_path.exists():
            try:
                archive_data = json.loads(archive_path.read_text(encoding="utf-8"))
                for s in archive_data.get("sprints", []):
                    s_id = s.get("id", "").upper()
                    if s_id and s_id not in sprints_catalog:
                        sprints_catalog[s_id] = s
            except Exception:
                # INTENTIONAL: Fallback ante backlog_archive corrupto o ausente (§45).
                pass

    # Validar existencia de cada sprint
    target_sprints: list[dict] = []
    for sid in target_sprint_ids:
        s_obj = sprints_catalog.get(sid.upper())
        if not s_obj:
            print(f"❌ [ERROR] Sprint '{sid}' no encontrado en {backlog_path}.")
            return False
        target_sprints.append(s_obj)

    if print_prompt:
        for sprint in target_sprints:
            sid = sprint.get("id", "UNKNOWN")
            for t in sprint.get("tasks", []):
                if t.get("id") == print_prompt:
                    p = build_task_prompt(node_name, repo_path, sid, t, db_path=resolved_db_path)
                    print(p)
                    return True
        print(f"❌ [ERROR] Tarea '{print_prompt}' no encontrada en los sprints especificados.")
        return False

    # Validar directivas constitucionales (§44, §12.b, §57)
    for sprint in target_sprints:
        sid = sprint.get("id", "UNKNOWN")
        tasks = sprint.get("tasks", [])
        if not tasks:
            print(f"❌ [ERROR] El sprint '{sid}' no contiene tareas.")
            return False

        if len(tasks) > 7 and not force:
            print(f"❌ [VETO §44] El sprint contiene {len(tasks)} tareas (máximo permitido: 7). Auto-bifurcación requerida.")
            return False

        for t in tasks:
            p_files = t.get("predicted_files", t.get("allowed_files", []))
            if len(p_files) > 5 and not force:
                print(f"❌ [VETO §12.b] Tarea {t.get('id')} predice {len(p_files)} archivos (límite: 5).")
                return False

            if not force and not force_harvest:
                is_harvest, pattern = is_live_harvest_task(t)
                if is_harvest:
                    print(
                        f"❌ [VETO §57] Tarea {t.get('id')} ('{t.get('title')}') detectada como ejecución de harvest/crawling masivo en vivo (patrón: '{pattern}').\n"
                        f"   Los workers agy operan en sandboxes efímeros y no pueden persistir data externa ni monopolizar slots (§57).\n"
                        f"   Esta tarea debe ejecutarse en una instancia persistente (Host/VM/systemd daemon)."
                    )
                    return False

            if not force and not force_lifecycle:
                is_lifecycle, pattern = is_interactive_lifecycle_task(t)
                if is_lifecycle:
                    print(
                        f"❌ [VETO §50/§59] Tarea {t.get('id')} ('{t.get('title')}') detectada como gobernanza de ciclo de vida interactivo de sesión ({pattern}).\n"
                        f"   Mutar .meta/session.relay, takeover/handover o candados de sesión desde workers efímeros corrompe transcripts y provoca colisiones de relevo.\n"
                        f"   Esta tarea debe ejecutarse directamente en la sesión interactiva del Host/Búnker o forzarse explícitamente con --force-lifecycle."
                    )
                    return False

    is_sequential = sequential or not parallel
    timestamp_ms = int(time.time() * 1000)

    # ── DRY RUN ──────────────────────────────────────────────────────────────
    if dry_run:
        mode_str = "SECUENCIAL" if is_sequential else f"PARALELO (hasta {max_parallel} slots simultáneos)"
        sprints_label = ", ".join(s.get("id", "") for s in target_sprints)
        total_tasks_count = sum(len(s.get("tasks", [])) for s in target_sprints)
        print(f"🔍 [DRY_RUN] Validación Multi-Sprint [{sprints_label}] en nodo '{node_name}' ({mode_str}, {total_tasks_count} tareas totales)...")
        print(f"   Destino resuelto de cola: {resolved_db_path}")

        prev_sprint_last_ticket: str | None = None
        for s_idx, sprint in enumerate(target_sprints):
            sid = sprint.get("id", "")
            s_tasks = sprint.get("tasks", [])
            print(f"\n  --- Sprint {sid} ({len(s_tasks)} tareas) ---")
            current_sprint_tickets: list[str] = []

            for t_idx, task in enumerate(s_tasks):
                task_id = task.get("id", f"TASK-{sid}-{t_idx+1:02d}")
                task_clean_num = f"{t_idx+1:02d}"
                ticket_id = f"TCK-{node_name.upper()}-{sid.upper()}{task_clean_num}-{timestamp_ms}"
                current_sprint_tickets.append(ticket_id)

                if t_idx == 0:
                    if is_sequential and s_idx > 0 and prev_sprint_last_ticket:
                        initial_status = f"WAITING_DEPENDENCY (wait for {prev_sprint_last_ticket})"
                    elif wait_for_ticket:
                        initial_status = f"WAITING_DEPENDENCY (wait for {wait_for_ticket})"
                    else:
                        initial_status = "PENDING_INFERENCE"
                else:
                    initial_status = "WAITING_DEPENDENCY"

                p_files = task.get("predicted_files", task.get("allowed_files", []))
                print(f"  [{initial_status:<18}] {task_id} -> {ticket_id} ({len(p_files)} archivos predichos)")

            if current_sprint_tickets:
                prev_sprint_last_ticket = current_sprint_tickets[-1]

        print(f"\n✅ [DRY_RUN] Sprints [{sprints_label}] conformes a directivas (§12.b, §44, §45, §48, §51). Cero mutaciones en BD.")
        return True

    # ── ENCOLADO REAL EN BASE DE DATOS ───────────────────────────────────────
    parent_dir = os.path.dirname(os.path.abspath(resolved_db_path))
    if parent_dir and not os.path.exists(parent_dir):
        try:
            os.makedirs(parent_dir, exist_ok=True)
        except OSError:
            # INTENTIONAL: Fallback si el directorio ya existe o no se tienen permisos (§45).
            pass

    try:
        conn = sqlite3.connect(resolved_db_path, timeout=10.0)
        ensure_queue_table(conn)
        cursor = conn.cursor()
    except Exception as e:
        print(f"❌ [ERROR] Fallo al conectar con la base de datos en {resolved_db_path}: {e}")
        return False

    mode_label = "Secuencial" if is_sequential else "Paralelo"
    sprints_label = ", ".join(s.get("id", "") for s in target_sprints)
    print(f"🚀 Preparando encolado Multi-Sprint ({mode_label}) para [{sprints_label}] en nodo '{node_name}'...")

    try:
        all_sprint_ticket_lists: list[list[str]] = []
        pending_count = 0

        for s_idx, sprint in enumerate(target_sprints):
            sid = sprint.get("id", "")
            s_tasks = sprint.get("tasks", [])
            current_sprint_tickets: list[str] = []

            for t_idx, task in enumerate(s_tasks):
                task_id = task.get("id", f"TASK-{sid}-{t_idx+1:02d}")
                task_clean_num = f"{t_idx+1:02d}"
                ticket_id = f"TCK-{node_name.upper()}-{sid.upper()}{task_clean_num}-{timestamp_ms}"
                current_sprint_tickets.append(ticket_id)

                # En modo paralelo, la primera tarea de cada sprint arranca en PENDING_INFERENCE
                # En modo secuencial, solo el primer sprint arranca en PENDING_INFERENCE (los demás esperan al anterior)
                if t_idx == 0:
                    if is_sequential and s_idx > 0:
                        initial_status = "WAITING_DEPENDENCY"
                    elif wait_for_ticket:
                        initial_status = "WAITING_DEPENDENCY"
                    else:
                        initial_status = "PENDING_INFERENCE"
                        pending_count += 1
                else:
                    initial_status = "WAITING_DEPENDENCY"

                prompt = build_task_prompt(node_name, repo_path, sid, task, conn=conn, db_path=resolved_db_path)
                p_files = task.get("predicted_files", task.get("allowed_files", []))

                # Compuerta Pre-Flight Client-Side (§45, §57): Verificar que el prompt no dispare vetos del despachador
                harvest_regex = re.compile(
                    r"\b(live[_\s-]harvest|harvest[_\s-]en[_\s-]vivo|web[_\s-]scraping[_\s-]en[_\s-]vivo|crawling[_\s-]en[_\s-]vivo|recolecci[oó]n[_\s-]masiva[_\s-]en[_\s-]vivo)\b",
                    re.IGNORECASE,
                )
                if harvest_regex.search(prompt) and not force and not force_harvest:
                    print(f"❌ [PRE-FLIGHT-REJECT] El prompt de {task_id} contiene patrones que dispararían VETO_LIVE_HARVEST_57 en el despachador.")
                    return False

                payload = {
                    "ticket_id": ticket_id,
                    "task_id": task_id,
                    "sprint_id": sid,
                    "source_node": node_name,
                    "target_repo": repo_path,
                    "model": model,
                    "prompt": prompt,
                    "custom_cmd": f"/usr/local/bin/agy --model {model} --dangerously-skip-permissions -p {shlex.quote(prompt)}",
                    "predicted_files": p_files,
                    "metadata": {
                        "zone": task.get("zone", "AMBER"),
                        "title": task.get("title", ""),
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                }

                now_iso = datetime.now(timezone.utc).isoformat()
                cursor.execute(
                    """
                    INSERT INTO inference_queue (
                        ticket_id, task_id, source_node, sprint_id, status, payload, retry_count, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
                    """,
                    (ticket_id, task_id, node_name, sid, initial_status, json.dumps(payload), now_iso, now_iso),
                )
                print(f"  [{initial_status:<18}] {task_id} -> {ticket_id}")

            # Triggers de cascada internos dentro del sprint
            for idx in range(len(current_sprint_tickets) - 1):
                curr_ticket = current_sprint_tickets[idx]
                next_ticket = current_sprint_tickets[idx + 1]
                trigger_name = f"trg_cascade_{curr_ticket.replace('-', '_')}"
                cursor.execute(f"DROP TRIGGER IF EXISTS {trigger_name}")
                cursor.execute(
                    f"""
                    CREATE TRIGGER {trigger_name}
                    AFTER UPDATE OF status ON inference_queue
                    FOR EACH ROW
                    WHEN NEW.ticket_id = '{curr_ticket}' AND NEW.status IN ('COMPLETED', 'DONE', 'MERGED')
                    BEGIN
                        UPDATE inference_queue
                        SET status = 'PENDING_INFERENCE', retry_count = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                        WHERE ticket_id = '{next_ticket}' AND status = 'WAITING_DEPENDENCY';
                    END;
                    """
                )

            all_sprint_ticket_lists.append(current_sprint_tickets)

        # Enlace secuencial inter-sprint (si se solicitó sequential)
        if is_sequential and len(all_sprint_ticket_lists) > 1:
            for s_idx in range(len(all_sprint_ticket_lists) - 1):
                prev_last_ticket = all_sprint_ticket_lists[s_idx][-1]
                next_first_ticket = all_sprint_ticket_lists[s_idx + 1][0]
                inter_sprint_trg = f"trg_sprint_seq_{prev_last_ticket.replace('-', '_')}"
                cursor.execute(f"DROP TRIGGER IF EXISTS {inter_sprint_trg}")
                cursor.execute(
                    f"""
                    CREATE TRIGGER {inter_sprint_trg}
                    AFTER UPDATE OF status ON inference_queue
                    FOR EACH ROW
                    WHEN NEW.ticket_id = '{prev_last_ticket}' AND NEW.status IN ('COMPLETED', 'DONE', 'MERGED')
                    BEGIN
                        UPDATE inference_queue
                        SET status = 'PENDING_INFERENCE', retry_count = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                        WHERE ticket_id = '{next_first_ticket}' AND status = 'WAITING_DEPENDENCY';
                    END;
                    """
                )
                print(f"   🔗 Enlace inter-sprint secuencial: {prev_last_ticket} -> {next_first_ticket}")

        # Enlace externo si wait_for_ticket está configurado
        if wait_for_ticket:
            # En modo paralelo, todos los primeros tickets esperan al ticket externo
            # En modo secuencial, solo el primer ticket del primer sprint espera
            targets = [all_sprint_ticket_lists[0][0]] if is_sequential else [s[0] for s in all_sprint_ticket_lists]
            for target_ticket in targets:
                inter_trg = f"trg_inter_{wait_for_ticket.replace('-', '_')}_{target_ticket.replace('-', '_')}"
                cursor.execute(f"DROP TRIGGER IF EXISTS {inter_trg}")
                cursor.execute(
                    f"""
                    CREATE TRIGGER {inter_trg}
                    AFTER UPDATE OF status ON inference_queue
                    FOR EACH ROW
                    WHEN NEW.ticket_id = '{wait_for_ticket}' AND NEW.status IN ('COMPLETED', 'DONE', 'MERGED')
                    BEGIN
                        UPDATE inference_queue
                        SET status = 'PENDING_INFERENCE', retry_count = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                        WHERE ticket_id = '{target_ticket}' AND status = 'WAITING_DEPENDENCY';
                    END;
                    """
                )
                print(f"   🔗 Enlace externo configurado: {wait_for_ticket} -> {target_ticket}")

        conn.commit()
        total_tickets = sum(len(t_list) for t_list in all_sprint_ticket_lists)
        if len(target_sprints) == 1:
            print(f"✅ [SUCCESS] Sprint {target_sprints[0].get('id')} encolado exitosamente ({total_tickets} tickets generados).")
        else:
            print(f"✅ [SUCCESS] Despacho Multi-Sprint ({mode_label}) exitoso: {len(target_sprints)} sprints encolados ({total_tickets} tickets totales).")
            if not is_sequential:
                print(f"   ⚡ Slots activos en paralelo (PENDING_INFERENCE): {pending_count} slots saturados.")
        return True
    except Exception as e:
        conn.rollback()
        print(f"❌ [DB_ERROR] Fallo al encolar sprint(s): {e}")
        return False
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(
        description="Despachador universal de sprints hacia la cola Automa agy (§12.b, §44, §45, §48, §51, TASK-N55-03)."
    )
    parser.add_argument(
        "--sprint",
        "--sprints",
        dest="sprints",
        nargs="+",
        required=True,
        help="Identificador(es) del sprint (ej. --sprint N37, --sprint N44 N45, o --sprint N44,N45)",
    )
    parser.add_argument("--repo", default=".", help="Ruta al repositorio objetivo (default: directorio actual)")
    parser.add_argument("--db-path", default=DEFAULT_DB_PATH, help="Ruta a inference_queue.db")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="Modelo agy asignado")
    parser.add_argument("--force", action="store_true", help="Ignora restricciones estrictas de límites de archivos")
    parser.add_argument("--force-harvest", action="store_true", help="Ignora el veto §57 de harvest en workers efímeros (no recomendado)")
    parser.add_argument("--force-lifecycle", action="store_true", help="Ignora el veto §50/§59 de tareas de ciclo de vida de sesión en workers efímeros (no recomendado)")
    parser.add_argument("--dry-run", action="store_true", help="Valida los sprints y simula el despacho sin mutar la BD física")
    parser.add_argument(
        "--wait-for-ticket",
        default=None,
        help="Ticket ID previo que debe completarse antes de activar este despacho",
    )
    parser.add_argument(
        "--parallel",
        action="store_true",
        default=True,
        help="Despacho paralelo entre sprints ortogonales sin dependencia forzada (default: True)",
    )
    parser.add_argument(
        "--sequential",
        "--chain",
        dest="sequential",
        action="store_true",
        help="Encadenar sprints secuencialmente (Sprint B espera a que Sprint A termine)",
    )
    parser.add_argument(
        "--max-parallel",
        type=int,
        default=3,
        help="Límite máximo de concurrencia de slots simultáneos (default: 3)",
    )
    parser.add_argument(
        "--print-prompt",
        default=None,
        help="Imprime el prompt renderizado para un task_id específico y sale",
    )

    args = parser.parse_args()
    success = enqueue_sprint(
        sprint_id=args.sprints,
        repo_dir=Path(args.repo),
        db_path=args.db_path,
        model=args.model,
        force=args.force,
        force_harvest=args.force_harvest,
        force_lifecycle=args.force_lifecycle,
        dry_run=args.dry_run,
        wait_for_ticket=args.wait_for_ticket,
        parallel=not args.sequential,
        sequential=args.sequential,
        max_parallel=args.max_parallel,
        print_prompt=args.print_prompt,
    )
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
