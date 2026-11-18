#!/usr/bin/env python3
"""cgroups_inspector.py - Inspector de Cgroups y Recursos de Contenedores Docker.

Inspecciona cuotas de CPU, memoria y PIDs en jerarquias cgroup v1 y v2,
monitorea contenedores de workers desatendidos (Automa y Smart) y previene
desbordamientos de recursos y bloqueos OOM.
Conforme a las reglas constitucionales de gobernanza (§4, §6, §12.b, §45, §55).
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


class CgroupsInspectorError(Exception):
    """Excepcion base para errores del inspector de cgroups."""


class TargetCgroupNotFoundError(CgroupsInspectorError):
    """Arrojada cuando no se localiza la ruta de cgroup solicitada."""


class TargetProcessNotFoundError(CgroupsInspectorError):
    """Arrojada cuando el PID solicitado no existe en /proc."""


def read_file_safe(path: str) -> Optional[str]:
    """Lee el contenido de un archivo de texto de forma segura."""
    if not os.path.isfile(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read().strip()
    except (OSError, UnicodeDecodeError):
        return None


def detect_cgroup_version(cgroup_dir: str) -> str:
    """Detecta si un directorio de cgroups corresponde a v1, v2 o no disponible."""
    if not os.path.isdir(cgroup_dir):
        return "UNAVAILABLE"

    # Indicadores de cgroup v2 (Unified Hierarchy)
    v2_markers = ["cgroup.controllers", "cgroup.procs", "memory.current", "cpu.max"]
    for marker in v2_markers:
        if os.path.exists(os.path.join(cgroup_dir, marker)):
            return "v2"

    # Indicadores de cgroup v1
    v1_markers = ["memory.usage_in_bytes", "cpu.cfs_quota_us"]
    for marker in v1_markers:
        if os.path.exists(os.path.join(cgroup_dir, marker)):
            return "v1"

    # Subdirectorios v1 estandar
    if os.path.isdir(os.path.join(cgroup_dir, "memory")) or os.path.isdir(os.path.join(cgroup_dir, "cpu")):
        return "v1"

    return "v2" if os.path.exists(os.path.join(cgroup_dir, "cgroup.events")) else "UNKNOWN"


def parse_cgroup_v2_metrics(cgroup_dir: str) -> Dict[str, Any]:
    """Extrae las metricas de recursos de un cgroup v2 unificado."""
    # 1. Memoria
    mem_current_str = read_file_safe(os.path.join(cgroup_dir, "memory.current"))
    mem_max_str = read_file_safe(os.path.join(cgroup_dir, "memory.max"))
    mem_stat_str = read_file_safe(os.path.join(cgroup_dir, "memory.stat"))

    mem_current_bytes: Optional[int] = int(mem_current_str) if mem_current_str and mem_current_str.isdigit() else None
    mem_max_bytes: Optional[int] = None
    if mem_max_str and mem_max_str != "max" and mem_max_str.isdigit():
        mem_max_bytes = int(mem_max_str)

    mem_usage_mb = round(mem_current_bytes / (1024 * 1024), 2) if mem_current_bytes is not None else None
    mem_limit_mb = round(mem_max_bytes / (1024 * 1024), 2) if mem_max_bytes is not None else None
    mem_usage_pct: Optional[float] = None
    if mem_current_bytes is not None and mem_max_bytes is not None and mem_max_bytes > 0:
        mem_usage_pct = round((mem_current_bytes / mem_max_bytes) * 100.0, 2)

    stat_details: Dict[str, int] = {}
    if mem_stat_str:
        for line in mem_stat_str.splitlines():
            parts = line.strip().split()
            if len(parts) == 2 and parts[1].isdigit():
                stat_details[parts[0]] = int(parts[1])

    # 2. CPU
    cpu_max_str = read_file_safe(os.path.join(cgroup_dir, "cpu.max"))
    cpu_quota_us: Optional[int] = None
    cpu_period_us: Optional[int] = None
    cpu_cores_limit: Optional[float] = None

    if cpu_max_str:
        cpu_parts = cpu_max_str.split()
        if len(cpu_parts) >= 2:
            if cpu_parts[0] != "max" and cpu_parts[0].isdigit():
                cpu_quota_us = int(cpu_parts[0])
            if cpu_parts[1].isdigit():
                cpu_period_us = int(cpu_parts[1])
            if cpu_quota_us is not None and cpu_period_us and cpu_period_us > 0:
                cpu_cores_limit = round(cpu_quota_us / cpu_period_us, 2)

    # 3. PIDs
    pids_current_str = read_file_safe(os.path.join(cgroup_dir, "pids.current"))
    pids_max_str = read_file_safe(os.path.join(cgroup_dir, "pids.max"))
    pids_current = int(pids_current_str) if pids_current_str and pids_current_str.isdigit() else None
    pids_max = int(pids_max_str) if pids_max_str and pids_max_str != "max" and pids_max_str.isdigit() else None

    return {
        "version": "v2",
        "cgroup_path": cgroup_dir,
        "memory": {
            "current_bytes": mem_current_bytes,
            "current_mb": mem_usage_mb,
            "limit_bytes": mem_max_bytes,
            "limit_mb": mem_limit_mb,
            "usage_pct": mem_usage_pct,
            "is_unlimited": mem_max_bytes is None,
            "stat_anon_bytes": stat_details.get("anon"),
            "stat_file_bytes": stat_details.get("file"),
        },
        "cpu": {
            "quota_us": cpu_quota_us,
            "period_us": cpu_period_us,
            "cores_limit": cpu_cores_limit,
            "is_unlimited": cpu_cores_limit is None,
        },
        "pids": {
            "current": pids_current,
            "max": pids_max,
            "is_unlimited": pids_max is None,
        },
    }


def parse_cgroup_v1_metrics(cgroup_dir: str) -> Dict[str, Any]:
    """Extrae las metricas de recursos de un cgroup v1 dividido por controladores."""
    mem_dir = os.path.join(cgroup_dir, "memory") if os.path.isdir(os.path.join(cgroup_dir, "memory")) else cgroup_dir
    cpu_dir = os.path.join(cgroup_dir, "cpu") if os.path.isdir(os.path.join(cgroup_dir, "cpu")) else cgroup_dir
    pids_dir = os.path.join(cgroup_dir, "pids") if os.path.isdir(os.path.join(cgroup_dir, "pids")) else cgroup_dir

    # 1. Memoria v1
    mem_usage_str = read_file_safe(os.path.join(mem_dir, "memory.usage_in_bytes"))
    mem_limit_str = read_file_safe(os.path.join(mem_dir, "memory.limit_in_bytes"))

    mem_current_bytes: Optional[int] = int(mem_usage_str) if mem_usage_str and mem_usage_str.isdigit() else None
    mem_max_bytes: Optional[int] = None
    if mem_limit_str and mem_limit_str.isdigit():
        val = int(mem_limit_str)
        # Valores gigantescos (> 2^60) representan limites infinitos en kernel Linux v1
        if val < (1 << 60):
            mem_max_bytes = val

    mem_usage_mb = round(mem_current_bytes / (1024 * 1024), 2) if mem_current_bytes is not None else None
    mem_limit_mb = round(mem_max_bytes / (1024 * 1024), 2) if mem_max_bytes is not None else None
    mem_usage_pct: Optional[float] = None
    if mem_current_bytes is not None and mem_max_bytes is not None and mem_max_bytes > 0:
        mem_usage_pct = round((mem_current_bytes / mem_max_bytes) * 100.0, 2)

    # 2. CPU v1
    cpu_quota_str = read_file_safe(os.path.join(cpu_dir, "cpu.cfs_quota_us"))
    cpu_period_str = read_file_safe(os.path.join(cpu_dir, "cpu.cfs_period_us"))
    cpu_quota_us: Optional[int] = None
    cpu_period_us: Optional[int] = None
    cpu_cores_limit: Optional[float] = None

    if cpu_quota_str and cpu_quota_str != "-1":
        try:
            val = int(cpu_quota_str)
            if val > 0:
                cpu_quota_us = val
        except ValueError:
            pass

    if cpu_period_str and cpu_period_str.isdigit():
        cpu_period_us = int(cpu_period_str)

    if cpu_quota_us is not None and cpu_period_us and cpu_period_us > 0:
        cpu_cores_limit = round(cpu_quota_us / cpu_period_us, 2)

    # 3. PIDs v1
    pids_cur_str = read_file_safe(os.path.join(pids_dir, "pids.current"))
    pids_max_str = read_file_safe(os.path.join(pids_dir, "pids.max"))
    pids_current = int(pids_cur_str) if pids_cur_str and pids_cur_str.isdigit() else None
    pids_max = int(pids_max_str) if pids_max_str and pids_max_str != "max" and pids_max_str.isdigit() else None

    return {
        "version": "v1",
        "cgroup_path": cgroup_dir,
        "memory": {
            "current_bytes": mem_current_bytes,
            "current_mb": mem_usage_mb,
            "limit_bytes": mem_max_bytes,
            "limit_mb": mem_limit_mb,
            "usage_pct": mem_usage_pct,
            "is_unlimited": mem_max_bytes is None,
        },
        "cpu": {
            "quota_us": cpu_quota_us,
            "period_us": cpu_period_us,
            "cores_limit": cpu_cores_limit,
            "is_unlimited": cpu_cores_limit is None,
        },
        "pids": {
            "current": pids_current,
            "max": pids_max,
            "is_unlimited": pids_max is None,
        },
    }


def find_pid_cgroup_dir(pid: int) -> str:
    """Resuelve la ruta absoluta del cgroup asignado a un proceso a traves de /proc/<pid>/cgroup."""
    proc_cgroup = f"/proc/{pid}/cgroup"
    if not os.path.exists(proc_cgroup):
        raise TargetProcessNotFoundError(
            f"El proceso indicado no existe en el sistema (/proc/{pid} inexistente)."
        )

    content = read_file_safe(proc_cgroup)
    if not content:
        raise TargetCgroupNotFoundError(
            f"No fue posible leer la informacion de cgroup para PID {pid}."
        )

    # cgroup v2 tiene formato: 0::<relative_path>
    # cgroup v1 tiene formato: <id>:<controller>:<relative_path>
    cgroup_rel_path = ""
    for line in content.splitlines():
        parts = line.strip().split(":")
        if len(parts) == 3:
            # Preferir v2 si el controlador esta vacio (0::/...)
            if parts[0] == "0" and not parts[1]:
                cgroup_rel_path = parts[2].lstrip("/")
                break
            elif "memory" in parts[1]:
                cgroup_rel_path = parts[2].lstrip("/")

    base_cgroup = "/sys/fs/cgroup"
    resolved_path = os.path.join(base_cgroup, cgroup_rel_path) if cgroup_rel_path else base_cgroup
    if not os.path.isdir(resolved_path):
        resolved_path = base_cgroup

    return resolved_path


def inspect_cgroups(
    cgroup_dir: Optional[str] = None,
    pid: Optional[int] = None,
) -> Dict[str, Any]:
    """Punto de entrada principal para inspeccion de cgroups."""
    target_dir: str
    if pid is not None:
        target_dir = find_pid_cgroup_dir(pid)
    elif cgroup_dir is not None:
        target_dir = os.path.abspath(cgroup_dir)
    else:
        target_dir = "/sys/fs/cgroup"

    if not os.path.isdir(target_dir):
        raise TargetCgroupNotFoundError(
            f"El directorio de cgroup especificado no existe fisicamente: {target_dir}"
        )

    version = detect_cgroup_version(target_dir)
    if version == "v2":
        return parse_cgroup_v2_metrics(target_dir)
    elif version == "v1":
        return parse_cgroup_v1_metrics(target_dir)
    else:
        # Fallback de lectura basica si version no es puramente distinguible
        res = parse_cgroup_v2_metrics(target_dir)
        res["version"] = version
        return res


def inspect_docker_workers(
    name_filter: str = "automa-worker-",
) -> Dict[str, Any]:
    """Inspecciona contenedores Docker activos de workers si el daemon esta disponible."""
    docker_bin = shutil.which("docker")
    if not docker_bin:
        return {
            "docker_available": False,
            "reason": "Binario 'docker' no encontrado en PATH del sistema.",
            "containers": [],
        }

    try:
        check_proc = subprocess.run(
            [docker_bin, "info", "--format", "{{.ServerVersion}}"],
            capture_output=True,
            text=True,
            timeout=3,
        )
        if check_proc.returncode != 0:
            return {
                "docker_available": False,
                "reason": "Docker daemon inaccesible o socket sin permisos.",
                "containers": [],
            }
    except (subprocess.SubprocessError, OSError):
        return {
            "docker_available": False,
            "reason": "Timeout o error de conexion al socket Docker.",
            "containers": [],
        }

    # Listar contenedores que coincidan con el filtro
    try:
        ps_proc = subprocess.run(
            [
                docker_bin,
                "ps",
                "--filter",
                f"name={name_filter}",
                "--format",
                "{{json .}}",
            ],
            capture_output=True,
            text=True,
            timeout=5,
        )
        containers: List[Dict[str, Any]] = []
        if ps_proc.returncode == 0 and ps_proc.stdout.strip():
            for line in ps_proc.stdout.strip().splitlines():
                if line.strip():
                    try:
                        containers.append(json.loads(line.strip()))
                    except json.JSONDecodeError:
                        pass

        return {
            "docker_available": True,
            "server_version": check_proc.stdout.strip(),
            "count": len(containers),
            "containers": containers,
        }
    except subprocess.SubprocessError as e:
        return {
            "docker_available": True,
            "error": f"Fallo al listar contenedores: {e}",
            "containers": [],
        }


def evaluate_health_limits(
    metrics: Dict[str, Any],
    warn_mem_pct: float = 80.0,
    crit_mem_pct: float = 95.0,
) -> Dict[str, Any]:
    """Evalua si el consumo de memoria o recursos excede los umbrales configurados."""
    mem = metrics.get("memory", {})
    usage_pct = mem.get("usage_pct")

    status = "HEALTHY"
    flags: List[str] = []

    if usage_pct is not None:
        if usage_pct >= crit_mem_pct:
            status = "CRITICAL"
            flags.append(
                f"Consumo de memoria critico ({usage_pct}% >= {crit_mem_pct}%)."
            )
        elif usage_pct >= warn_mem_pct:
            status = "WARNING"
            flags.append(
                f"Consumo de memoria elevado ({usage_pct}% >= {warn_mem_pct}%)."
            )

    return {
        "status": status,
        "warn_threshold_pct": warn_mem_pct,
        "crit_threshold_pct": crit_mem_pct,
        "current_usage_pct": usage_pct,
        "flags": flags,
    }


def build_arg_parser() -> argparse.ArgumentParser:
    """Construye el analizador de argumentos de linea de comandos."""
    parser = argparse.ArgumentParser(
        description="Inspector de Cgroups y Recursos de Contenedores Docker (§55, §4, §6)."
    )
    parser.add_argument(
        "--cgroup-dir",
        default=None,
        help="Ruta especifica de cgroup a inspeccionar (por defecto: /sys/fs/cgroup).",
    )
    parser.add_argument(
        "--pid",
        type=int,
        default=None,
        help="PID especifico para inspeccionar su cgroup asociado.",
    )
    parser.add_argument(
        "--docker",
        action="store_true",
        help="Inspecciona el estado de contenedores Docker de workers.",
    )
    parser.add_argument(
        "--filter",
        default="automa-worker-",
        help="Filtro de nombre de contenedores Docker (por defecto: automa-worker-).",
    )
    parser.add_argument(
        "--check-limits",
        action="store_true",
        help="Evalua el estado de salud de memoria contra umbrales.",
    )
    parser.add_argument(
        "--warn-mem-pct",
        type=float,
        default=80.0,
        help="Umbral porcentual de alerta de memoria (por defecto: 80.0).",
    )
    parser.add_argument(
        "--crit-mem-pct",
        type=float,
        default=95.0,
        help="Umbral porcentual critico de memoria (por defecto: 95.0).",
    )
    parser.add_argument(
        "--fail-on-breach",
        action="store_true",
        help="Retorna exit code 1 si se detecta un estado CRITICAL.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emite la respuesta en formato JSON estructurado.",
    )
    return parser


def main() -> int:
    """Punto de entrada principal para CLI."""
    parser = build_arg_parser()
    args = parser.parse_args()

    try:
        metrics = inspect_cgroups(
            cgroup_dir=args.cgroup_dir,
            pid=args.pid,
        )

        health: Optional[Dict[str, Any]] = None
        if args.check_limits:
            health = evaluate_health_limits(
                metrics=metrics,
                warn_mem_pct=args.warn_mem_pct,
                crit_mem_pct=args.crit_mem_pct,
            )

        docker_info: Optional[Dict[str, Any]] = None
        if args.docker:
            docker_info = inspect_docker_workers(name_filter=args.filter)

        output: Dict[str, Any] = {
            "cgroup_inspection": metrics,
        }
        if health is not None:
            output["health_evaluation"] = health
        if docker_info is not None:
            output["docker_workers"] = docker_info

        if args.json:
            print(json.dumps(output, indent=2))
        else:
            mem = metrics.get("memory", {})
            cpu = metrics.get("cpu", {})
            pids = metrics.get("pids", {})
            print("=== CGROUPS INSPECTOR: DIAGNOSTICO DE RECURSOS ===")
            print(f"Version: {metrics.get('version')} | Ruta: {metrics.get('cgroup_path')}")
            print(
                f"Memoria: {mem.get('current_mb')} MB / {mem.get('limit_mb') or 'Ilimitado'} MB "
                f"({mem.get('usage_pct') or 0.0}%)"
            )
            print(
                f"CPU Cores: {cpu.get('cores_limit') or 'Ilimitado'} "
                f"(Quota: {cpu.get('quota_us') or 'max'} / Period: {cpu.get('period_us') or 'N/A'})"
            )
            print(f"PIDs: {pids.get('current')} / {pids.get('max') or 'Ilimitado'}")
            if health:
                print(f"Salud: [{health['status']}]")
                for flag in health.get("flags", []):
                    print(f"  • {flag}")
            if docker_info:
                print(
                    f"Docker Workers: {docker_info.get('count', 0)} detectados "
                    f"(Disponible: {docker_info.get('docker_available')})"
                )

        if args.fail_on_breach and health and health["status"] == "CRITICAL":
            return 1

        return 0

    except TargetProcessNotFoundError as e:
        sys.stderr.write(f"[ERROR-PID] {e}\n")
        return 2
    except TargetCgroupNotFoundError as e:
        sys.stderr.write(f"[ERROR-CGROUP] {e}\n")
        return 2
    except CgroupsInspectorError as e:
        sys.stderr.write(f"[ERROR-INSPECTOR] {e}\n")
        return 1
    except Exception as e:
        sys.stderr.write(f"[FATAL] Error inesperado en cgroups_inspector: {e}\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
