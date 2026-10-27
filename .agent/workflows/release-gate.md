---
description: Workflow de certificación de calidad y bloqueo en Core para transiciones a Producción.
---

1. **Inspección de Perfil y Detección de Stack**:
   - Inspeccionar `bunker_profile.json` en la raíz del repositorio para determinar la tecnología del nodo:
     - Si `bunker_type` es `HUB`, `role` es `KERNEL_HUB`, o el stack es Pure Dart (§39):
       ```bash
       dart test --coverage=coverage
       dart analyze > lints.txt
       ```
     - Si el stack es Flutter:
       ```bash
       flutter test --coverage
       flutter analyze > lints.txt
       ```
     - Si el stack es Python:
       ```bash
       pytest --cov=.
       flake8 > lints.txt
       ```
     - Si no está explícito en `bunker_profile.json`:
       Ejecutar `bin/logix check` y resolver por presencia de `pubspec.yaml` (Pure Dart / Flutter) o `pyproject.toml` / `requirements.txt` (Python).

2. **Detección de Deuda Técnica (TODOs / FIXMEs)**:
   ```bash
   Get-ChildItem -Path lib,src,app -Recurse -Include *.dart,*.py,*.ts -ErrorAction SilentlyContinue | Select-String -Pattern '// TODO|// FIXME|# TODO|# FIXME' | Measure-Object | Select-Object -ExpandProperty Count
   ```

3. **Invocación del Oráculo Smart**:
   - Recopilar las métricas en formato JSON y sustituirlas en el template.
   - Usar `vault/intel/templates/RELEASE_CERT_TEMPLATE.md` para solicitar a Smart el sello de calidad.

4. **Aplicación del Bloqueo Físico (Gate)**:
   - Si Smart emite `RECHAZADO`, registrar el incidente en `vault/runtime/purgatory_ledger.json` y detener el workflow.
   - Si Smart emite `APROBADO`, notificar al PO y estampar la firma de release en `vault/runtime/signature.json`.
