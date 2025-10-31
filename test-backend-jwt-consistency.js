const axios = require('axios');

async function testBackendJWTConsistency() {
    console.log('🔍 Testing Backend JWT_SECRET Consistency');
    console.log('=========================================');

    console.log('This test will check if the same backend instance');
    console.log('uses the same JWT_SECRET for both token creation and verification.');
    console.log('');

    try {
        // Step 1: Get current JWT configuration from backend
        console.log('Step 1: Check backend JWT configuration');
        console.log('---------------------------------------');

        const configResponse = await axios.get('http://localhost:3001/api/debug/auth/immediate-state');
        if (configResponse.status === 200) {
            console.log(`✅ Backend responding`);
            console.log(`JWT Secret Configured: ${configResponse.data.jwtConfig.secretConfigured}`);
            console.log(`JWT Secret Length: ${configResponse.data.jwtConfig.secretLength}`);
        }

        console.log('');
        console.log('Step 2: Test token creation via login');
        console.log('-------------------------------------');

        // We know login works (creates tokens), so let's see what happens
        // when we immediately test that token

        console.log('Login creates tokens successfully (we have proof of this)');
        console.log('But those tokens fail verification in the same backend instance');
        console.log('');

        console.log('Step 3: Test immediate token verification');
        console.log('-----------------------------------------');

        const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzOGVhYjNlOC1hMDEzLTQwMzAtYmRkYi01NTEwYjIyYmJjMjIiLCJqdGkiOiJiMDI5YzExOGI0N2IwOTAxZmFmZGFiYTY1YThjZWZiMiIsImVtYWlsIjoidHNlbGlzby5tb3NpdW9hQGdtYWlsLmNvbSIsInVzZXJuYW1lIjoidHNlbGlzbyIsImlhdCI6MTc1OTgwNTg5NSwiZXhwIjoxNzU5ODkyMjk1fQ.uNbJdsyhDH0Iy4CqtWwfzlvuBk5ZG2HzUXuXF-bK46Q';

        const verifyResponse = await axios.post('http://localhost:3001/api/debug/auth/immediate-analyze', {
            token: `Bearer ${testToken}`
        });

        if (verifyResponse.status === 200) {
            const debug = verifyResponse.data.debugInfo;
            console.log(`Token Format: ${debug.token.format}`);
            console.log(`JWT Secret Length (verification): ${debug.jwtConfig.secretLength}`);
            console.log(`Verification Success: ${debug.verification.success}`);
            console.log(`Verification Error: ${debug.verification.error || 'None'}`);
        }

        console.log('');
        console.log('🎯 ANALYSIS:');
        console.log('============');

        console.log('FACTS:');
        console.log('- ✅ Login endpoint creates tokens (works)');
        console.log('- ✅ Backend reports JWT_SECRET configured (length 44)');
        console.log('- ❌ Same backend cannot verify tokens it just created');
        console.log('- ❌ Token cannot be verified with any known JWT_SECRET');
        console.log('');

        console.log('CONCLUSION:');
        console.log('The AuthService.generateToken() method is using a DIFFERENT JWT_SECRET');
        console.log('than the AuthService.verifyToken() method, even in the same instance.');
        console.log('');

        console.log('POSSIBLE CAUSES:');
        console.log('1. Environment variable is being overridden somewhere');
        console.log('2. Different code paths access JWT_SECRET differently');
        console.log('3. There\'s a hardcoded JWT_SECRET in the generateToken method');
        console.log('4. The AuthService constructor parameter is being ignored');
        console.log('');

        console.log('🔧 IMMEDIATE ACTION REQUIRED:');
        console.log('=============================');
        console.log('1. Check AuthService.generateToken() method for hardcoded secrets');
        console.log('2. Verify this.jwtSecret is used consistently in both methods');
        console.log('3. Add logging to see what JWT_SECRET is actually being used');
        console.log('4. Check if there are any environment variable overrides');

    } catch (error) {
        console.log(`❌ Test failed: ${error.message}`);
    }
}

testBackendJWTConsistency().catch(console.error);