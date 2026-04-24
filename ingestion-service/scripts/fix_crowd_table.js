const { Pool } = require('pg');
const pool = new Pool({ port: 5441, user: 'postgres', database: 'mqtt_alerts_db' });

async function fix() {
    const sql = `
        CREATE TABLE IF NOT EXISTS public.crowd_event_fact (
            id BIGSERIAL PRIMARY KEY,
            event_time TIMESTAMPTZ NOT NULL,
            camera_id TEXT NOT NULL,
            crowd_count INTEGER,
            crowd_state TEXT,
            source_type TEXT,
            source_name TEXT,
            source_id TEXT,
            source_ip TEXT,
            camera_name TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            event_hash TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_crowd_fact_time ON public.crowd_event_fact (event_time DESC);
        CREATE INDEX IF NOT EXISTS idx_crowd_fact_camera ON public.crowd_event_fact (camera_id);
    `;
    
    try {
        await pool.query(sql);
        console.log("Successfully created actual crowd_event_fact layer 2 table!");
        pool.end();
    } catch(e) { console.error(e); pool.end(); }
}
fix();
