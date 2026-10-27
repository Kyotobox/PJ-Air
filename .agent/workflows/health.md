---
description: Ejecuta la certificacion de coherencia y salud del sistema.
---

// turbo-all

1. **Ejecutar Verificación de Rango Operativo y Salud**:
   ```bash
   bin/logix check
   ```

2. **Auditoría de Cumplimiento y Coherencia Doctrinal**:
   ```bash
   bin/logix compliance-check
   ```

3. **Auditoría de Gobernanza y Estado de ADN**:
   ```bash
   bin/logix audit
   ```

4. **Acción ante Drift**:
   - Si existen discrepancias (archivos de fundación modificados), se recomienda realizar un `bin/logix baseline "Auto-reparación"` si son cambios legítimos, o revertirlos si no lo son.
