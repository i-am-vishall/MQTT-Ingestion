const fs = require('fs');
const path = require('path');
// .env is at ../../.env relative to config-ui/server/index.js
// but here we are in config-ui/server/list_tables.js
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { Pool } = require('pg');

async function listTables() {
    try {
        console.log('Connecting to:', {
            host: process.env.DB_HOST,
            db: process.env.DB_NAME,
            port: process.env.DB_PORT
        });

        const pool = new Pool({
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            password: process.env.DB_PASSWORD,
            port: parseInt(process.env.DB_PORT)
        });

        const res = await pool.query(`
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `);

        console.log('Tables found:', res.rows.length);
        res.rows.forEach(row => {
            console.log(`- ${row.table_name}`);
        });

        await pool.end();
    } catch (err) {
        console.error('Error:', err);
    }
}

listTables();
