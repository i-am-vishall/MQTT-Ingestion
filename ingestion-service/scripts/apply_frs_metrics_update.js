
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const pool = new Pool(config.db);

async function apply() {
    const client = await pool.connect();
    try {
        console.log('Applying FRS Metrics Update...');
        const sql = fs.readFileSync(path.join(__dirname, '../../database/frs_metrics_update.sql'), 'utf8');
        await client.query(sql);
        console.log('FRS Metrics Schema Updated.');
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

apply();
