const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { Client } = require('ssh2');

const EMAIL = 'dcueto@atax.com';
const RAW_PASSWORD = process.env.AUDITOR_PASSWORD || 'AtaxAuditor2026!';
const FULL_NAME = 'Daniel Cueto (ATAX)';
const COMPANY_NAME = 'ATAX Commercial & Tax Services';
const ROLE = 'auditor';

// Hash using project PBKDF2 standard (210,000 iterations, sha512)
const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.pbkdf2Sync(RAW_PASSWORD, salt, 210000, 64, 'sha512').toString('hex');
const storedPassword = `${salt}:${hash}`;
const userId = crypto.randomUUID();

console.log('=== CREACIÓN DE USUARIO AUDITOR ===');
console.log(`Email:       ${EMAIL}`);
console.log(`Password:    ${RAW_PASSWORD}`);
console.log(`Role:        ${ROLE}`);
console.log(`Full Name:   ${FULL_NAME}`);
console.log(`User ID:     ${userId}`);

// 1. Inserción local si existe database.sqlite
const localDbPath = path.resolve(__dirname, '../database.sqlite');
if (fs.existsSync(localDbPath)) {
  const db = new sqlite3.Database(localDbPath);
  db.serialize(() => {
    db.run("ALTER TABLE users ADD COLUMN account_status VARCHAR(30) DEFAULT 'APPROVED';", () => {});
    db.run(
      `INSERT INTO users (id, email, password, role)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET password = excluded.password, role = excluded.role;`,
      [userId, EMAIL, storedPassword, ROLE],
      function (err) {
        if (err) console.error('Error insertando en db local users:', err.message);
        else console.log('[OK] Usuario registrado/actualizado en base de datos LOCAL.');
      }
    );

    db.run(
      `INSERT INTO profiles (id, full_name, company_name, phone_verified)
       VALUES (?, ?, ?, 1)
       ON CONFLICT(id) DO UPDATE SET full_name = excluded.full_name, company_name = excluded.company_name;`,
      [userId, FULL_NAME, COMPANY_NAME],
      function (err) {
        if (err) console.error('Error insertando en db local profiles:', err.message);
        else console.log('[OK] Perfil registrado/actualizado en base de datos LOCAL.');
      }
    );
  });
  db.close();
}

// 2. Inserción en VPS Remoto (Producción y Testing)
const sshKeyPath = path.resolve(process.env.HOME || '/home/opc', '.ssh', 'id_ed25519_ruben');
if (fs.existsSync(sshKeyPath)) {
  const conn = new Client();
  const remoteSql = `
    sqlite3 /var/www/pj-air/database.sqlite "INSERT INTO users (id, email, password, role, account_status) VALUES ('${userId}', '${EMAIL}', '${storedPassword}', '${ROLE}', 'APPROVED') ON CONFLICT(email) DO UPDATE SET password = excluded.password, role = excluded.role, account_status = 'APPROVED';"
    sqlite3 /var/www/pj-air/database.sqlite "INSERT INTO profiles (id, full_name, company_name, phone_verified) VALUES ('${userId}', '${FULL_NAME}', '${COMPANY_NAME}', 1) ON CONFLICT(id) DO UPDATE SET full_name = excluded.full_name, company_name = excluded.company_name;"
    sqlite3 /var/www/pj-air-testing/database-testing.sqlite "INSERT INTO users (id, email, password, role, account_status) VALUES ('${userId}', '${EMAIL}', '${storedPassword}', '${ROLE}', 'APPROVED') ON CONFLICT(email) DO UPDATE SET password = excluded.password, role = excluded.role, account_status = 'APPROVED';"
    sqlite3 /var/www/pj-air-testing/database-testing.sqlite "INSERT INTO profiles (id, full_name, company_name, phone_verified) VALUES ('${userId}', '${FULL_NAME}', '${COMPANY_NAME}', 1) ON CONFLICT(id) DO UPDATE SET full_name = excluded.full_name, company_name = excluded.company_name;"
    echo "VPS_PROD_TESTING_SUCCESS"
  `;

  conn.on('ready', () => {
    console.log('[+] Conectado a VPS para aprovisionamiento de usuario...');
    conn.exec(remoteSql, (err, stream) => {
      if (err) {
        console.error('Error ejecutando script en VPS:', err);
        conn.end();
        return;
      }
      stream.on('data', data => process.stdout.write(data));
      stream.on('close', () => {
        console.log('[+] Usuario auditor aprovisionado en PRODUCCIÓN y TESTING.');
        conn.end();
      });
    });
  }).connect({
    host: '187.124.67.53',
    port: 22,
    username: 'root',
    privateKey: fs.readFileSync(sshKeyPath)
  });
}
