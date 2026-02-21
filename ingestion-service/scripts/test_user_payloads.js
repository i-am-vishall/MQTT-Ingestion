
const blacklist = [
    'fullimgpath', 'plateimgpath', 'faceimgpath',
    'fullimagepath', 'faceimg', 'plateimg', 'snapshot'
];

const sanitizeObject = (obj, label = '') => {
    if (!obj || typeof obj !== 'object') return;

    Object.keys(obj).forEach(key => {
        const lowerKey = key.toLowerCase();
        // Check if key is in our blocking list
        // logic: if key matches or contains any blacklist item
        const isBlacklisted = blacklist.some(b => lowerKey === b || lowerKey.includes(b));

        if (isBlacklisted) {
            console.log(`[DELETE] ${label ? label + '.' : ''}${key}`);
            delete obj[key];
        } else {
            sanitizeObject(obj[key], label ? `${label}.${key}` : key);
        }
    });
};

const facePayload = {
    "alertType": "Face_Recognition",
    "properties": {
        "faceImg": "snapshots/.../Face.jpg",
        "faceImgPath": "path/to/face",
        "fullImgPath": "path/to/full",
        "FullImagePath": "path/to/full_image",
        "searchImage": "keep?",
        "enrolledImage": "keep?"
    }
};

const anprPayload = {
    "alertType": "ANPR",
    "properties": {
        "FullImgPath": "path/to/full",
        "PlateImgPath": "path/to/plate",
        "DriverImgPath": "path/to/driver",
        "ViolationImgPath": "path/to/violation",
        "snapshot": "base64..."
    }
};

console.log("--- TESTING FACE PAYLOAD ---");
sanitizeObject(facePayload, 'face');
console.log("Remaining Face Props:", Object.keys(facePayload.properties));

console.log("\n--- TESTING ANPR PAYLOAD ---");
sanitizeObject(anprPayload, 'anpr');
console.log("Remaining ANPR Props:", Object.keys(anprPayload.properties));
