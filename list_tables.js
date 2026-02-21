const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: 'c:\\Users\\mevis\\MQTT-Ingetsion\\.env' });
const { Pool } = require('pg');

async function listTables() {
    try {
        const pool = new Pool({
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            password: process.env.DB_PASSWORD,
            port: parseInt(process.env.DB_PORT)
        });

        console.log('Connected to DB:', process.env.DB_NAME);

        const res = await pool.query(`
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `);

        console.log('Tables found:', res.rows.length);
        res.rows.forEach(row => {
            console.log(`- ${row.table_schema}.${row.table_name}`);
        });

        await pool.end();
    } catch (err) {
        console.error('Error:', err);
    }
}

listTables();
