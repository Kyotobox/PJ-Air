# MANUAL OPERATIVO: GESTIÓN DE MEDIOS DE PAGO, CONCILIACIÓN Y REPORTES CONTABLES
**Jhoanes Wholesale & Bakery**  
**Audiencia**: Gerencia General, Administración, Tesorería y Servicio al Cliente  
**Fecha de Emisión**: Noviembre 2026  
**Versión**: 1.0 (Comercial / No Técnica)  

---

## 1. INTRODUCCIÓN Y ALCANCE
El presente documento describe el funcionamiento operativo integral del sistema de cobros de **Jhoanes Wholesale**. Su propósito es servir como guía clara para la administración y el equipo de operaciones sobre cómo se procesan las ventas, cómo se concilian los diferentes métodos de pago, qué notificaciones reciben los clientes y cómo se gestionan los reportes contables diarios.

---

## 2. POLÍTICA DE CANALES DE PAGO Y COMISIONES

Jhoanes Wholesale opera bajo una política de transparencia comercial conforme a la normativa del Estado de Nueva York. Las comisiones bancarias y de pasarela se desglosan de forma individual y no son absorbidas en ventas mayoristas:

| Medio de Pago | ¿Cómo Paga el Cliente? | Costo / Comisión | Tiempo de Confirmación | ¿Qué Requiere de Administración? |
| :--- | :--- | :--- | :--- | :--- |
| **Tarjeta de Crédito / Débito** | En línea al confirmar el pedido (Visa, Mastercard, Amex). | **3.5%** sobre el valor de los productos. | **Inmediato**: El cobro se procesa en segundos. | Ninguna acción manual. La orden pasa automáticamente a producción. |
| **Transferencia ACH (Bancaria Directa)** | En línea vinculando su cuenta corriente comercial (exclusivo VIP/Autorizados). | **0.8%** (con **tope máximo de $5.00** por orden). | **3 a 5 días hábiles** para la liquidación efectiva en cuenta. | Verificación en extracto bancario en caso de devoluciones por cuenta sin fondos. |
| **Transferencia Zelle B2B** | Desde su banca móvil a `Chefjhoanes@gmail.com`. | **$0.00 (0% - Exento)**. | **Manual**: Sujeto a cotejo bancario del equipo de tesorería. | **Obligatorio**: Revisar el comprobante y aprobar o rechazar la orden en el panel. |
| **Cheque Comercial** | Cheque físico entregado al chofer en ruta o en el mostrador. | **$0.00 (0% - Exento)**. | **+3 días hábiles** tras ser depositado en el banco. | Registrar número de cheque, depositar en banco y marcar fecha en el sistema. |
| **Línea de Crédito Comercial B2B** | Compra con cargo a su cupo aprobado, pagadero a 7 días. | **$0.00 (0% - Exento)**. | **Inmediato**: Siempre que no exceda su límite de crédito disponible. | Cobranza semanal o quincenal según acuerdo comercial. |
| **Notas de Crédito / Saldos a Favor** | Aplicadas por devoluciones, ajustes de inventario o modificaciones de orden. | **$0.00 (Deducción 1 a 1)**. | **Inmediato**: Resta directamente el saldo deudor de la factura. | Emisión de la nota desde el detalle de la orden con motivo formal. |

---

## 3. FLUJOS OPERATIVOS PASO A PASO

### A. Operación de Pagos con Zelle
1. **Acción del Cliente**: Al seleccionar "Transferencia Zelle B2B" en el checkout, el sistema le muestra los datos de la cuenta receptora oficial (`Chefjhoanes@gmail.com` / Jhoanes Bakery & Coffee). Es obligatorio que el cliente ingrese el **Número de Referencia Bancaria** y adjunte la **foto o captura del comprobante**.
2. **Recepción en Panel**: La orden entra en estado de pago *"Pendiente de Verificación Zelle"*.
3. **Decisión de Tesorería en `/admin/orders`**:
   - **Si el dinero está en la cuenta**: La administración hace clic en **"Aprobar Zelle"**. El estado pasa a *"Pagado"*, la orden avanza a la cocina y el cliente recibe su **Recibo de Compra Oficial** por correo.
   - **Si la transferencia no existe o el monto no coincide**: La administración hace clic en **"Rechazar Zelle"** e ingresa la razón (ej. *"Referencia no aparece en el extracto del día"* o *"El comprobante pertenece a otra fecha"*).
4. **Notificación Automática de Rechazo**:
   - El sistema pausa la orden para proteger a la panadería.
   - Envía un correo electrónico automático al cliente explicándole de forma respetuosa y clara el motivo del rechazo.
   - El correo incluye un botón directo para que el cliente pueda reintentar el pago, subir un nuevo comprobante o pagar con tarjeta.

