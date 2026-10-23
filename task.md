# SPRINT S35 - Sprint 35: Suite de Pruebas de Borde Financieras, Tarjetas Rechazadas y Resiliencia del Cron
**Objetivo**: Evaluar y blindar el comportamiento del sistema ante escenarios extremos: tarjetas rechazadas o sin fondos en 1-Click checkout, fallos aislados en cobros nocturnos del cron, productos desactivados en suscripciones y ajustes de deuda por reembolsos.
**Fecha**: 2026-10-23

- [/] **TASK-35-01** [EDGE/STRIPE-FAILURES] Prueba de borde de rechazo de pago en 1-Click Checkout (tarjetas de test Stripe pm_card_chargeDeclinedInsufficientFunds y pm_card_threeDSecure2Required), verificando captura elegante del error en UI sin romper el carrito.
- [/] **TASK-35-02** [EDGE/CRON-RESILIENCE] Prueba de borde de cobros automáticos fallidos en el cron nocturno: aislamiento de fallos (una tarjeta rechazada marca payment_failed sin detener el lote), envío de alerta por correo y manejo de productos desactivados.
- [/] **TASK-35-03** [EDGE/B2B-CONCILIATION] Prueba de borde de liquidación parcial y desbordamiento de crédito B2B: verificación de recálculo exacto del saldo neto deudor tras reembolsos parciales y actualización del odómetro de balance en /admin/clients.
- [/] **TASK-35-04** [E2E/PLAYWRIGHT] Suite automatizada Playwright ejecutando los 3 casos de borde contra https://testing.jhoanes.com con capturas de pantalla de error controlado y certificación logix audit.
