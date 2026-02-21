const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function checkIds() {
    const client = await pool.connect();
    try {
        console.log('--- DEBUGGING CAMERA ID MISMATCH ---');

        // 1. Get camera_ids from mqtt_events with valid coords
        const resEvents = await client.query(`
            SELECT DISTINCT camera_id 
            FROM mqtt_events 
            WHERE payload->'ExtraDetails'->>'Latitude' IS NOT NULL 
            LIMIT 5;
        `);
        console.log('IDs in mqtt_events (with coords):', resEvents.rows.map(r => r.camera_id));

        // 2. Get camera_ids from camera_master
        const resMaster = await client.query(`
            SELECT camera_id 
            FROM camera_master 
            LIMIT 5;
        `);
        console.log('IDs in camera_master:', resMaster.rows.map(r => r.camera_id));

        // 3. Check for intersection
        const intersection = await client.query(`
            SELECT count(*) 
            FROM camera_master m
            JOIN mqtt_events e ON m.camera_id = e.camera_id
            WHERE e.payload->'ExtraDetails'->>'Latitude' IS NOT NULL;
        `);
        console.log('Matching rows count:', intersection.rows[0].count);

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

checkIds();
