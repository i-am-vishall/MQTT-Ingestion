const fs = require('fs');
const path = require('path');

const DASHBOARD_PATH = path.join(__dirname, '../../grafana/anpr.json');

try {
    let dashboard = fs.readFileSync(DASHBOARD_PATH, 'utf8');

    // Global Replacements for SQL syntax (Handling JSON escaped quotes)

    // 1. Table Name
    // Matches public.\"EventLogs\" or \"EventLogs\"
    dashboard = dashboard.replace(/public\\."EventLogs\\"/g, 'mqtt_events');
    dashboard = dashboard.replace(/\\"EventLogs\\"/g, 'mqtt_events');

    // 2. Column Names
    dashboard = dashboard.replace(/\\"EventTriggeredTime\\"/g, 'event_time');
    dashboard = dashboard.replace(/\\"EventName\\"/g, 'event_type');
    dashboard = dashboard.replace(/\\"Id\\"/g, 'id');

    // 3. JSONB Column
    dashboard = dashboard.replace(/\\"_EventProperties\\"/g, 'payload');

    // 4. Fix datasource UID if not already templated (optional, but good practice)
    // The previous step might have done this, but ensuring regex safety
    // We already handled ${DS_POSTGRES} in the write, but raw SQLs are strings.

    // Special tweaks:
    // "EventName" = 'ANPR' -> event_type = 'ANPR'
    // Ensure 'ANPR' matches what might be in the database? 
    // If the DB has 'Crowd_Detected', this dashboard will filter them out.
    // For verification purposes, maybe we should COMMENT OUT the WHERE clause?
    // No, strictly follow user request "Update anpr.json". They likely want the queries fixed for the schema.

    // Write back
    fs.writeFileSync(DASHBOARD_PATH, dashboard);
    console.log('Successfully updated anpr.json with schema mappings.');

} catch (err) {
    console.error('Failed to update dashboard:', err);
}
