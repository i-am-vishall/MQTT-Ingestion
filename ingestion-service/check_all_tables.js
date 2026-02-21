
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: 'postgres',
    host: '127.0.0.1',
    database: 'mqtt_alerts_db',
    password: '',
    port: 5441,
});

async function checkTables() {
    const tables = [
        'mqtt_events',
        'camera_master',
        'live_camera_state',
        'anpr_event_fact',
        'anpr_metrics_1min',
        'anpr_violation_metrics_1min',
        'camera_metrics_1min',
        'event_classification_rules'
    ];

    try {
        const res = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public';
        `);

        const existingTables = res.rows.map(r => r.table_name);

        console.log('--- Table Status ---');
        tables.forEach(t => {
            const status = existingTables.includes(t) ? 'EXISTS' : 'MISSING';
            console.log(`${t}: ${status}`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

checkTables();
