# SPRINT S47 - Processing Fees Transversales
**Objetivo**: Implementar estructura unificada de Processing Fees por método de pago (Stripe 3.5%, ACH 0.8% tope $5.00, otros 0%), desglose dinámico en checkout, facturas y liquidación diferida de crédito.
**Estado**: En ejecución por Worker Automa (slot 1)

- [/] **TASK-47-01** [DOMAIN/FEE-CALCULATOR-SERVICE] Servicio determinista FeeCalculatorService con función pura calculateFee.
- [/] **TASK-47-02** [UI/CHECKOUT-FEES-BREAKDOWN] Desglose dinámico de comisiones en Checkout en tiempo real.
- [/] **TASK-47-03** [DOMAIN/CREDIT-SETTLEMENT-FEE] Aplicar fee en liquidación diferida de facturas a crédito.
- [/] **TASK-47-04** [DOMAIN/FEE-PERSISTENCE-AUDIT] Persistir fee_amount y fee_method en Order.
- [/] **TASK-47-05** [UI/INVOICE-DOWNLOAD-BREAKDOWN] Invoices descargables con desglose legal contable.
- [/] **TASK-47-06** [TEST/FEE-CALCULATOR-SUITE] Suite de pruebas unitarias para FeeCalculatorService (happy y sad paths).
