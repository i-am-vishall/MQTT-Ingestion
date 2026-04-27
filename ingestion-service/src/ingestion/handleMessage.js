const crypto = require('crypto');
const createLogger = require('../../utils/createLogger');
const logger = createLogger('ingestion-handler');

const config = require('../config/config');
const { normalizeEvent } = require('../normalization');
const { sanitizeObject } = require('./helpers');
const { pushCrowdToRedis } = require('../mqtt/crowdRedis');

const { processLiveStateDirect } = require('./liveState');

let circuitBreaker = null;
let dlq = null;
let tieredBuffer = null;
let localBatch = null;
let doMicroFlush = null;
let scheduleMicroFlush = null;
let redisClient = null;

// Adaptive Load Monitor State
const loadMonitor = {
    eps: 0,
    dbLatency: 0,
    isCircuitBroken: false,
    lastEpsReset: Date.now(),
    messageInCurrentWindow: 0,
    dynamicDebounceMs: 5000 // Starts at 5s
};

// Update EPS every second
setInterval(() => {
    const now = Date.now();
    const duration = (now - loadMonitor.lastEpsReset) / 1000;
    loadMonitor.eps = Math.floor(loadMonitor.messageInCurrentWindow / (duration || 1));
    loadMonitor.messageInCurrentWindow = 0;
    loadMonitor.lastEpsReset = now;

    // ADAPTIVE LOGIC: Increase debounce if EPS is high (> 1000)
    if (loadMonitor.eps > 1000) {
        loadMonitor.dynamicDebounceMs = 15000; // 15s during high load
    } else {
        loadMonitor.dynamicDebounceMs = 5000;  // Back to 5s
    }
}, 1000);

// New fallback tracks
let localAnprBatch = [];
let anprFlushTimer = null;

let messageCounter = 0;

function initHandleMessage(deps) {
    circuitBreaker = deps.circuitBreaker;
    dlq = deps.dlq;
    tieredBuffer = deps.tieredBuffer;
    localBatch = deps.localBatch;
    doMicroFlush = deps.doMicroFlush;
    scheduleMicroFlush = deps.scheduleMicroFlush;
    redisClient = deps.redisClient;
}

/**
 * Enhanced Flush with Latency Tracking
 */
async function flushAnprFallback() {
    if (localAnprBatch.length === 0) return;
    
    const batch = localAnprBatch;
    localAnprBatch = [];
    if (anprFlushTimer) clearTimeout(anprFlushTimer);
    anprFlushTimer = null;

    const start = Date.now();
    try {
        if (doMicroFlush) {
            localBatch.push(...batch);
            await doMicroFlush();
            
            // Track Latency
            loadMonitor.dbLatency = Date.now() - start;

            // CIRCUIT BREAKER: Trip if DB is too slow (> 2000ms)
            if (loadMonitor.dbLatency > 2000) {
                if (!loadMonitor.isCircuitBroken) {
                    logger.error({ latency: loadMonitor.dbLatency }, 'CRITICAL: DB Latency high! Tripping Circuit Breaker.');
                    loadMonitor.isCircuitBroken = true;
                    // Auto-reset after 30s
                    setTimeout(() => { 
                        loadMonitor.isCircuitBroken = false; 
                        logger.info('Circuit Breaker Reset: Resuming Direct Bypass attempt.');
                    }, 30000);
                }
            }
        }
    } catch (err) {
        logger.error({ err: err.message }, 'ANPR Fallback flush failed');
    }
}

function getMessageCountAndReset() {
    const val = messageCounter;
    messageCounter = 0;
    return val;
}

