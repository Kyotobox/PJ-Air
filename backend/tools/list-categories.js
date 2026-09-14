const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../../database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Checking categories at:', dbPath);

db.all("SELECT DISTINCT category FROM products", (err, rows) => {
    if (err) {
        console.error('Error listing categories:', err);
        return;
    }
    console.log('Categories:', rows);
});
setTimeout(() => db.close(), 2000);
