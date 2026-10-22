#!/usr/bin/env node
/**
 * apply-indexes.js — Idempotent Index Optimizer for SQLite (pj-air)
 * SPRINT S14: TASK-14-01
 * 
 * In strict compliance with VISION.md §4:
 * Does NOT add, rename, or delete columns/tables.
 * Creates secondary B-Tree indices to eliminate Full Table Scans (SCAN TABLE)
 * and runtime AUTOMATIC COVERING INDEX memory structures in SQLite.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const INDEX_DEFINITIONS = [
  {
    name: 'idx_orders_user_id',
    table: 'orders',
    sql: 'CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);'
  },
  {
    name: 'idx_orders_created_at',
    table: 'orders',
    sql: 'CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);'
  },
  {
    name: 'idx_orders_status',
    table: 'orders',
    sql: 'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);'
  },
  {
    name: 'idx_order_items_order_id',
    table: 'order_items',
    sql: 'CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);'
  },
  {
    name: 'idx_order_items_product_id',
    table: 'order_items',
    sql: 'CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);'
  },
  {
    name: 'idx_addresses_user_id',
    table: 'addresses',
    sql: 'CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);'
  },
  {
    name: 'idx_products_category_id',
    table: 'products',
    sql: 'CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);'
  }
];

function runSql(dbPath, sql) {
  return execSync(`sqlite3 "${dbPath}" "${sql.replace(/"/g, '\\"')}"`, { encoding: 'utf8' });
}

function applyIndexesToDatabase(dbPath) {
  const resolvedPath = path.resolve(dbPath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`[SKIP] Database not found: ${resolvedPath}`);
    return false;
  }

  console.log(`\n======================================================`);
  console.log(`[OPTIMIZE] Applying indexes to: ${resolvedPath}`);
  console.log(`======================================================`);

  for (const idx of INDEX_DEFINITIONS) {
    try {
      runSql(resolvedPath, idx.sql);
      console.log(`  [OK] Index ensured: ${idx.name} on ${idx.table}`);
    } catch (err) {
      console.error(`  [ERROR] Failed to apply ${idx.name}:`, err.message);
    }
  }

  // Verify indices
  const verificationSql = "SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%';";
  const output = runSql(resolvedPath, verificationSql);
  console.log(`\n  Verified secondary indices in ${path.basename(resolvedPath)}:`);
  output.trim().split('\n').forEach(line => {
    if (line) console.log(`    - ${line}`);
  });

  return true;
}

function main() {
  const args = process.argv.slice(2);
  let targets = [];

  if (args.length > 0) {
    targets = args;
  } else {
    // Default targets in backend
    const defaultDbs = [
      path.join(__dirname, '..', 'database.sqlite'),
      path.join(__dirname, '..', 'database.test.sqlite'),
      path.join(__dirname, '..', 'database.remote.prod.bak')
    ];
    targets = defaultDbs.filter(p => fs.existsSync(p));
  }

  console.log(`Found ${targets.length} target database(s) for index application.`);
  for (const target of targets) {
    applyIndexesToDatabase(target);
  }
  console.log(`\n[SUCCESS] All indexes applied idempotently.`);
}

if (require.main === module) {
  main();
}

module.exports = {
  INDEX_DEFINITIONS,
  applyIndexesToDatabase
};
