-- Backfill camera_name in anpr_event_fact from camera_master
UPDATE anpr_event_fact f
SET camera_name = m.camera_name
FROM camera_master m
WHERE f.camera_id = m.camera_id
AND f.camera_name IS NULL;

-- Log the result (implicitly handled by command output)
