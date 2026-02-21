const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Basic .env parser
const parseEnv = (content) => {
    const res = {};
    content.split('\n').forEach(line => {
        const [k, v] = line.split('=');
        if (k && v) res[k.trim()] = v.trim();
    });
    return res;
};

const BASE_DIR = path.join(__dirname, '..', '..');
const ENV_FILE = path.join(BASE_DIR, '.env');

async function migrate() {
    console.log("Loading environment from:", ENV_FILE);
    if (!fs.existsSync(ENV_FILE)) {
        console.error("No .env file found!");
        process.exit(1);
    }

    const env = parseEnv(fs.readFileSync(ENV_FILE, 'utf-8'));

    // Fallback to defaults if env missing
    const config = {
        user: env.DB_USER || 'postgres',
        host: env.DB_HOST || 'localhost',
        database: env.DB_NAME || 'i2v_ingestion_db',
        password: env.DB_PASSWORD || 'password',
        port: parseInt(env.DB_PORT || '5441')
    };

    console.log(`Connecting to DB at ${config.host}:${config.port}...`);
    const pool = new Pool(config);

    try {
        console.log("Running Migration: Add 'locked' column...");
        await pool.query(`
            ALTER TABLE payload_schema_mappings 
            ADD COLUMN IF NOT EXISTS locked BOOLEAN DEFAULT false;
        `);
        console.log("SUCCESS: Column 'locked' added (or already exists).");
    } catch (e) {
        console.error("Migration Failed:", e.message);
    } finally {
        await pool.end();
    }
}

migrate();
