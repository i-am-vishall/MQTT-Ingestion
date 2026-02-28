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
