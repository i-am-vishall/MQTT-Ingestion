# 🗄️ Database Bible — I2V MQTT Ingestion System
> Every table, column, index, trigger, view, and function — fully documented.

---

## Database Info
- **Engine:** PostgreSQL 15 (portable)
- **Port:** 5441 (non-default to avoid conflicts with system PG)
- **Database Name:** `mqtt_alerts_db`
- **Schema:** `public`
- **Timezone:** `Asia/Kolkata` (IST, forced per-connection)

---

## Table Overview

| Table | Purpose | Row Volume |
|-------|---------|-----------|
| `mqtt_events` | Raw event store (partitioned) | Very High (millions/month) |
| `anpr_event_fact` | Cleaned ANPR events | High |
| `frs_event_fact` | Face recognition events | Medium |
| `atcc_event_fact` | Vehicle classification counts | Medium |
| `vehicle_occupancy_fact` | Parking/occupancy events | Medium |
| `vids_event_fact` | Video incident events | Low-Medium |
| `live_camera_state` | Real-time camera state (1 row/camera) | Low (=num cameras) |
| `camera_master` | Camera registry | Low |
| `event_classification_rules` | Rules for domain routing | Very Low (static) |
| `payload_schema_mappings` | Vendor field mapping config | Very Low (static) |
| `camera_metrics_1min` | 1-min metric snapshots | High (grows with time) |
| `anpr_metrics_1min` | 1-min ANPR counts | High |
| `anpr_violation_metrics_1min` | 1-min violation breakdown | Medium |
| `frs_metrics_1min` | 1-min FRS counts | Medium |
| `source_health_status` | Broker/source online status | Very Low (=num sources) |

---

## mqtt_events — Core Event Store

```sql
CREATE TABLE public.mqtt_events (
    id          BIGSERIAL,
    event_time  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    camera_id   TEXT,
    event_type  TEXT,
    severity    TEXT,
    payload     JSONB NOT NULL,        -- Raw event payload (snapshot fields stripped)
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    source_ip   TEXT,                  -- IP of the MQTT broker this came from
    camera_name TEXT,
    source_id   TEXT,                  -- e.g. "VMS_103_205_115_74"
    event_hash  TEXT,                  -- MD5/hash for dedup (added in migration)
    PRIMARY KEY (id, event_time)
) PARTITION BY RANGE (event_time);
```

**Partitioning:** Monthly range partitions from 2024-11 through 2026-12
- Default partition catches anything outside defined ranges
- Auto-partition function creates next month's partition proactively
- Old partitions (2 months ago) dropped by retention job

**Indexes:**
```sql
idx_mqtt_events_time   ON (event_time DESC)   -- Time-range queries
idx_mqtt_events_camera ON (camera_id)          -- Per-camera queries
idx_mqtt_events_type   ON (event_type)         -- Filter by type
```

**Key Design Decisions:**
- `PARTITION BY RANGE(event_time)` — essential for query performance at millions of rows
- `payload JSONB` — flexible, no schema changes needed for new event types
- `event_hash` dedup prevents duplicate inserts at DB level (last line of defense)
- `snapshot` fields stripped before insert (Base64 images would bloat JSONB massively)

---

## anpr_event_fact — ANPR Layer 2

```sql
CREATE TABLE public.anpr_event_fact (
    id              BIGSERIAL PRIMARY KEY,
    event_time      TIMESTAMPTZ NOT NULL,
    camera_id       TEXT NOT NULL,
    plate_number    TEXT NOT NULL,
    vehicle_type    TEXT,            -- Car, Truck, Bus, Motorcycle, etc.
    vehicle_color   TEXT,
    vehicle_make    TEXT,
    is_violation    BOOLEAN NOT NULL DEFAULT false,
    violation_types TEXT[],          -- Array: ['NoHelmet', 'SpeedViolated']
    speed           NUMERIC,
    source_type     TEXT,            -- 'VMS', 'ITMS', 'APP'
    source_name     TEXT,
    source_id       TEXT,
    source_ip       TEXT,
    camera_name     TEXT,
    event_10s_bucket TIMESTAMPTZ    -- Auto-set by trigger (floor to 10s)
);
```

**Deduplication trigger:**
```sql
-- Before insert, calculate the 10-second bucket
CREATE TRIGGER trigger_set_anpr_bucket
    BEFORE INSERT OR UPDATE ON anpr_event_fact
    FOR EACH ROW EXECUTE PROCEDURE set_anpr_bucket_time();
```

**Unique dedup index:**
```sql
CREATE UNIQUE INDEX idx_anpr_deduplication
    ON anpr_event_fact (plate_number, camera_id, event_10s_bucket);
-- Same plate at same camera within 10 seconds = duplicate, silently ignored
```

---

## frs_event_fact — Face Recognition Layer 2

