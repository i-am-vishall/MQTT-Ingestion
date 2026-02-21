
const { Pool } = require('pg');
const config = require('./src/config');
const pool = new Pool(config.db);

async function checkCount() {
    try {
        const res = await pool.query('SELECT COUNT(*) FROM anpr_event_fact');
        console.log(`ANPR Rows: ${res.rows[0].count}`);
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
checkCount();
