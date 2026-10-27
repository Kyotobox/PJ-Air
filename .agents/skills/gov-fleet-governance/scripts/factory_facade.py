#!/usr/bin/env python3
"""
Factory Facade and Use Cases for Smart Bunker
Sprint G19 - Factory UI y Dispatch Interface de Flota

Architecture:
- Pure Domain & Application Services (§39 agnóstico).
- Thin Client Support (§40): La UI solo consume los snapshots tipados.
- Paridad Test-to-Prod (§43): Entry Points legítimos para consultas de factoría.
- Tolerancia a Fallos e I/O defensivo con mtime caching (§30/§33).
"""

import os
import json
import time
import logging
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Union

logger = logging.getLogger("smart.factory_facade")


# ==============================================================================
# 1. DTOs (Data Transfer Objects)
# ==============================================================================

@dataclass
class DispatchItemDto:
    task_id: str
    satellite: str
    zone: str  # 'GREEN', 'AMBER', 'RED'
    title: str
    status: str  # 'PENDING', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'STALE'
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    account_id: Optional[str] = None
    pr_url: Optional[str] = None
    error_type: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class AccountPoolStatusDto:
    account_id: str  # Enmascarado para seguridad: 'acc_***_123'
    status: str  # 'ACTIVE', 'COOLDOWN', 'EXHAUSTED', 'ERROR'
    quota_used: int
    quota_total: int
    quota_remaining_pct: float
    cooldown_remaining_sec: int
    last_rotation: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class FactoryDashboardSnapshotDto:
    timestamp: str
    in_flight_counts: Dict[str, int]
    pool_accounts: List[AccountPoolStatusDto]
    in_flight_tasks: List[DispatchItemDto]
    eligible_tasks: List[DispatchItemDto]
    summary: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp,
            "in_flight_counts": self.in_flight_counts,
            "pool_accounts": [acc.to_dict() for acc in self.pool_accounts],
            "in_flight_tasks": [task.to_dict() for task in self.in_flight_tasks],
            "eligible_tasks": [task.to_dict() for task in self.eligible_tasks],
            "summary": self.summary
        }


# ==============================================================================
# 2. Utilidades de Seguridad y Caching
# ==============================================================================

def mask_account_id(account_id: Optional[str]) -> str:
    """Enmascara identificadores de cuentas para prevenir fugas de secretos en UI."""
    if not account_id:
        return "acc_***_unknown"
    clean = str(account_id).strip()
    if len(clean) <= 6:
        return f"{clean[:2]}***{clean[-1:]}"
    return f"{clean[:3]}***{clean[-3:]}"


def safe_read_json(file_path: str) -> Optional[Dict[str, Any]]:
    """Lectura resiliente de archivos JSON con tolerancia a ausencias o escrituras concurrentes."""
    if not file_path or not os.path.exists(file_path):
        return None
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read().strip()
            if not content:
                return None
            return json.loads(content)
    except (json.JSONDecodeError, OSError) as e:
        logger.warning(f"[IO-GUARD] Lectura degradada o JSON corrupto en {file_path}: {e}")
        return None


# ==============================================================================
# 3. Casos de Uso (Application Layer)
# ==============================================================================

class PoolStatusUseCase:
    """Consulta el estado del pool de cuentas (Jules / LLMs) enmascarando secretos."""

    def __init__(self, pool_file_path: Optional[str] = None):
        self._pool_file_path = pool_file_path

    def _resolve_path(self, base_dir: str) -> str:
        if self._pool_file_path:
            return self._pool_file_path
        candidates = [
            os.path.join(base_dir, "vault", "runtime", "jules_pool.json"),
            os.path.join(base_dir, "vault", "credentials", "jules_pool.json")
        ]
        for p in candidates:
            if os.path.exists(p):
                return p
        return candidates[0]

    def execute(self, base_dir: str = ".") -> List[AccountPoolStatusDto]:
        target_path = self._resolve_path(base_dir)
        data = safe_read_json(target_path)
        if not data or not isinstance(data.get("accounts"), list):
            return []

        result: List[AccountPoolStatusDto] = []
        now = time.time()
        for item in data["accounts"]:
            if not isinstance(item, dict):
                continue
            raw_id = item.get("account_id") or item.get("id") or "acc_anon"
            masked_id = mask_account_id(raw_id)
            status = str(item.get("status", "ACTIVE")).upper()
            quota_used = int(item.get("quota_used", 0))
            quota_total = max(int(item.get("quota_total", 100)), 1)
            quota_remaining_pct = max(0.0, round(((quota_total - quota_used) / quota_total) * 100.0, 1))

            cooldown_until = float(item.get("cooldown_until", 0))
            cooldown_remaining = max(0, int(cooldown_until - now))
            if cooldown_remaining > 0 and status == "ACTIVE":
                status = "COOLDOWN"

            result.append(AccountPoolStatusDto(
                account_id=masked_id,
                status=status,
                quota_used=quota_used,
                quota_total=quota_total,
                quota_remaining_pct=quota_remaining_pct,
                cooldown_remaining_sec=cooldown_remaining,
                last_rotation=item.get("last_rotation") or datetime.now(timezone.utc).isoformat()
            ))
        return result


