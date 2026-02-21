require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const config = require('../src/config');

async function setupDatabase() {
    // 1. Connect to default 'postgres' db to ensure target db exists
    console.log('Connecting to default postgres database...');
    const defaultPool = new Pool({
        ...config.db,
        database: 'postgres'
    });

    let retries = 5;
    while (retries > 0) {
        try {
            const client = await defaultPool.connect();

            const dbName = config.db.database;
            // Check if DB exists
            const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = '${dbName}'`);
            if (res.rowCount === 0) {
                console.log(`Database ${dbName} does not exist. Creating...`);
                await client.query(`CREATE DATABASE "${dbName}"`);
                console.log(`Database ${dbName} created.`);
            } else {
                console.log(`Database ${dbName} already exists.`);
            }
            client.release();
            break;
        } catch (err) {
            console.error(`Connection failed (${err.code}). Retrying in 5s... (${retries} left)`);
            retries--;
            if (retries === 0) {
                console.error('Assuming DB is invalid or not started. Exiting.');
                process.exit(1);
            }
            await new Promise(res => setTimeout(res, 5000));
        }
    }
    await defaultPool.end();

    // 2. Connect to actual DB and run init.sql
    console.log('Connecting to target database...', {
        host: config.db.host,
        port: config.db.port,
        database: config.db.database,
        user: config.db.user
    });

    const pool = new Pool(config.db);

    try {
        const client = await pool.connect();
        console.log('Connected successfully.');

        // Search multiple locations for init schema (production + dev compatible)
        const searchPaths = [
            // Production: schema next to exe
            path.join(process.cwd(), 'init_schema.sql'),
            path.join(process.cwd(), 'init.sql'),
            // Production: in db subfolder
            path.join(process.cwd(), 'db', 'init_schema.sql'),
            path.join(process.cwd(), 'db', 'init.sql'),
            // Development: relative to scripts folder
            path.join(__dirname, '../../db/init_schema.sql'),
            path.join(__dirname, '../db/init_schema.sql'),
            path.join(__dirname, '../../database/init.sql'),
            // Absolute fallback for Windows standard install
            'C:\\Program Files (x86)\\i2v-MQTT-Ingestion\\db\\init_schema.sql',
            'C:\\Program Files (x86)\\i2v-MQTT-Ingestion\\init_schema.sql'
        ];

        let sqlPath = null;
        for (const p of searchPaths) {
            if (fs.existsSync(p)) {
                sqlPath = p;
                break;
            }
        }

        if (sqlPath) {
            console.log(`Reading SQL from ${sqlPath}...`);
            const sql = fs.readFileSync(sqlPath, 'utf8');
            console.log('Executing initialization script...');
            await client.query(sql);
            console.log('Database initialized successfully!');
        } else {
            console.error('ERROR: init_schema.sql not found in any of these locations:');
            searchPaths.forEach(p => console.error('  - ' + p));
        }

        client.release();
    } catch (err) {
        console.error('Failed to initialize database schema:');
        console.error('Message:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

setupDatabase();
