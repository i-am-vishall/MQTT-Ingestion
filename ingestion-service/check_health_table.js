
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
        const res = await pool.query("SELECT to_regclass('source_health_status')");
        console.log('Table exists:', res.rows[0].to_regclass);
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
check();
