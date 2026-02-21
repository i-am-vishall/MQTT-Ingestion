
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: 'postgres',
    host: '127.0.0.1',
    database: 'mqtt_alerts_db',
    password: '',
    port: 5441,
});

async function check() {
    try {
        const res = await pool.query(`
            SELECT column_name
            FROM information_schema.columns 
            WHERE table_name = 'mqtt_events';
        `);
        console.log('Columns: ' + res.rows.map(r => r.column_name).join(', '));
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

check();
