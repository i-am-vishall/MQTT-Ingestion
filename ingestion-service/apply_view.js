
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    user: 'postgres',
    host: '127.0.0.1',
    database: 'mqtt_alerts_db',
    password: '',
    port: 5441,
});

async function run() {
    try {
        const sqlPath = 'c:\\Users\\mevis\\MQTT-Ingetsion\\database\\create_smart_view.sql';
        console.log(`Applying View from: ${sqlPath}`);
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await pool.query('DROP VIEW IF EXISTS vw_live_dashboard');
        await pool.query(sql);
        console.log('Success: Smart View "vw_live_dashboard" created.');
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
