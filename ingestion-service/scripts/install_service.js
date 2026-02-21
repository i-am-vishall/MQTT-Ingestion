const Service = require('node-windows').Service;
const path = require('path');

// Create a new service object
const svc = new Service({
    name: 'MQTT Ingestion Service',
    description: 'Ingests real-time MQTT alerts into PostgreSQL.',
    script: path.join(__dirname, '../src/index.js'),
    env: [
        {
            name: "HOME",
            value: process.env["USERPROFILE"] // service is now able to access the user who created the service
        }
        // Note: Environment variables from .env are loaded by the app itself using dotenv.
        // However, for a service, sometimes it's better to inline them or ensure the CWD is correct.
        // node-windows usually runs from the script directory or similar.
        // Relying on .env next to index.js or via absolute path in src/config.js is best.
    ]
});

// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on('install', function () {
    console.log('Service installed successfully!');
    svc.start();
});

svc.on('alreadyinstalled', function () {
    console.log('Service is already installed.');
    svc.start();
});

svc.install();
