-- Phase 2: Event Classification Rules

CREATE TABLE IF NOT EXISTS event_classification_rules (
    rule_id SERIAL PRIMARY KEY,
    match_field TEXT,     -- taskName / alertType
    match_value TEXT,
    domain TEXT,          -- CROWD / TRAFFIC / PARKING / SECURITY
    enabled BOOLEAN DEFAULT true
);

-- Idempotent insert: only insert if not exists
INSERT INTO event_classification_rules (match_field, match_value, domain)
SELECT 'taskName', 'CROWD_DETECTION', 'CROWD'
WHERE NOT EXISTS (SELECT 1 FROM event_classification_rules WHERE match_value = 'CROWD_DETECTION');

INSERT INTO event_classification_rules (match_field, match_value, domain)
SELECT 'taskName', 'QUEUE_DETECTION', 'CROWD'
WHERE NOT EXISTS (SELECT 1 FROM event_classification_rules WHERE match_value = 'QUEUE_DETECTION');

INSERT INTO event_classification_rules (match_field, match_value, domain)
SELECT 'taskName', 'AUTOMATIC_TRAFFIC_COUNTING_AND_CLASSIFICATION', 'TRAFFIC'
WHERE NOT EXISTS (SELECT 1 FROM event_classification_rules WHERE match_value = 'AUTOMATIC_TRAFFIC_COUNTING_AND_CLASSIFICATION');

INSERT INTO event_classification_rules (match_field, match_value, domain)
SELECT 'alertType', 'Vehicle_Occupancy', 'TRAFFIC'
WHERE NOT EXISTS (SELECT 1 FROM event_classification_rules WHERE match_value = 'Vehicle_Occupancy');

INSERT INTO event_classification_rules (match_field, match_value, domain)
SELECT 'alertType', 'ANPR', 'TRAFFIC'
WHERE NOT EXISTS (SELECT 1 FROM event_classification_rules WHERE match_value = 'ANPR');

INSERT INTO event_classification_rules (match_field, match_value, domain)
SELECT 'taskName', 'INTRUSION_DETECTION', 'SECURITY'
WHERE NOT EXISTS (SELECT 1 FROM event_classification_rules WHERE match_value = 'INTRUSION_DETECTION');
