
const { Pool } = require('pg');
const config = require('./src/config');

const pool = new Pool(config.db);

async function checkRules() {
    try {
        const res = await pool.query('SELECT COUNT(*) FROM event_classification_rules');
        console.log(`Count: ${res.rows[0].count}`);
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

checkRules();
