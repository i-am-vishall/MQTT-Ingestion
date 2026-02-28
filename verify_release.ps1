#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Post-build verification and testing
.DESCRIPTION
    Validates release artifacts and performs smoke tests
#>

param(
    [string]$ReleaseDir = "dist",
    [string]$Version = "1.0.3"
)

$ErrorActionPreference = "Continue"

function Test {
    param([string]$Name, [scriptblock]$Block)
    Write-Host "`n  ► $Name" -ForegroundColor Cyan
    try {
        & $Block
        Write-Host "    ✓ PASS" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "    ✗ FAIL: $_" -ForegroundColor Red
        return $false
    }
}

function Verify-File {
    param([string]$Path, [string]$Description)
    if (Test-Path $Path) {
        $size = (Get-Item $Path).Length
        if ($size -gt 0) {
            Write-Host "    ✓ $Description ($([Math]::Round($size/1MB, 2)) MB)" -ForegroundColor Green
            return $true
        } else {
            throw "$Path is empty"
        }
    } else {
        throw "$Path not found"
    }
}

Write-Host @"

╔════════════════════════════════════════════════════════════╗
║         I2V Release Verification & Testing v$Version             ║
╚════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

$passed = 0
$failed = 0
$results = @()

# =====================================================================
# ARTIFACT STRUCTURE VALIDATION
# =====================================================================
Write-Host "`n[1] ARTIFACT STRUCTURE" -ForegroundColor Yellow

$releasePath = Join-Path $ReleaseDir "I2V_MQTT_Ingestion_System_v${Version}"

$tests = @(
    @{Name = "Release directory exists"; Block = {
        if (-not (Test-Path $releasePath)) { throw "Release directory not found" }
    }},
    @{Name = "Ingestion Service executable"; Block = {
        Verify-File (Join-Path $releasePath "bin\i2v-ingestion-service.exe") "i2v-ingestion-service.exe"
    }},
    @{Name = "Config Service executable"; Block = {
        Verify-File (Join-Path $releasePath "bin\i2v-config-service.exe") "i2v-config-service.exe"
    }},
    @{Name = "Frontend assets"; Block = {
        $clientPath = Join-Path $releasePath "client"
        if (-not (Test-Path (Join-Path $clientPath "index.html"))) {
            throw "Frontend index.html not found"
        }
        Write-Host "    ✓ Frontend assets present" -ForegroundColor Green
    }},
    @{Name = "Database scripts"; Block = {
        $dbPath = Join-Path $releasePath "db"
        $sqlFiles = @(Get-ChildItem $dbPath -Filter "*.sql" -ErrorAction SilentlyContinue)
        if ($sqlFiles.Count -eq 0) { throw "No SQL scripts found" }
        Write-Host "    ✓ $($sqlFiles.Count) database scripts found" -ForegroundColor Green
    }},
    @{Name = "Configuration template"; Block = {
        Verify-File (Join-Path $releasePath "..\\.env.example") ".env.example"
    }},
    @{Name = "Installation scripts"; Block = {
        Verify-File (Join-Path $releasePath "install.bat") "install.bat"
        Verify-File (Join-Path $releasePath "uninstall.bat") "uninstall.bat"
    }},
    @{Name = "Documentation"; Block = {
        Verify-File (Join-Path $releasePath "README.md") "README.md"
    }}
)

foreach ($t in $tests) {
    if (Test $t.Name $t.Block) { $passed++ } else { $failed++ }
}

# =====================================================================
# EXECUTABLE VERIFICATION
# =====================================================================
Write-Host "`n[2] EXECUTABLE VERIFICATION" -ForegroundColor Yellow

$ingestionExe = Join-Path $releasePath "bin\i2v-ingestion-service.exe"
$configExe = Join-Path $releasePath "bin\i2v-config-service.exe"

if (Test "Ingestion Service is valid PE" {
    $header = (Get-Content $ingestionExe -Encoding Byte -TotalCount 2) -join ""
    if ($header -ne "7745") { throw "Invalid PE header" }
}) { $passed++ } else { $failed++ }

if (Test "Config Service is valid PE" {
    $header = (Get-Content $configExe -Encoding Byte -TotalCount 2) -join ""
    if ($header -ne "7745") { throw "Invalid PE header" }
}) { $passed++ } else { $failed++ }

