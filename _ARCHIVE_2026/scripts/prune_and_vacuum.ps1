param(
    [int]$RetentionDays = 30
)

$ErrorActionPreference = "Stop"

$psqlPath = "C:\Program Files (x86)\i2v-MQTT-Ingestion\pgsql\bin\psql.exe"
$dbHost = "127.0.0.1"
$dbPort = "5441"
$dbUser = "postgres"
$dbName = "mqtt_alerts_db"
$serviceName = "i2v-mqtt-ingestion-service"

$env:PGPASSWORD = ""
$env:PAGER = ""

if (-not (Test-Path $psqlPath)) {
    Write-Error "PSQL executable not found at $psqlPath"
    exit 1
}

# 1. Stop Service
Write-Host "Stopping service $serviceName..."
Stop-Service -Name $serviceName -Force
# Wait a bit for full stop
Start-Sleep -Seconds 5

try {
    # 2. Delete Old Data
    Write-Host "Connecting to DB to delete data older than $RetentionDays days..."
    
    $deleteSql = @"
    DO `$`$
    BEGIN
        RAISE NOTICE 'Deleting from mqtt_events...';
        DELETE FROM mqtt_events WHERE event_time < NOW() - INTERVAL '$RetentionDays days';
        
        RAISE NOTICE 'Deleting from anpr_event_fact...';
        -- Check if table exists first or wrap in exception block if unsure, but assuming it exists
        BEGIN
            DELETE FROM anpr_event_fact WHERE event_time < NOW() - INTERVAL '$RetentionDays days';
        EXCEPTION WHEN undefined_table THEN
            RAISE NOTICE 'anpr_event_fact table not found, skipping.';
        END;
    END `$`$;
"@
    
    # We use a file for the query to avoid quoting issues
    $queryFile = "$PSScriptRoot\cleanup_query.sql"
    Set-Content -Path $queryFile -Value $deleteSql
    
    & $psqlPath -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $queryFile
    
    # 3. Optimize / Vacuum
    Write-Host "Running VACUUM FULL to reclaim disk space. This may take a while..."
    & $psqlPath -h $dbHost -p $dbPort -U $dbUser -d $dbName -c "VACUUM FULL;"

    Write-Host "Cleanup complete."
    
}
catch {
    Write-Error "An error occurred during DB operations: $_"
}
finally {
    # 4. Start Service
    Write-Host "Starting service $serviceName..."
    Start-Service -Name $serviceName
    
    if (Test-Path $queryFile) { Remove-Item $queryFile }
}
