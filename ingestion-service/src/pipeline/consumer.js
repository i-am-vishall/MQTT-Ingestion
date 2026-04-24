/**
 * Redis Stream Consumer — Reads from stream, inserts into PostgreSQL
 *
 * BULLETPROOF v2 — Fixes Applied:
 * Fix #1:  Lua atomic semaphore (INCR+EXPIRE in one round-trip, crash-safe)
 * Fix #3:  Binary-split inherits parent semaphore slot (no bypass)
 * Fix #5:  Idle claim runs on lead worker only, every 30 loops
 * Fix #11: blockMs default 200ms (was 2000ms — caused 2s dashboard lag)
 * Fix #12: Binary-split depth cap — max 12 levels before DLQ fast-path
 */

const crypto = require('crypto');
const createLogger = require('../../utils/createLogger');
const logger = createLogger('consumer');

// Lua script: atomic INCR + EXPIRE in one Redis round-trip.
// Eliminates crash window between INCR and EXPIRE.
const LUA_ACQUIRE = `
    local current = redis.call('INCR', KEYS[1])
    redis.call('EXPIRE', KEYS[1], 30)
    if current <= tonumber(ARGV[1]) then
        return 1
    end
    redis.call('DECR', KEYS[1])
    return 0
`;

// Lua script: safe DECR — never lets counter go below 0.
const LUA_RELEASE = `
    local v = redis.call('GET', KEYS[1])
    if v and tonumber(v) > 0 then
        return redis.call('DECR', KEYS[1])
    end
    return 0
`;

class StreamConsumer {
    /**
     * @param {Object} redis - ioredis client instance
     * @param {Object} pool - pg Pool instance
     * @param {Object} dlq - DeadLetterQueue instance
     * @param {Object} config - Consumer configuration
     */
    constructor(redis, pool, dlq, config = {}) {
        this.redis = redis;
        this.pool = pool;
        this.dlq = dlq;

        this.streamName = config.streamName || 'mqtt:ingest';
        this.groupName = config.groupName || 'workers';
        this.consumerId = config.consumerId || `worker_${process.pid}`;
        this.batchSize = config.batchSize || 2000;
        this.blockMs = config.blockMs || 200;          // Fix #11: was 2000ms
        this.idleClaimMs = config.idleClaimMs || 60000;

        // Fix #1: Atomic semaphore — limits concurrent DB writers
        this.semaphoreKey = 'mqtt:db_write_slots';
        this.maxConcurrentWriters = config.maxConcurrentWriters ||
            parseInt(process.env.MAX_CONCURRENT_WRITERS || '3');
        this._holdingSlot = false; // tracks if this worker currently holds a slot

        // Fix #5: Only the lead worker claims idle messages
        this.isLeadWorker = config.isLeadWorker || false;
        this._claimCheckCounter = 0;

        this.running = false;
        this.stats = {
            processed: 0,
            failed: 0,
            claimed: 0,
            batches: 0,
            semaphore_waits: 0
        };
    }

    // ─── Fix #1: Lua Atomic Semaphore ────────────────────────────────────────

    async _acquireSemaphore() {
        try {
            const result = await this.redis.eval(LUA_ACQUIRE, 1, this.semaphoreKey, this.maxConcurrentWriters);
            return result === 1;
        } catch (err) {
            // If Redis is down, allow the write through (fail-open for ingestion continuity)
            logger.warn({ err: err.message }, 'Semaphore check failed — allowing write through');
            return true;
        }
    }

    async _releaseSemaphore() {
        try {
            await this.redis.eval(LUA_RELEASE, 1, this.semaphoreKey);
        } catch (err) {
            // Non-fatal — counter will auto-expire after 30s anyway
            logger.debug({ err: err.message }, 'Semaphore release failed (will auto-expire)');
        }
    }

    // ─── Initialize Consumer Group ────────────────────────────────────────────

    async initialize() {
        try {
            await this.redis.xgroup('CREATE', this.streamName, this.groupName, '0', 'MKSTREAM');
            logger.info({ stream: this.streamName, group: this.groupName }, 'Consumer group created');
        } catch (e) {
            if (e.message && e.message.includes('BUSYGROUP')) {
                logger.debug('Consumer group already exists');
            } else {
                throw e;
            }
        }
    }

