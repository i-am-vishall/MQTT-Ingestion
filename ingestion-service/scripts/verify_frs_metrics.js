
const { Pool } = require('pg');
const config = require('../src/config');
const pool = new Pool(config.db);

async function verify() {
    const client = await pool.connect();
    try {
        console.log('--- Verifying FRS Metrics ---');

        // 1. Manually trigger aggregation for "now" (simulating job)
        // We look at data from last 10 minutes to be safe
        const query = `
            INSERT INTO frs_metrics_1min(
                bucket_time, camera_id, 
                total_faces, unique_persons, male_count, female_count
            )
            SELECT
                date_trunc('minute', event_time),
                camera_id,
                COUNT(*),
                COUNT(DISTINCT person_name),
                SUM(CASE WHEN gender ILIKE 'male' THEN 1 ELSE 0 END),
                SUM(CASE WHEN gender ILIKE 'female' THEN 1 ELSE 0 END)
            FROM frs_event_fact
            WHERE event_time >= now() - interval '60 minutes'
            GROUP BY 1, 2
            ON CONFLICT(bucket_time, camera_id)
            DO UPDATE SET 
                total_faces = EXCLUDED.total_faces,
                unique_persons = EXCLUDED.unique_persons,
                male_count = EXCLUDED.male_count,
                female_count = EXCLUDED.female_count
            RETURNING *;
        `;

        const res = await client.query(query);
        console.log(`Aggregated ${res.rowCount} metric buckets.`);

        if (res.rowCount > 0) {
            console.table(res.rows);
        } else {
            console.log('No metrics generated. (Maybe no FRS events in last 60 mins?)');
        }

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

verify();
