const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function populate() {
    const client = await pool.connect();
    try {
        console.log('--- POPULATING CAMERA MASTER FROM EVENTS ---');

        // 1. Check schema to see which columns are required
        const resSchema = await client.query(`
            SELECT column_name, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'camera_master';
        `);
        console.log('Schema:', resSchema.rows.map(r => `${r.column_name} (${r.is_nullable})`).join(', '));

        // 2. Insert distinct cameras
        // We try to extract camera_name from payload->'DeviceName' or payload->'camera_name' if available.
        // We use the latest event to get the name.
        const query = `
            INSERT INTO camera_master (camera_id, camera_name)
            SELECT DISTINCT ON (e.camera_id)
                e.camera_id,
                COALESCE(e.payload->>'DeviceName', e.payload->>'camera_name', 'Unknown') as camera_name
            FROM mqtt_events e
            WHERE e.camera_id IS NOT NULL
            ORDER BY e.camera_id, e.event_time DESC
            ON CONFLICT (camera_id) DO NOTHING;
        `;

        console.log('Executing insert...');
        const res = await client.query(query);
        console.log(`Inserted ${res.rowCount} cameras.`);

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

populate();
