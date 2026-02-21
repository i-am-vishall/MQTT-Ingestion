
const { Pool } = require('pg');
const config = require('../src/config');
const pool = new Pool(config.db);

async function checkLatest() {
    const client = await pool.connect();
    try {
        console.log('Checking LATEST ingested event...');
        const res = await client.query("SELECT source_id, event_time FROM mqtt_events ORDER BY event_time DESC LIMIT 1");
        if (res.rows.length > 0) {
            console.log('LATEST EVENT:', res.rows[0]);
        } else {
            console.log('No events found.');
        }
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

checkLatest();
