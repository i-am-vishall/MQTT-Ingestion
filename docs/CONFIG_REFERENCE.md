# ⚙️ Configuration Reference — I2V MQTT Ingestion System
> Every `.env` variable explained — what it does, what breaks if it's wrong, and safe defaults.

---

## File Location
The service searches for `.env` in this priority order:
1. `<exe_dir>/.env` — same folder as the `.exe` (production)
2. `<cwd>/.env` — current working directory
3. `<__dirname>/../.env` — relative to source
4. `C:\Program Files (x86)\i2v-MQTT-Ingestion\.env` — hardcoded production fallback

If not found: service starts with defaults and logs a warning. **It will NOT crash.**

---

## Current `.env` (Production Values)

```env
# ── MQTT Brokers ─────────────────────────────────────────────────────
MQTT_BROKER_URL=mqtt://103.205.115.74:1883,mqtt://103.205.114.241:1883,mqtt://127.0.0.1:1883
MQTT_BROKER_ID=VMS_103_205_115_74,ANPR_103_205_114_241,LOCAL_MQTT
MQTT_TOPICS=#

# ── Database ──────────────────────────────────────────────────────────
DB_USER=postgres
DB_HOST=127.0.0.1
DB_NAME=mqtt_alerts_db
DB_PASSWORD=
DB_PORT=5441

# ── Ingestion Tuning ──────────────────────────────────────────────────
BATCH_SIZE=5000
BATCH_TIMEOUT=1000
DIRECT_BATCH_SIZE=500
DIRECT_FLUSH_MS=200

# ── Cluster Workers ───────────────────────────────────────────────────
MIN_NODE_WORKERS=2
MAX_NODE_WORKERS=12

# ── Logging ───────────────────────────────────────────────────────────
LOG_LEVEL=info
DEBUG_MODE=true
DEBUG_MODE_CONFIG=false
DEBUG_MODE_INGESTION=false

# ── Service Ports ─────────────────────────────────────────────────────
PORT=3001
MQTT_PORT=1883
HEALTH_PORT=3333
ADMIN_USER=admin
ADMIN_PASS=admin@123

# ── Redis ─────────────────────────────────────────────────────────────
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_MAX_MEMORY=2gb
REDIS_EVICTION_POLICY=allkeys-lru
REDIS_STREAM_MAXLEN=2000000
REDIS_STREAM_NAME=mqtt:ingest
REDIS_CONSUMER_GROUP=workers

# ── Ingestion Mode ────────────────────────────────────────────────────
SHOCK_ABSORBER_MODE=false

# ── Data Retention ────────────────────────────────────────────────────
DB_RETENTION_DAYS=30
```

---

## Variable Reference

### MQTT Configuration

| Variable | Default | Type | Description |
|----------|---------|------|-------------|
| `MQTT_BROKER_URL` | `mqtt://127.0.0.1:1883` | Comma-separated URLs | MQTT brokers to connect to. Each URL creates one independent MQTT client connection. |
| `MQTT_BROKER_ID` | *(auto-generated)* | Comma-separated strings | Human-readable names for each broker. Count **must match** `MQTT_BROKER_URL` count or service throws at startup. If empty, IDs auto-generated as `Source_Server_IP`. |
| `MQTT_TOPICS` | `#` | Comma-separated topic patterns | Topics to subscribe to. `#` = all topics (wildcard). |
| `MQTT_PORT` | `1883` | Integer | Port for the LOCAL Mosquitto broker only (not used by ingestion service itself). |

**⚠️ Critical:** If `MQTT_BROKER_ID` count ≠ `MQTT_BROKER_URL` count, service throws:
```
Error: MQTT_BROKER_ID count (2) does not match MQTT_BROKER_URL count (3)
```

---

### Database Configuration

| Variable | Default | Type | Description |
|----------|---------|------|-------------|
| `DB_HOST` | `127.0.0.1` | String | PostgreSQL host |
| `DB_PORT` | `5441` | Integer | **Non-standard port** (avoids conflict with system PostgreSQL on 5432) |
| `DB_NAME` | `mqtt_alerts_db` | String | Database name |
| `DB_USER` | `postgres` | String | PostgreSQL user |
| `DB_PASSWORD` | *(empty)* | String | Password. Leave empty for local trust authentication. |

**Connection pool settings (hardcoded in config.js):**
- `max: 20` — maximum pool connections
- `idleTimeoutMillis: 30000` — 30s idle timeout

---

### Ingestion Tuning

| Variable | Default | Type | Description |
|----------|---------|------|-------------|
| `BATCH_SIZE` | `2000` | Integer | Events to accumulate before triggering a DB flush. Higher = fewer DB round-trips but higher memory usage. |
| `BATCH_TIMEOUT` | `3000` | Integer (ms) | Maximum time to wait before flushing a partial batch. Prevents events sitting in buffer forever at low load. |
| `DIRECT_BATCH_SIZE` | `500` | Integer | Batch size for direct-write mode (SHOCK_ABSORBER_MODE=false). Smaller = lower latency. |
| `DIRECT_FLUSH_MS` | `200` | Integer (ms) | Flush interval for direct mode. |

