---
description: Flujo guiado para la cosecha formal de componentes (Harvest) desde satélites hacia Shared Kernel o Nexus.
Regla: Toda comunicación con el usuario debe ser exclusivamente en español.
---

// Protocolo de Cosecha Formal (/harvest)

1. **Validación Arquitectónica (PREVENTIVO)**:
   - **Multiplicidad**: Confirmar que el componente será utilizado por al menos 2 nodos independientes (ej. Pilot y Ruedas).
   - **Pureza de Dominio**: Verificar que el componente NO mezcla lógica de presentación (UI, `print()`) con reglas de negocio.
   - **Aislamiento (Stateless)**: Validar que no depende de singletons del ciclo de vida del nodo de origen.
   - *Si falla alguna de las reglas anteriores, abortar la cosecha (Fatal Drift).*

2. **Extracción y Testing (MANDATORIO)**:
   - Migrar o implementar el código del componente en el paquete base correspondiente (`packages/axioma` u otro).
   - Crear una suite de pruebas unitarias (`test/`) exhaustiva, cubriendo obligatoriamente *Happy Paths* y *Sad Paths*.
   - Ejecutar `dart test` en el paquete destino para certificar la integridad de la extracción empíricamente. No se permite omitir tests.

3. **Indexación Post-Cosecha (ARCH/NEXUS)**:
   - Ejecutar el automatismo de indexación: `bin/logix harvest index`.
   - Validar las capacidades expuestas mediante `bin/logix nexus` o inspeccionando los contratos en `packages/axioma/lib/`.
   - Si se genera el reporte auxiliar `vault/intel/nexus_catalog_report.json`, verificar su consistencia de forma declarativa e idempotente sin dependencias bloqueantes de archivos huérfanos.

4. **Sincronización Final**:
   - Registrar el progreso de la cosecha en la bitácora local (`task.md`).
   - Transitar al workflow `/act` para continuar el desarrollo, o notificar al usuario sobre el éxito de la cosecha.
