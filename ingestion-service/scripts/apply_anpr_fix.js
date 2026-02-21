
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const config = require('../src/config');

const pool = new Pool(config.db);

async function applyFix() {
    const client = await pool.connect();
    try {
        const sqlPath = path.join(__dirname, '../../database/anpr_columns_fix.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Applying ANPR Columns Fix...');
        await client.query(sql);
        console.log('Fix Applied Successfully.');
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

applyFix();
