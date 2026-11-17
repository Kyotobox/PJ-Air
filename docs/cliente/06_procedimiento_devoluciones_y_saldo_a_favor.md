# Procedimiento Operativo Estandarizado (SOP)
## Gestión de Incidencias en Entrega, Mercancía Faltante y Saldo a Favor B2B (Store Credit)

* **Código de Documento:** `SOP-LOG-006`
* **Versión:** `2.0.0` (Revisión No Fiscal — Modelo Gift Card / Store Credit)
* **Empresa:** Jhoanes Bakery (`app.jhoanes.com`)
* **Fecha de Emisión:** Noviembre 2026
* **Ámbito de Aplicación:** Logística, Reparto en Ruta, Clientes Mayoristas B2B, Cocina/Producción y Administración.

---

## 1. Objetivo y Principio Rector

### 1.1 Objetivo
Estandarizar el tratamiento operativo, comercial y de experiencia de cliente ante cualquier discrepancia entre lo ordenado y lo recibido (faltantes de cocina, rotura en transporte o defectos de calidad), asegurando una resolución ágil, cordial y sin fricción.

### 1.2 Principio Rector: Cero Reintegros Monetarios y Desvinculación Fiscal Absoluta
Para garantizar la retención de valor dentro de Jhoanes Bakery y evitar complejidades contables o tributarias:

> [!IMPORTANT]
> **Carácter Estrictamente Comercial (No Fiscal / Sin Notas de Crédito):**
> Este procedimiento **NO genera Notas de Crédito fiscales ni altera facturas (Invoices) ya emitidas**. La factura original del pedido permanece 100% inalterada para efectos de contabilidad e impuestos (Sales Tax).
>
> La compensación opera bajo el modelo de **Store Credit / Tarjeta de Saldo a Favor** (similar a la emisión de una Gift Card o billetera virtual de cortesía). El saldo otorgado se redime exclusivamente como método de pago parcial o total en la siguiente compra en línea.

---

## 2. Catálogo de Incidencias Admisibles

| Código | Categoría | Descripción Operativa | Evidencia Requerida |
| :--- | :--- | :--- | :--- |
| **INC-01** | **Faltante de Cocina (Shortage)** | Producto que no se horneó o no se despachó desde planta por capacidad o stock. | Comanda física de despacho con el ítem marcado como no entregado. |
| **INC-02** | **Daño en Tránsito (Quebrado / Aplastado)** | Croissants o panes aplastados, rotos o deformados durante el trayecto en el vehículo. | Fotografía nítida del producto dañado dentro de su caja o bandeja original. |
| **INC-03** | **Defecto de Calidad / Horneado** | Producto fuera de estándar visual o de textura (quemado, crudo o deformación severa). | Fotografía comparativa o detalle del producto defectuoso. |
| **INC-04** | **Error de Despacho (Ítem Equivocado)** | Se entregó una referencia distinta a la solicitada por el cliente. | Fotografía de la etiqueta y del producto recibido erróneamente. |

> [!WARNING]
> **Perecibilidad y Ventana Horaria:** Al tratarse de panadería artesanal fresca horneada a diario, los productos recibidos conforme y almacenados en el local no admiten reclamos posteriores. Las incidencias deben reportarse en los tiempos estipulados en este protocolo.

---

## 3. Canales de Reporte y Flujo de Detección

```
                  ┌───────────────────────────────┐
                  │ ¿Cómo se detecta la novedad? │
                  └───────────────┬───────────────┘
                                  │
          ┌───────────────────────┴───────────────────────┐
          ▼                                               ▼
[CANAL A: Chofer en Ruta]                     [CANAL B: Cliente B2B]
• Entrega presencial diurna.                  • Entrega nocturna (3:00 AM con llave/código).
• Cotejo conjunto con el cliente.             • Cliente abre su negocio por la mañana.
• Foto a comanda o producto.                  • Reporta en portal antes de las 10:00 AM.
          │                                               │
          └───────────────────────┬───────────────────────┘
                                  ▼
                   [ADMINISTRACIÓN PJ-AIR]
                   • Valida fotos y cantidades.
                   • Emite el Store Credit (SAF).
                   • Dispara la Tarjeta Digital al cliente.
```

