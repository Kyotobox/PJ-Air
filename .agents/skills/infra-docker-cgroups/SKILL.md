---
name: infra-docker-cgroups
description: Diagnóstico, inspección y auditoría de cgroups v1/v2 y cuotas de recursos de contenedores Docker para workers de flota (Automa y Smart).
---

# Infra Docker Cgroups Skill

## Propósito
Provee diagnóstico de bajo nivel de consumo de memoria, límites de CPU (CFS quota/period), controladores de procesos (PIDs) y estado de contenedores Docker efímeros asignados a tareas desatendidas.
Permite a los supervisores de infraestructura y centinelas de confiabilidad detectar cuellos de botella de memoria, estrangulamiento de CPU (CPU throttling) y riesgos inminentes de corte OOM (Out-Of-Memory Killer).

## Herramientas y Scripts
* **Punto de Entrada**: `.agents/skills/infra-docker-cgroups/scripts/cgroups_inspector.py`
* **Entorno**: Python 3.10+ (agnóstico, Multi-OS, sin dependencias externas).

## Modos de Operación CLI

### 1. Inspección Canónica del Entorno (cgroup v1 / v2)
Lee directamente los controladores de recursos del cgroup activo (`/sys/fs/cgroup`):
```bash
python3 .agents/skills/infra-docker-cgroups/scripts/cgroups_inspector.py --json
```

### 2. Evaluación de Límites de Salud y Cuotas
Compara el consumo actual de memoria contra umbrales de advertencia y corte crítico:
```bash
python3 .agents/skills/infra-docker-cgroups/scripts/cgroups_inspector.py \
  --check-limits \
  --warn-mem-pct=80.0 \
  --crit-mem-pct=95.0 \
  --fail-on-breach \
  --json
```

### 3. Inspección Específica por PID
Localiza y examina la jerarquía de cgroups de un proceso individual a través de `/proc/<pid>/cgroup`:
```bash
python3 .agents/skills/infra-docker-cgroups/scripts/cgroups_inspector.py --pid=<PID> --json
```

### 4. Inspección de Contenedores Docker de Workers
Supervisa contenedores que coincidan con el prefijo de worker (`automa-worker-`):
```bash
python3 .agents/skills/infra-docker-cgroups/scripts/cgroups_inspector.py \
  --docker \
  --filter="automa-worker-" \
  --json
```

## Contratos de Entrada y Salida (JSON Schema)

### Salida Estructurada (`--json`)
```json
{
  "cgroup_inspection": {
    "version": "v2",
    "cgroup_path": "/sys/fs/cgroup",
    "memory": {
      "current_bytes": 272416768,
      "current_mb": 259.8,
      "limit_bytes": 1468006400,
      "limit_mb": 1400.0,
      "usage_pct": 18.56,
      "is_unlimited": false
    },
    "cpu": {
      "quota_us": 40000,
      "period_us": 100000,
      "cores_limit": 0.4,
      "is_unlimited": false
    },
    "pids": {
      "current": 18,
      "max": 69199,
      "is_unlimited": false
    }
  },
  "health_evaluation": {
    "status": "HEALTHY",
    "warn_threshold_pct": 80.0,
    "crit_threshold_pct": 95.0,
    "current_usage_pct": 18.56,
    "flags": []
  }
}
```

## Mandatos de Gobernanza
* **Tolerancia Cero a Mocks (§4)**: Mediciones basadas exclusivamente en pseudofilesistemas reales del kernel Linux (`/sys/fs/cgroup`, `/proc`).
* **Sad Path Mandatorio (§6)**: Salidas deterministas con código 2 si el PID o directorio de cgroup no existe; código 1 ante breach crítico con `--fail-on-breach`.
* **Calm Error UX**: Degradación suave ante indisponibilidad de Docker daemon sin interrumpir la telemetría local de cgroups.
