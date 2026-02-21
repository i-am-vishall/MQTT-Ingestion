const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const config = require('../ingestion-service/src/config'); // Reuse existing config

const pool = new Pool(config.db);

const sqlFile = process.argv[2];

if (!sqlFile) {
    console.error('Please provide an SQL file path.');
    process.exit(1);
}

async function run() {
    try {
        const client = await pool.connect();
        const sql = fs.readFileSync(sqlFile, 'utf8');
        console.log(`Executing SQL from ${sqlFile}...`);
        await client.query(sql);
        console.log('Success!');
        client.release();
        await pool.end();
    } catch (err) {
        console.error('Error executing SQL:', err);
        process.exit(1);
    }
}

run();
