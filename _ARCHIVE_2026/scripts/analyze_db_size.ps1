$ErrorActionPreference = "Stop"

$psqlPath = "C:\Program Files (x86)\i2v-MQTT-Ingestion\pgsql\bin\psql.exe"
$dbHost = "127.0.0.1"
$dbPort = "5441"
$dbUser = "postgres"
$dbName = "mqtt_alerts_db"

$env:PGPASSWORD = ""

if (-not (Test-Path $psqlPath)) {
    Write-Error "PSQL not found at: $psqlPath"
    exit 1
}

$query = "SELECT schemaname || '.' || relname AS ""Table"", pg_size_pretty(pg_total_relation_size(relid)) AS ""Size"", pg_total_relation_size(relid) AS ""RawBytes"", n_live_tup AS ""EstRows"" FROM pg_catalog.pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC;"

Write-Host "Running analysis..."

$process = Start-Process -FilePath $psqlPath -ArgumentList "-h", $dbHost, "-p", $dbPort, "-U", $dbUser, "-d", $dbName, "-c", $query -Wait -NoNewWindow -PassThru

if ($process.ExitCode -ne 0) {
    Write-Error "PSQL failed with exit code $($process.ExitCode)"
}
