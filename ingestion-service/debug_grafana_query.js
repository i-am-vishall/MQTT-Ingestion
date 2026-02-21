
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
        const cameraNames = [
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

        console.log("=== USER QUERY EXECUTION ===");
        const query = `
            SELECT
              NOW() AS time,
              COALESCE(SUM(l.crowd_count), 0) AS value
            FROM live_camera_state l
            JOIN camera_master c ON l.camera_id = c.camera_id
            WHERE c.camera_name = ANY($1::text[])
        `;
        const res = await pool.query(query, [cameraNames]);
        console.table(res.rows);

        console.log("\n=== DATA DEBUG ===");

        console.log("\n1. Camera Master Matches:");
        const masterRes = await pool.query("SELECT camera_id, camera_name FROM camera_master WHERE camera_name = ANY($1::text[])", [cameraNames]);
        if (masterRes.rows.length === 0) console.log("   [NONE FOUND]");
        else console.table(masterRes.rows);

        console.log("\n2. Live State Matches (by ID from Master):");
        if (masterRes.rows.length > 0) {
            const ids = masterRes.rows.map(r => r.camera_id);
            const liveRes = await pool.query("SELECT camera_id, crowd_count FROM live_camera_state WHERE camera_id = ANY($1::text[])", [ids]);
            console.table(liveRes.rows);
        }

        console.log("\n3. Live State Camera Names (Direct Debug):");
        // Check if camera names are in live_camera_state but maybe mismatch with master or missing from master
        const liveNameRes = await pool.query("SELECT camera_id, camera_name, crowd_count FROM live_camera_state WHERE camera_name = ANY($1::text[])", [cameraNames]);
        if (liveNameRes.rows.length === 0) console.log("   [NONE FOUND IN LIVE STATE BY NAME]");
        else console.table(liveNameRes.rows);


    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
