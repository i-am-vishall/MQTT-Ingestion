# MQTT Ingestion System: Technical Documentation & KT Guide

## 🎯 System Overview 
This document outlines the architecture, data flow, and troubleshooting details for the **MQTT Ingestion System**. It is built for onboarding engineers to understand how the system extracts, processes, and visualizes IoT data from cameras. 

**Scope Included**: UI Configuration, Node.js Ingestion Service, PostgreSQL Architecture, and Grafana Integrations.
**Scope Excluded**: Rath Yatra module, Crowd prediction engine.

---

## 🔄 End-to-End Data Pipeline

The full pipeline operates chronologically as follows:

1. **User Action (UI):** User adds an MQTT broker URL and credentials in the Admin UI (`config-ui`) and saves the configuration.
2. **Restart Trigger:** The UI backend edits the `.env` file and triggers a restart of the `i2v-MQTT-Ingestion-Service`.
3. **Data Ingestion:** The `ingestion-service` connects to the updated MQTT brokers and begins subscribing to topics.
4. **Processing & Normalization:** Messages are immediately processed in memory. Unnecessary heavy fields (e.g., base64 snapshots) are stripped. Payload formats are inferred (VMS vs APP) and timestamp properties are standardized using `normalization.js`.
5. **Database Write:** Messages are grouped into batches using a `BatchQueue` and pushed to PostgreSQL. Raw events land in `mqtt_events` while state updates overwrite `live_camera_state`.
6. **Grafana Read:** Grafana utilizes the parsed views (e.g., `vw_live_dashboard`) and metrics tables in PostgreSQL to instantly render the panels. 

> [!NOTE] 
> This is a high-throughput system configured for heavy batch processing. Never modify single rows interactively during traffic peaks.

---

## 1. UI Layer (`config-ui`)

### Purpose
Provides a centralized frontend to configure `.env` variables, handle broker credentials, restart services, and monitor service health.

### Components
- **`config-ui/server/index.js`**: Core UI backend. Exposes APIs like `/api/config`, `/api/services`, and `/api/logs`.
- **`config-ui/client/`**: React frontend compiled into `dist/`.
- **Log Streaming WebSocket**: Feeds live logs directly to the frontend.

### Flow
- **Config Update:** The UI sends a POST request with new DB/Broker config to `/api/config`.
- **Write:** The backend writes these configurations directly into `brokers.json` and updates the `.env` file at the root.
- **Service Management:** The backend initiates system-level reboots using `net stop` and `net start` on Windows to cycle the Telegraf and Ingestion services dynamically.

### Failure Points
- `EBUSY` when writing to the `.env` if being read concurrently.
- Insufficient OS permissions leading to `net start / stop` failures.

---

## 2. Backend Layer (`ingestion-service`)

### Purpose
High-volume broker subscription, structured data normalization, and batch-insertion directly into the DB. 

### Components
- **`src/index.js`**: Entry point. Handles MQTT connection, DB `Pool` management, and batch buffering.
- **`src/normalization.js`**: Converts varied VMS/App payloads into a single canonical schema. Strips `snapshot` data automatically.
- **`utils/createLogger.js`**: Centralized Pino logger.

### Flow
1. Start up and execute `verifyDB()`. If partitioned tables don't exist, it auto-initializes the schema using `init_schema.sql`.
2. Connect to Brokers & listen to messages via `handleMessage()`.
3. Feed normalized data to `messageBuffer`.
4. Flush batch to DB via `BatchQueue` class every fixed timeout or buffer limit (5000 max size).

### Data Movement
**Input**: Variable payload JSON (e.g., `{"DetTime": 171542, "PlateNumber": "XYZ"}`)
**Normalization**: Re-mapped to canonical properties (e.g., `event_type`, `event_time`, `camera_id`). Blacklisted keys like `fullimagepath` are purged. 
**Output**: Pushed entirely to TimescaleDB/PostgreSQL.

### Failure Points
- MQTT connection drops out silently. 
- Message buffer OOM (Out Of Memory) if the database becomes unresponsive and is unable to flush batches.

---

## 3. Database Layer (`db`)

### Purpose
To persistently store all raw streams while maintaining heavily indexed materialized metrics for rapid dashboard aggregation.

### Schema Architecture
- **`mqtt_events`**: Base raw table setup with `PARTITION BY RANGE (event_time)` chunked monthly to prevent query slowdown on multi-TB datasets. 
- **`live_camera_state`**: An inherently destructive ID-keyed table. Updated persistently for the ultimate query speed to populate live dashboard tables.
- **`anpr_event_fact`** / **`frs_event_fact`**: Normalized table containing specific analytics. Uses `ON CONFLICT DO NOTHING` for deduplication based on `event_10s_bucket`.
- **`vw_live_dashboard`**: A live coalesced view interpreting data from `live_camera_state` reflecting camera UP/DOWN status. 

