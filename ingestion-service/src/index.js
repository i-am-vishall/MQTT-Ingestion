const mqtt = require('mqtt');
const { Pool } = require('pg');
const config = require('./config');
const { normalizeEvent } = require('./normalization');
const path = require('path');

// ✅ Centralized Logger & Batching
const createLogger = require('../utils/createLogger');
const logger = createLogger('ingestion');

let messageCounter = 0;
let lastLogTime = Date.now();

// Log Batch Summary (High Performance)
setInterval(() => {
    if (messageCounter > 0) {
        logger.info({
            event: "batch_summary",
            count: messageCounter,
            duration_ms: Date.now() - lastLogTime
        }, `Processed ${messageCounter} MQTT messages`);
        messageCounter = 0; // Reset
        lastLogTime = Date.now();
    }
}, 5000);

// Auto-Load Config into Logger
if (config.debugMode || process.env.DEBUG_MODE_INGESTION === 'true' || process.env.DEBUG_MODE === 'true') {
    logger.level = 'debug';
}

const effectiveLogLevel = String(logger.level || config.logLevel || 'info').toUpperCase();

// STARTUP SEQUENCE LOGGING
logger.info('===================================================');
logger.info(`STEP 1/6: Service Process Starting... (Log Level: ${effectiveLogLevel})`);
logger.info(`   > Version: v6.0(ICCC Architecture Upgrade)`);
logger.info('===================================================');

// Database Pool
logger.info(`STEP 2/6: Initializing Database Connection Pool... (Target: ${config.db.database} @ ${config.db.host}:${config.db.port})`);
const pool = new Pool(config.db);

// State
let messageBuffer = [];
let batchTimer = null;
let totalIngested = 0;
let classificationRules = []; // Cache for rules
let payloadMappings = []; // Cache for mappings

// Periodic Heartbeat / Status Log (Every 30 seconds)
setInterval(() => {
    if (process.env.DEBUG_MODE === 'true') {
        logger.debug({
            action: 'heartbeat',
            bufferSize: messageBuffer.length,
            totalIngested: totalIngested,
            rulesLoaded: classificationRules.length,
            mappingsLoaded: payloadMappings.length,
            memory: (process.memoryUsage().rss / 1024 / 1024).toFixed(2) + ' MB'
        }, 'Service Status: RUNNING');
    }
}, 30000);

// Connect to PostgreSQL
pool.on('error', (err, client) => {
    logger.error(err, 'CRITICAL: Unexpected error on idle DB client');
});

async function verifyDB() {
    try {
        const client = await pool.connect();
        const res = await client.query('SELECT NOW()');
        logger.info('STEP 3/6: Database Connected Successfully at ' + res.rows[0].now);

        // Check if core tables exist
        const tableCheck = await client.query(`
            SELECT COUNT(*) as cnt FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('mqtt_events', 'live_camera_state', 'anpr_event_fact', 'event_classification_rules')
        `);

        const existingTables = parseInt(tableCheck.rows[0].cnt);

        if (existingTables < 4) {
            logger.warn(`STEP 3.1/6: Only ${existingTables}/4 core tables found. Attempting auto-initialization...`);

            // Try to find and run init_schema.sql
            const fs = require('fs');
            const schemaSearchPaths = [
                path.join(path.dirname(process.execPath), 'init_schema.sql'),
                path.join(path.dirname(process.execPath), 'db', 'init_schema.sql'),
                path.join(process.cwd(), 'init_schema.sql'),
                path.join(process.cwd(), 'db', 'init_schema.sql'),
                path.join(__dirname, '..', 'init_schema.sql'),
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
                        logger.warn({ err: sqlErr.message }, 'Schema execution had issues (may be partial)');
                        // Continue - some errors are OK (e.g., already exists)
                        schemaApplied = true;
                        break;
                    }
                }
            }

            if (!schemaApplied) {
                logger.warn('Could not find init_schema.sql for auto-init. Tables may be missing.');
                logger.warn('Searched paths: ' + schemaSearchPaths.join(', '));
            }
        } else {
            logger.info('STEP 3.1/6: All core tables verified.');
        }

        client.release();

        // Load Rules & Mappings
        await loadRules();
        await loadMappings();
    } catch (err) {
        logger.fatal(err, 'STEP 3/6 [FAILED]: Could not connect to Database');
        process.exit(1);
    }
}

