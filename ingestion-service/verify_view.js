
const { Pool } = require('pg');
const pool = new Pool({
    user: 'postgres',
    host: '127.0.0.1',
    database: 'mqtt_alerts_db',
    password: '',
    port: 5441,
});

async function run() {
    try {
        console.log("=== VIEW OUTPUT (Limit 5) ===");
        const res = await pool.query('SELECT camera_name, source_type, camera_status, crowd_count, crowd_state, updated_at FROM vw_live_dashboard ORDER BY updated_at DESC LIMIT 5');
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
