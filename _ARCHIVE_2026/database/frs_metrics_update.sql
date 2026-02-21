-- Add Gender Count Columns to FRS Metrics
ALTER TABLE frs_metrics_1min ADD COLUMN IF NOT EXISTS male_count INT DEFAULT 0;
ALTER TABLE frs_metrics_1min ADD COLUMN IF NOT EXISTS female_count INT DEFAULT 0;
