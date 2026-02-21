
const fs = require('fs');
const path = 'C:/Users/mevis/MQTT-Ingetsion/service_debug.log';

try {
    const buffer = Buffer.alloc(10000);
    const fd = fs.openSync(path, 'r');
    const size = fs.statSync(path).size;
    const start = Math.max(0, size - 10000);

    fs.readSync(fd, buffer, 0, 10000, start);
    const content = buffer.toString('utf8');
    const lines = content.split('\n').filter(l => l.trim().length > 0);

    // Print last non-25P02 error
    const meaningfulErrors = lines
        .map(l => {
            try { return JSON.parse(l); } catch (e) { return null; }
        })
        .filter(j => j && j.err && j.err.code !== '25P02')
        .slice(-1);

    console.log('--- Last Root Cause Error ---');
    meaningfulErrors.forEach(json => {
        console.log('Time:', new Date(json.time));
        if (json.err) {
            console.log('Error Code:', json.err.code);
            console.log('Error Message:', json.err.message);
            console.log('Error Detail:', json.err.detail);
            console.log('Error Hint:', json.err.hint);
        }
    });

} catch (e) {
    console.error('Script failed:', e.message);
}
