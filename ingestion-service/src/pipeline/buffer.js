/**
 * TieredBuffer — Redis Stream → DLQ → Controlled Drop
 * 
 * Purpose: Replace the in-memory messageBuffer[] with a durable, 
 * multi-tier buffer that never silently loses data.
 * 
 * Tier 1: Redis Stream (fast, durable with AOF, supports consumer groups)
 * Tier 2: Disk DLQ (fallback when Redis is down, auto-replays on recovery)
 * Tier 3: Controlled drop with FATAL audit log (absolute last resort)
 */

const createLogger = require('../../utils/createLogger');
const logger = createLogger('buffer');

class TieredBuffer {
    /**
     * @param {Object} redis - ioredis client instance
     * @param {Object} dlq - DeadLetterQueue instance
     * @param {Object} config - { streamName, maxStreamLen }
     */
    constructor(redis, dlq, config = {}) {
        this.redis = redis;
        this.dlq = dlq;
        this.streamName = config.streamName || 'mqtt:ingest';
        this.maxStreamLen = config.maxStreamLen || 3000000;
        this.redisHealthy = true;
        this.healthCheckInterval = null;

        // Counters for monitoring
        this.stats = {
            redisPushes: 0,
            dlqPushes: 0,
            drops: 0,
            lastTier: 'REDIS',
            lastFailureTime: null,
            lastRecoveryTime: null
        };

        // Start health monitor to detect Redis recovery
        this._startHealthMonitor();
    }

    /**
     * Push an event into the buffer (3-tier fallback)
     * @param {Object} event - The event data to buffer
     * @returns {string} Which tier handled it: 'REDIS' | 'DLQ' | 'DROPPED'
     */
    async push(event) {
        // === TIER 1: Redis Stream ===
        if (this.redisHealthy) {
            try {
                // We use a short timeout for the xadd to avoid hanging the producer
                await Promise.race([
                    this.redis.xadd(
                        this.streamName,
                        'MAXLEN', '~', String(this.maxStreamLen),
                        '*',
                        'data', JSON.stringify(event)
                    ),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Redis Timeout')), 3000))
                ]);
                
                this.stats.redisPushes++;
                this.stats.lastTier = 'REDIS';
                return 'REDIS';
            } catch (err) {
                // Redis just failed — mark unhealthy
                this.redisHealthy = false;
                this.stats.lastFailureTime = new Date().toISOString();
                logger.error({ err: err.message },
                    'REDIS DOWN: Switching to DLQ disk fallback');
            }
        }

        // === TIER 2: Disk DLQ ===
        try {
            const dlqStats = this.dlq.getStats();

            // Check if DLQ has budget left (Safety check to prevent filling the whole disk)
            if (dlqStats.budgetUsedPct < 95) {
                this.dlq.write(event, 'REDIS_DOWN');
                this.stats.dlqPushes++;
                this.stats.lastTier = 'DLQ';

                // Alert at 80%
                if (dlqStats.budgetUsedPct >= 80) {
                    logger.error({
                        event: 'DLQ_THRESHOLD',
                        usedPct: dlqStats.budgetUsedPct,
                        fileCount: dlqStats.fileCount
                    }, `DLQ at ${dlqStats.budgetUsedPct}% — immediate attention required`);
                }

                return 'DLQ';
            }
        } catch (dlqErr) {
            logger.error({ err: dlqErr.message }, 'DLQ write failed');
        }

        // === TIER 3: Drop with full audit trail ===
        this.stats.drops++;
        this.stats.lastTier = 'DROPPED';
        logger.error({
            event: 'DATA_LOSS',
            reason: 'ALL_BUFFERS_EXHAUSTED',
            camera_id: event?.camera_id,
            event_type: event?.event_type,
            event_time: event?.event_time
        }, 'TIER 3: All buffers exhausted — message dropped');

        return 'DROPPED';
    }

    /**
     * Check if Redis is currently healthy
     */
    isHealthy() {
        return this.redisHealthy;
    }

    /**
     * Monitor Redis health and auto-replay DLQ on recovery
     */
    _startHealthMonitor() {
        this.healthCheckInterval = setInterval(async () => {
            if (!this.redisHealthy) {
                try {
                    // Use a simple ping to check for recovery
                    await this.redis.ping();
                    this.redisHealthy = true;
                    this.stats.lastRecoveryTime = new Date().toISOString();
                    logger.info('Redis recovered — switching back to primary buffer');

                    // Auto-replay DLQ files back into Redis stream
                    // We do this in the background to not block the monitor
                    this._triggerReplay();
                } catch (e) {
                    // Still down — stay on DLQ
                }
            }
        }, 5000); // Check every 5 seconds
    }

    async _triggerReplay() {
        try {
            const result = await this.dlq.replay(
                this.redis,
                this.streamName,
                this.maxStreamLen
            );
            if (result.replayed > 0) {
                logger.info({
                    replayed: result.replayed,
                    files: result.files
                }, 'DLQ auto-replayed into Redis stream');
            }
        } catch (replayErr) {
            logger.error({ err: replayErr.message },
                'DLQ auto-replay failed — files preserved for manual replay');
        }
    }

    /**
     * Get buffer status for health endpoint
     */
    getStatus() {
        return {
            redisHealthy: this.redisHealthy,
            tier: this.redisHealthy ? 'REDIS' : 'DLQ',
            stats: { ...this.stats },
            dlq: this.dlq.getStats()
        };
    }

    /**
     * Cleanup on shutdown
     */
    destroy() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
    }
}

module.exports = TieredBuffer;
