const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
});

async function validate() {
    try {
        console.log('--- VALIDATION STEP 4 ---');
        const client = await pool.connect();
        try {
            console.log('\nQuery 1: Latest ANPR Facts');
            const res1 = await client.query('SELECT * FROM anpr_event_fact ORDER BY event_time DESC LIMIT 10');
            console.table(res1.rows);

            console.log('\nQuery 2: Latest ANPR Metrics');
            const res2 = await client.query('SELECT * FROM anpr_metrics_1min ORDER BY bucket_time DESC LIMIT 10');
            console.table(res2.rows);

        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Validation failed:', err);
    } finally {
        await pool.end();
    }
}

validate();
