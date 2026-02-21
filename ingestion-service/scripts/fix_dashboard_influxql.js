const fs = require('fs');
const path = require('path');

const dashboard = {
    "annotations": {
        "list": [
            {
                "builtIn": 1,
                "datasource": "-- Grafana --",
                "enable": true,
                "hide": true,
                "iconColor": "rgba(0, 211, 255, 1)",
                "name": "Annotations & Alerts",
                "type": "dashboard"
            }
        ]
    },
    "editable": true,
    "fiscalYearStartMonth": 0,
    "graphTooltip": 0,
    "id": null,
    "links": [],
    "panels": [],
    "refresh": "5s",
    "schemaVersion": 38,
    "style": "dark",
    "tags": ["monitoring", "dynamic", "influxql", "explicit-roles", "no-variables"],
    "templating": {
        "list": []
    },
    "time": {
        "from": "now-5m",
        "to": "now"
    },
    "timepicker": {},
    "timezone": "",
    "title": "Comprehensive Monitoring (Explicit Panels)",
    "uid": "comprehensive-monitoring-final",
    "version": 1,
    "weekStart": ""
};

// --- PANELS CONSTRUCTION ---

// 1. GLOBAL HEALTH (Top Row)
dashboard.panels.push({
    "collapsed": false, "gridPos": { "h": 1, "w": 24, "x": 0, "y": 0 }, "id": 10, "title": "GLOBAL HEALTH", "type": "row"
});

// Total Devices
dashboard.panels.push({
    "datasource": { "type": "influxdb", "uid": "bfags8rjk1o1sc" },
    "gridPos": { "h": 4, "w": 6, "x": 0, "y": 1 },
    "id": 1,
    "options": { "colorMode": "value", "graphMode": "none", "reduceOptions": { "calcs": ["lastNotNull"] } },
    "title": "TOTAL DEVICES",
    "type": "stat",
    "targets": [{ "alias": "Total", "query": "SELECT count(\"last\") FROM (SELECT last(\"percent_packet_loss\") FROM \"ping\" WHERE time > now() - 2m GROUP BY \"url\")", "rawQuery": true, "refId": "A", "resultFormat": "time_series" }]
});

// Global Online
dashboard.panels.push({
    "datasource": { "type": "influxdb", "uid": "bfags8rjk1o1sc" },
    "fieldConfig": { "defaults": { "thresholds": { "mode": "absolute", "steps": [{ "color": "green", "value": null }] } } },
    "gridPos": { "h": 4, "w": 6, "x": 6, "y": 1 },
    "id": 2,
    "options": { "colorMode": "value", "graphMode": "none", "reduceOptions": { "calcs": ["lastNotNull"] } },
    "title": "ONLINE",
    "type": "stat",
    "targets": [{ "alias": "Online", "query": "SELECT count(\"last\") FROM (SELECT last(\"percent_packet_loss\") FROM \"ping\" WHERE \"percent_packet_loss\" < 100 AND time > now() - 2m GROUP BY \"url\")", "rawQuery": true, "refId": "A", "resultFormat": "time_series" }]
});

// Global Offline
dashboard.panels.push({
    "datasource": { "type": "influxdb", "uid": "bfags8rjk1o1sc" },
    "fieldConfig": { "defaults": { "thresholds": { "mode": "absolute", "steps": [{ "color": "red", "value": null }] } } },
    "gridPos": { "h": 4, "w": 6, "x": 12, "y": 1 },
    "id": 3,
    "options": { "colorMode": "value", "graphMode": "none", "reduceOptions": { "calcs": ["lastNotNull"] } },
    "title": "OFFLINE",
    "type": "stat",
    "targets": [{ "alias": "Offline", "query": "SELECT count(\"last\") FROM (SELECT last(\"percent_packet_loss\") FROM \"ping\" WHERE \"percent_packet_loss\" = 100 AND time > now() - 2m GROUP BY \"url\")", "rawQuery": true, "refId": "A", "resultFormat": "time_series" }]
});

// Global Availability
dashboard.panels.push({
    "datasource": { "type": "influxdb", "uid": "bfags8rjk1o1sc" },
    "fieldConfig": { "defaults": { "unit": "percent", "thresholds": { "steps": [{ "color": "red", "value": null }, { "color": "green", "value": 90 }] } } },
    "gridPos": { "h": 4, "w": 6, "x": 18, "y": 1 },
    "id": 4,
    "options": { "colorMode": "value", "graphMode": "none", "reduceOptions": { "calcs": ["lastNotNull"] } },
    "title": "% AVAILABILITY",
    "type": "stat",
    "targets": [{ "alias": "Availability", "query": "SELECT mean(\"percent_packet_loss\") * -1 + 100 FROM \"ping\" WHERE $timeFilter", "rawQuery": true, "refId": "A", "resultFormat": "time_series" }]
});

// 2. EXPLICIT CATEGORY SECTIONS
const roles = ['server', 'camera', 'switch'];
let currentY = 5;

