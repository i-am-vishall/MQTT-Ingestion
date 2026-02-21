
const { Pool } = require('pg');
const config = require('../src/config');
const pool = new Pool(config.db);

async function listIds() {
    const client = await pool.connect();
    try {
        console.log('Fetching distinct Source IDs...');
        const res = await client.query("SELECT DISTINCT source_id FROM mqtt_events");
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

listIds();
