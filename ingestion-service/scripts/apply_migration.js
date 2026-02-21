const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
});

async function applyMigration() {
    let client;
    try {
        client = await pool.connect();

        // Check Version
        const ver = await client.query('SELECT version()');
        console.log('Postgres Version:', ver.rows[0].version);

        const sqlPath = path.join(__dirname, '..', '..', 'database', 'anpr_deduplication.sql');
        console.log(`Reading SQL from: ${sqlPath}`);
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Applying migration...');
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        console.log('Migration applied successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
        if (client) {
            try { await client.query('ROLLBACK'); } catch (e) { }
        }
        process.exit(1);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

applyMigration();
