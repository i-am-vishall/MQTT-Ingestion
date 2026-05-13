# 📂 Codebase Reference — I2V MQTT Ingestion System
> Every file explained — what it is, what it does, why it exists, and what calls it.

---

## ingestion-service/src/index.js
**Size:** 1457 lines | **Role:** ENTRY POINT — the entire ingestion engine

This is the heart of the system. Everything runs from here.

### Startup Sequence (Steps 1–6)
```
Step 1/6  → Logger + version banner
Step 2/6  → PostgreSQL connection pool initialized
Step 3/6  → verifyDB() — connect + check tables
Step 3.1  → restoreSchema() — if tables missing, auto-run init_schema.sql
Step 3.2  → startDatabaseWatchdog() — 5-min periodic table health check
Step 3.3  → startDatabaseRetentionJob() — daily 30-day data cleanup
Step 3.5  → loadRules() — cache event_classification_rules
Step 3.6  → loadMappings() — cache payload_schema_mappings
Step 4/6  → MQTT clients connect (one per broker URL)
Step 5/6  → Subscribe to topics
Step 6    → HTTP health server starts on port 3333
          → Metrics scheduler starts (aligned to minute boundary)
```

### Key Functions

| Function | Lines | What It Does |
|----------|-------|-------------|
| `verifyDB()` | ~112–150 | DB connection + table check + schema restore |
| `restoreSchema(client)` | ~152–182 | Searches 8 paths for init_schema.sql, executes it |
| `startDatabaseWatchdog()` | ~187–215 | Every 5min: checks core tables, self-heals if missing |
| `startDatabaseRetentionJob()` | ~220–278 | Every 24h: deletes data older than DB_RETENTION_DAYS |
| `loadRules()` | ~280–288 | Loads event_classification_rules into memory cache |
| `loadMappings()` | ~290–298 | Loads payload_schema_mappings into memory cache |
| `handleMessage()` | ~374–456 | Receives raw MQTT message, sanitizes, normalizes, routes |
| `addToBatch()` | ~643–659 | Adds event to buffer, triggers flush on size/timeout |
| `flushBatch()` | ~664–817 | Drains buffer into PostgreSQL (wrapped in BatchQueue) |
| `processLiveState()` | ~819–925 | Upserts live_camera_state based on domain |
| `upsertCameraMaster()` | ~932–957 | Auto-registers camera (preserves lat/long) |
| `processAnprFact()` | ~959–995 | Inserts into anpr_event_fact |
| `processFrsFact()` | ~1036–1101 | Inserts into frs_event_fact (uses payload mappings) |
| `processAtccFact()` | ~1103–1140 | Inserts into atcc_event_fact |
| `processOccupancyFact()` | ~1142–1165 | Inserts into vehicle_occupancy_fact |
| `processVidsFact()` | ~1167–1189 | Inserts into vids_event_fact |
| `runBucketJob()` | ~1192–1268 | Every 60s: populates all *_metrics_1min tables |
| `runHealthCheckJob()` | ~1270–1304 | Every 60s: updates source_health_status |
| `alignAndStartScheduler()` | ~1306–1318 | Aligns metric jobs to wall-clock minute boundary |
| `gracefulShutdown()` | ~1414–1444 | Clean shutdown with 4s hard-kill timeout |

### Key Classes

**`BatchQueue`** (line 51):
- Ensures only ONE `flushBatch` runs at a time
- Prevents race conditions when buffer is large
- Queue depth is unlimited but each job runs sequentially

**`BrokerConnectionState`** (line 461):
- Tracks per-broker health: status, messageCount, lastHeartbeat
- `isHealthy()` = CONNECTED + heartbeat within 2 minutes
- Used by `/health/brokers` endpoint

### Global State Variables
```js
let messageBuffer = [];          // Event queue awaiting DB flush
let batchTimer = null;           // Debounce timer reference
let totalIngested = 0;           // Total lifetime events processed
let classificationRules = [];    // Cached DB rules
let payloadMappings = [];        // Cached DB mappings
const batchQueue = new BatchQueue(1);  // Sequential flush gate
const brokerStates = new Map();  // Per-broker health state
const loadMonitor = { eps, dbLatency, isCircuitBroken, ... };
```

