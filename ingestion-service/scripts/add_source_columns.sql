-- Add source_id and source_ip columns to anpr_event_fact
-- source_id: Stable, logical identity (e.g. 'ANPR_VMS_HARIDWAR_01'), REQUIRED
-- source_ip: Informational network address, Optional

ALTER TABLE anpr_event_fact
ADD COLUMN IF NOT EXISTS source_id TEXT NOT NULL DEFAULT 'UNKNOWN_SOURCE',
ADD COLUMN IF NOT EXISTS source_ip INET;
