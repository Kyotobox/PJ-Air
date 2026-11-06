# SPRINT S61 - Sprint Activo
**Objetivo**: Reportes y Filtros Basados en Fecha de Despacho/Entrega (Admin, Producción, Pedidos y Estado de Cuenta B2B)
**Fecha**: 2026-11-04

- [x] **TASK-61-01** [TASK] Refactorizar findInRange en orders.service.ts para consultar y filtrar pedidos primariamente por order.delivery_date (con fallback seguro a created_at)
- [x] **TASK-61-02** [TASK] Actualizar excel.service.ts (exportIndividual y exportConsolidated) para incluir y resaltar columna y metadato de Fecha de Despacho/Entrega
- [x] **TASK-61-03** [TASK] Ajustar vistas admin/reports y produccion/reports: filtros y selectores por Fecha de Despacho y visualización de entrega en tablas y cards
- [x] **TASK-61-04** [TASK] En admin/orders/page.tsx: filtro de fechas Desde/Hasta por delivery_date y adición de columna/dato visible de Fecha de Entrega en tabla de pedidos
- [x] **TASK-61-05** [TASK] Ajustar b2b-statement-helper.ts y modal de Estado de Cuenta B2B en orders/page.tsx: filtros y exportaciones PDF/Excel basados en Fecha de Despacho
- [x] **TASK-61-06** [TASK] Suite de pruebas de certificación unitaria y de integración para filtrado y reportes por fecha de despacho (happy y sad path)
