/**
 * FIX #3: ADMIN AUTH BYPASS (CRITICAL SECURITY VULNERABILITY)
 * 
 * PROBLEMS:
 * 1. Hardcoded default password 'admin123' in code
 * 2. Username NOT validated - any username works!
 * 3. No rate limiting - brute force possible
 * 4. No audit logging - no record of API access
 * 5. Plain password in memory - no hashing
 * 6. No HTTPS enforcement - passwords sent in plain HTTP
 * 
 * SOLUTION:
 * - Proper username + password validation
 * - Rate limiting per IP
 * - Comprehensive audit logging
 * - Never store plaintext passwords
 * - Enforce HTTPS for admin routes
 * - Add password strength requirements
 * 
 * SEVERITY: CRITICAL - Unauthorized Configuration Access
 */

// ============================================================
// BEFORE (❌ BROKEN CODE)
// ============================================================
/*
const adminAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No authorization header' });

    const encoded = authHeader.split(' ')[1];
    if (!encoded) return res.status(401).json({ error: 'Invalid auth' });

    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    const [user, pass] = decoded.split(':');

    // ❌ HARDCODED PASSWORD!
    const EXPECTED_PASS = process.env.ADMIN_PASS || 'admin123';

    // ❌ NO USERNAME CHECK!
    if (pass === EXPECTED_PASS) {
        next();
    } else {
        res.status(403).json({ error: 'Invalid credentials' });
    }
};
*/

// ============================================================
// AFTER (✅ FIXED CODE)
// ============================================================

const crypto = require('crypto');
const createLogger = require('../utils/createLogger');
const logger = createLogger('auth');

// ============================================================
// PASSWORD HASHING UTILITIES
// ============================================================

/**
 * Hash password using PBKDF2
 * @param {string} password - Plain text password
 * @param {string} salt - Optional salt (generated if not provided)
 * @returns {string} - Hashed password with salt:hash format
 */
function hashPassword(password, salt = null) {
    if (!password) {
        throw new Error('Password cannot be empty');
    }

    // Validate password strength
    if (password.length < 12) {
        throw new Error('Password must be at least 12 characters');
    }

    if (!salt) {
        salt = crypto.randomBytes(32).toString('hex');
    }

    // PBKDF2: 100000 iterations, 64 byte hash, SHA-256
    const hash = crypto
        .pbkdf2Sync(password, salt, 100000, 64, 'sha256')
        .toString('hex');

    return `${salt}:${hash}`;
}

/**
 * Verify password against hash
 * @param {string} password - Plain text password to verify
 * @param {string} hash - Stored hash (salt:hash format)
 * @returns {boolean} - True if password matches
 */
function verifyPassword(password, hash) {
    const [salt, hashPart] = hash.split(':');
    const newHash = crypto
        .pbkdf2Sync(password, salt, 100000, 64, 'sha256')
        .toString('hex');

    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
        Buffer.from(newHash),
        Buffer.from(hashPart)
    );
}

/**
 * Validate password strength
 * @param {string} password
 * @returns {object} - { valid: boolean, errors: string[] }
 */
