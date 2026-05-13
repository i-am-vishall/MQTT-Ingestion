# 🛠️ Operations Runbook — I2V MQTT Ingestion System
> How to install, run, debug, maintain, and recover the system. Step-by-step.

---

## 🏠 Production Installation Path
```
C:\Program Files (x86)\i2v-MQTT-Ingestion\
├── ingestion-service.exe     ← Compiled Node.js binary (pkg)
├── .env                      ← Master configuration
├── db\
│   ├── init_schema.sql
│   └── auto_partition.sql
├── logs\                     ← Rotating log files
└── vendor\
    ├── mosquitto\             ← MQTT broker
    ├── redis\                 ← Redis server
    └── nssm\                  ← Service manager
```

---

## 🚀 Fresh Installation (New Server)

### Prerequisites
- Windows Server 2016+ or Windows 10+
- PostgreSQL 15 installed (port 5441)
- Network access to MQTT brokers

### Step 1 — Run Installer
```powershell
# As Administrator
.\scripts\Install_On_New_Server.ps1
```
This will:
1. Create install directory
2. Copy all binaries
3. Register 5 Windows Services with NSSM
4. Initialize PostgreSQL database schema
5. Start all services

### Step 2 — Verify Installation
```batch
scripts\Verify_Installation.bat
```

### Step 3 — Configure `.env`
Edit `C:\Program Files (x86)\i2v-MQTT-Ingestion\.env`:
- Set `MQTT_BROKER_URL` to your broker IPs
- Set `MQTT_BROKER_ID` names (must match URL count)
- Set `DB_PASSWORD` if PostgreSQL has a password
- Set `ADMIN_PASS` to something secure

### Step 4 — Restart Ingestion Service
```batch
scripts\Update_And_Restart_Services.bat
```

---

## 🔄 Service Management

### Check All Service Status
```powershell
Get-Service | Where-Object { $_.Name -like "i2v-*" } | Select-Object Name, Status
```

### Start / Stop / Restart Individual Service
```powershell
Start-Service   i2v-ingestion
Stop-Service    i2v-ingestion
Restart-Service i2v-ingestion

Start-Service   i2v-config-ui
Restart-Service i2v-redis
Restart-Service i2v-mqtt-broker
```

### Check Ingestion is Running
```powershell
Invoke-RestMethod http://127.0.0.1:3333/health
```
Expected response:
```json
{
  "status": "UP",
  "uptime": 3600,
  "ingestion": { "total": 45231, "buffer": 0 },
  "timestamp": "2026-05-14T00:00:00.000Z"
}
```

### Check All Broker Health
```powershell
Invoke-RestMethod http://127.0.0.1:3333/health/brokers
```

---

## 🔧 Common Operations

### Hot-Deploy Code Update (No Reinstall)
```batch
# Copy new exe, restart service — zero manual steps
scripts\Update_And_Restart_Services.bat
```

### Apply Database Schema Update
```batch
scripts\Setup_and_Verify_DB.bat
```
Or manually:
```powershell
& "C:\Program Files (x86)\i2v-MQTT-Ingestion\vendor\postgresql\bin\psql.exe" `
  -U postgres -p 5441 -d mqtt_alerts_db `
  -f "C:\Program Files (x86)\i2v-MQTT-Ingestion\db\init_schema.sql"
```

### Run Monthly Partition + Retention Cleanup
```batch
scripts\Run_Auto_Partition.bat
```
This runs `auto_partition.sql` which:
1. Creates next month's `mqtt_events` partition
2. Deletes all data older than 30 days
3. Drops partition tables older than 2 months

> ⚠️ **Schedule this monthly** (Windows Task Scheduler) to avoid missing partition gaps.

### Add New MQTT Broker
1. Edit `.env`:
   ```env
   MQTT_BROKER_URL=mqtt://existing1:1883,mqtt://existing2:1883,mqtt://NEW_IP:1883
   MQTT_BROKER_ID=ID_1,ID_2,NEW_ID
   ```
2. Restart ingestion service:
   ```powershell
   Restart-Service i2v-ingestion
   ```
3. Verify in broker health:
   ```powershell
   Invoke-RestMethod http://127.0.0.1:3333/health/brokers
   ```

### Reset Config UI Password
1. Edit `.env`: `ADMIN_PASS=newpassword`
2. `Restart-Service i2v-config-ui`

---

## 🔍 Debugging Guide

### No Events Being Ingested

**Step 1 — Check MQTT connection:**
```powershell
Invoke-RestMethod http://127.0.0.1:3333/health/brokers
# Look for "status": "CONNECTED" on each broker
```

**Step 2 — Check DB connection:**
```powershell
Invoke-RestMethod http://127.0.0.1:3333/health
# If status != "UP", DB is the issue
```

**Step 3 — Check logs:**
```powershell
Get-Content "C:\Program Files (x86)\i2v-MQTT-Ingestion\logs\ingestion-*.log" -Tail 50
```

