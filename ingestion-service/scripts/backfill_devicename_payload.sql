-- 1. Update anpr_event_fact from mqtt_events payloads
DO $$
DECLARE
    rows_updated integer;
BEGIN
    RAISE NOTICE 'Starting Backfill of DeviceNames...';
    
    WITH latest_names AS (
        SELECT DISTINCT ON (camera_id) 
            camera_id, 
            COALESCE(payload->>'DeviceName', payload->>'cameraName', payload->>'camera_name') as device_name
        FROM mqtt_events
        WHERE COALESCE(payload->>'DeviceName', payload->>'cameraName', payload->>'camera_name') IS NOT NULL
        ORDER BY camera_id, event_time DESC
    )
    UPDATE anpr_event_fact f
    SET camera_name = ln.device_name
    FROM latest_names ln
    WHERE f.camera_id = ln.camera_id
    AND (f.camera_name IS NULL OR f.camera_name = f.camera_id);
    
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RAISE NOTICE 'Updated % rows in anpr_event_fact', rows_updated;
    
    -- 2. Sync to Camera Master
    INSERT INTO camera_master (camera_id, camera_name)
    SELECT DISTINCT ON (camera_id) 
        camera_id, 
        COALESCE(payload->>'DeviceName', payload->>'cameraName', payload->>'camera_name')
    FROM mqtt_events
    WHERE COALESCE(payload->>'DeviceName', payload->>'cameraName', payload->>'camera_name') IS NOT NULL
    ORDER BY camera_id, event_time DESC
    ON CONFLICT (camera_id) 
    DO UPDATE SET camera_name = EXCLUDED.camera_name;
    
    RAISE NOTICE ' synced camera_master.';
END $$;
