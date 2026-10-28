---
description: Envoltorio (Wrapper) de Gobernanza para la ejecución segura de tareas.
---

// Protocolo de Ejecución Segura (/task)

1. **Fase 1: Pre-Flight (Gate de Salud y Planificación)**
   - Ejecutar `bin/logix check`.
   - Si el retorno indica ZONA ROJA o saturación crítica, ABORTAR la ejecución.
   - **Gate de Perímetro Sónico (MANDATORIO)**: Verificar que todos los archivos a modificar estén dentro de la raíz del búnker activo (ej. `C:\Users\Ruben\Documents\conext_core`). Si cualquier ruta destino pertenece a otro nodo (ej. `Smart`, `Vocalab`), **ABORTAR INMEDIATAMENTE** y declarar `[SONIC_PERIMETER_VIOLATION]`.
   - Leer `task.md` (o archivo de control equivalente) y verificar que la tarea a ejecutar tiene el estado `[/]`.
   - **Gate de Reusabilidad (Axioma)**: Evaluar si la capacidad a desarrollar es genérica. Si lo es, debe planificarse para el dominio compartido, evitando deuda técnica local.
   - **Gate Lean SDD**: Si la tarea es de Zona ROJA (Kernel/Arquitectura), verificar la existencia de un `detail_doc`. Prohibido codificar sin contrato previo.
   - **Verificación Empírica de Pre-Existencia (Anti-Duplicación)**: Inspeccionar físicamente el repositorio para confirmar que la tarea NO ha sido implementada previamente. Si existe, abortar y marcar como completada.
   - **Freno de Monolitos (LOC-Alarm)**: Verificar empíricamente que los archivos a editar no excedan el límite físico (800/1200 líneas). Si lo exceden, pivotar a refactorización de desmembramiento.
   - **Autonomía Contractual GATE-2 (Regla §41)**: En tareas GATE-2 (Zona GREEN/AMBER: desarrollo estándar, refactors, tests, UI), el Agente queda obligado a proceder directamente a la implementación física y suite de pruebas sin solicitar autorización interactiva previa ni invocar `ask_question` si existe una solución técnica viable sustentable.

2. **Fase 2: Ejecución Antagónica (Cero Mocks)**
   - Escribir la lógica de producción requerida.
   - **Prueba Física Obligatoria:** Escribir un test unitario/integración que incluya obligatoriamente un *Sad Path* (manejo de error).
   - **Auto-Sanación Sintáctica**: Ejecutar el linter y formateador físico (`dart fix --apply && dart format .` u homólogo) ANTES de correr los tests, para evitar fallas por errores triviales.
   - Ejecutar la suite de pruebas físicas (`dart test` u homólogo del stack actual).
   - *Prohibido asumir éxito, delegar deuda técnica o inyectar TODOs temporales salvo exención SPIKE:.*

3. **Fase 3: Post-Flight (Conciliación y Commit)**
   - Marcar la tarea como completada (`[x]`) en el archivo `task.md`.
   - **Verificación Antagónica (Gate de Causa Raíz)**: Emitir explícitamente el bloque `<VERIFICACION_ANTAGONICA>` demostrando que la solución ataca la causa raíz y no es un parche temporal.
   - Emitir la Declaración de Cobertura en el chat: `[COBERTURA] Archivos: X. Tests: Comando. Estado: COMPLETO`.
   - **Gate de Saturación (OBLIGATORIO - Regla §45)**: Ejecutar `bin/logix check` (o `logix.exe check` en Windows). La omisión física de este comando constituye Negligencia Operativa. Si el resultado es ZONA ÁMBAR (depth >= 50% o baliza Checkpoint del IDE) o ZONA ROJA (depth >= 100%), el agente **DEBE** transitar inmediatamente al workflow `/handover`. Este bloqueo es absoluto e ineludible: queda terminantemente prohibido iniciar una nueva tarea en Zona Ámbar o Roja hasta completar el handover.
   - **Commit Atómico Obligatorio**: Ejecutar el commit de la tarea (`git add .` seguido de `git commit -m "feat/fix(scope): [ID] descripción"`). Queda estrictamente prohibido usar `--no-verify`.
   - **Encadenamiento Autárquico GATE-2**: En tareas GATE-2, si el Odómetro permanece en ZONA VERDE (<50%) y el sprint tiene tareas pendientes, el Agente transitará de inmediato a la siguiente tarea sin devolver el turno al usuario ni requerir interacción intermedia.