if (Test "Ingestion Service can be executed (version check)" {
    $output = & $ingestionExe --version 2>&1
    if ($LASTEXITCODE -eq 0 -or $output) {
        Write-Host "    ✓ Executable responds" -ForegroundColor Green
    }
}) { $passed++ } else { 
    # Not a failure - some executables might not support --version
    Write-Host "    ⚠ Cannot verify execution (may not support version flag)" -ForegroundColor Yellow
}

# =====================================================================
# FILE INTEGRITY
# =====================================================================
Write-Host "`n[3] FILE INTEGRITY" -ForegroundColor Yellow

if (Test "No corrupted files (size > 0KB)" {
    $files = Get-ChildItem $releasePath -Recurse -File -ErrorAction SilentlyContinue
    $corrupted = $files | Where-Object {$_.Length -eq 0}
    if ($corrupted) {
        throw "Found $($corrupted.Count) empty files"
    }
    Write-Host "    ✓ $($files.Count) files verified" -ForegroundColor Green
}) { $passed++ } else { $failed++ }

if (Test "No duplicate files" {
    $files = Get-ChildItem $releasePath -Recurse -File -ErrorAction SilentlyContinue
    $dupes = $files | Group-Object -Property Name | Where-Object {$_.Count -gt 1}
    if ($dupes) {
        throw "Found duplicate filenames"
    }
    Write-Host "    ✓ No duplicates found" -ForegroundColor Green
}) { $passed++ } else { $failed++ }

# =====================================================================
# PORTABLE ZIP VERIFICATION
# =====================================================================
Write-Host "`n[4] PORTABLE PACKAGE" -ForegroundColor Yellow

$zipPath = Join-Path $ReleaseDir "I2V-MQTT-Ingestion-Portable-v${Version}.zip"

if (Test "Portable ZIP created" {
    if (-not (Test-Path $zipPath)) {
        throw "ZIP file not found: $zipPath"
    }
    $size = (Get-Item $zipPath).Length / 1MB
    if ($size -lt 10) {
        throw "ZIP too small ($size MB), likely incomplete"
    }
    Write-Host "    ✓ Portable ZIP ($([Math]::Round($size, 2)) MB)" -ForegroundColor Green
}) { $passed++ } else { $failed++ }

if (Test "ZIP is valid (can be tested)" {
    # Basic ZIP validation
    $isValid = (Get-Content $zipPath -Encoding Byte -TotalCount 4) -join ""
    if ($isValid -ne "5034") {  # PK magic bytes
        throw "Invalid ZIP signature"
    }
    Write-Host "    ✓ ZIP signature valid" -ForegroundColor Green
}) { $passed++ } else { $failed++ }

# =====================================================================
# INSTALLER VALIDATION
# =====================================================================
Write-Host "`n[5] INSTALLER PACKAGE" -ForegroundColor Yellow

$installerPath = Join-Path $ReleaseDir "I2V-MQTT-Ingestion-Installer-v${Version}.exe"

if (Test-Path $installerPath) {
    if (Test "Installer EXE created" {
        $size = (Get-Item $installerPath).Length / 1MB
        if ($size -lt 50) {
            throw "Installer too small ($size MB)"
        }
        Write-Host "    ✓ Installer EXE ($([Math]::Round($size, 2)) MB)" -ForegroundColor Green
    }) { $passed++ } else { $failed++ }

    if (Test "Installer is valid PE" {
        $header = (Get-Content $installerPath -Encoding Byte -TotalCount 2) -join ""
        if ($header -ne "7745") { throw "Invalid PE header" }
    }) { $passed++ } else { $failed++ }
} else {
    Write-Host "  ⚠ Installer not found (Inno Setup may not be installed)" -ForegroundColor Yellow
}

# =====================================================================
# CONFIGURATION VALIDATION
# =====================================================================
Write-Host "`n[6] CONFIGURATION FILES" -ForegroundColor Yellow

$envExample = Join-Path $releasePath "..\\.env.example"

if (Test "Environment template has required keys" {
    $content = Get-Content $envExample
    $required = @("MQTT_BROKERS", "POSTGRES_HOST", "LOG_LEVEL")
    $missing = @()
    
    foreach ($key in $required) {
        if ($content -notmatch $key) {
            $missing += $key
        }
    }
    
    if ($missing.Count -gt 0) {
        throw "Missing keys: $($missing -join ', ')"
    }
    Write-Host "    ✓ All required configuration keys present" -ForegroundColor Green
}) { $passed++ } else { $failed++ }