```sql
CREATE TABLE public.frs_event_fact (
    id              BIGSERIAL PRIMARY KEY,
    event_time      TIMESTAMPTZ NOT NULL,
    camera_id       TEXT NOT NULL,
    camera_name     TEXT,
    person_id       TEXT,
    person_name     TEXT,
    gender          TEXT,
    age             INTEGER,
    match_id        TEXT,       -- External person database match ID
    track_id        TEXT,       -- Tracking ID across frames
    det_conf        NUMERIC,    -- Detection confidence (0.0-1.0)
    rec_conf        NUMERIC,    -- Recognition confidence (0.0-1.0)
    face_image_path TEXT,       -- Path on camera server (NOT base64)
    is_authorized   BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

**Field extraction:** Uses `payload_schema_mappings` table for vendor-specific path mapping.
Fallback: reads from `payload.properties.personName`, `.gender`, `.age`, etc.

---

## atcc_event_fact — ATCC Vehicle Classification

```sql
CREATE TABLE public.atcc_event_fact (
    id              BIGSERIAL PRIMARY KEY,
    event_time      TIMESTAMPTZ NOT NULL,
    camera_id       TEXT NOT NULL,
    camera_name     TEXT,
    source_ip       TEXT,
    bus             INTEGER,
    car             INTEGER,
    truck           INTEGER,
    bicycle         INTEGER,
    tractor         INTEGER,
    mini_bus        INTEGER,
    ambulance       INTEGER,
    motorbike       INTEGER,
    e_rickshaw      INTEGER,
    mini_truck      INTEGER,
    auto_rickshaw   INTEGER,
    total_count     INTEGER,    -- Sum of all vehicle types
    snapshot_url    TEXT        -- Apache-served snapshot URL (not base64)
);
```

**Source:** Events where `EventName = 'Highway_ATCC'` or `event_type = 'Highway_ATCC'`
**Field source:** `payload.properties` object (may be JSON string, auto-parsed)

---

## vehicle_occupancy_fact — Parking/Occupancy

```sql
CREATE TABLE public.vehicle_occupancy_fact (
    id                BIGSERIAL PRIMARY KEY,
    event_time        TIMESTAMPTZ NOT NULL,
    camera_id         TEXT NOT NULL,
    camera_name       TEXT,
    source_ip         TEXT,
    event_properties  JSONB,   -- Flexible: full properties object stored as JSONB
    snapshot_url      TEXT
);
```

**Source:** Events where `alertType = 'Vehicle_Occupancy'`

---

## vids_event_fact — Video Incident Detection

```sql
CREATE TABLE public.vids_event_fact (
    id              BIGSERIAL PRIMARY KEY,
    event_time      TIMESTAMPTZ NOT NULL,
    camera_id       TEXT NOT NULL,
    camera_name     TEXT,
    source_ip       TEXT,
    incident_type   TEXT,   -- 'Wrong_Way', 'Stopped_Vehicle', 'Pedestrian_Crossing', etc.
    severity        TEXT,
    snapshot_url    TEXT,
    properties      JSONB
);
```

**Source:** Events where `event_type` is one of: `Wrong_Way`, `Stopped_Vehicle`, `Pedestrian_Crossing`, `Speeding`, `Illegal_Parking`, `Overspeed`, `Underspeed`, `Animal_Detected`, or contains `VIDS`

---

## live_camera_state — Real-Time State (Hot Table)

```sql
CREATE TABLE public.live_camera_state (
    camera_id           TEXT PRIMARY KEY,
    -- Crowd domain
    crowd_count         INTEGER,
    crowd_state         TEXT,           -- 'NORMAL', 'CROWDED'
    crowd_last_time     TIMESTAMPTZ,
    -- Traffic domain
    vehicle_count       INTEGER,
    traffic_state       TEXT,
    traffic_last_time   TIMESTAMPTZ,
    -- Parking domain
    parking_occupancy   INTEGER,
    parking_capacity    INTEGER,
    parking_state       TEXT,           -- 'AVAILABLE', 'OCCUPIED'
    parking_last_time   TIMESTAMPTZ,
    -- Security domain
    security_state      TEXT,
    security_last_time  TIMESTAMPTZ,
    -- Common
    last_event_time     TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ DEFAULT now(),
    camera_name         TEXT,
    source_id           TEXT,
    source_type         TEXT
);
```

**Update logic:** `ON CONFLICT (camera_id) DO UPDATE ... WHERE last_time < EXCLUDED.last_time`
- Only updates if the incoming event is NEWER than stored state
- Prevents out-of-order MQTT messages from overwriting fresher state

---

## camera_master — Camera Registry

```sql
CREATE TABLE public.camera_master (
    camera_id   TEXT PRIMARY KEY,
    camera_name TEXT,
    location    TEXT,
    camera_type TEXT,
    camera_ip   TEXT,       -- Actual device IP (not broker IP)
    latitude    NUMERIC,    -- Set via Config UI
    longitude   NUMERIC,    -- Set via Config UI
    is_active   BOOLEAN DEFAULT true,
    updated_at  TIMESTAMPTZ
);
```

**Auto-populated:** Every event triggers `upsertCameraMaster()` — cameras self-register
**Manual fields:** `latitude`, `longitude`, `location` — only set via Config UI (never overwritten by auto-upsert)

---

## event_classification_rules — Domain Routing

```sql
CREATE TABLE public.event_classification_rules (
    rule_id     SERIAL PRIMARY KEY,
    match_field TEXT,   -- Field name in payload to check (e.g. 'taskName')
    match_value TEXT,   -- Value to match (e.g. 'CROWD_DETECTION')
    domain      TEXT,   -- Domain to assign: 'CROWD', 'TRAFFIC', 'PARKING', 'SECURITY'
    enabled     BOOLEAN DEFAULT true
);
```

**Default rules seeded at init:**

| match_field | match_value | domain |
|-------------|------------|--------|
| taskName | CROWD_DETECTION | CROWD |
| taskName | QUEUE_DETECTION | CROWD |
| taskName | AUTOMATIC_TRAFFIC_COUNTING_AND_CLASSIFICATION | TRAFFIC |
| alertType | Vehicle_Occupancy | TRAFFIC |
| alertType | ANPR | TRAFFIC |
| taskName | INTRUSION_DETECTION | SECURITY |

**Usage:** Loaded into `classificationRules[]` at startup, checked in `processLiveState()` per event.

---

## payload_schema_mappings — Vendor Field Mapping

```sql
CREATE TABLE public.payload_schema_mappings (
    id                      SERIAL PRIMARY KEY,
    mapping_name            TEXT UNIQUE NOT NULL,   -- e.g. "Hikvision FRS"
    event_type              TEXT NOT NULL,           -- e.g. "Face_Recognition"
    mapping_config          JSONB NOT NULL,          -- {"db_column": "json.path"}
    identification_criteria JSONB,                  -- Auto-select criteria: {"vendor": "hikvision"}
    is_active               BOOLEAN DEFAULT true,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);
