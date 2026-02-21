const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// PATHS (inherited from index.js logic)
const EXEC_DIR = path.dirname(process.execPath);
const IS_PKG = process.pkg !== undefined;
const BASE_DIR = IS_PKG ? EXEC_DIR : path.join(__dirname, '..', '..', '..'); // Up 3 levels from server/routes/admin.js

const ENV_FILE = path.join(BASE_DIR, '.env');
const PG_CONF = path.join(BASE_DIR, 'data', 'postgresql.conf');
// Dev path fallback for PG
const PG_CONF_DEV = path.join(BASE_DIR, 'database', 'postgresql.conf'); // Just a guess, usually in data dir

const TELEGRAF_CONF = path.join(BASE_DIR, 'monitoring', 'telegraf.conf');
const BAT_RESTART = path.join(BASE_DIR, 'restart_services.bat');

// AUTH MIDDLEWARE
const adminAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No authorization header' });

    // Simple Basic Auth
    const encoded = authHeader.split(' ')[1];
    if (!encoded) return res.status(401).json({ error: 'Invalid auth' });

    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    const [user, pass] = decoded.split(':');

    // Default password if not set in env
    const EXPECTED_PASS = process.env.ADMIN_PASS || 'admin123';

    if (pass === EXPECTED_PASS) {
        next();
    } else {
        res.status(403).json({ error: 'Invalid credentials' });
    }
};

// GET CONFIG
router.get('/config', adminAuth, (req, res) => {
    try {
        const config = {
            UI_PORT: process.env.PORT || '3001',
            PG_PORT: '5441',
            INFLUX_PORT: '8088',
            INGESTION_MQTT_PORT: process.env.MQTT_PORT || '1883'
        };

        // Read .env for authoritative port sources
        if (fs.existsSync(ENV_FILE)) {
            const envContent = fs.readFileSync(ENV_FILE, 'utf8');
            const portMatch = envContent.match(/PORT=(\d+)/);
            if (portMatch) config.UI_PORT = portMatch[1];
        }

        // Read postgresql.conf
        // In dev, data dir might be elsewhere, handle gracefully
        const pgPath = fs.existsSync(PG_CONF) ? PG_CONF : (fs.existsSync(PG_CONF_DEV) ? PG_CONF_DEV : null);
        if (pgPath) {
            const pgContent = fs.readFileSync(pgPath, 'utf8');
            const pgMatch = pgContent.match(/port\s*=\s*(\d+)/);
            if (pgMatch) config.PG_PORT = pgMatch[1];
        }

        // Read telegraf.conf for Influx Port (it connects to influx)
        if (fs.existsSync(TELEGRAF_CONF)) {
            const teleContent = fs.readFileSync(TELEGRAF_CONF, 'utf-8');
            // urls = ["http://127.0.0.1:8088"]
            const influxMatch = teleContent.match(/urls\s*=\s*\["http:\/\/[\d\.]+:(\d+)"\]/);
            if (influxMatch) config.INFLUX_PORT = influxMatch[1];
        }

        res.json(config);
    } catch (e) {
        console.error("Config Read Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// SAVE CONFIG
router.post('/config', adminAuth, (req, res) => {
    const { UI_PORT, PG_PORT, INFLUX_PORT, INGESTION_MQTT_PORT } = req.body;

    try {
        // 1. Update .env
        let envContent = '';
        if (fs.existsSync(ENV_FILE)) {
            envContent = fs.readFileSync(ENV_FILE, 'utf8');
        }

        // Regex replace or append
        const updateEnv = (key, val) => {
            const regex = new RegExp(`^${key}=.*`, 'm');
            if (regex.test(envContent)) {
                envContent = envContent.replace(regex, `${key}=${val}`);
            } else {
                envContent += `\n${key}=${val}`;
            }
        };

        updateEnv('PORT', UI_PORT);
        updateEnv('MQTT_PORT', INGESTION_MQTT_PORT);
        fs.writeFileSync(ENV_FILE, envContent);

        // 2. Update postgresql.conf
        const pgPath = fs.existsSync(PG_CONF) ? PG_CONF : null;
        if (pgPath) {
            let pgContent = fs.readFileSync(pgPath, 'utf8');
            pgContent = pgContent.replace(/port\s*=\s*\d+/, `port = ${PG_PORT}`);
            fs.writeFileSync(pgPath, pgContent);
        }

        // 3. Update telegraf.conf
        if (fs.existsSync(TELEGRAF_CONF)) {
            let teleContent = fs.readFileSync(TELEGRAF_CONF, 'utf8');
            // Update InfluxDB Output URL
            teleContent = teleContent.replace(/urls\s*=\s*\["http:\/\/127.0.0.1:\d+"\]/, `urls = ["http://127.0.0.1:${INFLUX_PORT}"]`);
            fs.writeFileSync(TELEGRAF_CONF, teleContent);
        }

        res.json({ success: true, message: 'Configuration saved. Restart required.' });

    } catch (e) {
        console.error("Config Save Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// RESTART SERVICES
router.post('/restart', adminAuth, (req, res) => {
    // We cannot wait for output because we are killing ourselves
    // Spawn detached process
    const cmd = `cmd /c "${BAT_RESTART}"`;
    console.log("Triggering Restart:", cmd);

    // Spawn detached process using spawn for better independence
    const subprocess = spawn('cmd.exe', ['/c', BAT_RESTART], {
        detached: true,
        stdio: 'ignore',
        cwd: BASE_DIR,
        windowsHide: true
    });
    subprocess.unref();

    res.json({ success: true, message: 'Restarting services...' });
});

module.exports = router;
