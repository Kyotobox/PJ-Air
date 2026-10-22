-- =============================================================================
-- PJ-AIR (Pedidos Jhoanes) — Certified SQLite Production Schema
-- Canonical SSSoT for SQLite Architecture (Fase 1 - Sprint S14)
-- =============================================================================
-- In strict accordance with VISION.md §4 (Core Schema Inviolability):
-- Contains the exact physical table structures, relationships, and secondary
-- performance indices eliminating SCAN TABLE queries in runtime operation.
-- =============================================================================

PRAGMA foreign_keys = ON;

-- -----------------------------------------------------------------------------
-- 1. CATEGORIES (Catálogo de familias de producto)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "categories" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  "name" VARCHAR NOT NULL,
  "name_en" VARCHAR,
  "min_qty" INTEGER NOT NULL DEFAULT (1),
  "is_active" BOOLEAN NOT NULL DEFAULT (1),
  CONSTRAINT "UQ_categories_name" UNIQUE ("name")
);

-- -----------------------------------------------------------------------------
-- 2. USERS (Identidades y Credenciales del Sistema)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "users" (
  "id" VARCHAR PRIMARY KEY NOT NULL,
  "email" VARCHAR NOT NULL,
  "password" VARCHAR NOT NULL,
  "role" VARCHAR NOT NULL DEFAULT ('client'),
  "general_discount" DECIMAL(5,2) NOT NULL DEFAULT (0),
  "delivery_fee" DECIMAL(10,2) NOT NULL DEFAULT (0),
  "account_type" VARCHAR NOT NULL DEFAULT ('cash'),
  "credit_limit" DECIMAL(10,2) NOT NULL DEFAULT (0),
  "credit_override" BOOLEAN NOT NULL DEFAULT (0),
  CONSTRAINT "UQ_users_email" UNIQUE ("email")
);

-- -----------------------------------------------------------------------------
-- 3. PROFILES (Perfiles extendidos de usuario 1:1)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "profiles" (
  "id" VARCHAR PRIMARY KEY NOT NULL,
  "full_name" VARCHAR,
  "username" VARCHAR,
  "nickname" VARCHAR,
  "phone" VARCHAR,
  "company_name" VARCHAR,
  "avatar_url" VARCHAR,
  CONSTRAINT "FK_profiles_user_id" FOREIGN KEY ("id") 
    REFERENCES "users" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- -----------------------------------------------------------------------------
-- 4. PRODUCTS (Catálogo de Artículos de Panadería y Pastelería)
-- Nota: En producción, pueden persistir columnas históricas (category, category_en, category_min_qty)
-- preservadas de migraciones vivas sin impacto en la API.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "products" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  "name" VARCHAR NOT NULL,
  "price" DECIMAL(10,2) NOT NULL,
  "description" TEXT,
  "image" VARCHAR,
  "is_deleted" BOOLEAN NOT NULL DEFAULT (0),
  "category_id" INTEGER,
  CONSTRAINT "FK_products_category_id" FOREIGN KEY ("category_id") 
    REFERENCES "categories" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- -----------------------------------------------------------------------------
-- 5. ADDRESSES (Direcciones de Entrega por Cliente)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "addresses" (
  "id" VARCHAR PRIMARY KEY NOT NULL,
  "user_id" VARCHAR NOT NULL,
  "alias" VARCHAR NOT NULL,
  "address" VARCHAR NOT NULL,
  "zone" VARCHAR,
  "notes" VARCHAR,
  "city" VARCHAR,
  "lat" DOUBLE PRECISION,
  "lng" DOUBLE PRECISION,
  "refined_lat" DOUBLE PRECISION,
  "refined_lng" DOUBLE PRECISION,
  "is_default" BOOLEAN NOT NULL DEFAULT (0),
  "is_temporary" BOOLEAN NOT NULL DEFAULT (0),
  CONSTRAINT "FK_addresses_user_id" FOREIGN KEY ("user_id") 
    REFERENCES "users" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- -----------------------------------------------------------------------------
-- 6. ORDERS (Cabeceras de Pedido Transaccional)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "orders" (
  "id" VARCHAR PRIMARY KEY NOT NULL,
  "user_id" VARCHAR NOT NULL,
  "total" DECIMAL(10,2) NOT NULL,
  "status" VARCHAR NOT NULL DEFAULT ('pending'),
  "address_id" VARCHAR,
  "delivery_date" VARCHAR,
  "payment_due_date" VARCHAR,
  "delivery_user_id" VARCHAR,
  "notes" TEXT,
  "delivery_type" VARCHAR DEFAULT ('saved'),
  "delivery_address_text" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT (datetime('now')),
  "delivery_fee_charged" DECIMAL(10,2) NOT NULL DEFAULT (0),
  "payment_status" VARCHAR NOT NULL DEFAULT ('pending'),
  CONSTRAINT "FK_orders_delivery_user_id" FOREIGN KEY ("delivery_user_id") 
    REFERENCES "users" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "FK_orders_user_id" FOREIGN KEY ("user_id") 
    REFERENCES "users" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "FK_orders_address_id" FOREIGN KEY ("address_id") 
    REFERENCES "addresses" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- -----------------------------------------------------------------------------
-- 7. ORDER_ITEMS (Renglones de Productos por Pedido)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "order_items" (
  "id" VARCHAR PRIMARY KEY NOT NULL,
  "order_id" VARCHAR NOT NULL,
  "product_id" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL,
  "price_at_time" DECIMAL(10,2) NOT NULL,
  CONSTRAINT "FK_order_items_order_id" FOREIGN KEY ("order_id") 
    REFERENCES "orders" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "FK_order_items_product_id" FOREIGN KEY ("product_id") 
    REFERENCES "products" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- -----------------------------------------------------------------------------
-- 8. PRODUCT_DISCOUNTS (Reglas de Precio Especial Cliente / Producto)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "product_discounts" (
  "id" VARCHAR PRIMARY KEY NOT NULL,
  "user_id" VARCHAR NOT NULL,
  "product_id" INTEGER NOT NULL,
  "discount_percentage" DECIMAL(5,2),
  "special_price" DECIMAL(10,2),
  CONSTRAINT "FK_product_discounts_user_id" FOREIGN KEY ("user_id") 
    REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "FK_product_discounts_product_id" FOREIGN KEY ("product_id") 
    REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- -----------------------------------------------------------------------------
-- 9. SYSTEM_CONFIGS (Configuraciones Globales de la Plataforma)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "system_configs" (
  "key" VARCHAR PRIMARY KEY NOT NULL,
  "value" VARCHAR NOT NULL
);

-- =============================================================================
-- SECONDARY PERFORMANCE INDICES (B-TREE)
-- SPRINT S14: Eliminates SCAN TABLE and AUTOMATIC COVERING INDEX
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
