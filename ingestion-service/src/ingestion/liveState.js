const createLogger = require('../../utils/createLogger');
const logger = createLogger('ingestion-live');

// Redis + rules injection
let redis = null;
let classificationRules = [];
let pool = null;

// Per-camera debounce map for direct DB updates (only active when Redis is down)
const directFallbackThrottle = new Map();

function initLiveState(redisClient, dbPool, rules) {
    redis = redisClient;
    pool = dbPool;
    classificationRules = rules;
}

/**
 * DIRECT DB FALLBACK (when Redis is down)
 * - Crowd/Traffic: Throttled (Dynamic Debounce) per camera (Latest event only).
 * - High priority updates for situational awareness.
 */
async function processLiveStateDirect(msg, dynamicDebounceMs = 5000) {
    if (!pool || !msg.camera_id) return;

    // 1. Identify the rule
    const rule = classificationRules.find(r => {
        const val = msg.payload[r.match_field] || msg.payload?.properties?.[r.match_field] || msg[r.match_field];
        return val === r.match_value;
    });
    if (!rule) return;

    const domain = rule.domain;

    // 2. TEMPORAL THROTTLING: Dynamic window per camera for state updates
    const now = Date.now();
    const lastUpdate = directFallbackThrottle.get(msg.camera_id) || 0;

    if (now - lastUpdate < dynamicDebounceMs) {
        // Discard intermediate state updates to protect DB
        return;
    }

    const eventTime = msg.event_time;
    const payload = msg.payload;
    const cameraId = msg.camera_id;
    const cameraName = msg.normalized?.camera_name || 'UNKNOWN';
    const sourceId = msg.normalized?.source_id;

    // 3. Perform a lightweight UPSERT directly to live_camera_state
    const client = await pool.connect();
    try {
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
                    updated_at = NOW()
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
                    updated_at = NOW()
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
                    updated_at = NOW()
            `;
            params = [cameraId, cameraName, sourceId, occupancy, parkingState, eventTime];

        } else if (domain === 'SECURITY' || domain === 'ANPR') {
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
                    updated_at = NOW()
            `;
            params = [cameraId, cameraName, sourceId, secState, eventTime];
        }

        if (query) {
            await client.query(query, params);
            directFallbackThrottle.set(msg.camera_id, now);
        }

    } catch (err) {
        logger.error({ err, cameraId }, 'Failover: Direct Live State update failed');
    } finally {
        client.release();
    }
}

function processLiveStateRedis(redisPipeline, msg) {
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

        const redisKey = `live_camera_state:${cameraId}`;
        
        // HSET values to store
        const data = {
            camera_id: cameraId,
            camera_name: cameraName,
            source_id: sourceId,
            source_type: domain,
            last_event_time: eventTime,
            updated_at: new Date().toISOString()
        };

        if (domain === 'CROWD') {
            const count = payload.count || payload.personCount || payload.properties?.count || 0;
            const state = payload.status || payload.state || (count > 10 ? 'CROWDED' : 'NORMAL');
            data.crowd_count = count;
            data.crowd_state = state;
            data.crowd_last_time = eventTime;

        } else if (domain === 'TRAFFIC') {
            const vehicleCount = payload.vehicle_count || payload.count || 0;
            const trafficState = payload.traffic_state || payload.state || 'UNKNOWN';
            data.vehicle_count = vehicleCount;
            data.traffic_state = trafficState;
            data.traffic_last_time = eventTime;

        } else if (domain === 'PARKING') {
            const occupancy = payload.occupancy || payload.occupied || 0;
            const parkingState = payload.state || (occupancy > 0 ? 'OCCUPIED' : 'AVAILABLE');
            data.parking_occupancy = occupancy;
            data.parking_state = parkingState;
            data.parking_last_time = eventTime;

        } else if (domain === 'SECURITY') {
            const secState = payload.alertType || payload.description || 'ALERT';
            data.security_state = secState;
            data.security_last_time = eventTime;
        }

        // Push to pipeline directly, expire after 5 mins to auto-cleanup stale cameras
        redisPipeline.hset(redisKey, data);
        redisPipeline.expire(redisKey, 300);

        // Mark as dirty for background sync
        redisPipeline.sadd('live_state:dirty', cameraId);

    } catch (err) {
        logger.error({ err, cameraId: msg.camera_id }, 'Error updating live state in Redis');
    }
}

