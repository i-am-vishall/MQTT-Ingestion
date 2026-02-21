const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function inspect() {
    const client = await pool.connect();
    try {
        console.log('--- INSPECTING MQTT PAYLOADS ---');

        // Check for any payload with ExtraDetails
        const res = await client.query(`
            SELECT payload 
            FROM mqtt_events 
            WHERE payload::text LIKE '%ExtraDetails%'
            LIMIT 3;
        `);

        if (res.rows.length > 0) {
            console.log('Found payloads with ExtraDetails:');
            res.rows.forEach((row, i) => {
                console.log(`--- Row ${i + 1} ---`);
                console.log(JSON.stringify(row.payload, null, 2));
            });
        } else {
            console.log('No payloads found containing "ExtraDetails". Checking random sample...');
            const sample = await client.query('SELECT payload FROM mqtt_events LIMIT 3');
            sample.rows.forEach((row, i) => {
                console.log(`--- Random Row ${i + 1} ---`);
                console.log(JSON.stringify(row.payload, null, 2));
            });
        }

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

inspect();
