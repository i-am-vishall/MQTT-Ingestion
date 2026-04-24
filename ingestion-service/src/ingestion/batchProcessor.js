const { Readable } = require('stream');
const { from: copyFrom } = require('pg-copy-streams');
const createLogger = require('../../utils/createLogger');
const logger = createLogger('ingestion-batch');

const config = require('../config/config');
const { csvEscape, getAnprFactData, getFrsFactData } = require('./helpers');
const { processLiveStateRedis } = require('./liveState');
const { extractLiveStateForDirectMode, insertDirectLiveStates } = require('./directMode');

let pool = null;
let redis = null;
let payloadMappings = [];

function initBatchProcessor(dbPool, redisClient, mappings) {
    pool = dbPool;
    redis = redisClient;
    payloadMappings = mappings;
}

let totalIngested = 0;

function getTotalIngested() {
    return totalIngested;
}

async function processBatchForDB(batch) {
    if (!batch || batch.length === 0) return;

    if (!pool) {
        logger.error('Database pool not initialized in batchProcessor');
        return;
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Aggregation Math
        let alertCount = 0;
        let anprCount = 0;
        let frsCount = 0;

        // ANPR Bulk Data
        const anprValues = [];
        const anprParams = [];
        let anprIdx = 1;

        // FRS Bulk Data
        const frsValues = [];
        const frsParams = [];
        let frsIdx = 1;

        const redisPipeline = config.service.shockAbsorberMode ? redis?.pipeline() : null;
        const directLiveStateMap = new Map();

        // 1. Bulk Insert Raw Events using Staging Table + Upsert (High Performance + Deduplication)
        // We use a temp table to ingest via COPY, then upsert to the partitioned table
        await client.query(`
            CREATE TEMP TABLE tmp_batch (
                event_time TIMESTAMPTZ,
                camera_id TEXT,
                event_type TEXT,
                severity TEXT,
                payload JSONB,
                source_id TEXT,
                source_ip TEXT,
                camera_name TEXT,
                event_hash TEXT
            ) ON COMMIT DROP
        `);

        const copyPromise = new Promise((resolve, reject) => {
            const stream = client.query(copyFrom(
                `COPY tmp_batch(event_time, camera_id, event_type, severity, payload, source_id, source_ip, camera_name, event_hash) 
                 FROM STDIN WITH (FORMAT csv, NULL '')`
            ));

            const readable = new Readable({ read() {} });
            readable.on('error', reject); // Fix #2: prevents pool connection leak on malformed row

            for (const msg of batch) {
                // Classify and Update Live State
                if (config.service.shockAbsorberMode && redisPipeline) {
                    processLiveStateRedis(redisPipeline, msg);
                } else if (!config.service.shockAbsorberMode) {
                    extractLiveStateForDirectMode(directLiveStateMap, msg);
                }

                alertCount++;
                const isAnpr = msg.normalized?.event_type === 'ANPR' || msg.event_type === 'ANPR';
                const isFrs = msg.normalized?.event_type === 'Face_Recognition' || msg.event_type === 'Face_Recognition';

                if (isFrs) {
                    const frsTuple = getFrsFactData(msg, payloadMappings);
                    if(frsTuple) {
                        frsCount++;
                        frsValues.push(`($${frsIdx++}, $${frsIdx++}, $${frsIdx++}, $${frsIdx++}, $${frsIdx++}, $${frsIdx++}, $${frsIdx++}, $${frsIdx++}, $${frsIdx++}, $${frsIdx++}, $${frsIdx++})`);
                        frsParams.push(...frsTuple);
                    }
                } else if (isAnpr) {
                    const anprTuple = getAnprFactData(msg);
                    if(anprTuple) {
                        anprCount++;
                        anprValues.push(`($${anprIdx++}, $${anprIdx++}, $${anprIdx++}, $${anprIdx++}, $${anprIdx++}, $${anprIdx++}, $${anprIdx++}, $${anprIdx++}, $${anprIdx++}, $${anprIdx++}, $${anprIdx++}, $${anprIdx++}, $${anprIdx++}, $${anprIdx++})`);
                        anprParams.push(...anprTuple);
                    }
                }

                // event_time is guaranteed ISO string by normalization.js.
                // Defense-in-depth: coerce to string just in case upstream changes.
                try {
                    let evTime;
                    if (msg.event_time && typeof msg.event_time === 'string') {
                        evTime = msg.event_time;
                    } else if (msg.event_time instanceof Date) {
                        evTime = msg.event_time.toISOString();
                        logger.warn({ camera_id: msg.camera_id }, 'event_time was a Date object -- normalization.js may not have run');
                    } else {
                        evTime = new Date().toISOString();
                        logger.warn({ event_time: msg.event_time, camera_id: msg.camera_id }, 'Invalid event_time, using NOW()');
                    }
                    const line = [
                        evTime,
                        csvEscape(msg.camera_id || ''),
                        csvEscape(msg.event_type || ''),
                        csvEscape(msg.severity || 'info'),
                        csvEscape(JSON.stringify(msg.payload || {})),
                        csvEscape(msg.normalized?.source_id || 'UNKNOWN_SOURCE'),
                        csvEscape(msg.normalized?.source_ip || ''),
                        csvEscape(msg.normalized?.camera_name || 'UNKNOWN'),
                        msg._hash || ''
                    ].join(',') + '\n';
                    readable.push(line);
                } catch (rowErr) {
                    logger.warn({ camera_id: msg.camera_id, err: rowErr.message }, 'Skipping malformed row in COPY batch');
                }
            }
            readable.push(null);

            readable.pipe(stream);
            stream.on('finish', resolve);
            stream.on('error', reject);
        });

        await copyPromise;

        // Move from staging to main table with full deduplication protection
        await client.query(`
            INSERT INTO mqtt_events (event_time, camera_id, event_type, severity, payload, source_id, source_ip, camera_name, event_hash)
            SELECT * FROM tmp_batch
            ON CONFLICT (event_hash, event_time) DO NOTHING
        `);

        // 2. Insert ANPR
        if (anprValues.length > 0) {
            await client.query(`
                INSERT INTO anpr_event_fact
                (event_time, camera_id, plate_number, vehicle_type, vehicle_color, vehicle_make,
                is_violation, violation_types, speed, source_type, source_name, source_id, source_ip, camera_name)
                VALUES ${anprValues.join(',')}
                ON CONFLICT ON CONSTRAINT uq_anpr_dedup DO NOTHING
            `, anprParams);
        }

        // 3. Insert FRS
        if (frsValues.length > 0) {
            const frsColumns = 'event_time, camera_id, camera_name, person_name, gender, age, match_id, track_id, det_conf, rec_conf, face_image_path';
            await client.query(`
                INSERT INTO frs_event_fact (${frsColumns})
                VALUES ${frsValues.join(',')}
                ON CONFLICT (event_hash) DO NOTHING
            `, frsParams);
        }

        // We completely removed live_camera_state from here to prevent DB contention.

        await client.query('COMMIT');
        
        // Fire Redis Live Panel Updates + Dirty Keys OR UPSERT direct to DB
        if (config.service.shockAbsorberMode && redisPipeline) {
            await redisPipeline.exec();
        } else if (directLiveStateMap.size > 0) {
            await insertDirectLiveStates(directLiveStateMap);
        }

        // Fix #8: Use pool.query (own connection) instead of client.query (post-COMMIT).
        // Previously: if redisPipeline.exec() threw, the aggregate was skipped silently.
        // Now: runs independently after the main transaction, no shared client.
        pool.query(`
            INSERT INTO historical_aggregates (bucket_time, total_alerts, anpr_count, frs_count)
            VALUES (date_trunc('second', NOW()), $1, $2, $3)
            ON CONFLICT (bucket_time) DO UPDATE SET
                total_alerts = historical_aggregates.total_alerts + EXCLUDED.total_alerts,
                anpr_count   = historical_aggregates.anpr_count   + EXCLUDED.anpr_count,
                frs_count    = historical_aggregates.frs_count    + EXCLUDED.frs_count
        `, [alertCount, anprCount, frsCount]).catch(err => {
            logger.warn({ err: err.message }, 'Failed to insert historical aggregate');
        });

        totalIngested += batch.length;

    } catch (e) {
        await client.query('ROLLBACK');
        logger.error(e, 'Failed to insert batch to DB');
        throw e; // Important: throw to trigger binary-split retry in consumer
    } finally {
        client.release();
    }
}

module.exports = {
    initBatchProcessor,
    processBatchForDB,
    getTotalIngested
};
