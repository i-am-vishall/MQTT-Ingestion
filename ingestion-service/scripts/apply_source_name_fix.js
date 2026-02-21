
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const pool = new Pool(config.db);

async function apply() {
    const client = await pool.connect();
    try {
        console.log('Updating historical Source IDs...');
        const sql = fs.readFileSync(path.join(__dirname, '../../database/fix_source_names.sql'), 'utf8');
        await client.query(sql);
        console.log('Historical Source IDs updated to "Haridwar" and "ANPR".');
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

apply();
