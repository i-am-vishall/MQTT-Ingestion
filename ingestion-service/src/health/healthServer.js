const http = require('http');
const config = require('../config/config');
const createLogger = require('../../utils/createLogger');
const logger = createLogger('health');

let dbPool = null;
let redisClient = null;
let getDependencies = null;

function initHealthServer(pool, redis, depsGetter) {
    dbPool = pool;
    redisClient = redis;
    getDependencies = depsGetter;
}

const healthServer = http.createServer(async (req, res) => {
    const deps = getDependencies ? getDependencies() : {};
    const {
        totalIngested = 0,
        tieredBuffer,
        localBatch = [],
        circuitBreaker,
        streamConsumer,
        brokerStates = new Map()
    } = deps;

    if (req.url === '/health') {
        try {
            // Fetch Redis stream info
            let streamLen = 0, pendingCount = 0, checkSem = '0', activeWorkers = '0';
            try {
                if (redisClient) {
                    const info = await redisClient.xinfo('STREAM', config.stream.name).catch(() => null);
                    if (info) {
                        const lenIdx = info.indexOf('length');
                        if (lenIdx !== -1) streamLen = info[lenIdx + 1];
                    }
                    const pending = await redisClient.xpending(config.stream.name, config.stream.consumerGroup, '-', '+', 10).catch(() => []);
                    pendingCount = pending ? pending.length : 0;
                    checkSem = await redisClient.get('mqtt:db_write_slots').catch(() => '0');
                    activeWorkers = await redisClient.get('mqtt:active_cluster_workers').catch(() => '0');
                }
            } catch (e) { /* ignore */ }

            let dbActive = 0, dbMax = 100, dbRate = 0;
            let dynamicCounts = {};
            try {
                if (dbPool) {
                    const dbStats = await dbPool.query(`
                        SELECT
                            (SELECT COUNT(*) FROM mqtt_events WHERE event_time > NOW() - INTERVAL '1 minute') as last_1min,
                            (SELECT COUNT(*) as active FROM pg_stat_activity WHERE datname = current_database() AND state != 'idle'),
                            (SELECT setting FROM pg_settings WHERE name = 'max_connections') as max_conn
                    `);
                    
                    const sourceStats = await dbPool.query(`
                        SELECT source_id, COUNT(*) as count 
                        FROM mqtt_events 
                        WHERE event_time > NOW() - INTERVAL '1 minute' 
                        GROUP BY source_id 
                        ORDER BY count DESC
                    `);

                    dbActive = parseInt(dbStats.rows[0]?.active || 0);
                    dbMax = parseInt(dbStats.rows[0]?.max_conn || 100);
                    const last1m = parseInt(dbStats.rows[0]?.last_1min || 0);
                    dbRate = Math.round(last1m / 60);
                    for (let row of sourceStats.rows) {
                        const sourceName = row.source_id || 'UNKNOWN';
                        dynamicCounts[sourceName] = (dynamicCounts[sourceName] || 0) + parseInt(row.count);
                    }
                }
            } catch (e) { /* ignore */ }

            const status = {
                status: 'UP',
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                ingestion: {
                    total: totalIngested,
                    mode: config.service.shockAbsorberMode ? 'REDIS_SHOCK_ABSORBER' : 'DIRECT_DB_POSTGRES',
                    buffer: config.service.shockAbsorberMode && tieredBuffer ? tieredBuffer.getStatus() : { type: 'memory_array', localBatchSize: localBatch.length },
                    backpressure: config.service.shockAbsorberMode && circuitBreaker ? circuitBreaker.getStatus() : { status: 'GREEN', reason: 'SHOCK_ABSORBER_OFF' },
                    consumer: config.service.shockAbsorberMode && streamConsumer ? streamConsumer.getStats() : { status: 'BYPASSED' }
                },
                worker_metrics: {
                    streamDepth: Number(streamLen),
                    pendingCount: Number(pendingCount),
                    semaphoreActive: parseInt(checkSem || '0'),
                    semaphoreMax: parseInt(process.env.MAX_CONCURRENT_WRITERS || '3'),
                    activeWorkers: parseInt(activeWorkers || '0'),
                    dbActiveConn: dbActive,
                    dbMaxConn: dbMax,
                    dbThroughputSec: dbRate,
                    counts1m: dynamicCounts
                },
                timestamp: new Date().toISOString()
            };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(status));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    }
    else if (req.url === '/health/brokers') {
        const brokerHealth = {};
        for (const [id, state] of brokerStates.entries()) {
            brokerHealth[id] = state.toJSON();
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'UP',
            brokers: brokerHealth,
            totalBrokers: brokerStates.size,
            healthyBrokers: Array.from(brokerStates.values()).filter(s => s.isHealthy()).length,
            timestamp: new Date().toISOString()
        }));
    }
    else if (req.url.startsWith('/health/brokers/')) {
        const brokerId = req.url.substring('/health/brokers/'.length);
        const state = brokerStates.get(brokerId);
        if (state) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(state.toJSON()));
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Broker not found' }));
        }
    }
    else if (req.url === '/metrics/crowd' || req.url === '/metrics/crowd/') {
        try {
            if (!config.service.shockAbsorberMode) {
                if (!dbPool) throw new Error('DB connected needed for metric');
                const stats = await dbPool.query(`
                    SELECT camera_id, camera_name, source_id, last_event_time, crowd_count, crowd_state 
                    FROM live_camera_state 
                    WHERE crowd_count > 0 OR source_type = 'CROWD' OR crowd_state IS NOT NULL
                    ORDER BY crowd_count DESC LIMIT 500
                `);
                const cameras = stats.rows.map(r => ({
                    cameraId: r.camera_id,
                    cameraName: r.camera_name || r.camera_id,
                    count: parseInt(r.crowd_count || 0),
                    zoneId: '',
                    threshold: 0,
                    severity: 'info',
                    source: r.source_id || '',
                    lastSeen: r.last_event_time || '',
                    overCapacity: (r.crowd_state || '').toUpperCase() === 'CROWDED'
                }));
                const totalPeople = cameras.reduce((sum, c) => sum + c.count, 0);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    timestamp: new Date().toISOString(),
                    summary: {
                        activeCameras: cameras.length,
                        totalPeople,
                        overCapacityCount: cameras.filter(c => c.overCapacity).length
                    },
                    cameras,
                    grafana_table: cameras.map(c => ({
                        Camera: c.cameraName,
                        Count:  c.count,
                        Zone:   c.zoneId,
                        Source: c.source,
                        Alert:  c.overCapacity ? 'YES' : 'no',
                        LastSeen: c.lastSeen
                    }))
                }));
                return;
            }

            if (!redisClient) throw new Error('Redis needed for this metric');
            const ranking = await redisClient.zrevrange('crowd:ranking', 0, 499, 'WITHSCORES');

            const cameras = [];
            let totalPeople = 0;
            let activeCameras = 0;

            for (let i = 0; i < ranking.length; i += 2) {
                const member = ranking[i];
                const parts  = member.split(':');
                const camId  = parts[1];

                const camData = await redisClient.hgetall(`crowd:camera:${camId}`).catch(() => null);
                if (!camData) continue;

                const count = parseInt(camData.count || 0);
                totalPeople += count;
                activeCameras++;

                cameras.push({
                    cameraId:   camId,
                    cameraName: camData.cameraName || camId,
                    count:      count,
                    zoneId:     camData.zoneId || '',
                    threshold:  parseInt(camData.threshold || 0),
                    severity:   camData.severity || 'info',
                    source:     camData.source || '',
                    lastSeen:   camData.lastSeen || '',
                    overCapacity: count > parseInt(camData.threshold || 9999)
                });
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                timestamp: new Date().toISOString(),
                summary: {
                    activeCameras,
                    totalPeople,
                    overCapacityCount: cameras.filter(c => c.overCapacity).length
                },
                cameras,
                grafana_table: cameras.map(c => ({
                    Camera: c.cameraName,
                    Count:  c.count,
                    Zone:   c.zoneId,
                    Source: c.source,
                    Alert:  c.overCapacity ? 'YES' : 'no',
                    LastSeen: c.lastSeen
                }))
            }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
    }
    else if (req.url.startsWith('/metrics/crowd/camera/')) {
        const camId = req.url.replace('/metrics/crowd/camera/', '');
        const camData = await redisClient?.hgetall(`crowd:camera:${camId}`).catch(() => null);
        if (camData && Object.keys(camData).length > 0) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(camData));
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Camera not found or expired' }));
        }
    }
    else {
        res.writeHead(404);
        res.end();
    }
});

function startHealthServer(port = process.env.HEALTH_PORT || 3000) {
    if (!port) return;
    healthServer.listen(port, '127.0.0.1', () => {
        logger.info(`Health Monitor listening on http://127.0.0.1:${port}/health`);
    });
}

function stopHealthServer() {
    if (healthServer) healthServer.close();
}

module.exports = {
    initHealthServer,
    startHealthServer,
    stopHealthServer
};
