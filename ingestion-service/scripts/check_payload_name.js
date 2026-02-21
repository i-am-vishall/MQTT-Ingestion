const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function checkPayload() {
    const client = await pool.connect();
    try {
        const testId = '22784';
        console.log(`--- CHECKING PAYLOAD FOR: ${testId} ---`);

        const res = await client.query(`
            SELECT payload::text 
            FROM mqtt_events 
            WHERE camera_id = $1 
            AND payload::text LIKE '%Name%' 
            LIMIT 1
        `, [testId]);

        if (res.rows.length > 0) {
            console.log('Payload found:', res.rows[0].payload);
        } else {
            console.log('No payload with "Name" found for this ID.');
            // Dump any payload
            const resAny = await client.query('SELECT payload FROM mqtt_events WHERE camera_id = $1 LIMIT 1', [testId]);
            if (resAny.rows.length > 0) console.log('Sample Payload:', JSON.stringify(resAny.rows[0].payload));
        }

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}
checkPayload();
