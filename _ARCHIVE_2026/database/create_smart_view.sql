
CREATE OR REPLACE VIEW vw_live_dashboard AS
SELECT
    camera_id,
    camera_name,
    source_type,
    updated_at,

    -- 1. Dynamic Connectivity Status (Global 2 min TTL)
    CASE 
        WHEN last_event_time >= NOW() - INTERVAL '2 minutes' THEN 'ONLINE'
        ELSE 'OFFLINE'
    END AS camera_status,

    -- 2. Crowd Domain (TTL: 2 min)
    CASE 
        WHEN crowd_last_time >= NOW() - INTERVAL '2 minutes' THEN crowd_count 
        ELSE NULL 
    END as crowd_count,
    CASE 
        WHEN crowd_last_time >= NOW() - INTERVAL '2 minutes' THEN crowd_state
        ELSE 'UNKNOWN' 
    END as crowd_state,

    -- 3. Traffic Domain (TTL: 2 min)
    CASE 
        WHEN traffic_last_time >= NOW() - INTERVAL '2 minutes' THEN vehicle_count
        ELSE NULL 
    END as vehicle_count,
    CASE
        WHEN traffic_last_time >= NOW() - INTERVAL '2 minutes' THEN traffic_state
        ELSE 'UNKNOWN'
    END as traffic_state,
    
    -- 4. Parking Domain (TTL: 5 min)
    CASE
        WHEN parking_last_time >= NOW() - INTERVAL '5 minutes' THEN parking_occupancy
        ELSE NULL
    END as parking_occupancy,
    CASE
        WHEN parking_last_time >= NOW() - INTERVAL '5 minutes' THEN parking_state
        ELSE 'UNKNOWN'
    END as parking_state,

    -- 5. Security Domain (TTL: 1 minute - Critical)
    CASE
        WHEN security_last_time >= NOW() - INTERVAL '1 minute' THEN security_state
        ELSE NULL 
    END as security_state

FROM live_camera_state;
