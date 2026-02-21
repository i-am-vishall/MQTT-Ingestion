const path = require('path');
const fs = require('fs');

const IS_PKG = process.pkg !== undefined;
const EXEC_DIR = path.dirname(process.execPath);
const BASE_DIR = IS_PKG ? EXEC_DIR : path.join(__dirname, '..', '..');

console.log('IS_PKG:', IS_PKG);
console.log('EXEC_DIR:', EXEC_DIR);
console.log('BASE_DIR:', BASE_DIR);
console.log('__dirname:', __dirname);

const BROKERS_FILE = path.join(IS_PKG ? BASE_DIR : __dirname, 'brokers.json');
console.log('BROKERS_FILE Path:', BROKERS_FILE);
console.log('BROKERS_FILE Exists:', fs.existsSync(BROKERS_FILE));

const DEVICES_FILE = path.join(IS_PKG ? BASE_DIR : __dirname, 'devices.json');
console.log('DEVICES_FILE Path:', DEVICES_FILE);
console.log('DEVICES_FILE Exists:', fs.existsSync(DEVICES_FILE));
