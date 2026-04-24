const { Pool } = require('pg');
const config = require('../config/config');
const createLogger = require('../../utils/createLogger');
const logger = createLogger('db-pool');
const path = require('path');
const fs = require('fs');

const pool = new Pool(config.db);

async function ensureDatabaseExists() {
    const targetDb = config.db.database;
    const maintenancePool = new Pool({
        ...config.db,
        database: 'postgres',   // always exists in any PG installation
        max: 1,
        connectionTimeoutMillis: 5000,
    });

    try {
        const client = await maintenancePool.connect();
        const res = await client.query(
            `SELECT 1 FROM pg_database WHERE datname = $1`, [targetDb]
        );

        if (res.rowCount === 0) {
            logger.warn(`Database '${targetDb}' does not exist. Creating it now...`);
            await client.query(`CREATE DATABASE "${targetDb}"`);
            logger.info(`Database '${targetDb}' created successfully!`);
        } else {
            logger.info(`Database '${targetDb}' already exists.`);
        }
        client.release();
    } catch (err) {
        logger.warn({ err: err.message }, 'Could not auto-create database (will try to connect anyway)');
    } finally {
        await maintenancePool.end().catch(() => {});
    }
}

// ============================================================
// DB VERIFY WITH RETRY + AUTO TABLE INIT
// Retries up to 10 times with exponential backoff (max 30s).
// On first connect, auto-creates tables from init_schema.sql
// if any of the 4 core tables are missing.
// ============================================================
async function verifyDB() {
    const MAX_RETRIES = 10;
    const BASE_DELAY_MS = 3000;   // 3s → 6s → 12s … capped at 30s

    // First: ensure the database itself exists
    await ensureDatabaseExists();

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const client = await pool.connect();
            const res = await client.query('SELECT NOW()');
            logger.info(`STEP 3/6: Database '${config.db.database}' connected at ${res.rows[0].now} (attempt ${attempt})`);

            // ── FULL table + view check & auto-init ──────────────────────────
            const ALL_TABLES = [
                // Core event store
                'mqtt_events', 'mqtt_events_default',
                // ANPR pipeline
                'anpr_event_fact', 'anpr_metrics_1min', 'anpr_violation_metrics_1min',
                // FRS pipeline
                'frs_event_fact', 'frs_metrics_1min',
                // Camera
                'camera_master', 'camera_metrics_1min', 'live_camera_state',
                // System / Rules
                'event_classification_rules', 'payload_schema_mappings',
                'source_health_status', 'historical_aggregates',
                // Parking & Traffic
                'parking_latest_snapshot',
                'traffic_prediction', 'transport_arrivals', 'transport_departures', 'origin_breakdown',
            ];
            const ALL_VIEWS = ['vw_live_dashboard'];

            const tableCheck = await client.query(`
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = ANY($1::text[])
            `, [ALL_TABLES]);
            const viewCheck = await client.query(`
                SELECT table_name FROM information_schema.views
                WHERE table_schema = 'public'
                AND table_name = ANY($1::text[])
            `, [ALL_VIEWS]);

            const foundTables = tableCheck.rows.map(r => r.table_name);
            const foundViews = viewCheck.rows.map(r => r.table_name);
            const missingTables = ALL_TABLES.filter(t => !foundTables.includes(t));
            const missingViews = ALL_VIEWS.filter(v => !foundViews.includes(v));

            const allPresent = missingTables.length === 0 && missingViews.length === 0;

            if (!allPresent) {
                logger.warn(`STEP 3.1/6: Missing ${missingTables.length} table(s) and ${missingViews.length} view(s):`);
                if (missingTables.length) logger.warn(`  Tables missing: ${missingTables.join(', ')}`);
                if (missingViews.length) logger.warn(`  Views missing: ${missingViews.join(', ')}`);
                logger.warn('Attempting auto-initialization from init_schema.sql...');

                const schemaSearchPaths = [
                    path.join(path.dirname(process.execPath), 'db', 'init_schema.sql'),
                    path.join(path.dirname(process.execPath), 'init_schema.sql'),
                    path.join(process.cwd(), 'db', 'init_schema.sql'),
                    path.join(process.cwd(), 'init_schema.sql'),
                    path.join(__dirname, '..', '..', '..', 'init_schema.sql'),
                    path.join(__dirname, '..', '..', 'db', 'init_schema.sql'),
                    'C:\\Program Files (x86)\\i2v-MQTT-Ingestion\\db\\init_schema.sql',
                    'C:\\Program Files (x86)\\i2v-MQTT-Ingestion\\init_schema.sql'
                ];

                let schemaApplied = false;
                for (const schemaPath of schemaSearchPaths) {
                    if (fs.existsSync(schemaPath)) {
                        logger.info(`   > Found schema at: ${schemaPath}`);
                        try {
                            const sql = fs.readFileSync(schemaPath, 'utf8');
                            await client.query(sql);
                            logger.info('STEP 3.2/6: Database schema auto-initialized successfully!');
                            schemaApplied = true;
                            break;
                        } catch (sqlErr) {
                            logger.error({ err: sqlErr.message, schemaPath }, 'Schema execution failed; startup will retry instead of continuing with partial DB init');
                            throw sqlErr;
                        }
                    }
                }

                if (!schemaApplied) {
                    throw new Error('Could not find init_schema.sql in known paths. Startup aborted to avoid partial/invalid DB state.');
                }

                // Verify again after init
                const recheck = await client.query(`
                    SELECT table_name FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = ANY($1::text[])
                `, [ALL_TABLES]);
                const viewRecheck = await client.query(`
                    SELECT table_name FROM information_schema.views
                    WHERE table_schema = 'public' AND table_name = ANY($1::text[])
                `, [ALL_VIEWS]);

                const foundAfter = recheck.rows.map(r => r.table_name);
                const foundViewsAfter = viewRecheck.rows.map(r => r.table_name);
                const stillMissingTables = ALL_TABLES.filter(t => !foundAfter.includes(t));
                const stillMissingViews = ALL_VIEWS.filter(v => !foundViewsAfter.includes(v));

                if (stillMissingTables.length > 0 || stillMissingViews.length > 0) {
                    throw new Error(`DB schema still incomplete after init. Missing tables: ${stillMissingTables.join(', ') || 'none'}; missing views: ${stillMissingViews.join(', ') || 'none'}`);
                }

                logger.info(`STEP 3.2/6: ${ALL_TABLES.length}/${ALL_TABLES.length} tables + ${ALL_VIEWS.length}/${ALL_VIEWS.length} views present after auto-init. ✅`);

            } else {
                logger.info(`STEP 3.1/6: All ${ALL_TABLES.length} tables + ${ALL_VIEWS.length} views verified. ✅`);
            }

            // Ensure our high-speed roll-up table exists for dual writes
            await client.query(`
                CREATE TABLE IF NOT EXISTS historical_aggregates (
                    bucket_time TIMESTAMP NOT NULL,
                    total_alerts INT DEFAULT 0,
                    anpr_count INT DEFAULT 0,
                    frs_count INT DEFAULT 0,
                    PRIMARY KEY (bucket_time)
                );
            `);
            logger.info('STEP 3.3/6: Dual-Write Rollup table verified.');

            client.release();
            return; // ✅ Success — exit retry loop

        } catch (err) {
            const delay = Math.min(BASE_DELAY_MS * Math.pow(2, attempt - 1), 30000);
            if (attempt < MAX_RETRIES) {
                logger.warn(
                    { err: err.message, attempt, nextRetryMs: delay },
                    `STEP 3/6: DB connection failed (attempt ${attempt}/${MAX_RETRIES}). Retrying in ${delay / 1000}s...`
                );
                await new Promise(r => setTimeout(r, delay));
            } else {
                logger.error(
                    { err: err.message },
                    `STEP 3/6 [FAILED]: Could not connect to database '${config.db.database}' after ${MAX_RETRIES} attempts. Check PostgreSQL is running and .env is correct.`
                );
                process.exit(1);
            }
        }
    }
}

module.exports = {
    pool,
    verifyDB
};
