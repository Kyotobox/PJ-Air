# DICCIONARIO DE DATOS CERTIFICADO — PJ-AIR (Pedidos Jhoanes)
**Versión de Gobernanza**: 4.0.0  
**Versión de Producto**: 2.2.11  
**Motor de Persistencia**: SQLite 3 (TypeORM Driver)  
**Fecha de Certificación**: 2026-10-22 (Sprint S14)  
**Estado**: ACTIVO / CERTIFICADO  

---

## 1. Introducción y Marco de Inviolabilidad
Conforme a `VISION.md §4`, el esquema físico de tablas de `pj-air` se encuentra en congelación estricta para garantizar la continuidad operativa sin fricciones con el entorno de producción. Este diccionario describe las 9 entidades funcionales de la base de datos `database.sqlite`, sus tipos de datos, relaciones de clave foránea, índices de rendimiento y notas de compatibilidad.

---

## 2. Inventario de Tablas del Dominio

| Tabla | Propósito de Negocio | Cardinalidad Típica |
| :--- | :--- | :--- |
| `users` | Cuentas, credenciales, roles y descuentos globales | Decenas (clientes y admins) |
| `profiles` | Información de contacto y perfil de usuario (1:1) | 1:1 con `users` |
| `categories` | Familias y agrupaciones de productos del catálogo | 10 a 20 categorías |
| `products` | Catálogo de panadería, pastelería y repostería | 90 a 150 productos |
| `addresses` | Direcciones de entrega y geolocalización de clientes | Decenas a cientos |
| `orders` | Cabeceras transaccionales de pedidos | Cientos a miles |
| `order_items` | Renglones de detalle de cada pedido | Miles (5.000+ en prod) |
| `product_discounts` | Precios preferenciales específicos por cliente y producto | Opcional (0 a cientos) |
| `system_configs` | Variables globales de operación (montos mínimos, etc.) | Clave-Valor (1 a 10) |

---

## 3. Especificación Detallada por Tabla

### 3.1. `users`
Almacena las cuentas de usuario, control de acceso y parámetros comerciales a nivel de cuenta.

| Columna | Tipo | Nulo | Por Defecto | Restricción | Descripción |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `id` | VARCHAR | NO | - | **PK** (UUID v4) | Identificador único de usuario |
| `email` | VARCHAR | NO | - | **UNIQUE** | Correo electrónico de acceso |
| `password` | VARCHAR | NO | - | - | Hash bcrypt de la contraseña |
| `role` | VARCHAR | NO | `'client'` | - | Rol de autorización (`admin`, `client`, `delivery`) |
| `general_discount` | DECIMAL(5,2) | NO | `0` | - | Descuento porcentual global aplicado al cliente |
| `delivery_fee` | DECIMAL(10,2) | NO | `0` | - | Tarifa especial personalizada de entrega |

---

### 3.2. `profiles`
Detalles de contacto, facturación y presentación asociados 1:1 a un usuario.

| Columna | Tipo | Nulo | Por Defecto | Restricción | Descripción |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `id` | VARCHAR | NO | - | **PK**, **FK** $\rightarrow$ `users(id)` | Identificador 1:1 vinculado al usuario |
| `full_name` | VARCHAR | SÍ | NULL | - | Nombre completo del contacto |
| `username` | VARCHAR | SÍ | NULL | - | Nombre de usuario o alias visible |
| `nickname` | VARCHAR | SÍ | NULL | - | Apodo o nombre comercial corto |
| `phone` | VARCHAR | SÍ | NULL | - | Teléfono de contacto / WhatsApp |
| `company_name` | VARCHAR | SÍ | NULL | - | Razón social o nombre del negocio cliente |
| `avatar_url` | VARCHAR | SÍ | NULL | - | Ruta o URL de imagen de avatar |

---

### 3.3. `categories`
Categorización normalizada de artículos del catálogo.

| Columna | Tipo | Nulo | Por Defecto | Restricción | Descripción |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `id` | INTEGER | NO | AUTOINCREMENT | **PK** | Identificador entero secuencial |
| `name` | VARCHAR | NO | - | **UNIQUE** | Nombre en español (ej. Croissants, Tartas) |
| `name_en` | VARCHAR | SÍ | NULL | - | Nombre en inglés para soporte multilingüe |
| `min_qty` | INTEGER | NO | `1` | - | Cantidad mínima por pedido para la categoría |
| `is_active` | BOOLEAN | NO | `1` | - | Bandera de activación en catálogo (1=activo, 0=inactivo) |

