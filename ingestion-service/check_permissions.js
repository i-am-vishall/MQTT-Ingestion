
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: 'postgres',
    host: '127.0.0.1',
    database: 'mqtt_alerts_db',
    password: '',
    port: 5441,
});

async function checkPermissions() {
    try {
        const res = await pool.query(`
            SELECT tablename as table_name, tableowner 
            FROM pg_tables 
            WHERE schemaname = 'public';
        `);
        res.rows.forEach(r => console.log(`${r.table_name}: ${r.tableowner}`));
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

checkPermissions();
