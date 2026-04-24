require('dotenv').config();
const { Pool } = require('pg');
const config = require('../src/config');
const pool = new Pool(config.db);

async function checkAll() {
    const client = await pool.connect();
    const tables = ['mqtt_events', 'anpr_event_fact', 'frs_event_fact', 'crowd_event_fact', 'live_camera_state'];
    
    for(const t of tables) {
        try {
            const res = await client.query(`SELECT count(*) FROM ${t}`);
            console.log(`\n========================================`);
            console.log(`✅ TABLE: ${t.toUpperCase()}`);
            console.log(`   Total Rows Successfully Ingested: ${res.rows[0].count}`);
            
            // Check for event_time unless it's live_camera_state which uses last_event_time
            const timeCol = t === 'live_camera_state' ? 'last_event_time' : 'event_time';
            
            const latest = await client.query(`SELECT * FROM ${t} ORDER BY ${timeCol} DESC LIMIT 1`);
            if(latest.rowCount > 0) {
               console.log(`   Latest Record Streamed from Redis:`);
               console.log(JSON.stringify(latest.rows[0], null, 2));
            } else {
               console.log(`   No data found in this category yet.`);
            }
        } catch(e) {
            console.log(`\n========================================`);
            console.log(`⚠️ TABLE: ${t.toUpperCase()} (Skipped: ${e.message})`);
        }
    }
    client.release();
    pool.end();
}

checkAll();
