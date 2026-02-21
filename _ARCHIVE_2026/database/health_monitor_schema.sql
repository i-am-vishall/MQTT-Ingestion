
CREATE TABLE IF NOT EXISTS source_health_status (
    source_ip TEXT PRIMARY KEY,
    source_id TEXT,
    last_event_time TIMESTAMPTZ,
    status TEXT CHECK (status IN ('ONLINE', 'OFFLINE')),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
