-- Transaction Start
BEGIN;

-- 1. Rename old table to legacy
-- Safe check: ensure we haven't already renamed it
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mqtt_events') THEN
        ALTER TABLE mqtt_events RENAME TO mqtt_events_legacy;
    END IF;
END
$$;

-- 2. Create Sequence for New Table
-- We create a dedicated sequence so we don't conflict with the legacy one
CREATE SEQUENCE IF NOT EXISTS mqtt_events_partitioned_seq;

-- 3. Create Parent Partitioned Table
CREATE TABLE IF NOT EXISTS mqtt_events (
    id          BIGINT DEFAULT nextval('mqtt_events_partitioned_seq'),
    event_time  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    camera_id   TEXT,
    event_type  TEXT,
    severity    TEXT,
    payload     JSONB NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    -- Partitioning requires PK to include partition key
    PRIMARY KEY (id, event_time)
) PARTITION BY RANGE (event_time);

-- 4. Create Partitions (Monthly Strategy)
-- Adjust years as needed. 
CREATE TABLE IF NOT EXISTS mqtt_events_default PARTITION OF mqtt_events DEFAULT;

CREATE TABLE IF NOT EXISTS mqtt_events_2024_11 PARTITION OF mqtt_events FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');
CREATE TABLE IF NOT EXISTS mqtt_events_2024_12 PARTITION OF mqtt_events FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');

CREATE TABLE IF NOT EXISTS mqtt_events_2025_01 PARTITION OF mqtt_events FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE IF NOT EXISTS mqtt_events_2025_02 PARTITION OF mqtt_events FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE IF NOT EXISTS mqtt_events_2025_03 PARTITION OF mqtt_events FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE IF NOT EXISTS mqtt_events_2025_04 PARTITION OF mqtt_events FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE IF NOT EXISTS mqtt_events_2025_05 PARTITION OF mqtt_events FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE IF NOT EXISTS mqtt_events_2025_06 PARTITION OF mqtt_events FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE IF NOT EXISTS mqtt_events_2025_07 PARTITION OF mqtt_events FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE IF NOT EXISTS mqtt_events_2025_08 PARTITION OF mqtt_events FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE IF NOT EXISTS mqtt_events_2025_09 PARTITION OF mqtt_events FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE IF NOT EXISTS mqtt_events_2025_10 PARTITION OF mqtt_events FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE IF NOT EXISTS mqtt_events_2025_11 PARTITION OF mqtt_events FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE IF NOT EXISTS mqtt_events_2025_12 PARTITION OF mqtt_events FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- 5. Create Indexes
-- Note: In PG11, creating index on Parent propagates to partitions.
CREATE INDEX IF NOT EXISTS idx_mqtt_events_time ON mqtt_events (event_time DESC);
CREATE INDEX IF NOT EXISTS idx_mqtt_events_camera ON mqtt_events (camera_id);
CREATE INDEX IF NOT EXISTS idx_mqtt_events_type ON mqtt_events (event_type);

-- CUSTOM: JSON Key Indexes
-- Indexing specific keys inside the JSONB payload for speed
CREATE INDEX IF NOT EXISTS idx_mqtt_events_device_ip ON mqtt_events ((payload->>'deviceIp'));
CREATE INDEX IF NOT EXISTS idx_mqtt_events_device_name ON mqtt_events ((payload->>'name'));

-- 6. Migrate Data
-- Copy from legacy to new partitioned table
INSERT INTO mqtt_events (id, event_time, camera_id, event_type, severity, payload, created_at)
SELECT id, event_time, camera_id, event_type, severity, payload, created_at FROM mqtt_events_legacy;

-- 7. Sync Sequence
-- Ensure the new sequence starts after the max id from the old data
SELECT setval('mqtt_events_partitioned_seq', (SELECT MAX(id) FROM mqtt_events_legacy));

COMMIT;
