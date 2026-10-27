---
description: Cierre seguro de sesion con relay de continuidad.
---

> [!NOTE]
> **COMPATIBILIDAD MULTI-AGENTE (CODEX/GENÉRICA)**
> Si estás operando como un agente de terminal (Codex, Cursor, etc.), DEBES ejecutar `bin/logix handover` en tu shell para simular el comportamiento que Antigravity IDE haría nativamente.

// turbo-all

1. **Diagnóstico y Pulso Final**:
   ```bash
   bin/logix check
   bin/logix status
   ```

2. **Sincronizar y Sellar (QA Hard-Gate + Baseline RSA + Push Dinámico)**:
   ```bash
   bin/logix sync-tasks
   bin/logix baseline "Handover Seal"
   current_branch=$(git branch --show-current)
   if [ -n "$current_branch" ]; then git push origin "$current_branch"; else git push; fi
   ```
   - El exe emite el desafío RSA. El Gobernanza Agent firma. La sesión queda sellada en Git y sincronizada con el origen dinámico (`main`, `master` o rama activa).

3. **Bloquear para Takeover (Preservación Cognitiva y Desalojo de Beacon)**:
   ```bash
   bin/logix handover --note "Resumen estratégico de la sesión"
   ```
   - Resetea contadores y sella `session.relay`.
   - `ChatRelayService` captura automáticamente los últimos giros conversacionales (< 3.5 KB) en `vault/runtime/last_chat_context.md` y en `session.relay`.
   - **Liberación de Presence Beacon**: Libera el candado de presencia en `vault/runtime/session_beacon.json` para notificar a la flota (Discord/Automa) que el búnker queda libre (`IDLE`).
   - *(Opcional)* Si se desea forzar un ID de sesión: `bin/logix handover --conversation-id="<ID>" --note "..."`

4. **Post-Handover**: Iniciar nueva sesión de chat. Todo `/act` será bloqueado hasta `bin/logix takeover`.
