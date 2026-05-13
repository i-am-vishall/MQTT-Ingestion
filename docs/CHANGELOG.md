# 📜 Complete Changelog — I2V MQTT Ingestion System
> Every change, every version, every decision — from zero to production.
> Reconstructed from conversation history, git log, and codebase analysis.

---

## VERSION 0.1 — "The Beginning" (Raw Prototype)
**What existed:** Nothing. A blank slate.

**What was built:**
- Single Node.js script that connected to ONE MQTT broker
- Listened to all topics (`#`)
- Parsed JSON payload
- Inserted raw row into a single flat PostgreSQL table
- No normalization, no batching, no error handling
- Ran manually from command line (`node index.js`)

**Problems at this stage:**
- Crashed on any malformed JSON
- No reconnection logic
- No schema — table had to be manually created
- Single-point connection failure

---

## VERSION 0.5 — "Basic Schema"
**Changes:**
- Created first `init_schema.sql` with `mqtt_events` flat table
- Added `event_time`, `camera_id`, `event_type`, `payload JSONB`, `source_ip`
- Added basic `CREATE INDEX` on `event_time`

**What was learned:**
- PostgreSQL JSONB is powerful — can store any payload shape
- Need indexes from day one or queries will be slow

---

## VERSION 1.0 — "Multi-Broker + Normalization"
**USER Request:** "Connect to multiple MQTT brokers simultaneously"

**Changes:**
- `config.js` created — read `MQTT_BROKER_URL` as comma-separated list
- `config.mqtt.brokerUrls` → array, iterated with `forEach`
- Each broker gets its own `mqtt.connect()` client
- All clients pushed to `clients[]` array
- `sourceIp` extracted from broker URL via `new URL()`
- `sourceId` auto-generated as `Source_Server_IP_UNDERSCORE`
- `MQTT_BROKER_ID` env var added — allows custom names per broker
- `normalization.js` module created:
  - `detectSource()` — identifies VMS vs ITMS vs APP origin
  - `normalizeEvent()` — converts any payload to canonical schema
  - `normalizeEventTime()` — handles epoch ms, epoch s, ISO strings, locale strings

**Why normalization was needed:**
- VMS servers send `alertTime`, `taskName`, `cameraId`
- ANPR/ITMS servers send `DetTime`, `DeviceId`, `PlateNumber`
- Apps send `timestamp`, `camId`, `plate`
- Without normalization: 3 different schemas, dashboard queries break

---

## VERSION 1.5 — "ANPR Fact Table"
**USER Request:** "We need a dedicated ANPR table for proper querying in Grafana"

**Changes:**
- `anpr_event_fact` table added to schema
- Trigger `set_anpr_bucket_time()` created — auto-populates 10-second dedup bucket
- Unique index `idx_anpr_deduplication` on `(plate_number, camera_id, event_10s_bucket)`
  - This prevents same plate at same camera within 10 seconds from duplicating
- `processAnprFact()` function added to `index.js`
- Violation type extraction: `NoHelmet`, `RedLightViolated`, `SpeedViolated`, etc. stored as `TEXT[]`
- `anpr_metrics_1min` table created — for time-series charting in Grafana
- `anpr_violation_metrics_1min` table created — violation breakdown by type per minute

---

## VERSION 2.0 — "FRS + Live Camera State + Classification Rules"
**USER Request:** "Add Face Recognition events and real-time camera status"

**Changes:**
- `live_camera_state` table created — one row per camera, upserted on every event
  - Tracks: `crowd_count`, `crowd_state`, `traffic_state`, `vehicle_count`, `parking_state`, `security_state`
  - Each domain has its own `_last_time` timestamp column
- `event_classification_rules` table created — database-driven routing
  - Rules loaded at startup into `classificationRules[]` cache
  - Rule match: check `payload[match_field] === match_value` → assign `domain`
  - Default rules seeded: CROWD_DETECTION, QUEUE_DETECTION, ATCC, Vehicle_Occupancy, ANPR, INTRUSION_DETECTION
- `frs_event_fact` table created:
  - `person_name`, `gender`, `age`, `match_id`, `track_id`, `det_conf`, `rec_conf`
