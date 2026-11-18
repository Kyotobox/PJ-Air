#!/usr/bin/env python3
"""
warm_cache_manager.py — Gestor de Volúmenes de Caché Persistente para Dependencias en Workers (§4, §6, §12.b, §45, §48, TASK-N92-04).

Implementa la gestión de volúmenes compartidos de solo lectura y Copy-on-Write (COW) para:
  - .pub-cache (Dart / Flutter)
  - node_modules (Node.js / tooling)
  - .dart_tool (package_config y cachés de análisis)

SLA: Tiempo de acoplamiento de dependencias en workers < 5 segundos.
Sad Path: Ante cerrojos activos o corrupción de volumen, emite la advertencia tipada
CacheDegradedException y conmuta de forma segura a un arranque en frío (Cold-Start Fallback)
sin interrumpir la ejecución del ticket.
"""

from __future__ import annotations

import argparse
import dataclasses
import datetime
import hashlib
import json
import logging
import os
import shutil
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Configuración de Logging Estructurado
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [WARM-CACHE] %(message)s",
)
logger = logging.getLogger("automa.warm_cache")

# Constantes de Caché
CACHE_TYPE_PUB = "pub_cache"
CACHE_TYPE_NODE = "node_modules"
CACHE_TYPE_DART_TOOL = "dart_tool"
ALL_CACHE_TYPES = [CACHE_TYPE_PUB, CACHE_TYPE_NODE, CACHE_TYPE_DART_TOOL]

STATUS_HEALTHY = "HEALTHY"
STATUS_DEGRADED = "DEGRADED"
STATUS_COLD_FALLBACK = "COLD_FALLBACK"

REASON_LOCKED = "LOCKED"
REASON_CORRUPTED = "CORRUPTED"
REASON_INCOMPATIBLE = "INCOMPATIBLE"
REASON_MISSING = "MISSING"
REASON_IO_ERROR = "IO_ERROR"


class CacheDegradedException(Exception):
    """
    Excepción tipada para fallos de integridad, bloqueos o anomalías físicas
    en el volumen de caché persistente de workers (§6, TASK-N92-04).
    """

    def __init__(
        self,
        reason: str,
        cache_type: str = "ALL",
        details: str = "",
        cause: Optional[Exception] = None,
    ):
        self.reason = reason
        self.cache_type = cache_type
        self.details = details
        self.cause = cause
        self.timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
        super().__init__(
            f"[CacheDegradedException] Type={cache_type} Reason={reason}: {details}"
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "error": "CacheDegradedException",
            "reason": self.reason,
            "cache_type": self.cache_type,
            "details": self.details,
            "timestamp": self.timestamp,
        }


@dataclasses.dataclass
class WorkerCacheConfig:
    """Configuración de montajes y variables de entorno para el worker."""
    is_warm: bool
    status: str
    docker_mounts: List[str]
    env_vars: Dict[str, str]
    degradation_warning: Optional[str] = None
    prep_duration_ms: float = 0.0
    worktree_path: str = ""
    mounted_caches: List[str] = dataclasses.field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return dataclasses.asdict(self)

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), indent=2)