```

**Example mapping_config:**
```json
{
  "person_name": "properties.personName",
  "gender": "properties.gender",
  "age": "properties.age",
  "det_conf": "properties.detConf",
  "rec_conf": "properties.recConf"
}
```

---

## Metrics Tables (Layer 3 — Time-Series for Grafana)

### camera_metrics_1min
```sql
PRIMARY KEY (bucket_time, camera_id)
-- Columns: crowd_count, vehicle_count, parking_occupancy, traffic_state, crowd_state, parking_state
-- Populated by: runBucketJob() every 60s (snapshot from live_camera_state)
```

### anpr_metrics_1min
```sql
PRIMARY KEY (bucket_time, camera_id)
-- Columns: anpr_count
-- Populated by: COUNT(*) from anpr_event_fact WHERE event_time >= now() - 2min
```

### anpr_violation_metrics_1min
```sql
PRIMARY KEY (bucket_time, violation_type)
-- Columns: violation_count
-- Populated by: LATERAL unnest(violation_types) from anpr_event_fact
```

### frs_metrics_1min
```sql
PRIMARY KEY (bucket_time, camera_id)
-- Columns: total_faces, unique_persons, male_count, female_count
```

---

## Views

### vw_live_dashboard
```sql
-- Joins live_camera_state with freshness checks
-- camera_status: ONLINE if last_event_time >= NOW() - 2 min, else OFFLINE
-- crowd_count: NULL if crowd_last_time older than 2 min (stale)
-- traffic_state: NULL if traffic_last_time older than 2 min
-- parking_state: NULL if parking_last_time older than 5 min
-- security_state: NULL if security_last_time older than 1 min
```

---

## Functions & Triggers

### set_anpr_bucket_time()
```sql
-- Trigger function on anpr_event_fact
-- Calculates: floor(epoch / 10) * 10 → 10-second dedup bucket
-- Prevents duplicate plate reads within 10 seconds
```

### create_next_month_partition()
```sql
-- Creates next month's mqtt_events_YYYY_MM partition if it doesn't exist
-- Called by: scripts/Run_Auto_Partition.bat (should be scheduled monthly)
```

### cleanup_old_data_30_days()
```sql
-- Deletes all data older than 30 days from all tables
-- Drops partition tables older than 2 months
-- Called by: scripts/Run_Auto_Partition.bat
```

---

## Data Retention Strategy

| Layer | Mechanism | Retention Period |
|-------|----------|-----------------|
| `mqtt_events` partitions | Drop old partition table | 2 months |
| `mqtt_events` rows | DELETE WHERE event_time < NOW() - 30d | 30 days |
| All fact tables | DELETE WHERE event_time < NOW() - 30d | 30 days |
| All metrics tables | DELETE WHERE bucket_time < NOW() - 30d | 30 days |

**Two-Layer Approach:**
1. **Node.js runtime job** (`startDatabaseRetentionJob`) — runs daily, deletes rows
2. **SQL function** (`cleanup_old_data_30_days`) — run via BAT script for manual/cron use

---

## Migration Scripts

| File | What It Does |
|------|-------------|
| `migration_event_hash.sql` | Adds `event_hash TEXT` column to `mqtt_events`, creates dedup index |
| `init_mapping_schema.sql` | Creates `payload_schema_mappings` and `camera_group_mapping` tables |

---

*Part of the I2V MQTT Ingestion Bible | docs/DATABASE_BIBLE.md*
