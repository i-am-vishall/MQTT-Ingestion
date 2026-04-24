const createLogger = require('../../utils/createLogger');
const logger = createLogger('db-rules');

let classificationRules = [];
let payloadMappings = [];
let cameraZonesMap = new Map();

async function loadRules(pool) {
    try {
        const res = await pool.query('SELECT * FROM event_classification_rules WHERE enabled = true');
        classificationRules = res.rows;
        logger.info(`Loaded ${classificationRules.length} classification rules.`);
        
        // Also load zone mappings together
        const zoneRes = await pool.query(`
            SELECT camera_id, group_name as zone_name 
            FROM camera_group_mapping
        `);
        const newMap = new Map();
        zoneRes.rows.forEach(r => newMap.set(r.camera_id, r.zone_name));
        cameraZonesMap = newMap;
        logger.info(`Loaded ${cameraZonesMap.size} camera zone mappings.`);
    } catch (err) {
        logger.error(err, 'Failed to load validation rules / zones');
    }
}

async function loadMappings(pool) {
    try {
        const res = await pool.query('SELECT * FROM payload_schema_mappings WHERE is_active = true');
        payloadMappings = res.rows;
        logger.info(`Loaded ${payloadMappings.length} payload mappings.`);
    } catch (err) {
        logger.error(err, 'Failed to load payload mappings');
    }
}

function getClassificationRules() {
    return classificationRules;
}

function getPayloadMappings() {
    return payloadMappings;
}

function getCameraZonesMap() {
    return cameraZonesMap;
}

module.exports = {
    loadRules,
    loadMappings,
    getClassificationRules,
    getPayloadMappings,
    getCameraZonesMap
};
