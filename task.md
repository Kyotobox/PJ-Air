# SPRINT S41 - Sprint 41: Verificación Telefónica SMS OTP con Firebase en Registro B2B y Modificación de Perfil
**Objetivo**: Implementar la verificación de identidad telefónica mediante SMS OTP de 6 dígitos con Firebase Authentication (Free Tier) tanto en el registro B2B inicial como en la edición de número de teléfono en /profile, con soporte para números de prueba y preservación de cuenta ante cancelaciones.
**Fecha**: 2026-10-25

- [x] **TASK-41-01** [DOMAIN/PHONE-AUTH-CORE] Integración de Firebase Admin en backend NestJS, columna phone_verified en Profile y endpoint POST /api/auth/verify-phone-token para certificar el token emitido por Firebase.
- [x] **TASK-41-02** [UI/FIREBASE-PHONE-CLIENT] Configuración del cliente Firebase Web SDK en frontend/lib/firebase.ts con reCAPTCHA invisible y fallback graceful si faltan credenciales en .env.
- [x] **TASK-41-03** [UI/REGISTER-SMS-OTP] Modal emergente de verificación SMS OTP en /auth/register: envío de código de 6 dígitos al teléfono ingresado, verificación atómica y feedback visual de confirmación.
- [x] **TASK-41-04** [UI/PROFILE-PHONE-CHANGE-GUARD] Guardarraíl en /profile: detección de mutación en el campo de teléfono, despliegue de modal OTP para el nuevo número y persistencia en backend solo tras verificación exitosa.
- [x] **TASK-41-05** [E2E/PHONE-AUTH-REGRESSION] Suite de pruebas unitarias y Playwright con números de prueba de Firebase (+1 305 555 0100 -> 123456), sad paths (código incorrecto, reintento expirado, cancelación de modal) y certificación logix audit.
