
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
        const count = await pool.query('SELECT COUNT(*) FROM live_camera_state');
        console.log(`Row Count: ${count.rows[0].count}`);

        const res = await pool.query('SELECT camera_id, camera_name, source_type, updated_at, crowd_state, traffic_state, security_state FROM live_camera_state ORDER BY updated_at DESC LIMIT 5');
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
