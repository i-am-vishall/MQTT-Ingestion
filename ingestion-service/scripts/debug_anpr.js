
const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'mqtt_db',
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
});

async function reproduce() {
    try {
        const client = await pool.connect();

        // 1. Get a raw event
        const resRaw = await client.query(`
            SELECT event_time, camera_id, payload::jsonb 
            FROM mqtt_events 
            WHERE event_type = 'ANPR' OR (payload::jsonb->>'event_type') = 'ANPR' OR (payload::jsonb->>'alertType') = 'ANPR'
            ORDER BY event_time DESC 
            LIMIT 1
        `);

        if (resRaw.rowCount === 0) {
            console.log('No raw ANPR events found to test.');
            return;
        }

        const row = resRaw.rows[0];
        console.log('Testing with event from:', row.event_time);

        const payload = row.payload;
        const p = payload.properties || {};

        // Emulate logic from index.js
        const isViolation =
            (p.NoHelmet === 'True' || p.NoHelmet === true) ||
            (p.RedLightViolated === 'True' || p.RedLightViolated === true) ||
            (p.WrongDirectionDetected === 'True' || p.WrongDirectionDetected === true);

        const violationTypes = [];
        if (p.NoHelmet === 'True' || p.NoHelmet === true) violationTypes.push('NoHelmet');
        if (p.RedLightViolated === 'True' || p.RedLightViolated === true) violationTypes.push('RedLightViolated');
        if (p.WrongDirectionDetected === 'True' || p.WrongDirectionDetected === true) violationTypes.push('WrongDirectionDetected');

        const params = [
            row.event_time,
            row.camera_id,
            p.PlateNumber || payload.plate_number || 'UNKNOWN',
            p.VehicleType || payload.vehicle_type,
            p.VehicleColor || payload.vehicle_color,
            p.VehicleMake || payload.vehicle_make,
            isViolation,
            violationTypes,
            (p.Speed || payload.speed) ? Number(p.Speed || payload.speed) : null
        ];

        console.log('Insert Params:', params);

        console.log('Attempting Insert...');
        await client.query(`
            INSERT INTO anpr_event_fact
            (event_time, camera_id, plate_number, vehicle_type, vehicle_color, vehicle_make,
             is_violation, violation_types, speed)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, params);

        console.log('Insert SUCCESS!');

        client.release();
    } catch (e) {
        console.error('Insert FAILED:', e);
    } finally {
        await pool.end();
    }
}

reproduce();
