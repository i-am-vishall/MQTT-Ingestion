-- =============================================================
-- MIGRATION: Add event_hash for idempotent inserts
-- 
-- Purpose: Prevent duplicate rows when messages are replayed
-- from Redis Stream (after worker crash or DLQ replay).
--
-- Run this ONCE on your existing database before deploying
-- the new ingestion code.
-- =============================================================

-- 1. Add event_hash column to mqtt_events
ALTER TABLE public.mqtt_events ADD COLUMN IF NOT EXISTS event_hash TEXT;

-- 2. Create dedup index on mqtt_events (partial — only recent data)
-- This makes ON CONFLICT work while keeping index overhead low
CREATE UNIQUE INDEX IF NOT EXISTS idx_mqtt_events_dedup
    ON public.mqtt_events (event_hash, event_time)
    WHERE event_hash IS NOT NULL;

-- 3. Add event_hash column to frs_event_fact
ALTER TABLE public.frs_event_fact ADD COLUMN IF NOT EXISTS event_hash TEXT;

-- 4. Create dedup index on frs_event_fact
CREATE UNIQUE INDEX IF NOT EXISTS idx_frs_dedup
    ON public.frs_event_fact (event_hash)
    WHERE event_hash IS NOT NULL;

-- 5. anpr_event_fact already has dedup via:
--    UNIQUE INDEX idx_anpr_deduplication (plate_number, camera_id, event_10s_bucket)
--    No changes needed.

-- =============================================================
-- VERIFICATION: Run these to confirm migration applied
-- =============================================================
-- SELECT column_name FROM information_schema.columns 
--     WHERE table_name = 'mqtt_events' AND column_name = 'event_hash';
-- SELECT column_name FROM information_schema.columns 
--     WHERE table_name = 'frs_event_fact' AND column_name = 'event_hash';
-- SELECT indexname FROM pg_indexes 
--     WHERE indexname IN ('idx_mqtt_events_dedup', 'idx_frs_dedup');
