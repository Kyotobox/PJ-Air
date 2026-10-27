#!/usr/bin/env python3
"""
Strategic Event Emitter (Smart -> Automa)
v1.1.0 (G26-04)

Módulo y herramienta CLI para emitir eventos atómicos estructurados desde el
Think Tank (Smart) hacia el bus desacoplado de eventos para consumo por Automa
(Sistema Nervioso 24/7 / Discord).

Adhiere a:
- Trinidad Funcional (Cero daemons residentes en Smart).
- Escritura atómica a disco (os.replace via .tmp).
- Rotación de buffer FIFO (máximo 100 eventos).
- Validación contra contrato JSON Schema (vault/contracts/dispatch_event.schema.json).
- Cero Mocks / Librerías puras con graceful degradation.
"""

import os
import sys
import time
import json
import uuid
import argparse
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional

try:
    import jsonschema
    HAS_JSONSCHEMA = True
except ImportError:
    HAS_JSONSCHEMA = False

VALID_EVENT_TYPES = {
    "RELEASE_CERT",
    "KILL_CRITERIA_ALERT",
    "STRATEGIC_EVAL_READY",
    "VETO_ALERT",
    "DISPATCH_FAILURE",
    "DISPATCH_SUCCESS",
    "DISPATCH_APPROVED",
    "QUOTA_DEPLETED",
}

VALID_SEVERITIES = {
    "INFO",
    "WARNING",
    "CRITICAL",
}

VALID_VERDICTS = {
    "APPROVED",
    "REJECTED",
    "WARNING",
    "HALT",
    "FAILED",
}

VALID_ERROR_TYPES = {
    "TIMEOUT",
    "COMPILATION",
    "TEST_FAILURE",
    "SCOPE_VIOLATION",
    "UNKNOWN",
}

MAX_BUFFER_EVENTS = 100
DEFAULT_BUFFER_PATH = Path("vault/runtime/strategic_events.json")
DEFAULT_SCHEMA_PATH = Path("vault/contracts/dispatch_event.schema.json")


def _get_utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _validate_with_jsonschema(payload: Dict[str, Any], schema_path: Optional[Path] = None) -> None:
    """Valida el evento contra el esquema formal JSON Schema si está disponible."""
    path = schema_path or DEFAULT_SCHEMA_PATH
    if not path.exists():
        # Modo degradado si no existe el archivo de esquema
        return

    if not HAS_JSONSCHEMA:
        return

    try:
        with open(path, "r", encoding="utf-8") as f:
            schema = json.load(f)
        jsonschema.validate(instance=payload, schema=schema)
    except jsonschema.exceptions.ValidationError as err:
        raise ValueError(f"Fallo de validación de esquema JSON para '{payload.get('type')}': {err.message}") from err


