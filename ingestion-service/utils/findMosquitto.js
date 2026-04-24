/**
 * findMosquitto.js
 *
 * Locates the mosquitto broker executable in priority order:
 *
 *   1. ingestion-service/vendor/mosquitto/mosquitto.exe  (bundled — preferred, works offline)
 *   2. C:\Program Files (x86)\i2v-MQTT-Ingestion\vendor\mosquitto\mosquitto.exe  (production deploy path)
 *   3. C:\Program Files\mosquitto\mosquitto.exe  (system install — dev machines)
 *   4. 'mosquitto'  (last resort: system PATH)
 *
 * All test/stress code must use this instead of hardcoded paths.
 */

'use strict';
const fs   = require('fs');
const path = require('path');

function findMosquitto() {
    const candidates = [
        // 1. Bundled inside the project repo / installer
        path.join(__dirname, '..', 'vendor', 'mosquitto', 'mosquitto.exe'),

        // 2. Production Windows installer path (i2v-MQTT-Ingestion)
        'C:\\Program Files (x86)\\i2v-MQTT-Ingestion\\vendor\\mosquitto\\mosquitto.exe',

        // 3. Standalone system install (development machines)
        'C:\\Program Files\\mosquitto\\mosquitto.exe',
    ];

    for (const p of candidates) {
        try {
            if (fs.existsSync(p)) {
                return p;
            }
        } catch (_) {
            // existsSync can throw on permission errors — keep trying
        }
    }

    // 4. Fall back to assuming it's in system PATH
    return 'mosquitto';
}

module.exports = { findMosquitto };
