const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'I2V_Deployment_Full');

console.log('=================================');
console.log('   Assembling Full Production Release   ');
console.log('=================================');

if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

// 1. Build Ingestion Service
console.log('\n[1/3] Building Ingestion Service...');
try {
    execSync('npx pkg . --targets node18-win-x64 --output ../I2V_Deployment_Full/ingestion-service.exe', { 
        cwd: path.join(rootDir, 'ingestion-service'), stdio: 'inherit' 
    });
} catch(e) { console.error('Failed ingestion', e); }

// 2. Build Config UI Backend
console.log('\n[2/3] Building Config UI Backend...');
try {
    execSync('npx pkg . --targets node18-win-x64 --output ../../I2V_Deployment_Full/config-ui-service.exe', { 
        cwd: path.join(rootDir, 'config-ui', 'server'), stdio: 'inherit' 
    });
} catch(e) { console.error('Failed config backend', e); }

// 3. Build Config UI Frontend
console.log('\n[3/3] Building Config UI Frontend...');
try {
    execSync('npm run build', { 
        cwd: path.join(rootDir, 'config-ui', 'client'), stdio: 'inherit' 
    });
    // Copy frontend to distDir/client
    fs.cpSync(path.join(rootDir, 'config-ui', 'client', 'dist'), path.join(distDir, 'client'), { recursive: true });
} catch(e) { console.error('Failed config frontend', e); }

// Copy other assets
console.log('\nCopying Assets...');
try {
    // Redis
    fs.copyFileSync(path.join(rootDir, 'Redis.zip'), path.join(distDir, 'Redis.zip'));
    // DB Scripts
    fs.copyFileSync(path.join(rootDir, 'ingestion-service', 'init_schema.sql'), path.join(distDir, 'init_schema.sql'));
    // Env
    fs.copyFileSync(path.join(rootDir, '.env'), path.join(distDir, '.env'));
    
    // Installer Script
    const installScript = `@echo off
chcp 65001 >nul
echo I2V Full Deployment Installer
echo.

set "TARGET_DIR=C:\\Program Files (x86)\\I2V-Deployment"
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"

echo [1/3] Copying files...
xcopy "%~dp0*" "%TARGET_DIR%\\" /Y /E /Q

cd /d "%TARGET_DIR%"

echo [2/3] Extracting Redis...
powershell -Command "Expand-Archive -Path Redis.zip -DestinationPath Redis -Force"

echo [3/3] Installing Services...
sc create "I2V-Ingestion-Service" binPath= "%TARGET_DIR%\\ingestion-service.exe" start= auto
sc failure "I2V-Ingestion-Service" reset= 0 actions= restart/60000/restart/60000/restart/60000
sc start "I2V-Ingestion-Service"

sc create "I2V-Config-Service" binPath= "%TARGET_DIR%\\config-ui-service.exe" start= auto
sc failure "I2V-Config-Service" reset= 0 actions= restart/60000/restart/60000/restart/60000
sc start "I2V-Config-Service"

echo Done! Access the UI at http://localhost:3001
pause
`;
    fs.writeFileSync(path.join(distDir, 'install.bat'), installScript);
    
    // Create ZIP
    console.log('\nZipping the deployment package...');
    execSync(`powershell -Command "Compress-Archive -Path '${distDir}\\*' -DestinationPath '${rootDir}\\I2V_Deployment_Full.zip' -Force"`);

} catch(e) { console.error('Failed copying assets', e); }

console.log('\nSUCCESS! Zip created at: ' + path.join(rootDir, 'I2V_Deployment_Full.zip'));