def validate_event_payload(
    event_type: str,
    summary: Optional[str] = None,
    project_id: Optional[str] = None,
    verdict: Optional[str] = None,
    severity: Optional[str] = None,
    metrics: Optional[Dict[str, Any]] = None,
    dossier_path: Optional[str] = None,
    task_id: Optional[str] = None,
    satellite: Optional[str] = None,
    error_type: Optional[str] = None,
    attempt_count: Optional[int] = None,
    prompt_mutation_applied: Optional[str] = None,
    account_id: Optional[str] = None,
    pr_url: Optional[str] = None,
    details: Optional[str] = None,
    pool_status: Optional[Dict[str, int]] = None,
    estimated_recovery_sec: Optional[int] = None,
    pending_tasks_blocked: Optional[int] = None,
    admission_token: Optional[str] = None,
    manifest_path: Optional[str] = None,
    schema_path: Optional[Path] = None,
) -> Dict[str, Any]:
    """Valida los campos obligatorios y opcionales de un evento estratégico."""
    if event_type not in VALID_EVENT_TYPES:
        raise ValueError(
            f"Tipo de evento inválido: '{event_type}'. Permitidos: {sorted(VALID_EVENT_TYPES)}"
        )

    if not summary or not isinstance(summary, str) or not summary.strip():
        raise ValueError("El campo 'summary' es obligatorio y no puede estar vacío.")

    if metrics is not None and not isinstance(metrics, dict):
        raise ValueError("El campo 'metrics' debe ser un diccionario de clave/valor.")

    event_id = f"evt-smart-{uuid.uuid4()}"
    timestamp = _get_utc_now_iso()

    # --- RAMA 1: DISPATCH_FAILURE ---
    if event_type == "DISPATCH_FAILURE":
        severity = "CRITICAL"
        verdict = "FAILED"

        if not task_id or not isinstance(task_id, str) or not task_id.strip():
            raise ValueError("El campo 'task_id' es obligatorio para DISPATCH_FAILURE.")
        if not satellite or not isinstance(satellite, str) or not satellite.strip():
            raise ValueError("El campo 'satellite' es obligatorio para DISPATCH_FAILURE.")
        if not error_type or error_type not in VALID_ERROR_TYPES:
            raise ValueError(
                f"error_type inválido o ausente: '{error_type}'. Permitidos: {sorted(VALID_ERROR_TYPES)}"
            )
        if attempt_count is None or not isinstance(attempt_count, int) or attempt_count < 1:
            raise ValueError("El campo 'attempt_count' debe ser un entero >= 1.")
        if details is None or not isinstance(details, str):
            raise ValueError("El campo 'details' es obligatorio para DISPATCH_FAILURE.")

        payload: Dict[str, Any] = {
            "event_id": event_id,
            "timestamp": timestamp,
            "type": event_type,
            "severity": severity,
            "task_id": task_id.strip(),
            "satellite": satellite.strip(),
            "error_type": error_type,
            "attempt_count": attempt_count,
            "prompt_mutation_applied": prompt_mutation_applied.strip() if prompt_mutation_applied else None,
            "account_id": account_id.strip() if account_id else None,
            "pr_url": pr_url.strip() if pr_url else None,
            "details": details,
            "summary": summary.strip(),
            "verdict": verdict,
            "metrics": metrics or {},
            "dossier_path": dossier_path.strip() if dossier_path else None,
        }

    # --- RAMA 2: DISPATCH_SUCCESS ---
    elif event_type == "DISPATCH_SUCCESS":
        severity = "INFO"
        verdict = "APPROVED"

        if not task_id or not isinstance(task_id, str) or not task_id.strip():
            raise ValueError("El campo 'task_id' es obligatorio para DISPATCH_SUCCESS.")
        if not satellite or not isinstance(satellite, str) or not satellite.strip():
            raise ValueError("El campo 'satellite' es obligatorio para DISPATCH_SUCCESS.")
        if not pr_url or not isinstance(pr_url, str) or not pr_url.strip():
            raise ValueError("El campo 'pr_url' es obligatorio para DISPATCH_SUCCESS.")
        if attempt_count is None or not isinstance(attempt_count, int) or attempt_count < 1:
            raise ValueError("El campo 'attempt_count' debe ser un entero >= 1.")

        payload = {
            "event_id": event_id,
            "timestamp": timestamp,
            "type": event_type,
            "severity": severity,
            "task_id": task_id.strip(),
            "satellite": satellite.strip(),
            "pr_url": pr_url.strip(),
            "attempt_count": attempt_count,
            "prompt_mutation_applied": prompt_mutation_applied.strip() if prompt_mutation_applied else None,
            "account_id": account_id.strip() if account_id else None,
            "summary": summary.strip(),
            "verdict": verdict,
            "metrics": metrics or {},
            "dossier_path": dossier_path.strip() if dossier_path else None,
        }

    # --- RAMA 3: QUOTA_DEPLETED ---
    elif event_type == "QUOTA_DEPLETED":
        severity = "WARNING"
        verdict = verdict or "WARNING"
        if verdict not in VALID_VERDICTS:
            raise ValueError(f"Veredicto inválido: '{verdict}'. Permitidos: {sorted(VALID_VERDICTS)}")

        if not pool_status or not isinstance(pool_status, dict):
            raise ValueError("El campo 'pool_status' es obligatorio y debe ser un diccionario con {active, cooldown, total}.")
        for key in ("active", "cooldown", "total"):
            if key not in pool_status or not isinstance(pool_status[key], int) or pool_status[key] < 0:
                raise ValueError(f"pool_status debe contener '{key}' como un entero >= 0.")

        if estimated_recovery_sec is None or not isinstance(estimated_recovery_sec, int) or estimated_recovery_sec < 0:
            raise ValueError("El campo 'estimated_recovery_sec' debe ser un entero >= 0.")
        if pending_tasks_blocked is None or not isinstance(pending_tasks_blocked, int) or pending_tasks_blocked < 0:
            raise ValueError("El campo 'pending_tasks_blocked' debe ser un entero >= 0.")

        payload = {
            "event_id": event_id,
            "timestamp": timestamp,
            "type": event_type,
            "severity": severity,
            "pool_status": pool_status,
            "estimated_recovery_sec": estimated_recovery_sec,
            "pending_tasks_blocked": pending_tasks_blocked,
            "summary": summary.strip(),
            "verdict": verdict,
            "metrics": metrics or {},
            "dossier_path": dossier_path.strip() if dossier_path else None,
        }

    # --- RAMA 4: DISPATCH_APPROVED ---
    elif event_type == "DISPATCH_APPROVED":
        severity = severity or "INFO"
        if severity not in ("INFO", "MEDIUM"):
            raise ValueError(f"Severidad inválida para DISPATCH_APPROVED: '{severity}'. Permitidos: ['INFO', 'MEDIUM']")
        verdict = "APPROVED"

        if not task_id or not isinstance(task_id, str) or not task_id.strip():
            raise ValueError("El campo 'task_id' es obligatorio para DISPATCH_APPROVED.")
        if not satellite or not isinstance(satellite, str) or not satellite.strip():
            raise ValueError("El campo 'satellite' es obligatorio para DISPATCH_APPROVED.")
        if not admission_token or not isinstance(admission_token, str) or not admission_token.strip():
            raise ValueError("El campo 'admission_token' es obligatorio para DISPATCH_APPROVED.")

        payload = {
            "event_id": event_id,
            "timestamp": timestamp,
            "type": event_type,
            "severity": severity,
            "task_id": task_id.strip(),
            "satellite": satellite.strip(),
            "admission_token": admission_token.strip(),
            "manifest_path": manifest_path.strip() if manifest_path else None,
            "summary": summary.strip(),
            "verdict": verdict,
            "metrics": metrics or {},
            "dossier_path": dossier_path.strip() if dossier_path else None,
        }

    # --- RAMA 5: EVENTOS BASE (RELEASE_CERT, STRATEGIC_EVAL_READY, etc.) ---
    else:
        severity = severity or "INFO"
        if severity not in VALID_SEVERITIES:
            raise ValueError(
                f"Severidad inválida: '{severity}'. Permitidos: {sorted(VALID_SEVERITIES)}"
            )

        if not verdict or verdict not in VALID_VERDICTS:
            raise ValueError(
                f"Veredicto inválido: '{verdict}'. Permitidos: {sorted(VALID_VERDICTS)}"
            )

        if not project_id or not isinstance(project_id, str) or not project_id.strip():
            raise ValueError("El campo 'project_id' es obligatorio y no puede estar vacío.")

        payload = {
            "event_id": event_id,
            "timestamp": timestamp,
            "type": event_type,
            "project_id": project_id.strip(),
            "severity": severity,
            "summary": summary.strip(),
            "verdict": verdict,
            "metrics": metrics or {},
            "dossier_path": dossier_path.strip() if dossier_path else None,
        }

    # Validación formal contra contrato JSON Schema
    _validate_with_jsonschema(payload, schema_path)

    return payload