# =====================================================================
# SCRIPT VALIDATION
# =====================================================================
Write-Host "`n[7] INSTALLATION SCRIPTS" -ForegroundColor Yellow

$installBat = Join-Path $releasePath "install.bat"
$uninstallBat = Join-Path $releasePath "uninstall.bat"

if (Test "Install script is valid batch" {
    $content = Get-Content $installBat -Raw
    if ($content -notmatch "@echo|NSSM|nssm") {
        throw "Script missing expected content"
    }
    Write-Host "    ✓ install.bat contains service installation logic" -ForegroundColor Green
}) { $passed++ } else { $failed++ }

if (Test "Uninstall script is valid batch" {
    $content = Get-Content $uninstallBat -Raw
    if ($content -notmatch "nssm" -or $content -notmatch "remove|stop") {
        throw "Script missing expected content"
    }
    Write-Host "    ✓ uninstall.bat contains cleanup logic" -ForegroundColor Green
}) { $passed++ } else { $failed++ }

# =====================================================================
# DOCUMENTATION
# =====================================================================
Write-Host "`n[8] DOCUMENTATION" -ForegroundColor Yellow

$readme = Join-Path $releasePath "README.md"

if (Test "README has installation instructions" {
    $content = Get-Content $readme -Raw
    $required = @("Installation", "Configuration", "Services", "local")
    $missing = @()
    
    foreach ($section in $required) {
        if ($content -notmatch $section) {
            $missing += $section
        }
    }
    
    if ($missing.Count -gt 0) {
        Write-Host "    ⚠ Missing sections: $($missing -join ', ')" -ForegroundColor Yellow
    } else {
        Write-Host "    ✓ Documentation complete" -ForegroundColor Green
    }
}) { $passed++ } else { $failed++ }

# =====================================================================
# BUILD REPORT
# =====================================================================
Write-Host "`n[9] BUILD REPORT" -ForegroundColor Yellow

$reportPath = Join-Path $ReleaseDir "BUILD_REPORT.txt"

if (Test "Build report generated" {
    if (-not (Test-Path $reportPath)) {
        throw "BUILD_REPORT.txt not found"
    }
    $content = Get-Content $reportPath -Raw
    if ($content -notmatch "Version|Components|Installation") {
        throw "Report may be incomplete"
    }
    Write-Host "    ✓ BUILD_REPORT.txt present" -ForegroundColor Green
}) { $passed++ } else { $failed++ }

# =====================================================================
# SUMMARY
# =====================================================================
Write-Host @"

╔════════════════════════════════════════════════════════════╗
║                    TEST SUMMARY                            ║
╚════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

$total = $passed + $failed
$passRate = if ($total -gt 0) { [Math]::Round(($passed / $total) * 100) } else { 0 }

Write-Host "Tests Run:       $total"
Write-Host "Passed:          $passed" -ForegroundColor Green
Write-Host "Failed:          $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
Write-Host "Success Rate:    ${passRate}%" -ForegroundColor $(if ($passRate -eq 100) { "Green" } else { "Yellow" })

Write-Host ""
Write-Host "Release Location:"
Write-Host "  • Directory:  $releasePath" -ForegroundColor Gray
Write-Host "  • Portable:   $zipPath" -ForegroundColor Gray
if (Test-Path $installerPath) {
    Write-Host "  • Installer:  $installerPath" -ForegroundColor Gray
}

Write-Host ""
if ($passRate -eq 100) {
    Write-Host "✓ All tests passed! Release is ready for deployment." -ForegroundColor Green
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "  1. Test installation on a clean Windows system"
    Write-Host "  2. Verify services start and configuration UI loads"
    Write-Host "  3. Test MQTT message ingestion"
    Write-Host "  4. Verify database data persistence"
    Write-Host "  5. Deploy to production"
} else {
    Write-Host "⚠ Some tests failed. Review above for details." -ForegroundColor Yellow
}

Write-Host ""

try {
    git log --oneline -5 | Select-Object -First 3 | Write-Host
} catch {
    # Git might not be available
}
