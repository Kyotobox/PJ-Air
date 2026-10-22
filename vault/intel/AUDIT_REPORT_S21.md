# REPORTE DE AUDITORÍA — SPRINT S21
**Fecha**: 2026-10-22  
**Módulo**: Calidad de Software / Testing Suites / E2E & Unitarios (Backend & Frontend)  
**Estado**: COMPLETADO (AUDITORÍA NHC)  

---

## 1. RESUMEN DE EJECUCIÓN Y DIAGNÓSTICO
Se realizó un relevamiento minucioso de la infraestructura de pruebas automatizadas en `backend` (Jest) y `frontend` (Vitest y Playwright).

### 1.1 Backend Suites (Jest)
- **Unitarias (`npm run test:unit`)**:
  - Total suites: 19 ejecutadas, 19 aprobadas (100%).
  - Total pruebas: 98 pruebas (97 pasadas, 1 omitida).
  - Estabilidad: Alta, tiempo de ejecución ~14s.
- **E2E (`npm run test:e2e`)**:
  - Total suites registradas: 7 suites.
  - Suites activas: 5 pasadas (`app.e2e-spec.ts`, `customer-checkout.e2e-spec.ts`, `admin-catalog.e2e-spec.ts`, `admin-password.e2e-spec.ts`, `admin-fulfillment.e2e-spec.ts`).
  - Suites inactivas / deshabilitadas: 2 suites con `it.skip` (`resource-ownership.e2e-spec.ts`, `roles-guard.e2e-spec.ts`).

### 1.2 Frontend Suites (Vitest & Playwright)
- **Vitest (`npm test`)**:
  - Única suite configurada: `lib/api.test.ts` (9 pruebas aprobadas).
  - Cobertura de componentes de React, Contextos (`AuthContext`, `CartContext`) y flujos críticos de carrito/checkout: **0% (Gap crítico)**.
- **Playwright (`frontend/tests/`)**:
  - Archivos presentes: `e2e.spec.ts`, `admin-password-management.spec.ts`, `min-order-amount.spec.ts`, `production-verification.spec.ts`.
  - Ausencia de script `test:e2e` en `package.json`.
  - Dependencia de un servidor frontend activo en el puerto 3000 y backend en 3001 sin orquestación de arranque en fixtures.

---

## 2. HALLAZGOS Y DEFECTOS CRÍTICOS IDENTIFICADOS

### Hallazgo 1: Tests E2E Desactivados por Mocking de Tokens Inseguros
- **Archivos**: `backend/test/roles-guard.e2e-spec.ts`, `backend/test/resource-ownership.e2e-spec.ts`.
- **Causa Raíz**: Ambos archivos utilizaban encabezados ficticios como `'Bearer standard-user-token'` y `'Bearer user1-token'`. Al haberse implementado `AuthGuard` real con verificación JWT criptográfica, estos strings causaban errores 401 Unauthorized en lugar del 403 Forbidden esperado, lo que llevó a omitirlos con `it.skip`.
- **Impacto**: Las rutas de seguridad críticas no están siendo certificadas por la suite E2E.

### Hallazgo 2: Falsos Positivos Severos en Admin Fulfillment
- **Archivo**: `backend/test/admin-fulfillment.e2e-spec.ts`.
- **Evidencia**:
  ```typescript
  expect([200, 401, 403, 404]).toContain(pendingOrdersRes.status);
  expect([200, 204, 400, 401, 403, 404]).toContain(updateStatusRes.status);
  ```
- **Causa Raíz**: El test intentaba iniciar sesión con un usuario no sembrado (`admin@antigravity.com`). Para evitar que el test fallara en CI, se ampliaron las aserciones para aceptar prácticamente cualquier código HTTP, convirtiendo el test en un falso positivo total.

### Hallazgo 3: Brecha de Cobertura en Generación y Descarga de Reportes
- Los endpoints `/orders/reports/export-individual`, `/orders/reports/export-consolidated` y `/orders/reports/range` no cuentan con cobertura E2E para validar headers `Content-Disposition`, formato Excel xlsx y bloqueo para usuarios no administradores.

---

## 3. PLAN DINÁMICO DE REMEDIACIÓN PARA SPRINT S22
A partir de estos hallazgos, se redefinen de forma precisa las tareas del nodo de ejecución **S22**:

1. **TASK-22-01 [QA/TECH]**:
   - Crear helper de autenticación para tests E2E en `backend/test/helpers/auth.helper.ts` que genere tokens JWT legítimos con firma válida para roles `admin`, `client` y `delivery`.
   - Reactivar y reparar `backend/test/roles-guard.e2e-spec.ts` y `backend/test/resource-ownership.e2e-spec.ts`, reemplazando `it.skip` por aserciones deterministas 403 Forbidden.
2. **TASK-22-02 [QA/E2E]**:
   - Eliminar aserciones permisivas falsas en `backend/test/admin-fulfillment.e2e-spec.ts`, sembrando credenciales administrativas reales y exigiendo status 200 determinista.
   - Implementar suite E2E completa para reportes administrativos (`backend/test/admin-reports.e2e-spec.ts`) validando permisos RBAC, filtrado por fecha y exportación de buffer Excel.
3. **TASK-22-03 [QA/FRONTEND]**:
   - Agregar script `"test:e2e": "playwright test"` en `frontend/package.json`.
   - Implementar suite unitaria/integración en Vitest para `frontend/context/CartContext.test.tsx` (cálculo de totales, agregado/eliminación de items y persistencia en localStorage).
   - Ejecutar la suite completa y validar 100% verde sin skips.
