$ErrorActionPreference = "Stop"

$zipPath = "C:\Users\mevis\Downloads\influxdb3-core-3.8.0-windows_amd64.zip"
$destPath = "C:\Users\mevis\MQTT-Ingetsion\monitoring\influxdb"

Write-Host "Unzipping $zipPath to $destPath..."
if (-not (Test-Path $destPath)) {
    New-Item -ItemType Directory -Force -Path $destPath | Out-Null
}

Expand-Archive -LiteralPath $zipPath -DestinationPath $destPath -Force

Write-Host "Contents of ${destPath}:"
Get-ChildItem -Path $destPath -Recurse | Select-Object FullName