**Tuning Guide:**
- **High throughput (>500 EPS):** `BATCH_SIZE=5000`, `BATCH_TIMEOUT=1000`
- **Low latency (<50 EPS):** `BATCH_SIZE=100`, `BATCH_TIMEOUT=500`
- **Circuit breaker fires (DB slow):** Reduce `BATCH_SIZE`, check DB indexes

---

### Ingestion Mode

| Variable | Default | Values | Description |
|----------|---------|--------|-------------|
| `SHOCK_ABSORBER_MODE` | `false` | `true`/`false` | **Redis buffer mode.** When `true`: MQTT → Redis Stream → DB (decoupled). When `false`: MQTT → in-memory buffer → DB (direct). |

**When to use Redis mode (`true`):**
- EPS > 500 sustained
- DB occasionally slow (latency spikes)
- Multiple worker processes (cluster mode)

**When to use Direct mode (`false`):**
- Single server, moderate load
- Redis not installed/available
- Lower infrastructure complexity preferred

---

### Redis Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `127.0.0.1` | Redis server host |
| `REDIS_PORT` | `6379` | Redis server port |
| `REDIS_MAX_MEMORY` | `2gb` | Max memory Redis can use (set in redis.conf) |
| `REDIS_EVICTION_POLICY` | `allkeys-lru` | What Redis drops when full (LRU = oldest first) |
| `REDIS_STREAM_MAXLEN` | `2000000` | Max entries in `mqtt:ingest` stream. At ~500 bytes/event = ~1GB. |
| `REDIS_STREAM_NAME` | `mqtt:ingest` | Redis stream key name |
| `REDIS_CONSUMER_GROUP` | `workers` | Consumer group name for `xreadgroup` |

---

### Worker Cluster

| Variable | Default | Description |
|----------|---------|-------------|
| `MIN_NODE_WORKERS` | `2` | Minimum worker processes in cluster mode (`cluster.js`) |
| `MAX_NODE_WORKERS` | `12` | Maximum worker processes |

**Note:** `cluster.js` is separate from `index.js`. Running `node index.js` directly runs single-process mode (most common in production). Cluster mode is for extreme load scenarios.

---

### Logging

| Variable | Default | Values | Description |
|----------|---------|--------|-------------|
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` | Global log level. `debug` is very verbose — use only for troubleshooting. |
| `LOG_LEVEL_INGESTION` | *(inherits LOG_LEVEL)* | Same | Ingestion service specific log level override |
| `DEBUG_MODE` | `true` | `true`/`false` | Enables heartbeat status logs every 30s (buffer size, memory, etc.) |
| `DEBUG_MODE_INGESTION` | `false` | `true`/`false` | Enables per-event debug logging in ingestion service |
| `DEBUG_MODE_CONFIG` | `false` | `true`/`false` | Enables debug logging in Config UI server |

**Log Files Location:**
- Ingestion service: `<install_dir>/logs/ingestion-*.log` (rotated daily via `winston-daily-rotate-file`)
- Normalization debug: `<cwd>/logs/normalization_debug.log`
- Config UI: `config-ui/server/service.log`

---

### Service Ports

| Variable | Default | Service | Description |
|----------|---------|---------|-------------|
| `HEALTH_PORT` | `3333` | Ingestion service | HTTP health check server. Listens on `127.0.0.1` only (not exposed externally). |
| `PORT` | `3001` | Config UI | Config UI web server port. Access via `http://localhost:3001` |
| `MQTT_PORT` | `1883` | Mosquitto | Local MQTT broker port (for reference in scripts) |

---

### Admin / Auth

| Variable | Default | Description |
|----------|---------|-------------|
| `ADMIN_USER` | `admin` | Username for Config UI login |
| `ADMIN_PASS` | `admin@123` | Password for Config UI login. **Change in production!** |

---

### Data Retention

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_RETENTION_DAYS` | `30` | Number of days to retain data. Records older than this are deleted by the daily retention job. Applies to all fact tables and metrics tables. |

---

## Impact Matrix — What Breaks If Wrong

| Wrong Setting | Impact |
|---|---|
| `DB_PORT` wrong | Service exits at startup with "connection refused" |
| `MQTT_BROKER_ID` count mismatch | Service throws config error and won't start |
| `BATCH_SIZE` too high (>10000) | High memory usage, potential OOM crash |
| `BATCH_TIMEOUT` too high (>30000) | Events sit in memory for 30s before persisting — data loss risk on crash |
| `SHOCK_ABSORBER_MODE=true` with no Redis | Falls back gracefully to direct mode, logs error |
| `LOG_LEVEL=debug` in production | Massive log files, 10-100x more I/O |
| `DB_RETENTION_DAYS=1` | Deletes ALL data older than 1 day on startup! |
| `MQTT_TOPICS` wrong | No events received (silence — no error) |
| `ADMIN_PASS` default in production | Security risk — Config UI accessible with known credentials |

---

*Part of the I2V MQTT Ingestion Bible | docs/CONFIG_REFERENCE.md*
