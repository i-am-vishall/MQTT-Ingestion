const { Pool } = require('pg');
const pool = new Pool({
    user: 'postgres',
    host: '127.0.0.1',
    database: 'mqtt_alerts_db',
    password: '',
    port: 5441,
});

async function checkLatest() {
    try {
        const res = await pool.query("SELECT MAX(event_time) as latest, NOW() as current_time FROM anpr_event_fact");
        console.log(`Latest ANPR Event: ${res.rows[0].latest}`);
        console.log(`Server Time:       ${res.rows[0].current_time}`);

        const count = await pool.query("SELECT count(*) FROM anpr_event_fact WHERE event_time > NOW() - INTERVAL '10 minutes'");
        console.log(`Events in last 10 mins: ${count.rows[0].count}`);
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
checkLatest();