- `frs_metrics_1min` table created
- `camera_metrics_1min` table created — snapshots live state every minute
- `processLiveState()` function: routes to correct live state domain (CROWD/TRAFFIC/PARKING/SECURITY)
- `processFrsFact()` function: uses `payload_schema_mappings` for flexible field extraction
- `payload_schema_mappings` table: configurable JSON path mappings per vendor
- `vw_live_dashboard` VIEW created — joins live state with 2-min freshness checks

---

## VERSION 2.5 — "Batch Queue + Race Condition Fix"
**USER Request:** "Events are being dropped / duplicate writes happening under load"

**Root Cause:** Multiple concurrent `flushBatch()` calls were racing on the same buffer

**Fix — `BatchQueue` class:**
```js
class BatchQueue {
    constructor(maxConcurrent = 1) { ... }
    async enqueue(fn) { ... }   // Queues flush operations
    async _process() { ... }    // Runs ONE at a time
}
const batchQueue = new BatchQueue(1); // Sequential flushing
```

**Other changes:**
- `messageBuffer` swap pattern: atomically swap buffer to local `batch`, reset global to `[]`
- Drain loop inside `flushBatch` — keeps flushing until buffer is truly empty
- OOM protection: if buffer ≥ 5000 → drop oldest 10%
- `ON CONFLICT (event_hash, event_time) DO NOTHING` added to `mqtt_events` insert

---

## VERSION 3.0 — "Redis Shock Absorber + Circuit Breaker"
**USER Request:** "Handle 1000+ EPS (events per second) without crashing the database"

**Problem:** At high load (1000 EPS), direct DB writes create backpressure. DB latency spikes → buffer grows → OOM.

**Solution: Redis Stream as shock absorber buffer**

**Changes:**
- `ioredis` added as dependency
- `SHOCK_ABSORBER_MODE` env var added (true/false toggle)
- When enabled:
  - `handleMessage()` → `redisPipelineClient.xadd('mqtt:ingest', 'MAXLEN', '~', 1000000, ...)` (Producer)
  - `startRedisConsumer()` → `xreadgroup` loop pulls from stream (Consumer)
  - Consumer calls `addToBatch()` → feeds existing batch pipeline
  - If Redis down → falls back to direct `addToBatch()` (circuit fallback)
- **Circuit Breaker** added to `flushBatch`:
  - Measures DB latency per flush
  - If latency > 2000ms → `loadMonitor.isCircuitBroken = true`
  - While broken: incoming messages discarded (protect DB)
  - Auto-reset after 30 seconds
- **Load Monitor** (`loadMonitor` object):
  - Tracks EPS (events per second) in rolling 1-second windows
  - If EPS > 1000 → increase debounce to 15s (reduce DB write frequency)
  - Below 1000 → 5s debounce
- `source_health_status` table added
- `runHealthCheckJob()` added — marks sources ONLINE/OFFLINE every 60s

---

## VERSION 3.5 — "Broker Connection State Tracking"
**USER Request:** "We need to know which MQTT broker is healthy vs silently disconnected"

**Problem:** MQTT client would go offline silently with no way to detect it from outside

**Fix — `BrokerConnectionState` class:**
```js
class BrokerConnectionState {
    // Tracks: status, lastConnected, lastError, messageCount, lastHeartbeat
    isHealthy() { return status === 'CONNECTED' && (Date.now() - lastHeartbeat < 120000); }
}
```

**Changes:**
- `brokerStates` Map created — one state object per broker
- All MQTT events (connect, disconnect, offline, error, message) update broker state
- `isHealthy()` uses 2-minute heartbeat window — detects silent failures
- Periodic broker health check every 60s — logs summary
- NEW HTTP endpoints:
  - `GET /health/brokers` — all broker states as JSON
  - `GET /health/brokers/:id` — individual broker detail
- Batch summary logger: counts messages per 5s window, logs as single line (reduces log noise)

---

## VERSION 4.0 — "Config UI"
**USER Request:** "Build a web UI to configure brokers, cameras, and groups without touching files"

**What was built:**
- `config-ui/server/index.js` — Express.js REST API (port 3001)
- `config-ui/client/` — React + Tailwind CSS frontend

