const { Pool } = require('pg');
const config = require('../ingestion-service/src/config');

async function analyzeTypes() {
    const pool = new Pool(config.db);
    try {
        console.log('--- Distinct Event Types ---');
        const res = await pool.query(`
            SELECT event_type, count(*) as count
            FROM mqtt_events
            GROUP BY event_type
            ORDER BY count DESC;
        `);
        console.table(res.rows);

        const plateRes = await pool.query(`
            SELECT event_type, payload
            FROM mqtt_events
            WHERE payload::text ILIKE '%wrongdirection%' OR payload::text ILIKE '%plate%'
            ORDER BY event_time DESC
            LIMIT 1;
        `);

        if (plateRes.rows.length === 0) {
            console.log('No ANPR candidates found.');
        } else {
            const row = plateRes.rows[0];
            console.log('--- FOUND CANDIDATE ---');
            console.log('Event Type (DB Column):', row.event_type);

            const p = row.payload;
            console.log('Payload Top Keys:', Object.keys(p));
            if (p.properties) {
                console.log('Payload.properties Keys:', Object.keys(p.properties));
                console.log('Properties Snippet:', JSON.stringify(p.properties, null, 2).substring(0, 500));
            } else {
                console.log('No properties object found.');
                console.log('Payload sample:', JSON.stringify(p).substring(0, 500));
            }

            // Check taskName or type fields
            console.log('taskName:', p.taskName);
            console.log('alertType:', p.alertType);
            console.log('type:', p.type);
        }

    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}
analyzeTypes();
