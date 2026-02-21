const Service = require('node-windows').Service;
const path = require('path');
const fs = require('fs');

// Create a new service object
const svc = new Service({
    name: 'MQTT_Ingestion_Service',
    description: 'Ingests data from MQTT to PostgreSQL (Wrapped for Stability)',
    script: path.join(__dirname, '..', 'dist', 'mqtt-ingestion-service-v4.exe'),
    execPath: path.join(__dirname, '..', 'dist', 'mqtt-ingestion-service-v4.exe'),
    nodeOptions: [
        '--harmony',
        '--max_old_space_size=4096'
    ]
    //, wait: 2,
    //, grow: .5
});

// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on('install', function () {
    console.log('Service Installed. Starting now...');
    svc.start();
});

// Listen for the "alreadyinstalled" event
svc.on('alreadyinstalled', function () {
    console.log('Service is already installed.');
    console.log('Attempting to restart...');
    svc.start();
});

// Listen for the "start" event
svc.on('start', function () {
    console.log('Service started successfully!');
    console.log('The Error 1053 should now be gone because the wrapper handles the handshake.');
});

// Install the script as a service.
console.log('Installing Service Wrapper...');
svc.install();
