
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
            "faceImgPath": "ShouldBeDeleted"
        }
    }
};

const blacklist = [
    'fullimgpath', 'plateimgpath', 'faceimgpath',
    'fullimagepath', 'faceimg', 'plateimg', 'snapshot'
];

const sanitizeObject = (obj, label) => {
    if (!obj) return;
    Object.keys(obj).forEach(key => {
        const lowerKey = key.toLowerCase();
        const isBlacklisted = blacklist.some(b => lowerKey === b || lowerKey.includes(b));

        if (isBlacklisted) {
            console.log(`Sanitized field [${label}]: ${key}`);
            delete obj[key];
        }
    });
};

// Current Logic in index.js
sanitizeObject(payload, 'root');
sanitizeObject(payload.properties, 'properties');

console.log("Checking nested properties...");
if (payload.properties.nested && payload.properties.nested.FullImgPath) {
    console.log("FAIL: payload.properties.nested.FullImgPath exists!");
} else {
    console.log("PASS: payload.properties.nested.FullImgPath is gone (unexpected for current code).");
}

if (payload.deeply && payload.deeply.nested && payload.deeply.nested.faceImgPath) {
    console.log("FAIL: payload.deeply.nested.faceImgPath exists!");
} else {
    console.log("PASS: payload.deeply.nested.faceImgPath is gone.");
}
