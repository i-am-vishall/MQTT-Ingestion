
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
        console.log("=== LATEST EVENT DATA ===");
        const res = await pool.query('SELECT camera_id, camera_name, source_id, source_ip FROM mqtt_events ORDER BY event_time DESC LIMIT 1');
        console.table(res.rows);

        console.log("\n=== LIVE_CAMERA_STATE SCHEMA ===");
        const schema = await pool.query("SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_name = 'live_camera_state'");
        console.table(schema.rows);
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
