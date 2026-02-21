const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../grafana_dashboards/dashboard_anpr_enhanced.json');

console.log('Reading dashboard:', filePath);
let rawData = fs.readFileSync(filePath, 'utf8');
let dashboard = JSON.parse(rawData);

// The Optimized Filtering Logic (GIN Index Friendly)
const optimizedFilter = `
    (
      e.payload @> '{"properties": {"NoHelmet": "True"}}' OR
      e.payload @> '{"properties": {"NoSeatBelt": "True"}}' OR
      e.payload @> '{"properties": {"SpeedViolated": "True"}}' OR
      e.payload @> '{"properties": {"TrippleRiding": "True"}}' OR
      e.payload @> '{"properties": {"WrongDirectionDetected": "True"}}' OR
      e.payload @> '{"properties": {"RedLightViolated": "True"}}' OR
      e.payload @> '{"properties": {"IsDrivingWhileOnTheMobile": "True"}}' OR
      e.payload @> '{"properties": {"StoppedVehicleDetected": "True"}}'
    )
`;

// Regex to find the Old Slow Filter
// We match the pattern of payload->...->>'NoHelmet' = 'True' ... all the way to StoppedVehicleDetected
const slowPattern = /\(\s*payload->'properties'->>'NoHelmet' = 'True'[\s\S]*?StoppedVehicleDetected' = 'True'\s*\)/g;
const slowPattern2 = /\(\s*e.payload->'properties'->>'NoHelmet' = 'True'[\s\S]*?StoppedVehicleDetected' = 'True'\s*\)/g;


let count = 0;

// Iterate Panels and Targets
dashboard.panels.forEach(panel => {
    if (panel.targets) {
        panel.targets.forEach(target => {
            if (target.rawSql) {
                // Check match
                if (slowPattern.test(target.rawSql) || slowPattern2.test(target.rawSql)) {
                    console.log(`Optimizing Panel: ${panel.title}`);
                    // Replace logic
                    // We need to match precise text or use replacement of the block
                    // Since regex replace is tricky with multiline in loose string, 
                    // we will just construct the new query if it matches the general intention.

                    // Simple text replacement strategy
                    let newSql = target.rawSql
                        .replace(slowPattern, optimizedFilter)
                        .replace(slowPattern2, optimizedFilter);

                    target.rawSql = newSql;
                    count++;
                }
            }
        });
    }
});

console.log(`Optimized ${count} queries.`);
fs.writeFileSync(filePath, JSON.stringify(dashboard, null, 2));
console.log('Dashboard saved.');
