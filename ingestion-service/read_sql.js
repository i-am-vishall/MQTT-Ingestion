
const fs = require('fs');
const path = 'c:\\Users\\mevis\\MQTT-Ingetsion\\database\\unified_schema.sql';

try {
    // Attempt to read with utf8 first, but if it has BOM or is UTF-16, this might need adjustment.
    // However, Node often handles UTF-8 with BOM fine. For UTF-16LE, we need 'utf16le'.
    // The error message earlier said "unsupported mime type text/plain; charset=utf-16le".
    const content = fs.readFileSync(path, 'utf16le');
    console.log(content);
} catch (e) {
    console.error(e);
}
