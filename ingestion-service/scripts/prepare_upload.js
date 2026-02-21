const fs = require('fs');
const path = require('path');

try {
    const dashboardPath = path.resolve(__dirname, '../../monitoring/comprehensive_dashboard_final.json');
    const outputPath = path.resolve(__dirname, '../../monitoring/dashboard_upload.json');

    console.log(`Reading dashboard from: ${dashboardPath}`);
    const dashboard = JSON.parse(fs.readFileSync(dashboardPath, 'utf8'));

    // Ensure ID is null so Grafana handles it as a new/update by UID
    // dashboard.id = null; // actually if we overwrite we keep uid

    const payload = {
        dashboard: dashboard,
        overwrite: true,
        message: "Updated via automated script"
    };

    console.log(`Writing payload to: ${outputPath}`);
    fs.writeFileSync(outputPath, JSON.stringify(payload));
    console.log("Success");
} catch (e) {
    console.error("Error:", e);
}
