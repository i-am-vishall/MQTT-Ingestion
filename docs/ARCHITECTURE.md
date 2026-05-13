# 🏗️ System Architecture — I2V MQTT Ingestion

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA SOURCES                                 │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ VMS Server   │  │ ANPR Server  │  │ Local Broker │             │
│  │ 103.205.115.74│  │103.205.114.241│  │ 127.0.0.1   │             │
│  │ :1883 (MQTT) │  │ :1883 (MQTT) │  │ :1883 (MQTT) │             │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │
└─────────┼─────────────────┼─────────────────┼────────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    INGESTION SERVICE (Node.js)                      │
│                 C:\Program Files (x86)\i2v-MQTT-Ingestion\          │
│                                                                     │
│  ┌─────────────┐    ┌──────────────┐    ┌────────────────────┐    │
│  │ MQTT Client │───▶│  handleMsg() │───▶│  normalizeEvent()  │    │
│  │ (3 brokers) │    │  - sanitize  │    │  - ANPR/FRS/CROWD  │    │
│  └─────────────┘    │  - strip b64 │    │  - timestamp fix   │    │
│                     └──────┬───────┘    └────────┬───────────┘    │
│                            │                     │                 │
│                            ▼                     ▼                 │
│                    ┌──────────────────────────────────┐           │
│                    │         addToBatch()              │           │
│                    │  - Buffer up to 5000 events       │           │
│                    │  - Trigger flush on size/timeout  │           │
│                    └────────────────┬─────────────────┘           │
│                                     │                              │
│              ┌──────────────────────┼───────────────┐             │
│              │ SHOCK ABSORBER MODE  │  DIRECT MODE  │             │
│              │ (REDIS=true)         │  (REDIS=false) │             │
│              ▼                      │               ▼             │
│     ┌────────────────┐              │    ┌──────────────────┐     │
│     │  Redis Stream  │              │    │  flushBatch()    │     │
│     │  mqtt:ingest   │              │    │  BatchQueue(1)   │     │
│     │  (Producer)    │              │    └────────┬─────────┘     │
│     └───────┬────────┘              │             │               │
│             │ xreadgroup            │             │               │
│     ┌───────▼────────┐              │             │               │
│     │ Redis Consumer │──────────────┘             │               │
│     │ (startRedis    │                            │               │
│     │  Consumer())   │                            │               │
│     └───────┬────────┘                            │               │
│             └────────────────────────────────────▼               │
│                                        ┌──────────────────┐       │
│                                        │   PostgreSQL DB   │       │
│                                        │  mqtt_alerts_db   │       │
│                                        │  :5441            │       │
│                                        └──────────────────┘       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow — Step by Step

### Step 1: Message Arrives (MQTT)
- MQTT client fires `message` event
- `brokerState.recordMessage()` updates health heartbeat
- `handleMessage(topic, message, sourceId, sourceIp)` is called

### Step 2: Sanitization (handleMessage)
- Parse JSON (skip if invalid — no crash)
- Delete `snapshot`/`Snapshot` field (Base64, saves storage)
- Remove blacklisted image path fields: `fullimgpath`, `faceimgpath`, `plateimgpath`, etc.
- Inject `_source_id` and `_source_ip` into payload

### Step 3: Normalization (normalizeEvent)
- `detectSource()` → classifies as `VMS`, `ITMS`, `APP`, or `DEFAULT`
- Route to correct normalizer:
  - `normalizeVmsAnpr()` for ANPR events
  - `normalizeAppAnpr()` for App-originated ANPR
  - FRS branch for Face Recognition
  - Default pass-through for CROWD, SECURITY, ATCC, etc.
- `normalizeEventTime()` → always returns ISO 8601 UTC string
- Output: canonical `eventData` object

### Step 4: Buffering
- `addToBatch(eventData)`:
  - If buffer ≥ 5000 → drop oldest 10% (OOM protection)
  - Push to `messageBuffer[]`
  - If buffer ≥ `BATCH_SIZE` → trigger `flushBatch()` immediately
  - Otherwise, set debounce timer (`BATCH_TIMEOUT` ms)

### Step 5: Redis Mode (Optional)
- If `SHOCK_ABSORBER_MODE=true` and Redis is ready:
  - Push to Redis Stream `mqtt:ingest` (max 1,000,000 entries)
  - `startRedisConsumer()` reads in groups via `xreadgroup`
  - Falls back to direct DB write if Redis is down

