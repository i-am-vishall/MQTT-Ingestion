
const { Pool } = require('pg');
const config = require('./src/config');
const pool = new Pool(config.db);

async function checkCount() {
    try {
        const res = await pool.query('SELECT COUNT(*) FROM live_camera_state');
        console.log(`Live Camera State Rows: ${res.rows[0].count}`);
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
checkCount();
