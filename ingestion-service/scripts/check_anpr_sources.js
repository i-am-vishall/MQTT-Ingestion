
const { Pool } = require('pg');
require('dotenv').config({ path: 'C:\\Users\\mevis\\MQTT-Ingetsion\\ingestion-service\\.env' });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function checkSources() {
    try {
        const res = await pool.query(`
      SELECT source_name, source_type, COUNT(*) as count, MAX(event_time) as last_seen
      FROM anpr_event_fact
      WHERE event_time > NOW() - INTERVAL '1 hour'
      GROUP BY source_name, source_type
      ORDER BY last_seen DESC;
    `);
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

checkSources();
