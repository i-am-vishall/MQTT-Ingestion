
const { Pool } = require('pg');
const pool = new Pool({
    user: 'postgres',
    host: '127.0.0.1',
    database: 'mqtt_alerts_db',
    password: '',
    port: 5441,
});

async function run() {
    try {
        console.log("=== RULES ===");
        const rules = await pool.query('SELECT * FROM event_classification_rules');
        rules.rows.forEach(r => {
            // detailed log
            console.log(JSON.stringify(r));
        });

        console.log("\n=== RECENT EVENTS (Last 1) ===");
        const events = await pool.query('SELECT event_type, camera_id, payload FROM mqtt_events ORDER BY event_time DESC LIMIT 1');

        if (events.rows.length === 0) {
            console.log("No events found.");
            return;
        }

        const row = events.rows[0];
        console.log(`Event Type: ${row.event_type}, Camera ID: ${row.camera_id}`);
        const p = row.payload;

        // Print top-level keys and values for likely match candidates
        Object.keys(p).forEach(k => {
            if (typeof p[k] !== 'object' || p[k] === null) {
                console.log(`Payload Key: [${k}] Value: [${p[k]}]`);
            }
        });

        if (p.properties) {
            console.log("--- Properties ---");
            Object.keys(p.properties).forEach(k => {
                console.log(`Prop Key: [${k}] Value: [${p.properties[k]}]`);
            });
        }

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
