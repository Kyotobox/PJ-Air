# SPRINT S101 - Blindaje Financiero y Operativo de Órdenes
**Objetivo**: Erradicar fuga de flete en reintentos de checkout, anulación de flete manual admin, inflación de Store Credit y permitir adición de SKUs en órdenes pagadas con trazabilidad contable.
**Fecha**: 2026-11-20

- [x] **TASK-101-01** [TASK] Blindaje de regla de flete complementario ($0.00) contra reintentos de checkout en orders.service.ts
- [x] **TASK-101-02** [TASK] Precedencia de flete manual admin sobre tarifa de perfil VIP en orders.service.ts y /admin/orders/new
- [x] **TASK-101-03** [TASK] Aislamiento estricto de Store Credit en ajustes de orden e incidencias en delivery-incidents.service.ts y orders.service.ts
- [x] **TASK-101-04** [TASK] Soporte de adición de nuevos SKUs en órdenes preexistentes y cobro de delta en expediente admin
- [x] **TASK-101-05** [TASK] Widget de auditoría y trazabilidad de liquidación / flete en detalle de orden (/admin/orders/[id]/page.tsx)
- [x] **TASK-101-06** [TASK] Suite de pruebas automatizadas con Sad Paths (§6), build limpio y certificación de sprint
