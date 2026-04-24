const createLogger = require('../../utils/createLogger');
const logger = createLogger('ingestion-helpers');

// Performance tweak: allocate regex strings once
const PAYLOAD_BLACKLIST = ['faceimg', 'faceimgpath', 'face_img', 'image_path', 'pic_path', 'vehiclenumberplateimg', 'vehiclenumberplateimgpath'];

function sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
    for (const key of Object.keys(obj)) {
        const lk = key.toLowerCase();
        if (PAYLOAD_BLACKLIST.some(b => lk === b || lk.includes(b))) {
            delete obj[key];
        } else {
            sanitizeObject(obj[key]);
        }
    }
}

function csvEscape(val) {
    if (val === null || val === undefined) return '';
    if (val instanceof Date) return val.toISOString();
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

function getAnprFactData(event) {
    const norm = event.normalized;
    if (!norm) return null;
    // Ensure event_time is always a safe ISO string (defense-in-depth)
    const evTime = typeof norm.event_time === 'string'
        ? norm.event_time
        : (norm.event_time instanceof Date ? norm.event_time.toISOString() : new Date().toISOString());
    return [
        evTime,
        norm.camera_id,
        norm.plate_number,
        norm.vehicle_type,
        norm.vehicle_color,
        norm.vehicle_make,
        norm.is_violation,
        norm.violation_types,
        norm.speed,
        norm.source_type,
        norm.source_name || 'UNKNOWN',  // FIX: was duplicating source_id
        norm.source_id,
        norm.source_ip,
        norm.camera_name || 'UNKNOWN'
    ];
}

function getByPath(obj, path) {
    if (!path) return undefined;
    if (typeof path !== 'string') return undefined;
    return path.split('.').reduce((acc, part) => {
        if (part.includes('[') && part.endsWith(']')) {
            const [key, idx] = part.split('[');
            const index = parseInt(idx.replace(']', ''));
            return acc && acc[key] ? acc[key][index] : undefined;
        }
        return acc && acc[part];
    }, obj);
}

function matchCriteria(payload, criteria, topic, sourceId, sourceIp) {
    if (!criteria || Object.keys(criteria).length === 0) return true;
    for (const [key, val] of Object.entries(criteria)) {
        if (key === 'topic_pattern') {
            try {
                const regex = new RegExp(val);
                if (!regex.test(topic)) return false;
            } catch (e) {
                if (!topic.includes(val)) return false;
            }
            continue;
        }
        if (key === 'source_id') {
            if (String(sourceId) !== String(val)) return false;
            continue;
        }
        if (key === 'source_ip') {
            if (String(sourceIp) !== String(val)) return false;
            continue;
        }
        const actual = getByPath(payload, key);
        if (String(actual) !== String(val)) return false;
    }
    return true;
}

function getFrsFactData(event, payloadMappings) {
    try {
        const payload = event.payload;

        let personName = 'Unknown';
        let gender = 'Unknown';
        let age = 0;
        let detConf = 0;
        let recConf = 0;
        let facePath = '';
        let matchId = null;
        let trackId = null;

        const topic = event.topic || '';
        const sourceId = event.source_id || '';
        const sourceIp = event.source_ip || '';

        const mapping = payloadMappings.find(m =>
            m.event_type === 'Face_Recognition' && matchCriteria(payload, m.identification_criteria, topic, sourceId, sourceIp)
        );

        if (mapping) {
            const config = mapping.mapping_config;
            personName = getByPath(payload, config.person_name) || personName;
            gender = getByPath(payload, config.gender) || gender;
            age = parseInt(getByPath(payload, config.age) || '0');
            detConf = parseFloat(getByPath(payload, config.det_conf) || '0');
            recConf = parseFloat(getByPath(payload, config.rec_conf) || '0');
            facePath = getByPath(payload, config.face_image_path) || '';
            matchId = getByPath(payload, config.match_id) || null;
            trackId = getByPath(payload, config.track_id) || null;
        } else {
            const props = payload.properties || {};
            personName = props.personName || props.identity || 'Unknown';
            gender = props.gender || 'Unknown';
            age = parseInt(props.age || '0');
            detConf = parseFloat(props.detConf || '0');
            recConf = parseFloat(props.recConf || '0');
            facePath = props.faceImg || ''; // Legacy
            matchId = props.matchId;
            trackId = props.trackId;
        }

        // Ensure event_time is always a safe ISO string (defense-in-depth)
        const evTime = typeof event.event_time === 'string'
            ? event.event_time
            : (event.event_time instanceof Date ? event.event_time.toISOString() : new Date().toISOString());
        return [
            evTime,
            event.camera_id,
            event.normalized?.camera_name || 'UNKNOWN',
            personName,
            gender,
            age,
            matchId,
            trackId,
            detConf,
            recConf,
            facePath
        ];
    } catch (err) {
        logger.error({ err, cameraId: event.camera_id }, 'Error formatting FRS fact');
        return null;
    }
}

module.exports = {
    sanitizeObject,
    csvEscape,
    getAnprFactData,
    getFrsFactData
};
