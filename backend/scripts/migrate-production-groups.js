/**
 * Migration script for TASK-83-03:
 * Adds production_group column to products table and assigns canonical groups
 * to croissants across local databases (backend/database.sqlite, backend/database.test.sqlite, database.sqlite).
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const CANONICAL_25 = [
  // Grupo 1: Plain (Base) (11)
  { name: 'Artisanal Croissant', group: '1', price: 4.50, desc: 'Classic butter croissant with crispy golden layers.' },
  { name: 'Blueberry Lavender Croissant', group: '1', price: 5.25, desc: 'French butter croissant infused with wild blueberries and subtle lavender essence.' },
  { name: 'Cookie Croissant', group: '1', price: 5.50, desc: 'Flaky croissant loaded with homemade chocolate chip cookie dough.' },
  { name: 'Dubai Chocolate Croiss', group: '1', price: 6.50, desc: 'Crispy kadaif and rich pistachio cream encased in a butter croissant.' },
  { name: 'Dulce de Leche Croissant', group: '1', price: 5.00, desc: 'Filled with decadent artisanal dulce de leche.' },
  { name: 'Lemon Pie Croissant', group: '1', price: 5.25, desc: 'Zesty lemon curd topped with toasted Italian meringue.' },
  { name: 'Mango Croissant', group: '1', price: 5.25, desc: 'Filled with tropical mango compote and vanilla pastry cream.' },
  { name: 'Nutella Strawberry Croissant', group: '1', price: 5.75, desc: 'Filled with creamy Nutella and fresh local strawberries.' },
  { name: 'Pineapple Coconut Croissant', group: '1', price: 5.25, desc: 'Tropical coconut cream and caramelized pineapple.' },
  { name: 'Strawberry Croissant', group: '1', price: 5.25, desc: 'Fresh strawberries and light diplomat cream.' },
  { name: 'Tiramisu Croissant', group: '1', price: 5.50, desc: 'Espresso soaked croissant layers with velvety mascarpone.' },

  // Grupo 2: Colores / Masas Especiales (10)
  { name: 'Almond Croissant', group: '2', price: 5.25, desc: 'Twice baked almond croissant with rich frangipane filling.' },
  { name: 'Banoffee Croissant', group: '2', price: 5.50, desc: 'Specialty dough with dulce de leche, banana and coffee cream.' },
  { name: 'Beef Puff Pastry', group: '2', price: 5.75, desc: 'Savory golden puff pastry filled with seasoned prime beef.' },
  { name: 'Chicken Puff Pastry', group: '2', price: 5.50, desc: 'Savory puff pastry with slow roasted seasoned chicken.' },
  { name: 'Chocolate Mousse Croissant', group: '2', price: 5.50, desc: 'Bicolor cacao dough filled with decadent Belgian dark chocolate mousse.' },
  { name: 'Fruit Danish', group: '2', price: 5.00, desc: 'Traditional Danish dough topped with seasonal fresh fruits.' },
  { name: 'Nutella New York Roll', group: '2', price: 6.00, desc: 'Circular laminated roll filled with rich Nutella.' },
  { name: 'Pain au Chocolat', group: '2', price: 4.75, desc: 'Classic French laminated pastry with dark chocolate batons.' },
  { name: 'Pistachio Croissant', group: '2', price: 5.75, desc: 'Bicolor pistachio dough with roasted pistachio frangipane.' },
  { name: 'Raspberry Croissant', group: '2', price: 5.25, desc: 'Bicolor raspberry dough filled with tart raspberry coulis.' },

  // Grupo 3: Small Croissants (4)
  { name: 'Small Artisanal Croissant', group: '3', price: 2.50, desc: 'Mini traditional French butter croissant.' },
  { name: 'Small Chocolate Mousse Croissant', group: '3', price: 2.95, desc: 'Mini bicolor cacao croissant filled with dark chocolate mousse.' },
  { name: 'Small Pistachio Croissant', group: '3', price: 3.10, desc: 'Mini bicolor croissant with pistachio cream.' },
  { name: 'Small Raspberry Croissant', group: '3', price: 2.95, desc: 'Mini bicolor croissant with raspberry coulis.' }
];

const G1_MATCHES = [
  'Artisanal Croissant', 'Blueberry Lavender Croissant', 'Cookie Croissant',
  'Dubai Chocolate Croiss', 'Dubai Chocolate Croissant', 'Dulce de Leche Croissant',
  'Lemon Pie Croissant', 'Mango Croissant', 'Mango Croissant Tart',
  'Nutella Strawberry Croissant', 'Pineapple Coconut Croissant', 'Strawberry Croissant',
  'Tiramisu Croissant', 'Tiramisu Danish', 'Guava Cream Cheese Croissant',
  'Fruit & Cream Croissant', 'Brulee Croissant Tart'
];

const G2_MATCHES = [
  'Almond Croissant', 'Banoffee Croissant', 'Beef Puff Pastry', 'Chicken Puff Pastry',
  'Chocolate Mousse Croissant', 'Fruit Danish', 'Nutella New York Roll',
  'Pain au Chocolat', 'Pistachio Croissant', 'Raspberry Croissant',
  'Pain Suisse', 'Cheese Croissant', 'Turkey Bacon & Cheese Croissant',
  'Chicken Pan Swiss (Croissant)', 'Beef Pan Swiss (Croissant)'
];

const G3_MATCHES = [
  'Small Artisanal Croissant', 'Small Chocolate Mousse Croissant',
  'Small Pistachio Croissant', 'Small Raspberry Croissant'
];

const dbPaths = [
  path.resolve(__dirname, '../database.sqlite'),
  path.resolve(__dirname, '../database.test.sqlite'),
  path.resolve(__dirname, '../../database.sqlite')
];

for (const dbPath of dbPaths) {
  if (!fs.existsSync(dbPath)) continue;
  console.log(`[MIGRATE] Processing database: ${dbPath}`);
  const db = new Database(dbPath);

  try {
    // 1. Add column if missing
    const tableInfo = db.pragma('table_info(products)');
    const hasColumn = tableInfo.some(col => col.name === 'production_group');
    if (!hasColumn) {
      db.exec('ALTER TABLE products ADD COLUMN production_group VARCHAR NULL');
      console.log(`  Added column production_group`);
    }

    // 2. Resolve croissant category id
    const catRow = db.prepare("SELECT id FROM categories WHERE LOWER(name) LIKE '%croissant%' ORDER BY id LIMIT 1").get();
    const croissantCatId = catRow ? catRow.id : 1;

    // 3. Update existing products
    const updateStmt = db.prepare('UPDATE products SET production_group = ? WHERE LOWER(name) = LOWER(?)');
    for (const name of G1_MATCHES) updateStmt.run('1', name);
    for (const name of G2_MATCHES) updateStmt.run('2', name);
    for (const name of G3_MATCHES) updateStmt.run('3', name);

    // 4. Ensure canonical 25 exist
    const findStmt = db.prepare('SELECT id FROM products WHERE LOWER(name) = LOWER(?)');
    const updateById = db.prepare('UPDATE products SET production_group = ? WHERE id = ?');
    const insertStmt = db.prepare(`
      INSERT INTO products (name, price, description, is_deleted, category_id, production_group)
      VALUES (?, ?, ?, 0, ?, ?)
    `);

    for (const item of CANONICAL_25) {
      const existing = findStmt.get(item.name);
      if (existing) {
        updateById.run(item.group, existing.id);
      } else {
        insertStmt.run(item.name, item.price, item.desc, croissantCatId, item.group);
        console.log(`  Inserted missing canonical: ${item.name} (Group ${item.group})`);
      }
    }

    const summary = db.prepare('SELECT production_group, COUNT(*) as count FROM products WHERE production_group IS NOT NULL GROUP BY production_group').all();
    console.log(`  Summary for ${path.basename(dbPath)}:`, summary);
  } finally {
    db.close();
  }
}

console.log('[MIGRATE] All databases successfully migrated with production_group.');
