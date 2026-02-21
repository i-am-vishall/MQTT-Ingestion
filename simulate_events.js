const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://103.205.115.74:1883');

const messages = [
    { camera_id: 'CAM_TEST_01', event_type: 'person_detected', severity: 'high', location: 'Gate A' },
    { camera_id: 'CAM_TEST_02', event_type: 'vehicle_detected', severity: 'medium', location: 'Parking' },
    { camera_id: 'CAM_TEST_01', event_type: 'motion', severity: 'low', location: 'Gate A' }
];

client.on('connect', () => {
    console.log('Connected to MQTT Broker');

    let count = 0;
    const interval = setInterval(() => {
        if (count >= messages.length) {
            clearInterval(interval);
            client.end();
            console.log('Done publishing.');
            return;
        }

        const msg = messages[count];
        const topic = `camera/${msg.camera_id}/alert`;
        client.publish(topic, JSON.stringify(msg));
        console.log(`Published to ${topic}:`, msg);
        count++;
    }, 500);
});

client.on('error', (err) => {
    console.error('MQTT Error:', err);
    client.end();
});
