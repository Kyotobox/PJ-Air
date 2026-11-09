const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const REMOTE_BASE = '/var/www/pj-air-testing';
const filesToSync = [
  'backend/src/addresses/addresses.controller.ts',
  'backend/src/addresses/facade-vision.service.ts',
  'backend/src/addresses/addresses.module.ts',
  'frontend/lib/facade-validation.ts',
  'frontend/components/auth/FacadePhotoUploader.tsx',
  'frontend/app/admin/clients/page.tsx',
];

const conn = new Client();

conn.on('ready', () => {
  console.log('[+] SSH Connected');
  conn.sftp(async (err, sftp) => {
    if (err) {
      console.error('SFTP Error:', err);
      conn.end();
      return;
    }

    try {
      for (const relPath of filesToSync) {
        const localPath = path.resolve(__dirname, '..', relPath);
        const remotePath = `${REMOTE_BASE}/${relPath}`;
        const content = fs.readFileSync(localPath);
        await new Promise((res, rej) => {
          sftp.writeFile(remotePath, content, (writeErr) => {
            if (writeErr) rej(writeErr);
            else {
              console.log(`[+] Uploaded: ${relPath}`);
              res();
            }
          });
        });
      }

      console.log('[+] All files uploaded. Starting build on VPS...');
      const buildCmd = `
        cd ${REMOTE_BASE}/backend && \\
        npm run build && \\
        cd ${REMOTE_BASE}/frontend && \\
        NEXT_PUBLIC_API_URL="https://testing.jhoanes.com/api" NEXT_PUBLIC_GOOGLE_MAPS_KEY="AIzaSyCMfaV6rGZZvsXEqJKWcHCANCUuEwWBc-k" npm run build && \\
        pm2 restart pj-air-backend-testing && \\
        pm2 restart pj-air-frontend-testing && \\
        echo "=== DEPLOYMENT COMPLETED ON TESTING VPS ==="
      `;

      conn.exec(buildCmd, (execErr, stream) => {
        if (execErr) {
          console.error('Exec error:', execErr);
          conn.end();
          return;
        }
        stream.on('close', (code) => {
          console.log(`[+] Finished with exit code: ${code}`);
          conn.end();
        });
        stream.stdout.on('data', d => process.stdout.write(d));
        stream.stderr.on('data', d => process.stderr.write(d));
      });
    } catch (e) {
      console.error('Error during sync:', e);
      conn.end();
    }
  });
}).connect({
  host: '187.124.67.53',
  port: 22,
  username: 'root',
  privateKey: fs.readFileSync('/home/opc/.ssh/id_ed25519_ruben')
});
