/**
 * Dead Letter Queue (DLQ) — Structured, Rotated, Replayable
 * 
 * Purpose: Catch events that cannot be processed (Redis down, batch failures,
 * poison rows) and store them safely on disk for later replay.
 * 
 * Features:
 * - Rotation: 10MB per file, max 50 files (500MB budget)
 * - Structured: Each entry has timestamp, reason, event data
 * - Replayable: CLI replay tool + auto-replay on Redis recovery
 * - Monitoring: Stats endpoint for alerting at 80% capacity
 */

const fs = require('fs');
const path = require('path');
const createLogger = require('../../utils/createLogger');
const logger = createLogger('dlq');

const DLQ_DIR = path.join(process.cwd(), 'logs', 'dlq');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
const MAX_FILES = 50;                    // 500MB total budget
const ALERT_THRESHOLD_PCT = 80;

class DeadLetterQueue {
    constructor() {
        try {
            fs.mkdirSync(DLQ_DIR, { recursive: true });
        } catch (e) {
            logger.error({ err: e.message }, 'Failed to create DLQ directory');
        }
        this.currentFile = null;
        this.currentSize = 0;
        this.totalWritten = 0;
        this._rotate();
    }

    /**
     * Write a failed event to the DLQ
     * @param {Object} event - The event data that could not be processed
     * @param {string} reason - Why it failed (e.g., 'REDIS_DOWN', 'DB_POISON_ROW', 'BUFFER_OVERFLOW')
     */
    write(event, reason) {
        try {
            const entry = {
                timestamp: new Date().toISOString(),
                reason: reason,
                event: event,
                retryable: true
            };

            const line = JSON.stringify(entry) + '\n';

            // Rotate if current file is too large
            if (this.currentSize + line.length > MAX_FILE_SIZE) {
                this._rotate();
            }

            fs.appendFileSync(this.currentFile, line);
            this.currentSize += line.length;
            this.totalWritten++;

            // Prune old files if over budget
            this._pruneOldFiles();

        } catch (err) {
            // Disk write failed — last resort logging
            logger.error({
                event: 'DLQ_WRITE_FAILED',
                reason: err.message,
                originalReason: reason,
                camera_id: event?.camera_id
            }, 'CRITICAL: Cannot write to DLQ — disk may be full');
        }
    }

    /**
     * Write a batch of events to the DLQ at once
     * @param {Array} events - Array of event objects
     * @param {string} reason - Failure reason
     */
    writeBatch(events, reason) {
        for (const event of events) {
            this.write(event, reason);
        }
    }

    /**
     * Rotate to a new DLQ file
     */
    _rotate() {
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        this.currentFile = path.join(DLQ_DIR, `dlq_${ts}.jsonl`);
        this.currentSize = 0;
    }

    /**
     * Prune oldest DLQ files if over the max file count
     */
    _pruneOldFiles() {
        try {
            const files = fs.readdirSync(DLQ_DIR)
                .filter(f => f.startsWith('dlq_') && f.endsWith('.jsonl'))
                .sort();

            while (files.length > MAX_FILES) {
                const oldest = files.shift();
                const filepath = path.join(DLQ_DIR, oldest);
                fs.unlinkSync(filepath);
                logger.warn({ deleted: oldest }, 'DLQ pruned oldest file (budget exceeded)');
            }
        } catch (err) {
            logger.error({ err: err.message }, 'DLQ prune failed');
        }
    }

    /**
     * Replay all DLQ files into a Redis stream
     * @param {Object} redis - ioredis client instance
     * @param {string} streamName - Redis stream key (e.g., 'mqtt:ingest')
     * @param {number} maxLen - Max stream length for XADD
     * @returns {Object} { replayed: number, files: number }
     */
    async replay(redis, streamName, maxLen = 3000000) {
        const files = fs.readdirSync(DLQ_DIR)
            .filter(f => f.startsWith('dlq_') && f.endsWith('.jsonl'))
            .sort(); // Oldest first — maintain order

        let totalReplayed = 0;
        let filesProcessed = 0;

        for (const file of files) {
            const filepath = path.join(DLQ_DIR, file);
            try {
                const content = fs.readFileSync(filepath, 'utf-8');
                const lines = content.split('\n').filter(Boolean);

                logger.info({ file, messages: lines.length }, 'Replaying DLQ file');

                // Batch into pipelines of 500 for efficiency
                const PIPELINE_SIZE = 500;
                for (let i = 0; i < lines.length; i += PIPELINE_SIZE) {
                    const chunk = lines.slice(i, i + PIPELINE_SIZE);
                    const pipeline = redis.pipeline();

                    for (const line of chunk) {
                        try {
                            const entry = JSON.parse(line);
                            if (entry.retryable && entry.event) {
                                pipeline.xadd(
                                    streamName,
                                    'MAXLEN', '~', String(maxLen),
                                    '*',
                                    'data', JSON.stringify(entry.event)
                                );
                                totalReplayed++;
                            }
                        } catch (parseErr) {
                            // Skip corrupt lines
                            logger.warn({ line: line.substring(0, 100) },
                                'Skipping corrupt DLQ entry');
                        }
                    }

                    await pipeline.exec();
                }

                // Delete successfully replayed file
                fs.unlinkSync(filepath);
                filesProcessed++;
                logger.info({ file, messages: lines.length }, 'DLQ file replayed and deleted');

            } catch (err) {
                logger.error({ err: err.message, file }, 'DLQ replay failed for file');
                break; // Stop replaying — maintain order guarantee
            }
        }

        if (totalReplayed > 0) {
            logger.info({ totalReplayed, filesProcessed }, 'DLQ replay complete');
        }

        return { replayed: totalReplayed, files: filesProcessed };
    }

    /**
     * Get DLQ statistics for monitoring
     * @returns {Object} { fileCount, totalSizeMB, budgetUsedPct, totalWritten }
     */
    getStats() {
        try {
            const files = fs.readdirSync(DLQ_DIR)
                .filter(f => f.startsWith('dlq_') && f.endsWith('.jsonl'));

            let totalBytes = 0;
            for (const f of files) {
                try {
                    totalBytes += fs.statSync(path.join(DLQ_DIR, f)).size;
                } catch (e) { /* file may have been pruned */ }
            }

            const budgetTotal = MAX_FILES * MAX_FILE_SIZE;
            const budgetUsedPct = ((totalBytes / budgetTotal) * 100).toFixed(1);

            return {
                fileCount: files.length,
                totalSizeMB: (totalBytes / 1024 / 1024).toFixed(2),
                budgetUsedPct: parseFloat(budgetUsedPct),
                totalWritten: this.totalWritten,
                alerting: budgetUsedPct >= ALERT_THRESHOLD_PCT
            };
        } catch (err) {
            return {
                fileCount: 0,
                totalSizeMB: '0',
                budgetUsedPct: 0,
                totalWritten: this.totalWritten,
                alerting: false,
                error: err.message
            };
        }
    }
}

module.exports = DeadLetterQueue;
