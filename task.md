# SPRINT S37 - Sprint 37: Ecosistema Integral de Correos Transaccionales B2B, Notificaciones Administrativas y Plantillas de Reembolso
**Objetivo**: Conectar y blindar el ciclo completo de notificaciones por correo: recibos automáticos al cliente por compras de contado y crédito, alertas operativas de nuevos pedidos para producción y ventas, comprobantes de reembolso contable y confirmaciones de suscripciones semanales, con tolerancia a fallos cuando las credenciales SMTP estén en espera.
**Fecha**: 2026-10-23

- [x] **TASK-37-01** [MAIL/ORDER-RECEIPTS] Conectar sendOrderReceipt en OrdersService.create (crédito) y en PaymentsService.handleWebhook (Stripe), garantizando despacho asíncrono no bloqueante tolerante a fallos de SMTP.
- [x] **TASK-37-02** [MAIL/ADMIN-ALERTS] Implementar sendAdminNewOrderAlert en MailService y dispararlo ante cada nuevo pedido (directo o del cron) para notificar al equipo de panadería sobre producción y horneados requeridos.
- [x] **TASK-37-03** [MAIL/REFUND-AND-SUBSCRIPTIONS] Implementar plantillas y métodos sendRefundReceipt (comprobante de devolución en createRefund) y sendStandingOrderConfirmation (resumen de suscripción semanal en ScheduledOrdersService).
- [x] **TASK-37-04** [E2E/RESILIENCE-BASELINE] Suite de pruebas unitarias y de integración de correos en mail.service.spec.ts, verificación de resiliencia con fallback a Ethereal, logix sync-tasks y auditoría logix audit.
