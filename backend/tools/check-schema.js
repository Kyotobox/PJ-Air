const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../../database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Checking database at:', dbPath);

db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) {
        console.error('Error listing tables:', err);
        return;
    }
    console.log('Tables:', tables);
    tables.forEach(t => {
        db.all(`PRAGMA table_info(${t.name})`, (err, info) => {
            if (err) {
                console.error(`Error schema for ${t.name}:`, err);
            } else {
                console.log(`Schema for ${t.name}:`, info);
            }
        });
    });
});
setTimeout(() => db.close(), 2000);
