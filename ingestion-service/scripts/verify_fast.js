
const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'mqtt_db',
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
});

async function check() {
    try {
        const client = await pool.connect();
        console.log('--- Checking ANPR Facts for TEST-9999 ---');
        const resFact = await client.query(`
            SELECT event_time, plate_number, is_violation, violation_types 
            FROM anpr_event_fact 
            WHERE plate_number = 'TEST-9999'
            ORDER BY event_time DESC LIMIT 1
        `);

        if (resFact.rowCount > 0) {
            console.log('SUCCESS: ANPR Fact Found!');
            console.log(JSON.stringify(resFact.rows[0], null, 2));
        } else {
            console.log('FAILURE: No ANPR Fact found for TEST-9999');
        }

        client.release();
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

check();
