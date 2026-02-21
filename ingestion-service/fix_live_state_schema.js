
const { Pool } = require('pg');
const pool = new Pool({
    user: 'postgres',
    host: '127.0.0.1',
    database: 'mqtt_alerts_db',
    password: '',
    port: 5441,
});

async function run() {
    try {
        console.log("Adding camera_name to live_camera_state...");
        await pool.query(`
            ALTER TABLE live_camera_state 
            ADD COLUMN IF NOT EXISTS camera_name TEXT;
        `);
        console.log("Success: Added camera_name.");

        console.log("Adding source_id to live_camera_state (just in case)...");
        await pool.query(`
            ALTER TABLE live_camera_state 
            ADD COLUMN IF NOT EXISTS source_id TEXT;
        `);
        console.log("Success: Added source_id.");

        console.log("Adding source_type to live_camera_state...");
        await pool.query(`
            ALTER TABLE live_camera_state 
            ADD COLUMN IF NOT EXISTS source_type TEXT;
        `);
        console.log("Success: Added source_type.");


    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
