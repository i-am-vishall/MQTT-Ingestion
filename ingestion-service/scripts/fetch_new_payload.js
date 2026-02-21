const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function fetchPayload() {
    const client = await pool.connect();
    try {
        console.log('--- FETCHING LATEST PAYLOAD FROM 103.205.114.241 ---\n');

        const res = await client.query(`
            SELECT event_time, source_ip, source_id, payload 
            FROM mqtt_events 
            WHERE source_ip = '103.205.114.241' 
            ORDER BY event_time DESC 
            LIMIT 1
        `);

        if (res.rows.length > 0) {
            console.log(JSON.stringify(res.rows[0], null, 2));
        } else {
            console.log('No events found specifically from 103.205.114.241 yet.');
            console.log('Checking ANY recent event...');
            const resAny = await client.query(`
                SELECT event_time, source_ip, source_id, payload 
                FROM mqtt_events 
                ORDER BY event_time DESC 
                LIMIT 1
            `);
            console.log(JSON.stringify(resAny.rows[0], null, 2));
        }

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

fetchPayload();
