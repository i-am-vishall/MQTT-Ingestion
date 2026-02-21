const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
const path = require("path");
const fs = require("fs");
const Transport = require("winston-transport");

// ✅ Global Ring Buffer (Singleton per process)
const MAX_BUFFER_SIZE = 200;
const memoryBuffer = [];

class InMemoryTransport extends Transport {
    constructor(opts) {
        super(opts);
    }

    log(info, callback) {
        setImmediate(() => {
            this.emit("logged", info);
        });

        // Add to buffer
        memoryBuffer.push(info);
        if (memoryBuffer.length > MAX_BUFFER_SIZE) {
            memoryBuffer.shift(); // Remove oldest
        }

        callback();
    }
}

// Ensure Base Directory
const BASE_LOG_DIR = path.join("C:", "ProgramData", "I2V", "Logs");
if (!fs.existsSync(BASE_LOG_DIR)) {
    try {
        fs.mkdirSync(BASE_LOG_DIR, { recursive: true });
    } catch (e) {
        console.error("CRITICAL: Failed to create log directory. Check Permissions!", e);
    }
}

function createLogger(serviceName) {
    const serviceLogDir = path.join(BASE_LOG_DIR, serviceName);
    const envLogLevel =
        process.env.LOG_LEVEL_INGESTION ||
        process.env.LOG_LEVEL ||
        ((process.env.DEBUG_MODE_INGESTION === 'true' || process.env.DEBUG_MODE === 'true') ? 'debug' : 'info');

    // Ensure Service Directory
    if (!fs.existsSync(serviceLogDir)) {
        try { fs.mkdirSync(serviceLogDir, { recursive: true }); } catch (e) { }
    }

    return winston.createLogger({
        level: envLogLevel,
        defaultMeta: { service: serviceName }, // Standard Schema

        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json() // Strict JSON
        ),

        transports: [
            new winston.transports.Console({
                format: winston.format.simple() // Human readable for dev
            }),
            new DailyRotateFile({
                dirname: serviceLogDir,
                filename: `${serviceName}-%DATE%.log`,
                datePattern: "YYYY-MM-DD",
                zippedArchive: true,
                maxSize: "50m",
                maxFiles: "7d"
            }),
            new InMemoryTransport() // ✅ RAM Buffer
        ]
    });
}

// Export Factory & Buffer Accessor
module.exports = createLogger;
module.exports.getRecentLogs = () => [...memoryBuffer].reverse(); // Newest first for UI
