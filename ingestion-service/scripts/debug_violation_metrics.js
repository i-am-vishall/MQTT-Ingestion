
const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'mqtt_db',
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
});

async function check() {
    try {
        const client = await pool.connect();

        console.log('--- Checking ANPR Facts Violation Types ---');
        const resFacts = await client.query(`
            SELECT event_time, plate_number, is_violation, violation_types 
            FROM anpr_event_fact 
            WHERE is_violation = true
            ORDER BY event_time DESC LIMIT 5
        `);
        resFacts.rows.forEach(r => console.log(JSON.stringify(r)));

        if (resFacts.rowCount > 0) {
            console.log('\n--- Testing Aggregation Query Manually ---');
            // We widen the interval to ensure we catch the test event
            const interval = '1 hour';

            const aggQuery = `
                SELECT
                    date_trunc('minute', event_time) as bucket_time,
                    vt as violation_type,
                    COUNT(*) as count
                FROM anpr_event_fact,
                LATERAL unnest(violation_types) vt
                WHERE event_time >= now() - interval '${interval}'
                GROUP BY 1,2
            `;
            const resAgg = await client.query(aggQuery);
            console.log(`Aggregation found ${resAgg.rowCount} rows:`);
            resAgg.rows.forEach(r => console.log(JSON.stringify(r)));
        } else {
            console.log('No violations found in facts table to aggregate.');
        }

        client.release();
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

check();
