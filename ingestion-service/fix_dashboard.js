
const fs = require('fs');

const inputFile = 'c:\\Users\\mevis\\MQTT-Ingetsion\\ingestion-service\\dashboard_v1.json';
const outputFile = 'c:\\Users\\mevis\\MQTT-Ingetsion\\ingestion-service\\dashboard_fixed.json';

const dashboard = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

dashboard.panels.forEach(panel => {
    if (!panel.targets) return;

    panel.targets.forEach(target => {
        if (target.rawSql) {
            let sql = target.rawSql;
            let modified = false;

            // Check if it's a live query (uses live_camera_state)
            if (sql.includes('live_camera_state')) {
                console.log(`Modifying Panel: "${panel.title}"`);

                // Regex Replacements to switch to Smart View

                // 1. Remove JOIN camera_master
                sql = sql.replace(/JOIN camera_master c(\s+)ON l.camera_id = c.camera_id/gi, '');

                // 2. Replace Table Name
                sql = sql.replace(/FROM live_camera_state( l)?/gi, 'FROM vw_live_dashboard');

                // 3. Fix Column Names
                // c.camera_name -> camera_name
                sql = sql.replace(/c\.camera_name/gi, 'camera_name');
                // l.crowd_count -> crowd_count
                sql = sql.replace(/l\.crowd_count/gi, 'crowd_count');
                // COALESCE(l.crowd_count -> COALESCE(crowd_count
                sql = sql.replace(/COALESCE\(l\.crowd_count/gi, 'COALESCE(crowd_count');

                // 4. Time Column: l.crowd_last_time -> updated_at
                sql = sql.replace(/l\.crowd_last_time/gi, 'updated_at');

                // 5. Explicitly handle aliases that might remain
                // e.g. "FROM vw_live_dashboard l" -> "FROM vw_live_dashboard"
                // The regex above "FROM live_camera_state( l)?" -> "FROM vw_live_dashboard" handles the replacements
                // But if we had "SELECT l.x", we need to remove "l."
                sql = sql.replace(/l\./g, '');
                sql = sql.replace(/c\./g, '');

                // 6. Clean up whitespace left by JOIN removal
                sql = sql.replace(/\s+WHERE/gi, '\nWHERE');

                // 7. Special cleanup for WHERE clauses that used table aliases
                // WHERE c.camera_name -> WHERE camera_name (handled by #5)

                modified = true;
            }

            if (modified) {
                target.rawSql = sql;
                console.log('--- NEW SQL ---');
                console.log(sql);
                console.log('---------------');
            }
        }
    });
});

fs.writeFileSync(outputFile, JSON.stringify(dashboard, null, 2));
console.log(`Saved fixed dashboard to ${outputFile}`);
