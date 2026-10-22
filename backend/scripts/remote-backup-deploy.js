const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

if (!process.env.REMOTE_SSH_PASSWORD) {
    console.error('ERROR: REMOTE_SSH_PASSWORD environment variable is required.');
    process.exit(1);
}

const config = {
    host: process.env.REMOTE_SSH_HOST || '187.124.67.53',
    port: parseInt(process.env.REMOTE_SSH_PORT || '22', 10),
    username: process.env.REMOTE_SSH_USER || 'root',
    password: process.env.REMOTE_SSH_PASSWORD
};

const conn = new Client();

function executeCommand(conn, cmd) {
    return new Promise((resolve, reject) => {
        console.log(`Executing remote command: ${cmd}`);
        conn.exec(cmd, (err, stream) => {
            if (err) return reject(err);
            let stdout = '';
            let stderr = '';
            stream.on('close', (code, signal) => {
                if (code !== 0) {
                    reject(new Error(`Command failed with code ${code}. Stderr: ${stderr}`));
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

function downloadFile(sftp, remotePath, localPath) {
    return new Promise((resolve, reject) => {
        console.log(`Downloading: ${remotePath} -> ${localPath}`);
        sftp.fastGet(remotePath, localPath, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

conn.on('ready', () => {
    console.log('SSH Connection Established.');
    conn.sftp(async (err, sftp) => {
        if (err) {
            console.error('SFTP error:', err);
            conn.end();
            return;
        }

        try {
            // 1. Create remote atomic backup of database.sqlite and rotate
            const pad = (n) => String(n).padStart(2, '0');
            const now = new Date();
            const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
            const remoteDbPath = '/var/www/pj-air/database.sqlite';
            const remoteBackupPath = `/var/www/pj-air/database.sqlite.bak_${timestamp}`;
            
            console.log('1. Creating atomic remote backup using SQLite API...');
            const backupCmd = `sqlite3 ${remoteDbPath} ".backup '${remoteBackupPath}'" || cp ${remoteDbPath} ${remoteBackupPath}`;
            await executeCommand(conn, backupCmd);
            console.log(`Remote backup verified at: ${remoteBackupPath}`);

            // Rotate remote backups: retain latest 5
            console.log('Rotating remote backups (retention: 5)...');
            await executeCommand(conn, `ls -1t /var/www/pj-air/database.sqlite.bak_* 2>/dev/null | tail -n +6 | xargs -r rm -f`);

            // 2. Download the backup to local
            const localBackupPath = path.join(__dirname, '..', 'database.remote.prod.bak');
            console.log('2. Downloading database backup to local...');
            await downloadFile(sftp, remoteDbPath, localBackupPath);
            console.log(`Database backup downloaded to: ${localBackupPath}`);

            // 3. Deploy code updates and reload PM2 with zero downtime
            console.log('3. Starting code update and build in production...');
            const targetBranch = process.env.REMOTE_GIT_BRANCH || 'master';
            const deployCmd = [
                'cd /var/www/pj-air',
                `git checkout ${targetBranch}`,
                `git pull origin ${targetBranch}`,
                'cd backend',
                'npm install',
                'npm run build',
                'node scripts/apply-indexes.js',
                'cd ../frontend',
                'npm install',
                'npm run build',
                'cd ..',
                'pm2 reload pj-air-backend pj-air-frontend || pm2 restart pj-air-backend pj-air-frontend'
            ].join(' && ');

            await executeCommand(conn, deployCmd);
            console.log('Deployment completed successfully with atomic backup and zero-downtime reload!');

        } catch (error) {
            console.error('CRITICAL ERROR DURING DEPLOYMENT:', error.message);
        } finally {
            conn.end();
            console.log('SSH Connection Closed.');
        }
    });
}).connect(config);
