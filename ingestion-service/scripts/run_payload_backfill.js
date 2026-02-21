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
        console.log('Running Payload Extraction Backfill...');
        const sql = fs.readFileSync('./scripts/backfill_devicename_payload.sql', 'utf8');
        await client.query(sql);
        console.log('Backfill successfully executed.');
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}
run();
