
const fs = require('fs');
const readline = require('readline');
const path = 'c:\\Users\\mevis\\MQTT-Ingetsion\\ingestion-service\\service_debug.log';

async function parseLogs() {
    if (!fs.existsSync(path)) {
        console.log('Log file not found');
        return;
    }

    const fileStream = fs.createReadStream(path);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const lines = [];
    for await (const line of rl) {
        lines.push(line);
        // if (lines.length > 50) lines.shift(); // Capture ALL lines for this debug session
    }

    lines.forEach(line => {
        try {
            const data = JSON.parse(line);
            if (data.msg && (data.msg.includes('ANPR fact') || data.msg.includes('classification rules'))) {
                console.log(`[${new Date(data.time)}] ERROR: ${data.msg}`);
                if (data.err) {
                    console.log(`  Message: ${data.err.message}`);
                    console.log(`  Code: ${data.err.code}`);
                    console.log(`  Detail: ${data.err.detail || 'N/A'}`);
                }
            }
        } catch (e) {
            // Ignore non-JSON lines
        }
    });
}

parseLogs();
