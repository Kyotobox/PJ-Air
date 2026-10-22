# SPRINT S30 - Sprint 30: Auditoría Transversal del Sistema de Crédito B2B, Notificaciones y Límite Forense
**Objetivo**: Implementar disparadores automáticos de alertas de crédito y certificar mediante suite E2E Playwright el ciclo de vida de crédito, bloqueo por límite, sobregiros autorizados y liberación de cupos en testing.
**Fecha**: 2026-11-10

- [ ] **TASK-30-01** [NOTIFICATIONS/TECH] Conexión del disparador automático sendCreditAlert en OrdersService ante pedidos en sobregiro y umbrales de cupo.
- [ ] **TASK-30-02** [CREDIT/E2E] Suite E2E Playwright del ciclo de checkout a crédito (flujo feliz sin Stripe, bloqueo 400 por cupo insuficiente y sobregiro administrativo con override).
- [ ] **TASK-30-03** [ADMIN/RECONCILIATION] Auditoría interactiva de liberación y restauración de cupos desde /admin (marcado de órdenes pagadas y cancelaciones).
- [ ] **TASK-30-04** [GOV/BASELINE] Validación de regresión completa, auditoría de integridad logix audit y certificación baseline.
