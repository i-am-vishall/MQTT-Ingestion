
const { Pool } = require('pg');
const config = require('../src/config');
const pool = new Pool(config.db);

async function describe() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'frs_metrics_1min';
        `);
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

describe();
