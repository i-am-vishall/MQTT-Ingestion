const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

// Determine Paths
const IS_PKG = process.pkg !== undefined;
const EXEC_DIR = path.dirname(process.execPath);
// In Dev: src/ -> root
const BASE_DIR = IS_PKG ? EXEC_DIR : path.join(__dirname, '..', '..');
const LOG_DIR = process.env.LOG_DIR || path.join(BASE_DIR, 'logs');

// Ensure Log Directory Exists
if (!fs.existsSync(LOG_DIR)) {
    try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch (e) { }
}

// Configuration State
let DEBUG_MODE = process.env.DEBUG_MODE_INGESTION === 'true' || process.env.DEBUG_MODE === 'true';

// Define Log Format
const fileFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
);

const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ level, message, timestamp, ...metadata }) => {
        let msg = `${timestamp} [${level}]: ${message}`;
        if (Object.keys(metadata).length > 0) {
            msg += ` ${JSON.stringify(metadata)}`;
        }
        return msg;
    })
);

// Create Transports
const fileRotateTransport = new DailyRotateFile({
    filename: path.join(LOG_DIR, 'ingestion-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    level: 'info', // File always captures INFO+
    format: fileFormat
});

const consoleTransport = new winston.transports.Console({
    level: DEBUG_MODE ? 'debug' : 'info',
    format: consoleFormat
});

// Create Logger Instance
const logger = winston.createLogger({
    levels: winston.config.npm.levels,
    transports: [
        fileRotateTransport,
        consoleTransport
    ]
});

// Handle "updateConfig" legacy support
const updateConfig = (env) => {
    if (env.DEBUG_MODE_INGESTION !== undefined) DEBUG_MODE = env.DEBUG_MODE_INGESTION === 'true';
    else if (env.DEBUG_MODE !== undefined) DEBUG_MODE = env.DEBUG_MODE === 'true';

    // Update Console Level Dynamically
    consoleTransport.level = DEBUG_MODE ? 'debug' : 'info';
    logger.info(`Log Level Updated. Debug Mode: ${DEBUG_MODE}`);
};

// Wrapper to match old API exactly
module.exports = {
    info: (msg, meta) => logger.info(msg, meta),
    warn: (msg, meta) => logger.warn(msg, meta),
    error: (msg, err) => {
        if (err) {
            logger.error(msg, { error: err.message || err.toString(), stack: err.stack });
        } else {
            logger.error(msg);
        }
    },
    fatal: (msg, err) => {
        // Winston doesn't have 'fatal', map to 'error' with tag
        if (err) {
            logger.error(`[FATAL] ${msg}`, { error: err.message || err.toString(), stack: err.stack, fatal: true });
        } else {
            logger.error(`[FATAL] ${msg}`, { fatal: true });
        }
    },
    debug: (msg, meta) => logger.debug(msg, meta),

    // Compatibility helpers
    updateConfig,
    baseDir: BASE_DIR,
    logDir: LOG_DIR,
    // No-op for cleanup as Winston handles rotation
    cleanupOldLogs: () => { /* Winston handles this */ }
};
