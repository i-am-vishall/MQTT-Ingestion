# I2V MQTT Ingestion System - Deployment & Operations Guide

## Table of Contents
1. [Pre-Deployment Requirements](#pre-deployment-requirements)
2. [Installation Methods](#installation-methods)
3. [Configuration](#configuration)
4. [Service Management](#service-management)
5. [Verification & Testing](#verification--testing)
6. [Troubleshooting](#troubleshooting)
7. [Monitoring & Health Checks](#monitoring--health-checks)
8. [Upgrades & Maintenance](#upgrades--maintenance)

---

## Pre-Deployment Requirements

### System Requirements
- **Operating System**: Windows 10/11 (64-bit) or Windows Server 2019+
- **Memory**: 2+ GB RAM minimum, 4+ GB recommended
- **Disk Space**: 500+ MB for application, additional space for logs and database
- **Network**: TCP connectivity to MQTT broker and PostgreSQL database
- **Ports**:
  - 3001 (Config UI - HTTP)
  - 3333 (Ingestion Service Health - HTTP)
  - 5432 (PostgreSQL, if local)
  - 1883 (MQTT, if local)

### Software Prerequisites
- **PostgreSQL**: 12+ (local or remote)
- **MQTT Broker**: Mosquitto, HiveMQ, or compatible 3.1+ broker
- **Windows Services**: NSSM (Network Service Script Manager) for Windows service management
- **Administrative Rights**: Required for service installation

### Prerequisites Installation

#### 1. PostgreSQL (Windows)
```powershell
# Download installer from https://www.postgresql.org/download/windows/
msiexec /i postgresql-15-x64-installer.exe /qb

# Verify installation
psql --version
```

#### 2. MQTT Broker (Mosquitto example)
```powershell
# Download from https://mosquitto.org/download/
# For Windows: Use official installer or WSL2

# Test connectivity
netstat -an | findstr :1883
```

#### 3. NSSM (Service Manager)
```powershell
# Download from https://nssm.cc/download

# Extract to Program Files
Expand-Archive nssm-2.24-101-g897c7ad.zip -DestinationPath "C:\Program Files\NSSM"

# Add to PATH
$path = [Environment]::GetEnvironmentVariable("PATH", "User")
[Environment]::SetEnvironmentVariable("PATH", "$path;C:\Program Files\NSSM\win64", "User")

# Verify
nssm --version
```

---

## Installation Methods

### Method 1: Automated Installer (Recommended)

```powershell
# 1. Run installer as Administrator
Start-Process -FilePath "I2V-MQTT-Ingestion-Installer-v1.0.3.exe" -Verb RunAs

# 2. Follow installation wizard
# 3. Configure environment (automatic services start)
# 4. Verify installation
Get-Service -Name "I2V-Ingestion-Service", "I2V-Config-Service"
```

**Advantages**:
- Automatic service registration
- Database initialization prompts
- Desktop shortcuts created
- Uninstall support

### Method 2: Portable ZIP Deployment

```powershell
# 1. Extract to installation directory
Expand-Archive "I2V-MQTT-Ingestion-Portable-v1.0.3.zip" -DestinationPath "C:\I2V"

# 2. Navigate to installation
cd C:\I2V\I2V_MQTT_Ingestion_System_v1.0.3

# 3. Configure environment
Copy-Item ".env.example" -Path ".env"
# Edit .env with your settings (see Configuration section)

# 4. Install services (run as Administrator)
.\install.bat

# 5. Initialize database
psql -U postgres -d postgres -f db\init_schema.sql
```

### Method 3: Manual Deployment

```powershell
# 1. Create installation directory
New-Item -Path "C:\I2V" -ItemType Directory -Force

# 2. Copy application files
Copy-Item "dist\I2V_MQTT_Ingestion_System_v1.0.3\*" -Destination "C:\I2V" -Recurse

# 3. Create environment file
@{
    MQTT_BROKERS="localhost:1883"
    POSTGRES_HOST="localhost"
    POSTGRES_PORT="5432"
    POSTGRES_DB="i2v_ingestion"
    POSTGRES_USER="postgres"
    POSTGRES_PASSWORD="postgres"  # CHANGE THIS!
    LOG_LEVEL="info"
} | ConvertTo-Json | Out-File "C:\I2V\.env"

# 4. Register services
nssm install I2V-Ingestion-Service "C:\I2V\bin\i2v-ingestion-service.exe"
nssm install I2V-Config-Service "C:\I2V\bin\i2v-config-service.exe"

# 5. Configure service logging
nssm set I2V-Ingestion-Service AppDirectory "C:\I2V"
nssm set I2V-Ingestion-Service AppStdout "C:\I2V\logs\ingestion.log"
nssm set I2V-Ingestion-Service AppStderr "C:\I2V\logs\ingestion-error.log"

nssm set I2V-Config-Service AppDirectory "C:\I2V"
nssm set I2V-Config-Service AppStdout "C:\I2V\logs\config.log"
nssm set I2V-Config-Service AppStderr "C:\I2V\logs\config-error.log"

# 6. Start services
nssm start I2V-Ingestion-Service
nssm start I2V-Config-Service
```

---

## Configuration

### Environment Variables (.env)

Create `.env` file in installation root:

```env
# MQTT Configuration
MQTT_BROKERS=localhost:1883,broker2.example.com:1883
MQTT_USERNAME=username
MQTT_PASSWORD=password
MQTT_USE_TLS=false
MQTT_TLS_VERIFY=false

# PostgreSQL Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=i2v_ingestion
POSTGRES_USER=postgres
POSTGRES_PASSWORD=secure_password_here
POSTGRES_SSL=false

# Service Configuration
LOG_LEVEL=info              # debug, info, warn, error
LOG_FILE=logs/app.log
LOG_MAX_SIZE=10485760       # 10MB
LOG_MAX_FILES=10

# Ingestion Service
BATCH_SIZE=1000
BATCH_TIMEOUT_MS=5000
HEALTH_PORT=3333
HEALTH_CHECK_INTERVAL=30000

# Config UI Service
CONFIG_PORT=3001
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=see-secure-auth-below
SESSION_SECRET=generate-random-string-here
RATE_LIMIT_WINDOW=900000    # 15 minutes
RATE_LIMIT_MAX_REQUESTS=5
```

### Secure Admin Authentication

Generate secure password hash:

```powershell
# Run in PowerShell
$password = "YourSecurePassword123!"

# Use PBKDF2 (100,000 iterations)
$bytes = [System.Text.Encoding]::UTF8.GetBytes($password)
$salt = [byte[]]@()
for ($i = 0; $i -lt 16; $i++) {
    $salt += Get-Random -Minimum 0 -Maximum 256
}

$pbkdf2 = New-Object System.Security.Cryptography.Rfc2898DeriveBytes(
    $password, $salt, 100000
)
$hash = [Convert]::ToBase64String($pbkdf2.GetBytes(32))
$saltB64 = [Convert]::ToBase64String($salt)

Write-Host "ADMIN_PASSWORD_HASH=$saltB64:$hash"
```

Add to `.env`:
```env
ADMIN_PASSWORD_HASH=base64_salt:base64_hash
```

### Database Configuration

Initialize PostgreSQL database:

```powershell
# Connect to PostgreSQL
psql -U postgres -h localhost

# Create database
CREATE DATABASE i2v_ingestion OWNER postgres;

# Exit and run initialization scripts
psql -U postgres -d i2v_ingestion -f db/init_schema.sql
psql -U postgres -d i2v_ingestion -f db/init_mapping_schema.sql
```

---

## Service Management

### Start/Stop Services

```powershell
# ===== Start Services =====
# Ingestion Service
net start I2V-Ingestion-Service

# Config Service
net start I2V-Config-Service

# Start all (Admin)
Get-Service -Name I2V-* | Start-Service

# ===== Stop Services =====
# Ingestion Service
net stop I2V-Ingestion-Service

# Config Service
net stop I2V-Config-Service

# Stop all (Admin)
Get-Service -Name I2V-* | Stop-Service
```

### Check Service Status

```powershell
# Service status
Get-Service -Name I2V-Ingestion-Service, I2V-Config-Service

# Detailed status
nssm status I2V-Ingestion-Service
nssm status I2V-Config-Service

# Running processes
Get-Process | Where-Object {$_.ProcessName -like "*i2v*"}
```

### Configure Startup Behavior

```powershell
# Set to auto-start on boot
nssm set I2V-Ingestion-Service Start SERVICE_AUTO_START
nssm set I2V-Config-Service Start SERVICE_AUTO_START

# Set to manual start
nssm set I2V-Ingestion-Service Start SERVICE_DEMAND_START

# Set startup delay (30 seconds)
nssm set I2V-Ingestion-Service AppThrottle 30000
```

### Service Recovery Policy

```powershell
# Configure automatic restart on failure
nssm set I2V-Ingestion-Service AppExit Default Restart
nssm set I2V-Ingestion-Service AppRestartDelay 10000  # 10 seconds

# Same for Config Service
nssm set I2V-Config-Service AppExit Default Restart
nssm set I2V-Config-Service AppRestartDelay 10000
```

---

## Verification & Testing

### 1. Service Health Checks

```powershell
# Check Ingestion Service Health
Invoke-WebRequest http://localhost:3333/health | Select-Object -ExpandProperty Content

# Check specific broker connection
Invoke-WebRequest http://localhost:3333/health/brokers | ConvertFrom-Json | Format-Table

# Check Config UI Health
Invoke-WebRequest http://localhost:3001/api/health | ConvertFrom-Json
```

**Expected Responses**:

```json
# Ingestion Health
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:45Z",
  "brokers": {
    "total": 2,
    "connected": 2,
    "healthy": 2
  },
  "database": "connected",
  "queue": {
    "pending": 0,
    "processed": 12543
  }
}

# Config UI Health
{
  "status": "ok",
  "service": "config-ui",
  "timestamp": "2024-01-15T10:30:45Z"
}
```

### 2. Log Verification

```powershell
# View recent logs
Get-Content C:\I2V\logs\ingestion.log -Tail 50

# Monitor logs in real-time
Get-Content C:\I2V\logs\ingestion.log -Wait

# Check for errors
Select-String "error" C:\I2V\logs\*.log -CaseSensitive:$false

# View Windows Event Viewer
Get-WinEvent -LogName Application | Where-Object {$_.Message -like "*I2V*"}
```

### 3. Database Connectivity Test

```powershell
# Test PostgreSQL connection
psql -U postgres -h localhost -d i2v_ingestion -c "SELECT * FROM camera_master LIMIT 1;"

# Check table status
psql -U postgres -h localhost -d i2v_ingestion -c "SELECT tablename FROM pg_tables WHERE schemaname='public';"

# Data ingestion check
psql -U postgres -h localhost -d i2v_ingestion -c "SELECT COUNT(*) FROM anpr_events;"
```

### 4. MQTT Connection Test

```powershell
# Using MQTT client tool
# Install: https://github.com/hivecats/mqtt-explorer

# Or test with mosquitto_sub:
mosquitto_sub -h localhost -t "#" -v

# Publish test message
mosquitto_pub -h localhost -t "camera/test" -m '{"timestamp":"2024-01-15T10:30:45Z"}'
```

### 5. Frontend UI Access

```powershell
# Open Config Dashboard
Start-Process http://localhost:3001

# Expected features:
# - MQTT status
# - Database connection
# - Service metrics
# - Configuration UI
# - Log viewer
```

---

## Troubleshooting

### Services Won't Start

#### Problem: Service fails to start
```powershell
# Check service status
nssm status I2V-Ingestion-Service

# View service error log
Get-Content C:\I2V\logs\ingestion-error.log -Tail 20

# Check permissions
Get-Acl "C:\I2V" | Format-Table

# Fix permissions
icacls "C:\I2V" /grant:r "%USERNAME%":(OI)(CI)F /T
```

#### Problem: Port conflicts
```powershell
# Check which process uses port 3001
netstat -ano | findstr :3001

# Or use Get-NetTCPConnection
Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | 
    Select-Object OwningProcess, @{Name="ProcessName";Expression={(Get-Process -Id $_.OwningProcess).Name}}
```

### Database Connection Issues

```powershell
# Test connection
Test-NetConnection -ComputerName localhost -Port 5432

# Verify PostgreSQL service
Get-Service -Name postgresql-x64-15

# Check connection string
# Edit .env and verify:
# POSTGRES_HOST=localhost
# POSTGRES_PORT=5432
# POSTGRES_DB=i2v_ingestion
# POSTGRES_USER=postgres
# POSTGRES_PASSWORD=yourpassword
```

### MQTT Connection Problems

```powershell
# Test MQTT broker
Test-NetConnection -ComputerName localhost -Port 1883

# Check MQTT logs (if Mosquitto)
Get-Content "C:\Program Files\mosquitto\log.txt" -Tail 20

# Verify MQTT_BROKERS in .env
# Format: host:port,host2:port2

# Test pub/sub
mosquitto_pub -h localhost -t "test" -m "test message"
```

### High CPU or Memory Usage

```powershell
# Monitor resource usage
$proc = Get-Process i2v-ingestion-service
Write-Host "CPU: $($proc.CPU)%"
Write-Host "Memory: $($proc.WorkingSet / 1MB) MB"

# Check queue size
Invoke-WebRequest http://localhost:3333/health | ConvertFrom-Json | 
    Select-Object -ExpandProperty queue

# Adjust batch settings in .env
BATCH_SIZE=500      # Reduce batch size
BATCH_TIMEOUT_MS=3000  # Reduce timeout
```

### Log File Size Management

```powershell
# Check log size
Get-ChildItem C:\I2V\logs | Select-Object Name, @{Name="SizeMB";Expression={$_.Length/1MB}}

# Archive old logs
Get-ChildItem C:\I2V\logs -Filter "*.log" | Where-Object {$_.LastWriteTime -lt (Get-Date).AddDays(-7)} | 
    Move-Item -Destination "C:\I2V\logs\archive"

# Configure rotation in .env
LOG_MAX_SIZE=10485760       # 10 MB
LOG_MAX_FILES=10            # Keep 10 files
```

---

## Monitoring & Health Checks

### Automated Health Monitoring Script

```powershell
# Create health-check.ps1
$healthEndpoint = "http://localhost:3333/health"
$configEndpoint = "http://localhost:3001/api/health"

function Check-Status {
    try {
        $ingestion = Invoke-WebRequest $healthEndpoint -UseBasicParsing | ConvertFrom-Json
        $config = Invoke-WebRequest $configEndpoint -UseBasicParsing | ConvertFrom-Json
        
        $status = @{
            Timestamp = Get-Date
            IngestionService = $ingestion.status
            ConfigService = $config.status
            MqttBrokers = $ingestion.brokers.connected
            DatabaseConnection = $ingestion.database
            QueueSize = $ingestion.queue.pending
        }
        
        return $status
    }
    catch {
        return @{
            Timestamp = Get-Date
            Error = $_.Exception.Message
        }
    }
}

# Run every 5 minutes
while ($true) {
    $status = Check-Status
    if ($status.IngestionService -ne "healthy") {
        Write-Warning "Service health issue: $($status.IngestionService)"
        # Add alerting here (email, Slack, etc.)
    }
    Start-Sleep -Seconds 300
}
```

### Grafana/Prometheus Monitoring

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'i2v-ingestion'
    static_configs:
      - targets: ['localhost:3333']

  - job_name: 'i2v-config'
    static_configs:
      - targets: ['localhost:3001']
```

---

## Upgrades & Maintenance

### Updating to New Version

```powershell
# 1. Stop services
Get-Service -Name I2V-* | Stop-Service

# 2. Backup current installation
Copy-Item "C:\I2V" -Destination "C:\I2V-backup-v1.0.2" -Recurse

# 3. Backup database
mysqldump -u postgres -p i2v_ingestion > "C:\I2V-backup-v1.0.2\database.sql"

# 4. Create release directory
$Version = "1.0.3"
New-Item -Path "C:\I2V-temp\I2V_MQTT_Ingestion_System_v$Version" -ItemType Directory -Recurse

# 5. Extract new release
Expand-Archive "I2V-MQTT-Ingestion-Portable-v$Version.zip" -DestinationPath "C:\I2V-temp"

# 6. Copy bin and client directories
Copy-Item "C:\I2V-temp\I2V_MQTT_Ingestion_System_v$Version\bin" -Destination "C:\I2V" -Recurse -Force
Copy-Item "C:\I2V-temp\I2V_MQTT_Ingestion_System_v$Version\client" -Destination "C:\I2V" -Recurse -Force

# 7. Run any database migrations
psql -U postgres -d i2v_ingestion -f db/migration_to_v1.0.3.sql

# 8. Start services
Get-Service -Name I2V-* | Start-Service

# 9. Verify
Invoke-WebRequest http://localhost:3333/health
```

### Backup & Recovery

```powershell
# Full Backup
$timestamp = Get-Date -Format "yyyy-MM-dd-HHmmss"
$backupPath = "C:\Backups\I2V-$timestamp"

# Create backup directory
New-Item -Path $backupPath -ItemType Directory -Force

# Backup application
Copy-Item "C:\I2V" -Destination "$backupPath\application" -Recurse

# Backup database
mysqldump -u postgres -p i2v_ingestion | Out-File "$backupPath\database.sql"

# Backup configuration
Copy-Item "C:\I2V\.env" -Destination "$backupPath\env.bak"

Write-Host "Backup created at: $backupPath"
```

---

## Support & Resources

- **GitHub Repository**: https://github.com/i-am-vishall/MQTT-Ingestion
- **Documentation**: See included README.md
- **Issue Tracker**: https://github.com/i-am-vishall/MQTT-Ingestion/issues
- **Installation Logs**: `C:\I2V\logs\`
- **Windows Event Viewer**: Application log, source "I2V"
