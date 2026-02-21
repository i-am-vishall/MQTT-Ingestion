const Service = require('node-windows').Service;
const path = require('path');

// Create a new service object
const svc = new Service({
    name: 'MQTT_Ingestion_Service',
    description: 'Ingests data from MQTT to PostgreSQL (Wrapped for Stability)',
    script: path.join(__dirname, '..', 'dist', 'mqtt-ingestion-service-v4.exe'),
    execPath: path.join(__dirname, '..', 'dist', 'mqtt-ingestion-service-v4.exe')
});

// Uninstall first
console.log('Uninstalling existing wrapper (if any)...');
svc.uninstall();

svc.on('uninstall', function () {
    console.log('Uninstallation complete.');
    console.log('Installing fresh wrapper...');
    svc.install();
});

svc.on('install', function () {
    console.log('Service Installed. Starting now...');
    svc.start();
});

svc.on('alreadyinstalled', function () {
    console.log('Service is already installed.');
    svc.start();
});

svc.on('start', function () {
    console.log('Service started successfully!');
});

// Watch for errors
svc.on('error', function (err) {
    console.log('Service Error: ', err);
});
