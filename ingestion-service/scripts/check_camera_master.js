const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function checkCameraMaster() {
    const client = await pool.connect();
    try {
        console.log('--- CHECKING CAMERA MASTER ---');
        // Check if table exists
        const resTable = await client.query("SELECT to_regclass('public.camera_master')");
        if (!resTable.rows[0].to_regclass) {
            console.log('Camera Master table DOES NOT exist.');
            return;
        }

        // Check content
        const resContent = await client.query('SELECT * FROM camera_master LIMIT 5');
        console.log(JSON.stringify(resContent.rows, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

checkCameraMaster();