async function loadRules() {
    try {
        const res = await pool.query('SELECT * FROM event_classification_rules WHERE enabled = true');
        classificationRules = res.rows;
        logger.info(`STEP 3.5 / 6: Loaded ${classificationRules.length} classification rules.`);
    } catch (err) {
        logger.error(err, 'Failed to load validation rules');
    }
}

async function loadMappings() {
    try {
        const res = await pool.query('SELECT * FROM payload_schema_mappings WHERE is_active = true');
        payloadMappings = res.rows;
        logger.info(`STEP 3.6 / 6: Loaded ${payloadMappings.length} payload mappings.`);
    } catch (err) {
        logger.error(err, 'Failed to load payload mappings');
    }
}

verifyDB();

// MQTT Client
const clients = [];

function handleMessage(topic, message, sourceId, sourceIp) {
    try {
        const payloadStr = message.toString();
        // Parse JSON
        let payload;
        try {
            payload = JSON.parse(payloadStr);
        } catch (e) {
            // logger.warn({ topic }, 'Invalid JSON received, skipping'); 
            return;
        }

        // Optimization: Remove heavy snapshot field (Base64) to save storage
        if (payload.snapshot) {
            delete payload.snapshot;
        } else if (payload.Snapshot) {
            delete payload.Snapshot;
        }

        // Inject Source Identity
        if (sourceId) payload._source_id = sourceId;
        if (sourceIp) payload._source_ip = sourceIp;

        // Sanitization
        const blacklist = [
            'fullimgpath', 'plateimgpath', 'faceimgpath',
            'fullimagepath', 'faceimg', 'plateimg', 'snapshot'
        ];
        const sanitizeObject = (obj) => {
            if (!obj || typeof obj !== 'object') return;
            Object.keys(obj).forEach(key => {
                const lowerKey = key.toLowerCase();
                const isBlacklisted = blacklist.some(b => lowerKey === b || lowerKey.includes(b));
                if (isBlacklisted) {
                    delete obj[key];
                } else {
                    sanitizeObject(obj[key]);
                }
            });
        };
        sanitizeObject(payload);

        // Analysis & Normalization
        const normalizedEvent = normalizeEvent(topic, payload);

        // Standardize event data
        const eventData = {
            topic,
            payload,
            normalized: normalizedEvent, // Attach normalized event
            event_time: normalizedEvent.event_time,
            camera_id: normalizedEvent.camera_id,
            event_type: normalizedEvent.event_type,
            severity: payload.severity || payload.level || 'info'
        };

        addToBatch(eventData);
        // INCREMENT BATCH COUNTER
        messageCounter++;

    } catch (err) {
        logger.error(err, 'Error processing message');
    }
}

// Connect to multiple brokers
if (config.mqtt.brokerUrls && config.mqtt.brokerUrls.length > 0) {
    config.mqtt.brokerUrls.forEach((url, idx) => {
        let sourceIp = 'UNKNOWN_IP';
        let sourceId = `UNKNOWN_SOURCE_${idx + 1}`;
        logger.debug(`DEBUG: Index ${idx}, URL: ${url}`);
        logger.debug(`DEBUG: Configured IDs: ${JSON.stringify(config.mqtt.brokerIds)}`);
        logger.debug(`DEBUG: Source Prefix: ${config.service.sourcePrefix}`);

        try {
            const urlObj = new URL(url.includes('://') ? url : 'mqtt://' + url);
            sourceIp = urlObj.hostname;

            if (config.mqtt.brokerIds && config.mqtt.brokerIds[idx]) {
                sourceId = config.mqtt.brokerIds[idx];
            } else {
                sourceId = `${config.service.sourcePrefix}_${sourceIp.replace(/\./g, '_')}`;
            }

        } catch (e) {
            logger.warn({ err: e, url }, 'Failed to parse Broker URL');
        }

        logger.info(`STEP 4 / 6 [${sourceId}]: Connecting to ${url} (${sourceIp})...`);
        const client = mqtt.connect(url, {
            reconnectPeriod: config.mqtt.reconnectPeriod,
        });

        client.on('connect', () => {
            logger.info(`STEP 4/6 [${sourceId}]: MQTT Connected!`);
            client.subscribe(config.mqtt.topics, (err) => {
                if (!err) {
                    logger.info(`STEP 5 / 6 [${sourceId}]: Subscribed to topics: ${config.mqtt.topics.join(', ')}`);
                } else {
                    logger.error(err, `STEP 5/6 [${sourceId} FAILED]: Failed to subscribe`);
                }
            });
        });

        client.on('message', (topic, message) => handleMessage(topic, message, sourceId, sourceIp));
        client.on('error', (err) => logger.error(err, `[${sourceId}] Error:`));

        clients.push(client);
    });

    logger.info('===================================================');
    logger.info(`       SERVICE RUNNING (${clients.length} Brokers)        `);
    logger.info('===================================================');
} else {
    logger.error('No MQTT Broker URLs configured!');
}

