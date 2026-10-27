---
description: Protocolo de Onboarding Soberano (Takeover). Sincroniza la sesión de la IA con el ADN del Búnker.
Regla: Toda comunicación con el usuario debe ser exclusivamente en español.
---

> [!NOTE]
> **COMPATIBILIDAD MULTI-AGENTE (CODEX/GENÉRICA)**
> Si estás operando como un agente de terminal (Codex, Cursor, etc.), DEBES ejecutar `bin/logix takeover` en tu shell para simular el comportamiento que Antigravity IDE haría nativamente.

0. **Sincronización Remota Pre-Flight (Tríada Distribuida - Local/Automa/Jules)**:
   - **Verificación de Oráculo Central**: Ejecutar `git -c http.timeout=10 fetch origin --quiet`.
   - **Fast-Forward Automático**: Si el árbol local está limpio y existen commits remotos (`behind > 0`, ej. PRs mergeados desde Discord o Jules), ejecutar `git pull --ff-only` para asimilar las actualizaciones antes de iniciar la sesión.
   - **Bloqueo por Divergencia**: Si existen cambios locales sin commit y la rama remota avanzó, **ABORTAR** la toma de posesión y emitir alerta de divergencia para evitar colisiones.
   - **Presence Beacon**: Marcar el búnker como ocupado localmente registrando `{ "active_runner": "local_ide", "locked_at": "<TIMESTAMP>" }` en `vault/runtime/session_beacon.json`.

1. **Sincronización Sónica (MANDATORIO)**:
   - **Anclaje de Búnker (Anti-Contaminación)**: Al iniciar la sesión, el Agente debe declarar explícitamente su contexto lógico leyendo `bunker_profile.json`. Cualquier archivo en la telemetría del IDE (Active Document) que no pertenezca a este búnker debe ser ignorado y catalogado como ruido cognitivo.
   - Si el búnker reporta SHS < 50% y ADN VALID, ejecutar directamente: `bin/logix sync-context && bin/logix takeover`.
   - **Protocolo de Silencio**: En estado nominal, omitir la creación de planes extensos y proceder directamente a la tarea activa.

2. **Detección de Deriva (Híbrida)**:
   - El comando `takeover` ahora es instantáneo (< 2s).
   - Si se detecta deriva crítica en archivos GOLD, el sistema mostrará un **Banner Visual ASCII** y Gobernanza UI lanzará un **Popup Persistente**.
   - En este caso, se requiere ejecutar `bin/logix audit` para un diagnóstico profundo.

3. **Asimilación de Continuidad Cognitiva (Ineludible)**:
   - Leer obligatoriamente el bloque `🧠 CONTEXTO CONVERSACIONAL PREVIO` emitido en consola por `takeover` (generado por `ChatRelayService` desde `last_chat_context.md` o reconstruido desde `session.relay`).
   - Retomar la conversación de forma continua respondiendo a la intención viva del usuario sin solicitar re-explicaciones.
   - Leer la nota estratégica del Agente Saliente (si existe) y reportar su asimilación al PO antes de iniciar el workflow `/act`.

4. **Activación Operativa**:
   - Una vez finalizado, transitar al workflow `/act` para desarrollo de tareas.
   - El sprint activo se muestra en task.md y backlog.json — verificar que coinciden.

