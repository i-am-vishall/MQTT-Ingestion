const crypto = require('crypto');
const createLogger = require('../../utils/createLogger');
const logger = createLogger('ingestion-handler');

const config = require('../config/config');
const { normalizeEvent } = require('../normalization');
const { sanitizeObject } = require('./helpers');
const { pushCrowdToRedis } = require('../mqtt/crowdRedis');

let circuitBreaker = null;
let dlq = null;
let tieredBuffer = null;
let localBatch = null;
let doMicroFlush = null;
let scheduleMicroFlush = null;
let redisClient = null;

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

function getMessageCountAndReset() {
    const val = messageCounter;
    messageCounter = 0;
    return val;
}

async function handleMessage(topic, message, sourceId, sourceIp) {
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

            // Fix #10: sanitizeObject now module-scope — no closure alloc per message
            sanitizeObject(payload);

            const normalizedEvent = normalizeEvent(topic, payload);

            // ── SHOCK ABSORBER (REDIS) MODE ──────────────────────────────
            if (config.service.shockAbsorberMode) {
                // ── REAL-TIME REDIS WRITE (fire-and-forget, zero DB load) ──────────────
                pushCrowdToRedis(redisClient, payload).catch(() => {}); // never blocks, never throws

                // CIRCUIT BREAKER / BACKPRESSURE CHECK
                if (!circuitBreaker.shouldAccept({ event_type: normalizedEvent.event_type })) {
                    if (dlq) {
                        dlq.write({ topic, payload, event_time: normalizedEvent.event_time,
                            camera_id: normalizedEvent.camera_id, event_type: normalizedEvent.event_type,
                            severity: payload.severity || 'info' }, 'CIRCUIT_BREAKER_SHED');
                    }
                    continue;
                }

                const eventData = {
                    _id: crypto.randomUUID(), // Correlation ID
                    topic,
                    payload,
                    normalized: normalizedEvent,
                    event_time: normalizedEvent.event_time,
                    camera_id: normalizedEvent.camera_id,
                    event_type: normalizedEvent.event_type,
                    severity: payload.severity || payload.level || 'info'
                };

                // Push to 3-tier buffer
                if (tieredBuffer) {
                    await tieredBuffer.push(eventData);
                }
                messageCounter++;
                
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
