# INFORME DE AUDITORÍA FORENSE DE ESQUEMA Y DATOS SQLITE — SPRINT S13
**Proyecto**: pj-air (Pedidos Jhoanes)  
**Fecha de Ejecución**: 2026-10-22  
**Protocolo Aplicado**: NHC (No Hagas Cambios - Solo Inspección Forense)  
**Bases de Datos Auditadas**:
- `backend/database.sqlite` (Entorno local / desarrollo)
- `backend/database.remote.prod.bak` (Respaldo real de producción: 267 órdenes, 5.086 items, 95 productos, 69 usuarios)
- `backend/database.remote.healthy.sqlite.bak` (Respaldo producción validado)
- `backend/database.remote.sqlite.bak`
- `backend/database.sqlite.bak_20260630`
- `backend/database.test.sqlite`
- `backend/schema.sql` (Archivo histórico de esquema)

---

## 1. Resumen Ejecutivo
Bajo el mandato del Sprint S13 y en estricto cumplimiento del **Protocolo NHC (Regla 0 y Regla 24.2)**, se llevó a cabo una auditoría forense exhaustiva de las bases de datos SQLite y los artefactos de esquema del backend NestJS.

**Conclusiones Principales**:
1. **Esquema Real vs Histórico**: `backend/schema.sql` es un remanente obsoleto originado en PostgreSQL/Supabase con tipos inexistentes en SQLite (`UUID`, `DO $$`, `SERIAL`, tablas `zones`, `promotions`, `transports`, `routes`, `notifications`). El esquema operativo real está regido al 100% por los modelos TypeORM en SQLite.
2. **Paridad de Esquema Local vs Producción**: La estructura de tablas es casi idéntica, con una sola divergencia calculada: en producción `products` mantiene 3 columnas legadas desnormalizadas (`category`, `category_en`, `category_min_qty`) producto de una migración en vivo que preservó compatibilidad, mientras que local solo tiene `category_id`.
3. **Ausencia de Módulos Exiliados**: No existe rastro en SQLite de tablas `payments`, `xero_tokens` ni `migrations`, coherente con la congelación técnica de pasarelas del Sprint S08/S10.
4. **Integridad Referencial Firme, Cero Violaciones**: `PRAGMA foreign_key_check` arrojó 0 violaciones en todas las bases de datos.
5. **Déficit Crítico de Indexación (Deuda Técnica Mayor)**: **NO EXISTEN ÍNDICES PERSONALIZADOS SECUNDARIOS**. Todas las búsquedas por usuario, fecha de orden y relación `order_items.order_id` realizan Full Table Scans (`SCAN TABLE`) y obligan a SQLite a generar costosos `AUTOMATIC COVERING INDEX` en memoria RAM durante los joins sobre más de 5.000 items.
6. **Inconsistencia Detectada en Producción**: Existen 8 órdenes huérfanas de items (0 items) creadas en ráfaga el 13 de mayo de 2026 debido a la falta de transaccionalidad atómica (`queryRunner.transaction`) en `OrdersService.create`.

---

## 2. Paridad y Censo de Esquema (TASK-13-01)

### 2.1. Censo Comparativo de Tablas y Volumetría

| Tabla | `schema.sql` | `database.sqlite` (Local) | `database.remote.prod.bak` (Prod) | `healthy.sqlite.bak` | Estado / Rol |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `users` | Sí (PG) | 5 filas | 69 filas | 68 filas | Núcleo de autenticación y clientes |
| `profiles` | **NO** | 5 filas | 69 filas | 68 filas | Perfiles 1:1 con `users` (nombres, apodos, teléfonos) |
| `categories` | Sí (PG) | 1 fila | 10 filas | 10 filas | Categorías de catálogo normalizadas |
| `products` | Sí (PG) | 10 filas | 95 filas | 95 filas | Catálogo de panadería y repostería |
| `addresses` | Sí (PG) | 0 filas | 56 filas | 54 filas | Direcciones de entrega de clientes |
| `orders` | Sí (PG) | 4 filas | 267 filas | 243 filas | Encabezados de órdenes de compra |
| `order_items` | Sí (PG) | 4 filas | 5.086 filas | 4.556 filas | Renglones de pedido transaccionales |
| `product_discounts` | **NO** | 0 filas | 0 filas | 0 filas | Reglas de precio especial cliente/producto |
| `system_configs` | **NO** | 1 fila | 1 fila | 1 fila | Variables globales de operación |
| `zones` | Sí (PG) | **NO** | **NO** | **NO** | Tabla fantasma en schema.sql (no existe en SQLite) |
| `promotions` | Sí (PG) | **NO** | **NO** | **NO** | Tabla fantasma en schema.sql |
| `transports` | Sí (PG) | **NO** | **NO** | **NO** | Tabla fantasma en schema.sql |
| `routes` | Sí (PG) | **NO** | **NO** | **NO** | Tabla fantasma en schema.sql |
| `notifications` | Sí (PG) | **NO** | **NO** | **NO** | Tabla fantasma en schema.sql |
| `payments` | **NO** | **NO** | **NO** | **NO** | Módulo exiliado en Purgatorio |
| `xero_tokens` | **NO** | **NO** | **NO** | **NO** | Módulo exiliado en Purgatorio |
| `migrations` | **NO** | **NO** | **NO** | **NO** | Sin tabla TypeORM migrations (manejo directo) |

