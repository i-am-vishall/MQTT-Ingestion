
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    user: 'postgres',
    host: '127.0.0.1',
    database: 'mqtt_alerts_db',
    password: process.env.DB_PASSWORD || '', // fallback to empty if env missing
    port: 5441,
});

async function run() {
    try {
        const sqlPath = path.join(__dirname, '../database/health_monitor_schema.sql');
        console.log(`Reading SQL from: ${sqlPath}`);
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await pool.query(sql);
        console.log('Schema applied successfully.');
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
