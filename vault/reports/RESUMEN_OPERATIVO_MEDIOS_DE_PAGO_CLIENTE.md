# MANUAL OPERATIVO ILUSTRADO: POLÍTICAS DE PRODUCCIÓN, MEDIOS DE PAGO Y REPORTES CONTABLES
**Jhoanes Wholesale & Bakery**  
**Audiencia**: Gerencia General, Administración, Tesorería, Facturación, Despacho y Clientes Mayoristas  
**Fecha de Emisión**: Noviembre 2026  
**Versión**: 3.0 (Manual Operativo 360° Ilustrado con Producción en Vivo)  

---

## 1. INTRODUCCIÓN Y ALCANCE
Este manual operativo ilustrado proporciona a la gerencia, al equipo de operaciones y a los clientes de **Jhoanes Wholesale** una guía visual y práctica sobre el funcionamiento integral del servicio: desde las políticas de horneado y calendario de entregas, hasta los canales de cobro, la conciliación de cheques, la facturación comercial con notas de crédito y el cierre contable automático diario.

---

## 2. POLÍTICAS DE PRODUCCIÓN, HORA DE CORTE Y CALENDARIO DE ENTREGAS

Para garantizar la frescura artesanal de los productos y la puntualidad en las rutas de distribución matutinas, Jhoanes Wholesale opera bajo reglas claras de planificación:

### A. Hora de Corte Diaria (Cutoff Time: 12:00 PM / Mediodía de Nueva York)
- **Pedidos antes de las 12:00 PM (T+2)**: Todo pedido confirmado antes del mediodía entra al ciclo de horneado regular y se programa para entrega en **48 horas hábiles** (ejemplo: un pedido colocado el miércoles a las 10:00 AM se entrega el viernes).
- **Pedidos después de las 12:00 PM (T+3)**: Los pedidos confirmados después de las 12:00 PM se consideran extemporáneos para el ciclo inmediato y se programan a **72 horas** (ejemplo: un pedido colocado el miércoles a las 2:00 PM se programa a partir del sábado).

### B. Política de "Martes Sin Despacho" (Mantenimiento Técnico de Hornos)
- **Día Inhábil de Entrega**: La panadería **NO realiza despachos los días martes**. Este día se destina a la higienización profunda de la planta, mantenimiento preventivo de hornos y calibración de maquinaria.
- **Salto Automático Inteligente**: Si la fecha calculada por el sistema (T+2 o T+3) coincide en martes, el calendario de checkout salta automáticamente al **miércoles (+1 día)** de forma transparente para el cliente.
- **Bloqueo Activo en Calendario**: Si el cliente intenta seleccionar manualmente un martes, el sistema bloquea la acción y le informa: *"Panadería Jhoanes no realiza entregas los días martes. Por favor selecciona a partir del miércoles"*.

### C. Monto Mínimo de Pedido Mayorista
- Para mantener la viabilidad logística de las rutas y ofrecer tarifas de flete preferenciales, el monto mínimo requerido para colocar un pedido mayorista es de **$500.00** (ajustable por administración en `/admin/settings`).

