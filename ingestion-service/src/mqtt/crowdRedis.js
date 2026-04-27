// ============================================================
// REAL-TIME REDIS CROWD COUNTER
// Fires on every CROWD_DETECTION MQTT event — zero DB load.
//
// Redis Keys:
//   crowd:camera:{id}           HASH  full snapshot by numeric camera ID (backward compat)
//   crowd:cam:{name}            HASH  full snapshot by camera name (Grafana single-cam panels)
//   crowd:by_name               ZSET  cameraName → count — ranked leaderboard (Grafana tables)
//   crowd:ranking               ZSET  "camera:{id}:{name}" → count (backward compat)
//   crowd:group:malweeya_dweep  HASH  cameraName → count for Malweeya zone total
//   crowd:group:ptz             HASH  cameraName → count for PTZ estimation cameras
//   crowd:group:other           HASH  cameraName → count for all other cameras
//   crowd:zone:{zoneId}         HASH  cameraName → count per polygon zone
const { getCameraZonesMap } = require('../db/rules');
const crypto = require('crypto');

const CROWD_TTL_SECONDS = 300; // 5 minutes — stale cameras auto-expire

// Classify camera into a named group for zone aggregation in Grafana
function getCameraGroup(cameraId) {
    const map = getCameraZonesMap();
    if (map && map.has(String(cameraId))) {
        return map.get(String(cameraId));
    }
    return 'other';
}

async function pushCrowdToRedis(redisClient, payload) {
    if (!redisClient) return;
    
    // Only process crowd detection events
    const taskName  = payload.taskName  || payload.task_name  || '';
    const alertType = payload.alertType || payload.alert_type || payload.eventName || '';
    const isCrowdEvent =
        taskName  === 'CROWD_DETECTION' ||
        alertType === 'Crowd_Detected'  ||
        alertType === 'CROWD_DETECTION';
    if (!isCrowdEvent) return;

    const cameraId   = String(payload.cameraId   || payload.camera_id   || 'unknown');
    const cameraName = payload.cameraName || payload.camera_name || cameraId;
    const sourceId   = payload._source_id || payload.VMSServerName || '';
    const severity   = payload.severity || 'info';
    const props      = payload.properties || {};
    const count      = parseInt(props.count ?? payload.count ?? 0);
    // Note: Ignoring payload's zoneId to strictly rely on our DB UI mapping
    const zoneId = props.zoneId || payload.zoneId || '';
    const threshold  = parseInt(props.threshold ?? 0);
    const ts         = payload.alertTime || new Date().toISOString();

    if (isNaN(count)) return;

    // Safe key suffix — replace spaces with underscores (Redis key safety)
    const safeName = cameraName.replace(/\s+/g, '_');
    const group    = getCameraGroup(cameraId); // LOOKUP USING DATABASE MAP!

    const pipe = redisClient.pipeline();

    // ── 1. Per-camera HASH by numeric ID (backward compat) ───────────────────
    const camIdKey = `crowd:camera:${cameraId}`;
    pipe.hset(camIdKey,
        'cameraId', cameraId, 'cameraName', cameraName, 'count', count,
        'zoneId', zoneId, 'threshold', threshold, 'severity', severity,
        'source', sourceId, 'lastSeen', ts);
    pipe.expire(camIdKey, CROWD_TTL_SECONDS);

    // ── 2. Per-camera HASH by camera NAME (Grafana single-camera panels) ─────
    const camNameKey = `crowd:cam:${safeName}`;
    pipe.hset(camNameKey,
        'cameraId', cameraId, 'cameraName', cameraName, 'count', count,
        'zoneId', zoneId, 'threshold', threshold, 'severity', severity,
        'source', sourceId, 'lastSeen', ts);
    pipe.expire(camNameKey, CROWD_TTL_SECONDS);

    // ── 3. Global ZSET keyed by camera name for Grafana ranking panels ────────
    pipe.zadd('crowd:by_name', count, safeName);
    pipe.zremrangebyrank('crowd:by_name', 0, -1001); // cap at 1000 cameras

    // ── 4. Backward-compat ZSET by ID (keeps /metrics/crowd working) ─────────
    pipe.zadd('crowd:ranking', count, `camera:${cameraId}:${cameraName}`);

    // ── 5. Zone GROUP HASH for aggregated totals ───────────────────────────────
    pipe.hset(`crowd:group:${group}`, safeName, count);
    pipe.expire(`crowd:group:${group}`, CROWD_TTL_SECONDS);

    // ── 6. Polygon zone HASH for drill-down ───────────────────────────────────
    if (zoneId) {
        pipe.hset(`crowd:zone:${zoneId}`, safeName, count);
        pipe.expire(`crowd:zone:${zoneId}`, CROWD_TTL_SECONDS);
    }

    await pipe.exec();
}

module.exports = {
    pushCrowdToRedis,
    getCameraGroup
};