### 3.1 Canal A: Reporte por el Chofer en Ruta (Entrega Presencial)
1. Durante la entrega presencial diurna, el chofer y el cliente verifican las cajas contra la comanda física.
2. Si falta producto o hay piezas dañadas, se anota en la comanda con nombre del receptor.
3. El chofer toma fotografía de la comanda firmada y del producto dañado.
4. El chofer notifica de inmediato a Administración/Despacho antes de cerrar su ruta.
5. El chofer retira las unidades dañadas para registro de merma de ruta (o procede al descarte autorizado).

### 3.2 Canal B: Reporte Directo por el Cliente (Entregas Nocturnas 3:00 AM)
1. En entregas nocturnas desatendidas (3:00 AM con llave o clave de acceso), el chofer deja el pedido en el lugar convenido (mostrador o refrigerador) con su foto de fachada/acceso.
2. Al iniciar operaciones en la mañana, el cliente inspecciona su pedido.
3. **Plazo límite de reporte:** El cliente tiene como plazo máximo las **10:00 AM del mismo día de entrega** para reportar desde su portal en [app.jhoanes.com](https://app.jhoanes.com).
4. El cliente entra a su sección de órdenes (`/orders/[id]`) y pulsa **"Reportar Incidencia / Faltante"**:
   * Selecciona el producto afectado de la lista de su pedido.
   * Indica las unidades faltantes o dañadas.
   * Selecciona el motivo (`Faltante`, `Quebrado/Dañado`, `Calidad`, `Producto Erróneo`).
   * Adjunta fotografía obligatoria del producto o caja.
   * Envía la solicitud para revisión.

---

## 4. Gestión Administrativa y Emisión de Saldo a Favor

Una vez validada la incidencia por Administración en `/admin/orders`:

### 4.1 Emisión del Saldo a Favor (Store Credit)
1. El Administrador localiza la orden afectada y abre la opción **"Emitir Saldo a Favor (Store Credit)"**.
2. Completa los datos:
   * **Producto afectado:** Selecciona la línea de producto.
   * **Cantidad:** Unidades no conformes.
   * **Motivo:** Categoría de la incidencia.
   * **Evidencia fotográfica:** Se enlaza la foto del chofer o del cliente.
   * **Monto a Acreditar:** El sistema calcula `Cantidad × Precio Unitario Pactado`.
3. Al confirmar:
   * **Abono a Billetera Virtual:** Se suma directamente a `User.credit_balance`.
   * **Asignación de Folio Comercial:** Se genera un número de voucher interno (ej. `SAF-2026-0042` o `SC-2026-0042`).
   * **Registro de Auditoría:** Queda grabado en la bitácora (`admin_audit_logs`) con fecha, hora y responsable.

---

## 5. Notificación al Cliente: Estilo "Gift Card / Store Credit"

En lugar de un correo tipo factura o invoice formal, el cliente recibe una **notificación visual amigable con formato de Tarjeta Digital de Saldo a Favor (Gift Card)**:

### 5.1 Diseño y Contenido de la Tarjeta Digital
* **Asunto:** `🎉 Tienes $XX.XX de Saldo a Favor disponible para tu próxima orden | Jhoanes Bakery`
* **Estilo Visual:** Tarjeta gráfica destacada (estilo monedero digital / gift card con branding de Jhoanes Bakery).
* **Monto Destacado:** `+$14.00 USD en Saldo a Favor`.
* **Código de Voucher:** `#SAF-2026-0042`.
* **Mensaje de Cortesía:**
  > *"Lamentamos el inconveniente con tu entrega de hoy. Hemos acreditado de forma inmediata **$14.00 USD** a tu cuenta por concepto de: **4 Croissants de Almendras (Dañados en tránsito)**."*
* **Evidencia Adjunta:** Miniatura de la fotografía del reporte para total transparencia.
* **Tu Nuevo Saldo Total Acumulado:** `$14.00 USD disponibles`.
* **Botón de Acción (Call to Action):**
  * `[ Realizar mi Próxima Orden con Descuento ]`
* **Nota Explicativa:** *"No necesitas ingresar ningún código. Este saldo se aplicará automáticamente como descuento en tu resumen de pago al ordenar en app.jhoanes.com."*

---

## 6. Redención Automática en la Siguiente Compra

El motor de checkout de PJ-Air gestiona la aplicación del Store Credit de forma transparente:

1. **Detección Automática en el Checkout:**
   * Al armar su nuevo pedido, el cliente ve un banner azul en su pantalla:
     > 💳 **Saldo a Favor Disponible:** Tienes **$14.00 USD** en tu billetera. Se descontarán automáticamente del total a pagar.
2. **Cálculo del Descuento:**
   * `StoreCreditAplicado = min(SaldoDisponible, TotalDeLaOrden)`.
   * `TotalAPagar = TotalDeLaOrden - StoreCreditAplicado`.
3. **Escenario A: El Saldo cubre el 100% de la Orden:**
   * `TotalAPagar = $0.00`.
   * La orden se confirma de inmediato sin requerir tarjeta, Zelle ni crédito.
   * Método de pago registrado: `store_credit`.
4. **Escenario B: El Saldo cubre parcialmente la Orden:**
   * Se descuenta el renglón `-$14.00 (Store Credit / Saldo a Favor)` en el desglose de tarifas.
   * El cliente solo paga la diferencia restante con su método habitual.
5. **Actualización Atómica del Saldo:**
   * El sistema descuenta lo utilizado de `User.credit_balance` inmediatamente.

---

## 7. Matriz de Responsabilidades

| Rol | Responsabilidad | Canal / Pantalla |
| :--- | :--- | :--- |
| **Chofer de Reparto** | Verificar comanda física, fotografiar quebras/faltantes y notificar en ruta. | App de Entrega (`/delivery`) y WhatsApp |
| **Cliente Mayorista B2B** | Inspeccionar pedidos nocturnos antes de las 10:00 AM y enviar reporte con foto. | Portal Web (`/orders/[id]`) |
| **Administración / Despacho** | Validar reporte, autorizar el saldo a favor y enviar la tarjeta digital al cliente. | Panel Admin (`/admin/orders` y `/admin/clients`) |
| **Cocina / Producción** | Revisar las causas raíz de mermas y faltantes para ajustar horneadas y empaque. | Reportes de Producción (`/produccion/reports`) |

---

## 8. Preguntas Frecuentes (FAQ)

**Q1: ¿Por qué no emitimos una Nota de Crédito fiscal?**  
*R:* Para mantener una contabilidad limpia y ágil. La emisión de Store Credit es una compensación comercial interna (billetera virtual) que no afecta las declaraciones de ventas ni el Sales Tax de la factura original.

**Q2: ¿El Saldo a Favor (Store Credit) tiene caducidad?**  
*R:* No. El saldo permanece disponible en la cuenta del cliente de manera indefinida hasta que monte su siguiente pedido.

**Q3: ¿Se pueden acumular varios saldos a favor?**  
*R:* Sí. Si un cliente acumula varios vouchers de Store Credit, se suman en un único saldo total disponible en su perfil.

**Q4: ¿Qué sucede si el cliente reporta después de las 10:00 AM en entregas nocturnas?**  
*R:* Por tratarse de producto fresco perecedero, el sistema no admite reclamos extemporáneos, garantizando que el producto no haya sufrido degradación por almacenamiento inadecuado en el local del cliente.
