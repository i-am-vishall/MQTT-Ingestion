-- Clean up ALL variations to match SourceType_IP format

-- 1. VMS Server (103.205.115.74)
-- Catches: 'Haridwar', 'VMS_...', AND incorrect 'ANPR_SOURCE_103_205_115_74'
UPDATE mqtt_events 
SET source_id = 'VMS_103_205_115_74' 
WHERE (source_id LIKE '%103_205_115_74%' OR source_id ILIKE '%Haridwar%')
AND source_id != 'VMS_103_205_115_74';

-- 2. ANPR Camera (103.205.114.241)
UPDATE mqtt_events 
SET source_id = 'ANPR_103_205_114_241' 
WHERE (source_id LIKE '%103_205_114_241%' OR source_id ILIKE '%ANPR%')
AND source_id != 'ANPR_103_205_114_241';
