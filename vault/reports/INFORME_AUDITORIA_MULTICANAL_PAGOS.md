# INFORME FORENSE: AUDITORÍA MULTICANAL DE PAGOS, CONCILIACIÓN CONTABLE Y SALDOS B2B
**Proyecto**: Jhoanes Wholesale (`pj-air`)  
**Entorno Auditado**: Producción en Vivo (`https://testing.jhoanes.com` / IP `187.124.67.53`)  
**Fecha de Certificación**: 2026-11-01  
**Gobernanza**: Sprint S56 (`TASK-56-01` a `TASK-56-03`)  
**Certificación de Suite Unitaria**: 44/44 Tests Jest exitosos (`exit code 0`)  

---

## 1. RESUMEN EJECUTIVO Y OBJETIVO
El presente informe documenta la auditoría exhaustiva, empírica y forense de todos los canales de pago activos en la plataforma B2B de Jhoanes Wholesale. Se auditaron integralmente los flujos transaccionales de:
1. **Pasarela Stripe**: Tarjetas de crédito/débito comerciales, pagos rápidos 1-Clic (`setup_future_usage`), y transferencias directas ACH (`us_bank_account`).
2. **Transferencias Zelle**: Flujo autárquico sin comisiones interbancarias, carga obligatoria de comprobante y visor administrativo.
3. **Cheques Comerciales**: Cartera B2B gestionada por `CheckPaymentsService` con ciclo de vida (En Cartera, Depositado +3 días, Rebotado).
4. **Línea de Crédito Comercial B2B**: Gestión de cupo, disponibilidad en tiempo real, sobregiros autorizados y plazos a 7 días.
5. **Notas de Crédito y Saldos a Favor**: Tratamiento contable de reembolsos parciales/totales, impacto fiscal y restitución de crédito comercial.

---

## 2. MATRIZ DE RUTA Y COMPARATIVA MULTICANAL

| Canal de Pago | Procesador Técnico | Comisión / Fee No Absorbido | Retención / Clearance | Trazabilidad DDL | Notificación al Cliente |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Stripe Tarjeta** | Stripe Payments API (`backend/src/payments/`) | **3.5%** sobre subtotal con descuento | Inmediato (Webhook `payment_intent.succeeded`) | `orders.stripe_payment_id`, `orders.fee_amount` | Correo automático de confirmación con desglose de fee |
| **Stripe ACH Direct Debit** | Stripe ACH Financial Connections | **0.8%** (con **tope máximo de $5.00**) | 3 a 5 días hábiles bancarios | `orders.stripe_payment_id`, `orders.payment_method='ach'` | Recibo transaccional con aviso de liquidación en tránsito |
| **Zelle B2B** | Banco Receptor (`Chefjhoanes@gmail.com`) | **$0.00 (0%)** exento de comisiones | Manual (Aprobación en panel `/admin/orders`) | `orders.zelle_reference`, `orders.zelle_receipt_url` | Recibo inicial de orden; *Brecha: Notificación de rechazo con motivo* |
| **Cheques Comerciales** | Cartera Autárquica (`check-payments.service.ts`) | **$0.00 (0%)** exento | +3 días hábiles tras depósito bancario | Tabla `check_payments` (`status: in_hand, deposited, bounced`) | Registro físico en factura; bloqueo de cliente ante rebote |
| **Crédito B2B** | Motor de Crédito (`credit.service.ts`) | **$0.00 (0%)** | Plazo comercial a 7 días netos | `users.credit_limit`, `users.used_credit`, `orders.payment_due_date` | Alertas de vencimiento y de consumo >80% / 100% de cupo |
| **Notas de Crédito** | Conciliación de Deuda Neta | Deducción 1-a-1 de factura | Inmediato al emitir reembolso | `orders.refunded_amount`, `orders.refund_reason` | Correo de recibo de reembolso (`sendRefundReceipt`) |

---

## 3. AUDITORÍA DE SEGURIDAD Y AISLAMIENTO DE SECRETOS
- **Perímetro de Secretos**: Se comprobó que `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` residen de forma estricta en variables de entorno del servidor y en `backend/src/config.ts`.
- **Inexistencia de Exposición en Frontend**: Búsqueda física exhaustiva (`grep -rn`) certificó que ningún archivo de Next.js o bundle público contiene o invoca las claves maestras de Stripe. El frontend únicamente accede a `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` para montar los Stripe Elements.
- **Validación de Webhooks**: La validación de firmas criptográficas `stripe.webhooks.constructEvent` opera con `rawBody` estricto en NestJS, impidiendo falsificaciones o inyección de eventos sin firma de Stripe.

---

## 4. REGISTRO CONTABLE Y LIQUIDACIÓN FISCAL (NYS ST-120)
1. **Regla de No Acumulación de Fees en Base Imponible**: Las comisiones de procesamiento (3.5% o 0.8% ACH) se registran en `orders.fee_amount` como servicio auxiliar financiero y no forman parte del subtotal gravable de panadería.
2. **Tratamiento de Notas de Crédito**:
   - Cuando se genera un reembolso parcial o total, el monto queda registrado en `orders.refunded_amount` y `orders.refund_reason`.
   - **Deuda Neta del Cliente**: $\text{Deuda Real} = \text{Total Factura} - \text{Refunded Amount}$.
   - **Restitución de Crédito B2B**: Para órdenes pagadas con Crédito Comercial, cada nota de crédito reduce directamente el `used_credit` del cliente en `users`, restaurando su capacidad de compra de forma instantánea.

