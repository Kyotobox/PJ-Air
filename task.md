# SPRINT S32 - Sprint 32: Cobranza Digital de Cartera B2B, Enlaces de Liquidación y Reembolsos en Stripe
**Objetivo**: Acelerar el flujo de caja mayorista permitiendo el cobro y liquidación digital de órdenes a crédito mediante enlaces y facturas de Stripe, y dotar al panel administrativo de emisión de reembolsos totales y parciales en 1 clic.
**Fecha**: 2026-10-23

- [x] **TASK-32-01** [BACKEND/SETTLEMENT-REFUNDS] Endpoints en PaymentsService para liquidación de cartera a crédito (createSettlementLink) y emisión de reembolsos totales/parciales en Stripe (createRefund) con webhooks.
- [x] **TASK-32-02** [ADMIN/REFUNDS-UI] Módulo de gestión de reembolsos en /admin/orders/[id] con modal interactivo de monto total/parcial, motivo de ajuste comercial y actualización del badge financiero.
- [x] **TASK-32-03** [CLIENT/SETTLEMENT-UI] Botón de "Pagar Factura en Línea" en /orders/[id] para órdenes a crédito pendientes y acción "Enviar Enlace de Cobro" en /admin/clients con liberación inmediata de cupo al conciliar.
- [/] **TASK-32-04** [E2E/GOV] Suite automatizada Playwright en testing del flujo de liquidación de crédito, emisión de reembolso parcial/total, verificación bilingüe y auditoría logix audit.
