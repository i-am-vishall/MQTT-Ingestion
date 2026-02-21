const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const config = require('./src/config'); // Reuse existing config

const pool = new Pool(config.db);

async function run() {
    try {
        const sqlPath = path.join('c:\\Users\\mevis\\MQTT-Ingetsion\\db\\init_mapping_schema.sql');
        console.log(`Reading SQL from: ${sqlPath}`);
        if (!fs.existsSync(sqlPath)) {
            console.error('SQL file not found!');
            process.exit(1);
        }
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log('Connecting to DB...');
        await pool.query(sql);
        console.log('Mapping Schema applied successfully.');
    } catch (e) {
        console.error('Error applying schema:', e);
    } finally {
        pool.end();
    }
}
run();
