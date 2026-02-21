const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function checkGeo() {
    const client = await pool.connect();
    try {
        console.log('--- CHECKING GEO DATA ---');
        const res = await client.query('SELECT camera_id, camera_name, latitude, longitude FROM camera_master WHERE latitude IS NOT NULL LIMIT 5');
        if (res.rows.length === 0) {
            console.log('NO ROWS with Latitude found in camera_master!');
            // Check if ANY latitude data exists in raw payload
            const resRaw = await client.query("SELECT payload->'ExtraDetails'->>'Latitude' as lat FROM mqtt_events WHERE payload->'ExtraDetails'->>'Latitude' IS NOT NULL LIMIT 1");
            console.log('Raw Payload check:', resRaw.rows);
        } else {
            console.log('Found GEO data:', res.rows);
        }
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}
checkGeo();
