
const fs = require('fs');
const path = 'C:/Users/mevis/MQTT-Ingetsion/service_debug.log';

try {
    const fileSize = fs.statSync(path).size;
    const bufferSize = 4096;
    const buffer = Buffer.alloc(bufferSize);
    const pos = Math.max(0, fileSize - bufferSize);

    const fd = fs.openSync(path, 'r');
    fs.readSync(fd, buffer, 0, bufferSize, pos);
    fs.closeSync(fd);

    const content = buffer.toString('utf8');
    const lines = content.split('\n');

    const lastLines = lines.slice(-50);
    console.log(lastLines.join('\n'));

} catch (e) {
    console.error(e);
}
