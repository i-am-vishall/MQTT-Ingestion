
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: 'postgres',
    host: '127.0.0.1',
    database: 'mqtt_alerts_db',
    password: '',
    port: 5441,
});

async function fixSchema() {
    try {
        console.log('Adding missing columns...');
        await pool.query(`
            ALTER TABLE mqtt_events 
            ADD COLUMN IF NOT EXISTS source_ip TEXT,
            ADD COLUMN IF NOT EXISTS camera_name TEXT;
        `);
        console.log('Schema updated successfully.');
    } catch (e) {
        console.error('Failed to update schema:', e);
    } finally {
        await pool.end();
    }
}

fixSchema();