### D. Trazabilidad del Pedido y Confirmación de "Pedido Recibido"
En el portal del cliente ([`/orders`](file:///home/opc/code/pj-air/frontend/app/orders/page.tsx)), se puede monitorear en tiempo real cada fase:
$$\text{Pedido Enviado} \longrightarrow \text{En Producción (Horneado)} \longrightarrow \text{En Ruta} \longrightarrow \text{Pedido Recibido}$$
- Al momento de la entrega física por parte del chofer, el cliente dispone en su pantalla del botón **"Confirmar Pedido Recibido"**, cerrando formalmente el ciclo operativo de entrega.

---

## 3. POLÍTICA DE CANALES DE PAGO Y EXPERIENCIA DEL CLIENTE EN CHECKOUT

Jhoanes Wholesale opera bajo una política de transparencia comercial conforme a la normativa del Estado de Nueva York. Las comisiones bancarias y de pasarela se desglosan de forma individual y no son absorbidas en ventas mayoristas:

| Medio de Pago | ¿Cómo Paga el Cliente? | Costo / Comisión | Tiempo de Confirmación | ¿Qué Requiere de Administración? |
| :--- | :--- | :--- | :--- | :--- |
| **Tarjeta de Crédito / Débito** | En línea al confirmar el pedido (Visa, Mastercard, Amex). Canal público. | **3.5%** sobre el valor de los productos. | **Inmediato**: El cobro se procesa en segundos. | Ninguna acción manual. La orden pasa automáticamente a producción. |
| **Transferencia ACH (Bancaria Directa)** | En línea vinculando su cuenta corriente comercial (restringido a VIP / Autorizados). | **0.8%** (con **tope máximo de $5.00** por orden). | **3 a 5 días hábiles** para la liquidación efectiva en cuenta. | Verificación en extracto bancario en caso de devoluciones por cuenta sin fondos. |
| **Transferencia Zelle B2B** | Desde su banca móvil a `Chefjhoanes@gmail.com`. Canal público con comprobante. | **$0.00 (0% - Exento)**. | **Manual**: Sujeto a cotejo bancario del equipo de tesorería. | **Obligatorio**: Revisar el comprobante y aprobar o rechazar la orden en el panel. |
| **Cheque Comercial** *(Privado / Restringido)* | **NO es público en checkout**. Entrega física en ruta o tienda solo por clientes pre-autorizados. | **$0.00 (0% - Exento)**. | **+3 días hábiles** tras ser depositado en el banco. | **Gestión Interna**: Asignación manual del cheque a la orden, depósito y seguimiento a 3 días. |
| **Línea de Crédito Comercial B2B** | Compra con cargo a su cupo aprobado, pagadero a 7 días. Restringido a cuentas aprobadas. | **$0.00 (0% - Exento)**. | **Inmediato**: Siempre que no exceda su límite de crédito disponible. | Cobranza semanal o quincenal según acuerdo comercial. |
| **Notas de Crédito / Saldos a Favor** | Aplicadas por devoluciones, ajustes de inventario o modificaciones de orden. | **$0.00 (Deducción 1 a 1)**. | **Inmediato**: Resta directamente el saldo deudor de la factura. | Emisión de la nota desde el detalle de la orden con motivo formal. |

> [!IMPORTANT]
> **RESTRICCIÓN CORPORATIVA: EL PAGO POR CHEQUE NO ES PÚBLICO**  
> El pago mediante cheques comerciales está estrictamente restringido y **NO aparece como opción en el checkout público de la tienda web**. Constituye un acuerdo corporativo privado reservado exclusivamente para clientes mayoristas calificados y autorizados por la administración. Los pedidos de estos clientes se liquidan internamente cuando entregan el documento físico al chofer o en el mostrador.

### Pantalla 1: Selector de Métodos de Pago y Fecha de Entrega en el Checkout
El cliente mayorista visualiza la nota operativa de exclusión de martes, la primera fecha de entrega disponible según la hora de corte y los métodos de pago autorizados:

![Selector de Métodos en Checkout](../../ui_screenshots/audit_multichannel_01_checkout_methods.png)

> [!TIP]
> **Claridad Comercial**: Al seleccionar Tarjeta o ACH, el sistema calcula en tiempo real la comisión de procesamiento y la añade al resumen sin alterar el precio base de los productos de panadería.

---

## 4. PASARELA STRIPE: PAGOS CON TARJETA Y DÉBITO ACH

Cuando el cliente selecciona Tarjeta de Crédito/Débito o Débito ACH, el sistema despliega el modal interactivo de pago seguro:

### Pantalla 2: Modal de Pago Rápido y ACH
El modal permite guardar la tarjeta para futuros pedidos ("1-Clic Payment") o ingresar una nueva cuenta bancaria comercial:

![Modal de Pago Stripe](../../ui_screenshots/audit_multichannel_03_stripe_modal_tabs.png)

### Pantalla 3: Manejo de Fondos Insuficientes y Desafíos de Seguridad
Si una tarjeta es declinada o el banco del cliente exige verificación de seguridad en dos pasos (3D Secure), el sistema informa de inmediato sin congelar la pantalla:

![Validaciones Reactivas](../../ui_screenshots/audit_multichannel_04_edge_failures_3ds.png)

---

## 5. GESTIÓN Y CONCILIACIÓN DE PAGOS ZELLE B2B

El canal Zelle está diseñado para clientes que prefieren pagar vía transferencia bancaria sin pagar recargos de pasarela.

### A. Experiencia del Cliente al Subir Comprobante
El cliente visualiza la cuenta oficial de la empresa (`Chefjhoanes@gmail.com` / Jhoanes Bakery & Coffee) y debe completar dos campos obligatorios para poder confirmar su compra:
1. **Número de Referencia Bancaria**.
2. **Carga del archivo del comprobante** (captura de pantalla o PDF del banco).

### Pantalla 4: Formulario de Carga Zelle en Checkout
![Formulario Zelle](../../ui_screenshots/audit_multichannel_02_zelle_upload_validation.png)

### B. Visor Administrativo de Comprobantes en `/admin/orders`
La orden entra en el panel como *"Pendiente de Verificación Zelle"*. La administración puede ver la foto del comprobante y cotejarla con la cuenta bancaria de Jhoanes Bakery:

### Pantalla 5: Panel de Verificación Zelle para Tesorería
![Visor Administrativo Zelle](../../ui_screenshots/audit_multichannel_05_admin_zelle_verification.png)

### C. Procedimiento Operativo: Aprobar vs Rechazar
- **Aprobar Zelle**: Se confirma la recepción del dinero en la cuenta bancaria. Al hacer clic en *"Aprobar"*, el sistema marca la orden como *"Pagado"*, la transfiere automáticamente al horneado de cocina y le despacha al cliente su **Recibo de Compra**.
- **Rechazar Zelle**: Si la transferencia no existe, el monto es inferior o la referencia no concuerda:
  1. El operador hace clic en *"Rechazar Zelle"*.
  2. Escribe el motivo concreto (ej. *"Monto recibido $150 no coincide con el total de $285"*).
  3. **El sistema envía automáticamente un correo al cliente** con el motivo del rechazo y un botón para reintentar el pago o adjuntar un nuevo comprobante.

---

## 6. CONCILIACIÓN DE CHEQUES COMERCIALES (CANAL PRIVADO B2B AUTORIZADO)

> [!CAUTION]
> **POLÍTICA DE RIESGO: NO DISPONIBLE EN AUTOSERVICIO PÚBLICO**  
> El pago con cheque físico **NO es un método de pago público ni seleccionable en la tienda online**. Para proteger el flujo de caja de la panadería contra fraudes o falta de fondos de cuentas desconocidas, esta modalidad es un privilegio comercial que requiere aprobación expresa de la Gerencia en la ficha del cliente mayorista.

### A. Protocolo de Autorización y Recepción
1. **Calificación Previa**: La gerencia habilita a clientes corporativos recurrentes con historial crediticio intachable.
2. **Recepción Física**: El cliente autorizado entrega el cheque físico al chofer de despacho en su ruta matutina o en la recepción de la panadería, indicando el número de factura/pedido correspondiente.
3. **Registro Interno en Tesorería**: El equipo administrativo registra el documento en el sistema ingresando el **Número de Cheque**, **Banco Emisor**, **Monto Exacto** y **Fecha de Recepción**.

### Pantalla 6: Bandejas de Conciliación de Cheques en `/admin/orders`
El panel de administración permite supervisar el ciclo de vida del cheque a través de tres bandejas operativas:

![Conciliación de Cheques](../../ui_screenshots/audit_multichannel_06_admin_check_reconciliation.png)

### B. Ciclo de Vida y Reglas de Compensación
1. **Por Depositar (En Cartera)**: Cheques físicos en poder de tesorería que aún no han sido ingresados a la cuenta bancaria de la empresa.
2. **Depositados**: Una vez depositados en ventanilla o cajero empresarial, se marcan como *"Depositados"*. A partir de ese momento, el sistema activa una cuenta regresiva de **3 días hábiles bancarios** (*Clearance Deadline*), tiempo estándar en el que el banco liquida los fondos.
3. **Rebotados / Consecuencias Inmediatas**: Si el banco emisor rechaza el cheque por fondos insuficientes o cuenta cerrada:
   - Tesorería lo marca como *"Rebotado"* en el panel.
   - **Consecuencia Automática**: El sistema anula el pago registrado, restaura la deuda de la orden y **bloquea inmediatamente la cuenta del cliente**, revocándole el privilegio de pagar con cheque y suspendiendo cualquier línea de crédito activa hasta que salde la deuda con fondos certificados.

---

## 7. LÍNEAS DE CRÉDITO B2B Y SALUD FINANCIERA DEL CLIENTE

Los clientes con línea de crédito comercial aprobada pueden monitorear en todo momento el estado de su cuenta corriente desde su portal personal:

### Pantalla 7: Ficha de Salud Financiera en `/profile`
![Portal de Salud Financiera](../../ui_screenshots/audit_multichannel_09_profile_credit_portal.png)

> [!NOTE]
> **Alertas Preventivas de Crédito**:
> - Al superar el **80% del límite**, el sistema envía una alerta por correo para que el cliente planifique su próximo pago.
> - Si excede el 100% sin autorización de sobregiro, el sistema no permite colocar nuevos pedidos a crédito hasta que liquide las facturas pendientes.
> - El cliente dispone de un botón directo para acceder al **Portal de Facturación Stripe** y liquidar sus saldos en línea con tarjeta o ACH.

---

## 8. NOTAS DE CRÉDITO Y FACTURACIÓN COMERCIAL LEGAL

Toda devolución de mercancía, ajuste de precio o anulación genera una **Nota de Crédito oficial con folio correlativo** (`NC-YYYY-XXXX`).

### Pantalla 8: Factura Comercial con Desglose Fiscal Legal
Al imprimir o consultar la factura en `/orders/[id]`, se muestra el desglose completo exigido por las normas contables:

![Factura Comercial Legal](../../ui_screenshots/audit_multichannel_07_order_invoice_legal_breakdown.png)

### Componentes de la Factura Legal:
1. **Subtotal de Productos de Panadería**: Exentos de Sales Tax ST-120 según la normativa fiscal de alimentos en NYS.
2. **Delivery Fee**: Tarifa de transporte y logística.
3. **Processing Fee (Comisión Bancaria)**: Desglosada como cargo financiero separado (3.5% o 0.8% ACH).
4. **Nota de Crédito Formal (`NC-YYYY-XXXX`)**: Monto descontado de forma visible en color rojo con su respectivo motivo.
5. **Saldo Neto Exigible**: Valor final matemático que el cliente debe pagar tras deducir sus créditos.

---

## 9. INFORMES CONTABLES AUTOMÁTICOS Y CIERRE DIARIO

### A. Despacho Diario a las 23:59 NYS
Para asegurar un cierre contable sin trabajo manual nocturno, el sistema compila automáticamente todas las noches a las **11:59 PM (hora de Nueva York)** las ventas del día y despacha un archivo **Excel estructurado** por correo electrónico.

### Pantalla 9: Panel de Reportes y Exportación a Excel en `/admin/reports`
![Panel de Reportes Administrativos](../../ui_screenshots/audit_multichannel_08_admin_reports_excel.png)

### B. Configuración de Destinatarios en `/admin/settings`
La administración puede agregar, editar o remover los correos contables en cualquier momento:
1. Diríjase a [`/admin/settings`](file:///home/opc/code/pj-air/frontend/app/admin/settings/page.tsx).
2. Ubique la sección **"Informes Contables Automáticos"**.
3. Ingrese las direcciones deseadas separadas por coma (ejemplo: `accounting@jhoanes.com, gerencia@jhoanes.com`).
4. Presione **"Guardar Configuración"**.

---

## 10. RESUMEN DE BENEFICIOS OPERATIVOS PARA JHOANES WHOLESALE

1. **Previsibilidad en Cocina**: Regla estricta del corte a las 12:00 PM y exclusión de martes eliminan la improvisación y los pedidos de último minuto.
2. **Blindaje de Cobros**: Cero pérdidas en Zelle gracias a la obligatoriedad del comprobante y el visor de tesorería.
3. **Control Total de Cheques y Créditos**: Trazabilidad completa desde la recepción física del cheque hasta la compensación a 3 días, con bloqueo automático ante rebotes.
4. **Cierre Contable Sin Esfuerzo**: Reporte consolidado en Excel en la bandeja de entrada cada mañana a primera hora.
5. **Transparencia Fiscal Total**: Facturas con desglose legal y notas de crédito correlativas conforme a las leyes del Estado de Nueva York.
