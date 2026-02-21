-- Add camera_name column to anpr_event_fact and mqtt_events
ALTER TABLE anpr_event_fact
ADD COLUMN IF NOT EXISTS camera_name TEXT;

ALTER TABLE mqtt_events
ADD COLUMN IF NOT EXISTS camera_name TEXT;

-- Optional: Index for performance if likely to filter by name
CREATE INDEX IF NOT EXISTS idx_anpr_camera_name ON anpr_event_fact(camera_name);
