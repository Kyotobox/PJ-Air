# REPORTE DE REMEDIACIÓN — SPRINT S20
**Fecha**: 2026-10-22  
**Módulo**: Backend Core / Seguridad / Autenticación / RBAC  
**Estado**: COMPLETADO  

---

## 1. RESUMEN EJECUTIVO
Durante el Sprint S20 se ejecutó el plan de remediación de seguridad integral derivado de la auditoría S19:
1. **Desindexación y Protección de Secretos (TASK-20-01)**:
   - Desindexación de `.env` del repositorio Git (`git rm --cached .env`).
   - Inclusión obligatoria de `.env`, `**/.env*`, `.env.local` en `.gitignore`.
   - Eliminación total de credenciales SSH de root hardcodeadas en scripts de despliegue (`deploy-data.js`, `remote-backup-deploy.js`, `remote-deploy-only.js`, `remote-check-logs.js`, `remote-check-nginx.js`), exigiendo `process.env.REMOTE_SSH_PASSWORD`.
   - Validación estricta de `process.env.JWT_SECRET` en inicialización para entornos de producción, eliminando fallbacks inseguros.

2. **Control de Acceso y Prevención de IDOR (TASK-20-02)**:
   - Creación de `ResourceOwnershipGuard` para aislar el acceso horizontal entre usuarios.
   - Protección de `AddressesController` con `@UseGuards(AuthGuard)` y validación estricta de ownership en lectura, creación, actualización y eliminación de direcciones.
   - Protección de `OrdersController` con `@UseGuards(AuthGuard)`:
     - `GET /orders`: clientes estándar solo reciben sus propios pedidos; roles privilegiados (`admin`, `delivery`, `produccion`) acceden al listado completo.
     - `GET /orders/:id`: verificación de propiedad de pedido o rol operativo.
     - `PATCH /orders/:id` y `PATCH /orders/:id/status`: verificación de propiedad y autorización RBAC para mutaciones.
   - Activación de pruebas e2e de aislamiento (`should ensure users can only fetch and modify their own addresses`).

3. **Robustecimiento Criptográfico (TASK-20-03)**:
   - Mitigación de timing attacks en validación de firmas JWT utilizando `crypto.timingSafeEqual` con buffers.
   - Elevación del algoritmo de hash PBKDF2 a 210.000 iteraciones SHA-512 para nuevas contraseñas, manteniendo retrocompatibilidad constante para credenciales previas (1.000 iteraciones).
   - Verificación de suites de pruebas unitarias (19 suites / 97 pruebas aprobadas) y e2e completas.

---

## 2. MATRIZ DE CONTROL DE ACCESO (RBAC) REMEDIADA

| Recurso / Endpoint | Método | Autenticación | Control de Acceso / Propiedad |
| :--- | :--- | :--- | :--- |
| `/addresses` | POST | Requerida | Asociado al `userId` del token (o especificado si es admin) |
| `/addresses/user/:userId` | GET | Requerida | Solo el propio usuario o admin (`ResourceOwnershipGuard`) |
| `/addresses/:id` | PATCH/DELETE | Requerida | Solo el usuario propietario o admin |
| `/orders` | POST | Requerida | Creado a nombre del propio usuario o admin |
| `/orders` | GET | Requerida | Clientes: solo sus pedidos (`findByUser`); Admin/Delivery/Producción: global |
| `/orders/:id` | GET | Requerida | Solo el usuario propietario o roles autorizados |
| `/orders/:id` | PATCH | Requerida | Solo el usuario propietario o admin |
| `/orders/:id/status` | PATCH | Requerida | Propietario (cancelación) o roles operativos autorizados |
| `/orders/:id/assign` | PATCH | Requerida | Solo admin o produccion |
| `/orders/reports/*` | GET | Requerida | Solo admin (`Roles('admin')`) |

---

## 3. VERIFICACIÓN Y DETERMINISMO
- Tests Unitarios: 19/19 suites exitosas.
- Tests E2E: Suites de checkout de clientes, administración de catálogo y contraseñas ejecutadas con éxito.
- Cero contraseñas en texto claro en código fuente.
