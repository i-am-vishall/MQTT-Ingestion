
const { Pool } = require('pg');
const config = require('../src/config');
const pool = new Pool(config.db);

async function check() {
    const client = await pool.connect();
    try {
        console.log('Checking FRS Event Fact Data...');
        const res = await client.query(`
            SELECT id, event_time, created_at, person_name 
            FROM frs_event_fact 
            ORDER BY id DESC 
            LIMIT 5
        `);
        console.table(res.rows);

        console.log('\n--- Time Comparison ---');
        const nowRes = await client.query('SELECT NOW() as db_time');
        console.log('Database NOW():', nowRes.rows[0].db_time);

        if (res.rows.length > 0) {
            const lastTime = new Date(res.rows[0].event_time);
            const dbNow = new Date(nowRes.rows[0].db_time);
            const diffMin = (dbNow - lastTime) / 1000 / 60;
            console.log(`Latest Event was ${diffMin.toFixed(2)} minutes ago.`);
        }

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

check();
