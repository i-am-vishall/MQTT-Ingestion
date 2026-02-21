
const fs = require('fs');
const path = 'c:\\Users\\mevis\\MQTT-Ingetsion\\deploy\\service_debug.log';

try {
    const stats = fs.statSync(path);
    const size = stats.size;
    const readSize = Math.min(size, 4000);
    const buffer = Buffer.alloc(readSize);

    const fd = fs.openSync(path, 'r');
    fs.readSync(fd, buffer, 0, readSize, size - readSize);
    fs.closeSync(fd);

    console.log(buffer.toString('utf8'));
} catch (e) {
    console.error(e);
}
