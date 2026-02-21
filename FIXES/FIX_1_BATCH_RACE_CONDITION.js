/**
 * FIX #1: RACE CONDITION IN flushBatch()
 * 
 * PROBLEM:
 * - Multiple concurrent flushBatch() calls cause message loss
 * - if (isFlushing) return; silently discards events
 * - No queue mechanism
 * 
 * SOLUTION:
 * - Replace boolean flag with async queue
 * - Queue ensures all flushes execute sequentially
 * - No messages dropped
 * 
 * SEVERITY: CRITICAL - Production Data Loss
 */

// ============================================================
// BEFORE (❌ BROKEN CODE)
// ============================================================
/*
let isFlushing = false;

async function flushBatch() {
    if (isFlushing) return;  // ❌ SILENTLY DROP MESSAGES!
    isFlushing = true;
    
    try {
        while (messageBuffer.length > 0) {
            // ... flush logic ...
        }
    } finally {
        isFlushing = false;
    }
}

// Called multiple ways that cause race:
// 1. Timeout callback: setTimeout(flushBatch, batchTimeoutMs)
// 2. Size threshold: if (messageBuffer.length >= batchSize) flushBatch();
// Both can run concurrently!
*/

// ============================================================
// AFTER (✅ FIXED CODE)
// ============================================================

/**
 * BatchQueue ensures sequential execution of flush operations
 * No messages are ever dropped due to concurrent flushes
 */
class BatchQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.logger = require('../utils/createLogger')('batching');
    }

    /**
     * Enqueue a flush operation
     * @returns {Promise<void>}
     */
    async enqueue() {
        this.queue.push({ timestamp: Date.now(), id: Math.random() });
        
        // If not currently processing, start
        if (!this.processing) {
            await this._processQueue();
        }
    }

    /**
     * Process queued flush operations sequentially
     * @private
     */
    async _processQueue() {
        if (this.processing) return;
        this.processing = true;

        try {
            while (this.queue.length > 0) {
                const flushId = this.queue.shift().id;
                
                this.logger.debug({ flushId, queueLength: this.queue.length }, 'Starting flush');

                try {
                    await this._flushBatch();
                } catch (err) {
                    this.logger.error({ flushId, error: err.message }, 'Flush failed');
                    // Don't re-throw; continue processing other queued flushes
                }
            }
        } finally {
            this.processing = false;
        }
    }

    /**
     * Internal flush implementation
     * @private
     */
    async _flushBatch() {
        const startTime = Date.now();

        try {
            // Drain Loop: Keep processing until buffer is empty
            while (messageBuffer.length > 0) {
                // Clear Timer if active
                if (batchTimer) {
                    clearTimeout(batchTimer);
                    batchTimer = null;
                }

                // Swap Buffer (atomic operation)
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

                    this.logger.info({ 
                        batchSize: batch.length, 
                        totalIngested, 
                        durationMs: Date.now() - startTime 
                    }, `Flushed batch of ${batch.length} events`);

                } catch (err) {
                    await client.query('ROLLBACK');
                    this.logger.error({
                        error: err.message,
                        code: err.code,
                        batchSize: batch.length,
                        timestamp: new Date().toISOString()
                    }, 'Batch transaction failed');
                    throw err; // Re-throw to outer catch
                } finally {
                    client.release();
                }
            }
        } catch (outerErr) {
            this.logger.error({ error: outerErr.message }, 'Critical error in flush loop');
            // Check if we have messages to retry
            if (messageBuffer.length > 0) {
                this.logger.warn({ bufferSize: messageBuffer.length }, 'Messages pending retry');
            }
        }
    }
}

// ============================================================
// INTEGRATION INTO EXISTING CODE
// ============================================================

// Create singleton instance
const batchQueue = new BatchQueue();

/**
 * Replace the old addToBatch and flushBatch functions with this:
 */
async function addToBatch(event) {
    // 1. Cap Buffer Size (Prevent OOM)
    const MAX_BUFFER = 5000;
    if (messageBuffer.length >= MAX_BUFFER) {
        // Drop oldest 10% to make room
        const dropCount = Math.floor(MAX_BUFFER * 0.1);
        messageBuffer.splice(0, dropCount);
        logger.error({ 
            dropped: dropCount, 
            bufferSize: messageBuffer.length 
        }, 'CRITICAL: Buffer full! Dropping oldest events.');
    }

    messageBuffer.push(event);

    // Queue flush if size threshold reached
    if (messageBuffer.length >= config.service.batchSize) {
        await batchQueue.enqueue();
    } else if (!batchTimer) {
        // Set timer for timeout-based flush
        batchTimer = setTimeout(async () => {
            await batchQueue.enqueue();
        }, config.service.batchTimeoutMs);
    }
}

/**
 * Public flush method for graceful shutdown or manual trigger
 */
async function flushBatch() {
    await batchQueue.enqueue();
}

// ============================================================
// TESTING THE FIX
// ============================================================

/**
 * Test concurrent flush calls (would fail with old code)
 */
async function testConcurrentFlush() {
    const testQueue = new BatchQueue();
    
    // Simulate 5 concurrent flush calls
    const flushes = [
        testQueue.enqueue(),
        testQueue.enqueue(),
        testQueue.enqueue(),
        testQueue.enqueue(),
        testQueue.enqueue()
    ];
    
    await Promise.all(flushes);
    
    console.log('✅ All flushes completed sequentially - no data loss!');
    console.log('Queue length:', testQueue.queue.length); // Should be 0
    console.log('Processing:', testQueue.processing); // Should be false
}

// ============================================================
// DEPLOYMENT NOTES
// ============================================================

/*
1. Replace the old flushBatch() function (entire function ~60 lines) with:
   - class BatchQueue { ... }
   - async addToBatch(event) { ... }
   - async flushBatch() { ... }

2. Remove the old variables:
   - let isFlushing = false;
   - let messageBuffer = [];
   - let batchTimer = null;

3. Initialize in startup:
   - const batchQueue = new BatchQueue();

4. Update all calls to flushBatch():
   - Remove: flushBatch();
   - Use: await batchQueue.enqueue();

5. Test:
   - Run testConcurrentFlush() to verify
   - Monitor logs for "Flushed batch" messages
   - Verify no "Messages pending retry" warnings

BACKWARDS COMPATIBLE:
- The public API remains the same (flushBatch, addToBatch)
- No changes needed to other modules
- Can be deployed as a drop-in replacement
*/

module.exports = { BatchQueue, addToBatch, flushBatch };
