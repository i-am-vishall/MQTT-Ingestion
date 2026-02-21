-- Database Initialization for MQTT Ingestion System

-- Reset table if exists to ensure schema consistency
DROP TABLE IF EXISTS mqtt_events CASCADE;

-- Create the table for storing MQTT events
CREATE TABLE IF NOT EXISTS mqtt_events (
    id BIGSERIAL PRIMARY KEY,
    event_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    camera_id TEXT,
    event_type TEXT,
    severity TEXT,
    payload JSONB NOT NULL,
    source_id TEXT,
    source_ip TEXT,
    camera_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common query patterns
-- Index on event_time is crucial for time-range queries (Grafana)
CREATE INDEX IF NOT EXISTS idx_mqtt_events_time ON mqtt_events (event_time DESC);

-- Index on camera_id for filtering by camera
CREATE INDEX IF NOT EXISTS idx_mqtt_events_camera ON mqtt_events (camera_id);

-- Index on event_type for filtering by event type
CREATE INDEX IF NOT EXISTS idx_mqtt_events_type ON mqtt_events (event_type);

-- Validation: Verify table creation
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'mqtt_events';