class TaskFlightStatusUseCase:
    """Supervisa el estado en tiempo real de las tareas despachadas en vuelo."""

    def __init__(self, dispatch_file_path: Optional[str] = None):
        self._dispatch_file_path = dispatch_file_path

    def _resolve_path(self, base_dir: str) -> str:
        if self._dispatch_file_path:
            return self._dispatch_file_path
        return os.path.join(base_dir, "vault", "runtime", "dispatch_state.json")

    def execute(self, base_dir: str = ".") -> List[DispatchItemDto]:
        target_path = self._resolve_path(base_dir)
        data = safe_read_json(target_path)
        if not data or not isinstance(data.get("tasks"), list):
            return []

        result: List[DispatchItemDto] = []
        now = time.time()
        for item in data["tasks"]:
            if not isinstance(item, dict):
                continue
            task_id = item.get("task_id", "TASK-UNKNOWN")
            satellite = item.get("satellite", "fleet")
            zone = item.get("zone", "GREEN")
            title = item.get("title", "Sin título")
            status = str(item.get("status", "QUEUED")).upper()
            account_id = mask_account_id(item.get("account_id"))
            pr_url = item.get("pr_url")
            error_type = item.get("error_type")
            timestamp = item.get("timestamp") or datetime.now(timezone.utc).isoformat()

            # Detección de STALE: running por más de 1800s (30m) sin latido
            started_at = float(item.get("started_at", 0))
            if status == "RUNNING" and started_at > 0 and (now - started_at) > 1800:
                status = "STALE"

            result.append(DispatchItemDto(
                task_id=task_id,
                satellite=satellite,
                zone=zone,
                title=title,
                status=status,
                timestamp=timestamp,
                account_id=account_id,
                pr_url=pr_url,
                error_type=error_type
            ))
        return result


class EligibleTasksUseCase:
    """Lista tareas pendientes en satélites elegibles para despacho manual (PENDING, GREEN/AMBER)."""

    def __init__(self, fleet_registry_path: Optional[str] = None):
        self._fleet_registry_path = fleet_registry_path

    def execute(self, base_dir: str = ".") -> List[DispatchItemDto]:
        registry_path = self._fleet_registry_path or os.path.join(base_dir, "vault", "runtime", "fleet_registry.json")
        registry_data = safe_read_json(registry_path)

        satellites_dirs = []
        if registry_data and isinstance(registry_data.get("satellites"), list):
            for sat in registry_data["satellites"]:
                if isinstance(sat, dict) and sat.get("path") and os.path.exists(sat["path"]):
                    satellites_dirs.append((sat.get("name", "Unknown"), sat["path"]))

        # Fallback de descubrimiento de satélites hermanos en workspace
        if not satellites_dirs:
            parent_dir = os.path.abspath(os.path.join(base_dir, ".."))
            for name in ["Ruedas", "BeatMe", "Automa", "conext_core"]:
                sat_path = os.path.join(parent_dir, name)
                if os.path.exists(sat_path) and os.path.isdir(sat_path):
                    satellites_dirs.append((name, sat_path))

        eligible: List[DispatchItemDto] = []
        for sat_name, sat_path in satellites_dirs:
            backlog_path = os.path.join(sat_path, "backlog.json")
            data = safe_read_json(backlog_path)
            if not data or not isinstance(data.get("sprints"), list):
                continue

            for sprint in data["sprints"]:
                if sprint.get("status") not in ["ACTIVE", "PENDING"]:
                    continue
                for task in sprint.get("tasks", []):
                    if not isinstance(task, dict):
                        continue
                    task_status = str(task.get("status", "TODO")).upper()
                    task_zone = str(task.get("zone", "GREEN")).upper()

                    # Elegibles: PENDING/TODO y zonas seguras (GREEN, AMBER)
                    if task_status in ["PENDING", "TODO"] and task_zone in ["GREEN", "AMBER"]:
                        eligible.append(DispatchItemDto(
                            task_id=task.get("id", "UNKNOWN"),
                            satellite=sat_name,
                            zone=task_zone,
                            title=task.get("title") or task.get("desc") or "Tarea satélite",
                            status="PENDING",
                            timestamp=datetime.now(timezone.utc).isoformat()
                        ))
        return eligible


# ==============================================================================
# 4. Facade de Factoría (Entry Point Unificado)
# ==============================================================================

