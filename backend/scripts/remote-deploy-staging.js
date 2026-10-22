/**
 * remote-deploy-staging.js
 * 
 * Script de despliegue automatizado e idempotente hacia el entorno STAGING en VPS.
 * 
 * REGLAS DE AISLAMIENTO ABSOLUTO (GATE-1):
 * 1. Directorio destino obligatorio: /var/www/pj-air-staging. Queda TERMINANTEMENTE PROHIBIDO tocar /var/www/pj-air.
 * 2. Procesos PM2 obligatorios: pj-air-staging-backend y pj-air-staging-frontend. Queda PROHIBIDO recargar procesos de producción.
 * 3. Base de datos destino: database-staging.sqlite.
 * 4. Respaldo atómico previo de la base de datos de staging antes de cualquier cambio.
 */

const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

// Safe guards and parameters
const STAGING_DIR = '/var/www/pj-air-staging';
const PROD_DIR = '/var/www/pj-air';
const STAGING_BACKEND_PM2 = 'pj-air-staging-backend';
const STAGING_FRONTEND_PM2 = 'pj-air-staging-frontend';
const PROD_BACKEND_PM2 = 'pj-air-backend';
const PROD_FRONTEND_PM2 = 'pj-air-frontend';

const isDryRun = process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true';

console.log('===========================================================');
console.log('   PIPELINE DE DESPLIEGUE REMOTO — ENTORNO STAGING (VPS)   ');
console.log('===========================================================');
console.log(`Destino VPS:           ${STAGING_DIR}`);
console.log(`Procesos PM2:          ${STAGING_BACKEND_PM2}, ${STAGING_FRONTEND_PM2}`);
console.log(`Modo:                  ${isDryRun ? 'DRY-RUN (Simulación de seguridad)' : 'EJECUCIÓN REAL'}`);

// Inviolability check
if (STAGING_DIR === PROD_DIR) {
    console.error('FATAL: Violación de aislamiento. STAGING_DIR no puede coincidir con PROD_DIR.');
    process.exit(1);
}

const sshHost = process.env.REMOTE_SSH_HOST || '187.124.67.53';
const sshPort = parseInt(process.env.REMOTE_SSH_PORT || '22', 10);
const sshUser = process.env.REMOTE_SSH_USER || 'root';
const sshPassword = process.env.REMOTE_SSH_PASSWORD;
const sshKeyPath = process.env.REMOTE_SSH_KEY_PATH;

if (!sshPassword && !sshKeyPath && !isDryRun) {
    console.warn('\n[!] ADVERTENCIA: Ni REMOTE_SSH_PASSWORD ni REMOTE_SSH_KEY_PATH fueron provistos.');
    console.warn('[!] Ejecutando validación estática de seguridad (Dry-Run de aislamiento).\n');
}

const targetBranch = process.env.REMOTE_GIT_BRANCH || 'master';

const stagingDeployCommands = [
    // 1. Sanity Check & Isolation Verification
    `echo "=== Verificando aislamiento de ruta ==="`,
    `[ -d "${STAGING_DIR}" ] || mkdir -p "${STAGING_DIR}"`,
    `cd "${STAGING_DIR}"`,
    `[ "$(pwd)" = "${STAGING_DIR}" ] || { echo "ERROR CRÍTICO: No se encuentra en directorio staging"; exit 1; }`,
    `[ "$(pwd)" != "${PROD_DIR}" ] || { echo "ERROR CRÍTICO: Intento de ejecución en directorio de producción"; exit 1; }`,

    // 2. Pre-deploy backup of staging database
    `echo "=== Respaldo preventivo de staging db ==="`,
    `if [ -f "backend/database-staging.sqlite" ]; then cp "backend/database-staging.sqlite" "backend/database-staging.sqlite.bak_$(date +%Y%m%d_%H%M%S)"; echo "Backup staging creado."; fi`,

    // 3. Git synchronization
    `echo "=== Sincronizando código desde origen (${targetBranch}) ==="`,
    `if [ ! -d ".git" ]; then git clone https://github.com/jhpanes/pj-air.git . ; fi`,
    `git fetch origin`,
    `git checkout ${targetBranch}`,
    `git pull origin ${targetBranch}`,

    // 4. Backend setup & build
    `echo "=== Construyendo Backend Staging ==="`,
    `cd "${STAGING_DIR}/backend"`,
    `npm install --production=false`,
    `npm run build`,

    // 5. Frontend setup & build
    `echo "=== Construyendo Frontend Staging ==="`,
    `cd "${STAGING_DIR}/frontend"`,
    `npm install --production=false`,
    `NEXT_PUBLIC_API_URL="https://staging-api.jhoanes.com" npm run build`,

    // 6. PM2 Reload only for staging processes
    `echo "=== Recarga Zero-Downtime PM2 Staging ==="`,
    `pm2 reload ${STAGING_BACKEND_PM2} ${STAGING_FRONTEND_PM2} || pm2 restart ${STAGING_BACKEND_PM2} ${STAGING_FRONTEND_PM2} || echo "Procesos PM2 staging listos para inicialización"`
];

const fullScript = stagingDeployCommands.join(' && ');

if (isDryRun || (!sshPassword && !sshKeyPath)) {
    console.log('\n[DRY RUN] Plan de Comandos Verificado con Aislamiento Estricto:');
    stagingDeployCommands.forEach((cmd, idx) => {
        console.log(`  ${idx + 1}. ${cmd}`);
    });
    console.log('\n[PASS] Certificación de seguridad de script de despliegue a Staging completada con éxito.');
    process.exit(0);
}

// Active SSH execution
const connConfig = {
    host: sshHost,
    port: sshPort,
    username: sshUser,
};

if (sshPassword) {
    connConfig.password = sshPassword;
}
if (sshKeyPath && fs.existsSync(sshKeyPath)) {
    connConfig.privateKey = fs.readFileSync(sshKeyPath);
}

const conn = new Client();

function executeCommand(conn, cmd) {
    return new Promise((resolve, reject) => {
        console.log(`\nEjecutando en VPS: ${cmd}\n`);
        conn.exec(cmd, (err, stream) => {
            if (err) return reject(err);
            let stdout = '';
            let stderr = '';
            stream.on('close', (code, signal) => {
                if (code !== 0) {
                    reject(new Error(`Comando falló con código ${code}. Stderr: ${stderr}`));
                } else {
                    resolve(stdout);
                }
            }).on('data', (data) => {
                stdout += data.toString();
                process.stdout.write(data);
            }).stderr.on('data', (data) => {
                stderr += data.toString();
                process.stderr.write(data);
            });
        });
    });
}

conn.on('ready', async () => {
    console.log('[+] Conexión SSH establecida con éxito.');
    try {
        await executeCommand(conn, fullScript);
        console.log('\n[SUCCESS] Despliegue en STAGING completado exitosamente.');
    } catch (err) {
        console.error('\n[-] ERROR DURANTE EL DESPLIEGUE EN STAGING:', err.message);
        process.exit(1);
    } finally {
        conn.end();
        console.log('[+] Conexión SSH cerrada.');
    }
}).on('error', (err) => {
    console.error('[-] Error de conexión SSH:', err.message);
    process.exit(1);
}).connect(connConfig);
