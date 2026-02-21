
const { Pool } = require('pg');
const config = require('../src/config');
const pool = new Pool(config.db);

async function inspect() {
    const client = await pool.connect();
    try {
        console.log('Fetching last Face_Recognition event from mqtt_events...');
        const res = await client.query(`
            SELECT payload 
            FROM mqtt_events 
            WHERE event_type IN ('Face_Recognition', 'FaceRecognition') 
            ORDER BY event_time DESC 
            LIMIT 1
        `);

        if (res.rows.length > 0) {
            console.log('--- PAYLOAD KEYS ---');
            const data = res.rows[0].payload;
            console.log(Object.keys(data));

            console.log('\n--- PROPERTIES KEYS (if exists) ---');
            if (data.properties) {
                console.log(Object.keys(data.properties));
            } else {
                console.log('WARNING: No "properties" field found!');
            }
        } else {
            console.log('No FRS events found in mqtt_events raw table.');
        }
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

inspect();
