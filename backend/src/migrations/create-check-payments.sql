-- Migration: Create check_payments table and add credit_blocked to users (Sprint S45: Pagos por Cheque y Conciliación Contable)
CREATE TABLE IF NOT EXISTS check_payments (
  id VARCHAR PRIMARY KEY NOT NULL,
  order_id VARCHAR NOT NULL,
  user_id VARCHAR NOT NULL,
  check_number VARCHAR NOT NULL,
  bank_name VARCHAR NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  received_date VARCHAR NOT NULL,
  clearance_deadline VARCHAR NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'PENDING_RECEIPT',
  notes TEXT,
  created_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_check_payments_order_id ON check_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_check_payments_user_id ON check_payments(user_id);
