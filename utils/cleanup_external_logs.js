const fs = require('fs');
const path = require('path');

const LOG_BASE = "C:\\ProgramData\\I2V\\Logs";
const RETENTION_DAYS = 7;
const SERVICES_TO_CLEAN = ['telegraf', 'influxdb', 'postgres'];

console.log(`[Cleaner] Starting cleanup job for: ${SERVICES_TO_CLEAN.join(', ')}`);

SERVICES_TO_CLEAN.forEach(service => {
    const dir = path.join(LOG_BASE, service);
    if (!fs.existsSync(dir)) {
        console.log(`[Cleaner] Skip ${service}: Dir not found`);
        return;
    }

    try {
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.log'));
        const now = Date.now();
        let deleted = 0;

        files.forEach(file => {
            const filePath = path.join(dir, file);
            const stats = fs.statSync(filePath);
            const daysOld = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24);

            if (daysOld > RETENTION_DAYS) {
                fs.unlinkSync(filePath);
                console.log(`[Cleaner] Deleted: ${filePath} (${daysOld.toFixed(1)} days old)`);
                deleted++;
            }
        });

        if (deleted > 0) console.log(`[Cleaner] ${service}: Removed ${deleted} old files.`);

    } catch (err) {
        console.error(`[Cleaner] Error processing ${service}:`, err.message);
    }
});
console.log('[Cleaner] Job Complete.');
