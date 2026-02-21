$root = "c:\Users\mevis\MQTT-Ingetsion"
$deleted = 0
$skipped = 0

function Del($relPath) {
    $p = Join-Path $script:root $relPath
    if (Test-Path $p) {
        Remove-Item $p -Force -ErrorAction SilentlyContinue
        $script:deleted++
        Write-Host "[DEL] $relPath"
    }
    else {
        $script:skipped++
    }
}

# PHASE 1: Root junk/fragment files
Del "Applying"; Del "Removing"; Del "delete"; Del "start"; Del "stop"
Del "qc"; Del "query"; Del "queryex"
Write-Host "--- Phase 1 (root junk) done ---"

# PHASE 2: Dead code files
Del "ingestion-service\src\logger.js"
Del "config-ui\server\logger.js"
Del "config-ui\client\src\assets\react.svg"
Del "config-ui\client\public\vite.svg"
Write-Host "--- Phase 2 (dead code) done ---"

# PHASE 3: Log/debug output files
Del "analysis_output.txt"; Del "config_manual_debug.log"; Del "manual_db_debug.log"
Del "manual_server.log"; Del "manual_server_2.log"; Del "manual_server_3.log"; Del "manual_server_4.log"
Del "service_debug.log"; Del "service_debug-20260130T060744.305.log"
Del "startup_debug.txt"; Del "sc_output.txt"; Del "service_status.txt"
Del "nssm_path.txt"; Del "pg_service_info.txt"; Del "ingestion_service_info.txt"
Del "telegraf_debug.conf"
Write-Host "--- Phase 3 (log/debug) done ---"

# PHASE 4: Old dashboard JSONs
Del "monitoring\camera_dashboard_old- (1).json"
Del "monitoring\camera_dashboard_old- (2).json"
Del "monitoring\camera_dashboard_old- (3).json"
Del "monitoring\camera_dashboard_old- (4).json"
Del "monitoring\dashboard_upload.json"
Del "ingestion-service\dashboard_v1.json"
Del "ingestion-service\dashboard_fixed.json"
Del "ingestion-service\dashboard_premium.json"
Write-Host "--- Phase 4 (old dashboards) done ---"

# PHASE 5: Sub-project junk
Del "ingestion-service\qc"; Del "ingestion-service\query"
Del "ingestion-service\fix_log.txt"; Del "config-ui\query"
Write-Host "--- Phase 5 (sub-project junk) done ---"

# PHASE 6: Monitoring logs
Del "monitoring\influx_service.err"; Del "monitoring\telegraf.log"
Get-ChildItem -Path (Join-Path $root "monitoring") -Filter "telegraf.2026-*" -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-Item $_.FullName -Force; $script:deleted++; Write-Host "[DEL] monitoring\$($_.Name)"
}
Del "ingestion-service\logs\normalization_debug.log"
Write-Host "--- Phase 6 (monitoring logs) done ---"

# PHASE 7: EXE build artifacts
Del "I2V-Dashboard-Installer.exe"; Del "debug_service.exe"
Del "ingestion-service\ingestion-service.exe"
Del "config-ui\server\config-service.exe"
Del "config-ui\server\i2v-config-service.exe"
Del "config-ui\release\config-ui-server.exe"
Write-Host "--- Phase 7 (EXE artifacts) done ---"

# PHASE 8: Root one-time fix/service scripts
$phase8 = @(
    "fix_and_restart.bat", "fix_config_service.bat", "fix_influx_service_registry.bat",
    "fix_permissions.bat", "fix_service_paths.bat", "fix_services.bat",
    "fix_services_recovery.bat", "force_stop_services.bat", "stop_zombie_service.bat",
    "kill_zombie_port.bat", "reinstall_config_service.bat", "update_binary.bat",
    "update_services.bat", "restart_services_admin.bat", "run_configurator.bat",
    "cleanup_helper.bat", "schema_dump.sql", "simulate_events.js", "verify_production.js",
    "check_influx.ps1", "config_influx.ps1", "debug_influx_start.ps1",
    "gen_ips.ps1", "identify_process.ps1", "run_telegraf_debug.ps1",
    "setup_influx.ps1", "start_influx.ps1", "update_production_env.ps1",
    "verify_data_ingestion.ps1", "list_tables.js",
    "CI_CD_PROJECT_ANALYSIS.md", "DEEP_CODEBASE_ANALYSIS.md"
)
foreach ($f in $phase8) { Del $f }
Write-Host "--- Phase 8 (root scripts) done ---"

# PHASE 9: ingestion-service root diagnostic scripts
$phase9 = @(
    "check_all_tables.js", "check_anpr_count.js", "check_anpr_health.js", "check_anpr_latest.js",
    "check_camera_master.js", "check_constraints.js", "check_health_table.js",
    "check_ingestion_status.js", "check_live_camera_state_count.js", "check_metrics_data.js",
    "check_permissions.js", "check_rules_count.js", "check_status.js",
    "check_table.js", "check_table_compact.js", "debug_config.js", "debug_grafana_query.js",
    "dump_debug.js", "dump_live_json.js", "dump_live_state.js", "dump_schema.js",
    "execute_sql.js", "fix_anpr_bucket.js", "fix_dashboard.js", "fix_live_state_schema.js",
    "fix_schema.js", "fix_source_id.js", "create_premium_dashboard.js", "populate_defaults.js",
    "read_log_end.js", "read_new_log.js", "read_sql.js", "read_unified_schema.js",
    "restore_db.js", "restore_safe.js", "sync_camera_master.js", "test_broker_connection.js",
    "update_rules.js", "verify_view.js", "apply_mapping_schema.js", "apply_view.js"
)
foreach ($f in $phase9) { Del "ingestion-service\$f" }
Write-Host "--- Phase 9 (ingestion diagnostics) done ---"

Write-Host ""
Write-Host "=== CLEANUP COMPLETE ==="
Write-Host "Deleted: $deleted files"
Write-Host "Skipped (not found): $skipped files"
