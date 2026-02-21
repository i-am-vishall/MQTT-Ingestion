const pino = require('pino');
const path = require('path');

// Use relative path so it works on any machine
const logPath = path.join(process.cwd(), 'logs', 'normalization_debug.log');
const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
}, pino.destination(logPath));

// Core Rules
// Rule 1: Raw JSON is NEVER queried by dashboards
// Rule 2: All incoming events must be converted into a canonical internal schema
// Rule 3: Time must be normalized once — at ingestion

/**
 * Universal function to normalize event time
 * @param {Object} payload 
 * @returns {Date}
 */
function normalizeEventTime(payload) {
    if (!payload) return new Date();

    // Epoch milliseconds (DetTime, ReceivedTime)
    if (payload.DetTime && typeof payload.DetTime === 'number') {
        return new Date(payload.DetTime);
    }

    if (payload.ReceivedTime && typeof payload.ReceivedTime === 'number') {
        return new Date(payload.ReceivedTime);
    }

    if (payload.detectionTime && typeof payload.detectionTime === 'number') {
        return new Date(payload.detectionTime);
    }

    // ISO / local time strings
    if (payload.alertTime) {
        return new Date(payload.alertTime);
    }

    // Explicit event_time if already normalized or from other sources
    if (payload.event_time) {
        return new Date(payload.event_time);
    }

    // Fallback
    return new Date();
}

/**
 * Detects the source of the event
 * @param {Object} payload 
 * @returns {string} 'VMS' | 'APP' | 'UNKNOWN'
 */
function detectSource(payload) {
    if (!payload) return 'DEFAULT';

    // VMS indicators
    if (payload.EventName === 'ANPR' && payload.DeviceId) {
        return 'VMS';
    }
    if (payload.alertType || payload.taskName) {
        return 'VMS';
    }

    // App indicators (fallback logic or specific fields)
    if (payload.appName || payload.camId) {
        return 'APP';
    }

    // Default VMS if looks like our standard schema, else APP
    // Based on user prompt "Applications (direct to Grafana / ICCC) Alert JSON may differ"
    // "VMS / ITMS Servers Alert JSON consistent (same schema as worked so far)"

    // If it has PlateNumber and DeviceIP it's likely VMS
    if (payload.PlateNumber && payload.DeviceIP) return 'VMS';

    return 'DEFAULT';
}

function extractViolations(p) {
    if (!p) return [];
    const violationTypes = [];
    if (p.NoHelmet === 'True' || p.NoHelmet === true) violationTypes.push('NoHelmet');
    if (p.RedLightViolated === 'True' || p.RedLightViolated === true) violationTypes.push('RedLightViolated');
    if (p.WrongDirectionDetected === 'True' || p.WrongDirectionDetected === true) violationTypes.push('WrongDirectionDetected');
    if (p.SpeedViolated === 'True' || p.SpeedViolated === true) violationTypes.push('SpeedViolated');
    if (p.TrippleRiding === 'True' || p.TrippleRiding === true) violationTypes.push('TrippleRiding');
    if (p.NoSeatBelt === 'True' || p.NoSeatBelt === true) violationTypes.push('NoSeatBelt');
    if (p.IsDrivingWhileOnTheMobile === 'True' || p.IsDrivingWhileOnTheMobile === true) violationTypes.push('IsDrivingWhileOnTheMobile');
    if (p.StoppedVehicleDetected === 'True' || p.StoppedVehicleDetected === true) violationTypes.push('StoppedVehicleDetected');

    return violationTypes;
}

/**
 * Normalizer for VMS ANPR Events
 */
function normalizeVmsAnpr(p) {
    const eventTime = normalizeEventTime(p);
    return {
        event_type: 'ANPR',
        event_time: eventTime,
        camera_id: String(p.DeviceId || p.device_id || 'UNKNOWN'),
        camera_name: p.DeviceName || 'UNKNOWN',
        plate_number: p.PlateNumber || 'UNKNOWN',
        vehicle_type: p.VehicleType || 'Car',
        vehicle_make: p.VehicleMake || 'unknown',
        vehicle_color: p.VehicleColor || 'unknown',
        speed: p.Speed || -1,
        is_violation: Boolean(
            p.RedLightViolated ||
            p.SpeedViolated ||
            p.NoHelmet ||
            p.NoSeatBelt ||
            p.TrippleRiding ||
            p.WrongDirectionDetected ||
            p.StoppedVehicleDetected ||
            p.IsDrivingWhileOnTheMobile
        ),
        violation_types: extractViolations(p),
        violation_types: extractViolations(p),
        source_type: p._source_id ? 'VMS' : 'UNKNOWN',
        source_id: p._source_id || 'UNKNOWN_SOURCE',
        source_ip: p._source_ip || null
    };
}

