const fs = require('fs');
const path = require('path');

const ENV_FILE = path.join(__dirname, '..', '..', '.env');
const BROKERS_FILE = path.join(__dirname, 'brokers.json');

function parseEnv(content) {
    const config = {};
    content.split('\n').forEach(line => {
        const [key, ...val] = line.split('=');
        if (key && val) config[key.trim()] = val.join('=').trim();
    });
    return config;
}

if (!fs.existsSync(ENV_FILE)) {
    console.error(".env not found");
    process.exit(1);
}

const env = parseEnv(fs.readFileSync(ENV_FILE, 'utf-8'));
const urls = (env.MQTT_BROKER_URL || '').split(',').filter(u => u.trim());

let existing = [];
if (fs.existsSync(BROKERS_FILE)) {
    existing = JSON.parse(fs.readFileSync(BROKERS_FILE, 'utf-8'));
}

const updated = urls.map((url, idx) => {
    const found = existing.find(e => e.url === url);
    if (found) return found;
    
    // New broker found in .env but not in brokers.json
    return {
        id: Date.now() + idx,
        name: `Auto-Detected Broker ${idx + 1}`,
        type: 'OTHER',
        url: url.trim()
    };
});

fs.writeFileSync(BROKERS_FILE, JSON.stringify(updated, null, 2));
console.log(`Synced ${updated.length} brokers from .env to brokers.json`);
