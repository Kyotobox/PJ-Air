# AUDITORÍA DE SEGURIDAD, CONTROL DE ACCESO Y FUGAS — SPRINT S19
**Fecha de Ejecución**: 2026-10-30  
**Proyecto**: pj-air (Jhoanes Bakery)  
**Versión de Gobernanza**: 4.0.0  
**Alcance**: Backend NestJS, Frontend Next.js, Scripts de Despliegue y Repositorio Git  
**Protocolo**: NHC (No Hagas Cambios — Diagnóstico Forense Puro)  

---

## 1. Resumen Ejecutivo
Durante el Sprint S19 se llevó a cabo un escaneo forense integral de seguridad, control de acceso y riesgos de fuga de información en el sistema `pj-air`. La auditoría identificó vulnerabilidades críticas en el manejo de secretos en scripts de infraestructura, exposición de rutas transaccionales sin validación de propiedad de recurso (BOLA/IDOR), debilidades en el ciclo de vida criptográfico de tokens JWT y omisión de guards en controladores clave.

---

## 2. Hallazgos por Dimensión de Seguridad

### DIMENSIÓN 1: Fuga de Secretos y Variables de Entorno (Regla 11.3)
- **VULN-19-01 [CRÍTICA] — Credenciales SSH de Producción Hardcodeadas en Scripts**:
  - **Archivos Afectados**:
    - `backend/scripts/remote-backup-deploy.js` (L9)
    - `backend/scripts/remote-deploy-only.js` (L7)
    - `backend/scripts/deploy-data.js` (L9)
    - `backend/scripts/remote-check-logs.js` (L7)
    - `backend/scripts/remote-check-nginx.js` (L7)
  - **Evidencia**: Se identificó la IP pública `187.124.67.53`, usuario `root` y contraseña de texto plano `o7BR&vX+F2;wqYye` configuradas como valor de respaldo predeterminado en scripts de Node.js rastreados por Git.
  - **Impacto**: Acceso root irrestricto al servidor host de producción si el repositorio se comparte o expone.

- **VULN-19-02 [ALTA] — Archivo `.env` Rastreado en Git y Ausencia en `.gitignore`**:
  - **Evidencia**: `.env` existe físicamente y se encuentra rastreado en el árbol de Git (`git ls-files .env` confirma seguimiento activo). El archivo `.gitignore` raíz no incluye la entrada `.env` ni `**/.env*`.
  - **Impacto**: Cualquier credencial o clave de API añadida al archivo `.env` local es susceptible de ser confirmada al historial público/privado de Git.

- **VULN-19-03 [ALTA] — Fallback Inseguro de Clave Secreta JWT**:
  - **Archivo Afectado**: `backend/src/auth/crypto.util.ts` (L3).
  - **Evidencia**: `const JWT_SECRET = process.env.JWT_SECRET || 'jhoanes-bakery-super-secret-key-change-in-production';`. En `.env` no existe la clave `JWT_SECRET`, por lo que el backend opera con la clave simétrica pública por defecto.
  - **Impacto**: Cualquier actor malicioso que conozca el código puede forjar tokens JWT válidos con rol `admin` y usurpar cualquier cuenta del sistema sin conocer su contraseña.

- **VULN-19-04 [MEDIA] — Credenciales de Semilla Débiles en Devtools**:
  - **Archivo Afectado**: `backend/src/devtools/devtools.service.ts` (L30, L61).
  - **Evidencia**: Las cuentas de prueba y desarrollo se crean con contraseñas estáticas `123123`.

---

