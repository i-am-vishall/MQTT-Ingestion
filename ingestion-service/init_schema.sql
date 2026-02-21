-- =============================================================
-- I2V MQTT Ingestion System - Complete Database Schema
-- Version: 2.0 (Production Ready)
-- Compatible with PostgreSQL 11+
-- =============================================================

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;
SET default_tablespace = '';
SET default_with_oids = false;

-- =============================================================
-- Create Database (Safe - only if not exists)
-- =============================================================
-- Note: Run this separately if needed:
-- CREATE DATABASE mqtt_alerts_db;

-- =============================================================
-- FUNCTION: ANPR Bucket Time Calculator
-- =============================================================
CREATE OR REPLACE FUNCTION public.set_anpr_bucket_time() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.event_10s_bucket := to_timestamp(floor(extract(epoch from NEW.event_time) / 10) * 10);
    RETURN NEW;
END;
$$;

-- =============================================================
-- TABLE: mqtt_events (Core Event Store)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.mqtt_events (
    id BIGSERIAL,
    event_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    camera_id TEXT,
    event_type TEXT,
    severity TEXT,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    source_ip TEXT,
    camera_name TEXT,
    source_id TEXT,
    PRIMARY KEY (id, event_time)
) PARTITION BY RANGE (event_time);

-- Default partition (catches any dates not covered)
CREATE TABLE IF NOT EXISTS public.mqtt_events_default PARTITION OF public.mqtt_events DEFAULT;

-- 2024 Partitions
CREATE TABLE IF NOT EXISTS public.mqtt_events_2024_11 PARTITION OF public.mqtt_events 
    FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');
CREATE TABLE IF NOT EXISTS public.mqtt_events_2024_12 PARTITION OF public.mqtt_events 
    FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');

-- 2025 Partitions
CREATE TABLE IF NOT EXISTS public.mqtt_events_2025_01 PARTITION OF public.mqtt_events 
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE IF NOT EXISTS public.mqtt_events_2025_02 PARTITION OF public.mqtt_events 
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE IF NOT EXISTS public.mqtt_events_2025_03 PARTITION OF public.mqtt_events 
    FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE IF NOT EXISTS public.mqtt_events_2025_04 PARTITION OF public.mqtt_events 
    FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE IF NOT EXISTS public.mqtt_events_2025_05 PARTITION OF public.mqtt_events 
    FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE IF NOT EXISTS public.mqtt_events_2025_06 PARTITION OF public.mqtt_events 
    FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE IF NOT EXISTS public.mqtt_events_2025_07 PARTITION OF public.mqtt_events 
    FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE IF NOT EXISTS public.mqtt_events_2025_08 PARTITION OF public.mqtt_events 
    FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE IF NOT EXISTS public.mqtt_events_2025_09 PARTITION OF public.mqtt_events 
    FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE IF NOT EXISTS public.mqtt_events_2025_10 PARTITION OF public.mqtt_events 
    FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE IF NOT EXISTS public.mqtt_events_2025_11 PARTITION OF public.mqtt_events 
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE IF NOT EXISTS public.mqtt_events_2025_12 PARTITION OF public.mqtt_events 
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- 2026 Partitions
CREATE TABLE IF NOT EXISTS public.mqtt_events_2026_01 PARTITION OF public.mqtt_events 
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE IF NOT EXISTS public.mqtt_events_2026_02 PARTITION OF public.mqtt_events 
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE IF NOT EXISTS public.mqtt_events_2026_03 PARTITION OF public.mqtt_events 
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE IF NOT EXISTS public.mqtt_events_2026_04 PARTITION OF public.mqtt_events 
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE IF NOT EXISTS public.mqtt_events_2026_05 PARTITION OF public.mqtt_events 
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS public.mqtt_events_2026_06 PARTITION OF public.mqtt_events 
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS public.mqtt_events_2026_07 PARTITION OF public.mqtt_events 
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS public.mqtt_events_2026_08 PARTITION OF public.mqtt_events 
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE IF NOT EXISTS public.mqtt_events_2026_09 PARTITION OF public.mqtt_events 
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS public.mqtt_events_2026_10 PARTITION OF public.mqtt_events 
    FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE IF NOT EXISTS public.mqtt_events_2026_11 PARTITION OF public.mqtt_events 
    FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE IF NOT EXISTS public.mqtt_events_2026_12 PARTITION OF public.mqtt_events 
    FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- Indexes for mqtt_events
CREATE INDEX IF NOT EXISTS idx_mqtt_events_time ON public.mqtt_events (event_time DESC);
CREATE INDEX IF NOT EXISTS idx_mqtt_events_camera ON public.mqtt_events (camera_id);
CREATE INDEX IF NOT EXISTS idx_mqtt_events_type ON public.mqtt_events (event_type);

