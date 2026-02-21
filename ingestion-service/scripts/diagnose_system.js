const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'mqtt_alerts_db',
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5441'),
});

async function diagnose() {
    try {
        console.log('--- SYSTEM DIAGNOSTICS ---');
        console.log(`Time: ${new Date().toISOString()}`);
        console.log(`DB Host: ${process.env.DB_HOST}:${process.env.DB_PORT}`);

        // 1. Check Connection
        const res = await pool.query('SELECT NOW()');
        console.log(`[PASS] DB Connection OK (Server Time: ${res.rows[0].now})`);

        // 2. Count Tables
        const counts = {};
        counts.errors = (await pool.query('SELECT count(*) FROM mqtt_events WHERE severity = \'error\'')).rows[0].count;
        counts.events = (await pool.query('SELECT count(*) FROM mqtt_events')).rows[0].count;
        counts.live = (await pool.query('SELECT count(*) FROM live_camera_state')).rows[0].count;
        counts.anpr = (await pool.query('SELECT count(*) FROM anpr_event_fact')).rows[0].count;
        counts.buckets = (await pool.query('SELECT count(*) FROM camera_metrics_1min')).rows[0].count;

        console.log('\n--- TABLE COUNTS ---');
        console.log(`Total MQTT Events:    ${counts.events}`);
        console.log(`Live Camera States:   ${counts.live}`);
        console.log(`ANPR Facts:           ${counts.anpr}`);
        console.log(`1-Min Metric Buckets: ${counts.buckets}`);

        // 3. Check Recent Activity (Last 5 mins)
        console.log('\n--- RECENT ACTIVITY (Last 5 Mins) ---');
        const recentEvents = (await pool.query(`SELECT count(*) FROM mqtt_events WHERE event_time > NOW() - INTERVAL '5 minutes'`)).rows[0].count;
        const recentBuckets = (await pool.query(`SELECT count(*) FROM camera_metrics_1min WHERE bucket_time > NOW() - INTERVAL '5 minutes'`)).rows[0].count;

        console.log(`Events Ingested:      ${recentEvents} ${recentEvents > 0 ? '✓' : '(No data flowing)'}`);
        console.log(`Buckets Created:      ${recentBuckets} ${recentBuckets > 0 ? '✓' : '(Scheduler might be stuck)'}`);

        // 4. Broker Check (Inferred)
        if (recentEvents === 0) {
            console.log('\n[WARNING] No recent events found. Check if Brokers are connected or if source is sending data.');
        } else {
            console.log('\n[SUCCESS] System is actively ingesting data.');
        }

    } catch (err) {
        console.error('[FAIL] Diagnostics Error:', err);
    } finally {
        await pool.end();
    }
}

diagnose();
