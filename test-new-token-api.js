const axios = require('axios');

const newToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzOGVhYjNlOC1hMDEzLTQwMzAtYmRkYi01NTEwYjIyYmJjMjIiLCJqdGkiOiIzZDg0ODdhMmMxY2M1ZTIwNDczNDlmYTljZTNjMGM5YiIsImVtYWlsIjoidHNlbGlzby5tb3NpdW9hQGdtYWlsLmNvbSIsInVzZXJuYW1lIjoidHNlbGlzbyIsImlhdCI6MTc1OTgwNjYwOSwiZXhwIjoxNzU5ODkzMDA5fQ.6hOg-nH_cr26cVSc9ElB4R6bSebrmZt2100MZSIp3-M';

async function testNewToken() {
    console.log('🧪 Testing Brand New Token Against API');
    console.log('======================================');

    console.log(`New token: ${newToken.substring(0, 50)}...`);
    console.log('');

    try {
        // Test the new token with the /swaps endpoint
        console.log('Testing /api/swaps endpoint...');
        const response = await axios.get('http://localhost:3001/api/swaps', {
            headers: {
                'Authorization': `Bearer ${newToken}`
            },
            timeout: 5000,
            validateStatus: () => true
        });

        console.log(`Status: ${response.status}`);

        if (response.status === 200) {
            console.log('✅ SUCCESS! New token works perfectly!');
            console.log('The 401 issue has been resolved by getting a fresh token.');
            console.log(`Response: ${JSON.stringify(response.data, null, 2)}`);
        } else {
            console.log('❌ New token still fails!');
            console.log(`Error: ${JSON.stringify(response.data, null, 2)}`);

            if (response.status === 401) {
                console.log('');
                console.log('🚨 CRITICAL ISSUE CONFIRMED:');
                console.log('Even brand new tokens are failing verification.');
                console.log('This indicates a JWT_SECRET mismatch between login and API services.');
            }
        }

    } catch (error) {
        console.log(`❌ API request failed: ${error.message}`);
    }

    console.log('');

    try {
        // Also test with the debug endpoint
        console.log('Testing debug token analysis...');
        const debugResponse = await axios.post('http://localhost:3001/api/debug/auth/immediate-analyze', {
            token: `Bearer ${newToken}`
        }, {
            timeout: 5000,
            validateStatus: () => true
        });

        console.log(`Debug Status: ${debugResponse.status}`);
        if (debugResponse.status === 200) {
            console.log('Debug Analysis:');
            console.log(`Final Result: ${debugResponse.data.debugInfo.finalResult}`);
            console.log(`Verification Success: ${debugResponse.data.debugInfo.verification.success}`);
            console.log(`Verification Error: ${debugResponse.data.debugInfo.verification.error || 'None'}`);
            console.log(`JWT Secret Configured: ${debugResponse.data.debugInfo.jwtConfig.secretConfigured}`);
            console.log(`JWT Secret Length: ${debugResponse.data.debugInfo.jwtConfig.secretLength}`);
        }

    } catch (error) {
        console.log(`❌ Debug request failed: ${error.message}`);
    }
}

testNewToken().catch(console.error);