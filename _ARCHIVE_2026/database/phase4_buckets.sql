-- Phase 4: Create History (Buckets)

CREATE TABLE IF NOT EXISTS camera_metrics_1min (
    bucket_time TIMESTAMPTZ,
    camera_id TEXT, -- Changed to TEXT to match camera_master

    crowd_count INT,
    vehicle_count INT,
    parking_occupancy INT,

    traffic_state TEXT,
    crowd_state TEXT,
    parking_state TEXT,

    PRIMARY KEY (bucket_time, camera_id)
);

-- Index for efficient time-range queries on metrics
CREATE INDEX IF NOT EXISTS idx_camera_metrics_time ON camera_metrics_1min (bucket_time);