function addToBatch(event) {
    // 1. Cap Buffer Size (Prevent OOM)
    const MAX_BUFFER = 5000;
    if (messageBuffer.length >= MAX_BUFFER) {
        // Drop oldest 10% to make room
        const dropCount = Math.floor(MAX_BUFFER * 0.1);
        messageBuffer.splice(0, dropCount);
        logger.error({ dropped: dropCount, bufferSize: messageBuffer.length }, 'CRITICAL: Buffer full! Dropping oldest events.');
    }

    messageBuffer.push(event);
    if (messageBuffer.length >= config.service.batchSize) {
        flushBatch();
    } else if (!batchTimer) {
        batchTimer = setTimeout(flushBatch, config.service.batchTimeoutMs);
    }
}


let isFlushing = false;

async function flushBatch() {
    if (isFlushing) return;
    isFlushing = true;

    try {
        // Drain Loop: Keep processing until buffer is empty
        while (messageBuffer.length > 0) {

            // Clear Timer if active
            if (batchTimer) {
                clearTimeout(batchTimer);
                batchTimer = null;
            }

            // Swap Buffer
            const batch = messageBuffer;
            messageBuffer = [];

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // 1. Insert Raw Events
                const queryText = `
                    INSERT INTO mqtt_events(event_time, camera_id, event_type, severity, payload, source_id, source_ip, camera_name)
                    VALUES($1, $2, $3, $4, $5, $6, $7, $8)
                `;

                for (const msg of batch) {
                    // Raw Insert
                    await client.query(queryText, [
                        msg.event_time,
                        msg.camera_id,
                        msg.event_type,
                        msg.severity,
                        msg.payload,
                        msg.normalized?.source_id || 'UNKNOWN_SOURCE',
                        msg.normalized?.source_ip,
                        msg.normalized?.camera_name || 'UNKNOWN'
                    ]);

                    // 2. Classify and Update Live State
                    await processLiveState(client, msg);


                    // 3. Process ANPR Facts
                    const isAnpr = msg.normalized?.event_type === 'ANPR' || msg.event_type === 'ANPR';
                    const isFrs = msg.normalized?.event_type === 'Face_Recognition' || msg.event_type === 'Face_Recognition';

                    // 4. Process FRS Facts
                    if (isFrs) {
                        await processFrsFact(client, msg);
                    } else if (isAnpr) {
                        await processAnprFact(client, msg);
                    }
                }

                await client.query('COMMIT');
                totalIngested += batch.length;
                // NO SUCCESS LOG ON BATCH - PERFORMANCE
                // logger.info({ count: batch.length, total: totalIngested }, `Inserted batch of ${batch.length}`);

            } catch (e) {
                await client.query('ROLLBACK');
                logger.error(e, 'Failed to insert batch to DB');
            } finally {
                client.release();
            }
        }
    } catch (outerErr) {
        logger.error(outerErr, 'Critical Error in flush loop');
    } finally {
        isFlushing = false;
        // Safety check
        if (messageBuffer.length >= config.service.batchSize) {
            setTimeout(flushBatch, 0);
        }
    }
}

