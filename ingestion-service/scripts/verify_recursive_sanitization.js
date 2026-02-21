
const payload = {
    "eventName": "ANPR",
    "properties": {
        "basic": "ok",
        "nested": {
            "FullImgPath": "ShouldBeDeleted",
            "PlateImgPath": "ShouldBeDeleted"
        }
    },
    "deeply": {
        "nested": {
            "faceImgPath": "ShouldBeDeleted",
        },
        "innocent": "kept"
    }
};

const blacklist = [
    'fullimgpath', 'plateimgpath', 'faceimgpath',
    'fullimagepath', 'faceimg', 'plateimg', 'snapshot'
];

// NEW RECURSIVE LOGIC
const sanitizeObject = (obj, label = '') => {
    if (!obj || typeof obj !== 'object') return;

    Object.keys(obj).forEach(key => {
        const lowerKey = key.toLowerCase();

        // Check if key is in our blocking list
        const isBlacklisted = blacklist.some(b => lowerKey === b || lowerKey.includes(b));

        if (isBlacklisted) {
            console.log(`Sanitized field [${label ? label + '.' : ''}${key}]`);
            delete obj[key];
        } else {
            // Recurse into children
            sanitizeObject(obj[key], label ? `${label}.${key}` : key);
        }
    });
};

console.log("Starting Sanitization...");
sanitizeObject(payload, 'root');

console.log("Checking results...");

let failed = false;

if (payload.properties.nested && payload.properties.nested.FullImgPath) {
    console.log("FAIL: payload.properties.nested.FullImgPath exists!");
    failed = true;
}

if (payload.deeply && payload.deeply.nested && payload.deeply.nested.faceImgPath) {
    console.log("FAIL: payload.deeply.nested.faceImgPath exists!");
    failed = true;
}

if (payload.deeply.innocent !== "kept") {
    console.log("FAIL: Innocent field was deleted!");
    failed = true;
}

if (!failed) {
    console.log("SUCCESS: All sensitive paths removed recursively.");
} else {
    console.log("FAILURE: Some checks failed.");
    process.exit(1);
}
