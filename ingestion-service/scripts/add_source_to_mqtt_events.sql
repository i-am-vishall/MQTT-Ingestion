-- Add source_id and source_ip columns to mqtt_events
ALTER TABLE mqtt_events
ADD COLUMN IF NOT EXISTS source_id TEXT,
ADD COLUMN IF NOT EXISTS source_ip INET;