### 2.2. Divergencias de Columnas Identificadas

1. **`products` (Local vs Prod)**:
   * **Local (7 columnas)**: `id`, `name`, `price`, `description`, `image`, `is_deleted`, `category_id`.
   * **Producción (10 columnas)**: Incluye adicionalmente `category` (varchar), `category_en` (varchar), `category_min_qty` (integer).
   * **Hallazgo**: `ProductsService.migrateLegacyCategories()` ejecuta al arranque una detección dinámica (`PRAGMA table_info(products)`). Al encontrar `category`, migra los registros a la tabla `categories` e inyecta `category_id` sin eliminar las columnas antiguas para evitar fallos catastróficos.
2. **`orders` (`schema.sql` vs SQLite)**:
   * `schema.sql` declaraba `id SERIAL`, `total_price DECIMAL`, `payment_date DATE`.
   * SQLite real utiliza: `id VARCHAR` (UUID string), `total DECIMAL`, `payment_due_date VARCHAR`, `delivery_type VARCHAR`, `delivery_address_text TEXT`, `delivery_user_id VARCHAR`, `notes TEXT`.
3. **`addresses` (`schema.sql` vs SQLite)**:
   * `schema.sql` declaraba `name`, `address_line`, `latitude`, `longitude`, `zone_id REFERENCES zones`.
   * SQLite real utiliza: `alias`, `address`, `city`, `lat`, `lng`, `refined_lat`, `refined_lng`, `zone` (texto libre), `is_default`, `is_temporary`.

---

## 3. Integridad Referencial y Consistencia (TASK-13-02)

### 3.1. Claves Foráneas
* `PRAGMA foreign_key_check`: **0 violaciones** en todas las bases de datos.
* Todas las relaciones críticas poseen integridad estructural:
  * `order_items.order_id` $\rightarrow$ `orders.id`
  * `order_items.product_id` $\rightarrow$ `products.id`
  * `orders.user_id` $\rightarrow$ `users.id`
  * `orders.address_id` $\rightarrow$ `addresses.id`
  * `addresses.user_id` $\rightarrow$ `users.id`
  * `profiles.id` $\rightarrow$ `users.id` (1:1 estricto)
  * `product_discounts.user_id` $\rightarrow$ `users.id` (ON DELETE CASCADE)
  * `product_discounts.product_id` $\rightarrow$ `products.id` (ON DELETE CASCADE)

### 3.2. Cero Índices Secundarios (Cuello de Botella Severo)
* **Resultado del Análisis**: `SELECT name FROM sqlite_master WHERE type='index'` arrojó **0 índices personalizados**.
* Únicamente existen los índices automáticos implícitos creados por las claves primarias (`sqlite_autoindex_*`).
* **Impacto**:
  * `SELECT * FROM orders WHERE user_id = ?` $\rightarrow$ `SCAN TABLE orders` (Full scan en cada consulta de cliente).
  * `SELECT * FROM orders WHERE created_at >= ?` $\rightarrow$ `SCAN TABLE orders` + `USE TEMP B-TREE FOR ORDER BY` (Full scan y ordenación en disco/RAM).
  * En `findAll()` y joins de órdenes: SQLite se ve forzado a crear en tiempo de ejecución:  
    `SEARCH TABLE order_items AS oi USING AUTOMATIC COVERING INDEX (order_id=?)` sobre 5.086 registros en cada petición.

### 3.3. Detección de Registros Inconsistentes: 8 Órdenes sin Items en Producción
Se detectaron 8 órdenes en `database.remote.prod.bak` con 0 renglones asociados en `order_items`:
- **IDs**:
  1. `3021ea30-835b-48b5-ac88-c1f7fb5a37e9`
  2. `1c5705af-d8f9-4f37-b0f7-ee35eaeb1a09`
  3. `8d79537f-9fe7-49ee-9f40-458ae1cde6dd`
  4. `32f9e160-97eb-4224-bf91-7b91bc8c6d3a`
  5. `8a4836f5-a7fe-4547-82b4-12005a11263f`
  6. `4be271c6-e94e-4f7e-b978-6e88ffb4d15c`
  7. `2d895c2e-6e30-4acc-bf6c-8e8fe40da4c2`
  8. `eb4a0238-e4e3-4a11-9931-6ddf9a7f2126`
