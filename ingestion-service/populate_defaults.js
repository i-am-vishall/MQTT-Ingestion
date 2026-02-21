
const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
    user: 'postgres',
    host: '127.0.0.1',
    database: 'mqtt_alerts_db',
    password: '',
    port: 5441,
});

async function runQueries() {
    try {
        // 1. Clean up Source Names
        console.log('Cleaning up source names...');
        const cleanupSql = fs.readFileSync('c:\\Users\\mevis\\MQTT-Ingetsion\\database\\fix_source_names.sql', 'utf8');
        await pool.query(cleanupSql);

        // 2. Populate Default Classification Rules
        console.log('Populating classification rules...');
        const queries = [
            `INSERT INTO event_classification_rules (match_field, match_value, domain)
             SELECT 'taskName', 'CROWD_DETECTION', 'CROWD'
             WHERE NOT EXISTS (SELECT 1 FROM event_classification_rules WHERE match_value = 'CROWD_DETECTION');`,

            `INSERT INTO event_classification_rules (match_field, match_value, domain)
             SELECT 'taskName', 'QUEUE_DETECTION', 'CROWD'
             WHERE NOT EXISTS (SELECT 1 FROM event_classification_rules WHERE match_value = 'QUEUE_DETECTION');`,

            `INSERT INTO event_classification_rules (match_field, match_value, domain)
             SELECT 'taskName', 'AUTOMATIC_TRAFFIC_COUNTING_AND_CLASSIFICATION', 'TRAFFIC'
             WHERE NOT EXISTS (SELECT 1 FROM event_classification_rules WHERE match_value = 'AUTOMATIC_TRAFFIC_COUNTING_AND_CLASSIFICATION');`,

            `INSERT INTO event_classification_rules (match_field, match_value, domain)
             SELECT 'alertType', 'Vehicle_Occupancy', 'TRAFFIC'
             WHERE NOT EXISTS (SELECT 1 FROM event_classification_rules WHERE match_value = 'Vehicle_Occupancy');`,

            `INSERT INTO event_classification_rules (match_field, match_value, domain)
             SELECT 'alertType', 'ANPR', 'TRAFFIC'
             WHERE NOT EXISTS (SELECT 1 FROM event_classification_rules WHERE match_value = 'ANPR');`,

            `INSERT INTO event_classification_rules (match_field, match_value, domain)
             SELECT 'taskName', 'INTRUSION_DETECTION', 'SECURITY'
             WHERE NOT EXISTS (SELECT 1 FROM event_classification_rules WHERE match_value = 'INTRUSION_DETECTION');`
        ];

        for (const q of queries) {
            await pool.query(q);
        }

        console.log('Defaults populated successfully.');

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

runQueries();
