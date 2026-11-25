---
description: Invariantes esenciales y vacunas mecánicas para pj-air
trigger: always_on
---

# INVARIANTES FUNDAMENTALES DE NODO (pj-air)

1. **Zero UI Regex (SPA §58.2, §40)**: Prohibida la instanciación de RegExp en capas de presentación o widgets UI. Delegar el parsing al dominio.
2. **Pipeline Canónico Ineludible (§31, §58)**: Toda ingesta o transformación de datos debe canalizarse exclusivamente por el orquestador canónico. Prohibido el bypass.
3. **Pureza Arquitectónica (§39, §60.8)**: Cero acoplamiento o importaciones cruzadas directas sin pasar por packages/axioma o Synapse.
