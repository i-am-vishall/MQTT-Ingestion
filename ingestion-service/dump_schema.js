
const { Pool } = require('pg');
const pool = new Pool({
    user: 'postgres',
    host: '127.0.0.1',
    database: 'mqtt_alerts_db',
    password: '',
    port: 5441,
});

async function run() {
    try {
        const query = `
            SELECT table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            ORDER BY table_name, ordinal_position;
        `;
        const res = await pool.query(query);

        let currentTable = '';
        res.rows.forEach(row => {
            if (row.table_name !== currentTable) {
                console.log(`\n### ${row.table_name}`);
                currentTable = row.table_name;
            }
            console.log(`- ${row.column_name} (${row.data_type})`);
        });

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