def load_events_buffer(buffer_path: Optional[Path] = None) -> Dict[str, Any]:
    """Carga de forma segura el buffer existente de eventos estratégicos."""
    path = buffer_path or DEFAULT_BUFFER_PATH
    if not path.exists():
        return {
            "version": "1.0.0",
            "hub": "Smart",
            "updated_at": _get_utc_now_iso(),
            "events_count": 0,
            "events": [],
        }

    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            if not isinstance(data, dict) or "events" not in data or not isinstance(data["events"], list):
                return {
                    "version": "1.0.0",
                    "hub": "Smart",
                    "updated_at": _get_utc_now_iso(),
                    "events_count": 0,
                    "events": [],
                }
            return data
    except (json.JSONDecodeError, OSError):
        return {
            "version": "1.0.0",
            "hub": "Smart",
            "updated_at": _get_utc_now_iso(),
            "events_count": 0,
            "events": [],
        }


def save_events_buffer_atomic(buffer_data: Dict[str, Any], buffer_path: Optional[Path] = None) -> None:
    """Persiste el buffer de eventos mediante escritura atómica (.tmp + os.replace)."""
    path = buffer_path or DEFAULT_BUFFER_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    unique_suffix = f".{os.getpid()}_{uuid.uuid4().hex[:8]}.tmp"
    temp_path = path.parent / f"{path.name}{unique_suffix}"

    try:
        with open(temp_path, "w", encoding="utf-8") as f:
            json.dump(buffer_data, f, indent=2, ensure_ascii=False)
            f.flush()
            os.fsync(f.fileno())

        # Reemplazo atómico con reintentos para contención en Windows/SO
        max_attempts = 5
        for attempt in range(1, max_attempts + 1):
            try:
                os.replace(temp_path, path)
                break
            except (PermissionError, OSError) as e:
                if attempt == max_attempts:
                    raise OSError(
                        f"Fallo atómico crítico en os.replace tras {max_attempts} reintentos: {str(e)}"
                    ) from e
                time.sleep(0.01 * (2 ** (attempt - 1)))
    finally:
        # Purgado garantizado de archivo temporal huérfano
        if temp_path.exists():
            try:
                temp_path.unlink()
            except OSError:
                pass



