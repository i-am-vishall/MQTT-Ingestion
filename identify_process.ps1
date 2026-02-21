$pidStr = "8436"
$proc = Get-Process -Id $pidStr -ErrorAction SilentlyContinue
if ($proc) {
    Write-Host "Process on 8181: $($proc.ProcessName) (ID: $($proc.Id)) Path: $($proc.Path)"
}
else {
    Write-Host "Process $pidStr not found."
}
