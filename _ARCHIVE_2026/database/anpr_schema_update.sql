-- ANPR Event Fact Table (Layer 2)
CREATE TABLE IF NOT EXISTS anpr_event_fact (
  id BIGSERIAL PRIMARY KEY,
  event_time timestamptz NOT NULL,
  camera_id text NOT NULL,
  plate_number text NOT NULL,
  vehicle_type text,
  vehicle_color text,
  vehicle_make text,
  is_violation boolean NOT NULL DEFAULT false,
  violation_types text[],
  speed numeric
);

CREATE INDEX IF NOT EXISTS idx_anpr_fact_time ON anpr_event_fact (event_time);
CREATE INDEX IF NOT EXISTS idx_anpr_fact_camera ON anpr_event_fact (camera_id);
CREATE INDEX IF NOT EXISTS idx_anpr_fact_violation ON anpr_event_fact (is_violation);

-- ANPR Metrics 1 Minute Layer 3
CREATE TABLE IF NOT EXISTS anpr_metrics_1min (
  bucket_time timestamptz NOT NULL,
  camera_id text NOT NULL,
  anpr_count integer NOT NULL,
  PRIMARY KEY (bucket_time, camera_id)
);
CREATE INDEX IF NOT EXISTS idx_anpr_metrics_time ON anpr_metrics_1min (bucket_time);

CREATE TABLE IF NOT EXISTS anpr_violation_metrics_1min (
  bucket_time timestamptz NOT NULL,
  violation_type text NOT NULL,
  violation_count integer NOT NULL,
  PRIMARY KEY (bucket_time, violation_type)
);
CREATE INDEX IF NOT EXISTS idx_anpr_violation_metrics_time ON anpr_violation_metrics_1min (bucket_time);
