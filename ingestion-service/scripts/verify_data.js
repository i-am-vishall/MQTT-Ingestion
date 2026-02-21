require('dotenv').config();
const { Pool } = require('pg');
const config = require('../src/config');

async function checkData() {
    const pool = new Pool(config.db);
    try {
        console.log('Connecting to database...', config.db);
        const client = await pool.connect();
        console.log('Connected!');

        // Check count
        const resCount = await client.query('SELECT COUNT(*) FROM mqtt_events');
        console.log('Total Rows:', resCount.rows[0].count);

        // Check latest
        const resLatest = await client.query(`
        SELECT event_time, camera_id, event_type, payload 
        FROM mqtt_events 
        ORDER BY event_time DESC 
        LIMIT 5;
    `);

        if (resLatest.rows.length > 0) {
            console.log('Latest 5 events:');
            resLatest.rows.forEach(r => {
                console.log(`[${r.event_time}] ${r.camera_id} (${r.event_type})`);
            });
        } else {
            console.log('No events found yet.');
        }

        client.release();
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

checkData();
