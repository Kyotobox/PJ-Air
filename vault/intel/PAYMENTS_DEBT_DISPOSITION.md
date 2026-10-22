# DISPOSICIÓN FORMAL DE DEUDA TÉCNICA: PASARELAS DE PAGO Y XERO (EXILIO DEFINITIVO)
**Proyecto**: pj-air (Pedidos Jhoanes)  
**Fecha de Certificación**: 2026-10-22  
**Autoridad**: SPRINT S16 — TASK-16-03  
**SSSoT de Referencia**: `VISION.md §1 & §4` (Modelo B2B Autárquico)

---

## 1. Declaración de Estado y Descarte Definitivo

Por medio del presente documento, el equipo de gobernanza y arquitectura de `pj-air` certifica el **descarte formal, irreversible y definitivo** de cualquier integración, dependencia, esquema o rastro remanente vinculado a pasarelas de pago externas y sistemas de contabilidad SaaS de terceros:

1. **Stripe**: Descartado y exiliado.
2. **PayPal**: Descartado y exiliado.
3. **Xero**: Descartado y exiliado.

---

## 2. Justificación de Negocio y Modelo Operativo (`VISION.md §1`)

El proyecto `pj-air` opera bajo un modelo de distribución y abastecimiento **B2B (Business-to-Business)** entre la panadería central/distribuidora y sus clientes mayoristas (bodegas, cafeterías, supermercados locales, panaderías afiliadas). 

En dicho ecosistema comercial:
- Las transacciones no ocurren mediante tarjetas de crédito o pasarelas de retail en tiempo real al someter un carrito.
- Los pedidos se entregan mediante rutas logísticas propias con términos de pago acordados:
  - **Pago contra Entrega (COD - Cash on Delivery)** en efectivo o cheque comercial.
  - **Crédito Comercial B2B** con vencimiento diferido parametrizado en `payment_due_date` (ej. 7, 15 o 30 días).
- La inclusión de pasarelas de pago de comercio electrónico B2C (Stripe, PayPal) introduciría:
  - Comisiones financieras innecesarias (2.9% + $0.30 por transacción) perjudiciales para márgenes mayoristas reducidos.
  - Fragilidad por dependencias externas en red y servicios de terceros.
  - Requisitos de cumplimiento PCI-DSS incompatibles con la simplicidad autárquica del nodo.

---

## 3. Disposición Técnica en Código y Esquema

1. **Dependencias `npm`**: No existen paquetes como `stripe`, `@paypal/checkout-server-sdk`, `xero-node` ni equivalentes en `package.json` ni en `backend` ni en `frontend`.
2. **Base de Datos SQLite**: Las tablas congeladas en SQLite (`orders`, `order_items`, `users`, `products`, `addresses`, `system_configs`) no contienen columnas de referencia a cargos, tokens de pago externos, customer IDs de Stripe ni IDs de factura Xero. El esquema refleja fielmente la verdad del negocio:
   - `orders.total`: Importe liquidable de la orden.
   - `orders.payment_due_date`: Fecha de exigibilidad del pago para control de cartera B2B.
   - `orders.delivery_type` y `orders.delivery_date`: Coordinación logística.
3. **Reportes Administrativos**: La conciliación contable se realiza de manera autárquica y determinista mediante el motor de reportes exportables en Excel (`ExcelService`, con formato individual y consolidado diario con desglose por categorías y zonas), sustituyendo completamente la necesidad de sincronización con Xero.

---

## 4. Cláusula de Inviolabilidad

Queda terminantemente prohibido a futuros sprints o agentes IA reintroducir SDKs, mocks o campos de Stripe, PayPal o Xero sin una reforma formal a `VISION.md` firmada explícitamente por el Product Owner (PO).
Cualquier intento de reintroducción sin dicha aprobación será categorizado como **Fatal Architectural Drift** y bloqueado por el protocolo de gobernanza.