**Step 4 — Enable debug mode temporarily:**
```env
DEBUG_MODE_INGESTION=true
LOG_LEVEL=debug
```
Restart service. Now you'll see per-event logs.

---

### Events Received But Not in Database

**Check batch flush errors in logs:**
```powershell
Select-String -Path "logs\*.log" -Pattern "Failed to insert batch"
```

**Check DB table exists:**
```sql
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'mqtt_events';
```

**Manual schema restore:**
```batch
scripts\Setup_and_Verify_DB.bat
```

**Check partition exists for current month:**
```sql
SELECT relname FROM pg_class
WHERE relname LIKE 'mqtt_events_2026%' ORDER BY relname;
```
If current month missing → run `Run_Auto_Partition.bat`

---

### High Memory Usage

**Symptoms:** Service consuming >500MB RAM

**Check buffer size:**
```powershell
(Invoke-RestMethod http://127.0.0.1:3333/health).ingestion.buffer
```
If buffer > 1000, DB writes are slow.

**Check circuit breaker:**
Look in logs for: `CRITICAL: DB Latency high! Tripping Circuit Breaker.`

**Fix options:**
- Lower `BATCH_SIZE` (e.g. 500)
- Add PostgreSQL index
- Switch to `SHOCK_ABSORBER_MODE=true` to decouple load

---

### Database Growing Too Large

**Check table sizes:**
```sql
SELECT
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Immediate cleanup:**
```batch
scripts\Run_Auto_Partition.bat
```

**Reduce retention window:**
```env
DB_RETENTION_DAYS=7
```
Restart service → runs cleanup on startup.

---

### Config UI Not Loading

**Step 1 — Check service:**
```powershell
Get-Service i2v-config-ui
```

**Step 2 — Check port:**
```powershell
netstat -ano | findstr :3001
```

**Step 3 — Check for port conflict:**
```batch
scripts\Fix_ConfigUI_Service.bat
```

**Step 4 — Restart manually:**
```batch
scripts\Start_Config_UI_Manual.bat
```

---

### Grafana Showing Wrong Timestamps

**Symptom:** Events show as 5:30 hours ahead or behind

**Root Cause:** IST timezone not set on DB session

**Fix:** Already applied in v6.0 — `SET timezone = 'Asia/Kolkata'` fires on every connection.

**Verify:**
```sql
SHOW timezone;  -- Should show: Asia/Kolkata
```

---

## 📊 Monitoring Checklist (Daily)

| Check | Command | Expected |
|-------|---------|---------|
| Service running | `Get-Service i2v-ingestion` | Running |
| Health endpoint | `curl http://127.0.0.1:3333/health` | `status: UP` |
| Events flowing | Check `total` counter increasing | > 0 |
| All brokers connected | `/health/brokers` | All `CONNECTED` |
| No circuit breaker | Check logs for "Circuit Breaker" | Not present |
| DB disk space | Check PostgreSQL data directory | < 80% full |

---

## 🚨 Emergency Recovery

### Service Won't Start After Crash
```powershell
# 1. Check what error stopped it
Get-EventLog -LogName Application -Source "i2v-ingestion" -Newest 10

# 2. Run self-check
& "C:\Program Files (x86)\i2v-MQTT-Ingestion\ingestion-service.exe" --check

# 3. Reset and restart
Stop-Service i2v-ingestion -Force
Start-Service i2v-ingestion
```

### Database Corrupted / Tables Deleted
The **self-healing watchdog** auto-restores within 5 minutes.

Force immediate restore:
```batch
scripts\Setup_and_Verify_DB.bat
```
Then restart ingestion service — watchdog re-runs on startup too.

### Redis Down / Full
```powershell
Restart-Service i2v-redis
```
Service falls back to direct DB mode automatically. No data loss.
After Redis recovers, set `SHOCK_ABSORBER_MODE=false` temporarily if Redis keeps failing.

### Complete System Reset (Nuclear Option)
```batch
scripts\production_uninstall.bat
# Wait for all services to stop
scripts\production_install.bat
```
This preserves the PostgreSQL database data directory.

---

## 📋 Scheduled Tasks (Windows Task Scheduler)

Set up these tasks for long-term health:

| Task | Script | Schedule |
|------|--------|---------|
| Monthly partition creation | `Run_Auto_Partition.bat` | 1st of each month |
| Log cleanup | `scripts\log_cleanup.ps1` | Weekly |
| DB vacuum | Manual `VACUUM ANALYZE;` | Weekly |

---

## 🏗️ Build & Release Process

### Build New Release
```powershell
# Full build from source
.\scripts\build_production_release.ps1
```
This produces a `release/` folder with:
- `ingestion-service.exe` (compiled binary)
- `config-ui/` (built React + Node server)
- All vendor binaries
- Schema files

### Deploy to Production
```batch
scripts\Update_And_Restart_Services.bat
```

---

*Part of the I2V MQTT Ingestion Bible | docs/OPERATIONS_RUNBOOK.md*