// Background Live State Sync (runs every 60s)
async function syncLiveStateToDB() {
    if (!redis || !pool) return;
    try {
        const dirtyKeys = await redis.smembers('live_state:dirty');
        if (!dirtyKeys || dirtyKeys.length === 0) return;

        const stateValues = [];
        const stateParams = [];
        let sIdx = 1;

        for (const cameraId of dirtyKeys) {
            const dataStr = await redis.hgetall(`live_camera_state:${cameraId}`);
            if (!dataStr || Object.keys(dataStr).length === 0) continue;

            stateValues.push(`($${sIdx++}, $${sIdx++}, $${sIdx++}, $${sIdx++}, $${sIdx++}, $${sIdx++}, $${sIdx++}, $${sIdx++}, $${sIdx++}, $${sIdx++}, $${sIdx++}, $${sIdx++}, $${sIdx++}, $${sIdx++}, $${sIdx++}, $${sIdx++}, NOW())`);
            stateParams.push(
                dataStr.camera_id, dataStr.camera_name, dataStr.source_id, dataStr.source_type,
                dataStr.last_event_time, 
                dataStr.crowd_count || null, dataStr.crowd_state || null, dataStr.crowd_last_time || null,
                dataStr.vehicle_count || null, dataStr.traffic_state || null, dataStr.traffic_last_time || null,
                dataStr.security_state || null, dataStr.security_last_time || null,
                dataStr.parking_occupancy || null, dataStr.parking_state || null, dataStr.parking_last_time || null
            );
        }

        if (stateValues.length > 0) {
            const client = await pool.connect();
            try {
                await client.query(`
                    INSERT INTO live_camera_state(
                        camera_id, camera_name, source_id, source_type, last_event_time,
                        crowd_count, crowd_state, crowd_last_time,
                        vehicle_count, traffic_state, traffic_last_time,
                        security_state, security_last_time,
                        parking_occupancy, parking_state, parking_last_time,
                        updated_at
                    ) VALUES ${stateValues.join(', ')}
                    ON CONFLICT(camera_id) DO UPDATE SET
                        camera_name = COALESCE(EXCLUDED.camera_name, live_camera_state.camera_name),
                        source_id = COALESCE(EXCLUDED.source_id, live_camera_state.source_id),
                        source_type = COALESCE(EXCLUDED.source_type, live_camera_state.source_type),
                        last_event_time = EXCLUDED.last_event_time,
                        crowd_count = COALESCE(EXCLUDED.crowd_count, live_camera_state.crowd_count),
                        crowd_state = COALESCE(EXCLUDED.crowd_state, live_camera_state.crowd_state),
                        crowd_last_time = COALESCE(EXCLUDED.crowd_last_time, live_camera_state.crowd_last_time),
                        vehicle_count = COALESCE(EXCLUDED.vehicle_count, live_camera_state.vehicle_count),
                        traffic_state = COALESCE(EXCLUDED.traffic_state, live_camera_state.traffic_state),
                        traffic_last_time = COALESCE(EXCLUDED.traffic_last_time, live_camera_state.traffic_last_time),
                        security_state = COALESCE(EXCLUDED.security_state, live_camera_state.security_state),
                        security_last_time = COALESCE(EXCLUDED.security_last_time, live_camera_state.security_last_time),
                        parking_occupancy = COALESCE(EXCLUDED.parking_occupancy, live_camera_state.parking_occupancy),
                        parking_state = COALESCE(EXCLUDED.parking_state, live_camera_state.parking_state),
                        parking_last_time = COALESCE(EXCLUDED.parking_last_time, live_camera_state.parking_last_time),
                        updated_at = NOW()
                `, stateParams);

                await redis.del('live_state:dirty');
            } finally {
                client.release();
            }
        } else {
            await redis.del('live_state:dirty');
        }
    } catch (e) {
        logger.error({ err: e.message }, 'Failed to sync live state to DB');
    }
}

module.exports = {
    initLiveState,
    processLiveStateDirect,
    processLiveStateRedis,
    syncLiveStateToDB
};