---

### B. Conciliación de Cheques Comerciales
Para los clientes mayoristas autorizados a pagar mediante cheque, el panel de administración cuenta con tres bandejas operativas:
1. **Por Depositar (En Cartera)**: Cheques físicos recibidos de los choferes o en tienda que aún no han sido llevados al banco.
2. **Depositados**: Cheques ingresados en cuenta bancaria. Durante los siguientes **3 días hábiles** permanecen en tránsito hasta su compensación definitiva.
3. **Rebotados / Consecuencias**: Si un cheque es devuelto por falta de fondos, la administración lo marca como *"Rebotado"*. De inmediato:
   - Se anula el recibo de pago y se restablece la deuda completa del cliente.
   - El sistema suspende temporalmente la opción de pago con cheque para ese cliente hasta que regularice su situación con tesorería.

---

### C. Línea de Crédito Comercial y Alertas Preventivas
- **Cálculo de Disponibilidad**: Cada vez que un cliente a crédito coloca una orden, el sistema valida que:
  $$\text{Deuda Pendiente} + \text{Nueva Orden} \le \text{Límite de Crédito Aprobado}$$
- **Alertas Automáticas de Cupo**:
  - Al superar el **80% del límite**, el sistema envía un correo preventivo al cliente avisándole que su cupo está por agotarse para que programe sus pagos.
  - Si intenta comprar por encima del límite sin autorización expresa, el pedido se bloquea y se le invita a liquidar facturas pendientes o solicitar una extensión de crédito a la gerencia.
- **Cobranza de Facturas Vencidas**: Todas las mañanas a las 9:00 AM, el sistema revisa si hay facturas con más de 7 días sin pagar y envía un recordatorio automático con un botón de pago directo en línea.

---

### D. Notas de Crédito y Folio Fiscal
- **Generación Formal**: Toda devolución o ajuste de precio genera un folio correlativo oficial (ej. `NC-2026-0001`).
- **Impacto Financiero**:
  - Si la orden fue pagada con tarjeta, se procesa el reembolso bancario correspondiente.
  - Si la orden era a crédito, el monto de la nota de crédito se resta automáticamente de la deuda del cliente, liberando su cupo comercial de inmediato sin esperar cierres de mes.
- **Factura Comercial Imprimible**: En la factura formal de cada pedido, la Nota de Crédito se desglosa en rojo con su respectivo folio y motivo, mostrando con total claridad el **Saldo Neto Exigible** que el cliente debe pagar.

---

## 4. INFORMES CONTABLES AUTOMÁTICOS Y CIERRE DIARIO

### A. Despacho Diario a las 23:59 (NYS)
Para eliminar la carga manual de generar reportes al final del día, el sistema ejecuta un proceso automático todas las noches a las **11:59 PM (hora de Nueva York)**:
1. Recopila todas las órdenes colocadas o entregadas en el día.
2. Genera un archivo en **Excel estructurado** con el resumen consolidado:
   - Ventas totales por canal (Stripe, Zelle, Cheques, Crédito).
   - Comisiones de pasarela retenidas o facturadas.
   - Descuentos comerciales aplicados a clientes B2B.
   - Notas de crédito emitidas y devoluciones.
3. Envía el archivo Excel adjunto por correo electrónico a la lista de destinatarios configurada.

### B. ¿Cómo Configurar los Correos de Contabilidad?
La gerencia o administración puede modificar en cualquier momento quién recibe estos reportes diarios:
1. Ingrese al panel administrativo en [`/admin/settings`](file:///home/opc/code/pj-air/frontend/app/admin/settings/page.tsx).
2. Ubique la tarjeta **"Informes Contables Automáticos"**.
3. Ingrese el correo o correos electrónicos deseados separados por coma (ejemplo: `accounting@jhoanes.com, gerencia@jhoanes.com`).
4. Haga clic en **"Guardar Configuración"**.

---

## 5. RESUMEN DE BENEFICIOS OPERATIVOS

1. **Cero Fugas de Dinero**: Ninguna orden Zelle entra a producción sin comprobante verificado por un humano.
2. **Claridad para el Cliente**: Ante rechazos de pago o avisos de crédito, el cliente recibe explicaciones claras y enlaces de acción inmediata, reduciendo llamadas de reclamo.
3. **Paz Mental Contable**: Toda mañana el departamento contable encuentra en su bandeja de entrada el Excel consolidado con el cierre exacto de la jornada previa.
4. **Cumplimiento Legal y Transparencia**: Desglose claro de comisiones bancarias y notas de crédito con folios oficiales válidos para auditorías o balances fiscales.
