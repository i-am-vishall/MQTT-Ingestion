const mqtt = require('mqtt');
const { Pool } = require('pg');
const config = require('../ingestion-service/src/config');

const pool = new Pool(config.db);
const client = mqtt.connect(config.mqtt.brokerUrl);

const TEST_CAMERA_ID = 'TEST_ICCC_CAM_01';

async function runTest() {
    console.log('--- STARTING ICCC VERIFICATION ---');

    // 1. Setup Wrapper (Ensure test camera exists in master)
    try {
        await pool.query(`
            INSERT INTO camera_master (camera_id, camera_name, camera_type, is_active)
            VALUES ($1, 'Test Camera', 'CROWD', true)
            ON CONFLICT (camera_id) DO NOTHING
        `, [TEST_CAMERA_ID]);

        // Ensure live state row exists
        await pool.query(`
            INSERT INTO live_camera_state (camera_id)
            VALUES ($1)
            ON CONFLICT (camera_id) DO NOTHING
        `, [TEST_CAMERA_ID]);

        console.log('✅ Generated Test Camera logic.');
    } catch (err) {
        console.error('❌ Setup failed:', err);
        process.exit(1);
    }

    client.on('connect', () => {
        console.log('✅ MQTT Connected.');

        // 2. Publish Test Event (CROWD)
        const payload = {
            taskName: 'CROWD_DETECTION',
            camera_id: TEST_CAMERA_ID,
            count: 42,
            timestamp: new Date().toISOString()
        };

        client.publish('events/test', JSON.stringify(payload), async (err) => {
            if (err) {
                console.error('❌ Publish failed:', err);
                process.exit(1);
            }
            console.log('✅ Published test event to MQTT.');

            // 3. Wait for Ingestion
            console.log('⏳ Waiting 5s for ingestion...');
            setTimeout(checkState, 5000);
        });
    });
}

async function checkState() {
    try {
        const res = await pool.query(`
            SELECT * FROM live_camera_state WHERE camera_id = $1
        `, [TEST_CAMERA_ID]);

        if (res.rows.length === 0) {
            console.error('❌ Test camera row not found in live_camera_state.');
        } else {
            const row = res.rows[0];
            console.log('--- LIVE STATE RESULT ---');
            console.log('Crowd Count:', row.crowd_count);
            console.log('Crowd State:', row.crowd_state);
            console.log('Updated At:', row.updated_at);

            if (row.crowd_count === 42) {
                console.log('✅ SUCCESS: Live state updated correctly!');
            } else {
                console.error('❌ FAILURE: Crowd count does not match (Expected 42).');
            }
        }
    } catch (err) {
        console.error('❌ Check failed:', err);
    } finally {
        // Cleanup (Optional)
        // await pool.query('DELETE FROM camera_master WHERE camera_id = $1', [TEST_CAMERA_ID]);
        client.end();
        await pool.end();
        process.exit(0);
    }
}

runTest();
