# I2V MQTT Ingestion System - Quick Reference Card

## 🚀 INSTALL (5 minutes)
```powershell
# 1. Extract
Expand-Archive dist\I2V-MQTT-Ingestion-Portable-v1.0.3.zip -DestinationPath C:\I2V

# 2. Configure  
cd C:\I2V\I2V_MQTT_Ingestion_System_v1.0.3
Copy-Item .env.example .env
# Edit .env: MQTT_BROKERS, POSTGRES_* settings

# 3. Database
psql -U postgres -d i2v_ingestion -f db\init_schema.sql

# 4. Install Services (as Admin)
.\install.bat

# 5. Access Dashboard
Start-Process http://localhost:3001
```

## 🔧 SERVICE COMMANDS
```powershell
# Start
net start I2V-Ingestion-Service
net start I2V-Config-Service

# Stop
net stop I2V-Ingestion-Service
net stop I2V-Config-Service

# Status
Get-Service -Name "I2V-*"
nssm status I2V-Ingestion-Service

# Remove
nssm remove I2V-Ingestion-Service confirm
nssm remove I2V-Config-Service confirm
```

## 🏥 HEALTH CHECKS
```powershell
# Ingestion Service
curl http://localhost:3333/health

# Brokers Status
curl http://localhost:3333/health/brokers

# Config Service
curl http://localhost:3001/api/health

# Database
psql -U postgres -d i2v_ingestion -c "SELECT COUNT(*) FROM anpr_events;"
```

## 📊 VIEW LOGS
```powershell
# Last 50 lines
Get-Content C:\I2V\logs\ingestion.log -Tail 50

# Real-time monitoring
Get-Content C:\I2V\logs\ingestion.log -Wait

# Errors only
Select-String "error" C:\I2V\logs\*.log -i

# Windows Event Viewer
Get-WinEvent -LogName Application | Where-Object {$_.Message -like "*I2V*"}
```

## 🔨 BUILD FROM SOURCE
```powershell
cd c:\Users\mevis\MQTT-Ingetsion

# Full build
.\build.ps1 -Version "1.0.3"

# Verify artifacts
.\verify_release.ps1 -Version "1.0.3"

# Run tests
npm test
```

## ⚙️ CONFIGURATION (.env)
```env
# MQTT (comma-separated for multiple brokers)
MQTT_BROKERS=localhost:1883,broker2:1883

# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_DB=i2v_ingestion
POSTGRES_USER=postgres
POSTGRES_PASSWORD=yourpassword

# Services
LOG_LEVEL=info
HEALTH_PORT=3333
CONFIG_PORT=3001

# Batch Processing
BATCH_SIZE=1000
BATCH_TIMEOUT_MS=5000
```

## 📚 DOCUMENTATION
| File | Purpose |
|------|---------|
| **START_HERE.md** | Navigation & overview |
| **README.md** | Quick start (2 min) |
| **DEPLOYMENT_GUIDE.md** | Installation guide |
| **BUILD_PROCESS.md** | Building from source |
| **README_COMPLETE.md** | Full technical reference |

## 🔐 DEFAULT CREDENTIALS
```
Admin Login: admin
Change Password: First login required
Location: http://localhost:3001/login

Note: Hardcoded password replaced with PBKDF2 hashing
See DEPLOYMENT_GUIDE for password reset
```

## 📂 KEY DIRECTORIES
```
C:\I2V\I2V_MQTT_Ingestion_System_v1.0.3\
├── bin\                  ← EXE executables
├── client\               ← Frontend assets
├── db\                   ← Database scripts
├── logs\                 ← Service logs
├── .env                  ← Configuration (EDIT THIS)
├── install.bat           ← Service setup
└── uninstall.bat         ← Service removal
```

## ✅ VERIFICATION CHECKLIST
- [ ] Services running: `Get-Service -Name I2V-*`
- [ ] Ingestion health: `curl http://localhost:3333/health`
- [ ] Dashboard: `http://localhost:3001`
- [ ] Database: `psql -c "SELECT 1;"`
- [ ] Logs check: `Get-Content C:\I2V\logs\*.log`
- [ ] MQTT test: `mosquitto_pub -t test -m test`

## 🆘 TROUBLESHOOTING
| Problem | Solution |
|---------|----------|
| Services won't start | Check .env settings, verify database accessible |
| Can't access dashboard | Check port 3001 not in use: `netstat -ano \| findstr :3001` |
| Database connection error | Verify PostgreSQL running: `Get-Service postgresql*` |
| MQTT connection fails | Test broker: `Test-NetConnection localhost -Port 1883` |
| High CPU/Memory | Reduce BATCH_SIZE in .env, restart services |

## 🔗 IMPORTANT LINKS
- **GitHub**: https://github.com/i-am-vishall/MQTT-Ingestion
- **Dashboard**: http://localhost:3001
- **Health API**: http://localhost:3333/health
- **Release**: dist/I2V-MQTT-Ingestion-Portable-v1.0.3.zip

## 📊 SYSTEM SPECS
- **Version**: 1.0.3
- **Node.js**: 18.x+
- **PostgreSQL**: 12+
- **MQTT**: 3.1+ compatible
- **Windows**: 10/11 or Server 2019+
- **Memory**: 2+ GB RAM
- **Disk**: 500+ MB

## 🎯 WHAT'S INCLUDED
✅ 3 Critical Bug Fixes
✅ 128 Passing Tests
✅ PBKDF2 Authentication
✅ Rate Limiting & Audit Logs
✅ Health Monitoring
✅ React Dashboard
✅ Configuration Management
✅ Windows Services
✅ Complete Documentation

## 💡 TIPS
- Edit .env before installing services
- Always run install.bat as Administrator
- Check logs when troubleshooting
- Health endpoints show real-time status
- Use rate-limited admin login (5 attempts/15min)
- Batch size affects throughput vs latency tradeoff

---

**Status**: Production Ready
**Last Updated**: January 15, 2024
**Questions**: See START_HERE.md or DEPLOYMENT_GUIDE.md
