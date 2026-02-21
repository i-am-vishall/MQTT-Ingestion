const fs = require('fs');
const path = require('path');

const RAW_PATH = path.join(__dirname, '../../grafana/crowd_raw.json');
const FINAL_PATH = path.join(__dirname, '../../grafana/crowd.json');

try {
    let dashboard = fs.readFileSync(RAW_PATH, 'utf8');

    // 1. Table Name: "EventLogs" -> mqtt_events
    // Regex handles escaped quotes if present in JSON string content
    dashboard = dashboard.replace(/public\.\\"EventLogs\\"/g, 'mqtt_events');
    dashboard = dashboard.replace(/\\"EventLogs\\"/g, 'mqtt_events');
    dashboard = dashboard.replace(/public\."EventLogs"/g, 'mqtt_events');
    dashboard = dashboard.replace(/"EventLogs"/g, 'mqtt_events');

    // 2. Time Column: "EventTriggeredTime" -> event_time
    dashboard = dashboard.replace(/\\"EventTriggeredTime\\"/g, 'event_time');
    dashboard = dashboard.replace(/"EventTriggeredTime"/g, 'event_time');

    // 3. Event Name: "EventName" -> event_type
    dashboard = dashboard.replace(/\\"EventName\\"/g, 'event_type');
    dashboard = dashboard.replace(/"EventName"/g, 'event_type');

    // 4. Camera Name: "ResourceName" -> payload->>'cameraName'
    // This is the tricky one. In SQL it appears as "ResourceName" (quoted).
    // Replacement: payload->>'cameraName'
    dashboard = dashboard.replace(/\\"ResourceName\\"/g, "payload->>'cameraName'");
    dashboard = dashboard.replace(/"ResourceName"/g, "payload->>'cameraName'");

    // 5. Properties Extraction:
    // Old: "_EventProperties"->>'count'
    // New: payload->'properties'->>'count'
    // We need to handle both escaped and unescaped versions just in case.

    // Replace "_EventProperties"->> with payload->'properties'->>
    // Note: The key is quoted "count".

    // Strategy: replace "_EventProperties" with payload->'properties'
    dashboard = dashboard.replace(/\\"_EventProperties\\"/g, "payload->'properties'");
    dashboard = dashboard.replace(/"_EventProperties"/g, "payload->'properties'");

    // 6. Fix UID to ${DS_POSTGRES} for portability
    // Find "uid": "cf3ssgw87tmv4b" (or whatever was in the file)
    // Actually, safest is to replace the specific datasource UIDs found in the file.
    // The user's file has "uid": "cf3ssgw87tmv4b" for postgres.
    dashboard = dashboard.replace(/"uid": "cf3ssgw87tmv4b"/g, '"uid": "${DS_POSTGRES}"');

    // Write output
    fs.writeFileSync(FINAL_PATH, dashboard);
    console.log('Successfully created crowd.json with updated schema.');

} catch (err) {
    console.error('Error processing dashboard:', err);
}
