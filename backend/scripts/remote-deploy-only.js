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

conn.on('ready', async () => {
    console.log('SSH Connection Established.');
    try {
        console.log('Starting remote code pull, build and zero-downtime reload...');
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
        console.log('Deployment only completed successfully!');

    } catch (error) {
        console.error('CRITICAL ERROR DURING DEPLOYMENT:', error.message);
    } finally {
        conn.end();
        console.log('SSH Connection Closed.');
    }
}).connect(config);
