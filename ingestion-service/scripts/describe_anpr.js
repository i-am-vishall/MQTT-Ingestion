
const { Pool } = require('pg');
const config = require('../src/config');
const pool = new Pool(config.db);

async function describe() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'anpr_event_fact';
        `);
        res.rows.forEach(r => console.log(`${r.column_name} (${r.data_type}) NULL:${r.is_nullable}`));
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

describe();