function validatePasswordStrength(password) {
    const errors = [];

    if (!password) errors.push('Password is required');
    if (password.length < 12) errors.push('Minimum 12 characters');
    if (!/[A-Z]/.test(password)) errors.push('Must contain uppercase letter');
    if (!/[a-z]/.test(password)) errors.push('Must contain lowercase letter');
    if (!/[0-9]/.test(password)) errors.push('Must contain number');
    if (!/[!@#$%^&*]/.test(password)) errors.push('Must contain special character (!@#$%^&*)');

    return {
        valid: errors.length === 0,
        errors
    };
}

// ============================================================
// RATE LIMITING
// ============================================================

/**
 * Simple in-memory rate limiter
 * Tracks failed auth attempts per IP
 */
class RateLimiter {
    constructor(maxAttempts = 5, windowMs = 15 * 60 * 1000) { // 5 attempts per 15 minutes
        this.maxAttempts = maxAttempts;
        this.windowMs = windowMs;
        this.attempts = new Map(); // IP -> { count, timestamp }
        this.logger = require('../utils/createLogger')('rate-limit');

        // Cleanup old entries every 5 minutes
        setInterval(() => this._cleanup(), 5 * 60 * 1000);
    }

    /**
     * Check if IP is rate limited
     * @param {string} ip
     * @returns {object} - { allowed: boolean, remaining: number, resetAt: Date }
     */
    check(ip) {
        const now = Date.now();
        const record = this.attempts.get(ip);

        // New IP or window expired
        if (!record || now - record.timestamp > this.windowMs) {
            return { allowed: true, remaining: this.maxAttempts, resetAt: new Date(now + this.windowMs) };
        }

        // Check attempts
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

    /**
     * Record a failed attempt
     * @param {string} ip
     */
    recordFailure(ip) {
        const now = Date.now();
        const record = this.attempts.get(ip);

        if (!record || now - record.timestamp > this.windowMs) {
            this.attempts.set(ip, { count: 1, timestamp: now });
        } else {
            record.count++;
            if (record.count >= this.maxAttempts) {
                this.logger.warn({ ip, attempts: record.count }, 'IP rate limited due to failed auth');
            }
        }
    }

    /**
     * Reset attempts for IP
     * @param {string} ip
     */
    reset(ip) {
        this.attempts.delete(ip);
    }

    /**
     * Cleanup old entries
     * @private
     */
    _cleanup() {
        const now = Date.now();
        for (const [ip, record] of this.attempts.entries()) {
            if (now - record.timestamp > this.windowMs) {
                this.attempts.delete(ip);
            }
        }
    }
}

const rateLimiter = new RateLimiter(5, 15 * 60 * 1000); // 5 attempts per 15 minutes

// ============================================================
// AUDIT LOGGING
// ============================================================

/**
 * Log authentication events
 */
function auditLog(event, details) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        type: 'AUTH_AUDIT',
        event,
        timestamp,
        ...details
    };

    logger.info(logEntry, `Auth Audit: ${event}`);

    // Could also send to centralized logging service
    // auditStream.write(JSON.stringify(logEntry) + '\n');
}

// ============================================================
// INITIALIZATION: Load/Generate Admin Credentials
// ============================================================

let adminCredentials = null;

/**
 * Initialize admin credentials from environment
 */
function initializeAdminCredentials() {
    // Check for pre-configured credentials
    let adminUser = process.env.ADMIN_USER;
    let adminPassHash = process.env.ADMIN_PASS_HASH;

    if (!adminUser) {
        adminUser = 'admin';
        logger.warn('ADMIN_USER not configured, using default: admin');
    }

    if (!adminPassHash) {
        logger.error('ADMIN_PASS_HASH not configured in environment!');
        logger.error('To set up credentials, run:');
        logger.error('  node -e "const {hashPassword} = require(\'./auth\'); console.log(hashPassword(\'YourPassword123!\'')');
        logger.error('Then set ADMIN_PASS_HASH environment variable to the output');
        process.exit(1);
    }

    adminCredentials = {
        user: adminUser,
        passHash: adminPassHash
    };

    logger.info({ user: adminUser }, '✅ Admin credentials loaded');
}

// Initialize on module load
initializeAdminCredentials();

// ============================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================

/**
 * Express middleware for admin authentication
 */
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
        auditLog('MISSING_AUTH_HEADER', { ip, path });
        return res.status(401).json({ error: 'No authorization header' });
    }

    // 3. Parse Basic Auth
    try {
        const parts = authHeader.split(' ');
        if (parts[0] !== 'Basic') {
            auditLog('INVALID_AUTH_TYPE', { ip, path, authType: parts[0] });
            return res.status(401).json({ error: 'Only Basic authentication supported' });
        }

        const encoded = parts[1];
        if (!encoded) {
            auditLog('MALFORMED_AUTH_HEADER', { ip, path });
            return res.status(400).json({ error: 'Malformed authorization header' });
        }

        const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
        const [username, password] = decoded.split(':');

        // 4. Validate username
        if (username !== adminCredentials.user) {
            rateLimiter.recordFailure(ip);
            auditLog('INVALID_USERNAME', { ip, path, attemptedUser: username });
            logger.warn({ ip, attemptedUser: username }, 'Failed auth: invalid username');
            return res.status(403).json({ error: 'Invalid credentials' });
        }

        // 5. Validate password
        if (!password) {
            rateLimiter.recordFailure(ip);
            auditLog('MISSING_PASSWORD', { ip, path, user: username });
            return res.status(400).json({ error: 'Password required' });
        }

        try {
            if (!verifyPassword(password, adminCredentials.passHash)) {
                rateLimiter.recordFailure(ip);
                auditLog('INVALID_PASSWORD', { ip, path, user: username });
                logger.warn({ ip, user: username }, 'Failed auth: invalid password');
                return res.status(403).json({ error: 'Invalid credentials' });
            }
        } catch (err) {
            logger.error({ err: err.message }, 'Password verification failed');
            return res.status(500).json({ error: 'Authentication error' });
        }

        // 6. Success!
        rateLimiter.reset(ip); // Clear rate limit counter
        auditLog('SUCCESSFUL_AUTH', { ip, path, user: username });
        logger.info({ user: username, ip, endpoint: path }, '✅ Admin authenticated');

        // Attach user info to request
        req.adminUser = username;
        req.adminIp = ip;
        req.adminTimestamp = new Date();

        next();

    } catch (err) {
        logger.error({ err: err.message }, 'Auth parsing failed');
        return res.status(400).json({ error: 'Invalid authentication format' });
    }
};