### DIMENSIÓN 2: Control de Acceso, Guards y BOLA / IDOR (Broken Object Level Authorization)
- **VULN-19-05 [CRÍTICA] — BOLA / IDOR en `OrdersController`**:
  - **Endpoints Afectados**:
    - `GET /orders`: No tiene `AuthGuard`. Cualquier cliente anónimo puede listar el historial de pedidos completo de todos los clientes.
    - `GET /orders/:id`: No tiene `AuthGuard` ni verificación de pertenencia (`req.user.id === order.user_id`). Cualquier usuario puede inspeccionar pedidos ajenos manipulando el UUID `:id`.
    - `GET /orders/user/:userId`: No tiene `AuthGuard`. Permite enumerar pedidos de cualquier usuario indicando su ID en la URL.
    - `POST /orders`: No tiene `AuthGuard`. El campo `userId` se extrae libremente del body JSON (`const { userId, ...orderData } = body`), permitiendo colocar pedidos a nombre de terceros.
    - `PATCH /orders/:id/assign`: No tiene `AuthGuard` ni `RolesGuard`. Cualquier usuario puede reasignar repartidores.
    - `PATCH /orders/:id`: Tiene `AuthGuard`, pero carece de `ResourceOwnershipGuard` o verificación de rol `admin`. Un cliente autenticado común puede alterar items, montos y estados de pedidos de otros usuarios.

- **VULN-19-06 [CRÍTICA] — BOLA / IDOR Total en `AddressesController`**:
  - **Endpoints Afectados**:
    - `POST /addresses`: Sin `AuthGuard`. Asigna direcciones a cualquier `userId`.
    - `GET /addresses/user/:userId`: Sin `AuthGuard`. Expone direcciones físicas, coordenadas GPS y notas privadas de cualquier cliente.
    - `PATCH /addresses/:id` y `DELETE /addresses/:id`: Sin autenticación ni validación de propiedad. Permite modificar o eliminar ubicaciones guardadas de clientes ajenos.

- **VULN-19-07 [MEDIA] — Endpoint de Avatar Desprotegido en `UsersController`**:
  - **Endpoint Afectado**: `POST /users/:id/avatar`.
  - **Evidencia**: No cuenta con `AuthGuard`. Un atacante puede sobreescribir el avatar de cualquier usuario arbitrario pasando su ID.

---

### DIMENSIÓN 3: Ciclo de Vida de JWT y Debilidad Criptográfica
- **VULN-19-08 [ALTA] — Ausencia de Mecanismo de Revocación de Sesión (Blacklist)**:
  - **Diagnóstico**: Los tokens JWT y de refresco (`signJwt`) son emitidos como artefactos autocontenidos sin registro de persistencia en base de datos.
  - **Impacto**: Si un token es interceptado o un usuario cierra sesión o cambia su contraseña, los tokens emitidos previamente continúan siendo válidos hasta expirar (24 horas para access token, 7 días para refresh token).

- **VULN-19-09 [MEDIA] — Comparación no Determinista de Firma HMAC (Timing Attack)**:
  - **Archivo Afectado**: `backend/src/auth/crypto.util.ts` (L54).
  - **Evidencia**: `if (encodedSignature !== expectedSignature) return null;` utiliza comparación estándar de strings (`!==`) en lugar de `crypto.timingSafeEqual`, exponiendo la verificación a ataques por análisis de tiempo de respuesta.

- **VULN-19-10 [MEDIA] — Baja Densidad de Iteraciones en PBKDF2**:
  - **Archivo Afectado**: `backend/src/auth/crypto.util.ts` (L15, L22).
  - **Evidencia**: Se emplean 1,000 iteraciones de PBKDF2-SHA512.
  - **Impacto**: La norma OWASP y NIST recomienda un mínimo de 210,000 iteraciones para SHA-512. Mil iteraciones resulta insuficiente ante ataques de fuerza bruta acelerados por GPU.

---

### DIMENSIÓN 4: Sanitización de Entradas, SQL Injection y Carga de Archivos
- **EVAL-19-01 [APROBADO] — Resistencia a SQL Injection en Capa de Datos**:
  - **Diagnóstico**: Las consultas nativas en `products.service.ts` y el generador de consultas `createQueryBuilder` en `orders.service.ts` emplean parámetros ligados (`?` y `:start`, `:end`, `:userId`). No se encontraron concatenaciones de cadenas de usuario en cláusulas SQL.