def emit_event(
    event_type: str,
    summary: str,
    project_id: Optional[str] = None,
    verdict: Optional[str] = None,
    severity: Optional[str] = None,
    metrics: Optional[Dict[str, Any]] = None,
    dossier_path: Optional[str] = None,
    task_id: Optional[str] = None,
    satellite: Optional[str] = None,
    error_type: Optional[str] = None,
    attempt_count: Optional[int] = None,
    prompt_mutation_applied: Optional[str] = None,
    account_id: Optional[str] = None,
    pr_url: Optional[str] = None,
    details: Optional[str] = None,
    pool_status: Optional[Dict[str, int]] = None,
    estimated_recovery_sec: Optional[int] = None,
    pending_tasks_blocked: Optional[int] = None,
    admission_token: Optional[str] = None,
    manifest_path: Optional[str] = None,
    buffer_path: Optional[Path] = None,
    schema_path: Optional[Path] = None,
    max_events: int = MAX_BUFFER_EVENTS,
) -> Dict[str, Any]:
    """
    Crea, valida y anexa un evento estratégico al buffer atómico con rotación FIFO.
    Retorna el payload completo del evento emitido.
    """
    payload = validate_event_payload(
        event_type=event_type,
        summary=summary,
        project_id=project_id,
        verdict=verdict,
        severity=severity,
        metrics=metrics,
        dossier_path=dossier_path,
        task_id=task_id,
        satellite=satellite,
        error_type=error_type,
        attempt_count=attempt_count,
        prompt_mutation_applied=prompt_mutation_applied,
        account_id=account_id,
        pr_url=pr_url,
        details=details,
        pool_status=pool_status,
        estimated_recovery_sec=estimated_recovery_sec,
        pending_tasks_blocked=pending_tasks_blocked,
        admission_token=admission_token,
        manifest_path=manifest_path,
        schema_path=schema_path,
    )

    buffer_data = load_events_buffer(buffer_path)
    events: List[Dict[str, Any]] = buffer_data.get("events", [])

    events.append(payload)

    if len(events) > max_events:
        events = events[-max_events:]

    buffer_data["updated_at"] = _get_utc_now_iso()
    buffer_data["events_count"] = len(events)
    buffer_data["events"] = events

    save_events_buffer_atomic(buffer_data, buffer_path)
    return payload


