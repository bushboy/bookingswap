const axios = require('axios');

async function testBackendJWTSecret() {
    console.log('🔍 Testing Backend JWT_SECRET Configuration');
    console.log('===========================================');

    try {
        // Call the debug endpoint to see what JWT_SECRET the backend is using
        const response = await axios.get('http://localhost:3001/api/debug/auth/immediate-state', {
            timeout: 5000,
            validateStatus: () => true
        });

        if (response.status === 200) {
            console.log('✅ Backend is responding');
            console.log(`JWT Secret Configured: ${response.data.jwtConfig.secretConfigured}`);
            console.log(`JWT Secret Length: ${response.data.jwtConfig.secretLength}`);

            // The backend should be using the .env JWT_SECRET
            const expectedLength = 44; // Length of E4p+9jdS5T82WGwa00WI8fZoMTQXQuXbkclBLrxCe64=

            if (response.data.jwtConfig.secretLength === expectedLength) {
                console.log('✅ Backend appears to be using the .env JWT_SECRET');
            } else {
                console.log('❌ Backend is using a different JWT_SECRET!');
                console.log(`Expected length: ${expectedLength}, Actual length: ${response.data.jwtConfig.secretLength}`);
            }
        } else {
            console.log(`❌ Backend debug endpoint failed: ${response.status}`);
        }

    } catch (error) {
        console.log(`❌ Failed to connect to backend: ${error.message}`);
    }

    console.log('');
    console.log('🧪 Testing token creation with current backend...');

    // Try to create a new token by logging in
    try {
        const loginResponse = await axios.post('http://localhost:3001/api/auth/email-login', {
            email: 'tseliso.mosiuoa@gmail.com',
            password: 'your_password_here' // You'll need to provide the actual password
        }, {
            timeout: 10000,
            validateStatus: () => true
        });

        if (loginResponse.status === 200 && loginResponse.data.token) {
            console.log('✅ Login successful, new token created');
            const newToken = loginResponse.data.token;
            console.log(`New token: ${newToken.substring(0, 50)}...`);

            // Test the new token immediately
            const testResponse = await axios.get('http://localhost:3001/api/swaps', {
                headers: {
                    'Authorization': `Bearer ${newToken}`
                },
                timeout: 5000,
                validateStatus: () => true
            });

            console.log(`New token test result: ${testResponse.status}`);
            if (testResponse.status === 200) {
                console.log('✅ New token works! The issue was with the old token.');
            } else {
                console.log('❌ New token also fails! There\'s a deeper configuration issue.');
                console.log(`Error: ${JSON.stringify(testResponse.data, null, 2)}`);
            }

        } else {
            console.log(`❌ Login failed: ${loginResponse.status}`);
            console.log(`Response: ${JSON.stringify(loginResponse.data, null, 2)}`);
        }

    } catch (error) {
        console.log(`❌ Login test failed: ${error.message}`);
        console.log('Note: You may need to provide the correct password for the test user');
    }

    console.log('');
    console.log('💡 Recommendations:');
    console.log('1. If new tokens work, the issue was with old cached tokens');
    console.log('2. If new tokens also fail, there\'s a JWT_SECRET configuration mismatch');
    console.log('3. Check if there are multiple backend instances running');
    console.log('4. Restart the backend server to ensure .env is loaded properly');
}

testBackendJWTSecret().catch(console.error);