---

## ingestion-service/src/config.js
**Size:** 96 lines | **Role:** Configuration loader

Searches for `.env` in 4 locations (pkg-aware), exports all config as a typed object.

**Key behavior:**
- `isPkg` detection: adjusts paths for compiled binary vs. dev mode
- Validates `brokerIds.length === brokerUrls.length` — throws on mismatch
- `shockAbsorberMode` accepts `'true'`, `'1'`, `'on'` (case-insensitive)

**Exports:**
```js
module.exports = {
  mqtt: { brokerUrls[], brokerIds[], topics[], reconnectPeriod },
  db:   { user, host, database, password, port, max, idleTimeoutMillis },
  service: { batchSize, batchTimeoutMs, sourcePrefix, minWorkers, maxWorkers,
             shockAbsorberMode, retentionDays },
  redis: { host, port, password },
  stream: { name, consumerGroup },
  debugMode, logLevel, envLoaded, envPath
}
```

---

## ingestion-service/src/normalization.js
**Size:** 251 lines | **Role:** Event parsing and canonical schema conversion

### Functions

**`detectSource(payload)`**
- Returns: `'ITMS'` | `'VMS'` | `'APP'` | `'DEFAULT'`
- ITMS: has `EventName === 'ANPR'` AND `DeviceId`/`DeviceIP`
- VMS: has `alertType` or `taskName`
- APP: has `appName` or `camId`

**`normalizeEventTime(payload)`**
- Checks epoch fields first: `DetTime`, `ReceivedTime`, `detectionTime`, `alertTimeEpoch`
- Then string fields: `alertTime`, `event_time`, `time`, `timestamp`
- Handles: epoch-ms (13 digits), epoch-s (10 digits), ISO strings, locale strings
- Always returns: ISO 8601 UTC string (e.g. `2026-05-14T00:00:00.000Z`)
- Fallback: `new Date().toISOString()` — never returns null/undefined

**`normalizeEvent(topic, payload)`** — Main entry point
- Detects if ANPR → routes to `normalizeVmsAnpr()` or `normalizeAppAnpr()`
- Detects if FRS → builds FRS normalized object
- Default: pass-through with event_type inferred from `EventName`/`eventName`
- Message inference: `"crowd detected"` → `CROWD`, `"intrusion"` → `INTRUSION`

**`extractViolations(payload)`**
- Scans payload for violation boolean fields
- Returns array: `['NoHelmet', 'SpeedViolated', ...]`
- Fields checked: NoHelmet, RedLightViolated, WrongDirectionDetected, SpeedViolated, TrippleRiding, NoSeatBelt, IsDrivingWhileOnTheMobile, StoppedVehicleDetected

---

## ingestion-service/src/cluster.js
**Size:** ~6KB | **Role:** Multi-worker process manager

- Forks multiple worker processes based on `MIN_NODE_WORKERS` / `MAX_NODE_WORKERS`
- Each worker runs `index.js`
- Master monitors worker health, restarts crashed workers
- Used for extreme throughput scenarios (not the default run mode)
- **Current production:** Single process (`node index.js` directly via NSSM)

---

## db/init_schema.sql
**Size:** 392 lines | **Role:** Complete database schema (idempotent)

**Design principles:**
- All statements use `CREATE TABLE IF NOT EXISTS` — safe to re-run anytime
- All indexes use `CREATE INDEX IF NOT EXISTS`
- Trigger is `DROP TRIGGER IF EXISTS` then recreate
- Classification rules seeded with `WHERE NOT EXISTS` guards
- Can be run against existing DB without data loss

**Run order matters:**
1. Functions first (`set_anpr_bucket_time`)
2. Tables (mqtt_events must be created before partitions)
3. Partitions (2024-11 through 2026-12)
4. Indexes
5. Triggers
6. Seed data
7. Views