def get_events(
    buffer_path: Optional[Path] = None,
    limit: Optional[int] = None,
    event_type: Optional[str] = None,
    project_id: Optional[str] = None,
    task_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Consulta y filtra eventos almacenados en el buffer."""
    buffer_data = load_events_buffer(buffer_path)
    events: List[Dict[str, Any]] = buffer_data.get("events", [])

    if event_type:
        events = [e for e in events if e.get("type") == event_type]

    if project_id:
        events = [e for e in events if e.get("project_id") == project_id]

    if task_id:
        events = [e for e in events if e.get("task_id") == task_id]

    if limit and limit > 0:
        events = events[-limit:]

    return events


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Emisor Atómico de Eventos Estratégicos (Smart -> Automa)"
    )
    subparsers = parser.add_subparsers(dest="subcommand", required=True)

    # Subcomando: emit
    emit_parser = subparsers.add_parser("emit", help="Emitir un nuevo evento estratégico")
    emit_parser.add_argument("--type", required=True, choices=list(VALID_EVENT_TYPES))
    emit_parser.add_argument("--summary", required=True, help="Resumen descriptivo del evento")
    emit_parser.add_argument("--project", help="ID del proyecto (ej. prj_008_ruedas, obligatorio para eventos base)")
    emit_parser.add_argument("--verdict", choices=list(VALID_VERDICTS), help="Veredicto del evento")
    emit_parser.add_argument("--severity", choices=list(VALID_SEVERITIES), help="Severidad (INFO, WARNING, CRITICAL)")
    emit_parser.add_argument("--metrics", help="JSON string con métricas cuantitativas")
    emit_parser.add_argument("--dossier", help="Ruta relativa al dossier o reporte")
    emit_parser.add_argument("--buffer", help="Ruta alternativa a strategic_events.json")
    emit_parser.add_argument("--schema", help="Ruta alternativa al esquema JSON")

    # Argumentos específicos para DISPATCH_FAILURE
    emit_parser.add_argument("--task-id", help="ID canónico de la tarea (ej. TASK-G183-01)")
    emit_parser.add_argument("--satellite", help="Búnker destino (ej. conext_core, ruedas)")
    emit_parser.add_argument("--error-type", choices=list(VALID_ERROR_TYPES), help="Taxonomía de error")
    emit_parser.add_argument("--attempt-count", type=int, default=1, help="Número de intentos")
    emit_parser.add_argument("--prompt-mutation", help="Instrucción de mutación de prompt aplicada")
    emit_parser.add_argument("--account-id", help="Cuenta del pool ejecutora")
    emit_parser.add_argument("--pr-url", help="URL del PR de GitHub si aplica")
    emit_parser.add_argument("--details", help="Detalle técnico crudo del error")

    # Argumentos específicos para DISPATCH_APPROVED
    emit_parser.add_argument("--admission-token", help="Token de admisión formal emitido por Smart (DISPATCH_APPROVED)")
    emit_parser.add_argument("--manifest-path", help="Ruta relativa al manifiesto de despacho (DISPATCH_APPROVED)")

    # Argumentos específicos para QUOTA_DEPLETED
    emit_parser.add_argument("--pool-active", type=int, help="Cuentas activas en pool")
    emit_parser.add_argument("--pool-cooldown", type=int, help="Cuentas en cooldown en pool")
    emit_parser.add_argument("--pool-total", type=int, help="Total de cuentas en pool")
    emit_parser.add_argument("--pending-blocked", type=int, help="Tareas bloqueadas por falta de pool")
    emit_parser.add_argument("--estimated-recovery-sec", type=int, help="Segundos para recuperación del pool")

    # Subcomando: list
    list_parser = subparsers.add_parser("list", help="Listar eventos del buffer")
    list_parser.add_argument("--limit", type=int, default=10, help="Número de eventos a mostrar")
    list_parser.add_argument("--type", choices=list(VALID_EVENT_TYPES), help="Filtrar por tipo")
    list_parser.add_argument("--project", help="Filtrar por proyecto")
    list_parser.add_argument("--task-id", help="Filtrar por task-id")
    list_parser.add_argument("--buffer", help="Ruta alternativa a strategic_events.json")

    args = parser.parse_args()

    buffer_path = Path(args.buffer) if getattr(args, "buffer", None) else None
    schema_path = Path(args.schema) if getattr(args, "schema", None) else None

    if args.subcommand == "emit":
        parsed_metrics = None
        if args.metrics:
            try:
                parsed_metrics = json.loads(args.metrics)
            except json.JSONDecodeError as err:
                print(f"[ERROR] --metrics debe ser un JSON válido: {err}", file=sys.stderr)
                return 1

        pool_status = None
        if args.pool_active is not None or args.pool_cooldown is not None or args.pool_total is not None:
            pool_status = {
                "active": args.pool_active if args.pool_active is not None else 0,
                "cooldown": args.pool_cooldown if args.pool_cooldown is not None else 0,
                "total": args.pool_total if args.pool_total is not None else 0,
            }

        try:
            event = emit_event(
                event_type=args.type,
                summary=args.summary,
                project_id=args.project,
                verdict=args.verdict,
                severity=args.severity,
                metrics=parsed_metrics,
                dossier_path=args.dossier,
                task_id=args.task_id,
                satellite=args.satellite,
                error_type=args.error_type,
                attempt_count=args.attempt_count,
                prompt_mutation_applied=args.prompt_mutation,
                account_id=args.account_id,
                pr_url=args.pr_url,
                details=args.details,
                pool_status=pool_status,
                estimated_recovery_sec=args.estimated_recovery_sec,
                pending_tasks_blocked=args.pending_blocked,
                admission_token=args.admission_token,
                manifest_path=args.manifest_path,
                buffer_path=buffer_path,
                schema_path=schema_path,
            )
            print(f"[OK] Evento emitido con éxito: ID={event['event_id']}")
            print(json.dumps(event, indent=2, ensure_ascii=False))
            return 0
        except ValueError as err:
            print(f"[ERROR] {err}", file=sys.stderr)
            return 1

    elif args.subcommand == "list":
        events = get_events(
            buffer_path=buffer_path,
            limit=args.limit,
            event_type=args.type,
            project_id=args.project,
            task_id=args.task_id,
        )
        print(f"--- Eventos Estratégicos Registrados ({len(events)}) ---")
        for ev in events:
            ident = ev.get("project_id") or ev.get("task_id") or "FLOTA"
            print(f"[{ev['timestamp']}] [{ev['severity']}] [{ev['type']}] {ident} -> {ev['verdict']}: {ev['summary']}")
        return 0

    return 0


if __name__ == "__main__":
    sys.exit(main())
