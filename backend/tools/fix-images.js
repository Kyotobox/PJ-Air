const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const IMAGES_DIR = path.join(__dirname, '../../uploads/products');
const DB_PATHS = [
    path.join(__dirname, '../database.sqlite'),
    path.join(__dirname, '../../database.sqlite')
];

async function run() {
    const files = fs.readdirSync(IMAGES_DIR).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));

    for (const dbPath of DB_PATHS) {
        if (!fs.existsSync(dbPath)) continue;
        console.log(`Processing database: ${dbPath}`);
        const db = new sqlite3.Database(dbPath);

        const products = await new Promise((res, rej) => {
            db.all('SELECT id, name, image FROM products', (err, rows) => {
                if (err) rej(err); else res(rows);
            });
        });

        let updated = 0;
        for (const p of products) {
            const cleanName = p.name.replace(/ x10| \(Cold\)/g, '').trim().toLowerCase();
            
            let match = files.find(f => {
                const fName = f.replace(/\.(jpg|png)$/, '').trim().toLowerCase();
                return cleanName.includes(fName) || fName.includes(cleanName);
            });

            if (!match && cleanName.includes('tiramis')) match = files.find(f => f.toLowerCase().includes('tiramis'));
            if (!match && cleanName.includes('black forest')) match = files.find(f => f.toLowerCase().includes('black'));
            if (!match && cleanName.includes('carrot')) match = files.find(f => f.toLowerCase().includes('carrot'));
            if (!match && cleanName.includes('red velvet')) match = files.find(f => f.toLowerCase().includes('red_velvet'));
            if (!match && cleanName.includes('new york')) match = files.find(f => f.toLowerCase().includes('newyork'));

            if (match) {
                const imagePath = `/uploads/products/${match}`;
                if (p.image !== imagePath) {
                    await new Promise(r => db.run('UPDATE products SET image = ? WHERE id = ?', [imagePath, p.id], r));
                    console.log(`Updated product [${p.id}] ${p.name} -> ${imagePath}`);
                    updated++;
                }
            } else {
                console.log(`NO MATCH for product [${p.id}] ${p.name}`);
            }
        }
        console.log(`Finished ${dbPath}. Updated ${updated} items.\n`);
        db.close();
    }
}

run().catch(console.error);
