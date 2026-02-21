$ips = 106..225 | ForEach-Object { "`"192.168.1.$_`"" }
$ipList = $ips -join ", "
Write-Host "urls = [$ipList]"
