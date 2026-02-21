const fs = require("fs");
const path = require("path");

const IS_PKG = process.pkg !== undefined;
const EXEC_DIR = path.dirname(process.execPath);
const BASE_DIR = IS_PKG ? EXEC_DIR : path.join(__dirname, "..", "..", "..");

const LOG_EXTENSIONS = [".log", ".err", ".out", ".txt", ".csv"];

function listFiles(dir, nameFilters) {
    if (!fs.existsSync(dir)) return [];

    let entries = [];
    try {
        entries = fs.readdirSync(dir);
    } catch (e) {
        return [];
    }

    const filters = (nameFilters || []).map(f => f.toLowerCase());

    return entries
        .filter(name => {
            const lower = name.toLowerCase();
            const hasExt = LOG_EXTENSIONS.some(ext => lower.endsWith(ext));
            if (!hasExt) return false;
            if (filters.length === 0) return true;
            return filters.some(token => lower.includes(token));
        })
        .map(name => path.join(dir, name));
}

function getLatestByMtime(files) {
    let latest = null;
    let latestTime = 0;

    for (const file of files) {
        try {
            const stat = fs.statSync(file);
            if (stat.mtimeMs > latestTime) {
                latestTime = stat.mtimeMs;
                latest = file;
            }
        } catch (e) {
            // ignore
        }
    }

    return latest;
}

function getLatestLogFile(serviceName) {
    const service = (serviceName || "ingestion").toLowerCase();

    // Map service -> folder name for centralized logs
    let folderName = service;
    if (service === "db" || service === "postgres") folderName = "postgres";
    if (service === "config" || service === "config-backend") folderName = "config";

    const searchFiles = [];
    const searchDirs = [];

    // Centralized logs (preferred)
    searchDirs.push(path.join("C:", "ProgramData", "I2V", "Logs", folderName));

    const rootLogsDir = path.join(BASE_DIR, "logs");
    const monitoringDir = path.join(BASE_DIR, "monitoring");

    // Service-specific known log files
    if (service === "telegraf") {
        searchFiles.push(path.join(monitoringDir, "telegraf.log"));
    }
    if (service === "influxdb") {
        searchFiles.push(path.join(monitoringDir, "influx_service.log"));
        searchFiles.push(path.join(monitoringDir, "influx_service.err"));
    }
    if (service === "system") {
        searchFiles.push(path.join(rootLogsDir, "loki-service.log"));
        searchFiles.push(path.join(rootLogsDir, "loki-service.err"));
    }

    // Additional directories by service
    if (service === "ingestion" || service === "config") {
        searchDirs.push(rootLogsDir);
    }
    if (service === "system") {
        searchDirs.push(rootLogsDir);
        searchDirs.push(monitoringDir);
    }
    if (service === "telegraf" || service === "influxdb") {
        searchDirs.push(monitoringDir);
    }
    if (service === "db" || service === "postgres") {
        searchDirs.push(path.join(BASE_DIR, "data", "log"));
        searchDirs.push("C:\\Program Files\\PostgreSQL\\14\\data\\log");
        searchDirs.push("C:\\Program Files (x86)\\PostgreSQL\\14\\data\\log");
        searchDirs.push("C:\\Program Files (x86)\\i2v-MQTT-Ingestion\\data\\log");
    }

    const nameFilters = {
        ingestion: ["ingestion"],
        config: ["config"],
        "config-backend": ["config"],
        db: ["postgres", "pg", "db"],
        postgres: ["postgres", "pg", "db"],
        telegraf: ["telegraf"],
        influxdb: ["influx"],
        system: ["loki", "wrapper", "system"]
    };

    const filters = nameFilters[service] || [];

    const candidates = [];

    for (const file of searchFiles) {
        if (file && fs.existsSync(file)) {
            candidates.push(file);
        }
    }

    for (const dir of searchDirs) {
        // Centralized log dir is already service-specific; don't over-filter it.
        const shouldFilter = !dir.toLowerCase().includes("\\programdata\\i2v\\logs\\");
        const files = listFiles(dir, shouldFilter ? filters : []);
        candidates.push(...files);
    }

    return getLatestByMtime(candidates);
}

module.exports = getLatestLogFile;
