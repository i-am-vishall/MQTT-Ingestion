-- Add geospatial columns to camera_master
ALTER TABLE camera_master
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Backfill from mqtt_events
WITH latest_coords AS (
    SELECT DISTINCT ON (camera_id)
        camera_id,
        (payload->'ExtraDetails'->>'Latitude')::double precision as lat,
        (payload->'ExtraDetails'->>'Longitude')::double precision as lon
    FROM mqtt_events
    WHERE payload->'ExtraDetails'->>'Latitude' IS NOT NULL
    ORDER BY camera_id, event_time DESC
)
UPDATE camera_master m
SET latitude = lc.lat, longitude = lc.lon
FROM latest_coords lc
WHERE m.camera_id = lc.camera_id
  AND m.latitude IS NULL;