---

## db/auto_partition.sql
**Size:** 90 lines | **Role:** Monthly partition management + data retention

**Part 1 — `create_next_month_partition()`:**
- Calculates first day of next calendar month
- Checks `pg_class` if partition already exists
- Creates `mqtt_events_YYYY_MM` partition if missing
- Safe to run any time — idempotent

**Part 2 — `cleanup_old_data_30_days()`:**
- Deletes from all 10 tables (fact + metrics)
- Uses `EXCEPTION WHEN OTHERS THEN` for optional tables (silently skips if not exists)
- Drops partitions older than 2 calendar months
- Logs row counts via `RAISE NOTICE`

**Execution:**
```batch
scripts\Run_Auto_Partition.bat
```

---

## db/migration_event_hash.sql
**Role:** One-time migration — adds deduplication hash column

```sql
ALTER TABLE mqtt_events ADD COLUMN IF NOT EXISTS event_hash TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_mqtt_events_hash
    ON mqtt_events (event_hash, event_time)
    WHERE event_hash IS NOT NULL;
```
Run once against existing production DB when upgrading.

---

## db/init_mapping_schema.sql
**Role:** Creates payload_schema_mappings + camera_group_mapping tables

- `payload_schema_mappings` — vendor-specific JSON path mappings for FRS/ANPR
- `camera_group_mapping` — maps cameras to groups for Config UI zone management

---

