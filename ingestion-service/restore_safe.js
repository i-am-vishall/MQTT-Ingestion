
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: 'postgres',
    host: '127.0.0.1',
    database: 'mqtt_alerts_db',
    password: '',
    port: 5441,
});

async function runQueries() {
    const queries = [
        // 1. Camera Master
        `CREATE TABLE IF NOT EXISTS camera_master (
            camera_id TEXT PRIMARY KEY,
            camera_name TEXT,
            location TEXT,
            camera_type TEXT,
            is_active BOOLEAN DEFAULT true
        );`,
        `CREATE INDEX IF NOT EXISTS idx_camera_master_name ON camera_master (camera_name);`,

        // 2. Live Camera State
        `CREATE TABLE IF NOT EXISTS live_camera_state (
            camera_id TEXT PRIMARY KEY,
            crowd_count INT,
            crowd_state TEXT,
            crowd_last_time TIMESTAMPTZ,
            vehicle_count INT,
            traffic_state TEXT,
            traffic_last_time TIMESTAMPTZ,
            parking_occupancy INT,
            parking_capacity INT,
            parking_state TEXT,
            parking_last_time TIMESTAMPTZ,
            security_state TEXT,
            security_last_time TIMESTAMPTZ,
            last_event_time TIMESTAMPTZ,
            updated_at TIMESTAMPTZ DEFAULT now()
        );`,

        // 3. ANPR Event Fact
        `CREATE TABLE IF NOT EXISTS anpr_event_fact (
            id BIGSERIAL PRIMARY KEY,
            event_time timestamptz NOT NULL,
            camera_id text NOT NULL,
            plate_number text NOT NULL,
            vehicle_type text,
            vehicle_color text,
            vehicle_make text,
            is_violation boolean NOT NULL DEFAULT false,
            violation_types text[],
            speed numeric,
            source_type TEXT,
            source_name TEXT,
            source_id TEXT,
            source_ip TEXT,
            camera_name TEXT
        );`,
        `CREATE INDEX IF NOT EXISTS idx_anpr_fact_time ON anpr_event_fact (event_time);`,

        // 4. FRS Event Fact
        `CREATE TABLE IF NOT EXISTS frs_event_fact (
            id BIGSERIAL PRIMARY KEY,
            event_time TIMESTAMPTZ NOT NULL,
            camera_id TEXT NOT NULL,
            camera_name TEXT,
            person_id TEXT,
            person_name TEXT,
            gender TEXT,
            age INT,
            match_id TEXT,
            track_id TEXT,
            det_conf NUMERIC,
            rec_conf NUMERIC,
            face_image_path TEXT,
            is_authorized BOOLEAN DEFAULT false,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );`,
        `CREATE INDEX IF NOT EXISTS idx_frs_fact_time ON frs_event_fact (event_time);`,

        // 5. Metrics Tables
        `CREATE TABLE IF NOT EXISTS camera_metrics_1min (
            bucket_time TIMESTAMPTZ NOT NULL,
            camera_id TEXT NOT NULL,
            crowd_count INT DEFAULT 0,
            vehicle_count INT DEFAULT 0,
            parking_occupancy INT DEFAULT 0,
            traffic_state TEXT,
            crowd_state TEXT,
            parking_state TEXT,
            PRIMARY KEY (bucket_time, camera_id)
        );`,

        `CREATE TABLE IF NOT EXISTS anpr_metrics_1min (
            bucket_time timestamptz NOT NULL,
            camera_id text NOT NULL,
            anpr_count integer NOT NULL,
            PRIMARY KEY (bucket_time, camera_id)
        );`,

        `CREATE TABLE IF NOT EXISTS anpr_violation_metrics_1min (
            bucket_time timestamptz NOT NULL,
            violation_type text NOT NULL,
            violation_count integer NOT NULL,
            PRIMARY KEY (bucket_time, violation_type)
        );`,

        `CREATE TABLE IF NOT EXISTS frs_metrics_1min (
            bucket_time TIMESTAMPTZ NOT NULL,
            camera_id TEXT NOT NULL,
            total_faces INT DEFAULT 0,
            unique_persons INT DEFAULT 0,
            male_count INT DEFAULT 0,
            female_count INT DEFAULT 0,
            PRIMARY KEY (bucket_time, camera_id)
        );`,

        // 6. Event Classification Rules
        `CREATE TABLE IF NOT EXISTS event_classification_rules (
            rule_id SERIAL PRIMARY KEY,
            match_field TEXT,
            match_value TEXT,
            domain TEXT,
            enabled BOOLEAN DEFAULT true
        );`
    ];

    try {
        for (const query of queries) {
            await pool.query(query);
            console.log('Executed query successfully.');
        }
        console.log('Restoration complete.');
    } catch (e) {
        console.error('Error executing query:', e);
    } finally {
        await pool.end();
    }
}

runQueries();
