const { Client } = require('ssh2');
const fs = require('fs');

const REMOTE_BASE = '/var/www/pj-air-testing';

const conn = new Client();

conn.on('ready', () => {
  console.log('[+] SSH Connected to 187.124.67.53');
  
  const deployCmd = `
    echo "=== 1. Git pull on testing ===" && \\
    cd ${REMOTE_BASE} && \\
    git fetch origin conext && \\
    git reset --hard origin/conext && \\
    echo "=== 2. Rebuilding frontend testing ===" && \\
    cd ${REMOTE_BASE}/frontend && \\
    NEXT_PUBLIC_API_URL="https://testing.jhoanes.com/api" NEXT_PUBLIC_GOOGLE_MAPS_KEY="AIzaSyCMfaV6rGZZvsXEqJKWcHCANCUuEwWBc-k" npm run build && \\
    echo "=== 3. Restarting PM2 processes ===" && \\
    pm2 restart pj-air-frontend-testing && \\
    echo "=== DEPLOYMENT S67 SUCCESSFUL ==="
  `;

  conn.exec(deployCmd, (err, stream) => {
    if (err) {
      console.error('Exec error:', err);
      conn.end();
      process.exit(1);
    }

    stream.on('close', (code, signal) => {
      console.log(`[+] Remote execution closed with code: ${code}`);
      conn.end();
      process.exit(code || 0);
    });

    stream.stdout.on('data', data => process.stdout.write(data));
    stream.stderr.on('data', data => process.stderr.write(data));
  });
}).on('error', (err) => {
  console.error('Connection error:', err);
  process.exit(1);
}).connect({
  host: '187.124.67.53',
  port: 22,
  username: 'root',
  privateKey: fs.readFileSync('/home/opc/.ssh/id_ed25519_ruben')
});
