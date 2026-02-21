const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function debugCamera() {
    const client = await pool.connect();
    try {
        const testId = '22784';
        console.log(`--- DEBUGGING CAMERA ID: ${testId} ---`);

        // 1. Check ANPR Fact
        const resFact = await client.query('SELECT camera_id, camera_name FROM anpr_event_fact WHERE camera_id = $1 LIMIT 1', [testId]);
        if (resFact.rows.length > 0) {
            console.log('ANPR Fact Row:', resFact.rows[0]);
        } else {
            console.log('ID not found in anpr_event_fact (unexpected given screenshot)');
        }

        // 2. Check Camera Master
        const resMaster = await client.query('SELECT * FROM camera_master WHERE camera_id::text = $1', [testId]);
        if (resMaster.rows.length > 0) {
            console.log('Camera Master Row:', resMaster.rows[0]);
        } else {
            console.log('ID NOT FOUND in camera_master!');
        }

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}
debugCamera();