**Config UI Features:**
- MQTT broker management (add/remove/edit broker URLs and IDs)
- Camera master list with Lat/Long geodata editing
- Camera group management (group → camera mapping)
- Source health status dashboard
- Live `.env` file editing via API
- JWT-based authentication (`ADMIN_USER` / `ADMIN_PASS` from `.env`)
- WebSocket support for real-time updates

**Bug fixes during Config UI development:**
- `camera_master` was missing `camera_ip` and `updated_at` columns → schema updated
- Config UI was showing `source_ip` instead of actual `camera_ip` → fixed query
- Camera group assignments were not persisting → fixed upsert logic in `camera_group_mapping` table
- Config UI service failing to start → path resolution fix in NSSM registration script

---

## VERSION 4.5 — "Camera Auto-Registry + Lat/Long"
**USER Request:** "Auto-register cameras as they send events, preserve manual lat/long"

**Changes:**
- `upsertCameraMaster()` function added:
  - Called on every event processed
  - Uses `ON CONFLICT (camera_id) DO UPDATE` — only updates if name/IP changed
  - Does NOT overwrite lat/long (those columns only updated via Config UI)
- Bulk upsert at batch level (not per-event) — performance optimization
- Validation: skip non-numeric camera IDs (prevents garbage from polluting registry)
- `camera_ip` column added to `camera_master` (stores device IP, not source/broker IP)
- `init_mapping_schema.sql` created — `camera_group_mapping` table

---

## VERSION 5.0 — "Windows Service + Production Packaging"
**USER Request:** "Package everything as a one-click installer for Windows Server"

**What was built:**
- `pkg` used to compile `ingestion-service` → `ingestion-service.exe` (self-contained Node binary)
- NSSM (Non-Sucking Service Manager) used to register all services as Windows Services
- `scripts/build_production_release.ps1` — full automated build pipeline:
  1. `npm install` in ingestion-service
  2. `npm install` in config-ui/server and config-ui/client
  3. `npm run build` in config-ui/client (Vite React build)
  4. `pkg` compile ingestion-service
  5. Bundle all binaries into `release/` folder
  6. Copy NSSM, PostgreSQL portable, Redis portable, Mosquitto portable
- `scripts/Install_On_New_Server.ps1` — zero-touch installer:
  - Creates install directory
  - Registers all 5 Windows Services with NSSM
  - Sets service recovery (auto-restart on failure)
  - Runs `init_schema.sql` against PostgreSQL
- `scripts/production_install.bat` — wrapper for quick install
- `scripts/production_uninstall.bat` — clean removal
- InnoSetup `.iss` files created for GUI installer (`unified_installer.iss`, `ultimate_installer.iss`)
- Graceful shutdown handler added to `index.js`:
  - Handles `SIGTERM`, `SIGINT`, `NSSM_SHUTDOWN`
  - 4-second hard-kill timeout
  - Closes MQTT clients, drains DB pool
- `--check` CLI flag added: runs self-diagnosis and exits

---

## VERSION 5.5 — "Self-Healing Database Watchdog"
**USER Request:** "If someone drops the tables, the service should auto-restore them"

**Changes:**
- `startDatabaseWatchdog()` function added:
  - Runs every 5 minutes
  - Checks if 4 core tables exist (`mqtt_events`, `live_camera_state`, `anpr_event_fact`, `event_classification_rules`)
  - If count < 4 → calls `restoreSchema()` → executes `init_schema.sql`
  - After restore → reloads `classificationRules` and `payloadMappings`
- `restoreSchema()` searches 8 fallback paths for `init_schema.sql`:
  - Relative to process, relative to cwd, absolute production path
- Startup sequence:
  1. Connect DB
  2. Check tables
  3. If missing → auto-restore
  4. Load rules + mappings
  5. Start watchdog
  6. Start retention job
  7. Connect MQTT brokers

---

## VERSION 6.0 — "ICCC Architecture Upgrade" (Current Production)
**Context:** System deployed to ICCC (Integrated Command and Control Centre) use case with multiple VMS + ANPR servers

