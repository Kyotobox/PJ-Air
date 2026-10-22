# VISION.md — Pedidos Jhoanes (PJ-AIR) (4.0.0)

**Versión de Producto**: 2.2.11
**Versión de Gobernanza (Kernel)**: 4.0.0

## 1. Filosofía Central: Canal Digital de Distribución Directa (Pedidos Jhoanes)
Nuestra meta principal es automatizar y agilizar el canal de ventas y logística de pedidos de productos de panadería y pastelería ("Jhoanes"). La aplicación sirve como el portal digital donde los clientes consultan el catálogo actualizado en tiempo real, configuran sus direcciones y efectúan sus pedidos transaccionales con reglas de precio dinámicas (descuentos generales y específicos por producto).

## 2. Inviolabilidad del Desarrollo Existente (Core Preservation)
* **Bloqueo de Modificación de Código Pre-existente**: El código fuente actual de las vistas, controladores y servicios (tanto de NestJS como de Next.js) que da soporte a las operaciones actuales está congelado. Queda prohibida su alteración, refactorización o re-escritura.
* **Mantenimiento y Corrección Estricta**: Los fallos detectados se resolverán mediante configuraciones o inyección de comportamiento, o bien extendiendo clases/componentes sin modificar las bases de código actuales.
* **Nuevos Desarrollos sobre Estructuras Creadas**: Cualquier nuevo requerimiento o desarrollo debe implementarse en módulos, pantallas o componentes adicionales e independientes que se acoplen a las APIs y tablas de base de datos (`database.sqlite`) existentes de forma pasiva, sin alterar su lógica interna.

## 3. Responsabilidades Funcionales (Nuevos Desarrollos)
1. **Extensiones Logísticas e Interfaces Especializadas**: Creación de nuevos flujos operacionales modulares (ej. nuevos flujos de asignación o tableros de visualización) que complementen el flujo de producción y delivery sin interrumpir las pantallas existentes.
2. **Consumo de Reglas de Precio y Catálogo**: Construcción de interfaces adicionales para visualización que reutilicen la lógica de base de datos de precios (descuentos generales y por producto) en modo lectura, sin alterar los modelos de datos de TypeORM pre-existentes.
3. **Módulos Independientes de Reportes**: Desarrollo de herramientas de analítica y reportes adicionales que consuman la base de datos SQLite actual directamente, sin crear dependencias que modifiquen el backend NestJS existente.

## 4. Cercas Eléctricas y Exclusiones (Fuera de Alcance)
- **NO Modificación Destructiva del Esquema**: No se permite renombrar o eliminar campos en las tablas existentes de la base de datos para preservar la compatibilidad con el entorno de producción actual.
- **Inviolabilidad de Producción en el VPS**: Queda estrictamente prohibido alterar la ruta `/var/www/pj-air`, sus procesos PM2 o su base de datos productiva. Todo despliegue y validación remota debe realizarse en el entorno aislado de staging/testing (`/var/www/pj-air-staging`).

## 5. Evolución Wholesale (Sprints S25-S28) — Autorizado por el PO
1. **Pasarela de Pago y Facturación Stripe**: Habilitación formal de Stripe (`Payments` para cobro inmediato de clientes de contado y `Invoicing` para facturación B2B con enlace de pago diferido).
2. **Sistema de Crédito B2B y Tarifas de Delivery**: Extensión controlada de modelos en desarrollo/testing para soportar clientes de contado vs crédito (`account_type`, `credit_limit`, `credit_override`) y persistencia del delivery fee cobrado (`delivery_fee_charged`, `payment_status`).
3. **Vitrina Pública y Términos Comerciales**: Desbloqueo del catálogo público mayorista, carrito de compra anónimo y marco legal dinámico en `system_configs`.
4. **Logística y Torre de Producción**: Regla de corte de pedidos a las 12:00 PM (1.5 días de anticipación) y reportes de producción interactivos con recálculo dinámico.
