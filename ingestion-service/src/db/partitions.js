const createLogger = require('../../utils/createLogger');
const logger = createLogger('db-partitions');
const config = require('../config/config');

// ============================================================
// PARTITION MANAGER
// Runs once at startup and every 24 hours.
// 1. Creates next 3 monthly partitions ahead of time.
// 2. Drops partitions older than DB_RETENTION_DAYS.
// ============================================================
async function managePartitions(pool) {
    const retentionDays = config.service.retentionDays || 90;

    try {
        const client = await pool.connect();
        try {
            // 1. Create partitions for current month + next 2 months
            const baseDate = new Date();
            for (let i = 0; i < 3; i++) {
                const targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, 1);
                const year = targetDate.getFullYear();
                const month = String(targetDate.getMonth() + 1).padStart(2, '0');
                const partName = `mqtt_events_${year}_${month}`;

                const nextMonth = new Date(year, targetDate.getMonth() + 1, 1);
                const nYear = nextMonth.getFullYear();
                const nMonth = String(nextMonth.getMonth() + 1).padStart(2, '0');

                // Using IF NOT EXISTS (available in PG 10+ for partitions, though syntax differs slightly, we just handle safely)
                const checkRes = await client.query(`
                    SELECT to_regclass('public.${partName}') as exists;
                `);

                if (!checkRes.rows[0].exists) {
                    await client.query(`
                        CREATE TABLE IF NOT EXISTS public.${partName}
                        PARTITION OF public.mqtt_events
                        FOR VALUES FROM ('${year}-${month}-01 00:00:00+00') TO ('${nYear}-${nMonth}-01 00:00:00+00')
                    `);
                    logger.info(`[PartitionMgr] Created future partition: ${partName}`);
                }
            }

            // 2. Drop expired partitions
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - retentionDays);
            const cutoffYear = cutoff.getFullYear();
            const cutoffMonth = cutoff.getMonth() + 1; // 1-indexed

            const partRes = await client.query(`
                SELECT relname FROM pg_class
                WHERE relname ~ '^mqtt_events_\\d{4}_\\d{2}$'
                ORDER BY relname
            `);

            let dropped = 0;
            for (const row of partRes.rows) {
                const name = row.relname; // e.g. mqtt_events_2025_01
                const parts = name.split('_');
                const pYear = parseInt(parts[2]);
                const pMonth = parseInt(parts[3]);

                // Compare by year-month: drop if entire month is before cutoff month
                const isExpired = pYear < cutoffYear || (pYear === cutoffYear && pMonth < cutoffMonth);
                if (isExpired) {
                    logger.warn(`[PartitionMgr] Dropping expired partition: ${name} (older than ${retentionDays} days)`);
                    await client.query(`DROP TABLE IF EXISTS public.${name}`);
                    dropped++;
                }
            }

            if (dropped > 0) {
                logger.info(`[PartitionMgr] Dropped ${dropped} expired partition(s). ${retentionDays}-day retention enforced.`);
            }

        } finally {
            client.release();
        }
    } catch (err) {
        logger.error({ err: err.message }, '[PartitionMgr] Error managing partitions');
    }

    // Schedule to run again in 24 hours
    setTimeout(() => managePartitions(pool), 24 * 60 * 60 * 1000);
}

module.exports = {
    managePartitions
};
