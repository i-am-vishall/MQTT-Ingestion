
const { Pool } = require('pg');
const util = require('util');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'mqtt_db',
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
});

async function check() {
    const client = await pool.connect();
    try {
        console.log('--- Searching for Plate "TEST-9999" ---');

        // Check Raw
        try {
            // Removed 'topic' column
            const resRaw = await client.query(`
                SELECT event_time, event_type FROM mqtt_events 
                WHERE payload::text LIKE '%TEST-9999%'
                ORDER BY event_time DESC LIMIT 1
            `);
            console.log(`Raw MQTT Event Found: ${resRaw.rowCount > 0 ? 'YES' : 'NO'}`);
            if (resRaw.rowCount > 0) console.log('  Time:', resRaw.rows[0].event_time);
        } catch (e) {
            console.error('Error querying raw events:', e.message);
        }

        // Check Fact
        try {
            const resFact = await client.query(`
                SELECT * FROM anpr_event_fact 
                WHERE plate_number = 'TEST-9999'
                ORDER BY event_time DESC LIMIT 1
            `);
            console.log(`ANPR Fact Found: ${resFact.rowCount > 0 ? 'YES' : 'NO'}`);
            if (resFact.rowCount > 0) {
                console.log('  Data:', util.inspect(resFact.rows[0]));
            }
        } catch (e) {
            console.error('Error querying facts:', e.message);
        }

    } catch (e) {
        console.error('General Error:', e);
    } finally {
        client.release();
        await pool.end();
    }
}

check();