// ============================================================
// HTTPS ENFORCEMENT (for admin routes)
// ============================================================

const enforceHttps = (req, res, next) => {
    if (process.env.NODE_ENV === 'production' && !req.secure && req.get('x-forwarded-proto') !== 'https') {
        logger.warn({ path: req.path, ip: req.ip }, 'HTTPS enforcement: rejected non-HTTPS request');
        return res.status(403).json({ error: 'HTTPS required for admin operations' });
    }
    next();
};

// ============================================================
// API ENDPOINTS FOR CREDENTIAL MANAGEMENT
// ============================================================

const express = require('express');
const router = express.Router();

/**
 * Change admin password
 * POST /api/admin/change-password
 */
router.post('/change-password', adminAuth, enforceHttps, (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        // Validate new password
        const validation = validatePasswordStrength(newPassword);
        if (!validation.valid) {
            auditLog('PASSWORD_CHANGE_FAILED', {
                user: req.adminUser,
                ip: req.adminIp,
                reason: 'Password too weak',
                errors: validation.errors
            });
            return res.status(400).json({
                error: 'Password too weak',
                requirements: validation.errors
            });
        }

        // Verify current password
        if (!verifyPassword(currentPassword, adminCredentials.passHash)) {
            rateLimiter.recordFailure(req.adminIp);
            auditLog('PASSWORD_CHANGE_WRONG_CURRENT', {
                user: req.adminUser,
                ip: req.adminIp
            });
            return res.status(403).json({ error: 'Current password incorrect' });
        }

        // Hash new password
        const newHash = hashPassword(newPassword);
        adminCredentials.passHash = newHash;

        // Persist to environment (or better: config service)
        process.env.ADMIN_PASS_HASH = newHash;

        auditLog('PASSWORD_CHANGED', {
            user: req.adminUser,
            ip: req.adminIp,
            timestamp: new Date().toISOString()
        });

        logger.info({ user: req.adminUser }, '✅ Admin password changed');

        res.json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (err) {
        logger.error(err, 'Change password error');
        res.status(500).json({ error: 'Failed to change password' });
    }
});

/**
 * Get authentication status
 * GET /api/admin/auth-status
 */
router.get('/auth-status', adminAuth, (req, res) => {
    res.json({
        authenticated: true,
        user: req.adminUser,
        authenticatedAt: req.adminTimestamp,
        ip: req.adminIp,
        user: req.adminUser
    });
});

// ============================================================
// TESTING/SETUP ENDPOINTS (development only)
// ============================================================

if (process.env.NODE_ENV !== 'production') {
    /**
     * GET /api/admin/setup - Get password hash for initial setup
     * Usage: curl localhost:3001/api/admin/setup?password=YourPassword123!
     */
    router.get('/setup', (req, res) => {
        const { password } = req.query;

        if (!password) {
            return res.json({
                message: 'Provide password as query param: ?password=YourPassword123!',
                requirements: [
                    'Minimum 12 characters',
                    'At least one uppercase letter',
                    'At least one lowercase letter',
                    'At least one number',
                    'At least one special character (!@#$%^&*)'
                ]
            });
        }

        const validation = validatePasswordStrength(password);
        if (!validation.valid) {
            return res.status(400).json({
                error: 'Password does not meet requirements',
                errors: validation.errors
            });
        }

        const hash = hashPassword(password);
        res.json({
            password,
            hash,
            instructions: [
                'Set this environment variable:',
                `export ADMIN_PASS_HASH="${hash}"`,
                '',
                'Then restart the service'
            ]
        });
    });
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    adminAuth,
    enforceHttps,
    router,
    hashPassword,
    verifyPassword,
    validatePasswordStrength,
    RateLimiter,
    rateLimiter,
    auditLog
};

// ============================================================
// USAGE IN EXPRESS APP
// ============================================================

/*
const express = require('express');
const { adminAuth, enforceHttps, router: authRoutes } = require('./auth');

const app = express();

// Mount auth routes
app.use('/api/admin', enforceHttps, authRoutes);

// Protect other admin routes
app.post('/api/admin/config', adminAuth, enforceHttps, (req, res) => {
    // ... admin config logic ...
});

// Start app
app.listen(3001);

// SETUP INSTRUCTIONS:
// 1. Generate password hash:
//    curl http://localhost:3001/api/admin/setup?password=YourPassword123!
//
// 2. Set environment:
//    export ADMIN_PASS_HASH="hash_from_above"
//    export ADMIN_USER="admin"
//
// 3. Restart service
//
// 4. Use basic auth:
//    curl -u admin:YourPassword123! http://localhost:3001/api/admin/config
//
// 5. Change password:
//    curl -u admin:YourPassword123! -X POST http://localhost:3001/api/admin/change-password \\
//         -H "Content-Type: application/json" \\
//         -d '{"currentPassword":"YourPassword123!","newPassword":"NewPassword456!"}'
*/
