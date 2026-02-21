const { Pool } = require('pg');
const config = require('../ingestion-service/src/config');

async function debugEvents() {
    const pool = new Pool(config.db);
    try {
        console.log('--- Checking recent mqtt_events ---');
        const res = await pool.query(`
            SELECT event_time, event_type, payload
            FROM mqtt_events
            ORDER BY event_time DESC
            LIMIT 5;
        `);

        if (res.rows.length === 0) {
            console.log('No events found in mqtt_events table.');
        } else {
            res.rows.forEach(row => {
                console.log(`Time: ${row.event_time}, Type: '${row.event_type}'`);
                console.log('Payload Snippet:', JSON.stringify(row.payload).substring(0, 200));
            });
        }

        console.log('\n--- Checking anpr_event_fact ---');
        const factRes = await pool.query('SELECT COUNT(*) FROM anpr_event_fact');
        console.log('Count:', factRes.rows[0].count);

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}
debugEvents();
