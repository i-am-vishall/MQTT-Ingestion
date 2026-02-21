
const { Pool } = require('pg');
const config = require('../src/config');

const pool = new Pool(config.db);

async function listCameras() {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT camera_id, camera_name FROM camera_master');
        console.log('--- Camera Master ---');
        res.rows.forEach(row => {
            console.log(`ID: ${row.camera_id}, Name: ${row.camera_name}`);
        });
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

listCameras();
