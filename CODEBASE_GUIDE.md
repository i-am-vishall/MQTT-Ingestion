# I2V MQTT Ingestion System — Complete Developer Guide
### "Everything a junior developer needs to understand this codebase"

---

## Table of Contents

1. [What This System Does (Big Picture)](#1-what-this-system-does)
2. [Architecture Overview](#2-architecture-overview)
3. [Data Flow — Step by Step](#3-data-flow-step-by-step)
4. [The Two Ingestion Modes](#4-the-two-ingestion-modes)
5. [Every File Explained](#5-every-file-explained)
6. [The Database Schema](#6-the-database-schema)
7. [Configuration — The .env File](#7-configuration-the-env-file)
8. [Redis — What It Stores and Why](#8-redis-what-it-stores-and-why)
9. [The Config UI (Web Dashboard)](#9-the-config-ui)
10. [Windows Service Deployment](#10-windows-service-deployment)
11. [Common Bugs & How They Were Fixed](#11-common-bugs-and-fixes)
12. [How to Debug Problems](#12-how-to-debug-problems)
13. [Stress Testing](#13-stress-testing)

---

## 1. What This System Does

This is a **real-time event ingestion pipeline** for an ICCC (Integrated Command and Control Centre) security system.

### The Real World
You have hundreds of IP cameras installed on roads, parking lots, bridges, etc. These cameras are connected to VMS (Video Management Servers) which run AI algorithms:
- ANPR — reads vehicle number plates
- FRS — recognizes faces
- Crowd Detection — counts people
- Intrusion Detection — detects someone in a restricted zone
- Fire Detection, Loitering, Wrong-Way Driving, etc.

### What VMS Does
VMS servers detect events and publish them as **MQTT messages** to a broker.

### What This System Does
This Node.js service:
1. **Subscribes** to MQTT topics on multiple VMS servers simultaneously
2. **Processes** up to 15,000 events/second
3. **Stores** everything in PostgreSQL for historical analysis
4. **Updates** real-time dashboards in Grafana
5. **Never loses data** — even if the DB is under pressure

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FIELD HARDWARE                                  │
│  [Camera] → [VMS Server A]  [Camera] → [VMS Server B] ...              │
│                  │                          │                           │
│            MQTT Broker                 MQTT Broker                      │
│         (103.205.115.74)           (103.205.114.241)                    │
└──────────────────────────┬──────────────────────┘                       │
                           │  MQTT (port 1883)                            │
                           ▼                                              │
┌─────────────────────────────────────────────────────────────────────────┤
│                  INGESTION SERVICE (Node.js)                            │
│                                                                         │
│  ┌─────────────┐     ┌──────────────────────────────────────────────┐  │
│  │ cluster.js  │     │           index.js (Worker Process)          │  │
│  │  (Master)   │ →   │                                              │  │
│  │  2-12 CPU   │     │  MQTT Client → normalizeEvent()             │  │
│  │  workers    │     │       │                                      │  │
│  └─────────────┘     │       ▼                                      │  │
│                       │  handleMessage()                            │  │
│                       │       │                                     │  │
│          ┌────────────▼────────┴─────────────────────────────────┐  │  │
│          │       SHOCK_ABSORBER_MODE ?                           │  │  │
│          │                                                        │  │  │
│          │   true (Redis mode)    │   false (Direct DB mode)      │  │  │
│          │   ────────────────     │   ──────────────────────      │  │  │
│          │   TieredBuffer.push()  │   localBatch.push()           │  │  │
│          │         │              │           │                    │  │  │
│          │         ▼              │     (every 2000 events         │  │  │
│          │   Redis Stream         │      or 3 seconds)             │  │  │
│          │   "mqtt:ingest"        │           │                    │  │  │
│          │         │              │           ▼                    │  │  │
│          │   StreamConsumer       │   processBatchForDB()          │  │  │
│          │   (reads batches)      │   (COPY stream direct)         │  │  │
│          │         │              │                                │  │  │
│          └─────────┴──────────────┘                                │  │  │
│                       │                                             │  │  │
│                       ▼                                             │  │  │
│           processBatchForDB()  ─────────────────────────────────→  │  │  │
│                       │                          PostgreSQL          │  │  │
│                       ▼                          (port 5441)        │  │  │
│              mqtt_events table                                      │  │  │
│              anpr_event_fact                                        │  │  │
│              frs_event_fact                                         │  │  │
│              live_camera_state                                      │  │  │
│              historical_aggregates                                  │  │  │
└─────────────────────────────────────────────────────────────────────┘
                │  Redis also writes real-time                       
                ▼                                                     
         ┌──────────────┐          ┌──────────────┐                  
         │    Redis      │          │   Grafana    │                  
         │  crowd:*      │ ←──────→ │  Dashboards  │                  
         │  camera:*     │          │  (live view) │                  
         └──────────────┘          └──────────────┘                  
                                                                     
         ┌──────────────────────────────────────────┐               
         │          Config UI (port 3001)            │               
         │   Web dashboard to configure brokers,     │               
         │   view logs, control Windows services     │               
         └──────────────────────────────────────────┘               
```

---

## 3. Data Flow — Step by Step

Let's trace one ANPR event (a car being detected at a camera) from camera to Grafana.

### Step 1 — VMS publishes to MQTT
A VMS server detects a vehicle and publishes this JSON to topic `I2V/ANPR/Alert`:
```json
{
  "EventName": "ANPR",
  "PlateNumber": "UK07FU8233",
  "DeviceId": 22795,
  "DeviceName": "CAM_MALWEEYA_01",
  "Speed": 67,
  "VehicleType": "Car",
  "SpeedViolated": true,
  "DetTime": 1713234567000
}
```

### Step 2 — MQTT Client receives it
In `index.js`, the MQTT client's `message` event fires. The raw `message` (Buffer) and `topic` string are passed to `handleMessage()`.

### Step 3 — handleMessage() processes it
```
handleMessage(topic, message, sourceId='VMS_103_205_114_241', sourceIp='103.205.114.241')
```
Inside `handleMessage()`:
- Parse JSON string
- If it's an array (VMS sometimes sends batches), loop through each item
- Add `_source_id` and `_source_ip` to the payload (who sent it)
- Call `sanitizeObject()` to remove null bytes and oversized strings
- Call `normalizeEvent()` to convert to canonical format

### Step 4 — normalizeEvent() normalizes the data
`normalization.js` converts the raw VMS format into a clean internal object:
```json
{
  "event_type": "ANPR",
  "event_time": "2024-04-15T12:23:45.000Z",
  "camera_id": "22795",
  "camera_name": "CAM_MALWEEYA_01",
  "plate_number": "UK07FU8233",
  "vehicle_type": "Car",
  "speed": 67,
  "is_violation": true,
  "violation_types": ["SpeedViolated"],
  "source_id": "VMS_103_205_114_241",
  "source_ip": "103.205.114.241"
}
```

### Step 5A — Redis Mode: Push to TieredBuffer
The event is pushed to the Redis Stream `mqtt:ingest` via `TieredBuffer.push()`.
The stream acts as a durable in-memory queue.

### Step 5B — Direct Mode: Push to localBatch
The event is added to an in-memory array `localBatch[]`.
When localBatch hits 5,000 events OR 1 second passes, `flushLocalBatch()` is called.

### Step 6 — processBatchForDB() — The Database Writer
This function receives a batch of events and writes them to PostgreSQL using 3 operations:

**Operation 1: COPY stream (fastest PostgreSQL bulk insert)**
```sql
COPY mqtt_events(event_time, camera_id, event_type, severity, payload, 
                 source_id, source_ip, camera_name, event_hash)
FROM STDIN WITH (FORMAT csv, NULL '')
```
All events are streamed as CSV directly into the DB — much faster than individual INSERTs.

**Operation 2: ANPR fact table**
If the event is ANPR, also insert into `anpr_event_fact` with structured plate/violation data.

**Operation 3: FRS fact table**
If the event is Face Recognition, also insert into `frs_event_fact` with person details.

### Step 7 — Live State Update
After saving historical events, `live_camera_state` is updated — this is what Grafana reads for the "current status" dashboard panels. It's an UPSERT (insert or update), keeping only the latest state per camera.

### Step 8 — Historical Aggregates
A row in `historical_aggregates` is created/updated for the current second bucket:
```sql
INSERT INTO historical_aggregates (bucket_time, total_alerts, anpr_count, frs_count)
VALUES (date_trunc('second', NOW()), 150, 45, 12)
ON CONFLICT (bucket_time) DO UPDATE SET total_alerts = ... + EXCLUDED.total_alerts
```
This powers the "events per second" Grafana panel without scanning millions of rows.

---

## 4. The Two Ingestion Modes

The system has a toggle called `SHOCK_ABSORBER_MODE` in `.env`.

### Mode 1: SHOCK_ABSORBER_MODE=true (Redis Pipeline)
**Use when:** High throughput (5,000–15,000+ events/sec)

```
MQTT → handleMessage() → TieredBuffer → Redis Stream "mqtt:ingest"
                                                    │
                                         StreamConsumer (reads batches)
                                                    │
                                         processBatchForDB()
                                                    │
                                            PostgreSQL
```

**Why Redis?**
- PostgreSQL cannot handle 15,000 INSERT/sec directly without falling over
- Redis is an in-memory store that can accept data 100x faster than PostgreSQL
- Redis Stream is a durable queue — data persists even if the consumer crashes
- The consumer reads in batches of 2,000–5,000 events and bulk-inserts using COPY
- The cluster auto-scales workers based on stream backlog depth

**The TieredBuffer (3-tier fallback):**
1. **Tier 1:** Redis Stream (normal operation)
2. **Tier 2:** Disk DLQ at `C:\ProgramData\I2V\DLQ\` (if Redis is down)
3. **Tier 3:** Logged as DATA_LOSS (absolute last resort if disk is also full)

### Mode 2: SHOCK_ABSORBER_MODE=false (Direct to PostgreSQL)
**Use when:** Lower throughput or Redis is unavailable

```
MQTT → handleMessage() → localBatch[] (memory array)
                               │
                    (every 5000 events OR 1 second)
                               │
                    flushLocalBatch() → processBatchForDB()
                                              │
                                         PostgreSQL  (direct COPY stream)
```

**Key difference:** Redis is completely bypassed. Zero Redis keys are written.
![![alt text](image-1.png)](image.png)This is simpler but can overload PostgreSQL at very high event rates.

---

## 5. Every File Explained

### Root: `ingestion-service/`

#### `src/cluster.js` — The Entry Point
**This is what runs when the service starts.**

It uses Node.js `cluster` module to spawn multiple worker processes that all share the same port (MQTT) and work in parallel.

```
cluster.js (primary/master process)
    ├── Reads config to decide: how many workers? Redis or direct?
    ├── If SHOCK_ABSORBER_MODE=true:
    │   ├── Starts with MIN_WORKERS (default: 2)
    │   ├── Every 5 seconds checks Redis stream backlog
    │   ├── If backlog > 80% of capacity → spawn another worker (scale UP)
    │   ├── If backlog < 20% of capacity → kill one worker (scale DOWN)
    │   └── Min 2 workers, Max 12 workers
    ├── If SHOCK_ABSORBER_MODE=false:
    │   └── Starts with MAX_WORKERS immediately (12), no Redis scaling
    └── If any worker crashes → auto-respawn it
```

Worker processes run `require('./index.js')` which is the actual ingestion logic.

**Why shared subscriptions?**
Each worker subscribes to MQTT topics using the `$share/GROUP/TOPIC` prefix. This means the MQTT broker distributes messages round-robin across workers — avoiding duplicate processing.

#### `src/index.js` — The Core Worker (1,900 lines)
This is the largest file. It does everything in a worker process:

1. **Connects to PostgreSQL** (with retry logic — waits up to 8 attempts)
2. **Verifies/creates DB schema** (auto-runs `init_schema.sql` if tables missing)
3. **Manages partitions** (creates next 3 monthly partitions, drops expired ones)
4. **Connects to Redis** (for stream + live state updates)
5. **Creates TieredBuffer, CircuitBreaker, StreamConsumer** instances
6. **Connects to all MQTT brokers** (one client per broker URL in config)
7. **Starts health HTTP server** on port 3333
8. **Runs `handleMessage()`** for each incoming MQTT message
9. **Starts the Redis consumer loop** (Redis mode only)

Key functions inside `index.js`:

| Function | What It Does |
|---|---|
| `verifyDB()` | Checks all 19 tables exist, auto-creates if missing |
| `managePartitions()` | Creates `mqtt_events_2026_04`, `mqtt_events_2026_05` etc. |
| `loadRules()` | Loads `event_classification_rules` from DB |
| `loadMappings()` | Loads `payload_schema_mappings` from DB |
| `handleMessage()` | Entry point: parse JSON, normalize, route to buffer or batch |
| `sanitizeObject()` | Removes null bytes, truncates oversized strings |
| `normalizeEvent()` | See `normalization.js` |
| `processBatchForDB()` | Bulk write via COPY stream + ANPR/FRS fact tables |
| `processLiveStateRedis()` | Updates Redis hashes for Grafana live panels |
| `syncLiveStateToDB()` | Background: syncs Redis state to `live_camera_state` table |
| `flushLocalBatch()` | Direct mode: flush in-memory batch to DB |
| `insertDirectLiveStates()` | Direct mode: UPSERT live camera state |
| `pushCrowdToRedis()` | Writes crowd counts to Redis ZSET/HASH for real-time panels |
| `getAnprFactData()` | Extracts 14-column tuple for `anpr_event_fact` |
| `getFrsFactData()` | Extracts 11-column tuple for `frs_event_fact` |

#### `src/config.js` — Configuration Loader
Loads `.env` file and exports a typed config object. Searches for `.env` in 5 locations (dev, production, CWD, parent dirs). All other files `require('./config')` to get configuration.

#### `src/normalization.js` — Event Normalizer
Converts raw VMS/APP JSON into a canonical internal format. Supports:
- VMS ANPR events (from `DeviceId`, `PlateNumber`, `DetTime`)
- APP ANPR events (from `camId`, `plate`, different field names)
- FRS events (Face Recognition)
- Generic events (Intrusion, Crowd, Fire, etc.)

#### `src/buffer.js` — TieredBuffer
```
         Redis Stream (Tier 1)
               │
         fails? → Disk DLQ (Tier 2)
                       │
                 fails? → DATA_LOSS log (Tier 3)
```
Also monitors Redis health every 5s. If Redis recovers, auto-replays DLQ back into the stream.

#### `src/consumer.js` — StreamConsumer
Reads from the Redis Stream in batches and calls `processBatchForDB()`.

Key behaviors:
- Uses `XREADGROUP` — consumer groups ensure each message is only processed by one worker
- **Binary-split retry:** If a batch of 2,000 fails, it tries 1,000+1,000. If that fails, 500+500... down to 1 event. Single-event failures go to DLQ
- **Semaphore:** Only 3–6 workers can write to DB simultaneously (prevents connection pool exhaustion)
- **Lead worker:** Only worker #1 claims idle/stuck messages older than 60 seconds

#### `src/backpressure.js` — CircuitBreaker
Monitors Redis stream depth. Three states:

| State | Condition | Action |
|---|---|---|
| GREEN | Stream < 1M events | Accept everything |
| YELLOW | Stream 1M–2.5M events | Drop non-critical events proportionally |
| RED | Stream > 2.5M events | MQTT unsubscribe from non-critical topics |

Critical events (ANPR, FRS, Intrusion, Fire, Crowd) **always** pass through — even in RED state.

#### `src/dlq.js` — Dead Letter Queue
Writes failed events to disk files at `C:\ProgramData\I2V\DLQ\`:
- Max 10MB per file, rotates to new file when full
- Max 50 files (500MB total budget)
- Prunes oldest files when over budget
- Events can be replayed back into Redis stream when Redis recovers

#### `utils/createLogger.js` — Logger
Creates a Winston logger instance with:
- Console output (colored in dev, JSON in production)
- Daily rotating log files at `C:\ProgramData\I2V\logs\{service}\`
- Log levels: `debug`, `info`, `warn`, `error`, `fatal`

#### `scripts/ruthless_local_test.js` — Stress Test
Runs a two-phase test against the local service:
- Phase 1: `SHOCK_ABSORBER_MODE=true` — Fires 135,000 events, verifies Redis stream fills and drains to DB
- Phase 2: `SHOCK_ABSORBER_MODE=false` — Fires 135,000 events, verifies Redis stays at 0 and DB fills directly

Uses Mosquitto (local MQTT broker) to simulate VMS servers.

---

### Root: `config-ui/`

The Config UI is a separate web application — a React frontend with an Express backend.

#### `config-ui/server/index.js` — Backend API
Express server on port 3001. Key API endpoints:

| Endpoint | What It Does |
|---|---|
| `GET /api/config` | Returns current `.env` + `brokers.json` |
| `POST /api/config` | Saves broker config, rewrites `.env`, restarts ingestion service |
| `GET /api/env/tuning` | Returns tunable env vars |
| `PATCH /api/env/tuning` | Updates specific env vars (with whitelist validation) |
| `GET /api/services` | Checks status of all Windows services via `sc.exe` |
| `POST /api/service/start` | Starts a Windows service via `net start` |
| `POST /api/service/stop` | Stops a Windows service via `net stop` |
| `GET /api/logs?service=ingestion` | Returns last 200 lines of service log |
| `GET /api/ingestion-health` | Proxies to ingestion service at `:3333/health` |
| `GET /api/devices` | Returns `devices.json` (camera/server IPs for monitoring) |
| `POST /api/devices` | Saves devices, regenerates `telegraf.conf`, restarts Telegraf |

---

### Root: `db/`

#### `db/init_schema.sql` — Database Setup
Defines all tables, indexes, and views. Run once to create the entire DB structure.

Key tables:
- `mqtt_events` — **partitioned** table, one partition per month (e.g., `mqtt_events_2026_04`)
- `anpr_event_fact` — structured ANPR data (plate, speed, violations)
- `frs_event_fact` — structured Face Recognition data  
- `live_camera_state` — one row per camera, always the latest state
- `historical_aggregates` — per-second event counts for Grafana time-series
- `event_classification_rules` — rules that map event types to domains (CROWD, SECURITY, etc.)
- `payload_schema_mappings` — how to parse different payload schemas

---

## 6. The Database Schema

### `mqtt_events` (Partitioned by month)
```sql
event_time     TIMESTAMPTZ NOT NULL  -- When the event happened
camera_id      TEXT NOT NULL          -- Camera / Device ID
event_type     TEXT                   -- ANPR, Crowd_Detected, Intrusion, etc.
severity       TEXT DEFAULT 'info'    -- info, warning, critical
payload        JSONB                  -- Full original JSON from VMS
source_id      TEXT                   -- Which broker sent it (VMS_103_205_...)
source_ip      TEXT                   -- IP of the VMS server
camera_name    TEXT                   -- Human readable camera name
event_hash     TEXT UNIQUE            -- Dedup: same camera+type+time+payload → ignored
```

**Why partitioned?** A table with 10M+ rows is slow to query. Partitioning by month means each partition has ~500K rows. Old months are simply `DROP TABLE`-d for retention. Grafana queries hit `mqtt_events` which automatically routes to the right partition.

### `live_camera_state` (One row per camera)
```sql
camera_id          TEXT PRIMARY KEY
camera_name        TEXT
crowd_count        INT                -- Latest crowd count
crowd_state        TEXT               -- NORMAL / CROWDED
crowd_last_time    TIMESTAMPTZ
vehicle_count      INT
traffic_state      TEXT
traffic_last_time  TIMESTAMPTZ
security_state     TEXT               -- Latest security alert type
security_last_time TIMESTAMPTZ
parking_occupancy  INT
parking_state      TEXT
updated_at         TIMESTAMPTZ DEFAULT NOW()
```
Grafana's "Live Dashboard" reads this table. It only has one row per camera, so it's always fast.

### `anpr_event_fact` (Structured ANPR)
```sql
event_time       TIMESTAMPTZ
camera_id        TEXT
plate_number     TEXT
vehicle_type     TEXT
vehicle_color    TEXT
speed            NUMERIC
is_violation     BOOLEAN
violation_types  TEXT[]    -- ['SpeedViolated', 'NoHelmet']
source_id        TEXT
UNIQUE (plate_number, camera_id, event_10s_bucket)  -- Dedup per 10 seconds
```

### `event_classification_rules`
```sql
event_name   TEXT   -- e.g., 'Crowd_Detected'
match_field  TEXT   -- field to check, e.g., 'alertType'
match_value  TEXT   -- value to match, e.g., 'Crowd'
domain       TEXT   -- CROWD | SECURITY | TRAFFIC | PARKING
enabled      BOOLEAN
```
These rules are loaded at startup into `classificationRules[]` and used to determine which domain a camera event belongs to, which drives the `live_camera_state` updates.

---

## 7. Configuration — The .env File

```bash
# MQTT Brokers (comma-separated — supports multiple!!)
MQTT_BROKER_URL=mqtt://103.205.115.74:1883,mqtt://103.205.114.241:1883,mqtt://192.168.3.34
MQTT_TOPICS=#                          # '#' = all topics
MQTT_BROKER_ID=ANPR_103_205_115_74,VMS_103_205_114_241,OTHER_192_168_3_34
# IMPORTANT: IDs must match URLs one-to-one

# Database
DB_USER=postgres
DB_HOST=127.0.0.1
DB_NAME=mqtt_alerts_db
DB_PASSWORD=
DB_PORT=5441       # Note: non-standard port! The bundled PostgreSQL uses 5441

# Performance Tuning
BATCH_SIZE=5000            # How many events to batch before writing to DB
BATCH_TIMEOUT=1000         # Force flush every N milliseconds (even if batch not full)
MAX_CONCURRENT_WRITERS=6   # Max workers that write to DB simultaneously (semaphore)
MIN_NODE_WORKERS=2         # Minimum cluster workers
MAX_NODE_WORKERS=12        # Maximum cluster workers

# Ingestion Mode Switch
SHOCK_ABSORBER_MODE=true   # true=Redis pipeline, false=direct to DB

# Redis Stream Config
REDIS_STREAM_MAXLEN=2000000  # Cap stream at 2M events (MAXLEN ~ with trim)

# Data Retention
DB_RETENTION_DAYS=90   # Delete partitions older than 90 days

# Logging
LOG_LEVEL=info             # debug | info | warn | error
DEBUG_MODE=true
```

**Why port 5441?** The bundled PostgreSQL uses 5441 to avoid conflicts with any other PostgreSQL already installed on the server (which typically uses 5432).

---

## 8. Redis — What It Stores and Why

Redis is used for TWO completely different purposes:

### Purpose 1: Event Buffer (Shock Absorber)
**Key:** `mqtt:ingest` (configurable)
**Type:** Stream (`XADD`/`XREADGROUP`)

The Redis Stream is a durable ordered queue. Each entry contains the full normalized event JSON. Consumer workers use consumer groups so each event is only processed once.

When full: trimmed to `REDIS_STREAM_MAXLEN` (2M events ≈ ~2GB RAM).

### Purpose 2: Real-Time Grafana Data
These are written in `processLiveStateRedis()` and `pushCrowdToRedis()`:

| Key Pattern | Type | What It Is | Example |
|---|---|---|---|
| `crowd:camera:{id}` | Hash | Latest crowd count by camera ID | `HGET crowd:camera:22795 count` → `47` |
| `crowd:cam:{name}` | Hash | Same but by camera name | `HGET crowd:cam:MALWEEYA_01 count` → `47` |
| `crowd:by_name` | Sorted Set | All cameras ranked by count | `ZREVRANGE crowd:by_name 0 9 WITHSCORES` |
| `crowd:group:malweeya_dweep` | Hash | Group totals by zone | `HGETALL crowd:group:malweeya_dweep` |
| `crowd:zone:{zoneId}` | Hash | Counts per polygon zone | |
| `crowd:ranking` | Sorted Set | Legacy backward-compat key | |
| `live:cam:{id}` | Hash | Full live state per camera | |
| `live:dirty:{id}` | String | Flag: this camera needs DB sync | |
| `mqtt:db_write_slots` | String | Semaphore counter (concurrent writers) | |
| `mqtt:active_cluster_workers` | String | Number of active Node workers | |

Grafana can query Redis directly using the Redis datasource plugin — bypassing PostgreSQL entirely for real-time panels. This is what makes the dashboards instant even at 10,000+ events/sec.

---

## 9. The Config UI

The Config UI is a web app accessible at `http://localhost:3001`.

### What It Does
- **MQTT Brokers tab:** Add/remove broker URLs and IDs. Saves to `.env` and `brokers.json`. Auto-restarts the ingestion service.
- **Database tab:** Change DB connection settings. Saves to `.env`.
- **Performance tab:** Tune `BATCH_SIZE`, `MAX_CONCURRENT_WRITERS`, `MIN_NODE_WORKERS`, etc.
- **Services tab:** Start/stop all Windows services (ingestion, PostgreSQL, Redis, Telegraf, InfluxDB).
- **Logs tab:** Live-tail logs from any service. Uses WebSocket for real-time streaming.
- **Devices tab:** Add camera/server IPs for network monitoring. Auto-generates `telegraf.conf` and restarts Telegraf.

### Architecture
```
Browser (React SPA)
    │
    HTTP/WebSocket
    │
config-ui/server/index.js  (Express, port 3001)
    │
    ├── Reads/writes .env file
    ├── Calls Windows `sc.exe` and `net start/stop` for service control
    ├── Proxies /api/ingestion-health → ingestion service port 3333
    └── Syncs .env to production path: C:\Program Files (x86)\i2v-MQTT-Ingestion\.env
```

### Important: Config Sync
When you change settings via the Config UI, it writes the same `.env` to BOTH:
1. The dev/workspace `.env` 
2. `C:\Program Files (x86)\i2v-MQTT-Ingestion\.env` (production)

This ensures production picks up changes on next restart.

---

## 10. Windows Service Deployment

### Installation Path
Everything installs to: `C:\Program Files (x86)\i2v-MQTT-Ingestion\`

```
C:\Program Files (x86)\i2v-MQTT-Ingestion\
├── .env                        ← Production configuration
├── ingestion-service\
│   ├── i2v-ingestion-service.exe  ← Packaged Node.js app (via pkg)
│   ├── src\                    ← Source files (required by .exe)
│   └── utils\
├── config-ui\
│   ├── i2v-config-service.exe  ← Config UI backend
│   └── client\dist\            ← React frontend build
├── pgsql\                      ← Bundled PostgreSQL 11
│   ├── bin\postgres.exe
│   └── data\                   ← Database files
├── utils\
│   ├── nssm.exe                ← Non-Sucking Service Manager
│   └── service-wrapper.exe
├── monitoring\
│   ├── telegraf\               ← Telegraf for device monitoring
│   └── influxdb\               ← InfluxDB for metrics
└── scripts\
    ├── Install_On_New_Server.ps1   ← Full server setup script
    └── build_release.ps1           ← Creates installer package
```

### Windows Services
| Service Name | What It Is | Port |
|---|---|---|
| `i2v-MQTT-Ingestion-Service` | Main ingestion pipeline | 3333 (health) |
| `i2v-config-service` | Config UI backend | 3001 |
| `i2v-mqtt-ingestion-PGSQL-5441` | Bundled PostgreSQL | 5441 |
| `i2v-redis` | Redis/Memurai for caching | 6379 |
| `i2v-telegraf` | Telegraf device pinger | — |
| `i2v-influxdb` | InfluxDB metrics | 8088 |

### NSSM (Non-Sucking Service Manager)
Services are registered using `nssm.exe` which wraps `.exe` files as proper Windows services with:
- Auto-restart on crash
- Log file output capture
- Environment variable injection
- Startup/shutdown control via `sc.exe`

### How Restart Works
When Config UI saves new settings:
```javascript
exec('net stop "i2v-MQTT-Ingestion-Service" && net start "i2v-MQTT-Ingestion-Service"')
```
The ingestion service restarts, re-reads `.env`, and reconnects to all brokers.

---

## 11. Common Bugs and Fixes

### Bug 1: Redis MISCONF Error
**Error:** `MISCONF Redis is configured to save RDB snapshots but cannot persist on disk`

**Cause:** Redis's disk-snapshot (RDB) persistence fails (usually disk space or permissions). Redis then refuses all write commands.

**Fix:** At service startup, the code runs:
```javascript
redis.config('SET', 'stop-writes-on-bgsave-error', 'no')
```
This tells Redis "don't block writes just because you can't save snapshots." Data still flows; snapshots just won't work until disk issue is fixed.

### Bug 2: VMS Arrays Silently Dropped
**Error:** VMS servers sometimes published JSON arrays `[{...}, {...}, {...}]` instead of single objects.

**Fix:** `handleMessage()` now checks if parsed JSON is an array:
```javascript
const payloads = Array.isArray(parsedPayload) ? parsedPayload : [parsedPayload];
for (const payload of payloads) { /* process each one */ }
```

### Bug 3: PostgreSQL COPY Rejecting event_time
**Error:** `time zone "gmt+0530" not recognized`

**Cause:** `msg.event_time` was a JavaScript `Date.toString()` which gives locale strings like `"Fri Apr 17 2026 11:04:08 GMT+0530 (India Standard Time)"`. PostgreSQL's COPY parser only accepts ISO 8601.

**Fix:** Always convert before COPY:
```javascript
const evTime = msg.event_time
    ? new Date(msg.event_time).toISOString()  // → "2026-04-17T05:34:08.000Z"
    : new Date().toISOString();
```

### Bug 4: live_camera_state UPSERT Failing
**Error:** `column "security_state" of relation "live_camera_state" does not exist`

**Cause:** The UPSERT SQL had fewer columns than what the schema defined.

**Fix:** Added `security_state` and `security_last_time` to both the `INSERT` column list and the `ON CONFLICT DO UPDATE SET` clause.

### Bug 5: Aedes Broker Broken on Node 22
**Error:** Stress test's local MQTT broker accepted TCP connections but never sent CONNACK.

**Cause:** The `aedes` npm package (v1.0.2) is not compatible with Node.js v22.

**Fix:** Replaced Aedes with a Mosquitto subprocess in the stress test:
```javascript
const MOSQUITTO_EXE = 'C:\\Program Files\\mosquitto\\mosquitto.exe';
mosquittoProc = child_process.spawn(MOSQUITTO_EXE, ['-c', confPath]);
```

### Bug 6: syncLiveStateToDB SQL Syntax Error (42601)
**Error:** `ERROR 42601: syntax error at or near "$17"`

**Cause:** The SQL had 16 `$N` placeholders but the params array had 17 values (or vice versa).

**Fix:** Carefully counted and aligned `security_state` and `security_last_time` in both the parameters array and the SQL string.

---

## 12. How to Debug Problems

### Check if the service is running
```powershell
sc.exe query "i2v-MQTT-Ingestion-Service"
# Should show: STATE: 4 RUNNING
```

### Check the health endpoint
```
http://localhost:3333/health
```
Returns JSON with:
- `ingestion.mode` — which mode is active
- `ingestion.total` — total events processed since service started
- `ingestion.consumer.processed` — events consumed from Redis stream
- `worker_metrics.streamDepth` — how deep the Redis stream is
- `worker_metrics.dbThroughputSec` — events/second hitting DB

### Check the logs
Logs are at `C:\ProgramData\I2V\logs\{service}\YYYY-MM-DD.log`
```powershell
Get-Content "C:\ProgramData\I2V\logs\ingestion\*.log" -Tail 50
```
Or use the Config UI → Logs tab.

### Check how many events are in the DB
```sql
SELECT COUNT(*) FROM mqtt_events WHERE event_time >= NOW() - INTERVAL '5 minutes';
SELECT COUNT(*) FROM mqtt_events_2026_04;  -- Current month partition
```

### Check Redis stream depth
```
redis-cli XLEN mqtt:ingest
```
If this number is growing and not shrinking, the consumer is not keeping up.

### Check for DLQ files (events that failed to process)
```powershell
Get-ChildItem "C:\ProgramData\I2V\DLQ\"
```
If there are `.jsonl` files here, events were dropped (usually DB or Redis errors).

### Debug a specific MQTT broker connection
```
http://localhost:3333/health/brokers
```
Returns status for each broker: CONNECTED/OFFLINE/ERROR + message count.

---

## 13. Stress Testing

The script `ingestion-service/scripts/ruthless_local_test.js` runs a full end-to-end validation.

```powershell
cd ingestion-service
node scripts/ruthless_local_test.js
```

### What It Tests

**TEST 1 — SHOCK_ABSORBER_MODE=true**
1. Clears DB and Redis
2. Starts ingestion service in Redis mode
3. Fires 135,000 events (15,000/sec × 9 event types × 10 seconds)
4. Watches Redis stream fill up (proof data is going through Redis)
5. Waits 15s for the pipeline to drain
6. Checks PostgreSQL has all 135,000 rows ✅

**TEST 2 — SHOCK_ABSORBER_MODE=false**
1. Clears DB and Redis
2. Starts ingestion service in Direct mode
3. Fires 135,000 events
4. Watches Redis stays at 0 throughout (proof Redis is bypassed)
5. Checks PostgreSQL has all rows ✅

### Expected Results (Both Tests Passing)
```
TEST 1 (SHOCK_ABSORBER_MODE=true  / Redis Pipeline): ✅ PASS
TEST 2 (SHOCK_ABSORBER_MODE=false / Direct DB):      ✅ PASS
```

---

## Quick Reference

### "The service is running but no data in Grafana"
1. Check `http://localhost:3333/health` — is `ingestion.total > 0`?
2. If yes: data is being ingested. Check Grafana datasource connection.
3. If no: check MQTT connection. `health/brokers` — are brokers CONNECTED?
4. Check DLQ — are events failing to reach DB?

### "Events are in Redis but not in DB"
- Consumer is not running or is stuck
- Check service logs for "Consumer loop error"
- Check DB connection: `http://localhost:3333/health` → `worker_metrics.dbActiveConn`
- Restart the service

### "Service keeps crashing"
- Check `C:\ProgramData\I2V\DLQ\` — full disk?
- Check PostgreSQL is running: `sc.exe query "i2v-mqtt-ingestion-PGSQL-5441"`
- Check Redis is running: `sc.exe query "i2v-redis"`
- Review crash logs in `C:\ProgramData\I2V\logs\ingestion\`

### "I want to add a new event type"
1. Add a row to `event_classification_rules` table in PostgreSQL
2. The service picks it up via `loadRules()` which runs on startup (and every 5 minutes)
3. No code change required for basic routing/storage
4. For a new **fact table** (like ANPR has `anpr_event_fact`): add the table in `init_schema.sql` and add extraction logic in `index.js`

---

*Last updated: April 2026*
*Maintained by: I2V Systems*
