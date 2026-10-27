---
description: Planificacion de sprint y creacion de task references.
cognitive_profile: high_cognition_cascade
fallback_sequence: [claude_5_5, astra, argon, gemini_3_8_high]
minimum_floor: gemini_3.8_high
---

// turbo-all

1. **Análisis y Carga de Contexto**:
   - Ejecutar `bin/logix check` y `bin/logix status`.
   - Leer `backlog.json` y `VISION.md`.
   - Identificar trabajo pendiente: deudas técnicas, AMENDs y features prioritarias.

2. **Creación de Sprint Finito (§44 y §12.b)**:
   - **Regla §44 (Sprints Finitos)**: Todo sprint debe contener entre 4 y 6 tareas, con un máximo absoluto de 7 tareas. Si se identifican 8 o más tareas, auto-bifurcar el sprint antes de iniciar la ejecución.
   - **Regla §12 / §12.b (Atomicidad de Ejecución)**: Operaciones humanas máximo 3 archivos por tarea; workers automatizados máximo 5 archivos por tarea.
   - Definir ID (ej. `G225`), nombre, objetivo y tareas en `backlog.json` y `task.md`.
   - Asignar `zone` (`GREEN`, `AMBER`, `RED`) y firmas requeridas `required_signatures` a cada tarea (`["TECH"]` para GREEN/T3, `["TECH", "ARCH"]` para AMBER/T2, `["TECH", "ARCH", "GOV", "PO"]` para RED/T1).
   - **Obligatorio**: Crear `.meta/sprints/[SPRINT-ID]/[TASK-ID].md` por cada tarea con:
     - Contexto, justificación y alcance físico explícito.
     - Especificación técnica de implementación.
     - Criterios de aceptación no triviales (§6 / §9): Happy Path y Sad Path obligatorios.

3. **Decisiones Arquitectónicas (ADR) y Sello de Línea Base**:
   - Si la tarea introduce cambios arquitectónicos, consultar o registrar la decisión con `bin/logix decisions` antes de sellar.
   - Sincronizar tareas y backlog:
     ```bash
     bin/logix sync-tasks
     bin/logix baseline "Plan Sprint [SPRINT-ID]"
     ```
   - Listo para ejecución controlada a través del workflow `/act`.
