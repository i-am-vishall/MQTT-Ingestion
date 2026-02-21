
const mqtt = require('mqtt');
require('dotenv').config({ path: '../.env' });

const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://103.205.115.74:1883';
const topic = 'TEST/ANPR/ALERT';

console.log('Connecting to MQTT Broker:', brokerUrl);
const client = mqtt.connect(brokerUrl);

const payload = {
    alertType: 'ANPR',
    cameraId: 'Test_Camera_001',
    severity: 'info',
    plate_number: 'TEST-9999',
    vehicle_type: 'Car',
    vehicle_color: 'Red',
    properties: {
        PlateNumber: 'TEST-9999',
        NoHelmet: 'True',
        Speed: '120'
    }
};

client.on('connect', () => {
    console.log('Connected!');

    // The ingestion service typically subscribes to '#' or specific topics.
    // We'll publish to a topic that matches the pattern.

    console.log('Publishing message to', topic);
    client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
        if (err) {
            console.error('Publish failed:', err);
        } else {
            console.log('Publish success!');
        }
        client.end();
    });
});

client.on('error', (err) => {
    console.error('MQTT Error:', err);
    client.end();
});
