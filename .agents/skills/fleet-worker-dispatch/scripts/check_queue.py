#!/usr/bin/env python3
from __future__ import annotations
"""
check_queue.py — Monitor universal del estado de la cola de workers agy de Automa (§45).
Soporta auto-descubrimiento multi-nodo, SQLite WAL e inicialización resiliente.
"""
import sys
import os
import sqlite3
import argparse
import subprocess
from datetime import datetime

DEFAULT_DB_PATH = "/opt/automa/data/inference_queue.db"


def resolve_db_path(custom_path: str | None = None) -> str:
    """Resuelve la ruta canónica hacia inference_queue.db considerando el entorno (§45)."""
    if custom_path and custom_path.strip():
        return os.path.abspath(custom_path.strip())

    if "AUTOMA_QUEUE_DB" in os.environ and os.environ["AUTOMA_QUEUE_DB"].strip():
        return os.path.abspath(os.environ["AUTOMA_QUEUE_DB"].strip())

    # 1. Producción VM Automa / Host
    if os.path.exists(DEFAULT_DB_PATH) and os.access(os.path.dirname(DEFAULT_DB_PATH), os.W_OK):
        return DEFAULT_DB_PATH

    # 2. Local Bunker Offline-First (Smart, Ruedas, BeatMe, etc.)
    local_bunker = os.path.join(os.getcwd(), "vault", "runtime", "inference_queue.db")
    return local_bunker


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


def main():
    parser = argparse.ArgumentParser(description="Monitor universal de la cola Automa agy.")
    parser.add_argument("--db-path", default=None, help="Ruta explícita a inference_queue.db")
    args = parser.parse_args()

    db_path = resolve_db_path(args.db_path)

    # Asegurar directorio padre si no existe
    parent_dir = os.path.dirname(os.path.abspath(db_path))
    if parent_dir and not os.path.exists(parent_dir):
        try:
            os.makedirs(parent_dir, exist_ok=True)
        except OSError:
            pass

    try:
        conn = sqlite3.connect(db_path, timeout=10.0)
        ensure_queue_table(conn)
        cursor = conn.cursor()
    except Exception as e:
        print(f"❌ [ERROR] Error accediendo a la base de datos de cola en {db_path}: {e}")
        sys.exit(1)

    # Obtener contenedores Docker activos (si docker está disponible)
    active_containers = {}
    try:
        res = subprocess.run(
            ["docker", "ps", "--format", "{{.Names}}\t{{.Status}}\t{{.RunningFor}}"],
            capture_output=True,
            text=True,
            check=False,
        )
        for line in res.stdout.strip().splitlines():
            if line:
                parts = line.split("\t")
                if len(parts) >= 2:
                    active_containers[parts[0]] = f"{parts[1]} ({parts[2] if len(parts) > 2 else ''})"
    except Exception:
        pass

    print("=" * 85)
    print(f"📡 ESTADO DE LA COLA AUTOMA AGY ({db_path})")
    print(f"🕒 Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    if active_containers:
        print(f"🐳 Contenedores activos: {', '.join(f'{k}: {v}' for k, v in active_containers.items())}")
    else:
        print("🐳 Contenedores activos: Ninguno (cola en reposo o esperando ticket)")
    print("=" * 85)

    cursor.execute("""
        SELECT id, ticket_id, task_id, source_node, sprint_id, status, retry_count, updated_at
        FROM inference_queue
        ORDER BY id DESC
        LIMIT 15
    """)
    rows = cursor.fetchall()
    conn.close()

    if not rows:
        print("La cola está completamente vacía (0 tickets pendientes o en ejecución).")
        print("=" * 85)
        sys.exit(0)

    # Encabezado
    header = f"{'ID':<4} | {'Ticket ID':<32} | {'Task ID':<14} | {'Nodo':<8} | {'Estado':<18} | {'Retries':<7} | {'Última Actualización'}"
    print(header)
    print("-" * len(header))

    # Iconos por estado
    status_icons = {
        "PROCESSING": "🔄",
        "COMPLETED": "✅",
        "DONE": "✅",
        "MERGED": "🚀",
        "PENDING_INFERENCE": "⏳",
        "WAITING_DEPENDENCY": "⏸️",
        "PAUSED": "🛑",
        "FAILED_RETRYABLE": "⚠️",
        "FAILED_CAR_TRIGGER": "❌",
    }

    for row in rows:
        rid, ticket_id, task_id, node, sprint, status, retries, updated_at = row
        icon = status_icons.get(status, "❓")
        status_str = f"{icon} {status}"
        print(f"{rid:<4} | {ticket_id:<32} | {task_id:<14} | {node:<8} | {status_str:<18} | {retries:<7} | {updated_at}")
    print("=" * 85)
    sys.exit(0)


if __name__ == "__main__":
    main()