    // ─── Main Consumer Loop ───────────────────────────────────────────────────

    async start(processBatchFn) {
        await this.initialize();
        this.running = true;

        logger.info({
            consumer: this.consumerId,
            batchSize: this.batchSize,
            blockMs: this.blockMs,
            isLeadWorker: this.isLeadWorker,
            maxConcurrentWriters: this.maxConcurrentWriters
        }, 'Consumer loop starting');

        while (this.running) {
            try {
                // === 1. Read new messages ===
                const messages = await this.redis.xreadgroup(
                    'GROUP', this.groupName, this.consumerId,
                    'COUNT', this.batchSize,
                    'BLOCK', this.blockMs,
                    'STREAMS', this.streamName, '>'
                );

                if (messages && messages.length > 0) {
                    const entries = messages[0][1];
                    const batch = [];

                    for (const [streamId, fields] of entries) {
                        try {
                            const dataIdx = fields.indexOf('data');
                            if (dataIdx === -1) continue;
                            const event = JSON.parse(fields[dataIdx + 1]);
                            event._streamId = streamId;
                            event._hash = this._generateEventHash(event);
                            batch.push(event);
                        } catch (parseErr) {
                            logger.warn({ streamId }, 'Corrupt stream entry — skipping');
                            await this.redis.xack(this.streamName, this.groupName, streamId);
                        }
                    }

                    if (batch.length > 0) {
                        // Fix #1: Acquire slot via atomic Lua semaphore
                        // Fix #3: Set _holdingSlot=true so binary-split sub-calls
                        //         know not to re-acquire (they inherit this slot)
                        let slotAcquired = false;
                        while (this.running && !slotAcquired) {
                            slotAcquired = await this._acquireSemaphore();
                            if (!slotAcquired) {
                                this.stats.semaphore_waits++;
                                await this._sleep(100);
                            }
                        }

                        this._holdingSlot = true;
                        try {
                            // Pass holdingSlot=true: binary-split will NOT re-acquire
                            await this._processBatch(batch, processBatchFn, true);
                            this.stats.batches++;
                        } finally {
                            this._holdingSlot = false;
                            await this._releaseSemaphore();
                        }
                    }
                }

                // Fix #5: Only lead worker claims idle msgs, and only every 30 loops
                this._claimCheckCounter++;
                if (this.isLeadWorker && this._claimCheckCounter % 30 === 0) {
                    await this._claimIdleMessages(processBatchFn);
                }

            } catch (err) {
                if (this.running) {
                    logger.error({ err: err.message }, 'Consumer loop error — backing off');
                    await this._sleep(1000);
                }
            }
        }

        logger.info({ consumer: this.consumerId }, 'Consumer loop stopped');
    }

    // ─── Batch Processing with Binary-Split Retry ─────────────────────────────

    /**
     * Process a batch. holdingSlot=true means caller already holds a semaphore
     * slot — sub-calls from binary-split should NOT acquire a new one.
     * Fix #3: binary-split inherits parent semaphore slot.
     */
    async _processBatch(batch, processBatchFn, holdingSlot = false) {
        try {
            await processBatchFn(batch);

            const streamIds = batch.map(e => e._streamId).filter(Boolean);
            if (streamIds.length > 0) {
                await this.redis.xack(this.streamName, this.groupName, ...streamIds);
            }
            this.stats.processed += batch.length;

        } catch (batchError) {
            logger.warn({
                batchSize: batch.length,
                err: batchError.message
            }, 'Batch insert failed — starting binary-split retry');

            // Pass holdingSlot and start at depth=0
            await this._binarySplitRetry(batch, processBatchFn, holdingSlot, 0);
        }
    }