### Step 6: Database Write (flushBatch)
- Wrapped in `BatchQueue(1)` — ensures only ONE flush runs at a time
- Drain loop: keeps processing until buffer is fully empty
- Inside a single `BEGIN/COMMIT` transaction:
  1. Insert raw event → `mqtt_events` (with dedup via `event_hash`)
  2. `processLiveState()` → update `live_camera_state`
  3. `upsertCameraMaster()` → auto-register camera
  4. Route to fact processor:
     - `processAnprFact()` → `anpr_event_fact`
     - `processFrsFact()` → `frs_event_fact`
     - `processAtccFact()` → `atcc_event_fact`
     - `processOccupancyFact()` → `vehicle_occupancy_fact`
     - `processVidsFact()` → `vids_event_fact`
  5. Bulk upsert `camera_master`
- Circuit breaker: if DB latency > 2000ms → pause ingestion 30s

### Step 7: Background Jobs (Schedulers)
- **Metrics Bucket Job** (every 60s, aligned to minute boundary):
  - Snapshot `live_camera_state` → `camera_metrics_1min`
  - Aggregate `anpr_event_fact` → `anpr_metrics_1min`
  - Aggregate violations → `anpr_violation_metrics_1min`
  - Aggregate FRS → `frs_metrics_1min`
- **Health Check Job** (every 60s):
  - Check `mqtt_events` for each source IP in last 2 min
  - Update `source_health_status` as ONLINE/OFFLINE
- **Database Watchdog** (every 5 min):
  - Check 4 core tables exist
  - If missing → run `init_schema.sql` (self-heal)
  - Reload classification rules and payload mappings
- **Data Retention Job** (every 24h, runs immediately on start):
  - Delete rows older than `DB_RETENTION_DAYS` (default: 30) from all tables

---

## Component Map

```
MQTT-Ingetsion/
├── ingestion-service/          ← Main Node.js service
│   └── src/
│       ├── index.js            ← ENTRY POINT — all logic lives here (1457 lines)
│       ├── config.js           ← Configuration loader (.env → module.exports)
│       ├── normalization.js    ← Event type detection + field normalization
│       ├── cluster.js          ← Multi-worker cluster manager
│       └── ingestion/
│           └── handleMessage.js ← (legacy, logic merged into index.js)
│
├── config-ui/                  ← Web-based configuration dashboard
│   ├── server/
│   │   └── index.js            ← Express API server (port 3001)
│   └── client/
│       └── src/                ← React + Tailwind frontend
│
├── db/                         ← All database scripts
│   ├── init_schema.sql         ← Full schema creation (idempotent, CREATE IF NOT EXISTS)
│   ├── auto_partition.sql      ← Monthly partition creator + 30-day data cleanup
│   ├── migration_event_hash.sql ← Migration: add event_hash dedup column
│   ├── init_mapping_schema.sql ← payload_schema_mappings table
│   └── weekly_partitions.sql   ← (legacy) weekly partition approach
│
├── scripts/                    ← 27 operational batch/PowerShell scripts
│   ├── build_production_release.ps1  ← Full release builder
│   ├── Install_On_New_Server.ps1     ← Zero-touch installer
│   ├── Update_And_Restart_Services.bat ← Hot-patch deployed services
│   ├── Run_Auto_Partition.bat        ← Execute auto_partition.sql
│   └── ... (24 more)
│
├── grafana/                    ← Grafana dashboard JSON exports
├── monitoring/                 ← Monitoring configs (Telegraf, etc.)
├── .env                        ← Master configuration file
└── docs/                       ← This documentation
```

---

## Services Architecture (Windows NSSM)

| Service Name | Binary | Port | Role |
|---|---|---|---|
| `i2v-ingestion` | `ingestion-service.exe` | — | Core MQTT → PostgreSQL pipeline |
| `i2v-config-ui` | `node config-ui/server/index.js` | 3001 | Web Config Dashboard |
| `i2v-mqtt-broker` | `mosquitto.exe` | 1883 | Local MQTT relay broker |
| `i2v-redis` | `redis-server.exe` | 6379 | Stream buffer (shock absorber) |
| `postgresql-x64-15` | `pg_ctl.exe` | 5441 | Database |

---

## Health Monitoring Endpoints

| Endpoint | Response |
|---|---|
| `GET http://127.0.0.1:3333/health` | Service uptime, memory, buffer size, total ingested |
| `GET http://127.0.0.1:3333/health/brokers` | All broker connection states |
| `GET http://127.0.0.1:3333/health/brokers/{id}` | Single broker detail |

---

*Part of the I2V MQTT Ingestion Bible | docs/ARCHITECTURE.md*
