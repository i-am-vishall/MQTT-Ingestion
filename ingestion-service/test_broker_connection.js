const mqtt = require('mqtt');

// ANPR Broker from .env/brokers.json
const BROKER_URL = 'mqtt://103.205.114.241:1883';

console.log(`Connecting to ${BROKER_URL}...`);

const client = mqtt.connect(BROKER_URL, {
    connectTimeout: 5000,
});

client.on('connect', () => {
    console.log('✅ Connected successfully to ANPR Broker!');
    client.subscribe('#', (err) => {
        if (!err) console.log('✅ Subscribed to #');
    });
});

client.on('message', (topic, message) => {
    // Only print one message to prove data flow then exit
    console.log(`📩 Received message on ${topic}:`, message.toString().substring(0, 50) + '...');
    client.end();
    process.exit(0);
});

client.on('error', (err) => {
    console.error('❌ Connection Error:', err.message);
    client.end();
    process.exit(1);
});

// Timeout after 10s if no message or connection
setTimeout(() => {
    console.log('⚠️ Warning: Connected but no messages received in 10s (or connection timed out).');
    client.end();
    process.exit(0);
}, 10000);
