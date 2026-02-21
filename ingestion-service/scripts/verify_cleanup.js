
const { Pool } = require('pg');
const config = require('../src/config');

const pool = new Pool(config.db);

const TARGET_IDS = [
    '99999',
    'events/anpr',
    'TEST-FINAL-2II3S9-3',
    'TEST-FINAL-ANA9FQ-3',
    'TEST-FINAL-R7CXP-3'
];

async function verify() {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT camera_id FROM camera_master WHERE camera_id = ANY($1)', [TARGET_IDS]);
        if (res.rowCount === 0) {
            console.log('VERIFICATION SUCCESS: No test cameras found.');
        } else {
            console.log('VERIFICATION FAILED: Found lingering cameras:', res.rows);
        }
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

verify();
