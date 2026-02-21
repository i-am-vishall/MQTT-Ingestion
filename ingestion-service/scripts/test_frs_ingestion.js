
const mqtt = require('mqtt');
const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

const config = require('../src/config');
const pool = new Pool(config.db);

const topic = 'TEST/FRS';
const payload = {
    // "cameraId": 66,
    "EventName": "FaceRecognition", // Testing variant (No underscore)
    "DeviceId": "CAM_002",
    "DeviceName": "Entrance_Camera",
    "alertTime": new Date().toISOString(),
    "eventValue": null,
    "deviceIp": "10.1.6.51",
    "zoneId": "",
    "snapshot": "",
    "snapshotApacheUrl": null,
    "severity": "High",
    "ClientIds": [1, 801, 967, 968, 451, 969],
    "mappingCameraIds": [],
    "properties": {
        "searchImage": "",
        "FullImagePath": "SHOULD_BE_DELETED",
        "identity": "",
        "personName": "TEST_PERSON_JOHN_DOE",
        "faceImg": "snapshots/test/face.jpg",
        "recConf": "0",
        "detConf": "0.995535",
        "enrolledImage": "",
        "detTime": Date.now(),
        "trackId": "test-track-id-001",
        "matchId": "test-match-id-001",
        "faceWeight": "0.97619045",
        "alignImg": "",
        "isBaseImage": "False",
        "personId": "00000000-0000-0000-0000-000000000000",
        "gender": "male",
        "age": "25",
        "NormalizedPersonId": "0",
        "fullImgPath": "/skip this or delete this from payload ",
        "faceImgPath": "/this is a base64 img deleted this from payload"
    },
    "apachePlayBackUrl": "",
    "VMSServerUniqueId": "a3076bba28c64839b518f39fec8a0583",
    "VMSServerName": ""
};

console.log('--- Injecting FRS Event ---');

// Need to simulate the Ingestion Service logic or actually publish to MQTT?
// If I publish to MQTT, I need the service to be running.
// If the user hasn't started the service, publishing won't help verify the DB.
// But the user said "shows no data", implying they are looking at Grafana, so Service IS running.

const client = mqtt.connect(config.mqtt.brokerUrls[0] || 'mqtt://localhost:1883');

client.on('connect', () => {
    console.log('Connected to MQTT. Publishing...');
    client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
        if (err) console.error(err);
        else console.log('Published.');

        // Wait 2s for ingestion then check DB
        setTimeout(checkDB, 2000);
    });
});

async function checkDB() {
    console.log('--- Checking Database ---');
    const dbClient = await pool.connect();
    try {
        const res = await dbClient.query("SELECT * FROM frs_event_fact WHERE person_name = 'TEST_PERSON_JOHN_DOE'");
        console.log(`Found ${res.rowCount} FRS events.`);
        if (res.rowCount > 0) {
            console.log('Sample Row:', res.rows[0]);
        } else {
            console.log('NO DATA FOUND. Check service logs or normalization logic.');
        }
    } catch (e) {
        console.error(e);
    } finally {
        dbClient.release();
        client.end();
        await pool.end();
    }
}
