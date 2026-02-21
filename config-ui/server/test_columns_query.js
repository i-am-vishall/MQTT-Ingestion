const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { Pool } = require('pg');

async function checkColumns(tableName) {
    try {
        const pool = new Pool({
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            password: process.env.DB_PASSWORD,
            port: parseInt(process.env.DB_PORT)
        });

        console.log(`Checking columns for table: '${tableName}'`);

        const res = await pool.query(
            `SELECT column_name, data_type 
             FROM information_schema.columns 
             WHERE table_schema = 'public' AND table_name = $1`,
            [tableName]
        );

        console.log('Columns found:', res.rows.length);
        console.log(res.rows);

        await pool.end();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkColumns('anpr_event_fact');
