const { Client } = require('ssh2');

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
                resolve({ code, stdout, stderr });
            }).on('data', (data) => {
                stdout += data.toString();
            }).stderr.on('data', (data) => {
                stderr += data.toString();
            });
        });
    });
}

conn.on('ready', async () => {
    console.log('SSH Connection Established.');
    try {
        console.log('--- PM2 STATUS ---');
        const pm2Status = await executeCommand(conn, 'pm2 status');
        console.log(pm2Status.stdout || '(Empty)');
    } catch (error) {
        console.error('Error:', error);
    } finally {
        conn.end();
    }
}).connect(config);
