/**
 * I2V MQTT Ingestion System - Pre-Flight Verifier
 * Ruthlessly checks: files, .env keys, DB tables, DB views, Redis, NSSM services
 *
 * Usage: node scripts/preflight_check.js
 * Exit 0 = PASS | Exit 1 = FAIL
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Resolve pg and ioredis from ingestion-service node_modules
const MODULE_ROOT = path.join(__dirname, '..', 'ingestion-service', 'node_modules');
if (fs.existsSync(MODULE_ROOT)) {
    require('module').Module._nodeModulePaths = require('module').Module._nodeModulePaths.bind(require('module').Module);
    // Prepend our path so require() finds pg and ioredis here
    process.env.NODE_PATH = MODULE_ROOT + path.delimiter + (process.env.NODE_PATH || '');
    require('module').Module._initPaths();
}

// ─── Colors ──────────────────────────────────────────────────────────────────
const C = {
    green: (s) => `\x1b[32m${s}\x1b[0m`,
    red: (s) => `\x1b[31m${s}\x1b[0m`,
    yellow: (s) => `\x1b[33m${s}\x1b[0m`,
    cyan: (s) => `\x1b[36m${s}\x1b[0m`,
    bold: (s) => `\x1b[1m${s}\x1b[0m`,
    gray: (s) => `\x1b[90m${s}\x1b[0m`,
};

const ROOT = path.join(__dirname, '..');
let passes = 0;
let failures = 0;

function pass(label) {
    console.log(`  ${C.green('✔')} ${label}`);
    passes++;
}
function fail(label, detail = '') {
    console.log(`  ${C.red('✘')} ${label}${detail ? C.gray(' — ' + detail) : ''}`);
    failures++;
}
function warn(label) {
    console.log(`  ${C.yellow('⚠')} ${label}`);
}
function section(title) {
    console.log(`\n${C.bold(C.cyan('══ ' + title + ' ══'))}`);
}

// ─── 1. Critical File Existence ───────────────────────────────────────────────
section('1. Critical File Presence');

const REQUIRED_FILES = [
    '.env',
    'ingestion-service/src/index.js',
    'ingestion-service/src/cluster.js',
    'ingestion-service/src/config.js',
    'ingestion-service/src/consumer.js',
    'ingestion-service/src/buffer.js',
    'ingestion-service/src/backpressure.js',
    'ingestion-service/src/normalization.js',
    'ingestion-service/src/dlq.js',
    'ingestion-service/utils/createLogger.js',
    'ingestion-service/init_schema.sql',
    'config-ui/server/index.js',
    'config-ui/server/utils/createLogger.js',
    'config-ui/server/routes/admin.js',
    'config-ui/client/dist/index.html',   // pre-built frontend must exist
];

for (const rel of REQUIRED_FILES) {
    const abs = path.join(ROOT, rel);
    if (fs.existsSync(abs)) {
        pass(rel);
    } else {
        fail(rel, 'FILE NOT FOUND');
    }
}

// ─── 2. .env Key Validation ───────────────────────────────────────────────────
section('2. Environment Variable Keys');

// Load the .env manually so we don't pollute process.env
const ENV_PATH = path.join(ROOT, '.env');
const envValues = {};
if (fs.existsSync(ENV_PATH)) {
    const content = fs.readFileSync(ENV_PATH, 'utf8');
    for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        envValues[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
    }
} else {
    fail('.env file not found at root');
}

const REQUIRED_ENV_KEYS = [
    ['MQTT_BROKER_URL', 'mqtt://127.0.0.1:1883'],
    ['MQTT_TOPICS', '#'],
    ['MQTT_BROKER_ID', ''],
    ['MQTT_PORT', '1883'],
    ['DB_USER', 'postgres'],
    ['DB_HOST', '127.0.0.1'],
    ['DB_NAME', 'mqtt_alerts_db'],
    ['DB_PASSWORD', ''],
    ['DB_PORT', '5441'],
    ['BATCH_SIZE', '5000'],
    ['BATCH_TIMEOUT', '1000'],
    ['MAX_CONCURRENT_WRITERS', '6'],
    ['MIN_NODE_WORKERS', '2'],
    ['MAX_NODE_WORKERS', '12'],
    ['DB_RETENTION_DAYS', '90'],
    ['REDIS_STREAM_MAXLEN', '2000000'],

    ['LOG_LEVEL', 'info'],
    ['PORT', '3001'],
    ['ADMIN_USER', 'admin'],
    ['ADMIN_PASS', ''],
    ['DEBUG_MODE', 'false'],
];

for (const [key, defaultVal] of REQUIRED_ENV_KEYS) {
    if (envValues[key] !== undefined) {
        pass(`${key} = "${envValues[key]}"`);
    } else {
        fail(`${key}`, `MISSING — default would be "${defaultVal}"`);
    }
}

// ─── 3. Database Check ────────────────────────────────────────────────────────
section('3. PostgreSQL — Tables, Views, Indexes');

const { Pool } = require('pg');

const ALL_TABLES = [
    // Core event store (parent partitioned table — child partitions are auto-created)
    'mqtt_events',
    // ANPR pipeline
    'anpr_event_fact', 'anpr_metrics_1min', 'anpr_violation_metrics_1min',
    // FRS (Face Recognition) pipeline
    'frs_event_fact', 'frs_metrics_1min',
    // Camera registry & live state
    'camera_master', 'camera_metrics_1min', 'live_camera_state',
    // System / configuration tables
    'event_classification_rules', 'payload_schema_mappings',
    'source_health_status', 'historical_aggregates',
    // Parking
    'parking_latest_snapshot',
    // Traffic & transport
    'traffic_prediction', 'transport_arrivals', 'transport_departures', 'origin_breakdown',
    // NOTE: puri_* tables intentionally EXCLUDED — belong to Puri crowd prediction module
];
const ALL_VIEWS = ['vw_live_dashboard'];
const ALL_INDEXES = [
    'idx_mqtt_events_time',
    'idx_mqtt_events_camera',
    'idx_anpr_fact_time',
    'idx_anpr_fact_camera',
    'idx_frs_fact_time',
    'idx_anpr_metrics_time',
    'idx_frs_metrics_time',
];

async function checkPostgres() {
    const pool = new Pool({
        user: envValues.DB_USER || 'postgres',
        host: envValues.DB_HOST || '127.0.0.1',
        database: envValues.DB_NAME || 'mqtt_alerts_db',
        password: envValues.DB_PASSWORD || '',
        port: parseInt(envValues.DB_PORT || '5441'),
        connectionTimeoutMillis: 5000,
    });

    let client;
    try {
        client = await pool.connect();
        const timeRes = await client.query('SELECT NOW(), version()');
        pass(`Connected: ${String(timeRes.rows[0].version).split(' ').slice(0, 2).join(' ')}`);

        // Tables
        const tableRes = await client.query(
            `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY($1)`,
            [ALL_TABLES]
        );
        const foundTables = tableRes.rows.map(r => r.table_name);
        const missingTables = ALL_TABLES.filter(t => !foundTables.includes(t));

        if (missingTables.length === 0) {
            pass(`All ${ALL_TABLES.length} tables present`);
        } else {
            fail(`Missing tables`, missingTables.join(', '));
            // Attempt auto-init
            const schemaPath = path.join(ROOT, 'ingestion-service', 'init_schema.sql');
            if (fs.existsSync(schemaPath)) {
                warn(`Running init_schema.sql to create missing objects...`);
                try {
                    const sql = fs.readFileSync(schemaPath, 'utf8');
                    await client.query(sql);
                    warn(`Schema applied. Re-run this script to confirm.`);
                } catch (e) {
                    fail(`schema apply failed`, e.message);
                }
            }
        }

        // Views
        const viewRes = await client.query(
            `SELECT table_name FROM information_schema.views WHERE table_schema='public' AND table_name = ANY($1)`,
            [ALL_VIEWS]
        );
        const foundViews = viewRes.rows.map(r => r.table_name);
        const missingViews = ALL_VIEWS.filter(v => !foundViews.includes(v));
        if (missingViews.length === 0) {
            pass(`All ${ALL_VIEWS.length} views present`);
        } else {
            fail(`Missing views`, missingViews.join(', '));
        }

        // Indexes
        const idxRes = await client.query(
            `SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname = ANY($1)`,
            [ALL_INDEXES]
        );
        const foundIdx = idxRes.rows.map(r => r.indexname);
        const missingIdx = ALL_INDEXES.filter(x => !foundIdx.includes(x));
        if (missingIdx.length === 0) {
            pass(`All ${ALL_INDEXES.length} indexes present`);
        } else {
            warn(`Indexes missing (non-fatal): ${missingIdx.join(', ')}`);
        }

        // Row count sanity
        const evtCount = await client.query('SELECT COUNT(*) FROM mqtt_events');
        pass(`mqtt_events has ${Number(evtCount.rows[0].count).toLocaleString()} rows`);

    } catch (err) {
        fail('PostgreSQL connection failed', err.message);
    } finally {
        if (client) client.release();
        await pool.end().catch(() => { });
    }
}

// ─── 4. Redis Check ───────────────────────────────────────────────────────────
async function checkRedis() {
    section('4. Redis / Memurai');
    const Redis = require('ioredis');
    const redis = new Redis({
        host: '127.0.0.1',
        port: 6379,
        connectTimeout: 3000,
        lazyConnect: true,
    });
    try {
        await redis.connect();
        const pong = await redis.ping();
        const info = await redis.info('server');
        const versionLine = info.split('\n').find(l => l.startsWith('redis_version'));
        const version = versionLine ? versionLine.split(':')[1].trim() : 'unknown';
        pass(`Redis PING → ${pong} (version: ${version})`);

        const streamLen = await redis.xlen('mqtt:ingest').catch(() => null);
        if (streamLen !== null) {
            pass(`Redis stream mqtt:ingest has ${Number(streamLen).toLocaleString()} entries`);
        } else {
            warn('Redis stream mqtt:ingest not yet created (normal on fresh install)');
        }
    } catch (err) {
        fail('Redis connection failed', err.message);
    } finally {
        redis.disconnect();
    }
}

// ─── 5. NSSM Services Check ───────────────────────────────────────────────────
function checkServices() {
    section('5. Windows Services (NSSM)');
    const services = [
        'i2v-MQTT-Ingestion-Service',
        'i2v-Config-UI-Service',
    ];
    for (const svc of services) {
        try {
            const result = execSync(`sc query "${svc}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
            if (result.includes('RUNNING')) {
                pass(`${svc} → RUNNING`);
            } else if (result.includes('STOPPED')) {
                fail(`${svc} → STOPPED`);
            } else {
                warn(`${svc} → ${result.split('\n').find(l => l.includes('STATE')) || 'UNKNOWN'}`);
            }
        } catch (e) {
            fail(`${svc}`, 'NOT REGISTERED or sc.exe error');
        }
    }
}

// ─── 6. Log Directory Check ───────────────────────────────────────────────────
function checkLogs() {
    section('6. Log Directories');
    const logDirs = [
        path.join(ROOT, 'logs'),
        'C:\\ProgramData\\I2V\\Logs',
        path.join(ROOT, 'ingestion-service', 'logs'),
    ];
    for (const dir of logDirs) {
        if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir, { withFileTypes: true });
            pass(`${dir} (${files.length} entries)`);
        } else {
            warn(`${dir} — does not exist yet (created on first run)`);
        }
    }
}

// ─── Run All Checks ───────────────────────────────────────────────────────────
(async () => {
    console.log(C.bold(C.cyan('\n╔══════════════════════════════════════════════════════╗')));
    console.log(C.bold(C.cyan('║   I2V MQTT Ingestion — Pre-Flight Verification       ║')));
    console.log(C.bold(C.cyan('╚══════════════════════════════════════════════════════╝')));
    console.log(C.gray(`  Root: ${ROOT}`));
    console.log(C.gray(`  Time: ${new Date().toISOString()}`));

    await checkPostgres();
    await checkRedis();
    checkServices();
    checkLogs();

    // ─── Summary ──────────────────────────────────────────────────────────────
    const total = passes + failures;
    console.log(`\n${C.bold('══════════════════════════════════════')}`);
    if (failures === 0) {
        console.log(C.bold(C.green(`✔ ALL ${total} CHECKS PASSED — System is healthy`)));
    } else {
        console.log(C.bold(C.red(`✘ ${failures} of ${total} checks FAILED`)));
        console.log(C.yellow('  Fix the issues above and re-run this script.'));
    }
    console.log(C.bold('══════════════════════════════════════\n'));

    process.exit(failures > 0 ? 1 : 0);
})();
