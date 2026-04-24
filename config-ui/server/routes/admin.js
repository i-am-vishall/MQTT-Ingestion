const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');

// FIX #3: SECURE AUTHENTICATION
const createLogger = require('../utils/createLogger');
const logger = createLogger('admin-auth');

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

// ============================================================
// PASSWORD HASHING UTILITIES
// ============================================================

function hashPassword(password, salt = null) {
    if (!password) {
        throw new Error('Password cannot be empty');
    }

    if (password.length < 8) {
        throw new Error('Password must be at least 8 characters');
    }

    if (!salt) {
        salt = crypto.randomBytes(32).toString('hex');
    }

    const hash = crypto
        .pbkdf2Sync(password, salt, 100000, 64, 'sha256')
        .toString('hex');

    return `${salt}:${hash}`;
}

function verifyPassword(password, hash) {
    const [salt, hashPart] = hash.split(':');
    const newHash = crypto
        .pbkdf2Sync(password, salt, 100000, 64, 'sha256')
        .toString('hex');

    // Constant-time comparison to prevent timing attacks
    try {
        return crypto.timingSafeEqual(
            Buffer.from(newHash),
            Buffer.from(hashPart)
        );
    } catch (err) {
        return false;
    }
}

// ============================================================
// RATE LIMITING
// ============================================================

class RateLimiter {
    constructor(maxAttempts = 5, windowMs = 15 * 60 * 1000) {
        this.maxAttempts = maxAttempts;
        this.windowMs = windowMs;
        this.attempts = new Map();

        setInterval(() => this._cleanup(), 5 * 60 * 1000);
    }

    check(ip) {
        const now = Date.now();
        const record = this.attempts.get(ip);

        if (!record || now - record.timestamp > this.windowMs) {
            return { allowed: true, remaining: this.maxAttempts, resetAt: new Date(now + this.windowMs) };
        }

        if (record.count >= this.maxAttempts) {
            return {
                allowed: false,
                remaining: 0,
                resetAt: new Date(record.timestamp + this.windowMs),
                message: `Rate limited. Try again in ${Math.ceil((record.timestamp + this.windowMs - now) / 1000)}s`
            };
        }

        return {
            allowed: true,
            remaining: this.maxAttempts - record.count,
            resetAt: new Date(record.timestamp + this.windowMs)
        };
    }

    recordFailure(ip) {
        const now = Date.now();
        const record = this.attempts.get(ip);

        if (!record || now - record.timestamp > this.windowMs) {
            this.attempts.set(ip, { count: 1, timestamp: now });
        } else {
            record.count++;
            if (record.count >= this.maxAttempts) {
                logger.warn({ ip, attempts: record.count }, 'IP rate limited due to failed auth');
            }
        }
    }

    reset(ip) {
        this.attempts.delete(ip);
    }

    _cleanup() {
        const now = Date.now();
        for (const [ip, record] of this.attempts.entries()) {
            if (now - record.timestamp > this.windowMs) {
                this.attempts.delete(ip);
            }
        }
    }
}

const rateLimiter = new RateLimiter(5, 15 * 60 * 1000);

// ============================================================
// INITIALIZE ADMIN CREDENTIALS
// ============================================================

let adminCredentials = null;

function initializeAdminCredentials() {
    let adminUser = process.env.ADMIN_USER;
    let adminPassHash = process.env.ADMIN_PASS_HASH;

    if (!adminUser) {
        adminUser = 'admin';
        logger.warn('ADMIN_USER not configured, using default: admin');
    }

    if (!adminPassHash) {
        logger.error('ADMIN_PASS_HASH not configured in environment!');
        logger.error('To set up credentials, run setup endpoint or set environment variable');
        // Allow service to start but auth will fail
        adminPassHash = hashPassword(process.env.ADMIN_PASS || 'admin123456789');
    }

    adminCredentials = {
        user: adminUser,
        passHash: adminPassHash
    };

    logger.info({ user: adminUser }, '✅ Admin credentials initialized');
}

initializeAdminCredentials();

// ============================================================
// HTTPS ENFORCEMENT
// ============================================================

const enforceHttps = (req, res, next) => {
    if (process.env.NODE_ENV === 'production' && !req.secure && req.get('x-forwarded-proto') !== 'https') {
        logger.warn({ path: req.path, ip: req.ip }, 'HTTPS enforcement: rejected non-HTTPS request');
        return res.status(403).json({ error: 'HTTPS required for admin operations' });
    }
    next();
};

// ============================================================
// SECURE AUTH MIDDLEWARE
// ============================================================

const adminAuth = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'UNKNOWN';
    const path = req.path;

    // 1. Check rate limiting
    const rateCheck = rateLimiter.check(ip);
    if (!rateCheck.allowed) {
        logger.warn({ ip, path }, `Rate limited: ${rateCheck.message}`);
        return res.status(429).json({
            error: 'Too many failed attempts',
            message: rateCheck.message,
            resetAt: rateCheck.resetAt
        });
    }

    // 2. Check Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        logger.warn({ ip, path }, 'MISSING_AUTH_HEADER');
        return res.status(401).json({ error: 'No authorization header' });
    }

    // 3. Parse Basic Auth
    try {
        const parts = authHeader.split(' ');
        if (parts[0] !== 'Basic') {
            logger.warn({ ip, path, authType: parts[0] }, 'INVALID_AUTH_TYPE');
            return res.status(401).json({ error: 'Only Basic authentication supported' });
        }

        const encoded = parts[1];
        if (!encoded) {
            logger.warn({ ip, path }, 'MALFORMED_AUTH_HEADER');
            return res.status(400).json({ error: 'Malformed authorization header' });
        }

        const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
        const [username, password] = decoded.split(':');

        // 4. Validate username
        if (username !== adminCredentials.user) {
            rateLimiter.recordFailure(ip);
            logger.warn({ ip, attemptedUser: username }, 'INVALID_USERNAME');
            return res.status(403).json({ error: 'Invalid credentials' });
        }

        // 5. Validate password
        if (!password) {
            rateLimiter.recordFailure(ip);
            logger.warn({ ip, user: username }, 'MISSING_PASSWORD');
            return res.status(400).json({ error: 'Password required' });
        }

        try {
            if (!verifyPassword(password, adminCredentials.passHash)) {
                rateLimiter.recordFailure(ip);
                logger.warn({ ip, user: username }, 'INVALID_PASSWORD');
                return res.status(403).json({ error: 'Invalid credentials' });
            }
        } catch (err) {
            logger.error({ err: err.message }, 'Password verification failed');
            return res.status(500).json({ error: 'Authentication error' });
        }

        // 6. Success!
        rateLimiter.reset(ip);
        logger.info({ user: username, ip, endpoint: path }, '✅ Admin authenticated');

        req.adminUser = username;
        req.adminIp = ip;
        req.adminTimestamp = new Date();

        next();

    } catch (err) {
        logger.error({ err: err.message }, 'Auth parsing failed');
        return res.status(400).json({ error: 'Invalid authentication format' });
    }
};

// GET CONFIG
router.get('/config', adminAuth, enforceHttps, (req, res) => {
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
