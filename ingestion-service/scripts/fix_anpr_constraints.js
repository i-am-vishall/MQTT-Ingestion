
const { Pool } = require('pg');
const config = require('../src/config');
const pool = new Pool(config.db);

async function fix() {
    const client = await pool.connect();
    try {
        console.log('Relaxing constraints on anpr_event_fact...');
        await client.query('ALTER TABLE anpr_event_fact ALTER COLUMN source_id DROP NOT NULL;');
        // Also ensure others are nullable just in case
        await client.query('ALTER TABLE anpr_event_fact ALTER COLUMN source_ip DROP NOT NULL;');
        await client.query('ALTER TABLE anpr_event_fact ALTER COLUMN camera_name DROP NOT NULL;');
        console.log('Constraints Relaxed.');
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

fix();
