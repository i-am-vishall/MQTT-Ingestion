
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const config = require('../src/config');

const pool = new Pool(config.db);

async function applySchema() {
    const client = await pool.connect();
    try {
        const sqlPath = path.join(__dirname, '../../database/frs_schema.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Applying FRS Schema...');
        await client.query(sql);
        console.log('Schema Applied Successfully.');
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

applySchema();
