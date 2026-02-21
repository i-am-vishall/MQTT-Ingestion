
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
        console.log("=== TIMESTAMP CHECK (Local Time) ===");

        // Check Raw Events
        const mqttRes = await pool.query("SELECT MAX(event_time) as last_raw, COUNT(*) as total_raw FROM mqtt_events");
        console.log(`MQTT Events: Last=${mqttRes.rows[0].last_raw}, Total=${mqttRes.rows[0].total_raw}`);

        // Check Live State
        const liveRes = await pool.query("SELECT MAX(updated_at) as last_live, COUNT(*) as total_live FROM live_camera_state");
        console.log(`Live State: Last Update=${liveRes.rows[0].last_live}, Total Rows=${liveRes.rows[0].total_live}`);

        // Check Health
        const healthRes = await pool.query("SELECT source_id, status, last_event_time, updated_at FROM source_health_status");
        console.table(healthRes.rows);

        // Check recent logs (if any file logging remains or just to print current time)
        console.log(`Current System Time: ${new Date().toISOString()}`);

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
check();
