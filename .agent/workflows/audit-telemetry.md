---
description: Proceso de validación de telemetría y cálculos del dashboard.
---

// turbo-all

1. **Sincronizar y Consultar Estado de Gobernanza**:
   ```bash
   bin/logix status
   ```

2. **Consultar Odómetro y Rango Operativo**:
   ```bash
   bin/logix check
   ```

3. **Inspección de Pulso de Inteligencia**:
   ```bash
   if (Test-Path vault/intel/intel_pulse.json) { Get-Content vault/intel/intel_pulse.json | ConvertFrom-Json | Format-List }
   ```
