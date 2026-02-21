const mqtt = require('mqtt');

const BROKER_URL = 'mqtt://103.205.114.241:1883';
const TOPIC = '#';

console.log(`Connecting to ${BROKER_URL}...`);

const client = mqtt.connect(BROKER_URL, {
    connectTimeout: 5000,
});

client.on('connect', () => {
    console.log('✅ Connected successfully!');
    client.subscribe(TOPIC, (err) => {
        if (!err) {
            console.log(`✅ Subscribed to ${TOPIC}`);
            console.log('Waiting for messages...');
        } else {
            console.error('❌ Subscription failed:', err);
        }
    });
});

client.on('message', (topic, message) => {
    try {
        const payload = JSON.parse(message.toString());
        // Filter for valid ANPR or similar useful data to reduce noise
        if (payload.PlateNumber || payload.EventName === 'ANPR' || topic.includes('ANPR')) {
            console.log('📩 RECEIVED RELEVANT MESSAGE:');
            console.log('Topic:', topic);
            console.log('Payload Snippet:', JSON.stringify(payload).substring(0, 200));

            // We only need to verify it works, so we can exit after a few messages
            // process.exit(0); 
        }
    } catch (e) {
        // Ignore non-json
    }
});

client.on('error', (err) => {
    console.error('❌ Connection Error:', err);
    process.exit(1);
});

// Setup timeout
setTimeout(() => {
    console.log('⏳ Timeout reached (30s). Closing.');
    client.end();
}, 30000);
