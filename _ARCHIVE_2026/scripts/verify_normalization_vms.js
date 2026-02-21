const mqtt = require('mqtt');
const { Pool } = require('pg');
const config = require('../ingestion-service/src/config');

const pool = new Pool(config.db);
const client = mqtt.connect(config.mqtt.brokerUrl);

const vmsPayload = {
    "EventName": "ANPR",
    "Category": null,
    "DetConf": 0.88,
    "DetTime": Date.now(),
    "DeviceName": "Sankracharya_1.5.Sankracharya_P1_ANPR_L1_1.22",
    "DeviceId": 22783,
    "DeviceIP": "192.168.1.55", // Test IP
    "PlateNumber": "TESTVMS01",
    "VehicleType": "Car",
    "RedLightViolated": true,
    "Speed": 85
};

client.on('connect', () => {
    console.log('Connected to MQTT');
    client.publish('events/anpr', JSON.stringify(vmsPayload), async (err) => {
        if (err) console.error(err);
        else console.log('Published VMS Payload');

        // Wait for ingestion
        setTimeout(async () => {
            await checkDb('TESTVMS01', 'VMS', 'VMS-192.168.1.55');
            client.end();
            pool.end();
        }, 2000);
    });
});

async function checkDb(plate, expectedSourceType, expectedSourceName) {
    const res = await pool.query(`
        SELECT * FROM anpr_event_fact 
        WHERE plate_number = $1 AND source_type IS NOT NULL
        ORDER BY event_time DESC LIMIT 1
    `, [plate]);

    if (res.rows.length === 0) {
        console.error('❌ No event found in DB for plate', plate);
    } else {
        const row = res.rows[0];
        console.log('✅ Event found:', row.plate_number);
        console.log(`   Source Type: ${row.source_type} (Expected: ${expectedSourceType})`);
        console.log(`   Source Name: ${row.source_name} (Expected: ${expectedSourceName})`);
        console.log(`   Violation: ${row.is_violation}`);

        if (row.source_type === expectedSourceType && row.source_name === expectedSourceName) {
            console.log('✅ Normalization Verification PASSED');
        } else {
            console.error('❌ Normalization Verification FAILED');
        }
    }
}
