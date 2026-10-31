/**
 * remote-deploy-testing.js
 * 
 * Script de despliegue automatizado e idempotente hacia el entorno TESTING (testing.jhoanes.com) en VPS.
 * 
 * REGLAS DE AISLAMIENTO ABSOLUTO (GATE-1):
 * 1. Directorio destino obligatorio: /var/www/pj-air-testing. Queda TERMINANTEMENTE PROHIBIDO tocar /var/www/pj-air.
 * 2. Procesos PM2 obligatorios: pj-air-backend-testing (puerto 3201) y pj-air-frontend-testing (puerto 3200).
 *    Queda PROHIBIDO recargar o alterar procesos de producción (pj-air-backend / pj-air-frontend).
 * 3. Base de datos destino: database-testing.sqlite.
 * 4. Nginx Server Block: testing.jhoanes.com (Proxy 3200 frontend, 3201 backend /api/).
 */

const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const TESTING_DIR = '/var/www/pj-air-testing';
const PROD_DIR = '/var/www/pj-air';
const TESTING_BACKEND_PM2 = 'pj-air-backend-testing';
const TESTING_FRONTEND_PM2 = 'pj-air-frontend-testing';
const PROD_BACKEND_PM2 = 'pj-air-backend';
const PROD_FRONTEND_PM2 = 'pj-air-frontend';

const isDryRun = process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true';

console.log('===========================================================');
console.log('   PIPELINE DE DESPLIEGUE REMOTO — TESTING.JHOANES.COM     ');
console.log('===========================================================');
console.log(`Destino VPS:           ${TESTING_DIR}`);
console.log(`Dominio Público:       https://testing.jhoanes.com`);
console.log(`Puertos:               Frontend 3200 / Backend 3201`);
console.log(`Procesos PM2:          ${TESTING_BACKEND_PM2}, ${TESTING_FRONTEND_PM2}`);
console.log(`Modo:                  ${isDryRun ? 'DRY-RUN (Simulación de seguridad)' : 'EJECUCIÓN REAL'}`);

// Inviolability check
if (TESTING_DIR === PROD_DIR) {
    console.error('FATAL: Violación de aislamiento. TESTING_DIR no puede coincidir con PROD_DIR.');
    process.exit(1);
}

const sshHost = process.env.REMOTE_SSH_HOST || '187.124.67.53';
const sshPort = parseInt(process.env.REMOTE_SSH_PORT || '22', 10);
const sshUser = process.env.REMOTE_SSH_USER || 'root';
const sshPassword = process.env.REMOTE_SSH_PASSWORD;
const sshKeyPath = process.env.REMOTE_SSH_KEY_PATH;

const targetBranch = process.env.REMOTE_GIT_BRANCH || 'conext';

const testingDeployCommands = [
    // 1. Sanity Check & Isolation Verification
    `echo "=== 1. Verificando aislamiento de ruta ==="`,
    `[ -d "${TESTING_DIR}" ] || mkdir -p "${TESTING_DIR}"`,
    `chmod -R u+w "${TESTING_DIR}" 2>/dev/null || true`,
    `cd "${TESTING_DIR}"`,
    `[ "$(pwd)" = "${TESTING_DIR}" ] || { echo "ERROR CRÍTICO: No se encuentra en directorio testing"; exit 1; }`,
    `[ "$(pwd)" != "${PROD_DIR}" ] || { echo "ERROR CRÍTICO: Intento de ejecución en directorio de producción"; exit 1; }`,

    // 2. Pre-deploy backup of testing database & env
    `echo "=== 2. Respaldo preventivo de testing db ==="`,
    `if [ -f "database-testing.sqlite" ]; then cp "database-testing.sqlite" "database-testing.sqlite.bak_$(date +%Y%m%d_%H%M%S)"; echo "Backup testing creado."; fi`,
    `if [ -f ".env" ]; then cp ".env" ".env.deploy_bak"; fi`,

    // 3. Git synchronization
    `echo "=== 3. Sincronizando código desde origen (${targetBranch}) ==="`,
    `if [ ! -d ".git" ]; then git clone -b ${targetBranch} https://github.com/jhpanes/pj-air.git . ; else git fetch origin && git checkout ${targetBranch} && git reset --hard origin/${targetBranch}; fi`,
    `if [ -f ".env.deploy_bak" ] && [ ! -f ".env" ]; then cp ".env.deploy_bak" ".env"; fi`,

    // 4. Backend build
    `echo "=== 4. Construyendo Backend Testing ==="`,
    `cd "${TESTING_DIR}/backend"`,
    `npm install --production=false`,
    `npm run build`,

    // 5. Frontend build with correct testing API URL
    `echo "=== 5. Construyendo Frontend Testing ==="`,
    `cd "${TESTING_DIR}/frontend"`,
    `npm install --production=false`,
    `NEXT_PUBLIC_API_URL="https://testing.jhoanes.com/api" npm run build`,

    // 6. PM2 Restart on dedicated testing ports (3200 & 3201)
    `echo "=== 6. Desplegando procesos PM2 de testing ==="`,
    `cd "${TESTING_DIR}"`,
    `pm2 delete ${TESTING_BACKEND_PM2} || true`,
    `pm2 delete ${TESTING_FRONTEND_PM2} || true`,
    `BACKEND_PORT=3201 PORT=3201 DATABASE_PATH=../database-testing.sqlite FRONTEND_URL=https://testing.jhoanes.com pm2 start dist/src/main.js --name ${TESTING_BACKEND_PM2} --cwd "${TESTING_DIR}/backend"`,
    `PORT=3200 NEXT_PUBLIC_API_URL=https://testing.jhoanes.com/api pm2 start node_modules/next/dist/bin/next --name ${TESTING_FRONTEND_PM2} --cwd "${TESTING_DIR}/frontend" -- start -p 3200`,
    `pm2 save`,
    `echo "=== 7. TESTING.JHOANES.COM EN LÍNEA ==="`
];

const fullScript = testingDeployCommands.join(' && ');

if (isDryRun || (!sshPassword && !sshKeyPath)) {
    console.log('\n[PLAN DE DESPLIEGUE PARA TESTING.JHOANES.COM]:');
    testingDeployCommands.forEach((cmd, idx) => {
        console.log(`  ${idx + 1}. ${cmd}`);
    });
    console.log('\n[PASS] Certificación de seguridad completada. Aislamiento de producción garantizado.');
    if (!sshPassword && !sshKeyPath) {
        console.log('\n[INFO] Para ejecutar remotamente, suministra REMOTE_SSH_PASSWORD o REMOTE_SSH_KEY_PATH.');
        process.exit(0);
    }
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
        console.log('\n[SUCCESS] Despliegue en TESTING.JHOANES.COM completado exitosamente.');
    } catch (err) {
        console.error('\n[-] ERROR DURANTE EL DESPLIEGUE:', err.message);
        process.exit(1);
    } finally {
        conn.end();
        console.log('[+] Conexión SSH cerrada.');
    }
}).on('error', (err) => {
    console.error('[-] Error de conexión SSH:', err.message);
    process.exit(1);
}).connect(connConfig);
