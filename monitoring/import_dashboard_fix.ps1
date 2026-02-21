
$jsonContent = Get-Content -Raw -Path "c:\Users\mevis\MQTT-Ingetsion\monitoring\comprehensive_dashboard.json" | ConvertFrom-Json
$body = @{
    dashboard = $jsonContent
    overwrite = $true
} | ConvertTo-Json -Depth 10

# Grafana is on 3101 as per user history
$url = "http://localhost:3101/api/dashboards/db"
$headers = @{
    "Content-Type"  = "application/json"
    "Authorization" = "Basic YWRtaW46YWRtaW4="
}

try {
    $response = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body
    Write-Host "Dashboard Imported Successfully: $($response.url)"
}
catch {
    Write-Error "Failed to import dashboard: $_"
}