---

### 3.4. `products`
Artículos comercializables del catálogo de Jhoanes.

| Columna | Tipo | Nulo | Por Defecto | Restricción | Descripción |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `id` | INTEGER | NO | AUTOINCREMENT | **PK** | Identificador entero secuencial |
| `name` | VARCHAR | NO | - | - | Nombre del producto |
| `price` | DECIMAL(10,2) | NO | - | - | Precio base de venta al público |
| `description` | TEXT | SÍ | NULL | - | Descripción detallada del producto |
| `image` | VARCHAR | SÍ | NULL | - | Ruta relativa de imagen del artículo |
| `is_deleted` | BOOLEAN | NO | `0` | - | Borrado lógico (soft delete) |
| `category_id` | INTEGER | SÍ | NULL | **FK** $\rightarrow$ `categories(id)` | Categoría normalizada a la que pertenece |
| *`category`* | VARCHAR | SÍ | NULL | *Legacy Prod* | Nombre de categoría previo a normalización |
| *`category_en`* | VARCHAR | SÍ | NULL | *Legacy Prod* | Nombre en inglés previo a normalización |
| *`category_min_qty`* | INTEGER | SÍ | `1` | *Legacy Prod* | Cantidad mínima previa a normalización |

> [!NOTE]
> Las columnas marcadas con *Legacy Prod* persisten en la base de producción viva como remanente de una migración dinámica no destructiva. El código actual usa `category_id`.

---

### 3.5. `addresses`
Libreta de direcciones de entrega guardadas por los clientes.

| Columna | Tipo | Nulo | Por Defecto | Restricción | Descripción |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `id` | VARCHAR | NO | - | **PK** (UUID v4) | Identificador único de la dirección |
| `user_id` | VARCHAR | NO | - | **FK** $\rightarrow$ `users(id)` | Cliente propietario de la dirección |
| `alias` | VARCHAR | NO | - | - | Etiqueta (ej. "Local Central", "Sucursal Norte") |
| `address` | VARCHAR | NO | - | - | Línea de dirección física |
| `zone` | VARCHAR | SÍ | NULL | - | Zona o sector de entrega |
| `notes` | VARCHAR | SÍ | NULL | - | Indicaciones para el repartidor |
| `city` | VARCHAR | SÍ | NULL | - | Ciudad de entrega |
| `lat` | DOUBLE | SÍ | NULL | - | Latitud geográfica capturada |
| `lng` | DOUBLE | SÍ | NULL | - | Longitud geográfica capturada |
| `refined_lat` | DOUBLE | SÍ | NULL | - | Latitud refinada manualmente |
| `refined_lng` | DOUBLE | SÍ | NULL | - | Longitud refinada manualmente |
| `is_default` | BOOLEAN | NO | `0` | - | Indica si es la dirección predeterminada |
| `is_temporary` | BOOLEAN | NO | `0` | - | Dirección de un solo uso para un pedido |

---

### 3.6. `orders`
Encabezado de pedidos generados por clientes.

| Columna | Tipo | Nulo | Por Defecto | Restricción | Descripción |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `id` | VARCHAR | NO | - | **PK** (UUID v4) | Identificador único de la orden |
| `user_id` | VARCHAR | NO | - | **FK** $\rightarrow$ `users(id)` | Cliente solicitante |
| `total` | DECIMAL(10,2) | NO | - | - | Monto total liquidado de la orden |
| `status` | VARCHAR | NO | `'pending'` | - | Estado (`pending`, `confirmed`, `completed`, `cancelled`) |
| `address_id` | VARCHAR | SÍ | NULL | **FK** $\rightarrow$ `addresses(id)` | Dirección guardada asociada |
| `delivery_date` | VARCHAR | SÍ | NULL | - | Fecha de entrega solicitada (formato YYYY-MM-DD) |
| `payment_due_date` | VARCHAR | SÍ | NULL | - | Fecha límite de pago |
| `delivery_user_id` | VARCHAR | SÍ | NULL | **FK** $\rightarrow$ `users(id)` | Repartidor asignado a la entrega |
| `notes` | TEXT | SÍ | NULL | - | Comentarios u observaciones del cliente |
| `delivery_type` | VARCHAR | SÍ | `'saved'` | - | Tipo de dirección (`saved`, `manual`) |
| `delivery_address_text` | TEXT | SÍ | NULL | - | Texto de dirección cuando es manual |
| `created_at` | DATETIME | NO | `datetime('now')` | - | Timestamp de creación del pedido |

