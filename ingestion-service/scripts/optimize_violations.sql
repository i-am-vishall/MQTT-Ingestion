DO $$
DECLARE
    row_data RECORD;
BEGIN
    -- Loop through all partitions of mqtt_events
    FOR row_data IN 
        SELECT c.relname::text as pname
        FROM pg_class c
        JOIN pg_inherits i ON c.oid = i.inhrelid
        JOIN pg_class p ON i.inhparent = p.oid
        WHERE p.relname = 'mqtt_events'
    LOOP
        -- 1. Create GIN Index
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I_payload_gin ON %I USING GIN (payload jsonb_path_ops)', row_data.pname, row_data.pname);
        
        -- 2. Create PlateNumber Index
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I_plate_number ON %I ((payload->''properties''->>''PlateNumber''))', row_data.pname, row_data.pname);
        
        RAISE NOTICE 'Indexed partition: %', row_data.pname;
    END LOOP;
END $$;
