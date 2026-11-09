const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const REMOTE_BASE = '/var/www/pj-air-testing';

const filesToUpload = [
  { local: 'tool/run_sprint66_certification.js', remote: `${REMOTE_BASE}/tool/run_sprint66_certification.js` },
  { local: 'tool/assets/bread_sample.jpg', remote: `${REMOTE_BASE}/tool/assets/bread_sample.jpg` },
  { local: 'tool/assets/storefront_sample.jpg', remote: `${REMOTE_BASE}/tool/assets/storefront_sample.jpg` },
];

const screenshotsToDownload = [
  'sprint66_01_real_google_maps_live.png',
  'sprint66_02_facade_bread_rejected_ai.png',
  'sprint66_03_facade_storefront_approved_ai.png',
  'sprint66_04_admin_clients_facade_ai_badge.png',
];

const conn = new Client();

function execSimple(client, cmd) {
  return new Promise((resolve, reject) => {
    client.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      let errOut = '';
      stream.on('data', d => { out += d.toString(); });
      stream.stderr.on('data', d => { errOut += d.toString(); });
      stream.on('close', code => {
        if (code !== 0) reject(new Error(`Command "${cmd}" exited with code ${code}: ${errOut}`));
        else resolve(out);
      });
    });
  });
}

conn.on('ready', async () => {
  console.log('[+] SSH Connected to testing VPS');

  try {
    // 1. Ensure directories exist
    await execSimple(conn, `mkdir -p ${REMOTE_BASE}/tool/assets ${REMOTE_BASE}/ui_screenshots ${REMOTE_BASE}/vault/runtime/ui_screenshots`);
    console.log('[+] Remote directories ready');

    // 2. SFTP Uploads
    const sftp = await new Promise((res, rej) => {
      conn.sftp((err, s) => { if (err) rej(err); else res(s); });
    });

    for (const item of filesToUpload) {
      const localPath = path.resolve(__dirname, '..', item.local);
      const content = fs.readFileSync(localPath);
      await new Promise((res, rej) => {
        sftp.writeFile(item.remote, content, (err) => {
          if (err) rej(err);
          else {
            console.log(`[+] Uploaded: ${item.local} -> ${item.remote}`);
            res();
          }
        });
      });
    }

    // 3. Run Playwright certification suite on VPS
    console.log('\n[*] Executing tool/run_sprint66_certification.js on VPS...');
    const runCmd = `cd ${REMOTE_BASE} && node tool/run_sprint66_certification.js`;

    await new Promise((resolve, reject) => {
      conn.exec(runCmd, (err, stream) => {
        if (err) return reject(err);
        stream.on('data', d => process.stdout.write(d));
        stream.stderr.on('data', d => process.stderr.write(d));
        stream.on('close', code => {
          if (code !== 0) reject(new Error(`Playwright run exited with code ${code}`));
          else resolve();
        });
      });
    });

    // 4. Download screenshots
    const localRoot = path.resolve(__dirname, '../ui_screenshots');
    const localVault = path.resolve(__dirname, '../vault/runtime/ui_screenshots');
    if (!fs.existsSync(localRoot)) fs.mkdirSync(localRoot, { recursive: true });
    if (!fs.existsSync(localVault)) fs.mkdirSync(localVault, { recursive: true });

    console.log('\n[*] Downloading screenshots to local workspace...');
    for (const filename of screenshotsToDownload) {
      const remoteShot = `${REMOTE_BASE}/ui_screenshots/${filename}`;
      const localShotRoot = path.join(localRoot, filename);
      const localShotVault = path.join(localVault, filename);

      await new Promise((res, rej) => {
        sftp.fastGet(remoteShot, localShotRoot, (getErr) => {
          if (getErr) rej(getErr);
          else {
            fs.copyFileSync(localShotRoot, localShotVault);
            const stats = fs.statSync(localShotRoot);
            const kb = (stats.size / 1024).toFixed(1);
            console.log(`[+] Preserved: ${filename} (${kb} KB) -> Root & Vault`);
            res();
          }
        });
      });
    }

    console.log('\n============================================================');
    console.log('  ALL S66 CERTIFICATION SCREENSHOTS PRESERVED PHYSICALLY    ');
    console.log('============================================================');
    conn.end();
  } catch (err) {
    console.error('[-] Error executing certification on VPS:', err.message);
    conn.end();
    process.exit(1);
  }
}).connect({
  host: '187.124.67.53',
  port: 22,
  username: 'root',
  privateKey: fs.readFileSync('/home/opc/.ssh/id_ed25519_ruben')
});
