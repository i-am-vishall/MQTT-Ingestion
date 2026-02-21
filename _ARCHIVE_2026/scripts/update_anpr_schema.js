const { Pool } = require('pg');
const config = require('../ingestion-service/src/config'); // Adjust path as needed

const pool = new Pool(config.db);

async function runMigration() {
    try {
        console.log('Connecting to DB...');
        const client = await pool.connect();

        console.log('Altering anpr_event_fact table...');
        await client.query(`
            ALTER TABLE anpr_event_fact
            ADD COLUMN IF NOT EXISTS source_type text,
            ADD COLUMN IF NOT EXISTS source_name text;
        `);

        console.log('Migration successful: source_type and source_name columns added.');
        client.release();
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await pool.end();
    }
}

runMigration();
