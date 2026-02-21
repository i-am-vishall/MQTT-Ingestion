
const { Pool } = require('pg');
const pool = new Pool({
    user: 'postgres',
    host: '127.0.0.1',
    database: 'mqtt_alerts_db',
    password: '',
    port: 5441,
});

async function update() {
    try {
        // Delete all old rules
        await pool.query("DELETE FROM event_classification_rules");

        // Insert corrected rules based on detected payload
        const rules = [
            // Rule 1: Traffic (Vehicle Count)
            "('TRAFFIC_COUNT_RULE', 'TRAFFIC', 'taskName', 'Traffic_Counting', true)",
            // Rule 2: Crowd (Crowd Count)
            "('CROWD_COUNT_RULE', 'CROWD', 'taskName', 'Crowd_Counting', true)",
            // Rule 3: Parking
            "('PARKING_RULE', 'PARKING', 'taskName', 'Parking_Management', true)",
            // Rule 4: Security (Intrusion)
            "('INTRUSION_RULE', 'SECURITY', 'taskName', 'Intrusion_Detection', true)",
            // Rule 5: Security (Fire)
            "('FIRE_RULE', 'SECURITY', 'taskName', 'Fire_Detection', true)",
            // Rule 6: Traffic (Congestion)
            "('CONGESTION_RULE', 'TRAFFIC', 'taskName', 'Congestion_Detection', true)"
        ];

        const query = `
            INSERT INTO event_classification_rules (rule_name, domain, match_field, match_value, enabled)
            VALUES ${rules.join(', ')}
        `;

        await pool.query(query);
        console.log("Updated classification rules successfully.");

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
update();
