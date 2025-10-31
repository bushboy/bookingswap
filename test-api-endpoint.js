const axios = require('axios');

async function testAPI() {
    console.log('🔍 Testing API Endpoints');
    console.log('========================');

    const baseURL = 'http://localhost:3001';

    try {
        // Test health endpoint
        console.log('1. Testing health endpoint...');
        const healthResponse = await axios.get(`${baseURL}/api/health`, {
            timeout: 5000,
            validateStatus: () => true
        });
        console.log(`   Status: ${healthResponse.status}`);
        console.log(`   Response: ${JSON.stringify(healthResponse.data, null, 2)}`);
    } catch (error) {
        console.log(`   ❌ Health endpoint failed: ${error.message}`);
    }

    try {
        // Test debug endpoint
        console.log('\n2. Testing debug auth state endpoint...');
        const debugResponse = await axios.get(`${baseURL}/api/debug/auth/immediate-state`, {
            timeout: 5000,
            validateStatus: () => true
        });
        console.log(`   Status: ${debugResponse.status}`);
        console.log(`   Response: ${JSON.stringify(debugResponse.data, null, 2)}`);
    } catch (error) {
        console.log(`   ❌ Debug endpoint failed: ${error.message}`);
    }

    try {
        // Test swaps endpoint without auth
        console.log('\n3. Testing swaps endpoint (no auth)...');
        const swapsResponse = await axios.get(`${baseURL}/api/swaps`, {
            timeout: 5000,
            validateStatus: () => true
        });
        console.log(`   Status: ${swapsResponse.status}`);
        console.log(`   Response: ${JSON.stringify(swapsResponse.data, null, 2)}`);
    } catch (error) {
        console.log(`   ❌ Swaps endpoint failed: ${error.message}`);
    }

    // Test with the new token
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzOGVhYjNlOC1hMDEzLTQwMzAtYmRkYi01NTEwYjIyYmJjMjIiLCJqdGkiOiI5NWE0MDQwMWE4OGUzYmNlMTNlNmM4ZWJhOTI0MzIwOCIsImVtYWlsIjoidHNlbGlzby5tb3NpdW9hQGdtYWlsLmNvbSIsInVzZXJuYW1lIjoidHNlbGlzbyIsImlhdCI6MTc1OTgwNDY2NCwiZXhwIjoxNzU5ODkxMDY0fQ.ppbZ2KFtlcSFrin1jwM9Ud6y-dy_uKj_rBhgLYmqrvo';

    try {
        // Test swaps endpoint with auth
        console.log('\n4. Testing swaps endpoint (with auth)...');
        const authSwapsResponse = await axios.get(`${baseURL}/api/swaps`, {
            headers: {
                'Authorization': `Bearer ${token}`
            },
            timeout: 5000,
            validateStatus: () => true
        });
        console.log(`   Status: ${authSwapsResponse.status}`);
        console.log(`   Response: ${JSON.stringify(authSwapsResponse.data, null, 2)}`);
    } catch (error) {
        console.log(`   ❌ Auth swaps endpoint failed: ${error.message}`);
    }

    try {
        // Test debug token analysis
        console.log('\n5. Testing debug token analysis...');
        const debugTokenResponse = await axios.post(`${baseURL}/api/debug/auth/immediate-analyze`, {
            token: `Bearer ${token}`
        }, {
            timeout: 5000,
            validateStatus: () => true
        });
        console.log(`   Status: ${debugTokenResponse.status}`);
        console.log(`   Response: ${JSON.stringify(debugTokenResponse.data, null, 2)}`);
    } catch (error) {
        console.log(`   ❌ Debug token analysis failed: ${error.message}`);
    }
}

testAPI().catch(console.error);