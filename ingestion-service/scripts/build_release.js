const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, '..', 'dist_package');

console.log('=================================');
console.log('   Building Production Release   ');
console.log('=================================');

// 1. Ensure dist_package exists
if (!fs.existsSync(distDir)) {
    console.log(`Creating directory: ${distDir}`);
    fs.mkdirSync(distDir, { recursive: true });
}

// 2. Run pkg to compile the application
console.log('\nCompiling executable with pkg...');
try {
    execSync('npx pkg .', { cwd: rootDir, stdio: 'inherit' });
    console.log('Compilation successful.');
} catch (err) {
    console.error('Failed to compile executable.');
    process.exit(1);
}

// 3. Copy essential files
const filesToCopy = [
    { src: path.join(rootDir, '.env1'), dest: path.join(distDir, '.env'), optional: true },
    { src: path.join(rootDir, '.env'), dest: path.join(distDir, '.env'), optional: true },
    { src: path.join(rootDir, 'init_schema.sql'), dest: path.join(distDir, 'init_schema.sql'), optional: false },
    { src: path.join(__dirname, 'Install_Production_Service.bat'), dest: path.join(distDir, 'Install_Production_Service.bat'), optional: false },
    { src: path.join(__dirname, 'Uninstall_Production_Service.bat'), dest: path.join(distDir, 'Uninstall_Production_Service.bat'), optional: false }
];

console.log('\nCopying required files...');
filesToCopy.forEach(file => {
    if (fs.existsSync(file.src)) {
        // Prefer .env1 if copied first, don't overwrite if .env already copied
        if (file.dest.endsWith('.env') && fs.existsSync(file.dest) && path.basename(file.src) === '.env') {
            return; // Skip if we already copied .env1 to .env
        }
        
        fs.copyFileSync(file.src, file.dest);
        console.log(`Copied ${path.basename(file.src)} -> ${path.basename(file.dest)}`);
    } else if (!file.optional) {
        console.warn(`WARNING: Missing required file: ${file.src}`);
    }
});

console.log('\n=================================');
console.log('   Build Completed Successfully  ');
console.log(`   Output Directory: ${distDir}  `);
console.log('=================================');
