-- =============================================================
-- Weekly Partitioning for mqtt_events
-- 
-- Replaces the monthly auto_partition.sql.
-- Weekly partitions = smaller indexes, faster vacuums,
-- and easier data retention management.
--
-- Schedule: Run via pg_cron or a weekly scheduled task (.bat)
-- =============================================================

CREATE OR REPLACE FUNCTION public.create_weekly_partitions()
RETURNS void AS $$
DECLARE
    target_date DATE;
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
BEGIN
    -- Create partitions for the next 4 weeks
    FOR i IN 0..3 LOOP
        target_date := date_trunc('week', CURRENT_DATE + (i * interval '1 week'))::DATE;
        start_date := target_date;
        end_date := target_date + interval '1 week';
        partition_name := 'mqtt_events_' || to_char(target_date, 'YYYY_"W"IW');

        IF NOT EXISTS (
            SELECT 1 FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relname = partition_name AND n.nspname = 'public'
        ) THEN
            EXECUTE format(
                'CREATE TABLE public.%I PARTITION OF public.mqtt_events FOR VALUES FROM (%L) TO (%L)',
                partition_name, start_date, end_date
            );
            RAISE NOTICE 'Created weekly partition: %', partition_name;
        ELSE
            RAISE NOTICE 'Partition % already exists', partition_name;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute immediately to create upcoming partitions
SELECT public.create_weekly_partitions();

-- NOTE: The old monthly function (create_next_month_partition) still works
-- for existing monthly partitions. New data will route to weekly partitions
-- as they cover more specific date ranges (weekly takes priority over monthly).
