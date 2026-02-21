
const { Pool } = require('pg');
const config = require('../src/config');

const pool = new Pool(config.db);

const TARGET_IDS = [
    '99999',
    'events/anpr',
    'TEST-FINAL-2II3S9-3',
    'TEST-FINAL-ANA9FQ-3',
    'TEST-FINAL-R7CXP-3'
];

async function verifyANPR() {
    const client = await pool.connect();
    try {
        console.log('--- Verifying ANPR Tables ---');

        // 1. Check anpr_event_fact
        const resFact = await client.query('SELECT count(*) FROM anpr_event_fact WHERE camera_id = ANY($1)', [TARGET_IDS]);
        console.log(`Rows in anpr_event_fact for test cameras: ${resFact.rows[0].count}`);

        // 2. Check anpr_metrics_1min
        const resMetrics = await client.query('SELECT count(*) FROM anpr_metrics_1min WHERE camera_id = ANY($1)', [TARGET_IDS]);
        console.log(`Rows in anpr_metrics_1min for test cameras: ${resMetrics.rows[0].count}`);

        // 3. Check for specific plate 'TEST-9999' just in case
        const resPlate = await client.query("SELECT count(*) FROM anpr_event_fact WHERE plate_number = 'TEST-9999'");
        console.log(`Rows with plate 'TEST-9999': ${resPlate.rows[0].count}`);

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

verifyANPR();
