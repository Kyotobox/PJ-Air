# Guía de Validación para el Cliente y Registros DNS Transaccionales
## Jhoanes Bakery & Wholesale — Puntos de Aprobación para Paso a Producción

> **Entorno de Pruebas**: [https://testing.jhoanes.com](https://testing.jhoanes.com)  
> **Servidor VPS**: `187.124.67.53` (`mail.franquiexpo.com`)  
> **Buzón Remitente Transaccional**: `pedidos@jhoanes.com`

---

## 1. Acción Requerida en Dominio: Registros DNS

Para que los recibos, facturas y confirmaciones de pedidos enviados desde `pedidos@jhoanes.com` lleguen a la **Bandeja de Entrada Principal** de los clientes (Gmail, Outlook, Yahoo) y no caigan en la carpeta de SPAM, se requiere configurar los siguientes 2 registros en el proveedor de DNS de **`jhoanes.com`** (Cloudflare, GoDaddy, Namecheap o cPanel):

### Registro 1: SPF (Sender Policy Framework)
* **Tipo**: `TXT`
* **Nombre / Host**: `@` (o `jhoanes.com`)
* **Valor / Contenido**:
  ```text
  v=spf1 ip4:187.124.67.53 ~all
  ```
* **TTL**: `3600` (o automático)
* *Nota*: Si ya tienen un registro SPF existente (ej. de Google Workspace), simplemente inserten `ip4:187.124.67.53` dentro del registro actual antes del `~all`.

### Registro 2: DKIM (Firma Criptográfica Anti-Suplantación)
* **Tipo**: `TXT`
* **Nombre / Host**: `mail._domainkey` (o `mail._domainkey.jhoanes.com`)
* **Valor / Contenido**:
  ```text
  v=DKIM1; h=sha256; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4nF3WeWr5lb3oOIyJLw7Gt8+0QCuT8axU1p9ObKAtAQzTDJihpl9vSq1kjTCmEA8enKDkJmxS0ouFgFxMp44xWxVrQ0g0/X1eVbETbYOPhea77n6HwcQu9EPaVLfnNr1iufQRBofyodXDlZIXKUuI78Qo3hlmrqAsgzFR13Q/rDACSxzwxzzTov0D8WCYgTPh3GVWibQwUtgHmabHi8EXhma9cDrlhmAJGrjduocvIICf6NX9DxHI9uArtbbEQISE9i3icbsf5rckEw6NWHkJhGy2yYyYVjwlB3hntzcwMTiuu5oyREKB1CWYkt2BdtmK2AGTLdJ6LNiDD/lZv2DgQIDAQAB
  ```
* **TTL**: `3600` (o automático)

---

## 2. Checklist de Validación en Entorno Testing (`testing.jhoanes.com`)

El cliente o su equipo administrativo pueden ingresar a [https://testing.jhoanes.com](https://testing.jhoanes.com) con sus credenciales habituales y certificar los siguientes flujos implementados:

### A. Feedback de Experiencia de Usuario (Sprint 38)
* [ ] **Formulario de Direcciones**: Al agregar una nueva dirección en el perfil o checkout, el campo confuso *"Nombre (Alias)"* fue eliminado; el sistema asigna el valor técnico por defecto de forma transparente.
* [ ] **Registro de Nuevos Clientes**: El campo *"Nombre de Empresa / Negocio"* es ahora estrictamente obligatorio, garantizando que todo comprador registre su razón social comercial.
* [ ] **Cancelación en Pasarela de Pago**: Al cancelar o cerrar el modal de Stripe, el carrito de compras se preserva intacto y la orden queda en estado *"Pago Pendiente"* con un botón visible para reintentar el pago en cualquier momento.

### B. Nuevas Capacidades Comerciales y de Seguridad (Sprints 39, 40 y 41)
* [ ] **Pago con Zelle y Bonificación de Empaque**: Al seleccionar Zelle en checkout, el cargo del 3.5% se bonifica al 100% en verde. Se ingresa el número de referencia y la orden queda en espera de verificación.
* [ ] **Aprobación Administrativa de Zelle**: En el panel de `/admin/orders`, el administrador aprueba o rechaza pagos Zelle antes de enviarlos a horneado.
* [ ] **Guardarraíl de Corte 12:00 PM**: Pedidos colocados después de las 12:00 PM (hora de Nueva York) calculan automáticamente el siguiente ciclo de producción (1.5 días de anticipación / 36h de fermentación).
* [ ] **Zonas de Delivery y Envío Gratis**: Al ingresar una dirección con ZIP de Astoria, Queens, Brooklyn o Manhattan, el checkout detecta la tarifa correspondiente y muestra la barra de progreso para **Envío Gratis**.
* [ ] **Verificación Telefónica por SMS OTP**: En el registro y en la edición de número telefónico en `/profile`, el sistema solicita un código de verificación por SMS para blindar la identidad del comprador.
