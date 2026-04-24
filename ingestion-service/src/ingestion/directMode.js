const createLogger = require('../../utils/createLogger');
const logger = createLogger('ingestion-direct');

let classificationRules = [];
let pool = null;

function initDirectMode(dbPool, rules) {
    pool = dbPool;
    classificationRules = rules;
}

function extractLiveStateForDirectMode(map, msg) {
    try {
        if (!msg.camera_id) return;
        const rule = classificationRules.find(r => {
            const val = msg.payload[r.match_field] || msg.payload?.properties?.[r.match_field] || msg[r.match_field];
            return val === r.match_value;
        });
        if (!rule) return;

        const domain = rule.domain;
        const cameraId = msg.camera_id;
        
        let data = map.get(cameraId);
        if (!data) {
            data = {
                camera_id: cameraId,
                camera_name: msg.normalized?.camera_name || 'UNKNOWN',
                source_id: msg.normalized?.source_id,
                source_type: domain,
                last_event_time: msg.event_time
            };
            map.set(cameraId, data);
        }
        
        data.last_event_time = msg.event_time > data.last_event_time ? msg.event_time : data.last_event_time;

        const payload = msg.payload;
        if (domain === 'CROWD') {
            const count = payload.count || payload.personCount || payload.properties?.count || 0;
            data.crowd_count = count;
            data.crowd_state = payload.status || payload.state || (count > 10 ? 'CROWDED' : 'NORMAL');
            data.crowd_last_time = msg.event_time;
        } else if (domain === 'TRAFFIC') {
            data.vehicle_count = payload.vehicle_count || payload.count || 0;
            data.traffic_state = payload.traffic_state || payload.state || 'UNKNOWN';
            data.traffic_last_time = msg.event_time;
        } else if (domain === 'PARKING') {
            const occupancy = payload.occupancy || payload.occupied || 0;
            data.parking_occupancy = occupancy;
            data.parking_state = payload.state || (occupancy > 0 ? 'OCCUPIED' : 'AVAILABLE');
            data.parking_last_time = msg.event_time;
        } else if (domain === 'SECURITY') {
            const secState = payload.alertType || payload.description || 'ALERT';
            data.security_state = secState;
            data.security_last_time = msg.event_time;
        }

    } catch (err) {
        logger.error({ err, cameraId: msg.camera_id }, 'Error extracting live state in direct mode');
    }
}

async function insertDirectLiveStates(map) {
    if (!pool) return;
    try {
        const stateValues = [];
        const stateParams = [];
        let sIdx = 1;

        for (const [cameraId, dataStr] of map.entries()) {
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
            await pool.query(`
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
        }
    } catch (e) {
        logger.error({ err: e.message }, 'Failed to insert fast direct live states');
    }
}

module.exports = {
    initDirectMode,
    extractLiveStateForDirectMode,
    insertDirectLiveStates
};
