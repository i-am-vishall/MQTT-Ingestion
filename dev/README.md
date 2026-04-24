# Dev Environment — Startup Guide

All scripts are in this `dev/` folder. Run them **as Administrator**.

---

## Prerequisites
Make sure PostgreSQL service is running before starting any other service.

---

## Scripts

### 1. `start_db.bat` — Start PostgreSQL
```
dev\start_db.bat
```
- Starts the `i2v-mqtt-ingestion-PGSQL-5441` Windows service
- Database: `mqtt_alerts_db` on `127.0.0.1:5441`
- Safe to run — only starts if not already running

---

### 2. `start_ingestion.bat` — Start Ingestion Service (Dev Mode)
```
dev\start_ingestion.bat
```
- Runs `ingestion-service/src/index.js` directly with `node`
- Logs are live in the terminal (no NSSM, no background)
- Reads config from `../.env`
- **Does NOT touch the production NSSM service**
- Press `Ctrl+C` to stop

---

### 3. `start_ui.bat` — Start Config Dashboard
```
dev\start_ui.bat
```
- Opens **two terminal windows**:
  - **Backend** → `http://localhost:3001` (Express API)
  - **Frontend** → `http://localhost:5173` (Vite dev server)
- Auto-installs `node_modules` if missing
- Close the terminal windows to stop

---

## Environments

| Environment | Entry Point | How to Start | How to Stop |
|---|---|---|---|
| **Dev** (local) | `ingestion-service/src/index.js` | `dev\start_ingestion.bat` | `Ctrl+C` in terminal |
| **Production** | `C:\Program Files (x86)\i2v-MQTT-Ingestion\ingestion-service\src\index.js` | `net start i2v-MQTT-Ingestion-Service` | `net stop i2v-MQTT-Ingestion-Service` |
| **Config UI Dev** | `config-ui/server/index.js` | `dev\start_ui.bat` | Close terminal windows |
| **Config UI Prod** | NSSM service `i2v-config-ui` | `net start i2v-config-ui` | `net stop i2v-config-ui` |

> **IMPORTANT:** Never run both Dev and Prod ingestion at the same time — they both write to the same database tables.
