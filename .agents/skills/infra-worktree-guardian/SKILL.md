---
name: infra-worktree-guardian
description: Auditoría, creación, saneamiento y purga de Git Worktrees efímeros para workers desatendidos en la flota (Automa, Smart y satélites).
---

# Infra Worktree Guardian Skill

## Propósito
Provee capacidades operativas y preventivas de bajo nivel para gobernar el ciclo de vida de los Git Worktrees efímeros asignados a workers desatendidos (`vibraframe-worker`, `agy`, Automa dispatcher y runners locales).
Evita la proliferación de worktrees zombis, bloqueos administrativos (`locked`), ramas huérfanas y desbordamiento de almacenamiento en el host.

## Herramientas y Scripts
* **Punto de Entrada**: `.agents/skills/infra-worktree-guardian/scripts/worktree_guardian.py`
* **Entorno**: Python 3.10+ (agnóstico, Multi-OS, sin dependencias externas).

## Modos de Operación CLI

### 1. Auditoría de Worktrees Activos y Zombis
Inspecciona todos los worktrees registrados mediante `git worktree list --porcelain` y categoriza su estado (`MAIN`, `ACTIVE`, `ZOMBIE`, `LOCKED`, `STALE`):
```bash
python3 .agents/skills/infra-worktree-guardian/scripts/worktree_guardian.py --list --json
```

### 2. Creación de Worktree Efímero para Worker
Asigna un directorio aislado y rama de trabajo vinculada a un ref base:
```bash
python3 .agents/skills/infra-worktree-guardian/scripts/worktree_guardian.py \
  --create \
  --path="/tmp/workers/TCK-EXAMPLE-01" \
  --branch="worker/TCK-EXAMPLE-01" \
  --base="HEAD" \
  --json
```

### 3. Remoción Segura de Worktree
Elimina un worktree específico por ruta o nombre de rama, limpiando referencias administrativas:
```bash
python3 .agents/skills/infra-worktree-guardian/scripts/worktree_guardian.py \
  --remove="/tmp/workers/TCK-EXAMPLE-01" \
  --json
```

### 4. Purgado de Referencias Caducas (Prune)
Sincroniza el catálogo de metadatos de Git eliminando entradas cuyos directorios fueron eliminados:
```bash
python3 .agents/skills/infra-worktree-guardian/scripts/worktree_guardian.py --prune --json
```

### 5. Limpieza Automatizada de Zombis y Huérfanos
Identifica y purga simultáneamente los worktrees sin directorio físico y directorios huérfanos sin worktree registrado:
```bash
python3 .agents/skills/infra-worktree-guardian/scripts/worktree_guardian.py \
  --clean \
  --worker-dir="/tmp/workers" \
  --json
```

## Contratos de Entrada y Salida (JSON Schema)

### Salida de Auditoría (`--list --json`)
```json
{
  "repo_root": "/workspace",
  "total_count": 2,
  "active_count": 1,
  "zombie_count": 1,
  "locked_count": 0,
  "stale_count": 0,
  "worktrees": [
    {
      "path": "/home/opc/code/Smart",
      "branch": "master",
      "head": "ddbd9f6fe6d3947515de84e24078e339c5466fbc",
      "is_main": true,
      "exists_on_disk": true,
      "status": "MAIN",
      "locked": false,
      "lock_reason": "",
      "prunable": false,
      "prune_reason": "",
      "age_hours": 0.5
    }
  ]
}
```

## Mandatos de Gobernanza
* **Tolerancia Cero a Mocks (§4)**: Operaciones ejecutadas directamente sobre el subsistema Git nativo y sistema de archivos real.
* **Sad Path Mandatorio (§6)**: Salidas con código de error deterministas (código 2 para repositorio o argumentos inválidos, código 1 para fallos de operación git).
* **Protección del Búnker Soberano**: Prohibición explícita de eliminar el worktree principal (`MAIN`).
