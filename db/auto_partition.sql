CREATE OR REPLACE FUNCTION public.create_next_month_partition()
RETURNS void AS $$
DECLARE
    next_month DATE;
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
    create_stmt TEXT;
BEGIN
    -- Calculate the first day of next month
    next_month := date_trunc('month', CURRENT_DATE + interval '1 month')::DATE;
    start_date := next_month;
    end_date := next_month + interval '1 month';
    
    -- Define the partition table name: mqtt_events_YYYY_MM
    partition_name := 'mqtt_events_' || to_char(next_month, 'YYYY_MM');
    
    -- Check if the partition already exists in the database
    IF NOT EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = partition_name
          AND n.nspname = 'public'
    ) THEN
        -- Safely map this partition range to the main 'mqtt_events' table
        create_stmt := format(
            'CREATE TABLE public.%I PARTITION OF public.mqtt_events FOR VALUES FROM (%L) TO (%L);',
            partition_name, start_date, end_date
        );
        EXECUTE create_stmt;
        RAISE NOTICE 'SUCCESS: Created auto-partition % for dates % to %', partition_name, start_date, end_date;
        
    ELSE
        RAISE NOTICE 'PASS: Partition % already exists. No action needed.', partition_name;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Execute the function to dynamically generate next month's tables
SELECT public.create_next_month_partition();

-- =============================================================
-- AUTOMATIC DATA RETENTION (30 DAYS)
-- =============================================================
CREATE OR REPLACE FUNCTION public.cleanup_old_data_30_days()
RETURNS void AS $$
DECLARE
    retention_interval INTERVAL := '30 days';
    deleted_rows INTEGER;
BEGIN
    RAISE NOTICE 'Starting data cleanup for entries older than 30 days...';

    -- Core Events
    DELETE FROM public.mqtt_events WHERE event_time < NOW() - retention_interval;
    GET DIAGNOSTICS deleted_rows = ROW_COUNT;
    RAISE NOTICE 'Deleted % rows from mqtt_events', deleted_rows;

    -- Fact Tables
    DELETE FROM public.anpr_event_fact WHERE event_time < NOW() - retention_interval;
    DELETE FROM public.frs_event_fact WHERE event_time < NOW() - retention_interval;
    
    -- Try deleting from optional tables (will silently ignore if they don't exist yet)
    BEGIN DELETE FROM public.atcc_event_fact WHERE event_time < NOW() - retention_interval; EXCEPTION WHEN OTHERS THEN END;
    BEGIN DELETE FROM public.vehicle_occupancy_fact WHERE event_time < NOW() - retention_interval; EXCEPTION WHEN OTHERS THEN END;
    BEGIN DELETE FROM public.vids_event_fact WHERE event_time < NOW() - retention_interval; EXCEPTION WHEN OTHERS THEN END;

    -- Metrics Tables
    BEGIN DELETE FROM public.camera_metrics_1min WHERE bucket_time < NOW() - retention_interval; EXCEPTION WHEN OTHERS THEN END;
    BEGIN DELETE FROM public.anpr_metrics_1min WHERE bucket_time < NOW() - retention_interval; EXCEPTION WHEN OTHERS THEN END;
    BEGIN DELETE FROM public.anpr_violation_metrics_1min WHERE bucket_time < NOW() - retention_interval; EXCEPTION WHEN OTHERS THEN END;
    BEGIN DELETE FROM public.frs_metrics_1min WHERE bucket_time < NOW() - retention_interval; EXCEPTION WHEN OTHERS THEN END;

    -- Drop partitions older than 2 months for good measure (cleanup empty partitions)
    DECLARE
        old_partition TEXT := 'mqtt_events_' || to_char(CURRENT_DATE - interval '2 months', 'YYYY_MM');
    BEGIN
        IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = old_partition AND n.nspname = 'public') THEN
            EXECUTE 'DROP TABLE IF EXISTS public.' || old_partition;
            RAISE NOTICE 'Dropped old partition %', old_partition;
        END IF;
    EXCEPTION WHEN OTHERS THEN END;
    
    RAISE NOTICE 'Data cleanup complete.';
END;
$$ LANGUAGE plpgsql;

-- Execute the cleanup function
SELECT public.cleanup_old_data_30_days();
