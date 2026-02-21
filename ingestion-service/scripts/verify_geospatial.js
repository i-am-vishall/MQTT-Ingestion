const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function verify() {
    const client = await pool.connect();
    try {
        console.log('--- VERIFYING GEOSPATIAL DATA ---');

        // 1. Check if columns exist
        const resColumns = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'camera_master' 
            AND column_name IN ('latitude', 'longitude');
        `);
        console.log('Columns found:', resColumns.rows);

        if (resColumns.rows.length < 2) {
            console.error('ERROR: latitude/longitude columns missing!');
        }

        // 2. Check for some populated data
        const resData = await client.query(`
            SELECT camera_id, latitude, longitude 
            FROM camera_master 
            WHERE latitude IS NOT NULL 
            LIMIT 5;
        `);
        console.log('Sample data with lat/long:', resData.rows);

        if (resData.rows.length === 0) {
            console.warn('WARNING: No data found with populated latitude/longitude. Check if raw events had valid ExtraDetails.');
        }

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

verify();
