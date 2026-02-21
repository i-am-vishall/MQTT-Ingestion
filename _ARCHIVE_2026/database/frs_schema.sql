-- FRS Event Fact Table (Layer 2)
CREATE TABLE IF NOT EXISTS frs_event_fact (
    id BIGSERIAL PRIMARY KEY,
    event_time TIMESTAMPTZ NOT NULL,
    camera_id TEXT NOT NULL,
    camera_name TEXT,
    
    person_id TEXT, -- trackId or unique ID
    person_name TEXT,
    gender TEXT,
    age INT,
    
    match_id TEXT,
    track_id TEXT,
    
    det_conf NUMERIC,
    rec_conf NUMERIC,
    
    face_image_path TEXT, -- From properties.faceImg (relative path)
    
    is_authorized BOOLEAN DEFAULT false, -- Logic TBD, maybe checking list?
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_frs_fact_time ON frs_event_fact (event_time);
CREATE INDEX IF NOT EXISTS idx_frs_fact_camera ON frs_event_fact (camera_id);
CREATE INDEX IF NOT EXISTS idx_frs_fact_name ON frs_event_fact (person_name);

-- FRS Metrics 1 Minute (Layer 3)
CREATE TABLE IF NOT EXISTS frs_metrics_1min (
    bucket_time TIMESTAMPTZ NOT NULL,
    camera_id TEXT NOT NULL,
    
    total_faces INT DEFAULT 0,
    unique_persons INT DEFAULT 0, -- Approximation if needed
    male_count INT DEFAULT 0,
    female_count INT DEFAULT 0,
    
    PRIMARY KEY (bucket_time, camera_id)
);

CREATE INDEX IF NOT EXISTS idx_frs_metrics_time ON frs_metrics_1min (bucket_time);
