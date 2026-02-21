const mqtt = require('mqtt');

// Configuration
const BROKER_URL = 'mqtt://103.205.115.74:1883';
const TOPICS = ['#']; // Subscribe to all topics for inspection

console.log(`Connecting to ${BROKER_URL}...`);

const client = mqtt.connect(BROKER_URL);

client.on('connect', () => {
    console.log('Connected to MQTT broker');

    client.subscribe(TOPICS, (err) => {
        if (!err) {
            console.log(`Subscribed to ${TOPICS.join(', ')}`);
        } else {
            console.error('Subscription error:', err);
        }
    });
});

client.on('message', (topic, message) => {
    try {
        const payload = message.toString();
        console.log(`\n[${new Date().toISOString()}] Topic: ${topic}`);
        console.log('Raw Payload:', payload);

        // Try to parse JSON
        try {
            const json = JSON.parse(payload);
            console.log('Parsed JSON:', JSON.stringify(json, null, 2));
        } catch (e) {
            console.log('Payload is NOT valid JSON');
        }
    } catch (err) {
        console.error('Error processing message:', err);
    }
});

client.on('error', (err) => {
    console.error('MQTT Client Error:', err);
});
