const payload = {
    "zoneId": "",
    "message": "",
    "cameraId": 375,
    "deviceIp": "10.1.7.58",
    "severity": "High",
    "snapshot": "Base64ImageHere",
    "taskName": "CUSTOM_TASK",
    "alertTime": "2025-12-18T11:49:18.1679976+05:30",
    "alertType": "ANPR",
    "eventName": "ANPR",
    "properties": {
        "Speed": "-1",
        "FullImgPath": "C:\\Images\\Car.jpg",
        "PlateImgPath": "C:\\Images\\Plate.jpg",
        "VehicleColor": "white"
    }
};

console.log('Original Payload Keys:', Object.keys(payload.properties || {}));

// --- SIMULATED LOGIC FROM SRC/INDEX.JS ---
if (payload.snapshot) {
    delete payload.snapshot;
}

const eType = (payload.event_type || payload.type || payload.alertType || payload.eventName || '').toUpperCase();

if (eType === 'ANPR' && payload.properties) {
    if (payload.properties.FullImgPath) {
        delete payload.properties.FullImgPath;
    }
    if (payload.properties.PlateImgPath) {
        delete payload.properties.PlateImgPath;
    }
    console.log('Sanitized ANPR Image Paths');
}
// -----------------------------------------

console.log('Final Payload Properties:', payload.properties);
if (!payload.properties.FullImgPath && !payload.properties.PlateImgPath) {
    console.log('SUCCESS: Paths removed.');
} else {
    console.log('FAILURE: Paths still exist.');
}

// --- FACE TEST ---
const facePayload = {
    "alertType": "Face_Recognition",
    "eventName": "Face_Recognition",
    "properties": {
        "faceImg": "value",
        "faceImgPath": "should_be_gone",
        "fullImgPath": "should_be_gone",
        "matchId": "000"
    }
};

console.log('\n--- FACE TEST ---');
console.log('Original Face Keys:', Object.keys(facePayload.properties));

const fType = (facePayload.event_type || facePayload.type || facePayload.alertType || facePayload.eventName || '').toUpperCase();

if (fType === 'FACE_RECOGNITION' && facePayload.properties) {
    if (facePayload.properties.faceImgPath !== undefined) delete facePayload.properties.faceImgPath;
    if (facePayload.properties.fullImgPath !== undefined) delete facePayload.properties.fullImgPath;
    console.log('Sanitized Face Paths');
}

console.log('Final Face Keys:', Object.keys(facePayload.properties));
if (facePayload.properties.faceImgPath === undefined && facePayload.properties.fullImgPath === undefined) {
    console.log('SUCCESS: Face Paths removed.');
} else {
    console.log('FAILURE: Face Paths remain.');
}
