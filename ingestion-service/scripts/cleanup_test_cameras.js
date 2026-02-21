
const { Pool } = require('pg');
const config = require('../src/config');

const pool = new Pool(config.db);

const TARGET_IDS = [
    '99999',
    'events/anpr',
    'TEST-FINAL-2II3S9-3',
    'TEST-FINAL-ANA9FQ-3',
    'TEST-FINAL-R7CXP-3',
    'Test_Camera_001' // Added this one too just in case, based on earlier findings
];

async function cleanup() {
    const client = await pool.connect();
    try {
        console.log('--- Cleaning up Test Cameras ---');
        console.log('Target IDs:', TARGET_IDS);

        // 0. Check existence first
        const check = await client.query('SELECT camera_id FROM camera_master WHERE camera_id = ANY($1)', [TARGET_IDS]);
        console.log('Found in camera_master:', check.rows.map(r => r.camera_id));

        await client.query('BEGIN');

        // 1. Delete from camera_master
        const resMaster = await client.query('DELETE FROM camera_master WHERE camera_id = ANY($1)', [TARGET_IDS]);
        console.log(`Deleted ${resMaster.rowCount} rows from camera_master`);

        // 2. Delete from live_camera_state
        const resLive = await client.query('DELETE FROM live_camera_state WHERE camera_id = ANY($1)', [TARGET_IDS]);
        console.log(`Deleted ${resLive.rowCount} rows from live_camera_state`);

        // 3. Clean events
        const resEvents = await client.query('DELETE FROM mqtt_events WHERE camera_id = ANY($1)', [TARGET_IDS]);
        console.log(`Deleted ${resEvents.rowCount} rows from mqtt_events`);

        // 4. Delete from anpr_event_fact
        const resFact = await client.query('DELETE FROM anpr_event_fact WHERE camera_id = ANY($1)', [TARGET_IDS]);
        console.log(`Deleted ${resFact.rowCount} rows from anpr_event_fact`);

        // 5. Delete from camera_metrics_1min
        const resMetrics = await client.query('DELETE FROM camera_metrics_1min WHERE camera_id = ANY($1)', [TARGET_IDS]);
        console.log(`Deleted ${resMetrics.rowCount} rows from camera_metrics_1min`);

        // 6. Delete from anpr_metrics_1min
        const resAnprMetrics = await client.query('DELETE FROM anpr_metrics_1min WHERE camera_id = ANY($1)', [TARGET_IDS]);
        console.log(`Deleted ${resAnprMetrics.rowCount} rows from anpr_metrics_1min`);

        await client.query('COMMIT');
        console.log('--- Cleanup Successful ---');

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Error during cleanup:', e);
    } finally {
        client.release();
        await pool.end();
    }
}

cleanup();