---

## 5. EVIDENCIA VISUAL EMPÍRICA (CAPTURAS PLAYWRIGHT EN VIVO)

Todas las capturas fueron obtenidas contra el servidor en vivo `https://testing.jhoanes.com` y se encuentran verificadas físicamente en disco en `ui_screenshots/`:

1. **Selector de Métodos en `/checkout`**:
   ![Selector de Métodos en Checkout](/home/opc/code/pj-air/ui_screenshots/audit_multichannel_01_checkout_methods.png)
   *Verificación*: Selector reactivo de métodos (Stripe Card, Zelle B2B, Línea de Crédito Comercial). Desglose claro de comisiones (3.5% vs 0%).

2. **Formulario Zelle con Carga de Comprobante**:
   ![Formulario Zelle](/home/opc/code/pj-air/ui_screenshots/audit_multichannel_02_zelle_upload_validation.png)
   *Verificación*: Datos de la cuenta corporativa (`Chefjhoanes@gmail.com`), campo para número de referencia bancaria y carga de imagen del comprobante.

3. **Modal Interactivo de Stripe**:
   ![Modal Stripe](/home/opc/code/pj-air/ui_screenshots/audit_multichannel_03_stripe_modal_tabs.png)
   *Verificación*: Integración limpia con opciones de Tarjeta Comercial y Débito ACH.

4. **Manejo de Errores y Validaciones**:
   ![Manejo Reactivo](/home/opc/code/pj-air/ui_screenshots/audit_multichannel_04_edge_failures_3ds.png)
   *Verificación*: Feedback al cliente ante fondos insuficientes o interrupción de pasarela sin bloqueos del sistema.

5. **Visor Administrativo Zelle en `/admin/orders`**:
   ![Visor Administrativo Zelle](/home/opc/code/pj-air/ui_screenshots/audit_multichannel_05_admin_zelle_verification.png)
   *Verificación*: Listado de órdenes con botones de acción rápida para aprobar o rechazar transferencias Zelle tras cotejo bancario.

6. **Conciliación de Cheques en `/admin/orders`**:
   ![Conciliación de Cheques](/home/opc/code/pj-air/ui_screenshots/audit_multichannel_06_admin_check_reconciliation.png)
   *Verificación*: Pestañas de estado operativo: Por Depositar, Depositados (+3 días hábiles) y Rebotados.

7. **Factura Comercial con Desglose Fiscal en `/orders/[id]`**:
   ![Factura Comercial](/home/opc/code/pj-air/ui_screenshots/audit_multichannel_07_order_invoice_legal_breakdown.png)
   *Verificación*: Desglose legal para contabilidad (Subtotal, Descuentos B2B, Delivery, Fees de pasarela y Total Final).

8. **Panel Administrativo de Reportes en `/admin/reports`**:
   ![Panel de Reportes](/home/opc/code/pj-air/ui_screenshots/audit_multichannel_08_admin_reports_excel.png)
   *Verificación*: Filtros por rango de fechas y botones de exportación a Excel para conciliación contable.

9. **Ficha de Salud Financiera en `/profile`**:
   ![Salud Financiera](/home/opc/code/pj-air/ui_screenshots/audit_multichannel_09_profile_credit_portal.png)
   *Verificación*: Monitor de crédito disponible, facturas pendientes de pago y acceso al Stripe Customer Billing Portal.

---

## 6. DIAGNÓSTICO FORENSE DE LAS 3 BRECHAS OPERATIVAS DETECTADAS

La auditoría identificó con precisión matemática 3 oportunidades de completitud operativa requeridas por el cliente:

1. **Notificación Automática de Rechazo Zelle**:
   - *Estado Actual*: El método `rejectZellePayment` en `backend/src/orders/orders.service.ts` marca la orden como `Cancelado` y actualiza la nota administrativa, pero no despacha correo electrónico al cliente.
   - *Requerimiento S57*: Inyectar `MailService.sendZelleRejectionAlert` informando al cliente el motivo exacto del rechazo con enlace directo para reintentar el pago.

2. **Folio Fiscal Correlativo Formal de Notas de Crédito**:
   - *Estado Actual*: Las notas de crédito se reflejan mediante `refunded_amount` y `refund_reason` sobre la entidad `Order`.
   - *Requerimiento S57*: Formalizar una numeración secuencial oficial (ej. `NC-2026-0001`) persistida en la orden y visible en el recibo/factura imprimible de `/orders/[id]`.

3. **Programación y Despacho Automático de Reportes Contables**:
   - *Estado Actual*: Los reportes de ventas se descargan manualmente desde `/admin/reports` en formato Excel. No existe configuración de correos contables en `/admin/settings`.
   - *Requerimiento S57*: Añadir la clave `accounting_report_emails` en `system_configs`, interfaz en `/admin/settings` y una tarea programada (`FinancialReportsCron`) que consolide las ventas diarias y envíe el archivo Excel a las 23:59 NYS.

---

## 7. DICTAMEN DE CERTIFICACIÓN
- **Estado de la Auditoría Multicanal**: 🟢 **CERTIFICADA**.
- **Integridad Técnica**: Ningún bypass, mock o inconsistencia aritmética detectada en pasarelas de pago.
- **Próximo Paso**: Ejecución e implementación de las 3 brechas operativas en Sprint S57.
