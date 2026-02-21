
const { Pool } = require('pg');
const config = require('../src/config');
const pool = new Pool(config.db);

async function check() {
    const client = await pool.connect();
    try {
        console.log('Checking for old Source IDs...');
        const res1 = await client.query("SELECT count(*) FROM mqtt_events WHERE source_id LIKE 'Source_Server_%'");
        const res2 = await client.query("SELECT count(*) FROM mqtt_events WHERE source_id LIKE 'ANPR_SOURCE_%'");
        const res3 = await client.query("SELECT count(*) FROM mqtt_events WHERE source_id IN ('Haridwar', 'ANPR')");

        console.log(`Remaining 'Source_Server...': ${res1.rows[0].count}`);
        console.log(`Remaining 'ANPR_SOURCE...': ${res2.rows[0].count}`);
        console.log(`Updated 'Haridwar/ANPR': ${res3.rows[0].count}`);

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

check();
