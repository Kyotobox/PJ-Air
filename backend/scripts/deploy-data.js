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

const localDbPath = path.join(__dirname, '..', '..', 'database.sqlite');
const remoteDbPath = '/var/www/pj-air/database.sqlite';

const localUploadsDir = path.join(__dirname, '..', 'uploads', 'products');
const remoteUploadsDir = '/var/www/pj-air/backend/uploads/products';

const conn = new Client();

function uploadFile(sftp, localPath, remotePath) {
    return new Promise((resolve, reject) => {
        console.log(`Uploading: ${localPath} -> ${remotePath}`);
        sftp.fastPut(localPath, remotePath, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function ensureRemoteDir(sftp, dir) {
    return new Promise((resolve, reject) => {
        sftp.mkdir(dir, (err) => {
            if (err && err.code !== 4) reject(err); // 4 = Failure (already exists)
            else resolve();
        });
    });
}

conn.on('ready', () => {
    console.log('Client :: ready');
    conn.sftp(async (err, sftp) => {
        if (err) throw err;

        try {
            // 1. Upload Database
            await uploadFile(sftp, localDbPath, remoteDbPath);
            console.log('Database uploaded successfully.');

            // 2. Upload Images
            console.log('Syncing images...');
            await ensureRemoteDir(sftp, remoteUploadsDir);
            
            const files = fs.readdirSync(localUploadsDir);
            for (const file of files) {
                const localFilePath = path.join(localUploadsDir, file);
                const remoteFilePath = path.join(remoteUploadsDir, file).replace(/\\/g, '/');
                
                if (fs.lstatSync(localFilePath).isFile()) {
                    await uploadFile(sftp, localFilePath, remoteFilePath);
                }
            }
            console.log('Images uploaded successfully.');

            // 3. Restart Services
            console.log('Restarting services via PM2...');
            conn.exec('pm2 restart all', (err, stream) => {
                if (err) throw err;
                stream.on('close', (code, signal) => {
                    console.log(`PM2 restart finished with code ${code}`);
                    conn.end();
                }).on('data', (data) => {
                    console.log('STDOUT: ' + data);
                }).stderr.on('data', (data) => {
                    console.log('STDERR: ' + data);
                });
            });

        } catch (error) {
            console.error('Error during deployment:', error);
            conn.end();
        }
    });
}).connect(config);
