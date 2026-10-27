---
description: Inicia el protocolo de cambios en la estructura de gobernanza y Kernel.
---

> [!IMPORTANT]
> **PROTOCOLO DE SOBERANÍA**: Cualquier cambio en este workflow o en los archivos protegidos (GEMINI, VISION, Ops) requiere innegociablemente un código 2FA del PO.

// turbo-all

1. **Análisis y Planificación**:
   - Analizar el impacto del cambio solicitado en los orquestadores y la documentación.
   - Insertar un bloque de **Sprint de Gobernanza** en `task.md` y `backlog.md`.
   - Re-indexar los sprints posteriores si es necesario.
   - Etiqueta obligatoria: `[GOV-AMEND]`.

2. **Apertura del Kernel (TASK-INIT)**:
   - Ejecutar `gov amend --start [ID] [Descripción]`.
   - **REQUERIDO**: Firma física 2FA del PO para abrir la enmienda.
   - ID: AMEND-[N].

3. **Ejecución y Blindaje (Gobernanza)**:
   - Para cada cambio en archivos de GOBERNANZA o MOTOR (Cat 10):
   - **REQUERIDO**: Firma física 2FA del PO. Muro innegociable.
   - Si el código es denegado o expira → Estado `NEEDS_REVIEW`.

4. **Cierre y Consolidación (TASK-CLOSE)**:
   - **REQUERIDO**: Firma física 2FA del PO para sellar los cambios.
   - Ejecutar `gov amend --finish`.
   - Este comando valida consistencia, fija el **Baseline Mandatario** y actualiza `VISION.md`.
   - Archivar el sprint de gobernanza con el procedimiento estándar.
   - **Mantenimiento Documental (AMEND-011)**: Actualizar `CHEATSHEET.md` con nuevos comandos o comportamientos.
   - **Sincronización**: Verificar que `GEMINI.md`, `VISION.md` y `METHODOLOGY.md` están sincronizados antes de sellar.


5. **Verificación**:
   - Ejecutar `gov drift-check` para confirmar que el sistema es `CLEAN`.

