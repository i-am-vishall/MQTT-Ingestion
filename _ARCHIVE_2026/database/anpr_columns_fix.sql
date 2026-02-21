-- Add missing columns to anpr_event_fact
ALTER TABLE anpr_event_fact ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE anpr_event_fact ADD COLUMN IF NOT EXISTS source_name TEXT;
ALTER TABLE anpr_event_fact ADD COLUMN IF NOT EXISTS source_id TEXT;
ALTER TABLE anpr_event_fact ADD COLUMN IF NOT EXISTS source_ip TEXT;
ALTER TABLE anpr_event_fact ADD COLUMN IF NOT EXISTS camera_name TEXT;

-- Create index for camera_name if needed
CREATE INDEX IF NOT EXISTS idx_anpr_fact_cameraname ON anpr_event_fact (camera_name);

-- Ensure columns are nullable to prevent ingestion errors
ALTER TABLE anpr_event_fact ALTER COLUMN source_id DROP NOT NULL;
ALTER TABLE anpr_event_fact ALTER COLUMN source_ip DROP NOT NULL;
ALTER TABLE anpr_event_fact ALTER COLUMN camera_name DROP NOT NULL;