async function processLiveState(dbClient, msg) {
    try {
        if (!msg.camera_id) return;

        // Find matching rule
        const rule = classificationRules.find(r => {
            const val = msg.payload[r.match_field] || msg.payload?.properties?.[r.match_field] || msg[r.match_field];
            return val === r.match_value;
        });

        if (!rule) {
            return;
        }

        const domain = rule.domain;
        const eventTime = msg.event_time;
        const payload = msg.payload;
        const cameraId = msg.camera_id;
        const cameraName = msg.normalized?.camera_name || 'UNKNOWN';
        const sourceId = msg.normalized?.source_id;

        let query = '';
        let params = [];

        if (domain === 'CROWD') {
            const count = payload.count || payload.personCount || payload.properties?.count || 0;
            const state = payload.status || payload.state || (count > 10 ? 'CROWDED' : 'NORMAL');
            query = `
                INSERT INTO live_camera_state (
                    camera_id, camera_name, source_id, source_type,
                    crowd_count, crowd_state, crowd_last_time, last_event_time, updated_at
                ) VALUES ($1, $2, $3, 'CROWD', $4, $5, $6, $6, NOW())
                ON CONFLICT (camera_id) DO UPDATE SET
                    crowd_count = EXCLUDED.crowd_count,
                    crowd_state = EXCLUDED.crowd_state,
                    crowd_last_time = EXCLUDED.crowd_last_time,
                    last_event_time = GREATEST(live_camera_state.last_event_time, EXCLUDED.last_event_time),
                    updated_at = NOW(),
                    camera_name = EXCLUDED.camera_name
                WHERE live_camera_state.crowd_last_time IS NULL OR live_camera_state.crowd_last_time < EXCLUDED.crowd_last_time
            `;
            params = [cameraId, cameraName, sourceId, count, state, eventTime];

        } else if (domain === 'TRAFFIC') {
            const vehicleCount = payload.vehicle_count || payload.count || 0;
            const trafficState = payload.traffic_state || payload.state || 'UNKNOWN';
            query = `
                INSERT INTO live_camera_state (
                    camera_id, camera_name, source_id, source_type,
                    vehicle_count, traffic_state, traffic_last_time, last_event_time, updated_at
                ) VALUES ($1, $2, $3, 'TRAFFIC', $4, $5, $6, $6, NOW())
                ON CONFLICT (camera_id) DO UPDATE SET
                    vehicle_count = EXCLUDED.vehicle_count,
                    traffic_state = EXCLUDED.traffic_state,
                    traffic_last_time = EXCLUDED.traffic_last_time,
                    last_event_time = GREATEST(live_camera_state.last_event_time, EXCLUDED.last_event_time),
                    updated_at = NOW(),
                    camera_name = EXCLUDED.camera_name
                WHERE live_camera_state.traffic_last_time IS NULL OR live_camera_state.traffic_last_time < EXCLUDED.traffic_last_time
            `;
            params = [cameraId, cameraName, sourceId, vehicleCount, trafficState, eventTime];

        } else if (domain === 'PARKING') {
            const occupancy = payload.occupancy || payload.occupied || 0;
            const parkingState = payload.state || (occupancy > 0 ? 'OCCUPIED' : 'AVAILABLE');
            query = `
                INSERT INTO live_camera_state (
                    camera_id, camera_name, source_id, source_type,
                    parking_occupancy, parking_state, parking_last_time, last_event_time, updated_at
                ) VALUES ($1, $2, $3, 'PARKING', $4, $5, $6, $6, NOW())
                ON CONFLICT (camera_id) DO UPDATE SET
                    parking_occupancy = EXCLUDED.parking_occupancy,
                    parking_state = EXCLUDED.parking_state,
                    parking_last_time = EXCLUDED.parking_last_time,
                    last_event_time = GREATEST(live_camera_state.last_event_time, EXCLUDED.last_event_time),
                    updated_at = NOW(),
                    camera_name = EXCLUDED.camera_name
                WHERE live_camera_state.parking_last_time IS NULL OR live_camera_state.parking_last_time < EXCLUDED.parking_last_time
            `;
            params = [cameraId, cameraName, sourceId, occupancy, parkingState, eventTime];

        } else if (domain === 'SECURITY') {
            const secState = payload.alertType || payload.description || 'ALERT';
            query = `
                INSERT INTO live_camera_state (
                    camera_id, camera_name, source_id, source_type,
                    security_state, security_last_time, last_event_time, updated_at
                ) VALUES ($1, $2, $3, 'SECURITY', $4, $5, $5, NOW())
                ON CONFLICT (camera_id) DO UPDATE SET
                    security_state = EXCLUDED.security_state,
                    security_last_time = EXCLUDED.security_last_time,
                    last_event_time = GREATEST(live_camera_state.last_event_time, EXCLUDED.last_event_time),
                    updated_at = NOW(),
                    camera_name = EXCLUDED.camera_name
                WHERE live_camera_state.security_last_time IS NULL OR live_camera_state.security_last_time < EXCLUDED.security_last_time
            `;
            params = [cameraId, cameraName, sourceId, secState, eventTime];
        }

        if (query) {
            await dbClient.query(query, params);
        }

    } catch (err) {
        logger.error({ err, cameraId: msg.camera_id }, 'Error updating live state');
    }
}

