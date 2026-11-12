# SPRINT S80 - Sprint Activo
**Objetivo**: Eliminación Integral de Processing Fee por Tarjeta, Erradicación de Residuos en UI/Backend e Incremento de Precios de Catálogo (+3.5%)
**Fecha**: 2026-11-12

- [x] **TASK-80-01** [DATABASE/BACKUP] Respaldos integrales certificados de bases de datos SQLite en Producción, Testing y Local con verificación física de integridad (PRAGMA integrity_check)
- [x] **TASK-80-02** [BACKEND/FEES] Backend: Erradicación del fee por pago con tarjeta en FeeCalculatorService, payments.service.ts y orders.service.ts (0% / $0.00 para Stripe/Card sin recargos añadidos)
- [x] **TASK-80-03** [FRONTEND/CLEANUP] Frontend: Erradicación total de menciones (+3.5%), cálculo de fee y líneas de recargo de pasarela en Checkout, Órdenes, Detalle y Admin
- [x] **TASK-80-04** [DATA/CATALOG] Migración de Catálogo: Incremento determinista del 3.5% en todos los productos (ROUND(price * 1.035, 2)) en Producción, Testing y Local
- [x] **TASK-80-05** [DEPLOY/CERT] Certificación y Despliegue: Suites automatizadas Jest/Vitest (§6), compilación en limpio, push y recarga PM2 en VPS Testing y Producción

# SPRINT S81 - Sprint Activo
**Objetivo**: Sincronización del Catálogo de Productos con Stripe Dashboard + Cron Diario
**Fecha**: 2026-11-12

- [x] **TASK-81-01** [BACKEND/ENTITY] Product entity: agregar columnas `stripe_product_id` y `stripe_price_id` (nullable). ALTER TABLE en local, testing y prod SQLite.
- [x] **TASK-81-02** [BACKEND/SERVICE] Crear `StripeProductSyncService` en `backend/src/products/stripe-product-sync.service.ts`: upsert de Stripe Product + Price por producto activo, actualización de IDs en BD.
- [x] **TASK-81-03** [BACKEND/CRON] Crear `backend/src/cron/stripe-sync.cron.ts`: cron `0 2 * * *` (America/New_York) que llama `syncAll()`.
- [x] **TASK-81-04** [BACKEND/MODULE] Registrar `StripeProductSyncService` en `ProductsModule`, importar `PaymentsModule` para `StripeService`. Registrar cron en `CronModule`.
- [x] **TASK-81-05** [BACKEND/TESTS] Unit tests: happy path (nuevo producto, mismo precio, precio cambiado) + sad path (Stripe falla → error aislado).
- [x] **TASK-81-06** [BACKEND/ENDPOINT] Endpoint admin `POST /admin/stripe/sync-catalog` para sync manual on-demand.
- [ ] **TASK-81-07** [DEPLOY/CERT] Build + Jest 100%, push a origin y upstream, deploy en testing y prod VPS, sync inicial de los 156 productos.
