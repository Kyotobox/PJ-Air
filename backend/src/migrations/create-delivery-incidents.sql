-- Migration: Create delivery_incidents table and indexes (Sprint S96: Incidencias de Entrega y Store Credit)
CREATE TABLE IF NOT EXISTS delivery_incidents (
  id VARCHAR PRIMARY KEY NOT NULL,
  order_id VARCHAR NOT NULL,
  user_id VARCHAR NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  reason_category VARCHAR(50) NOT NULL,
  description TEXT,
  photo_url VARCHAR,
  amount DECIMAL(10,2) NOT NULL,
  voucher_code VARCHAR(50) NOT NULL UNIQUE,
  status VARCHAR(30) NOT NULL DEFAULT 'pending_review',
  reviewed_by VARCHAR,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_delivery_incidents_order_id ON delivery_incidents(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_incidents_user_id ON delivery_incidents(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_incidents_voucher_code ON delivery_incidents(voucher_code);
