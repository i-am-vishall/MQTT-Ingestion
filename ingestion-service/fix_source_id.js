
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: 'postgres',
    host: '127.0.0.1',
    database: 'mqtt_alerts_db',
    password: '',
    port: 5441,
});

async function fixSourceId() {
    try {
        console.log('Adding source_id column...');
        await pool.query(`
            ALTER TABLE mqtt_events 
            ADD COLUMN IF NOT EXISTS source_id TEXT;
        `);
        console.log('Column added successfully.');
    } catch (e) {
        console.error('Failed to update schema:', e);
    } finally {
        await pool.end();
    }
}

fixSourceId();
