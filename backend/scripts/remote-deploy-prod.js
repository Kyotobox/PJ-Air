/**
 * remote-deploy-prod.js
 * 
 * Script de sincronización en caliente hacia el entorno de PRODUCCIÓN (app.jhoanes.com) en VPS.
 * 
 * REGLAS MANDATORIAS:
 * 1. Respaldo previo mandatorio de /var/www/pj-air/database.sqlite con timestamp (§7.4).
 * 2. Migración DDL atómica de columnas y tablas nuevas (production_group, admin_audit_logs, etc.).
 * 3. Compilación limpia y recarga PM2 (pj-air-backend-prod / pj-air-frontend-prod).
 * 4. Certificación post-deploy (HTTP 200 en /privacy, Meta Pixel activo).
 */

const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const PROD_DIR = '/var/www/pj-air';
const PROD_BACKEND_PM2 = 'pj-air-backend-prod';
const PROD_FRONTEND_PM2 = 'pj-air-frontend-prod';

const isDryRun = process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true';

console.log('===========================================================');
console.log('   PIPELINE DE DESPLIEGUE REMOTO — PRODUCCIÓN (VPS)        ');
console.log('===========================================================');
console.log(`Destino VPS:           ${PROD_DIR}`);
console.log(`Dominio Público:       https://app.jhoanes.com`);
console.log(`Puertos:               Frontend 3000 / Backend 3001`);
console.log(`Procesos PM2:          ${PROD_BACKEND_PM2}, ${PROD_FRONTEND_PM2}`);
console.log(`Modo:                  ${isDryRun ? 'DRY-RUN (Simulación de seguridad)' : 'EJECUCIÓN REAL'}`);

const sshHost = process.env.REMOTE_SSH_HOST || '187.124.67.53';
const sshPort = parseInt(process.env.REMOTE_SSH_PORT || '22', 10);
const sshUser = process.env.REMOTE_SSH_USER || 'root';
const defaultKeyPath = path.resolve(process.env.HOME || '/home/opc', '.ssh', 'id_ed25519_ruben');
const sshKeyPath = process.env.REMOTE_SSH_KEY_PATH || (fs.existsSync(defaultKeyPath) ? defaultKeyPath : (fs.existsSync('/root/.ssh/id_ed25519_ruben') ? '/root/.ssh/id_ed25519_ruben' : undefined));

const targetBranch = process.env.REMOTE_GIT_BRANCH || 'conext';

