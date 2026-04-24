const createLogger = require('../../utils/createLogger');
const logger = createLogger('scheduler');
const config = require('../config/config');

let pool = null;

function initScheduler(dbPool) {
    pool = dbPool;
}

async function runBucketJob() {
    if (!pool) return;
    try {
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

        // Calculate and insert system-wide historical aggregate roll-ups
        const sysAgg = await pool.query(`
            SELECT SUM(COALESCE(crowd_count, 0)) as tf, SUM(COALESCE(vehicle_count, 0)) as tv, SUM(COALESCE(parking_occupancy, 0)) as tp
            FROM live_camera_state
        `);
    } catch (err) {
        logger.error(err, '1-minute bucket job failed');
    }
}

async function runHealthCheckJob() {
    if (!pool) return;
    try {
        const sources = config.mqtt.brokerUrls.map((url, idx) => {
            try {
                const u = new URL(url.includes('://') ? url : 'mqtt://' + url);
                return {
                    ip: u.hostname,
                    id: config.mqtt.brokerIds?.[idx] || `${config.service.sourcePrefix}_${u.hostname.replace(/\\./g, '_')}`
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

module.exports = {
    initScheduler,
    alignAndStartScheduler
};
