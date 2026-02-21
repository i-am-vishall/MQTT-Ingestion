const http = require('http');

function get(path) {
    return new Promise((resolve, reject) => {
        http.get({
            hostname: 'localhost',
            port: 3001,
            path: path,
            agent: false  // Create a new agent just for this one request
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        }).on('error', reject);
    });
}

async function test() {
    console.log('--- Testing API Endpoints ---');
    try {
        console.log('0. Testing /api/test');
        const check = await get('/api/test');
        console.log('Status:', check.status);
        console.log('Response:', check.data);

        console.log('1. Testing /api/db/tables');
        const tables = await get('/api/db/tables');
        console.log('Status:', tables.status);
        console.log('Tables:', JSON.stringify(tables.data).substring(0, 100) + '...');

        console.log('\n2. Testing /api/db/columns/anpr_event_fact');
        const cols = await get('/api/db/columns/anpr_event_fact');
        console.log('Status:', cols.status);
        console.log('Columns:', JSON.stringify(cols.data).substring(0, 100) + '...');

    } catch (err) {
        console.error('API Test Failed:', err.message);
    }
}

test();