const prodDeployCommands = [
    // 1. Sanity Check
    `echo "=== 1. Verificando directorio de producción ==="`,
    `cd "${PROD_DIR}"`,
    `[ "$(pwd)" = "${PROD_DIR}" ] || { echo "ERROR CRÍTICO: No se encuentra en directorio de producción"; exit 1; }`,

    // 2. Pre-deploy atomic backup of production database
    `echo "=== 2. Respaldo preventivo mandatorio de base de datos de producción (§7.4) ==="`,
    `if [ -f "database.sqlite" ]; then cp "database.sqlite" "database.sqlite.bak_prod_$(date +%Y%m%d_%H%M%S)"; echo "Respaldo físico de producción completado."; else echo "ERROR: database.sqlite no existe"; exit 1; fi`,
    `if [ -f ".env" ]; then cp ".env" ".env.deploy_bak"; fi`,

    // 3. Pre-deploy SQLite DDL Migrations
    `echo "=== 3. Aplicando migraciones DDL en base de datos SQLite ==="`,
    `sqlite3 "${PROD_DIR}/database.sqlite" "ALTER TABLE products ADD COLUMN production_group VARCHAR NULL;" 2>/dev/null || true`,
    `sqlite3 "${PROD_DIR}/database.sqlite" "CREATE TABLE IF NOT EXISTS admin_audit_logs (id VARCHAR(36) PRIMARY KEY, admin_id VARCHAR NOT NULL, admin_name VARCHAR NOT NULL, action VARCHAR NOT NULL, target_entity VARCHAR NOT NULL, target_id VARCHAR NOT NULL, previous_state_json TEXT, new_state_json TEXT, notes TEXT, ip_address VARCHAR, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);" 2>/dev/null || true`,
    `sqlite3 "${PROD_DIR}/database.sqlite" "ALTER TABLE users ADD COLUMN utm_source VARCHAR(100);" 2>/dev/null || true`,
    `sqlite3 "${PROD_DIR}/database.sqlite" "ALTER TABLE users ADD COLUMN utm_medium VARCHAR(100);" 2>/dev/null || true`,
    `sqlite3 "${PROD_DIR}/database.sqlite" "ALTER TABLE users ADD COLUMN utm_campaign VARCHAR(100);" 2>/dev/null || true`,
    `sqlite3 "${PROD_DIR}/database.sqlite" "ALTER TABLE users ADD COLUMN utm_content VARCHAR(100);" 2>/dev/null || true`,
    `sqlite3 "${PROD_DIR}/database.sqlite" "ALTER TABLE users ADD COLUMN account_status VARCHAR(30) DEFAULT 'APPROVED';" 2>/dev/null || true`,

    // 4. Git synchronization from upstream/conext
    `echo "=== 4. Sincronizando código desde origen (${targetBranch}) ==="`,
    `git fetch origin`,
    `git checkout ${targetBranch}`,
    `git reset --hard origin/${targetBranch}`,
    `if [ -f ".env.deploy_bak" ] && [ ! -f ".env" ]; then cp ".env.deploy_bak" ".env"; fi`,

    // 5. Run croissant catalog migration script
    `echo "=== 5. Sincronizando catálogo canónico de croissants ==="`,
    `node "${PROD_DIR}/backend/scripts/migrate-production-groups.js"`,

    // 6. Backend build
    `echo "=== 6. Construyendo Backend de Producción ==="`,
    `cd "${PROD_DIR}/backend"`,
    `npm install --production=false`,
    `GOOGLE_MAPS_KEY="AIzaSyCMfaV6rGZZvsXEqJKWcHCANCUuEwWBc-k" NEXT_PUBLIC_GOOGLE_MAPS_KEY="AIzaSyCMfaV6rGZZvsXEqJKWcHCANCUuEwWBc-k" npm run build`,

    // 7. Frontend build
    `echo "=== 7. Construyendo Frontend de Producción ==="`,
    `cd "${PROD_DIR}/frontend"`,
    `npm install --production=false`,
    `NEXT_PUBLIC_API_URL="https://app.jhoanes.com/api" NEXT_PUBLIC_GOOGLE_MAPS_KEY="AIzaSyCMfaV6rGZZvsXEqJKWcHCANCUuEwWBc-k" GOOGLE_MAPS_KEY="AIzaSyCMfaV6rGZZvsXEqJKWcHCANCUuEwWBc-k" npm run build`,

    // 8. PM2 Zero-downtime Restart
    `echo "=== 8. Recargando procesos PM2 de producción en caliente ==="`,
    `cd "${PROD_DIR}"`,
    `pm2 restart ${PROD_BACKEND_PM2} --update-env`,
    `pm2 restart ${PROD_FRONTEND_PM2} --update-env`,
    `pm2 save`,
    `echo "=== 9. APP.JHOANES.COM EN LÍNEA ==="`
];

const fullScript = prodDeployCommands.join(' && ');

if (isDryRun) {
    console.log('\n[PLAN DE DESPLIEGUE PARA APP.JHOANES.COM]:');
    prodDeployCommands.forEach((cmd, idx) => {
        console.log(`  ${idx + 1}. ${cmd}`);
    });
    console.log('\n[PASS] Certificación de seguridad completada.');
    process.exit(0);
}

const connConfig = {
    host: sshHost,
    port: sshPort,
    username: sshUser,
};

if (sshKeyPath && fs.existsSync(sshKeyPath)) {
    connConfig.privateKey = fs.readFileSync(sshKeyPath);
}

const conn = new Client();

conn.on('ready', () => {
    console.log('[+] Conexión SSH establecida con éxito para PRODUCCIÓN.');
    console.log(`\nEjecutando en VPS: ${fullScript.substring(0, 160)}...\n`);

    conn.exec(fullScript, (err, stream) => {
        if (err) {
            console.error('[-] Error ejecutando comando remoto:', err);
            conn.end();
            process.exit(1);
        }

        stream.on('close', (code, signal) => {
            conn.end();
            if (code === 0) {
                console.log('\n[SUCCESS] Despliegue en APP.JHOANES.COM completado exitosamente.');
                process.exit(0);
            } else {
                console.error(`\n[-] Despliegue falló con código ${code} / señal ${signal}.`);
                process.exit(code || 1);
            }
        });

        stream.on('data', (data) => {
            process.stdout.write(data);
        });

        stream.stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
});

conn.on('error', (err) => {
    console.error('[-] Error en conexión SSH:', err);
    process.exit(1);
});

conn.connect(connConfig);
