---
description: Gestión de deuda técnica y decisiones.
---

1. El sistema audita y bloquea Sprints si existen colisiones doctrinales o deuda técnica no gestionada.
2. Ejecutar `bin/logix compliance-check` para auditar el catálogo de deuda y colisiones con la doctrina global.

### Ejecución Automática
// turbo-all
1. Ejecutar la auditoría de compliance y deuda:
   ```bash
   bin/logix compliance-check
   ```
2. Consultar el estado operativo y saturación:
   ```bash
   bin/logix check
   ```
3. Analizar la sección `technical_debt` en `backlog.json` y resolver las tareas pendientes o en estado vencido.
4. Programar tareas de remediación dentro del backlog formal si es requerido.
