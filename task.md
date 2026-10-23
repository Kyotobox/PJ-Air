# SPRINT S34 - Sprint 34: Pedidos Recurrentes Programados (Standing Orders B2B) y Suscripciones Mayoristas
**Objetivo**: Automatizar la compra periódica de panadería fresca para restaurantes y hoteles mediante pedidos programados semanales con generación de órdenes y cobro automático recurrente.
**Fecha**: 2026-10-23

- [ ] **TASK-34-01** [BACKEND/SUBSCRIPTIONS] Modelo de datos ScheduledOrder, cron nocturno en NestJS para generación automática de pedidos periódicos y cobro off-session o cargo a línea de crédito.
- [ ] **TASK-34-02** [CLIENT/SCHEDULED-UI] Interfaz en cliente para convertir carrito en pedido fijo semanal, selección de días de entrega (Lunes, Miércoles, etc.) y gestión de pedidos programados (pausar/editar).
- [ ] **TASK-34-03** [ADMIN/CALENDAR-UI] Calendario administrativo de proyección semanal de producción para horneados en base a pedidos recurrentes y bitácora de ejecuciones del cron.
- [ ] **TASK-34-04** [E2E/GOV] Suite E2E Playwright de ciclo de vida de pedidos programados, simulación de despacho automático, auditoría de integridad y sellado final.