async function processAnprFact(dbClient, event) {
    try {
        const norm = event.normalized;
        if (!norm) return;

        await dbClient.query(`
            INSERT INTO anpr_event_fact
    (event_time, camera_id, plate_number, vehicle_type, vehicle_color, vehicle_make,
        is_violation, violation_types, speed, source_type, source_name, source_id, source_ip, camera_name)
VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (plate_number, camera_id, event_10s_bucket) DO NOTHING
    `, [
            norm.event_time,
            norm.camera_id,
            norm.plate_number,
            norm.vehicle_type,
            norm.vehicle_color,
            norm.vehicle_make,
            norm.is_violation,
            norm.violation_types,
            norm.speed,
            norm.source_type,
            norm.source_id,
            norm.source_id,
            norm.source_ip,
            norm.camera_name || 'UNKNOWN'
        ]);

    } catch (err) {
        logger.error({ err, cameraId: event.camera_id }, 'Error processing ANPR fact');
    }
}

function getByPath(obj, path) {
    if (!path) return undefined;
    if (typeof path !== 'string') return undefined;
    return path.split('.').reduce((acc, part) => {
        if (part.includes('[') && part.endsWith(']')) {
            const [key, idx] = part.split('[');
            const index = parseInt(idx.replace(']', ''));
            return acc && acc[key] ? acc[key][index] : undefined;
        }
        return acc && acc[part];
    }, obj);
}

function matchCriteria(payload, criteria, topic, sourceId, sourceIp) {
    if (!criteria || Object.keys(criteria).length === 0) return true;
    for (const [key, val] of Object.entries(criteria)) {
        if (key === 'topic_pattern') {
            try {
                const regex = new RegExp(val);
                if (!regex.test(topic)) return false;
            } catch (e) {
                if (!topic.includes(val)) return false;
            }
            continue;
        }
        if (key === 'source_id') {
            if (String(sourceId) !== String(val)) return false;
            continue;
        }
        if (key === 'source_ip') {
            if (String(sourceIp) !== String(val)) return false;
            continue;
        }
        const actual = getByPath(payload, key);
        if (String(actual) !== String(val)) return false;
    }
    return true;
}