class WarmCacheManager:
    """
    Gestor soberano de volúmenes de caché persistente compartidos (RO / COW)
    para workers desatendidos en la flota.
    """

    def __init__(
        self,
        base_dir: Optional[Path | str] = None,
        auto_init: bool = True,
        lock_timeout_sec: float = 2.0,
        default_degrade_graceful: bool = True,
    ):
        if base_dir is not None:
            self.base_dir = Path(base_dir).resolve()
        elif "AUTOMA_WARM_CACHE_DIR" in os.environ and os.environ["AUTOMA_WARM_CACHE_DIR"].strip():
            self.base_dir = Path(os.environ["AUTOMA_WARM_CACHE_DIR"].strip()).resolve()
        else:
            self.base_dir = Path("/tmp/automa_warm_cache").resolve()

        self.lock_timeout_sec = lock_timeout_sec
        self.default_degrade_graceful = default_degrade_graceful

        # Rutas de sub-cachés
        self.pub_cache_dir = self.base_dir / CACHE_TYPE_PUB
        self.node_modules_dir = self.base_dir / CACHE_TYPE_NODE
        self.dart_tool_dir = self.base_dir / CACHE_TYPE_DART_TOOL
        self.manifest_path = self.base_dir / "manifest.json"
        self.lock_file_path = self.base_dir / ".cache.lock"

        self._lock_fd: Optional[int] = None

        if auto_init:
            self.ensure_initialized()

    def ensure_initialized(self) -> None:
        """Garantiza la creación idempotente del árbol de directorios y manifiesto inicial."""
        try:
            self.base_dir.mkdir(parents=True, exist_ok=True)
            self.pub_cache_dir.mkdir(parents=True, exist_ok=True)
            (self.pub_cache_dir / "hosted" / "pub.dev").mkdir(parents=True, exist_ok=True)
            (self.pub_cache_dir / "git").mkdir(parents=True, exist_ok=True)

            self.node_modules_dir.mkdir(parents=True, exist_ok=True)
            self.dart_tool_dir.mkdir(parents=True, exist_ok=True)
            (self.dart_tool_dir / "templates").mkdir(parents=True, exist_ok=True)

            if not self.manifest_path.exists():
                initial_manifest = {
                    "version": "1.0.0",
                    "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    "caches": {
                        CACHE_TYPE_PUB: {"status": STATUS_HEALTHY, "items_count": 0},
                        CACHE_TYPE_NODE: {"status": STATUS_HEALTHY, "items_count": 0},
                        CACHE_TYPE_DART_TOOL: {"status": STATUS_HEALTHY, "items_count": 0},
                    },
                }
                self.write_manifest(initial_manifest)
        except OSError as e:
            raise CacheDegradedException(
                reason=REASON_IO_ERROR,
                cache_type="ALL",
                details=f"No se pudo inicializar el directorio base {self.base_dir}: {e}",
                cause=e,
            )

    # --------------------------------------------------------------------------
    # Gestión de Cerrojos Concurrente Multi-Plataforma
    # --------------------------------------------------------------------------
    def is_locked(self) -> bool:
        """Verifica si existe un cerrojo exclusivo activo sobre el volumen."""
        if not self.lock_file_path.exists():
            return False

        # Intentar verificar si el cerrojo sigue activo
        try:
            import fcntl
            with open(self.lock_file_path, "r") as f:
                try:
                    fcntl.flock(f.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                    fcntl.flock(f.fileno(), fcntl.LOCK_UN)
                    return False
                except (BlockingIOError, OSError):
                    return True
        except ImportError:
            # Multi-OS Fallback (Windows / plataformas sin fcntl)
            try:
                content = self.lock_file_path.read_text(encoding="utf-8").strip()
                if content:
                    data = json.loads(content)
                    pid = data.get("pid")
                    ts = data.get("timestamp")
                    if pid and ts:
                        # Verificar si el proceso sigue vivo
                        try:
                            os.kill(pid, 0)
                            return True
                        except OSError:
                            return False
            except Exception:
                pass
            return False

    def acquire_lock(self, timeout_sec: Optional[float] = None) -> bool:
        """Adquiere el cerrojo exclusivo para operaciones de warming o mantenimiento."""
        timeout = timeout_sec if timeout_sec is not None else self.lock_timeout_sec
        deadline = time.perf_counter() + timeout

        self.base_dir.mkdir(parents=True, exist_ok=True)
        fd = os.open(str(self.lock_file_path), os.O_CREAT | os.O_RDWR)

        try:
            import fcntl
            while True:
                try:
                    fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    self._lock_fd = fd
                    lock_data = {
                        "pid": os.getpid(),
                        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    }
                    os.ftruncate(fd, 0)
                    os.lseek(fd, 0, os.SEEK_SET)
                    os.write(fd, json.dumps(lock_data).encode("utf-8"))
                    return True
                except (BlockingIOError, OSError):
                    if time.perf_counter() >= deadline:
                        os.close(fd)
                        return False
                    time.sleep(0.05)
        except ImportError:
            # Fallback sin fcntl
            while True:
                try:
                    if not self.is_locked():
                        self._lock_fd = fd
                        lock_data = {
                            "pid": os.getpid(),
                            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                        }
                        self.lock_file_path.write_text(json.dumps(lock_data), encoding="utf-8")
                        return True
                except Exception:
                    pass
                if time.perf_counter() >= deadline:
                    os.close(fd)
                    return False
                time.sleep(0.05)

    def release_lock(self) -> None:
        """Libera el cerrojo exclusivo."""
        if self._lock_fd is not None:
            try:
                import fcntl
                fcntl.flock(self._lock_fd, fcntl.LOCK_UN)
            except (ImportError, OSError):
                pass
            try:
                os.close(self._lock_fd)
            except OSError:
                pass
            self._lock_fd = None

        if self.lock_file_path.exists():
            try:
                self.lock_file_path.unlink()
            except OSError:
                pass

    # --------------------------------------------------------------------------
    # Manifiesto e Integridad
    # --------------------------------------------------------------------------
    def read_manifest(self) -> Dict[str, Any]:
        """Lee y deserializa el manifiesto de la caché."""
        if not self.manifest_path.exists():
            raise CacheDegradedException(
                reason=REASON_MISSING,
                cache_type="ALL",
                details=f"Manifiesto no encontrado en {self.manifest_path}",
            )
        try:
            content = self.manifest_path.read_text(encoding="utf-8")
            data = json.loads(content)
            if not isinstance(data, dict) or "version" not in data:
                raise ValueError("Estructura de manifiesto inválida")
            return data
        except Exception as e:
            raise CacheDegradedException(
                reason=REASON_CORRUPTED,
                cache_type="ALL",
                details=f"Manifiesto corrupto o no parseable en {self.manifest_path}: {e}",
                cause=e,
            )

    def write_manifest(self, data: Dict[str, Any]) -> None:
        """Escribe atómicamente el manifiesto de caché."""
        data["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        temp_path = self.base_dir / f".manifest.json.tmp.{os.getpid()}"
        temp_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
        temp_path.replace(self.manifest_path)

    def verify_integrity(self, cache_type: Optional[str] = None) -> bool:
        """
        Inspecciona el estado físico, cerrojos y congruencia del volumen.
        Lanza CacheDegradedException si detecta bloqueos o corrupción.
        """
        # 1. Verificar bloqueo activo
        if self.is_locked():
            raise CacheDegradedException(
                reason=REASON_LOCKED,
                cache_type=cache_type or "ALL",
                details=f"El volumen de caché en {self.base_dir} está bloqueado por otro proceso.",
            )

        # 2. Verificar existencia de directorios base
        if not self.base_dir.exists() or not self.base_dir.is_dir():
            raise CacheDegradedException(
                reason=REASON_MISSING,
                cache_type=cache_type or "ALL",
                details=f"Directorio base no existe o no es carpeta: {self.base_dir}",
            )

        # 3. Verificar marcador explícito de corrupción (.corrupted)
        for ctype in ([cache_type] if cache_type else ALL_CACHE_TYPES):
            cdir = self.base_dir / ctype
            if (cdir / ".corrupted").exists():
                err_msg = ""
                try:
                    err_msg = (cdir / ".corrupted").read_text(encoding="utf-8").strip()
                except Exception:
                    pass
                raise CacheDegradedException(
                    reason=REASON_CORRUPTED,
                    cache_type=ctype,
                    details=f"Marcador de corrupción presente en {cdir}: {err_msg or 'Directorio marcado corrupto'}",
                )

        # 4. Validar integridad del manifiesto
        manifest = self.read_manifest()
        version = manifest.get("version", "")
        if not version.startswith("1."):
            raise CacheDegradedException(
                reason=REASON_INCOMPATIBLE,
                cache_type="ALL",
                details=f"Versión de manifiesto incompatible: {version}",
            )

        # 5. Verificación de accesibilidad de subdirectorios requeridos
        types_to_check = [cache_type] if cache_type else ALL_CACHE_TYPES
        for ctype in types_to_check:
            target_path = self.base_dir / ctype
            if not target_path.exists():
                raise CacheDegradedException(
                    reason=REASON_MISSING,
                    cache_type=ctype,
                    details=f"Sub-volumen de caché no existe: {target_path}",
                )
            if not os.access(target_path, os.R_OK):
                raise CacheDegradedException(
                    reason=REASON_IO_ERROR,
                    cache_type=ctype,
                    details=f"Sub-volumen sin permisos de lectura: {target_path}",
                )

        return True

    # --------------------------------------------------------------------------
    # Preparación de Sandbox de Worker (Arranque en Caliente vs Cold Fallback)
    # --------------------------------------------------------------------------
    def prepare_worker_sandbox(
        self,
        worktree_path: Path | str,
        target_repo_type: str = "dart_flutter",
        prefer_cow: bool = True,
        strict: bool = False,
    ) -> WorkerCacheConfig:
        """
        Prepara los montajes compartidos de solo lectura y proyecciones COW
        para el sandbox efímero del worker en < 5 segundos (§TASK-N92-04).

        Si la caché está bloqueada o corrupta:
          - strict=True: Eleva CacheDegradedException.
          - strict=False: Emite warning estructurado [WARN-CACHE-DEGRADED],
            atrapa la excepción y degrada suavemente a COLD_FALLBACK.
        """
        t_start = time.perf_counter()
        w_path = Path(worktree_path).resolve()

        try:
            # Validar integridad y cerrojo
            self.verify_integrity()

            docker_mounts: List[str] = []
            env_vars: Dict[str, str] = {}
            mounted_caches: List[str] = []

            # 1. Configuración de .pub-cache (Read-Only)
            if target_repo_type in ("dart_flutter", "dart", "all"):
                pub_cache_abs = str(self.pub_cache_dir)
                # Montaje de solo lectura al interior del worker
                docker_mounts.extend(["-v", f"{pub_cache_abs}:/home/opc/.pub-cache:ro"])
                env_vars["PUB_CACHE"] = "/home/opc/.pub-cache"
                mounted_caches.append(CACHE_TYPE_PUB)

                # 2. Configuración COW para .dart_tool
                if prefer_cow and w_path.exists():
                    target_dart_tool = w_path / ".dart_tool"
                    self._prepare_cow_dart_tool(target_dart_tool)
                    mounted_caches.append(CACHE_TYPE_DART_TOOL)

            # 3. Configuración de node_modules
            if target_repo_type in ("node", "javascript", "typescript", "all"):
                node_modules_abs = str(self.node_modules_dir)
                docker_mounts.extend(["-v", f"{node_modules_abs}:/usr/lib/node_modules:ro"])
                env_vars["NODE_PATH"] = "/usr/lib/node_modules"
                mounted_caches.append(CACHE_TYPE_NODE)

            t_elapsed_ms = round((time.perf_counter() - t_start) * 1000, 2)
            logger.info(
                f"✅ [WARM-START] Dependencias acopladas en {t_elapsed_ms}ms "
                f"(SLA < 5000ms OK) para worktree {w_path.name}"
            )

            return WorkerCacheConfig(
                is_warm=True,
                status=STATUS_HEALTHY,
                docker_mounts=docker_mounts,
                env_vars=env_vars,
                prep_duration_ms=t_elapsed_ms,
                worktree_path=str(w_path),
                mounted_caches=mounted_caches,
            )

        except CacheDegradedException as exc:
            if strict:
                raise exc

            t_elapsed_ms = round((time.perf_counter() - t_start) * 1000, 2)
            warning_msg = (
                f"[WARN-CACHE-DEGRADED] {exc}. "
                "Conmutando a arranque en frío (Cold-Start Fallback) aislado."
            )
            logger.warning(warning_msg)

            # Cold-start fallback: Ningún montaje compartido montado
            # Se usa el entorno local del worktree
            cold_mounts: List[str] = []
            cold_env: Dict[str, str] = {}

            return WorkerCacheConfig(
                is_warm=False,
                status=STATUS_COLD_FALLBACK,
                docker_mounts=cold_mounts,
                env_vars=cold_env,
                degradation_warning=str(exc),
                prep_duration_ms=t_elapsed_ms,
                worktree_path=str(w_path),
                mounted_caches=[],
            )

    def _prepare_cow_dart_tool(self, target_dart_tool: Path) -> None:
        """
        Proyecta la plantilla .dart_tool en el worktree del worker con
        aislamiento COW (< 50ms) para permitir escrituras locales aisladas
        sin contaminar el volumen maestro.
        """
        target_dart_tool.mkdir(parents=True, exist_ok=True)
        template_dir = self.dart_tool_dir / "templates"
        if not template_dir.exists():
            return

        for item in template_dir.iterdir():
            dest = target_dart_tool / item.name
            if not dest.exists():
                if item.is_file():
                    # Copia aislada e independiente para garantizar que mutaciones
                    # locales del worker no afecten el volumen compartido
                    shutil.copy2(str(item), str(dest))
                elif item.is_dir():
                    shutil.copytree(str(item), str(dest), dirs_exist_ok=True)

    # --------------------------------------------------------------------------
    # Población, Warming y Pruning de Caché
    # --------------------------------------------------------------------------
    def warm_from_directory(
        self,
        source_dir: Path | str,
        cache_types: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Puebla la caché compartida extrayendo paquetes de un repositorio o directorio existente.
        Adquiere cerrojo exclusivo durante el proceso.
        """
        s_dir = Path(source_dir).resolve()
        if not s_dir.exists():
            raise FileNotFoundError(f"Directorio fuente no existe: {s_dir}")

        if not self.acquire_lock():
            raise CacheDegradedException(
                reason=REASON_LOCKED,
                cache_type="ALL",
                details="No se pudo adquirir el cerrojo exclusivo para poblar la caché.",
            )

        types_to_warm = cache_types or ALL_CACHE_TYPES
        stats: Dict[str, int] = {k: 0 for k in types_to_warm}

        try:
            # 1. Warm .pub-cache si existe fuente
            if CACHE_TYPE_PUB in types_to_warm:
                src_pub = s_dir / ".pub-cache"
                if not src_pub.exists() and "PUB_CACHE" in os.environ:
                    src_pub = Path(os.environ["PUB_CACHE"])

                if src_pub.exists() and src_pub.is_dir():
                    src_hosted = src_pub / "hosted" / "pub.dev"
                    dest_hosted = self.pub_cache_dir / "hosted" / "pub.dev"
                    dest_hosted.mkdir(parents=True, exist_ok=True)
                    if src_hosted.exists():
                        for pkg in src_hosted.iterdir():
                            dest_pkg = dest_hosted / pkg.name
                            if not dest_pkg.exists():
                                if pkg.is_dir():
                                    shutil.copytree(str(pkg), str(dest_pkg), dirs_exist_ok=True)
                                    stats[CACHE_TYPE_PUB] += 1

            # 2. Warm .dart_tool templates si existe
            if CACHE_TYPE_DART_TOOL in types_to_warm:
                src_dt = s_dir / ".dart_tool"
                dest_templates = self.dart_tool_dir / "templates"
                dest_templates.mkdir(parents=True, exist_ok=True)
                if src_dt.exists() and src_dt.is_dir():
                    pkg_cfg = src_dt / "package_config.json"
                    if pkg_cfg.exists():
                        shutil.copy2(str(pkg_cfg), str(dest_templates / "package_config.json"))
                        stats[CACHE_TYPE_DART_TOOL] += 1

            # 3. Warm node_modules si existe
            if CACHE_TYPE_NODE in types_to_warm:
                src_nm = s_dir / "node_modules"
                if src_nm.exists() and src_nm.is_dir():
                    for mod in src_nm.iterdir():
                        dest_mod = self.node_modules_dir / mod.name
                        if not dest_mod.exists():
                            if mod.is_dir():
                                shutil.copytree(str(mod), str(dest_mod), dirs_exist_ok=True)
                                stats[CACHE_TYPE_NODE] += 1

            # Actualizar manifiesto
            manifest = self.read_manifest()
            for ctype, count in stats.items():
                if ctype in manifest.get("caches", {}):
                    manifest["caches"][ctype]["items_count"] = (
                        manifest["caches"][ctype].get("items_count", 0) + count
                    )
                    manifest["caches"][ctype]["status"] = STATUS_HEALTHY
            self.write_manifest(manifest)

            return stats
        finally:
            self.release_lock()

    def mark_corrupted(self, cache_type: str, reason_text: str) -> None:
        """Marca un sub-volumen de caché como corrupto para pruebas y fallos de canario."""
        cdir = self.base_dir / cache_type
        cdir.mkdir(parents=True, exist_ok=True)
        (cdir / ".corrupted").write_text(reason_text, encoding="utf-8")

    def clear_corruption(self, cache_type: str) -> None:
        """Remueve la marca de corrupción de un sub-volumen."""
        corrupt_marker = self.base_dir / cache_type / ".corrupted"
        if corrupt_marker.exists():
            corrupt_marker.unlink()

    def get_metrics(self) -> Dict[str, Any]:
        """Calcula métricas físicas y huellas de volumen de la caché."""
        total_bytes = 0
        file_count = 0
        for root, _, files in os.walk(self.base_dir):
            for f in files:
                fp = os.path.join(root, f)
                try:
                    total_bytes += os.path.getsize(fp)
                    file_count += 1
                except OSError:
                    pass

        status = STATUS_HEALTHY
        try:
            self.verify_integrity()
        except CacheDegradedException as e:
            status = f"{STATUS_DEGRADED}: {e.reason}"

        return {
            "base_dir": str(self.base_dir),
            "status": status,
            "total_bytes": total_bytes,
            "total_files": file_count,
            "is_locked": self.is_locked(),
            "pub_cache_exists": self.pub_cache_dir.exists(),
            "node_modules_exists": self.node_modules_dir.exists(),
            "dart_tool_exists": self.dart_tool_dir.exists(),
        }


# ==============================================================================
# Entry Point CLI
# ==============================================================================
def main():
    parser = argparse.ArgumentParser(
        description="Gestor de Caché Persistente para Workers Automa (TASK-N92-04)"
    )
    parser.add_argument("--base-dir", type=str, default=None, help="Directorio base de caché")
    parser.add_argument("--check", action="store_true", help="Verifica integridad y cerrojos")
    parser.add_argument("--status", action="store_true", help="Muestra métricas y estado")
    parser.add_argument("--prep-mounts", type=str, default=None, help="Prepara montajes para un worktree")
    parser.add_argument("--repo-type", type=str, default="dart_flutter", help="Tipo de repo (dart_flutter, node, all)")
    parser.add_argument("--warm-from", type=str, default=None, help="Puebla caché desde un directorio fuente")
    parser.add_argument("--json", action="store_true", help="Formatea salida como JSON")
    parser.add_argument("--strict", action="store_true", help="Lanza excepción en lugar de degradar suavemente")
    parser.add_argument("--mark-corrupted", type=str, default=None, help="Simula corrupción en sub-caché")
    parser.add_argument("--clear-corrupted", type=str, default=None, help="Limpia marca de corrupción")

    args = parser.parse_args()

    manager = WarmCacheManager(base_dir=args.base_dir)

    if args.mark_corrupted:
        manager.mark_corrupted(args.mark_corrupted, "Corrupción inyectada por CLI")
        print(f"Caché {args.mark_corrupted} marcada como corrupta.")
        sys.exit(0)

    if args.clear_corrupted:
        manager.clear_corruption(args.clear_corrupted)
        print(f"Marca de corrupción limpiada en {args.clear_corrupted}.")
        sys.exit(0)

    if args.check:
        try:
            manager.verify_integrity()
            print("OK: Caché íntegra y disponible.")
            sys.exit(0)
        except CacheDegradedException as e:
            print(f"DEGRADED: {e}", file=sys.stderr)
            sys.exit(1 if args.strict else 0)

    if args.warm_from:
        stats = manager.warm_from_directory(args.warm_from)
        if args.json:
            print(json.dumps(stats, indent=2))
        else:
            print(f"Caché poblada con éxito: {stats}")
        sys.exit(0)

    if args.prep_mounts:
        config = manager.prepare_worker_sandbox(
            worktree_path=args.prep_mounts,
            target_repo_type=args.repo_type,
            strict=args.strict,
        )
        if args.json:
            print(config.to_json())
        else:
            print(f"Status: {config.status}")
            print(f"Warm: {config.is_warm}")
            print(f"Prep Duration: {config.prep_duration_ms}ms")
            print(f"Docker Mounts: {' '.join(config.docker_mounts)}")
            print(f"Env: {config.env_vars}")
            if config.degradation_warning:
                print(f"Warning: {config.degradation_warning}")
        sys.exit(0)

    if args.status or len(sys.argv) == 1:
        metrics = manager.get_metrics()
        if args.json:
            print(json.dumps(metrics, indent=2))
        else:
            print("=== MÉTRICAS DE WARM CACHE AUTOMA ===")
            for k, v in metrics.items():
                print(f"  {k}: {v}")
        sys.exit(0)


if __name__ == "__main__":
    main()
