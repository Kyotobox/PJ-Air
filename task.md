# SPRINT S43 - Sprint 43: Purga de Pedidos Futuros y Fundación de Crédito a 7 Días
**Objetivo**: Eliminar el subsistema obsoleto de pedidos futuros/recurrentes y establecer el modelo de datos y lógica base de crédito a 7 días calendario con métodos de consulta de saldo y límites.
**Fecha**: 2026-10-28

- [ ] **TASK-43-01** [CLEAN/CHECKOUT-PURGE] Eliminar checkbox de pedido recurrente y estados asociados en checkout/page.tsx.
- [ ] **TASK-43-02** [CLEAN/ROUTES-PURGE] Eliminar vistas obsoletas /orders/scheduled y /admin/standing-orders y sus enlaces de navegación.
- [ ] **TASK-43-03** [CLEAN/BACKEND-SCHEDULED-PURGE] Migración para eliminar tabla scheduled_orders y purgar entidad ScheduledOrder, servicio y controlador en backend NestJS.
- [ ] **TASK-43-04** [DOMAIN/CREDIT-DUE-DATE-CORE] Modelar cálculo determinista de payment_due_date = created_at + 7 días (ISO YYYY-MM-DD) para órdenes a crédito en backend.
- [ ] **TASK-43-05** [DOMAIN/CREDIT-SERVICE-REFACTOR] Estandarizar métodos getAvailableCredit, getUsedCredit y getCreditLimit en backend con cálculo estricto de deuda neta.
- [ ] **TASK-43-06** [TEST/CREDIT-AND-PURGE-REGRESSION] Suite de pruebas unitarias para CreditService (happy path y sad paths de sobregiro) y certificación de no regresiones tras la purga.
- [ ] **TASK-43-07** [DEPLOY/TESTING-SYNC] Compilación limpia, verificación de integridad y despliegue sincronizado en testing.jhoanes.com.
