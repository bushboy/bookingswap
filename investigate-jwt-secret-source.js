const axios = require('axios');
const jwt = require('jsonwebtoken');

async function investigateJWTSecretSource() {
    console.log('🔍 Deep Investigation: JWT_SECRET Source Analysis');
    console.log('=================================================');

    const newToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzOGVhYjNlOC1hMDEzLTQwMzAtYmRkYi01NTEwYjIyYmJjMjIiLCJqdGkiOiJiMDI5YzExOGI0N2IwOTAxZmFmZGFiYTY1YThjZWZiMiIsImVtYWlsIjoidHNlbGlzby5tb3NpdW9hQGdtYWlsLmNvbSIsInVzZXJuYW1lIjoidHNlbGlzbyIsImlhdCI6MTc1OTgwNTg5NSwiZXhwIjoxNzU5ODkyMjk1fQ.uNbJdsyhDH0Iy4CqtWwfzlvuBk5ZG2HzUXuXF-bK46Q';

    console.log('Step 1: Decode token to analyze signature');
    console.log('----------------------------------------');

    const decoded = jwt.decode(newToken, { complete: true });
    console.log('Token header:', JSON.stringify(decoded.header, null, 2));
    console.log('Token payload:', JSON.stringify(decoded.payload, null, 2));
    console.log(`Token created: ${new Date(decoded.payload.iat * 1000).toISOString()}`);
    console.log(`Token expires: ${new Date(decoded.payload.exp * 1000).toISOString()}`);
    console.log('');

    console.log('Step 2: Test with all known JWT secrets');
    console.log('---------------------------------------');

    const possibleSecrets = [
        'E4p+9jdS5T82WGwa00WI8fZoMTQXQuXbkclBLrxCe64=', // From .env
        'dev_jwt_secret_not_for_production', // Docker dev
        'default-secret-change-in-production', // Default fallback
        'test-jwt-secret', // Test secret
        'test-secret-key', // Another test secret
        'your-secure-jwt-secret', // From docs
        'your_very_secure_jwt_secret_here_minimum_32_characters', // From docs
        'your-development-jwt-secret-at-least-32-characters-long', // From docs
        'your-very-secure-jwt-secret-at-least-64-characters-long-for-production-use', // From docs
    ];

    let foundSecret = null;

    for (let i = 0; i < possibleSecrets.length; i++) {
        const secret = possibleSecrets[i];
        try {
            const verified = jwt.verify(newToken, secret);
            console.log(`✅ SUCCESS with secret #${i + 1}: ${secret.substring(0, 12)}...`);
            console.log(`   Full secret: ${secret}`);
            console.log(`   User ID: ${verified.userId}`);
            foundSecret = secret;
            break;
        } catch (error) {
            console.log(`❌ Failed with secret #${i + 1}: ${secret.substring(0, 12)}... - ${error.message}`);
        }
    }

    if (!foundSecret) {
        console.log('\n🚨 NO KNOWN SECRET WORKS!');
        console.log('This means the token was signed with a secret not in our list.');
        console.log('');

        // Let's try to reverse-engineer what secret might be used
        console.log('Step 3: Reverse Engineering Attempt');
        console.log('-----------------------------------');

        // Try some variations of the .env secret
        const baseSecret = 'E4p+9jdS5T82WGwa00WI8fZoMTQXQuXbkclBLrxCe64=';
        const variations = [
            baseSecret.trim(),
            baseSecret.replace(/\s/g, ''),
            baseSecret + '\n',
            baseSecret + '\r\n',
            '"' + baseSecret + '"',
            "'" + baseSecret + "'",
        ];

        console.log('Testing variations of the .env secret:');
        for (let i = 0; i < variations.length; i++) {
            try {
                const verified = jwt.verify(newToken, variations[i]);
                console.log(`✅ SUCCESS with variation #${i + 1}: "${variations[i]}"`);
                foundSecret = variations[i];
                break;
            } catch (error) {
                console.log(`❌ Variation #${i + 1} failed: "${variations[i]}"`);
            }
        }
    }

    console.log('\nStep 4: Check what the backend reports');
    console.log('--------------------------------------');

    try {
        const debugResponse = await axios.get('http://localhost:3001/api/debug/auth/immediate-state');
        if (debugResponse.status === 200) {
            console.log(`Backend JWT Secret Length: ${debugResponse.data.jwtConfig.secretLength}`);
            console.log(`Backend JWT Secret Configured: ${debugResponse.data.jwtConfig.secretConfigured}`);

            if (foundSecret) {
                console.log(`Found Secret Length: ${foundSecret.length}`);
                console.log(`Length Match: ${debugResponse.data.jwtConfig.secretLength === foundSecret.length ? 'YES' : 'NO'}`);
            }
        }
    } catch (error) {
        console.log('Failed to get backend debug info');
    }

    console.log('\n🎯 CONCLUSION:');
    if (foundSecret) {
        console.log(`The token was signed with: ${foundSecret}`);
        console.log('But the backend API is using a different secret for verification.');
        console.log('This confirms there are TWO different JWT_SECRET values in use.');
    } else {
        console.log('The token was signed with an unknown JWT_SECRET.');
        console.log('This suggests a configuration issue or hardcoded secret somewhere.');
    }

    console.log('\n🔧 NEXT STEPS:');
    console.log('1. Check if there are multiple backend processes running');
    console.log('2. Verify the .env file is being loaded correctly');
    console.log('3. Look for any hardcoded JWT_SECRET values in the code');
    console.log('4. Check if Docker or other services are interfering');
}

investigateJWTSecretSource().catch(console.error);