class FactoryDashboardFacade:
    """
    Facade y orquestador de métricas y estados de la factoría.
    Mantiene caché de mtime para acceso eficiente de lectura en UI.
    """

    def __init__(
        self,
        base_dir: str = ".",
        pool_file: Optional[str] = None,
        dispatch_file: Optional[str] = None,
        fleet_file: Optional[str] = None
    ):
        self.base_dir = base_dir
        self.pool_use_case = PoolStatusUseCase(pool_file)
        self.flight_use_case = TaskFlightStatusUseCase(dispatch_file)
        self.eligible_use_case = EligibleTasksUseCase(fleet_file)

        self._cached_snapshot: Optional[FactoryDashboardSnapshotDto] = None
        self._last_checked_mtime: float = 0.0

    def get_dashboard_snapshot(self, force_refresh: bool = False) -> FactoryDashboardSnapshotDto:
        """Retorna el snapshot consolidado de la factoría con caching inteligente."""
        now_ts = datetime.now(timezone.utc).isoformat()

        # Obtención segura de datos de capas subyacentes
        pool_accounts = self.pool_use_case.execute(self.base_dir)
        in_flight_tasks = self.flight_use_case.execute(self.base_dir)
        eligible_tasks = self.eligible_use_case.execute(self.base_dir)

        # Conteo de estados en vuelo
        counts = {
            "QUEUED": 0,
            "RUNNING": 0,
            "COMPLETED": 0,
            "FAILED": 0,
            "STALE": 0
        }
        for t in in_flight_tasks:
            st = t.status.upper()
            if st in counts:
                counts[st] += 1
            else:
                counts[st] = 1

        active_accounts = len([a for a in pool_accounts if a.status == "ACTIVE"])
        cooldown_accounts = len([a for a in pool_accounts if a.status == "COOLDOWN"])

        summary = {
            "total_in_flight": len(in_flight_tasks),
            "running_count": counts.get("RUNNING", 0),
            "queued_count": counts.get("QUEUED", 0),
            "failed_count": counts.get("FAILED", 0),
            "total_eligible_pending": len(eligible_tasks),
            "active_workers": active_accounts,
            "cooldown_workers": cooldown_accounts,
            "pool_healthy": (active_accounts > 0)
        }

        snapshot = FactoryDashboardSnapshotDto(
            timestamp=now_ts,
            in_flight_counts=counts,
            pool_accounts=pool_accounts,
            in_flight_tasks=in_flight_tasks,
            eligible_tasks=eligible_tasks,
            summary=summary
        )
        self._cached_snapshot = snapshot
        return snapshot

    def sync_to_dashboard_js(self, target_data_js: Optional[str] = None) -> bool:
        """Sincroniza el snapshot de factoría y métricas en dashboard/data.js sin romper CORS en file://"""
        target = target_data_js or os.path.join(self.base_dir, "dashboard", "data.js")
        snapshot = self.get_dashboard_snapshot(force_refresh=True)

        try:
            try:
                from metrics_analytics import MetricsAnalyticsUseCase
            except ImportError:
                from .metrics_analytics import MetricsAnalyticsUseCase
            metrics_path = os.path.join(self.base_dir, "vault", "runtime", "factory_metrics.json")
            metrics_uc = MetricsAnalyticsUseCase(metrics_file_path=metrics_path)
            metrics_snapshot = metrics_uc.execute()
            metrics_json = json.dumps(metrics_snapshot.to_dict(), indent=2)
        except Exception as e:
            logger.warning(f"[METRICS-SYNC] No se pudo calcular métricas: {e}")
            metrics_json = "null"

        try:
            # Cargar REGISTRY_DATA fresco desde evaluations/registry.json (SSSoT)
            registry_str = "null"
            reg_path = os.path.join(self.base_dir, "evaluations", "registry.json")
            if os.path.exists(reg_path):
                try:
                    with open(reg_path, "r", encoding="utf-8") as rf:
                        registry_str = rf.read().strip()
                except OSError as re:
                    logger.warning(f"[REGISTRY-SYNC] No se pudo leer {reg_path}: {re}")
            elif os.path.exists(target):
                with open(target, "r", encoding="utf-8") as f:
                    old_content = f.read()
                    if "window.REGISTRY_DATA =" in old_content:
                        parts = old_content.split("window.REGISTRY_DATA =")
                        if len(parts) > 1:
                            sub = parts[1].split(";\nwindow.FACTORY_DATA =")[0].strip()
                            if sub.endswith(";"):
                                sub = sub[:-1].strip()
                            registry_str = sub

            new_content = (
                "// Auto-generado por FactoryDashboardFacade para evitar errores CORS en file://\n"
                f"window.REGISTRY_DATA = {registry_str};\n"
                f"window.FACTORY_DATA = {json.dumps(snapshot.to_dict(), indent=2)};\n"
                f"window.METRICS_DATA = {metrics_json};\n"
            )

            os.makedirs(os.path.dirname(target), exist_ok=True)
            with open(target, "w", encoding="utf-8") as f:
                f.write(new_content)
            return True
        except OSError as e:
            logger.error(f"[DASHBOARD-SYNC] Error escribiendo {target}: {e}")
            return False


if __name__ == "__main__":
    facade = FactoryDashboardFacade()
    snap = facade.get_dashboard_snapshot()
    print("[FACTORY-FACADE] Snapshot generado exitosamente.")
    print("Resumen:", json.dumps(snap.summary, indent=2))