async function processFrsFact(dbClient, event) {
    try {
        const payload = event.payload;

        let personName = 'Unknown';
        let gender = 'Unknown';
        let age = 0;
        let detConf = 0;
        let recConf = 0;
        let facePath = '';
        let matchId = null;
        let trackId = null;

        const topic = event.topic || '';
        const sourceId = event.source_id || '';
        const sourceIp = event.source_ip || '';

        const mapping = payloadMappings.find(m =>
            m.event_type === 'Face_Recognition' && matchCriteria(payload, m.identification_criteria, topic, sourceId, sourceIp)
        );

        if (mapping) {
            const config = mapping.mapping_config;
            personName = getByPath(payload, config.person_name) || personName;
            gender = getByPath(payload, config.gender) || gender;
            age = parseInt(getByPath(payload, config.age) || '0');
            detConf = parseFloat(getByPath(payload, config.det_conf) || '0');
            recConf = parseFloat(getByPath(payload, config.rec_conf) || '0');
            facePath = getByPath(payload, config.face_image_path) || '';
            matchId = getByPath(payload, config.match_id) || null;
            trackId = getByPath(payload, config.track_id) || null;
        } else {
            const props = payload.properties || {};
            personName = props.personName || props.identity || 'Unknown';
            gender = props.gender || 'Unknown';
            age = parseInt(props.age || '0');
            detConf = parseFloat(props.detConf || '0');
            recConf = parseFloat(props.recConf || '0');
            facePath = props.faceImg || ''; // Legacy
            matchId = props.matchId;
            trackId = props.trackId;
        }

        await dbClient.query(`
            INSERT INTO frs_event_fact
            (event_time, camera_id, camera_name, person_name, gender, age, 
             match_id, track_id, det_conf, rec_conf, face_image_path)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
            event.event_time,
            event.camera_id,
            event.normalized?.camera_name || 'UNKNOWN',
            personName,
            gender,
            age,
            matchId,
            trackId,
            detConf,
            recConf,
            facePath
        ]);

    } catch (err) {
        logger.error({ err, cameraId: event.camera_id }, 'Error processing FRS fact');
    }
}

async function runBucketJob() {
    try {
        // logger.debug('Running 1-minute bucket population job...');
        const query = `
            INSERT INTO camera_metrics_1min
    (bucket_time, camera_id, crowd_count, vehicle_count, parking_occupancy, traffic_state, crowd_state, parking_state)
SELECT
date_trunc('minute', now()),
    camera_id,
    COALESCE(crowd_count, 0),
    COALESCE(vehicle_count, 0),
    COALESCE(parking_occupancy, 0),
    traffic_state,
    crowd_state,
    parking_state
            FROM live_camera_state
            ON CONFLICT(bucket_time, camera_id) DO NOTHING;
`;
        await pool.query(query);

        const anprQuery = `
            INSERT INTO anpr_metrics_1min(bucket_time, camera_id, anpr_count)
SELECT
date_trunc('minute', event_time),
    camera_id,
    COUNT(*)
            FROM anpr_event_fact
            WHERE event_time >= now() - interval '2 minutes'
            GROUP BY 1, 2
            ON CONFLICT(bucket_time, camera_id)
            DO UPDATE SET anpr_count = EXCLUDED.anpr_count;
`;
        await pool.query(anprQuery);

        const violationQuery = `
            INSERT INTO anpr_violation_metrics_1min(bucket_time, violation_type, violation_count)
SELECT
date_trunc('minute', event_time),
    vt,
    COUNT(*)
            FROM anpr_event_fact,
    LATERAL unnest(violation_types) vt
            WHERE event_time >= now() - interval '2 minutes'
            GROUP BY 1, 2
            ON CONFLICT(bucket_time, violation_type)
            DO UPDATE SET violation_count = EXCLUDED.violation_count;
`;
        await pool.query(violationQuery);

        const frsQuery = `
            INSERT INTO frs_metrics_1min(
                bucket_time, camera_id, 
                total_faces, unique_persons, male_count, female_count
            )
            SELECT
                date_trunc('minute', event_time),
                camera_id,
                COUNT(*),
                COUNT(DISTINCT person_name),
                SUM(CASE WHEN gender ILIKE 'male' THEN 1 ELSE 0 END),
                SUM(CASE WHEN gender ILIKE 'female' THEN 1 ELSE 0 END)
            FROM frs_event_fact
            WHERE event_time >= now() - interval '2 minutes'
            GROUP BY 1, 2
            ON CONFLICT(bucket_time, camera_id)
            DO UPDATE SET 
                total_faces = EXCLUDED.total_faces,
                unique_persons = EXCLUDED.unique_persons,
                male_count = EXCLUDED.male_count,
                female_count = EXCLUDED.female_count;
        `;
        await pool.query(frsQuery);

    } catch (err) {
        logger.error(err, 'Bucket population job failed');
    }
}

async function runHealthCheckJob() {
    try {
        const sources = config.mqtt.brokerUrls.map((url, idx) => {
            try {
                const u = new URL(url.includes('://') ? url : 'mqtt://' + url);
                return {
                    ip: u.hostname,
                    id: config.mqtt.brokerIds?.[idx] || `${config.service.sourcePrefix}_${u.hostname.replace(/\./g, '_')}`
                };
            } catch (e) { return null; }
        }).filter(s => s);

        for (const source of sources) {
            const res = await pool.query(`
                SELECT MAX(event_time) as last_seen 
                FROM mqtt_events 
                WHERE source_ip = $1 AND event_time > NOW() - INTERVAL '2 minutes'
            `, [source.ip]);

            const lastSeen = res.rows[0]?.last_seen;
            const status = lastSeen ? 'ONLINE' : 'OFFLINE';

            await pool.query(`
                INSERT INTO source_health_status (source_ip, source_id, last_event_time, status, updated_at)
                VALUES ($1, $2, $3, $4, NOW())
                ON CONFLICT (source_ip) DO UPDATE SET
                    status = EXCLUDED.status,
                    last_event_time = COALESCE(EXCLUDED.last_event_time, source_health_status.last_event_time),
                    updated_at = NOW();
            `, [source.ip, source.id, lastSeen, status]);
        }
    } catch (err) {
        logger.error(err, 'Health check job failed');
    }
}

function alignAndStartScheduler() {
    const now = new Date();
    const msToNext = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

    logger.info(`Scheduling metrics job to start in ${msToNext} ms (aligned to minute)`);

    setTimeout(() => {
        runBucketJob();
        runHealthCheckJob(); // Run immediately on alignment
        setInterval(runBucketJob, 60000);
        setInterval(runHealthCheckJob, 60000);
    }, msToNext);
}

// CLI Self-Diagnosis
if (process.argv.includes('--check')) {
    console.log('Running Self-Check...');
    const diagnose = async () => {
        try {
            console.log('[1/2] Connecting to Database...');
            const dbCheck = new Pool(config.db);
            await dbCheck.query('SELECT 1');
            console.log('   ✅ Database Connection: OK');
            await dbCheck.end();

            console.log('[2/2] Checking Config...');
            if (!config.mqtt.brokerUrls || config.mqtt.brokerUrls.length === 0) {
                throw new Error('No Broker URLs configured');
            }
            console.log('   ✅ Configuration: OK');

            console.log('\nResult: SERVICE HEALTHY');
            process.exit(0);
        } catch (e) {
            console.error('\nResult: SERVICE UNHEALTHY');
            console.error('Error:', e.message);
            process.exit(1);
        }
    };
    diagnose();
    return;
}

// HTTP Health Server
const http = require('http');
const HEALTH_PORT = process.env.HEALTH_PORT || 3333;

const healthServer = http.createServer((req, res) => {
    if (req.url === '/health') {
        const status = {
            status: 'UP',
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            ingestion: {
                total: totalIngested,
                buffer: messageBuffer.length
            },
            timestamp: new Date().toISOString()
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(status));
    } else {
        res.writeHead(404);
        res.end();
    }
});

healthServer.listen(HEALTH_PORT, '127.0.0.1', () => {
    logger.info(`Health Monitor listening on http://127.0.0.1:${HEALTH_PORT}/health`);
});

logger.info('Starting Normal Service Flow...');
alignAndStartScheduler();

// Graceful Shutdown
const shutdown = async (signal) => {
    logger.info(`${signal} signal received: closing resources`);

    setTimeout(() => {
        console.error('Force shutting down after timeout');
        logger.fatal('Force shutting down after timeout');
        process.exit(1);
    }, 5000);

    try {
        if (healthServer) healthServer.close();
        await flushBatch();
        await pool.end();
        clients.forEach(c => c.end());
        logger.info('Graceful shutdown complete');
        process.exit(0);
    } catch (e) {
        logger.error(e, 'Error during shutdown');
        process.exit(1);
    }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
    console.error('CRITICAL: Uncaught Exception!', err);
    logger.fatal(err, 'CRITICAL: Uncaught Exception! Service will restart.');
    setTimeout(() => {
        process.exit(1);
    }, 500);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('CRITICAL: Unhandled Rejection!', reason);
    logger.error({ err: reason, promise }, 'CRITICAL: Unhandled Rejection');
});
