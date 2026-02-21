const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function checkDeviceName() {
    const client = await pool.connect();
    try {
        const testId = '22784';
        console.log(`--- CHECKING DeviceName FOR: ${testId} ---`);

        // Explicitly extract the field
        const res = await client.query(`
            SELECT payload->>'DeviceName' as device_name
            FROM mqtt_events 
            WHERE camera_id = $1 
            AND payload->>'DeviceName' IS NOT NULL
            LIMIT 5
        `, [testId]);

        if (res.rows.length > 0) {
            console.log('FOUND DeviceNames:', res.rows.map(r => r.device_name));
        } else {
            console.log('No DeviceName found in payloads for this ID.');
        }

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}
checkDeviceName();
