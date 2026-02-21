
const { Pool } = require('pg');
const pool = new Pool({
    user: 'postgres',
    host: '127.0.0.1',
    database: 'mqtt_alerts_db',
    password: '',
    port: 5441,
});

async function check() {
    try {
        const rules = await pool.query('SELECT COUNT(*) FROM event_classification_rules');
        const health = await pool.query('SELECT * FROM source_health_status');
        const cameras = await pool.query('SELECT count(*) FROM live_camera_state');

        console.log(`Rules Count: ${rules.rows[0].count}`);
        console.log(`Health Status Rows: ${health.rowCount}`);
        console.log(`Live Cameras: ${cameras.rows[0].count}`);
        console.table(health.rows);
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
check();
