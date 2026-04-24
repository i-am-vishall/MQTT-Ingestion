<#
.SYNOPSIS
    I2V MQTT Log Cleanup — Scheduled Fallback
    Deletes compressed .log.gz files older than 14 days across all I2V service log dirs.
    Run this daily via Windows Task Scheduler as a safety net.

.EXAMPLE
    # Register as a daily scheduled task (run once as Admin):
    schtasks /create /tn "I2V Log Cleanup" /tr "powershell -ExecutionPolicy Bypass -File 'C:\Program Files (x86)\i2v-MQTT-Ingestion\scripts\log_cleanup.ps1'" /sc daily /st 02:00 /ru SYSTEM /f
#>

$ErrorActionPreference = "SilentlyContinue"
$MaxAgeDays = 14
$MaxErrorAgeDays = 30

$LogRoots = @(
    "C:\Program Files (x86)\i2v-MQTT-Ingestion\logs",
    "C:\ProgramData\I2V\Logs",
    "C:\Users\mevis\MQTT-Ingetsion\logs",
    "C:\Users\mevis\MQTT-Ingetsion\ingestion-service\logs",
    "C:\Users\mevis\MQTT-Ingetsion\config-ui\server\logs"
)

$cutoffDate = (Get-Date).AddDays(-$MaxAgeDays)
$errorCutoffDate = (Get-Date).AddDays(-$MaxErrorAgeDays)
$totalDeleted = 0
$totalFreed = 0

Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] I2V Log Cleanup Starting..." -ForegroundColor Cyan
Write-Host "  Cutoff (regular logs): $cutoffDate"
Write-Host "  Cutoff (error logs):   $errorCutoffDate"

foreach ($logRoot in $LogRoots) {
    if (-not (Test-Path $logRoot)) { continue }

    Write-Host "`n  Scanning: $logRoot" -ForegroundColor Yellow

    # Regular logs (14 days)
    Get-ChildItem -Path $logRoot -Recurse -File -Include "*.log", "*.log.gz" |
        Where-Object { $_.Name -notmatch "error" -and $_.LastWriteTime -lt $cutoffDate } |
        ForEach-Object {
            $size = $_.Length
            Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
            if (-not (Test-Path $_.FullName)) {
                Write-Host "    Deleted: $($_.Name) ($([Math]::Round($size/1KB, 1)) KB)" -ForegroundColor Gray
                $totalDeleted++
                $totalFreed += $size
            }
        }

    # Error logs (30 days - keep longer)
    Get-ChildItem -Path $logRoot -Recurse -File -Include "*error*.log", "*error*.log.gz" |
        Where-Object { $_.LastWriteTime -lt $errorCutoffDate } |
        ForEach-Object {
            $size = $_.Length
            Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
            if (-not (Test-Path $_.FullName)) {
                Write-Host "    Deleted error log: $($_.Name) ($([Math]::Round($size/1KB, 1)) KB)" -ForegroundColor Gray
                $totalDeleted++
                $totalFreed += $size
            }
        }
}

$freedMB = [Math]::Round($totalFreed / 1MB, 2)
Write-Host "`n[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Cleanup Complete: $totalDeleted files deleted, $freedMB MB freed" -ForegroundColor Green
