/**
 * analyze_deps.js
 *
 * Generates a complete production dependency manifest:
 *   - NPM packages actually required at runtime (no devDeps)
 *   - Vendor binaries (mosquitto, redis)
 *   - External services required (PostgreSQL, Redis port)
 *   - Node.js version requirement
 *   - Total disk footprint estimate
 *
 * Run: node scripts/analyze_deps.js
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const pkg  = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

// ─── 1. RUNTIME NPM PACKAGES ────────────────────────────────────────────────
const deps = pkg.dependencies || {};
const devDeps = pkg.devDependencies || {};

console.log('\n══════════════════════════════════════════════════════════════');
console.log('  I2V MQTT Ingestion Service — Production Dependency Report');
console.log('══════════════════════════════════════════════════════════════\n');

// ─── 2. WHICH PACKAGES ARE ACTUALLY USED IN SOURCE ──────────────────────────
// Scan all source files for require() calls
const SRC_DIRS = ['src', 'utils'];
const srcFiles = [];

SRC_DIRS.forEach(dir => {
    const dirPath = path.join(ROOT, dir);
    if (!fs.existsSync(dirPath)) return;
    fs.readdirSync(dirPath).filter(f => f.endsWith('.js')).forEach(f => {
        srcFiles.push(path.join(dirPath, f));
    });
});

const usedPackages = new Set();
const BUILTIN = new Set([
    'cluster','crypto','events','fs','http','https','net','os','path',
    'stream','string_decoder','url','util','buffer','process','zlib',
    'assert','child_process','timers','perf_hooks'
]);

srcFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const matches = content.matchAll(/require\(['"]([^.\/'"@][^'"]*)['"]\)/g);
    for (const m of matches) {
        const pkg = m[1].startsWith('@') ? m[1].split('/').slice(0,2).join('/') : m[1].split('/')[0];
        if (!BUILTIN.has(pkg)) usedPackages.add(pkg);
    }
});

console.log('┌─ A. NPM RUNTIME DEPENDENCIES ───────────────────────────────');
console.log('│  (packages in package.json dependencies + actually required)');
console.log('│');
const allRuntimePkgs = new Set([...Object.keys(deps), ...usedPackages]);
[...allRuntimePkgs].sort().forEach(name => {
    const version  = deps[name] || '(transitive)';
    const inSource = usedPackages.has(name) ? '✓ direct' : '  transitive';
    const inPkg    = deps[name] ? '' : ' ⚠ NOT in package.json!';
    console.log(`│  ${name.padEnd(30)} ${version.padEnd(14)} ${inSource}${inPkg}`);
});

console.log('│');
console.log('├─ B. UNUSED IN package.json (safe to remove) ────────────────');
Object.keys(deps).filter(n => !usedPackages.has(n)).forEach(name => {
    console.log(`│  ⚠  ${name} — in package.json but not found in source requires`);
});

// ─── 3. NODE_MODULES SIZE ───────────────────────────────────────────────────
function getFolderSizeMB(dir) {
    let total = 0;
    try {
        const stack = [dir];
        while (stack.length) {
            const d = stack.pop();
            fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
                const full = path.join(d, e.name);
                if (e.isDirectory()) stack.push(full);
                else { try { total += fs.statSync(full).size; } catch(_) {} }
            });
        }
    } catch(_) {}
    return (total / 1024 / 1024).toFixed(1);
}

const nmSize = getFolderSizeMB(path.join(ROOT, 'node_modules'));
const srcSize = getFolderSizeMB(path.join(ROOT, 'src'));

console.log('│');
console.log(`├─ C. DISK FOOTPRINT ──────────────────────────────────────────`);
console.log(`│  node_modules/    ${nmSize} MB`);
console.log(`│  src/             ${srcSize} MB`);

// ─── 4. VENDOR BINARIES ─────────────────────────────────────────────────────
console.log('│');
console.log('├─ D. VENDOR BINARIES (bundled in vendor/) ────────────────────');
const vendorDir = path.join(ROOT, 'vendor');
if (fs.existsSync(vendorDir)) {
    const walk = (dir, prefix='') => {
        fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) { walk(full, prefix + e.name + '/'); }
            else {
                const sz = (fs.statSync(full).size / 1024).toFixed(0);
                console.log(`│  vendor/${prefix}${e.name.padEnd(35)} ${sz} KB`);
            }
        });
    };
    walk(vendorDir);
} else {
    console.log('│  (no vendor folder found — run npm run vendor:bundle)');
}

// ─── 5. EXTERNAL SERVICES REQUIRED ─────────────────────────────────────────
console.log('│');
console.log('├─ E. EXTERNAL SERVICES REQUIRED ON PRODUCTION SERVER ─────────');
console.log('│');
console.log('│  SERVICE               PORT    HOW BUNDLED');
console.log('│  ─────────────────     ──────  ───────────────────────────────');
console.log('│  PostgreSQL 11+        5441    pgsql/ inside installer');
console.log('│  Redis / Memurai       6379    i2v-redis Windows service');
console.log('│  Mosquitto (test only) 1885    vendor/mosquitto/mosquitto.exe');
console.log('│  Node.js 18+           —       Must be pre-installed or use pkg');

// ─── 6. NODE VERSION ────────────────────────────────────────────────────────
console.log('│');
console.log('├─ F. RUNTIME ENVIRONMENT ─────────────────────────────────────');
console.log(`│  Node.js required:   >= 18  (tested on v22.x)`);
console.log(`│  Node.js current:    ${process.version}`);
console.log(`│  Platform:           ${process.platform} ${process.arch}`);
console.log(`│  Package main:       ${pkg.main}`);

// ─── 7. WHAT TO SHIP ────────────────────────────────────────────────────────
console.log('│');
console.log('└─ G. WHAT TO INCLUDE IN PRODUCTION PACKAGE ───────────────────');
console.log('');
console.log('   REQUIRED (ship these):');
console.log('   ├── src/               All source files');
console.log('   ├── utils/             Logger + findMosquitto');
console.log('   ├── node_modules/      All npm packages (~23 MB)');
console.log('   ├── vendor/mosquitto/  Bundled broker (stress test only)');
console.log('   ├── .env               Configuration (site-specific)');
console.log('   └── package.json       Version metadata');
console.log('');
console.log('   OPTIONAL (don\'t ship to production):');
console.log('   ├── scripts/           Dev/test scripts only');
console.log('   ├── src/*.log          Log output files');
console.log('   └── src/db_dump.json   Debug dump file');
console.log('');
console.log('   NOT NEEDED (external to Node.js package):');
console.log('   ├── pgsql/             Handled by installer separately');
console.log('   ├── Redis.zip          Handled by installer separately');
console.log('   └── i2v-MQTT-Deploy*   Old deploy packages');
console.log('');
console.log('══════════════════════════════════════════════════════════════\n');
