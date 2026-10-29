# SPRINT S44 - Sprint 44: Cobranza Automatizada y Comunicación
**Objetivo**: Automatizar la gestión de vencimientos de crédito con notificaciones multicanal (Email y SMS Twilio preparado), cron diario a las 9 AM NY y badges visuales de estado financiero.
**Fecha**: 2026-10-29

- [x] **TASK-44-01** [DOMAIN/CRON-OVERDUE-CORE] Cron job diario a las 9:00 AM (America/New_York) para consultar órdenes vencidas.
- [x] **TASK-44-02** [DOMAIN/MAIL-OVERDUE-TEMPLATE] Plantilla HTML responsive invoice_overdue.html y método sendOverdueInvoiceAlert en MailService.
- [x] **TASK-44-03** [DOMAIN/SMS-TWILIO-MODULE] Módulo SmsService con integración Twilio y guardarraíl estricto SMS_ENABLED=false.
- [x] **TASK-44-04** [DOMAIN/MULTICHANNEL-DISPATCH] Orquestación en el Cron diario para disparo de Email y SMS diferido.
- [x] **TASK-44-05** [UI/FINANCIAL-STATUS-BADGES] Badges visuales de estado de crédito en /orders y /admin/orders.
- [x] **TASK-44-06** [TEST/CRON-AND-SMS-SUITE] Suite de pruebas unitarias para el Cron de cobranza y sad path para SmsService.
- [x] **TASK-44-07** [DEPLOY/TESTING-SYNC] Compilación limpia de frontend y backend, verificación de integridad y sincronización de backlog.
