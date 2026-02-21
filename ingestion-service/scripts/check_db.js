require('dotenv').config();
const { Pool } = require('pg');
const config = require('../src/config');

async function inspectDb() {
    const pool = new Pool(config.db);
    try {
        const client = await pool.connect();

        // Check columns
        const resCols = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'mqtt_events';
    `);
        console.log('Columns:', resCols.rows);

        // Check row count
        try {
            const resCount = await client.query('SELECT COUNT(*) FROM mqtt_events');
            console.log('Row count:', resCount.rows[0]);
        } catch (e) {
            console.log('Table probably does not exist or error counting:', e.message);
        }

        client.release();
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

inspectDb();