## config-ui/server/index.js
**Size:** ~35KB | **Role:** REST API backend for Config UI (Express, port 3001)

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/login` | JWT login with ADMIN_USER/ADMIN_PASS |
| `GET` | `/api/config` | Read current .env values |
| `POST` | `/api/config` | Update .env values, restart service |
| `GET` | `/api/cameras` | List all cameras from camera_master |
| `PUT` | `/api/cameras/:id` | Update camera (lat/long, name, location) |
| `GET` | `/api/groups` | List camera groups |
| `POST` | `/api/groups` | Create group |
| `PUT` | `/api/groups/:id/cameras` | Assign cameras to group |
| `GET` | `/api/brokers` | List configured MQTT brokers |
| `POST` | `/api/brokers` | Add broker |
| `DELETE` | `/api/brokers/:id` | Remove broker |
| `GET` | `/api/health` | Source health status from DB |
| `GET` | `/api/dashboard/live` | Live camera state from vw_live_dashboard |

### Auth
- JWT tokens with `ADMIN_USER` / `ADMIN_PASS` from `.env`
- Token expiry: 24 hours
- All `/api/*` routes (except `/auth/login`) require `Authorization: Bearer <token>`

---

## config-ui/client/src/
**Role:** React + Tailwind frontend SPA

Built with Vite. Compiled to `config-ui/client/dist/` and served by Express.

**Key pages:**
- **Dashboard** — Live camera map + status tiles
- **Brokers** — Add/remove MQTT broker connections
- **Cameras** — Edit camera metadata, lat/long, group assignment
- **Groups** — Create zone groups, assign cameras
- **Config** — Edit .env variables via web form
- **Health** — Real-time source online/offline status

---

## scripts/ Directory (27 files)

### Build Scripts
| File | Purpose |
|------|---------|
| `build_production_release.ps1` | Full production build (pkg + React build + bundle) |
| `build_release.ps1` | Alternate release builder |
| `build_final_release.ps1` | Final release with version tagging |
| `build_ultimate_release.js` | Node.js build script |
| `assemble_full_release.js` | Assembles release folder from built parts |

### Installation Scripts
| File | Purpose |
|------|---------|
| `Install_On_New_Server.ps1` | Zero-touch new server installer |
| `production_install.bat` | Wrapper for installer |
| `production_uninstall.bat` | Clean removal of all services |
| `Register_ConfigUI_Service.bat` | Register config UI as NSSM service |
| `Fix_ConfigUI_Service.bat` | Repair broken Config UI service |
| `Remove_Old_ConfigUI_Service.bat` | Unregister old Config UI service |

### Operations Scripts
| File | Purpose |
|------|---------|
| `Update_And_Restart_Services.bat` | Hot-deploy + restart all services |
| `Restart_Ingestion_Admin.bat` | Admin restart of ingestion service |
| `Restart_Config_Backend.bat` | Restart Config UI backend only |
| `Start_Config_UI_Manual.bat` | Run Config UI manually (debug) |
| `restart_services.bat` | Restart all services |

### Database Scripts
| File | Purpose |
|------|---------|
| `Setup_and_Verify_DB.bat` | Run init_schema.sql + verify tables |
| `Verify_DB.bat` | DB health check only |
| `Run_Auto_Partition.bat` | Run auto_partition.sql |
| `Rename_DB_to_Grafana.bat` | Rename database for Grafana connection |

### Maintenance Scripts
| File | Purpose |
|------|---------|
| `log_cleanup.ps1` | Delete old log files |
| `Patch_Log_Rotation.bat` | Apply log rotation patch |
| `apply_telegraf_patch.bat` | Apply Telegraf monitoring patch |
| `Verify_Installation.bat` | Full installation health check |
| `preflight_check.js` | Pre-deploy preflight verification |

---

## .env
**Role:** Master runtime configuration file

Located at `C:\Program Files (x86)\i2v-MQTT-Ingestion\.env`
See [CONFIG_REFERENCE.md](./CONFIG_REFERENCE.md) for every variable explained.

---

## .gitignore
Excludes:
- `node_modules/` in all subdirectories
- `dist/`, `dist_package/`, `release/`
- `*.log`, `logs/`
- `vendor/` (binaries)
- `.env` in subdirectories (but root `.env` is tracked as template)
- `crash_log.txt`, `db_results*.txt`

---

## unified_installer.iss / ultimate_installer.iss
**Role:** InnoSetup scripts for GUI Windows installer (.exe)

Creates a traditional Windows installer wizard that:
- Copies all files to `Program Files (x86)\i2v-MQTT-Ingestion`
- Runs NSSM service registration
- Provides uninstall support in Add/Remove Programs

---

## Key Data Flow (Quick Reference)

```
MQTT Message
    │
    ▼
handleMessage()
    ├── JSON.parse()
    ├── delete snapshot/base64 fields
    ├── inject _source_id, _source_ip
    ├── sanitize blacklist fields
    └── normalizeEvent()
            ├── detectSource() → VMS/ITMS/APP/DEFAULT
            ├── normalizeEventTime() → ISO UTC string
            └── returns canonical eventData{}
    │
    ▼
addToBatch(eventData)
    ├── buffer overflow? → drop oldest 10%
    ├── buffer >= BATCH_SIZE? → flushBatch() immediately
    └── else → set timeout timer
    │
    ▼
flushBatch() [via BatchQueue - sequential]
    ├── BEGIN transaction
    ├── INSERT mqtt_events (ON CONFLICT DO NOTHING)
    ├── processLiveState() → live_camera_state
    ├── upsertCameraMaster() → camera_master
    ├── isAnpr? → processAnprFact() → anpr_event_fact
    ├── isFrs?  → processFrsFact()  → frs_event_fact
    ├── isAtcc? → processAtccFact() → atcc_event_fact
    ├── isOcc?  → processOccupancyFact() → vehicle_occupancy_fact
    ├── isVids? → processVidsFact() → vids_event_fact
    ├── bulk upsert camera_master
    └── COMMIT
    │
    ▼ (every 60s, minute-aligned)
runBucketJob()
    ├── live_camera_state → camera_metrics_1min
    ├── anpr_event_fact   → anpr_metrics_1min
    ├── anpr violations   → anpr_violation_metrics_1min
    └── frs_event_fact    → frs_metrics_1min
```

---

*Part of the I2V MQTT Ingestion Bible | docs/CODEBASE_REFERENCE.md*
