const axios = require('axios');

async function testAuthServiceJWTSecret() {
    console.log('🔍 Testing AuthService JWT_SECRET at Runtime');
    console.log('============================================');

    try {
        // Create a test token by logging in
        console.log('Step 1: Creating a test token via login...');

        // First, let's try to create a token and immediately test it
        // We'll use the debug endpoint to analyze what's happening

        const debugResponse = await axios.get('http://localhost:3001/api/debug/auth/immediate-state', {
            timeout: 5000,
            validateStatus: () => true
        });

        if (debugResponse.status === 200) {
            console.log('✅ Backend is responding');
            console.log(`JWT Secret Configured: ${debugResponse.data.jwtConfig.secretConfigured}`);
            console.log(`JWT Secret Length: ${debugResponse.data.jwtConfig.secretLength}`);

            // Expected length for E4p+9jdS5T82WGwa00WI8fZoMTQXQuXbkclBLrxCe64=
            const expectedLength = 44;

            if (debugResponse.data.jwtConfig.secretLength === expectedLength) {
                console.log('✅ API service is using the expected JWT_SECRET length');
            } else {
                console.log(`❌ API service JWT_SECRET length mismatch!`);
                console.log(`Expected: ${expectedLength}, Actual: ${debugResponse.data.jwtConfig.secretLength}`);
            }
        }

        console.log('');
        console.log('Step 2: Testing token creation and verification flow...');

        // Let's create a simple test to see if we can create and verify a token
        // using the same AuthService instance

        const testTokenResponse = await axios.post('http://localhost:3001/api/debug/auth/immediate-flow-test', {
            authHeader: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzOGVhYjNlOC1hMDEzLTQwMzAtYmRkYi01NTEwYjIyYmJjMjIiLCJqdGkiOiIyYWM2NDNiM2FlY2E0MGRlMTJiY2RkMDEyZTIxMjUwOSIsImVtYWlsIjoidHNlbGlzby5tb3NpdW9hQGdtYWlsLmNvbSIsInVzZXJuYW1lIjoidHNlbGlzbyIsImlhdCI6MTc1OTgwNTU5NCwiZXhwIjoxNzU5ODkxOTk0fQ.yKM1PadCdYkDsiNh8IT1m7qjYJPpaDAivclVdvaUBYI'
        }, {
            timeout: 5000,
            validateStatus: () => true
        });

        if (testTokenResponse.status === 200) {
            console.log('Debug Flow Test Results:');
            console.log(`Debug Result: ${testTokenResponse.data.debugInfo.finalResult}`);
            console.log(`Middleware Result: ${testTokenResponse.data.middlewareResult}`);
            console.log(`JWT Secret Configured: ${testTokenResponse.data.debugInfo.jwtConfig.secretConfigured}`);
            console.log(`JWT Secret Length: ${testTokenResponse.data.debugInfo.jwtConfig.secretLength}`);
            console.log(`Verification Success: ${testTokenResponse.data.debugInfo.verification.success}`);
            console.log(`Verification Error: ${testTokenResponse.data.debugInfo.verification.error || 'None'}`);

            if (testTokenResponse.data.debugInfo.verification.success) {
                console.log('✅ Token verification works in debug flow!');
            } else {
                console.log('❌ Token verification fails even in debug flow');
                console.log('This confirms the JWT_SECRET mismatch issue');
            }
        }

    } catch (error) {
        console.log(`❌ Test failed: ${error.message}`);
    }

    console.log('');
    console.log('🎯 ANALYSIS:');
    console.log('If the debug flow also fails, it confirms that:');
    console.log('1. The AuthService is using a different JWT_SECRET than expected');
    console.log('2. There might be environment variable loading issues');
    console.log('3. The backend might need to be restarted to reload .env');

    console.log('');
    console.log('🔧 RECOMMENDED ACTIONS:');
    console.log('1. Restart the backend server completely');
    console.log('2. Verify .env file is in the correct location');
    console.log('3. Check for any hardcoded JWT_SECRET values');
    console.log('4. Ensure no Docker containers are interfering');
}

testAuthServiceJWTSecret().catch(console.error);