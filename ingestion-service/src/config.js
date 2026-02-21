const path = require('path');
const fs = require('fs');

// Determine correct directory whether running as node or pkg
const isPkg = typeof process.pkg !== 'undefined';
const appDir = isPkg ? path.dirname(process.execPath) : path.join(__dirname, '..');

// Search for .env in multiple locations
const envSearchPaths = [
    path.join(appDir, '.env'),
    path.join(process.cwd(), '.env'),
    path.join(__dirname, '..', '.env'),
    'C:\\Program Files (x86)\\i2v-MQTT-Ingestion\\.env'
];

let envLoaded = false;
let envPath = null;

for (const p of envSearchPaths) {
    if (fs.existsSync(p)) {
        require('dotenv').config({ path: p });
        envPath = p;
        envLoaded = true;
        break;
    }
}

if (!envLoaded) {
    // Load defaults but show warning
    require('dotenv').config();
    console.warn('================================================');
    console.warn('WARNING: No .env configuration file found!');
    console.warn('Using default settings. Service may not work correctly.');
    console.warn('');
    console.warn('Please configure via Config UI at:');
    console.warn('   http://localhost:3001');
    console.warn('');
    console.warn('Or create .env file at:');
    console.warn(`   ${path.join(appDir, '.env')}`);
    console.warn('================================================');
}

module.exports = {
    mqtt: {
        // Support comma-separated list of brokers
        brokerUrls: (process.env.MQTT_BROKER_URL || 'mqtt://127.0.0.1:1883').split(',').map(s => s.trim()).filter(Boolean),
        brokerIds: (process.env.MQTT_BROKER_ID || '').split(',').map(s => s.trim()).filter(Boolean),
        topics: (process.env.MQTT_TOPICS || '#').split(','), // Default subscribe to all
        reconnectPeriod: 1000,
    },
    db: {
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || '127.0.0.1',
        database: process.env.DB_NAME || 'mqtt_alerts_db',
        password: process.env.DB_PASSWORD || '',
        port: parseInt(process.env.DB_PORT || '5441'),
        // Connection pool settings
        max: 20,
        idleTimeoutMillis: 30000,
    },
    service: {
        batchSize: parseInt(process.env.BATCH_SIZE || '100'),
        batchTimeoutMs: parseInt(process.env.BATCH_TIMEOUT || '1000'),
        sourcePrefix: process.env.SOURCE_PREFIX || 'Source_Server',
    },
    // Logging configuration
    debugMode:
        process.env.DEBUG_MODE_INGESTION === 'true' ||
        process.env.DEBUG_MODE === 'true' ||
        process.env.LOG_LEVEL_INGESTION === 'debug' ||
        process.env.LOG_LEVEL === 'debug',
    logLevel: process.env.LOG_LEVEL_INGESTION || process.env.LOG_LEVEL || 'info',
    envLoaded: envLoaded,
    envPath: envPath
};

// Validation: Enforce 1-to-1 mapping if IDs are provided
if (module.exports.mqtt.brokerIds.length > 0 &&
    module.exports.mqtt.brokerIds.length !== module.exports.mqtt.brokerUrls.length) {
    throw new Error(`Configuration Error: MQTT_BROKER_ID count (${module.exports.mqtt.brokerIds.length}) does not match MQTT_BROKER_URL count (${module.exports.mqtt.brokerUrls.length}). Please ensure they match.`);
}

