const { Pool } = require('pg');
const config = require('../ingestion-service/src/config');

async function verify() {
    const pool = new Pool(config.db);
    try {
        const res = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_name IN ('anpr_event_fact', 'anpr_metrics_1min', 'anpr_violation_metrics_1min');
        `);
        console.log('Found tables:', res.rows.map(r => r.table_name));

        if (res.rowCount === 3) {
            console.log('VERIFICATION SUCCESS: All 3 ANPR tables exist.');
        } else {
            console.error('VERIFICATION FAILED: Missing tables.');
            process.exit(1);
        }
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}
verify();
