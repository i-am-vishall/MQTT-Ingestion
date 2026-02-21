-- Relax constraints on FRS table
ALTER TABLE frs_event_fact ALTER COLUMN camera_name DROP NOT NULL;
ALTER TABLE frs_event_fact ALTER COLUMN person_name DROP NOT NULL;
ALTER TABLE frs_event_fact ALTER COLUMN gender DROP NOT NULL;
ALTER TABLE frs_event_fact ALTER COLUMN age DROP NOT NULL;
