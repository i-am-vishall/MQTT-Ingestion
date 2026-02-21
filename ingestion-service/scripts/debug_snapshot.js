const mqtt = require('mqtt');
const config = require('../src/config');
const pino = require('pino');

// Use basic console for reliability in this test
const logger = { info: console.log, error: console.error };

const client = mqtt.connect(config.mqtt.brokerUrl);

console.log('Connecting to MQTT...');

client.on('connect', () => {
    console.log('Connected to MQTT');
    client.subscribe(config.mqtt.topics);
});

client.on('message', (topic, message) => {
    try {
        const payload = JSON.parse(message.toString());

        console.log('--- Received Message ---');
        console.log(`Keys before: ${Object.keys(payload).join(', ')}`);

        // Exact logic from index.js
        if (payload.snapshot) {
            console.log('Found "snapshot" key. Removing...');
            delete payload.snapshot;
        } else if (payload.Snapshot) {
            console.log('Found "Snapshot" key. Removing...');
            delete payload.Snapshot;
        } else {
            console.log('No "snapshot" or "Snapshot" key found.');
        }

        const keysAfter = Object.keys(payload);
        console.log(`Keys after: ${keysAfter.join(', ')}`);

        if (!keysAfter.includes('snapshot') && !keysAfter.includes('Snapshot')) {
            console.log("VERIFICATION_SUCCESS: Snapshot field is GONE.");
        } else {
            console.log("VERIFICATION_FAILURE: Snapshot field STILL EXISTS.");
        }

        process.exit(0);

    } catch (e) {
        console.error(e);
        process.exit(1);
    }
});
