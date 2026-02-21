
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

        console.log('--- Checking Raw MQTT Events (Last 10 ANPR) ---');
        const resRaw = await client.query(`
            SELECT event_time, event_type, camera_id, payload::jsonb 
            FROM mqtt_events 
            WHERE event_type = 'ANPR' OR (payload::jsonb->>'event_type') = 'ANPR'
            ORDER BY event_time DESC 
            LIMIT 10
        `);
        console.log(`Found ${resRaw.rowCount} raw ANPR events.`);
        if (resRaw.rowCount > 0) {
            console.log('Sample Payload:', JSON.stringify(resRaw.rows[0].payload, null, 2));
        }

        console.log('\n--- Checking ANPR Facts (Last 10) ---');
        const resFact = await client.query(`
            SELECT * FROM anpr_event_fact ORDER BY event_time DESC LIMIT 10
        `);
        console.log(`Found ${resFact.rowCount} ANPR facts.`);
        if (resFact.rowCount > 0) {
            console.log(resFact.rows[0]);
        }

        console.log('\n--- Checking ANPR Metrics (Last 10) ---');
        const resMetrics = await client.query(`
            SELECT * FROM anpr_metrics_1min ORDER BY bucket_time DESC LIMIT 10
        `);
        console.log(`Found ${resMetrics.rowCount} metric rows.`);
        if (resMetrics.rowCount > 0) {
            console.log(resMetrics.rows[0]);
        }

        client.release();
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

check();
