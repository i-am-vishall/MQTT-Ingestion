
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    user: 'postgres',
    host: '127.0.0.1',
    database: 'mqtt_alerts_db',
    password: '',
    port: 5441,
});

const scripts = [
    { path: 'c:\\Users\\mevis\\MQTT-Ingetsion\\database\\unified_schema.sql', encoding: 'utf16le' },
    { path: 'c:\\Users\\mevis\\MQTT-Ingetsion\\database\\anpr_columns_fix.sql', encoding: 'utf8' },
    { path: 'c:\\Users\\mevis\\MQTT-Ingetsion\\database\\frs_fix_nulls.sql', encoding: 'utf8' },
    { path: 'c:\\Users\\mevis\\MQTT-Ingetsion\\database\\fix_source_names.sql', encoding: 'utf8' }
];

async function restore() {
    try {
        for (const script of scripts) {
            console.log(`Executing ${path.basename(script.path)}...`);

            let sql = fs.readFileSync(script.path, script.encoding);

            // Remove BOM if present (Works for both UTF-8 default and UTF-16 checks)
            // UTF-16LE BOM is 0xFF 0xFE, but when read as string it might appear as \uFEFF check
            if (sql.charCodeAt(0) === 0xFEFF) {
                sql = sql.slice(1);
            }

            // Remove NUL bytes which can happen if reading wide chars as single bytes or vice-versa
            // cleanSql = sql.replace(/\0/g, ''); 

            await pool.query(sql);
            console.log(`Success: ${path.basename(script.path)}`);
        }
        console.log('All scripts executed successfully.');
    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        await pool.end();
    }
}

restore();
