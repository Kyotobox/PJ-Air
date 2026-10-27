---
description: Proceso de auditoría de sprint para verificar integridad y contexto.
---

// turbo-all

1. **Sincronización y Validación de Tareas de Sprint**:
   ```bash
   bin/logix sync-tasks
   ```

2. **Auditoría de Integridad y Veracidad**:
   ```bash
   bin/logix audit
   ```

3. **Revisión**:
   - Verificar paridad entre `task.md` y `backlog.json`.
   - Confirmar que todas las tareas marcadas con [x] cuenten con pruebas ejecutadas y hash de veracidad.
