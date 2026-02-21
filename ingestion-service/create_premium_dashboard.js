
const fs = require('fs');

const inputFile = 'c:\\Users\\mevis\\MQTT-Ingetsion\\ingestion-service\\dashboard_fixed.json';
const outputFile = 'c:\\Users\\mevis\\MQTT-Ingetsion\\ingestion-service\\dashboard_premium.json';

const dashboard = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

// Helper to create a grid position that flows (simple vertical stacking for now)
let maxY = 0;
dashboard.panels.forEach(p => {
    if (p.gridPos.y + p.gridPos.h > maxY) maxY = p.gridPos.y + p.gridPos.h;
});
const nextY = () => {
    const current = maxY;
    maxY += 8; // move down by 8 units for next
    return current;
};

// 1. "Cameras Breaching Threshold" (Stat Panel)
// Query: COUNT of cameras where crowd_count > 80 (Simulated threshold)
const breachPanel = {
    "type": "stat",
    "title": "⚠️ Overcrowded Cameras (>80 ppl)",
    "gridPos": { "h": 6, "w": 8, "x": 0, "y": nextY() },
    "datasource": { "type": "grafana-postgresql-datasource", "uid": "bf78vb3wtk7i8a" },
    "targets": [{
        "rawSql": "SELECT COUNT(*) as value FROM vw_live_dashboard WHERE crowd_count > 80 AND camera_status = 'ONLINE'",
        "format": "table",
        "refId": "A"
    }],
    "options": {
        "colorMode": "background",
        "graphMode": "none",
        "justifyMode": "auto"
    },
    "fieldConfig": {
        "defaults": {
            "thresholds": {
                "mode": "absolute",
                "steps": [{ "color": "green", "value": 0 }, { "color": "red", "value": 1 }]
            },
            "mappings": [{ "type": "value", "options": { "0": { "text": "None", "color": "green" } } }]
        }
    }
};

// 2. "Top 5 Most Crowded Locations" (Table/BarGauge)
// Query: Top 5 by crowd_count
const top5Panel = {
    "type": "bargauge",
    "title": "📍 Top 5 Most Crowded Locations",
    "gridPos": { "h": 6, "w": 16, "x": 8, "y": maxY - 8 }, // Beside the previous one
    "datasource": { "type": "grafana-postgresql-datasource", "uid": "bf78vb3wtk7i8a" },
    "targets": [{
        "rawSql": "SELECT camera_name, crowd_count FROM vw_live_dashboard WHERE camera_status = 'ONLINE' ORDER BY crowd_count DESC LIMIT 5",
        "format": "table",
        "refId": "A"
    }],
    "options": {
        "displayMode": "lcd",
        "orientation": "horizontal",
        "showUnfilled": true
    }
};

// 3. "Camera Health Summary" (Pie Chart or Stat)
// Query: Status Counts
const healthPanel = {
    "type": "stat", // Stat is safer than Pie if plugin missing
    "title": "⚙️ System Health (Online Cameras)",
    "gridPos": { "h": 6, "w": 8, "x": 0, "y": nextY() },
    "datasource": { "type": "grafana-postgresql-datasource", "uid": "bf78vb3wtk7i8a" },
    "targets": [{
        "rawSql": "SELECT \n  SUM(CASE WHEN camera_status = 'ONLINE' THEN 1 ELSE 0 END) as online,\n  SUM(CASE WHEN camera_status = 'OFFLINE' THEN 1 ELSE 0 END) as offline\nFROM vw_live_dashboard",
        "format": "table",
        "refId": "A"
    }],
    "options": {
        "colorMode": "value",
        "graphMode": "none"
    }
};

// 4. "Stale Data / Blind Spots" (Table)
// Query: List Offline Cameras
const stalePanel = {
    "type": "table",
    "title": "🛑 Blind Spots (Offline / Stale > 2min)",
    "gridPos": { "h": 6, "w": 16, "x": 8, "y": maxY - 8 },
    "datasource": { "type": "grafana-postgresql-datasource", "uid": "bf78vb3wtk7i8a" },
    "targets": [{
        "rawSql": "SELECT camera_name, last_event_time FROM live_camera_state WHERE last_event_time < NOW() - INTERVAL '2 minutes'",
        "format": "table",
        "refId": "A"
    }],
    "fieldConfig": {
        "defaults": {
            "color": { "mode": "thresholds" },
            "thresholds": { "mode": "absolute", "steps": [{ "color": "red", "value": 0 }] }
        }
    }
};

// 5. "Crowd Inflow Trend" (Time Series from Metrics)
// Query: Sum of all cameras per minute
const trendPanel = {
    "type": "timeseries",
    "title": "🔄 Total Crowd Flow (Last 15m)",
    "gridPos": { "h": 8, "w": 24, "x": 0, "y": nextY() },
    "datasource": { "type": "grafana-postgresql-datasource", "uid": "bf78vb3wtk7i8a" },
    "targets": [{
        "rawSql": "SELECT bucket_time as time, SUM(crowd_count) as value FROM camera_metrics_1min WHERE $__timeFilter(bucket_time) GROUP BY bucket_time ORDER BY bucket_time",
        "format": "table",
        "refId": "A"
    }]
};

dashboard.panels.push(breachPanel, top5Panel, healthPanel, stalePanel, trendPanel);

fs.writeFileSync(outputFile, JSON.stringify(dashboard, null, 2));
console.log(`Generated Premium Dashboard with ${dashboard.panels.length} panels.`);
