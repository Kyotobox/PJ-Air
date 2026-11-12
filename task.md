# SPRINT S80 - Sprint Activo
**Objetivo**: Eliminación Integral de Processing Fee por Tarjeta, Erradicación de Residuos en UI/Backend e Incremento de Precios de Catálogo (+3.5%)
**Fecha**: 2026-11-12

- [x] **TASK-80-01** [DATABASE/BACKUP] Respaldos integrales certificados de bases de datos SQLite en Producción, Testing y Local con verificación física de integridad (PRAGMA integrity_check)
- [x] **TASK-80-02** [BACKEND/FEES] Backend: Erradicación del fee por pago con tarjeta en FeeCalculatorService, payments.service.ts y orders.service.ts (0% / $0.00 para Stripe/Card sin recargos añadidos)
- [x] **TASK-80-03** [FRONTEND/CLEANUP] Frontend: Erradicación total de menciones (+3.5%), cálculo de fee y líneas de recargo de pasarela en Checkout, Órdenes, Detalle y Admin
- [x] **TASK-80-04** [DATA/CATALOG] Migración de Catálogo: Incremento determinista del 3.5% en todos los productos (ROUND(price * 1.035, 2)) en Producción, Testing y Local
- [x] **TASK-80-05** [DEPLOY/CERT] Certificación y Despliegue: Suites automatizadas Jest/Vitest (§6), compilación en limpio, push y recarga PM2 en VPS Testing y Producción
