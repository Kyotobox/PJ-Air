# SPRINT S77 - Blindaje de Integridad Financiera y Pasarela Stripe

**Objetivo**: Prevenir de forma definitiva discrepancias entre cotización de flete, total de orden y cobro en Stripe en checkout, forzar validación del monto en backend desde la base de datos, conciliar estados de pago en confirmación y ajustar el saldo pendiente del pedido afectado.
**Fecha**: 2026-11-11

- [x] **TASK-77-01** [TASK] Frontend: Corrección de falso positivo en `api.ts` (retornar `null` ante respuesta HTTP 200 vacía), validación estricta de `resolvedZone?.id` en `checkout/page.tsx`, y envío forzoso del `order.total` devuelto por el backend al invocar `/payments/create-intent`.
- [x] **TASK-77-02** [TASK] Backend: Blindaje en `payments.service.ts` para fijar y validar el monto del PaymentIntent directamente desde `order.total` / saldo en BD cuando existe `orderId`, y verificación en `orders.controller.ts` (`PATCH /orders/:id/payment-status`) comprobando contra Stripe si el cobro cubre el total (degradando a `partially_paid` con `pending_balance` ante montos menores).
- [/] **TASK-77-03** [TASK] Certificación: Tests automatizados con Happy y Sad path (§6), compilación física, despliegue a testing y producción VPS, y ajuste del saldo pendiente ($625.00) en la orden `060d13ad-4c6b-414c-9692-7a7bc41431ee`.
