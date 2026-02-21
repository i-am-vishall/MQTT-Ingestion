
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
        const item = await pool.query("SELECT COUNT(*) FROM anpr_event_fact");
        console.log(`ANPR Count: ${item.rows[0].count}`);

        const health = await pool.query("SELECT source_ip, status FROM source_health_status");
        health.rows.forEach(r => console.log(`Source: ${r.source_ip} -> ${r.status}`));
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
check();
