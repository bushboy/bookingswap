const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

console.log('🔧 401 Authentication Issue Fix Tool');
console.log('====================================');

const JWT_SECRET = process.env.JWT_SECRET;
console.log(`Current JWT_SECRET: ${JWT_SECRET ? JWT_SECRET.substring(0, 8) + '...' : 'NOT SET'}`);
console.log(`JWT_SECRET length: ${JWT_SECRET ? JWT_SECRET.length : 0}`);
console.log('');

// Known JWT secrets from the codebase
const knownSecrets = [
    JWT_SECRET, // Current .env secret
    'dev_jwt_secret_not_for_production', // Docker override secret
    'test-jwt-secret', // Test secret
    'test-secret-key', // Another test secret
];

console.log('🔍 Testing token with all known JWT secrets...');
console.log('');

// Get token from command line argument
const args = process.argv.slice(2);
if (args.length === 0) {
    console.log('❌ No token provided!');
    console.log('');
    console.log('Usage:');
    console.log('  node fix-401-issue.js "Bearer your_token_here"');
    console.log('  or');
    console.log('  node fix-401-issue.js "your_token_here"');
    console.log('');
    console.log('To get your token:');
    console.log('1. Open browser dev tools (F12)');
    console.log('2. Go to Network tab');
    console.log('3. Refresh the page with 401 error');
    console.log('4. Click on the failed /api/swaps request');
    console.log('5. Copy the Authorization header value');
    console.log('');
    console.log('Or from browser console:');
    console.log('  localStorage.getItem("token")');
    process.exit(1);
}

let token = args[0];
if (token.startsWith('Bearer ')) {
    token = token.substring(7);
}

console.log(`Testing token: ${token.substring(0, 50)}...`);
console.log('');

// First, decode the token to see its structure
console.log('📋 Token Structure Analysis:');
try {
    const decoded = jwt.decode(token, { complete: true });
    if (decoded && decoded.payload) {
        console.log(`  Algorithm: ${decoded.header.alg}`);
        console.log(`  Type: ${decoded.header.typ}`);
        console.log(`  User ID: ${decoded.payload.userId}`);
        console.log(`  Email: ${decoded.payload.email || 'not set'}`);
        console.log(`  Username: ${decoded.payload.username || 'not set'}`);
        console.log(`  Issued: ${new Date(decoded.payload.iat * 1000).toISOString()}`);
        console.log(`  Expires: ${new Date(decoded.payload.exp * 1000).toISOString()}`);
        console.log(`  Is Expired: ${decoded.payload.exp < Date.now() / 1000 ? '❌ YES' : '✅ NO'}`);

        if (decoded.payload.exp < Date.now() / 1000) {
            console.log('');
            console.log('🚨 TOKEN IS EXPIRED!');
            console.log('Solution: User needs to logout and login again.');
            process.exit(0);
        }
    } else {
        console.log('  ❌ Could not decode token structure');
    }
} catch (error) {
    console.log(`  ❌ Token decode failed: ${error.message}`);
}

console.log('');
console.log('🧪 Testing with different JWT secrets:');

let successfulSecret = null;
let verifiedPayload = null;

for (let i = 0; i < knownSecrets.length; i++) {
    const secret = knownSecrets[i];
    if (!secret) continue;

    const secretName = secret === JWT_SECRET ? 'Current .env secret' :
        secret === 'dev_jwt_secret_not_for_production' ? 'Docker dev secret' :
            secret.startsWith('test-') ? 'Test secret' : 'Unknown secret';

    console.log(`  ${i + 1}. Testing with ${secretName} (${secret.substring(0, 8)}...)`);

    try {
        const verified = jwt.verify(token, secret);
        console.log(`     ✅ SUCCESS! Token verified with ${secretName}`);
        console.log(`     User ID: ${verified.userId}`);
        console.log(`     Email: ${verified.email || 'not set'}`);
        successfulSecret = secret;
        verifiedPayload = verified;
        break;
    } catch (error) {
        console.log(`     ❌ Failed: ${error.message}`);
    }
}

console.log('');

if (successfulSecret) {
    console.log('🎉 SOLUTION FOUND!');
    console.log('==================');

    if (successfulSecret === JWT_SECRET) {
        console.log('✅ Token is valid with current JWT_SECRET');
        console.log('The issue might be elsewhere. Check:');
        console.log('1. Database connectivity');
        console.log('2. User exists in database');
        console.log('3. Middleware configuration');
    } else {
        console.log('🔧 TOKEN WAS SIGNED WITH DIFFERENT SECRET');
        console.log('');
        console.log('The token was created with a different JWT_SECRET than what the backend is currently using.');
        console.log('');
        console.log('Solutions:');
        console.log('1. 🔄 RECOMMENDED: User should logout and login again');
        console.log('   - This will create a new token with the current JWT_SECRET');
        console.log('   - Clear browser localStorage/sessionStorage');
        console.log('');
        console.log('2. 🔧 ALTERNATIVE: Update JWT_SECRET to match token');
        console.log(`   - Change JWT_SECRET in .env to: ${successfulSecret}`);
        console.log('   - Restart the backend server');
        console.log('   - ⚠️  This will invalidate all other existing tokens');
        console.log('');
        console.log('3. 🐳 CHECK DOCKER CONFIGURATION');
        console.log('   - If running in Docker, ensure JWT_SECRET is consistent');
        console.log('   - Check docker-compose.yml and docker-compose.override.yml');
    }

    console.log('');
    console.log('🔍 Token Details:');
    console.log(`  User ID: ${verifiedPayload.userId}`);
    console.log(`  Email: ${verifiedPayload.email || 'not set'}`);
    console.log(`  Expires: ${new Date(verifiedPayload.exp * 1000).toISOString()}`);

} else {
    console.log('❌ NO SOLUTION FOUND');
    console.log('====================');
    console.log('The token could not be verified with any known JWT secrets.');
    console.log('');
    console.log('Possible causes:');
    console.log('1. Token is corrupted or malformed');
    console.log('2. Token was signed with a completely different secret');
    console.log('3. Token format is invalid');
    console.log('');
    console.log('Solutions:');
    console.log('1. User should logout and login again');
    console.log('2. Clear all browser storage (localStorage, sessionStorage, cookies)');
    console.log('3. Check if there are multiple backend instances with different secrets');
}

console.log('');
console.log('🚀 Quick Fix Commands:');
console.log('======================');
console.log('For user (in browser console):');
console.log('  localStorage.clear();');
console.log('  sessionStorage.clear();');
console.log('  // Then logout and login again');
console.log('');
console.log('For developer:');
console.log('  # Check current backend JWT_SECRET');
console.log('  echo $JWT_SECRET');
console.log('  # Or restart backend to ensure .env is loaded');
console.log('  npm run dev');