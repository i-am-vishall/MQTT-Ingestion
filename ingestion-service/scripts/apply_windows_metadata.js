/**
 * Apply Windows metadata to compiled executables using rcedit
 * Run this after pkg compiles the executables
 */
const { rcedit } = require('rcedit');
const path = require('path');

// Note: This script runs from ingestion-service, but dist is in parent MQTT-Ingetsion
const distPath = path.join(__dirname, '..', '..', 'dist', 'I2V_Smart_City_Release_v1.0.2');

const executables = [
    {
        path: path.join(distPath, 'dist_package', 'i2v-ingestion-service.exe'),
        options: {
            'version-string': {
                ProductName: 'I2V Ingestion Service',
                FileDescription: 'I2V Smart City - Real-time MQTT Ingestion Service',
                CompanyName: 'I2V systems',
                LegalCopyright: 'Copyright (c) 2026 I2V systems',
                OriginalFilename: 'i2v-ingestion-service.exe',
                InternalName: 'i2v-ingestion-service'
            },
            'file-version': '1.0.2.0',
            'product-version': '1.0.2.0'
        }
    },
    {
        path: path.join(distPath, 'components', 'i2v-config-service.exe'),
        options: {
            'version-string': {
                ProductName: 'I2V Config Service',
                FileDescription: 'I2V Smart City - Configuration UI Backend Service',
                CompanyName: 'I2V systems',
                LegalCopyright: 'Copyright (c) 2026 I2V systems',
                OriginalFilename: 'i2v-config-service.exe',
                InternalName: 'i2v-config-service'
            },
            'file-version': '1.0.2.0',
            'product-version': '1.0.2.0'
        }
    }
];

async function applyMetadata() {
    for (const exe of executables) {
        console.log(`Applying metadata to: ${exe.path}`);
        try {
            await rcedit(exe.path, exe.options);
            console.log(`  ✓ Success`);
        } catch (err) {
            console.error(`  ✗ Error: ${err.message}`);
        }
    }
}

applyMetadata();
