
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
        console.log("=== METRICS CHECK ===");
        const metricsRes = await pool.query("SELECT MAX(bucket_time) as last_bucket, COUNT(*) as total_rows FROM camera_metrics_1min");
        console.log(`Last Metric Bucket: ${metricsRes.rows[0].last_bucket}`);
        console.log(`Total Metrics Rows: ${metricsRes.rows[0].total_rows}`);

        console.log("\n=== CAMERA MASTER CHECK ===");
        const names = [
            'MALWEEYA_DWEEP_5.40',
            'KANGDA_STAIR_5.32',
            'BHAGIRATHI_PUL_5.18',
            'JAL_CHOWKI_5.38',
            'JOINT_BRIDGE_MALWEEYADWEEP_5.26',
            'MALWEEYA_DWEEP_3_5.39',
            'MALWEEYA_DWEEP_7_5.23',
            'PUL_NO_2_MALWEEYA_DWEEP_Entry_5.41',
            'MALWEEYA_DWEEP_10_5.43',
            'MALWEEYA_DWEEP_6_5.44',
            'Shiv_Pull_Entry Exit-2_10.1.5.35',
            'MALWEEYA_DWEEP_12_5.25',
            'MALWEEYA_DWEEP_11_5.17',
            'MALWEEYA_DWEEP_8_5.71'
        ];

        const masterRes = await pool.query("SELECT camera_name FROM camera_master WHERE camera_name = ANY($1::text[])", [names]);
        const foundNames = masterRes.rows.map(r => r.camera_name);
        console.log(`Found ${foundNames.length} / ${names.length} cameras in camera_master.`);

        const missing = names.filter(n => !foundNames.includes(n));
        if (missing.length > 0) {
            console.log("MISSING in camera_master:", missing);
        }

        console.log("\n=== RECENT METRICS SAMPLE ===");
        const sampleRes = await pool.query("SELECT * FROM camera_metrics_1min ORDER BY bucket_time DESC LIMIT 5");
        console.table(sampleRes.rows);

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