async function handleMessage(topic, message, sourceId, sourceIp) {
    loadMonitor.messageInCurrentWindow++;
    try {
        const payloadStr = message.toString();
        
        // FAST REJECT: Skip if not JSON-shaped
        const firstChar = payloadStr.charCodeAt(0);
        if (firstChar !== 123 && firstChar !== 91) { // '{' or '['
            return; 
        }

        let parsedPayload;
        try {
            parsedPayload = JSON.parse(payloadStr);
        } catch (e) {
            return;
        }

        const payloads = Array.isArray(parsedPayload) ? parsedPayload : [parsedPayload];

        for (const payload of payloads) {
            if (sourceId) payload._source_id = sourceId;
            if (sourceIp) payload._source_ip = sourceIp;

            sanitizeObject(payload);

            const normalizedEvent = normalizeEvent(topic, payload);
            const isTransactional = ['ANPR', 'Face_Recognition', 'Security'].includes(normalizedEvent.event_type);

            // ── SHOCK ABSORBER (REDIS) MODE ──────────────────────────────
            if (config.service.shockAbsorberMode) {
                
                pushCrowdToRedis(redisClient, payload).catch(() => {});

                const eventData = {
                    _id: crypto.randomUUID(),
                    topic,
                    payload,
                    normalized: normalizedEvent,
                    event_time: normalizedEvent.event_time,
                    camera_id: normalizedEvent.camera_id,
                    event_type: normalizedEvent.event_type,
                    severity: payload.severity || payload.level || 'info'
                };

                const tier = await tieredBuffer.push(eventData);
                messageCounter++;

                // 3. FALLBACK LOGIC: If Redis is down (Tier 2/3), trigger the Bypass
                // BUT ONLY if Circuit Breaker is NOT tripped
                if (tier !== 'REDIS' && !loadMonitor.isCircuitBroken) {
                    if (isTransactional) {
                        localAnprBatch.push(eventData);
                        if (localAnprBatch.length >= 50) {
                            flushAnprFallback();
                        } else if (!anprFlushTimer) {
                            anprFlushTimer = setTimeout(flushAnprFallback, 2000);
                        }
                    } else {
                        // Use Dynamic Debounce based on EPS
                        processLiveStateDirect(eventData, loadMonitor.dynamicDebounceMs).catch((err) => {
                            logger.error({ err: err.message, camera_id: eventData.camera_id }, 'Live Bypass Failed');
                        });
                    }
                }
                
            } else {
                // ── DIRECT DB MODE (NO REDIS) ──────────────────────────────
                const eventData = {
                    _id: crypto.randomUUID(),
                    topic,
                    payload,
                    normalized: normalizedEvent,
                    event_time: normalizedEvent.event_time,
                    camera_id: normalizedEvent.camera_id,
                    event_type: normalizedEvent.event_type,
                    severity: payload.severity || payload.level || 'info',
                    _hash: (function(){ // Generate hash locally since consumer won't
                        const pStr = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
                        const key = [
                            normalizedEvent.camera_id || '',
                            normalizedEvent.event_type || '',
                            normalizedEvent.event_time || '',
                            crypto.createHash('md5').update(pStr).digest('hex').slice(0, 8)
                        ].join('|');
                        return crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
                    })()
                };

                if (localBatch) {
                    // Safety check: Don't let memory balloon if DB is locked
                    const MAX_LOCAL_BUFFER = 5000;
                    if (localBatch.length > MAX_LOCAL_BUFFER) {
                        if (dlq) {
                            dlq.write({ ...eventData, reason: 'LOCAL_BUFFER_OVERFLOW' }, 'DIRECT_MODE_OVERFLOW');
                        }
                        logger.error({ currentSize: localBatch.length }, 'DIRECT_MODE_OVERFLOW: Dropping message to avoid OOM');
                        continue;
                    }
                    localBatch.push(eventData);
                }
                messageCounter++;

                // Micro-batch engine: flush when chunk is full OR 50ms timer fires
                const batchSize = parseInt(process.env.DIRECT_BATCH_SIZE || '500', 10);
                if (localBatch && localBatch.length >= batchSize) {
                    if (doMicroFlush) doMicroFlush(); // fire immediately, don't wait for timer
                } else {
                    if (scheduleMicroFlush) scheduleMicroFlush(); // set/extend 50ms deadline
                }
            }
        }

    } catch (err) {
        logger.error(err, 'Error processing message');
    }
}

module.exports = {
    initHandleMessage,
    handleMessage,
    getMessageCountAndReset
};
