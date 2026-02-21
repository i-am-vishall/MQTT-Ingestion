
const { Pool } = require('pg');
const config = require('./src/config');

const pool = new Pool(config.db);

async function fixSchema() {
    const client = await pool.connect();
    try {
        console.log('1. Adding event_10s_bucket column (standard)...');
        await client.query(`
            ALTER TABLE anpr_event_fact
            ADD COLUMN IF NOT EXISTS event_10s_bucket timestamptz;
        `);

        console.log('2. Creating Trigger Function...');
        await client.query(`
            CREATE OR REPLACE FUNCTION set_anpr_bucket_time()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.event_10s_bucket := to_timestamp(floor(extract(epoch from NEW.event_time) / 10) * 10);
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        console.log('3. Attaching Trigger...');
        await client.query(`
            DROP TRIGGER IF EXISTS trigger_set_anpr_bucket ON anpr_event_fact;
            CREATE TRIGGER trigger_set_anpr_bucket
            BEFORE INSERT OR UPDATE ON anpr_event_fact
            FOR EACH ROW
            EXECUTE FUNCTION set_anpr_bucket_time();
        `);

        console.log('4. Backfilling existing NULLs...');
        await client.query(`
            UPDATE anpr_event_fact 
            SET event_10s_bucket = to_timestamp(floor(extract(epoch from event_time) / 10) * 10)
            WHERE event_10s_bucket IS NULL;
        `);

        console.log('5. Adding unique index...');
        await client.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_anpr_deduplication 
            ON anpr_event_fact (plate_number, camera_id, event_10s_bucket);
        `);
        console.log('Success! Schema fixed.');

    } catch (err) {
        console.error('Error applying fix:', err);
    } finally {
        client.release();
        pool.end();
    }
}

fixSchema();
