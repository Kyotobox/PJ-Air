---
description: Protocolo de Onboarding Soberano (Takeover). Sincroniza la sesión de la IA con el ADN del Búnker.
Regla: Toda comunicación con el usuario debe ser exclusivamente en español.
---

> [!NOTE]
> **COMPATIBILIDAD MULTI-AGENTE (CODEX/GENÉRICA)**
> Si estás operando como un agente de terminal (Codex, Cursor, etc.), DEBES ejecutar `.\bin\logix.exe takeover` en tu shell para simular el comportamiento que Antigravity IDE haría nativamente.

1. **Sincronización Sónica (MANDATORIO)**:
   - Si el búnker reporta SHS < 50% y ADN VALID, ejecutar directamente: `.\bin\logix.exe sync-context; .\bin\logix.exe takeover`.
   - **Protocolo de Silencio**: En estado nominal, omitir la creación de planes extensos y proceder directamente a la tarea activa.

2. **Detección de Deriva (Híbrida)**:
   - El comando `takeover` ahora es instantáneo (< 2s).
   - Si se detecta deriva crítica en archivos GOLD, el sistema mostrará un **Banner Visual ASCII** y Gobernanza UI lanzará un **Popup Persistente**.
   - En este caso, se requiere ejecutar `.\bin\logix.exe audit` para un diagnóstico profundo.

3. **Asimilación de Continuidad Cognitiva**:
   - Leer el mensaje del Agente Saliente (si existe) inyectado en el `relay`.
   - Incorporar la nota estratégica al contexto actual y reportarla al PO antes de iniciar el workflow `/act`.

4. **Activación Operativa**:
   - Una vez finalizado, transitar al workflow `/act` para desarrollo de tareas.
   - El sprint activo se muestra en task.md y backlog.json — verificar que coinciden.

