
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
        console.log("Syncing camera_master from live_camera_state...");

        // Insert missing cameras into camera_master
        const query = `
            INSERT INTO camera_master (camera_id, camera_name, source_type, created_at)
            SELECT DISTINCT 
                l.camera_id, 
                l.camera_name, 
                l.source_type, 
                NOW()
            FROM live_camera_state l
            LEFT JOIN camera_master c ON l.camera_id = c.camera_id
            WHERE c.camera_id IS NULL;
        `;

        const res = await pool.query(query);
        console.log(`Inserted ${res.rowCount} missing cameras into camera_master.`);

        // Verification
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

        const check = await pool.query("SELECT camera_name FROM camera_master WHERE camera_name = ANY($1::text[])", [names]);
        console.log(`VERIFICATION: Now found ${check.rowCount} / ${names.length} cameras.`);

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