- **Usuario Común**: `ef38b6c4-1324-4d84-b785-74166b55b53a`.
- **Monto Total Registrado**: \$1088.10 en todas ellas.
- **Fecha**: 2026-05-13 entre las 16:25:50 y las 16:30:53 (ráfaga de 5 minutos).
- **Estado**: Todas marcadas como `cancelled`.
- **Causa Raíz Forense**: En `OrdersService.create`, la orden se persiste primero (`this.orderRepository.save(orderToCreate)`) y luego, en una operación separada sin bloque transaccional `dataSource.transaction(...)`, se persisten los items. Si el guardado de items falló o se interrumpió la conexión del cliente, la cabecera quedó registrada y posteriormente fue cancelada.

---

## 4. Eficiencia de Consultas y Precios Dinámicos (TASK-13-03)

### 4.1. Análisis del Modelo de Precios Dinámicos
* **Estructura**:
  1. **Nivel 1 (Cliente-Producto)**: `product_discounts` permite asignar `special_price` (precio fijo cerrado) o `discount_percentage` (% sobre base) para una tupla `(user_id, product_id)`.
  2. **Nivel 2 (Cliente General)**: `users.general_discount` asigna un porcentaje de descuento global sobre el catálogo para clientes preferenciales.
  3. **Nivel 3 (Precio Base)**: `products.price`.
* **Datos Reales en Producción**:
  * `product_discounts`: 0 filas creadas en producción.
  * `users.general_discount`: 5 clientes configurados con descuentos de 5%, 10% y 12% (ej. `randammri588@gmail.com`, `mokaenglewood@gmail.com`).
* **Diagnóstico de Complejidad**: La jerarquía de cálculo es determinista, matemáticamente limpia y cumple con las reglas de negocio descritas en `VISION.md`.

### 4.2. Antipatrón N+1 en `calculateOrderPricesAndTotal`
En `orders.service.ts` (líneas 54-60):
```typescript
for (const item of items) {
  const productId = item.productId || item.product_id;
  const product = await this.productRepository.findOne({ where: { id: Number(productId) } });
  ...
}
```
* Para un pedido promedio de panadería (30-50 renglones de productos variados), el backend ejecuta de 30 a 50 consultas individuales secuenciales `SELECT * FROM products WHERE id = ?` contra SQLite.
* **Solución Óptima**: Realizar una única consulta batch con operador `In(productIds)` antes del bucle.

### 4.3. Cuello de Botella en `findAll` y `findInRange`
* `findAll()` solicita eager relations:
  `relations: ['items', 'items.product', 'user', 'user.profile', 'delivery_user', 'delivery_user.profile', 'address']` con `take: 100`.
* Esto genera un producto cartesiano masivo de miles de filas en SQLite y múltiples sub-queries en memoria, degradando el heap de Node.js durante la generación de reportes masivos de Excel (`ExcelService`).

---

## 5. Recomendaciones y Hoja de Ruta para Sprint S14

1. **Creación de Índices Secundarios Seguros (Zero-Impact en Esquema)**:
   Conforme a la Regla de Inviolabilidad de Esquema (`VISION.md §4`), la adición de índices en SQLite **no altera las columnas, nombres ni tipos de datos existentes**. Se recomienda crear:
   - `idx_orders_user_id` en `orders(user_id)`
   - `idx_orders_created_at` en `orders(created_at DESC)`
   - `idx_orders_status` en `orders(status)`
   - `idx_order_items_order_id` en `order_items(order_id)`
   - `idx_order_items_product_id` en `order_items(product_id)`
   - `idx_addresses_user_id` en `addresses(user_id)`
   - `idx_products_category_id` en `products(category_id)`
2. **Blindaje Transaccional Atómico en `OrdersService.create`**:
   Encapsular la creación de la orden y el guardado de items dentro de `this.dataSource.transaction(...)` para garantizar que nunca vuelva a quedar una orden huérfana de items en base de datos.
3. **Eliminación del Antipatrón N+1**:
   Refactorizar `calculateOrderPricesAndTotal` para cargar todos los productos en una sola consulta `In(productIds)`.
4. **Depuración del Archivo Histórico `backend/schema.sql`**:
   Crear un script `backend/sqlite_schema.sql` fiel al estado actual y archivar `schema.sql` con una nota de advertencia para evitar confusiones de nuevos desarrolladores.
5. **Normalización de Fixtures de Pruebas**:
   Alinear `database.test.sqlite` con la estructura de categorías de producción.