roles.forEach((role, index) => {
    const upperRole = role.toUpperCase();

    // Row Header
    dashboard.panels.push({
        "collapsed": false,
        "gridPos": { "h": 1, "w": 24, "x": 0, "y": currentY },
        "id": 100 + index,
        "title": `${upperRole} HEALTH`,
        "type": "row"
    });
    currentY += 1;

    // Online Panel
    dashboard.panels.push({
        "datasource": { "type": "influxdb", "uid": "bfags8rjk1o1sc" },
        "gridPos": { "h": 4, "w": 8, "x": 0, "y": currentY },
        "id": 200 + index,
        "options": { "colorMode": "value", "graphMode": "none", "reduceOptions": { "calcs": ["lastNotNull"] } },
        "fieldConfig": { "defaults": { "thresholds": { "mode": "absolute", "steps": [{ "color": "green", "value": null }] } } },
        "title": `${upperRole} ONLINE`,
        "type": "stat",
        "targets": [{
            "alias": "Online",
            "query": `SELECT count("last") FROM (SELECT last("percent_packet_loss") FROM "ping" WHERE "percent_packet_loss" < 100 AND "role" = '${role}' AND time > now() - 2m GROUP BY "url")`,
            "rawQuery": true,
            "refId": "A",
            "resultFormat": "time_series"
        }]
    });

    // Offline Panel
    dashboard.panels.push({
        "datasource": { "type": "influxdb", "uid": "bfags8rjk1o1sc" },
        "gridPos": { "h": 4, "w": 8, "x": 8, "y": currentY },
        "id": 300 + index,
        "options": { "colorMode": "value", "graphMode": "none", "reduceOptions": { "calcs": ["lastNotNull"] } },
        "fieldConfig": { "defaults": { "thresholds": { "mode": "absolute", "steps": [{ "color": "red", "value": null }] } } },
        "title": `${upperRole} OFFLINE`,
        "type": "stat",
        "targets": [{
            "alias": "Offline",
            "query": `SELECT count("last") FROM (SELECT last("percent_packet_loss") FROM "ping" WHERE "percent_packet_loss" = 100 AND "role" = '${role}' AND time > now() - 2m GROUP BY "url")`,
            "rawQuery": true,
            "refId": "A",
            "resultFormat": "time_series"
        }]
    });

    // Availability Panel
    dashboard.panels.push({
        "datasource": { "type": "influxdb", "uid": "bfags8rjk1o1sc" },
        "gridPos": { "h": 4, "w": 8, "x": 16, "y": currentY },
        "id": 400 + index,
        "options": { "colorMode": "value", "graphMode": "none", "reduceOptions": { "calcs": ["lastNotNull"] } },
        "fieldConfig": { "defaults": { "unit": "percent", "thresholds": { "steps": [{ "color": "red", "value": null }, { "color": "green", "value": 90 }] } } },
        "title": `${upperRole} AVAILABILITY`,
        "type": "stat",
        "targets": [{
            "alias": "Availability",
            "query": `SELECT mean("percent_packet_loss") * -1 + 100 FROM "ping" WHERE "role" = '${role}' AND $timeFilter`,
            "rawQuery": true,
            "refId": "A",
            "resultFormat": "time_series"
        }]
    });

    currentY += 4;
});

// 3. TREND
dashboard.panels.push({
    "collapsed": false, "gridPos": { "h": 1, "w": 24, "x": 0, "y": currentY }, "id": 500, "title": "TRENDS", "type": "row"
});
currentY += 1;

dashboard.panels.push({
    "datasource": { "type": "influxdb", "uid": "bfags8rjk1o1sc" },
    "gridPos": { "h": 8, "w": 24, "x": 0, "y": currentY },
    "id": 6,
    "title": "Offline Devices (Trend - Global)",
    "type": "timeseries",
    "fieldConfig": {
        "defaults": {
            "decimals": 0,
            "min": 0
        }
    },
    "targets": [{
        "alias": "Offline Count",
        "query": "SELECT max(\"is_offline\") FROM (SELECT floor(\"percent_packet_loss\" / 100) AS \"is_offline\" FROM \"ping\" WHERE $timeFilter) WHERE $timeFilter GROUP BY time(2m) fill(0)",
        "rawQuery": true,
        "refId": "A",
        "resultFormat": "time_series"
    }]
});
currentY += 8;

// 4. STATUS TABLE
dashboard.panels.push({
    "collapsed": false, "gridPos": { "h": 1, "w": 24, "x": 0, "y": currentY }, "id": 600, "title": "DETAILS", "type": "row"
});
currentY += 1;

dashboard.panels.push({
    "datasource": { "type": "influxdb", "uid": "bfags8rjk1o1sc" },
    "gridPos": { "h": 12, "w": 24, "x": 0, "y": currentY },
    "id": 7,
    "title": "Device Status Table",
    "type": "table",
    "fieldConfig": {
        "defaults": {
            "mappings": [
                { "type": "value", "options": { "0": { "text": "ONLINE", "color": "green" }, "100": { "text": "OFFLINE", "color": "red" } } }
            ]
        }
    },
    "targets": [{
        "alias": "status",
        "query": "SELECT last(\"percent_packet_loss\") as \"status\" FROM \"ping\" WHERE $timeFilter GROUP BY \"url\", \"role\"",
        "rawQuery": true,
        "refId": "A",
        "resultFormat": "table"
    }]
});

const outputPath = 'C:\\Users\\mevis\\MQTT-Ingetsion\\monitoring\\comprehensive_dashboard_final.json';
fs.writeFileSync(outputPath, JSON.stringify(dashboard, null, 2));
console.log(`Created Final InfluxQL dashboard at ${outputPath}`);
