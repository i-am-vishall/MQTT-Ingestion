const { Client } = require('pg');
const client = new Client({
    host: '127.0.0.1',
    port: 5441,
    user: 'postgres',
    database: 'mqtt_alerts_db',
});
async function run() {
    try {
        await client.connect();
        console.log('Connected to Production DB (5441)');
        const res = await client.query('SELECT count(*) FROM mqtt_events');
        console.log('Event Count:', res.rows[0].count);
        await client.end();
    } catch (e) {
        console.error('Connection Error:', e);
    }
}
run();
