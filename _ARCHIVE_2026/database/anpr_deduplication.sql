-- ANPR Deduplication (Postgres 11 Compatible)
-- Replaces Generated Column with Trigger AND Cleans Duplicates

-- 1. Add Column (Standard)
ALTER TABLE anpr_event_fact
ADD COLUMN IF NOT EXISTS event_10s_bucket BIGINT;

-- 2. Create Trigger Function
CREATE OR REPLACE FUNCTION calc_anpr_bucket() RETURNS TRIGGER AS $$
BEGIN
    NEW.event_10s_bucket := (EXTRACT(EPOCH FROM NEW.event_time)::BIGINT / 10);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create Trigger
DROP TRIGGER IF EXISTS trg_anpr_bucket ON anpr_event_fact;
CREATE TRIGGER trg_anpr_bucket
BEFORE INSERT OR UPDATE ON anpr_event_fact
FOR EACH ROW EXECUTE PROCEDURE calc_anpr_bucket();

-- 4. Backfill Existing Data
UPDATE anpr_event_fact 
SET event_10s_bucket = (EXTRACT(EPOCH FROM event_time)::BIGINT / 10) 
WHERE event_10s_bucket IS NULL;

-- 4.5. Clean Duplicates (Keep one per bucket)
DELETE FROM anpr_event_fact
WHERE ctid NOT IN (
    SELECT MIN(ctid)
    FROM anpr_event_fact
    GROUP BY plate_number, camera_id, event_10s_bucket
);

-- 5. Create Unique Index
DROP INDEX IF EXISTS uniq_anpr_dedup;
CREATE UNIQUE INDEX uniq_anpr_dedup 
ON anpr_event_fact (plate_number, camera_id, event_10s_bucket);