/**
 * Normalizer for App ANPR Events
 */
function normalizeAppAnpr(p) {
    const eventTime = normalizeEventTime(p);
    return {
        event_type: 'ANPR',
        event_time: eventTime,
        camera_id: p.camId || 'APP-UNKNOWN',
        camera_name: p.camName || 'APP',
        plate_number: p.plate || p.plate_number || 'UNKNOWN',
        vehicle_type: p.vehicleType || 'unknown',
        vehicle_make: p.make || 'unknown',
        vehicle_color: p.color || 'unknown',
        speed: p.speed ?? -1,
        is_violation: p.violation === true,
        violation_types: p.violations || [],
        source_type: 'APP',
        source_name: p.appName || 'UNKNOWN_APP'
    };
}

/**
 * Main Normalization Entry Point
 * @param {string} topic 
 * @param {Object} payload 
 * @returns {Object} Canonical Event
 */
function normalizeEvent(topic, payload) {
    payload = payload || {};
    const sourceType = detectSource(payload);

    // ANPR Normalization
    // Check if it is an ANPR event either by EventName or inferred
    const isAnpr = payload.EventName === 'ANPR' ||
        payload.event_type === 'ANPR' ||
        (payload.plate || payload.PlateNumber);

    if (isAnpr) {
        switch (sourceType) {
            case 'VMS':
                return normalizeVmsAnpr(payload);
            case 'APP':
                return normalizeAppAnpr(payload);
            default:
                // Fallback: try VMS normalizer as it's the legacy format
                return normalizeVmsAnpr(payload);
        }
    }

    // FRS Normalization
    const isFrs = payload.EventName === 'Face_Recognition' ||
        payload.EventName === 'FaceRecognition' ||
        payload.event_type === 'Face_Recognition' ||
        payload.event_type === 'FaceRecognition';

    if (isFrs) {
        return {
            event_type: 'Face_Recognition',
            event_time: normalizeEventTime(payload),
            camera_id: payload.camera_id || payload.cameraId || payload.DeviceId || topic,
            payload: payload,
            source_type: sourceType,
            source_name: 'UNKNOWN',
            source_id: payload._source_id || 'UNKNOWN_SOURCE',
            source_ip: payload._source_ip || null,
            camera_name: payload.DeviceName || payload.cameraName || 'UNKNOWN'
        };
    }

    // Default / Pass-through for non-ANPR (Security, etc.)
    // Priority: 1. EventName/eventName (User Request), 2. event_type/type, 3. 'unknown'
    let eventType = payload.EventName || payload.eventName || payload.event_type || payload.type || 'unknown';

    // Inference from message if type is unknown
    if (eventType === 'unknown' && payload.message) {
        const msg = payload.message.toLowerCase();
        if (msg.includes('crowd detected')) {
            eventType = 'CROWD';
        } else if (msg.includes('intrusion detected')) {
            eventType = 'INTRUSION';
        } else if (msg.includes('fire detected')) {
            eventType = 'FIRE';
        }
    }

    return {
        event_type: eventType,
        event_time: normalizeEventTime(payload),
        camera_id: payload.camera_id || payload.cameraId || topic,
        payload: payload, // Keep raw payload for others
        source_type: sourceType,
        source_name: 'UNKNOWN',
        source_id: payload._source_id || 'UNKNOWN_SOURCE',
        source_ip: payload._source_ip || null,
        camera_name: payload.DeviceName || payload.cameraName || payload.camera_name || 'UNKNOWN'
    };
}

module.exports = {
    normalizeEvent,
    detectSource,
    normalizeEventTime,
    extractViolations
};
