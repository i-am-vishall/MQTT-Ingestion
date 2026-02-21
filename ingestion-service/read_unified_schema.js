
const fs = require('fs');
const path = 'c:\\Users\\mevis\\MQTT-Ingetsion\\database\\unified_schema.sql';
try {
    const data = fs.readFileSync(path, 'utf16le'); // Try UTF-16LE first
    console.log(data);
} catch (e) {
    console.error(e);
}
