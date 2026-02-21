
const ps = {
    "zoneId": "",
    "message": "",
    "cameraId": 372,
    "deviceIp": "10.1.12.48",
    "severity": "High",
    "snapshot": "",
    "taskName": "CUSTOM_TASK",
    "ClientIds": [1, 801, 811, 451, 967],
    "alertTime": "2025-12-18T17:31:58.0494576+05:30",
    "alertType": "ANPR",
    "eventName": "ANPR",
    "cameraName": "SITAPUR_ANPR_1_12.48",
    "eventValue": null,
    "properties": {
        "Speed": "-1",
        "Remark": "",
        "PlateId": "88d81d5b-16ca-4961-8054-0dd4c9dda18e",
        "Category": "",
        "NoHelmet": "False",
        "PlateType": "unknown",
        "NoSeatBelt": "False",
        "FullImgPath": "/9j/4AAQSkZJRg...SIMULATED_BASE64_DATA..."
    }
};

console.log("Original Properties Keys:", Object.keys(ps.properties));

// V5.4 LOGIC COPY START
const blacklist = [
    'fullimgpath', 'plateimgpath', 'faceimgpath',
    'fullimagepath', 'faceimg', 'plateimg', 'snapshot'
];

const sanitizeObject = (obj, label) => {
    if (!obj) return;
    Object.keys(obj).forEach(key => {
        const lowerKey = key.toLowerCase();

        // Check if key is in our blocking list
        const isBlacklisted = blacklist.some(b => lowerKey === b || lowerKey.includes(b));

        if (isBlacklisted) {
            console.log(`> DELETING [${label}]: ${key}`);
            delete obj[key];
        }
    });
};

// Run on Root and Properties
sanitizeObject(ps, 'root');
sanitizeObject(ps.properties, 'properties');
// V5.4 LOGIC COPY END

console.log("Sanitized Properties Keys:", Object.keys(ps.properties));

if (ps.properties.FullImgPath) {
    console.error("FAIL: FullImgPath STILL EXISTS!");
} else {
    console.log("SUCCESS: FullImgPath was removed.");
}
