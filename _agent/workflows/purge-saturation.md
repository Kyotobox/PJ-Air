---
description: Protocolo de Purga proactiva de Saturación (NUCLEUS-V9)
---

Este flujo automatiza la purga de saturación cuando se detecta un SHS mayor al 85% o fallos de compilación por procesos bloqueados.

1. Identificar señales de saturación y lógica de nodo:
   - SHS >= 85% en `gov status`.
   - Error de compilación por `dart.exe` o `flutter.exe` en uso.
   - CUS > 40%.
   - **En Servidor Oracle (tiene `lib/`)**: Ejecutar limpieza profunda de compilación.
   - **En Nodos Fleet (solo `bin/`)**: Omitir purga de artefactos. Solo ejecutar `gov purge`.

2. Ejecutar limpieza de infraestructura:
   // turbo
   - `Remove-Item -Recurse -Force .dart_tool, build, pubspec.lock -ErrorAction SilentlyContinue`

3. Terminar procesos colgados:
   // turbo
   - `taskkill /F /IM dart.exe /T`
   - `taskkill /F /IM flutter.exe /T`

4. Resetear Gobernanza:
   // turbo
   - `.\bin\logix.exe purge`

5. Sincronizar (Si es necesario):
   // turbo
   - `dart pub get`

6. Verificar estado:
   - `gov status` debe mostrar CUS: 0.0% y SHS < 85%.

7. Registrar la acción:
   - Añadir entrada en `PROJECT_LOG.md` bajo el tag `[PURGE]`.
