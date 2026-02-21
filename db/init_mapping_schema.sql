-- =============================================================
-- TABLE: payload_schema_mappings
-- =============================================================
CREATE TABLE IF NOT EXISTS public.payload_schema_mappings (
    id SERIAL PRIMARY KEY,
    mapping_name TEXT UNIQUE NOT NULL, -- e.g. "Hikvision FRS", "Dahua ANPR"
    event_type TEXT NOT NULL,         -- e.g. "Face_Recognition", "ANPR"
    mapping_config JSONB NOT NULL,    -- The mapping: {"db_column": "json_path"}
    identification_criteria JSONB,     -- Criteria to auto-select this mapping: {"vendor": "hikvision"}
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    locked BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_mapping_event_type ON public.payload_schema_mappings (event_type);
