$proc = Get-Process influxdb3 -ErrorAction SilentlyContinue
if ($proc) {
    Write-Host "Process Running (Id: $($proc.Id))"
    Write-Host "Listening Ports:"
    netstat -ano | Select-String $proc.Id
}
else {
    Write-Host "Process NOT Running"
}
