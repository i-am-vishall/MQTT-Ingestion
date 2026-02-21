-- Phase 1: Add Structure (No Logic Yet)

-- 1. Create camera_master
-- Using TEXT for camera_id to be compatible with existing mqtt_events.camera_id
CREATE TABLE IF NOT EXISTS camera_master (
    camera_id      TEXT PRIMARY KEY,
    camera_name    TEXT,
    location       TEXT,
    camera_type    TEXT,   -- ATCC / PARKING / CROWD / PTZ
    is_active      BOOLEAN DEFAULT true
);

-- Index for fast camera name lookups
CREATE INDEX IF NOT EXISTS idx_camera_master_name ON camera_master (camera_name);

-- Populate camera_master (Safe Population)
INSERT INTO camera_master (camera_id, camera_name)
SELECT DISTINCT camera_id, payload->>'cameraName'
FROM mqtt_events
WHERE camera_id IS NOT NULL
ON CONFLICT (camera_id) DO NOTHING;

-- 2. Create live_camera_state (Empty State)
CREATE TABLE IF NOT EXISTS live_camera_state (
    camera_id TEXT PRIMARY KEY, -- Matching camera_master

    -- CROWD
    crowd_count INT,
    crowd_state TEXT,
    crowd_last_time TIMESTAMPTZ,

    -- TRAFFIC
    vehicle_count INT,
    traffic_state TEXT,
    traffic_last_time TIMESTAMPTZ,

    -- PARKING
    parking_occupancy INT,
    parking_capacity INT,
    parking_state TEXT,
    parking_last_time TIMESTAMPTZ,

    -- SECURITY
    security_state TEXT,
    security_last_time TIMESTAMPTZ,

    last_event_time TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Initialize rows
INSERT INTO live_camera_state (camera_id)
SELECT camera_id FROM camera_master
ON CONFLICT (camera_id) DO NOTHING;
