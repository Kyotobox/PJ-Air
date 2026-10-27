---
description: Cierre seguro de sesion con relay de continuidad.
---

> [!NOTE]
> **COMPATIBILIDAD MULTI-AGENTE (CODEX/GENÉRICA)**
> Si estás operando como un agente de terminal (Codex, Cursor, etc.), DEBES ejecutar `.\bin\logix.exe handover` en tu shell para simular el comportamiento que Antigravity IDE haría nativamente.

// turbo-all

1. **Generar Relays y Pulso Final**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File vault/ops-heartbeat.ps1 -Chat
   powershell -ExecutionPolicy Bypass -File vault/ops-relay.ps1
   ```
   - Genera `vault/brain/SESSION_RELAY_TECH.md` (contexto técnico para siguiente IA).
   - Genera `vault/brain/SESSION_RELAY_PO.md` (resumen natural para el PO).

2. **Actualizar Dashboard Final**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File vault/ops-dashboard.ps1
   ```

3. **Sincronizar y Sellar (QA Hard-Gate + Baseline RSA)**:
   ```powershell
   .\bin\logix.exe sync-tasks
   .\bin\logix.exe baseline "Handover Seal"
   ```
   - El exe emite el desafío RSA. El Gobernanza Agent firma. La sesión queda sellada en Git.

4. **Bloquear para Takeover**:
   ```powershell
   .\bin\logix.exe handover
   ```
   - Resetea contadores. Crea session.lock con status HANDOVER_SEALED.

5. **Post-Handover**: Iniciar nueva sesión de chat. Todo `/act` será bloqueado hasta `.\bin\logix.exe takeover`.

