const fs = require('fs');
const path = require('path');

const inputPath = 'C:\\Users\\mevis\\MQTT-Ingetsion\\monitoring\\comprehensive_dashboard.json';
const dashboard = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

const BUCKET = 'camera_monitoring';
const DATASOURCE_UID = 'bfags8rjk1o1sc'; // Hardcoded from observed JSON to ensure link

// Helper to Create Flux Target
function createFluxTarget(query, refId, hide = false) {
    return {
        "datasource": {
            "type": "influxdb",
            "uid": DATASOURCE_UID
        },
        "query": query,
        // Make sure to escape backslashes for Grafana variables if needed, 
        // but here we just write raw string. 
        "refId": refId,
        "hide": hide
    };
}

// 1. Update Global Dashboard Props
dashboard.title = "Comprehensive Monitoring (Flux)";
dashboard.uid = "comprehensive-monitoring-flux";

// 2. Iterate Panels
dashboard.panels.forEach(panel => {
    // Clear legacy InfluxQL properties
    if (panel.targets) {
        panel.targets.forEach(t => {
            delete t.select;
            delete t.groupBy;
            delete t.orderByTime;
            delete t.policy;
            delete t.measurement;
        });
    }

    if (!panel.targets) return;

    // A. TOTAL DEVICES
    if (panel.title === 'TOTAL DEVICES') {
        panel.targets = [
            createFluxTarget(`
                from(bucket: "${BUCKET}")
                |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
                |> filter(fn: (r) => r["_measurement"] == "ping")
                |> filter(fn: (r) => r["_field"] == "percent_packet_loss")
                |> filter(fn: (r) => contains(value: r["role"], set: \${device_type:json}))
                |> group(columns: ["url"])
                |> last()
                |> group()
                |> count()
                |> yield(name: "total_devices")
            `, "A")
        ];
    }

    // B. ONLINE
    if (panel.title === 'ONLINE') {
        panel.targets = [
            createFluxTarget(`
                from(bucket: "${BUCKET}")
                |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
                |> filter(fn: (r) => r["_measurement"] == "ping")
                |> filter(fn: (r) => r["_field"] == "percent_packet_loss")
                |> filter(fn: (r) => contains(value: r["role"], set: \${device_type:json}))
                |> filter(fn: (r) => r["_value"] < 100)
                |> group(columns: ["url"])
                |> last()
                |> group()
                |> count()
                |> yield(name: "online_count")
            `, "A")
        ];
    }

    // C. OFFLINE
    if (panel.title === 'OFFLINE') {
        panel.targets = [
            createFluxTarget(`
                from(bucket: "${BUCKET}")
                |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
                |> filter(fn: (r) => r["_measurement"] == "ping")
                |> filter(fn: (r) => r["_field"] == "percent_packet_loss")
                |> filter(fn: (r) => contains(value: r["role"], set: \${device_type:json}))
                |> filter(fn: (r) => r["_value"] == 100)
                |> group(columns: ["url"])
                |> last()
                |> group()
                |> count()
                |> yield(name: "offline_count")
            `, "A")
        ];
    }

    // D. % AVAILABILITY
    if (panel.title === '% AVAILABILITY') {
        panel.targets = [
            createFluxTarget(`
                from(bucket: "${BUCKET}")
                |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
                |> filter(fn: (r) => r["_measurement"] == "ping")
                |> filter(fn: (r) => r["_field"] == "percent_packet_loss")
                |> filter(fn: (r) => contains(value: r["role"], set: \${device_type:json}))
                |> aggregateWindow(every: v.windowPeriod, fn: mean, createEmpty: false)
                |> map(fn: (r) => ({ r with _value: 100.0 - r._value }))
                |> yield(name: "availability")
            `, "A")
        ];
    }

    // E. GENERIC SELECTED DEVICES (Was CAMERAS)
    if (panel.title === 'CAMERAS' || panel.title === 'SELECTED DEVICES (By Type)' || panel.title === 'CATEGORY HEALTH') {
        panel.title = "SELECTED DEVICES HEALTH";
        panel.targets = [
            createFluxTarget(`
                from(bucket: "${BUCKET}")
                |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
                |> filter(fn: (r) => r["_measurement"] == "ping")
                |> filter(fn: (r) => r["_field"] == "percent_packet_loss")
                |> filter(fn: (r) => contains(value: r["role"], set: \${device_type:json}))
                |> filter(fn: (r) => r["_value"] < 100)
                |> group(columns: ["url"])
                |> last()
                |> group()
                |> count()
                |> yield(name: "devices_online")
            `, "A"),
            createFluxTarget(`
                from(bucket: "${BUCKET}")
                |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
                |> filter(fn: (r) => r["_measurement"] == "ping")
                |> filter(fn: (r) => r["_field"] == "percent_packet_loss")
                |> filter(fn: (r) => contains(value: r["role"], set: \${device_type:json}))
                |> filter(fn: (r) => r["_value"] == 100)
                |> group(columns: ["url"])
                |> last()
                |> group()
                |> count()
                |> yield(name: "devices_offline")
            `, "B")
        ];
    }

    // F. Offline Devices (Trend)
    if (panel.title === 'Offline Devices (Trend)') {
        panel.targets = [
            createFluxTarget(`
                from(bucket: "${BUCKET}")
                |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
                |> filter(fn: (r) => r["_measurement"] == "ping")
                |> filter(fn: (r) => r["_field"] == "percent_packet_loss")
                |> filter(fn: (r) => contains(value: r["role"], set: \${device_type:json}))
                |> filter(fn: (r) => r["_value"] == 100)
                |> aggregateWindow(every: v.windowPeriod, fn: count, createEmpty: false)
                |> yield(name: "offline_trend")
            `, "A")
        ];
    }

    // G. Device Status Table
    if (panel.title === 'Device Status Table') {
        panel.targets = [
            createFluxTarget(`
                from(bucket: "${BUCKET}")
                |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
                |> filter(fn: (r) => r["_measurement"] == "ping")
                |> filter(fn: (r) => r["_field"] == "percent_packet_loss")
                |> filter(fn: (r) => contains(value: r["role"], set: \${device_type:json}))
                |> last()
                |> map(fn: (r) => ({
                    r with
                    status: if r._value == 100.0 then 1 else 0,
                    device_ip: r.url,
                    role: r.role
                }))
                |> keep(columns: ["_time", "device_ip", "role", "status"])
            `, "A")
        ];
    }
});

// Update Templating (Variables)
if (dashboard.templating && dashboard.templating.list) {
    dashboard.templating.list.forEach(v => {
        if (v.name === 'device_type') {
            const fluxQuery = `
  from(bucket: "${BUCKET}")
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["_measurement"] == "ping")
  |> keyValues(key: "role")
  |> keep(columns: ["_value"])
  |> distinct()
  `;

            v.query = fluxQuery;
            v.definition = fluxQuery;
            v.type = "query";
            v.datasource = {
                "type": "influxdb",
                "uid": DATASOURCE_UID
            };
            v.refresh = 1; // Refresh on Dashboard Load
            v.sort = 1; // Alpha asc
        }
    });
}

// Write output
const outputPath = 'C:\\Users\\mevis\\MQTT-Ingetsion\\monitoring\\comprehensive_dashboard_flux.json';
fs.writeFileSync(outputPath, JSON.stringify(dashboard, null, 2));
console.log(`Created Flux dashboard at ${outputPath}`);