    /**
     * Fix #12: depth cap — stops recursive split at log₂(batchSize)+1 levels.
     * At depth > 12, a single-row batch failing will go directly to DLQ.
     * Fix #3: holdingSlot prevents sub-calls from acquiring new semaphore slots.
     */
    async _binarySplitRetry(batch, processBatchFn, holdingSlot, depth = 0) {
        if (batch.length === 0) return;

        const MAX_DEPTH = 12; // log₂(3000) ≈ 12

        if (batch.length === 1 || depth >= MAX_DEPTH) {
            // Single row or max depth reached — send to DLQ
            for (const event of batch) {
                this.dlq.write(event, batch.length === 1 ? 'DB_POISON_ROW' : 'MAX_RETRY_DEPTH');
                this.stats.failed++;
                if (event._streamId) {
                    await this.redis.xack(this.streamName, this.groupName, event._streamId);
                }
                logger.error({
                    camera_id: event.camera_id,
                    event_type: event.event_type,
                    depth,
                    reason: batch.length === 1 ? 'POISON_ROW' : 'MAX_DEPTH'
                }, 'Event sent to DLQ');
            }
            return;
        }

        const mid = Math.floor(batch.length / 2);
        const left = batch.slice(0, mid);
        const right = batch.slice(mid);

        // Fix #3: Sub-calls do NOT acquire semaphore — they inherit the parent's slot
        try {
            await processBatchFn(left);
            const leftIds = left.map(e => e._streamId).filter(Boolean);
            if (leftIds.length > 0) await this.redis.xack(this.streamName, this.groupName, ...leftIds);
            this.stats.processed += left.length;
        } catch (e) {
            await this._binarySplitRetry(left, processBatchFn, holdingSlot, depth + 1);
        }

        try {
            await processBatchFn(right);
            const rightIds = right.map(e => e._streamId).filter(Boolean);
            if (rightIds.length > 0) await this.redis.xack(this.streamName, this.groupName, ...rightIds);
            this.stats.processed += right.length;
        } catch (e) {
            await this._binarySplitRetry(right, processBatchFn, holdingSlot, depth + 1);
        }
    }

    // ─── Fix #5: Idle Message Claiming (Lead Worker Only) ────────────────────

    async _claimIdleMessages(processBatchFn) {
        try {
            const pending = await this.redis.xpending(
                this.streamName, this.groupName,
                '-', '+', 100
            );

            if (!pending || pending.length === 0) return;

            const idleMsgIds = [];
            for (const entry of pending) {
                const idleMs = entry[2];
                if (idleMs > this.idleClaimMs) {
                    idleMsgIds.push(entry[0]);
                }
            }

            if (idleMsgIds.length === 0) return;

            const claimed = await this.redis.xclaim(
                this.streamName, this.groupName, this.consumerId,
                this.idleClaimMs,
                ...idleMsgIds
            );

            if (claimed && claimed.length > 0) {
                const batch = [];
                for (const [streamId, fields] of claimed) {
                    try {
                        const dataIdx = fields.indexOf('data');
                        if (dataIdx === -1) continue;
                        const event = JSON.parse(fields[dataIdx + 1]);
                        event._streamId = streamId;
                        event._hash = this._generateEventHash(event);
                        batch.push(event);
                    } catch (e) {
                        await this.redis.xack(this.streamName, this.groupName, streamId);
                    }
                }

                if (batch.length > 0) {
                    logger.warn({ claimed: batch.length }, 'Claimed idle messages from stalled consumer');
                    // Claimed batches go through normal semaphore gate
                    let slotAcquired = false;
                    while (this.running && !slotAcquired) {
                        slotAcquired = await this._acquireSemaphore();
                        if (!slotAcquired) await this._sleep(100);
                    }
                    try {
                        await this._processBatch(batch, processBatchFn, true);
                        this.stats.claimed += batch.length;
                    } finally {
                        await this._releaseSemaphore();
                    }
                }
            }
        } catch (e) {
            if (e.message && !e.message.includes('NOGROUP')) {
                logger.debug({ err: e.message }, 'Idle claim check failed');
            }
        }
    }

    // ─── Hash Generation ──────────────────────────────────────────────────────

    _generateEventHash(event) {
        const payload = typeof event.payload === 'string'
            ? event.payload
            : JSON.stringify(event.payload || {});

        const key = [
            event.camera_id || '',
            event.event_type || '',
            event.event_time || '',
            crypto.createHash('md5').update(payload).digest('hex').slice(0, 8)
        ].join('|');

        return crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
    }

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    getStats() {
        return { ...this.stats, consumerId: this.consumerId, isLeadWorker: this.isLeadWorker };
    }

    /**
     * Fix #1/#14: Release semaphore slot on shutdown if we were holding one.
     */
    stop() {
        this.running = false;
        if (this._holdingSlot) {
            this._holdingSlot = false;
            this._releaseSemaphore().catch(() => {});
        }
    }

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = StreamConsumer;