**Changes:**
- Version string bumped: `v6.0(ICCC Architecture Upgrade)`
- ATCC (Automatic Traffic Count & Classification) fact table added: `atcc_event_fact`
  - Vehicle breakdown: bus, car, truck, bicycle, tractor, mini_bus, ambulance, motorbike, e_rickshaw, mini_truck, auto_rickshaw, total
- Vehicle Occupancy fact table added: `vehicle_occupancy_fact`
- VIDS (Video Incident Detection System) fact table added: `vids_event_fact`
  - Handles: Wrong_Way, Stopped_Vehicle, Pedestrian_Crossing, Speeding, Illegal_Parking, Animal_Detected
- `processAtccFact()`, `processOccupancyFact()`, `processVidsFact()` functions added
- Payload Mapping system (`payload_schema_mappings` table) made production-ready:
  - `getByPath()` — dot-notation + array index JSON path extractor
  - `matchCriteria()` — multi-field matching including `topic_pattern`, `source_id`, `source_ip`
- MQTT Broker IDs made configurable: `MQTT_BROKER_ID=VMS_103_205_115_74,ANPR_103_205_114_241,LOCAL_MQTT`
- `config.js` validation: throws if `BROKER_ID` count ≠ `BROKER_URL` count
- IST timezone forced on every DB connection: `SET timezone = 'Asia/Kolkata'`
  - This aligns Grafana time filters with actual event times

---

## VERSION 6.1 — "Data Retention (30-Day Cleanup)"
**USER Request:** "Auto-delete records older than 30 days without a separate process"

**Approach Decision:** Integrate into existing runtime (no new process/cron)

**Changes to `index.js`:**
- `startDatabaseRetentionJob()` function added:
  - Runs immediately on startup
  - Then repeats every 24 hours
  - Deletes from all 10 tables (skips gracefully if table doesn't exist)
  - Table list: `mqtt_events`, `anpr_event_fact`, `frs_event_fact`, `atcc_event_fact`, `vehicle_occupancy_fact`, `vids_event_fact`, `camera_metrics_1min`, `anpr_metrics_1min`, `anpr_violation_metrics_1min`, `frs_metrics_1min`
  - Configurable via `DB_RETENTION_DAYS` env var (default: 30)
- Called in startup sequence after watchdog start (Step 3.3)

**Changes to `config.js`:**
- `retentionDays: parseInt(process.env.DB_RETENTION_DAYS || '30')` added to `service` config block

**Changes to `.env`:**
- `DB_RETENTION_DAYS=30` added with comment block

**`db/auto_partition.sql` updated (synced from production):**
- Part 1: `create_next_month_partition()` — dynamically creates next month's mqtt_events partition
- Part 2: `cleanup_old_data_30_days()` — SQL-level retention function
  - Deletes from all fact + metrics tables
  - Drops partitions older than 2 months
  - Can be run independently via `scripts/Run_Auto_Partition.bat`

---

## Bug Fixes Log

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| Events duplicating at high load | Concurrent `flushBatch()` race condition | `BatchQueue(1)` — sequential flushing |
| Service crash on malformed JSON | No try/catch around `JSON.parse` | Silent skip with `return` |
| Grafana time mismatch | DB storing UTC, Grafana showing IST offset wrong | `SET timezone = 'Asia/Kolkata'` on every connection |
| Camera showing wrong IP in Config UI | Displaying `source_ip` (broker IP) instead of `camera_ip` | Fixed UI query to use `camera_master.camera_ip` |
| Self-healing not finding schema file | Hardcoded single path | 8-path search array with production fallback |
| Config UI 401 errors | JWT secret mismatch between restart | Read from `.env` consistently |
| Broker silently going offline | No heartbeat detection | `BrokerConnectionState.isHealthy()` 2-min window |
| `source_name` duplicating `source_id` in ANPR | Wrong column mapped | Fixed: `source_name = norm.source_name`, `source_id = norm.source_id` |
| OOM crash at 2000+ EPS | Unbounded buffer | Cap at 5000, drop oldest 10% on overflow |
| Graceful shutdown hanging | `pool.end()` blocking | `Promise.race([pool.end(), timeout(2500ms)])` |

---

*Part of the I2V MQTT Ingestion Bible | docs/CHANGELOG.md*
