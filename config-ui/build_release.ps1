$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   BUILDING CONFIG UI PRODUCTION RELEASE  " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$ROOT_DIR = Get-Location
$CLIENT_DIR = Join-Path $ROOT_DIR "client"
$SERVER_DIR = Join-Path $ROOT_DIR "server"
$RELEASE_DIR = Join-Path $ROOT_DIR "release"

# 1. Clean previous release
if (Test-Path $RELEASE_DIR) {
    Write-Host "Cleaning previous release..." -ForegroundColor Yellow
    Remove-Item -Path $RELEASE_DIR -Recurse -Force
}
New-Item -Path $RELEASE_DIR -ItemType Directory | Out-Null

# 2. Build Frontend
Write-Host "`n[1/3] Building Frontend (Vite)..." -ForegroundColor Green
Set-Location $CLIENT_DIR
try {
    npm install
    npm run build
}
catch {
    Write-Error "Frontend build failed!"
}

# Copy Frontend to Release
$CLIENT_DEST = Join-Path $RELEASE_DIR "client/dist"
New-Item -Path (Join-Path $RELEASE_DIR "client") -ItemType Directory | Out-Null
Copy-Item -Path (Join-Path $CLIENT_DIR "dist") -Destination $CLIENT_DEST -Recurse -Force
Write-Host "Frontend built and copied to $CLIENT_DEST" -ForegroundColor Gray

# 3. Build Backend (PKG)
Write-Host "`n[2/3] Packaging Backend (PKG)..." -ForegroundColor Green
Set-Location $SERVER_DIR
try {
    npm install
    # Ensure pkg is installed (using npx to avoid global req)
    npx pkg . --targets node18-win-x64 --output (Join-Path $RELEASE_DIR "config-ui-server.exe") --compress GZip
}
catch {
    Write-Error "Backend packaging failed!"
}

# Copy Backend Assets
Write-Host "`n[3/3] Copying Assets..." -ForegroundColor Green
Copy-Item -Path (Join-Path $SERVER_DIR ".env") -Destination (Join-Path $RELEASE_DIR ".env") -ErrorAction SilentlyContinue
Copy-Item -Path "devices.json" -Destination (Join-Path $RELEASE_DIR "devices.json") -ErrorAction SilentlyContinue

Set-Location $ROOT_DIR

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "   BUILD COMPLETE SUCCESSFULY             " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Output Directory: $RELEASE_DIR" -ForegroundColor White
Write-Host "To Run:" -ForegroundColor Yellow
Write-Host "  cd release"
Write-Host "  config-ui-server.exe"
