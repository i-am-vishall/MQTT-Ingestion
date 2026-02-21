const config = require('./src/config.js');
console.log('DEBUG_MODE:', config.debugMode);
console.log('LOG_LEVEL:', config.logLevel);
console.log('envLoaded:', config.envLoaded);
console.log('envPath:', config.envPath);
console.log('process.env.DEBUG_MODE:', process.env.DEBUG_MODE);