---

### 3.7. `order_items`
Renglones con los productos adquiridos, cantidades y precio congelado al momento de compra.

| Columna | Tipo | Nulo | Por Defecto | Restricción | Descripción |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `id` | VARCHAR | NO | - | **PK** (UUID v4) | Identificador único del renglón |
| `order_id` | VARCHAR | NO | - | **FK** $\rightarrow$ `orders(id)` | Orden a la que pertenece |
| `product_id` | INTEGER | NO | - | **FK** $\rightarrow$ `products(id)` | Producto adquirido |
| `quantity` | INTEGER | NO | - | - | Unidades ordenadas |
| `price_at_time` | DECIMAL(10,2) | NO | - | - | Precio unitario final liquidado (con descuento) |

---

### 3.8. `product_discounts`
Reglas de descuento y precios especiales personalizados por cliente y producto.

| Columna | Tipo | Nulo | Por Defecto | Restricción | Descripción |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `id` | VARCHAR | NO | - | **PK** (UUID v4) | Identificador de la regla |
| `user_id` | VARCHAR | NO | - | **FK** $\rightarrow$ `users(id)` ON DELETE CASCADE | Cliente beneficiario |
| `product_id` | INTEGER | NO | - | **FK** $\rightarrow$ `products(id)` ON DELETE CASCADE | Producto aplicable |
| `discount_percentage` | DECIMAL(5,2) | SÍ | NULL | - | Descuento porcentual si aplica |
| `special_price` | DECIMAL(10,2) | SÍ | NULL | - | Precio cerrado fijo si aplica |

---

### 3.9. `system_configs`
Almacén clave-valor para parámetros operacionales de configuración.

| Columna | Tipo | Nulo | Por Defecto | Restricción | Descripción |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `key` | VARCHAR | NO | - | **PK** | Clave de configuración (ej. `min_order_amount`) |
| `value` | VARCHAR | NO | - | - | Valor de configuración serializado |

---

## 4. Catálogo de Índices Secundarios de Rendimiento (B-Tree)

Aplicados en Sprint S14 para eliminar cuellos de botella `SCAN TABLE` y `AUTOMATIC COVERING INDEX`:

| Nombre del Índice | Tabla | Columnas | Finalidad / Consulta Acelerada |
| :--- | :--- | :--- | :--- |
| `idx_orders_user_id` | `orders` | `(user_id)` | Historial de pedidos por cliente (`WHERE user_id = ?`) |
| `idx_orders_created_at` | `orders` | `(created_at DESC)` | Listado cronológico de pedidos sin Temp B-Tree |
| `idx_orders_status` | `orders` | `(status)` | Filtro operativo por estado (`pending`, `confirmed`) |
| `idx_order_items_order_id` | `order_items` | `(order_id)` | Detalle de renglones al cargar pedidos / joins masivos |
| `idx_order_items_product_id` | `order_items` | `(product_id)` | Reportes de venta por artículo y análisis de rotación |
| `idx_addresses_user_id` | `addresses` | `(user_id)` | Selección de direcciones del cliente en checkout |
| `idx_products_category_id` | `products` | `(category_id)` | Filtrado de catálogo por categoría en tienda y admin |

---

## 5. Matriz de Compatibilidad: Local vs Producción

| Dimensión | `backend/database.sqlite` (Local) | `database.remote.prod.bak` (Producción) | Veredicto de Compatibilidad |
| :--- | :--- | :--- | :--- |
| Tablas activas | 9 tablas | 9 tablas | **100% Idénticas** |
| Integridad Referencial | 0 violaciones | 0 violaciones | **100% Íntegra** |
| Índices Secundarios | 7 índices creados | 7 índices creados | **100% Paridad** |
| Columnas de `products` | 7 columnas normalizadas | 7 normalizadas + 3 legadas | **Totalmente Compatible** |
| Tablas exiliadas | No existen | No existen | **Limpio (cero residuos)** |