- **VULN-19-11 [MEDIA] — Omisión de Validación Estricta por Tipos DTO**:
  - **Diagnóstico**: A pesar de contar con `ValidationPipe({ whitelist: true })` en `main.ts`, múltiples endpoints en `orders.controller.ts`, `addresses.controller.ts` y `users.controller.ts` declaran `@Body() body: any`. Sin una clase DTO con decoradores `class-validator`, `whitelist: true` no puede filtrar parámetros extraños o no autorizados.

- **VULN-19-12 [MEDIA] — Ausencia de Inspección de Magic Bytes en `/products/upload-image`**:
  - **Diagnóstico**: La validación de archivos en Multer se limita a comprobar la extensión de `file.originalname` y el encabezado `file.mimetype` enviado por el cliente.
  - **Impacto**: No se valida la cabecera real de bytes mágicos de la imagen ni se inspecciona el contenido contra scripts políglotas o vectores SVG/HTML embebidos.

---

## 3. Matriz de Prioridad y Severidad

| ID | Vulnerabilidad / Riesgo | Severidad | Vector / OWASP |
| :--- | :--- | :--- | :--- |
| **VULN-19-01** | Root SSH credentials expuestas en scripts de despliegue | 🔴 CRÍTICA | A07:2021 Identification & Authentication Failures |
| **VULN-19-02** | Archivo `.env` rastreado y ausencia en `.gitignore` | 🔴 ALTA | A05:2021 Security Misconfiguration |
| **VULN-19-03** | Fallback de `JWT_SECRET` a clave conocida por defecto | 🔴 CRÍTICA | A02:2021 Cryptographic Failures |
| **VULN-19-05** | BOLA / IDOR en `OrdersController` (GET, POST, PATCH) | 🔴 CRÍTICA | A01:2021 Broken Access Control |
| **VULN-19-06** | BOLA / IDOR en `AddressesController` sin autenticación | 🔴 CRÍTICA | A01:2021 Broken Access Control |
| **VULN-19-08** | Inexistencia de revocación o lista negra de JWT | 🟡 ALTA | A07:2021 Identification & Authentication Failures |
| **VULN-19-09** | Comparación no constante en firma HMAC | 🟡 MEDIA | A02:2021 Cryptographic Failures |
| **VULN-19-10** | Iteraciones insuficientes en PBKDF2 (1,000 iteraciones) | 🟡 MEDIA | A02:2021 Cryptographic Failures |
| **VULN-19-11** | Parámetros `@Body() body: any` eludiendo `ValidationPipe` | 🟡 MEDIA | A03:2021 Injection |
| **VULN-19-12** | Carga de imágenes sin validación de Magic Bytes | 🟡 MEDIA | A04:2021 Insecure Design |

---

## 4. Hoja de Ruta para Remediación (Sprint S20)
Para el Sprint S20 (Hardening y Remediación de Seguridad), se recomienda la siguiente secuencia de ejecución:
1. **TASK-20-01 [SEC/CLEAN]**: Eliminar `.env` del índice de Git (`git rm --cached .env`), agregar `**/.env*` a `.gitignore`, sanitizar scripts de despliegue para usar variables de entorno del sistema (`process.env.REMOTE_SSH_PASSWORD`) y requerir obligatoriamente `JWT_SECRET` en arranque.
2. **TASK-20-02 [SEC/RBAC]**: Implementar `ResourceOwnershipGuard` o control a nivel de servicio para pedidos (`req.user.id === order.user_id || req.user.role === 'admin'`), proteger todos los métodos de `OrdersController` y `AddressesController` con `AuthGuard`.
3. **TASK-20-03 [SEC/CRYPTO]**: Incorporar `crypto.timingSafeEqual` en verificación de firma JWT, aumentar iteraciones PBKDF2 a 210,000+ y crear DTOs de tipado fuerte con `class-validator` para reemplazar los usos de `any` en cuerpos de petición.
