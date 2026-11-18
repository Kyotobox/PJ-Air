---
name: fleet-worker-dispatch
description: Despacho, encolado, inspección y control de tareas autónomas hacia la cola de workers agy de Automa (inference_queue.db). Úsalo cuando el usuario pida encolar sprints, despachar tareas a workers, consultar el estado de la cola agy o pausar/reanudar ejecuciones.
---

# Fleet Worker Dispatch Skill

## Propósito
Esta skill provee el mecanismo universal para delegar sprints y tareas de desarrollo desatendidas hacia la factoría de workers `agy` (`vibraframe-worker:latest`) orquestados por Automa.

## Componentes y Ubicación
* **Base de Datos de la Cola**:
  - Producción VM Automa / Host: `/opt/automa/data/inference_queue.db` (SQLite WAL).
  - Soberanía Offline-First local (§45): `<bunker>/vault/runtime/inference_queue.db`.
  - Override por variable de entorno: `AUTOMA_QUEUE_DB`.
* **Daemon Despachador**: `automa-queue-dispatcher.service` (concurrencia 3 slots, sandbox Docker efímero con worktrees aislados).
* **Logs de Ejecución**: `/home/opc/code/automa/vault/logs/<TICKET_ID>.log`.

## Procedimiento de Encolado
Para despachar un sprint de cualquier nodo satélite (Ruedas, Smart, BeatMe, etc.):

1. **Asegurar que el sprint está en `backlog.json`**:
   - Estado: `PLANNED`.
   - Límite de tareas: entre 4 y 6 tareas (§44).
   - Atomicidad: $\le 5$ archivos predichos por tarea (§12.b).

2. **Simular / Validar sin mutaciones (Dry Run)**:
   ```bash
   python3 .agents/skills/fleet-worker-dispatch/scripts/enqueue_sprint.py --sprint=<ID> --dry-run
   ```

3. **Ejecutar el script despachador**:
   ```bash
   python3 .agents/skills/fleet-worker-dispatch/scripts/enqueue_sprint.py --sprint=<ID>
   ```
   *El script lee `backlog.json`, genera los tickets atómicos `TCK-<NODE>-<SPRINT><NUM>-<TS>` e inserta la cadena de ejecución con triggers de cascada deterministas.*

4. **Monitorear el avance**:
   ```bash
   python3 .agents/skills/fleet-worker-dispatch/scripts/check_queue.py
   ```

## Reglas de Seguridad
* **Tolerancia Cero a Mocks (§4)**: Los prompts generados exigen pruebas físicas reales con SQLite WAL o repositorios efímeros en `Directory.systemTemp`.
* **Sad Path Mandatorio (§6)**: Toda tarea generada exige pruebas negativas con `throwsA` o aserciones de excepción.
* **Autocommit Mandatorio (§48)**: El sandbox efímero commitea atómicamente tras exit code 0 y mergea a la rama principal.
* **Veto a Harvest en Workers Efímeros (§57)**: Prohibido despachar tareas de recolección masiva de datos en vivo (*harvest*, web scraping, crawling de bots o descarga de catálogos multimedia) a workers agy efímeros. Toda ejecución viva debe realizarse en instancias persistentes (Host/VM/systemd daemon). `enqueue_sprint.py` activará el veto `❌ [VETO §57]` ante tareas de recolección en vivo.