-- =============================================================
-- TABLE: camera_master (Camera Registry)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.camera_master (
    camera_id TEXT PRIMARY KEY,
    camera_name TEXT,
    location TEXT,
    camera_type TEXT,
    is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_camera_master_name ON public.camera_master (camera_name);

-- =============================================================
-- TABLE: live_camera_state (Real-time State)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.live_camera_state (
    camera_id TEXT PRIMARY KEY,
    crowd_count INTEGER,
    crowd_state TEXT,
    crowd_last_time TIMESTAMPTZ,
    vehicle_count INTEGER,
    traffic_state TEXT,
    traffic_last_time TIMESTAMPTZ,
    parking_occupancy INTEGER,
    parking_capacity INTEGER,
    parking_state TEXT,
    parking_last_time TIMESTAMPTZ,
    security_state TEXT,
    security_last_time TIMESTAMPTZ,
    last_event_time TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT now(),
    camera_name TEXT,
    source_id TEXT,
    source_type TEXT
);

-- =============================================================
-- TABLE: event_classification_rules
-- =============================================================
CREATE TABLE IF NOT EXISTS public.event_classification_rules (
    rule_id SERIAL PRIMARY KEY,
    match_field TEXT,
    match_value TEXT,
    domain TEXT,
    enabled BOOLEAN DEFAULT true
);

-- Default Classification Rules (Idempotent)
INSERT INTO public.event_classification_rules (match_field, match_value, domain)
SELECT 'taskName', 'CROWD_DETECTION', 'CROWD'
WHERE NOT EXISTS (SELECT 1 FROM public.event_classification_rules WHERE match_value = 'CROWD_DETECTION');

INSERT INTO public.event_classification_rules (match_field, match_value, domain)
SELECT 'taskName', 'QUEUE_DETECTION', 'CROWD'
WHERE NOT EXISTS (SELECT 1 FROM public.event_classification_rules WHERE match_value = 'QUEUE_DETECTION');

INSERT INTO public.event_classification_rules (match_field, match_value, domain)
SELECT 'taskName', 'AUTOMATIC_TRAFFIC_COUNTING_AND_CLASSIFICATION', 'TRAFFIC'
WHERE NOT EXISTS (SELECT 1 FROM public.event_classification_rules WHERE match_value = 'AUTOMATIC_TRAFFIC_COUNTING_AND_CLASSIFICATION');

INSERT INTO public.event_classification_rules (match_field, match_value, domain)
SELECT 'alertType', 'Vehicle_Occupancy', 'TRAFFIC'
WHERE NOT EXISTS (SELECT 1 FROM public.event_classification_rules WHERE match_value = 'Vehicle_Occupancy');

INSERT INTO public.event_classification_rules (match_field, match_value, domain)
SELECT 'alertType', 'ANPR', 'TRAFFIC'
WHERE NOT EXISTS (SELECT 1 FROM public.event_classification_rules WHERE match_value = 'ANPR');

INSERT INTO public.event_classification_rules (match_field, match_value, domain)
SELECT 'taskName', 'INTRUSION_DETECTION', 'SECURITY'
WHERE NOT EXISTS (SELECT 1 FROM public.event_classification_rules WHERE match_value = 'INTRUSION_DETECTION');

-- =============================================================
-- TABLE: anpr_event_fact (ANPR Layer 2)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.anpr_event_fact (
    id BIGSERIAL PRIMARY KEY,
    event_time TIMESTAMPTZ NOT NULL,
    camera_id TEXT NOT NULL,
    plate_number TEXT NOT NULL,
    vehicle_type TEXT,
    vehicle_color TEXT,
    vehicle_make TEXT,
    is_violation BOOLEAN NOT NULL DEFAULT false,
    violation_types TEXT[],
    speed NUMERIC,
    source_type TEXT,
    source_name TEXT,
    source_id TEXT,
    source_ip TEXT,
    camera_name TEXT,
    event_10s_bucket TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_anpr_fact_time ON public.anpr_event_fact (event_time);
CREATE INDEX IF NOT EXISTS idx_anpr_fact_camera ON public.anpr_event_fact (camera_id);

-- ANPR Deduplication Trigger
DROP TRIGGER IF EXISTS trigger_set_anpr_bucket ON public.anpr_event_fact;
CREATE TRIGGER trigger_set_anpr_bucket 
    BEFORE INSERT OR UPDATE ON public.anpr_event_fact 
    FOR EACH ROW EXECUTE PROCEDURE public.set_anpr_bucket_time();

-- Unique index for deduplication (safe create)
CREATE UNIQUE INDEX IF NOT EXISTS idx_anpr_deduplication 
    ON public.anpr_event_fact (plate_number, camera_id, event_10s_bucket);

-- =============================================================
-- TABLE: anpr_metrics_1min (ANPR Layer 3)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.anpr_metrics_1min (
    bucket_time TIMESTAMPTZ NOT NULL,
    camera_id TEXT NOT NULL,
    anpr_count INTEGER NOT NULL,
    PRIMARY KEY (bucket_time, camera_id)
);

CREATE INDEX IF NOT EXISTS idx_anpr_metrics_time ON public.anpr_metrics_1min (bucket_time);

-- =============================================================
-- TABLE: anpr_violation_metrics_1min
-- =============================================================
CREATE TABLE IF NOT EXISTS public.anpr_violation_metrics_1min (
    bucket_time TIMESTAMPTZ NOT NULL,
    violation_type TEXT NOT NULL,
    violation_count INTEGER NOT NULL,
    PRIMARY KEY (bucket_time, violation_type)
);

CREATE INDEX IF NOT EXISTS idx_anpr_violation_metrics_time ON public.anpr_violation_metrics_1min (bucket_time);

-- =============================================================
-- TABLE: camera_metrics_1min (General Metrics Layer 3)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.camera_metrics_1min (
    bucket_time TIMESTAMPTZ,
    camera_id TEXT,
    crowd_count INTEGER,
    vehicle_count INTEGER,
    parking_occupancy INTEGER,
    traffic_state TEXT,
    crowd_state TEXT,
    parking_state TEXT,
    PRIMARY KEY (bucket_time, camera_id)
);

CREATE INDEX IF NOT EXISTS idx_camera_metrics_time ON public.camera_metrics_1min (bucket_time);

-- =============================================================
-- TABLE: frs_event_fact (FRS Layer 2)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.frs_event_fact (
    id BIGSERIAL PRIMARY KEY,
    event_time TIMESTAMPTZ NOT NULL,
    camera_id TEXT NOT NULL,
    camera_name TEXT,
    person_id TEXT,
    person_name TEXT,
    gender TEXT,
    age INTEGER,
    match_id TEXT,
    track_id TEXT,
    det_conf NUMERIC,
    rec_conf NUMERIC,
    face_image_path TEXT,
    is_authorized BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_frs_fact_time ON public.frs_event_fact (event_time);
CREATE INDEX IF NOT EXISTS idx_frs_fact_camera ON public.frs_event_fact (camera_id);
CREATE INDEX IF NOT EXISTS idx_frs_fact_name ON public.frs_event_fact (person_name);

-- =============================================================
-- TABLE: frs_metrics_1min (FRS Layer 3)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.frs_metrics_1min (
    bucket_time TIMESTAMPTZ NOT NULL,
    camera_id TEXT NOT NULL,
    total_faces INTEGER DEFAULT 0,
    unique_persons INTEGER DEFAULT 0,
    male_count INTEGER DEFAULT 0,
    female_count INTEGER DEFAULT 0,
    PRIMARY KEY (bucket_time, camera_id)
);

CREATE INDEX IF NOT EXISTS idx_frs_metrics_time ON public.frs_metrics_1min (bucket_time);

-- =============================================================
-- TABLE: source_health_status
-- =============================================================
CREATE TABLE IF NOT EXISTS public.source_health_status (
    source_ip TEXT PRIMARY KEY,
    source_id TEXT,
    last_event_time TIMESTAMPTZ,
    status TEXT DEFAULT 'UNKNOWN',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- VIEW: vw_live_dashboard
-- =============================================================
CREATE OR REPLACE VIEW public.vw_live_dashboard AS
SELECT
    l.camera_id,
    l.camera_name,
    l.source_type,
    l.updated_at,
    CASE 
        WHEN l.last_event_time >= NOW() - INTERVAL '2 minutes' THEN 'ONLINE'
        ELSE 'OFFLINE'
    END AS camera_status,
    CASE 
        WHEN l.crowd_last_time >= NOW() - INTERVAL '2 minutes' THEN l.crowd_count 
        ELSE NULL 
    END as crowd_count,
    CASE 
        WHEN l.crowd_last_time >= NOW() - INTERVAL '2 minutes' THEN l.crowd_state
        ELSE 'UNKNOWN' 
    END as crowd_state,
    CASE 
        WHEN l.traffic_last_time >= NOW() - INTERVAL '2 minutes' THEN l.vehicle_count
        ELSE NULL 
    END as vehicle_count,
    CASE
        WHEN l.traffic_last_time >= NOW() - INTERVAL '2 minutes' THEN l.traffic_state
        ELSE 'UNKNOWN'
    END as traffic_state,
    CASE
        WHEN l.parking_last_time >= NOW() - INTERVAL '5 minutes' THEN l.parking_occupancy
        ELSE NULL
    END as parking_occupancy,
    CASE
        WHEN l.parking_last_time >= NOW() - INTERVAL '5 minutes' THEN l.parking_state
        ELSE 'UNKNOWN'
    END as parking_state,
    CASE
        WHEN l.security_last_time >= NOW() - INTERVAL '1 minute' THEN l.security_state
        ELSE NULL 
    END as security_state
FROM public.live_camera_state l;

-- =============================================================
-- VERIFICATION: Print Created Tables
-- =============================================================
DO $$
DECLARE
    tbl_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO tbl_count 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE';
    
    RAISE NOTICE '=== DATABASE INITIALIZATION COMPLETE ===';
    RAISE NOTICE 'Total tables created: %', tbl_count;
END $$;