### Flow & Read/Write Path
- **Write:** The Node.js application exclusively handles `INSERT` and `ON CONFLICT DO UPDATE SET`. Operations are bulk-batched inside transactions.
- **Read:** Exclusively handled by Grafana referencing materialized Views or time-series indexed tables.

### Failure Points
- Missing Monthly Partitions: If a partition matching the current date is left uncreated, bulk inserts will completely crash.
- Transaction lockups if multiple threads try to conflict-update the same row inside the exact same batch. (Mitigated by single-thread `BatchQueue`).

---

## 4. Grafana Integration Layer

### Purpose
Real-time, scalable data visualization reading exclusively off internal Postgres Views.

### Configuration
- **Data Source:** Configured strictly to the PostgreSQL instance via Grafana connection plugins.  
- **Query Structure:** Utilizes standard SQL with Grafana macros (e.g., `$__timeFilter`).

### Example Query
```sql
SELECT 
    updated_at as time, 
    camera_name,
    crowd_count, 
    camera_status 
FROM vw_live_dashboard 
WHERE source_type = 'CROWD'
```

### Failure Points
- Grafana failing to align variable `$__timeFilter` correctly with `$1` in raw DB clauses resulting in sequence scans.
- Aggregation lag if the `vw_live_dashboard` joins begin to get heavy.

---

## 🧪 Real Debug Scenarios (Troubleshooting Guide)

### 1. "Dashboard shows Data but Alert not showing in Grafana"
- **Root Cause**: Grafana is querying off `mqtt_events`, but the event timestamp was normalized entirely incorrectly or falls outside the time slice. 
- **Verify**: Check `normalization_debug.log`. Query the DB `SELECT event_time, payload FROM mqtt_events ORDER BY id DESC LIMIT 5;` and check if `event_time` is accurately reflecting standard epoch time or is 1970 due to a parse failure.
- **Fix**: Update the time extraction logic in `normalization.js` for the new payload spec.

### 2. "Data missing entirely in Database"
- **Root Cause**: The ingestion service lacks the partition matching the current month.
- **Verify**: View Node.js logs. You will see `ERROR: no partition of relation "mqtt_events" found for row`.
- **Fix**: Run `CREATE TABLE public.mqtt_events_YYYY_MM PARTITION OF public.mqtt_events FOR VALUES FROM ('YYYY-MM-01') TO ('YYYY-MM-01');`

### 3. "Config API returning empty response / Failed to fetch"
- **Root Cause**: The `config-ui` Express server has silently crashed or the proxy port mapped is incorrectly resolved.
- **Verify**: Open task manager or Linux equivalent. Check if `node.exe` connected to port `3001` exists (`netstat -ano | findstr :3001`).
- **Fix**: Relaunch `Run_Config_UI_Admin.bat` or inspect `error.txt` inside `config-ui/server/`. 

### 4. "Ingestion Memory usage spiking excessively (OOM Crash)"
- **Root Cause**: The DB has locked up, meaning the `BatchQueue` is stuck. `messageBuffer` accumulates elements rapidly triggering out-of-memory.
- **Verify**: Run `SELECT * FROM pg_stat_activity WHERE state = 'active'` in PostgreSQL to check for long-running uncommitted queries blocking the queue. 
- **Fix**: Restart the `postgres.exe` service manually. The Ingestion Engine drops oldest 10% automatically when the buffer hits 5000, so node recovery handles itself once the DB unlocks.

### 5. "ANPR violation counts severely duplicated"
- **Root Cause**: The internal camera software is repeating the physical event 5 times.
- **Verify**: Evaluate `SELECT * FROM anpr_event_fact WHERE plate_number='XYZ'` and check `event_10s_bucket`.
- **Fix**: There is already a `10s_bucket` trigger built to deduplicate. If duplication leaks through, it implies the camera's repeating intervals exceed 10 seconds. You must expand the temporal duration inside the DB `trigger_set_anpr_bucket`.

---

## ⚠️ Assumptions & Risks

> [!WARNING] 
> - **Scaling Limits**: The batch-size is currently capped safely. Testing suggests up to a theoretical max of ~2,000 alerts/sec on moderate commodity hardware before Node process bottlenecks. 
> - **Data Loss Risks**: Buffers are kept strictly in RAM. In the case of a hard crash (e.g., power failure), un-flushed MQTT messages contained in the `messageBuffer` will be permanently lost as there is no Persistent message queue.
> - **In-Place DB Update Risks**: Heavy mutation load on `live_camera_state`. Heavy concurrency on the identical `camera_id` relies completely on the Node.js serial execution queue. Modification to `BatchQueue` logic can cause DB deadlock.
