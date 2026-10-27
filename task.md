# SPRINT S42 - Sprint 42: Hard Gate de Verificación Telefónica SMS OTP en Registro Mayorista B2B y Blindaje de Endpoints
**Objetivo**: Convertir la verificación telefónica SMS OTP en un requisito mandatorio (Hard Gate) e inviolable para el alta de cuentas comerciales B2B, bloqueando la creación de usuarios en backend ante la ausencia de token de verificación y deshabilitando la sumisión en frontend hasta certificar el número.
**Fecha**: 2026-10-27

- [x] **TASK-42-01** [DOMAIN/BACKEND-HARD-GATE] Endurecimiento del endpoint POST /auth/signup en NestJS: rechazo mandatorio con 400 Bad Request si una cuenta B2B (client) intenta registrarse sin verificación telefónica comprobable (phone_verified y token de verificación válidos).
- [x] **TASK-42-02** [UI/REGISTER-HARD-GATE] Bloqueo estricto en frontend (RegisterForm.tsx y /auth/register/page.tsx): deshabilitar el botón de envío y alertar visualmente al usuario mayorista de que la verificación SMS OTP de 6 dígitos es obligatoria para la apertura de cuenta comercial.
- [x] **TASK-42-03** [TEST/SAD-PATH-HARD-GATE] Ampliación de la suite de pruebas unitarias (auth.service.spec.ts) y E2E (phone-auth.e2e-spec.ts): validar sad paths de intento de bypass en API sin verificación y certificar happy path con token Firebase/test token.
- [x] **TASK-42-04** [DEPLOY/TESTING-REMOTE-SYNC] Despliegue atómico en el servidor remoto de pruebas (testing.jhoanes.com), compilación de artefactos, reinicio de PM2 y comprobación empírica en vivo del Hard Gate (bloqueo sin SMS y aprobación con SMS).
