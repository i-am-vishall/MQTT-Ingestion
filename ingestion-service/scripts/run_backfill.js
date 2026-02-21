const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function run() {
    const client = await pool.connect();
    try {
        console.log('Running backfill...');
        const sql = fs.readFileSync('./scripts/backfill_camera_names.sql', 'utf8');
        const res = await client.query(sql);
        console.log(`Backfill complete. Updated ${res.rowCount} rows.`);
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}
run();
