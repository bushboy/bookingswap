const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzOGVhYjNlOC1hMDEzLTQwMzAtYmRkYi01NTEwYjIyYmJjMjIiLCJqdGkiOiI5NWE0MDQwMWE4OGUzYmNlMTNlNmM4ZWJhOTI0MzIwOCIsImVtYWlsIjoidHNlbGlzby5tb3NpdW9hQGdtYWlsLmNvbSIsInVzZXJuYW1lIjoidHNlbGlzbyIsImlhdCI6MTc1OTgwNDY2NCwiZXhwIjoxNzU5ODkxMDY0fQ.ppbZ2KFtlcSFrin1jwM9Ud6y-dy_uKj_rBhgLYmqrvo';

console.log('🔍 Comprehensive JWT Secret Search');
console.log('==================================');

// First, let's decode the token to see what we're working with
try {
    const decoded = jwt.decode(token, { complete: true });
    console.log('Token info:');
    console.log(`  User ID: ${decoded.payload.userId}`);
    console.log(`  Email: ${decoded.payload.email}`);
    console.log(`  Created: ${new Date(decoded.payload.iat * 1000).toISOString()}`);
    console.log(`  Expires: ${new Date(decoded.payload.exp * 1000).toISOString()}`);
    console.log('');
} catch (error) {
    console.log('Could not decode token:', error.message);
}

// Collect all possible JWT secrets from various sources
const possibleSecrets = new Set();

// From environment files
try {
    const envContent = fs.readFileSync('apps/backend/.env', 'utf8');
    const jwtMatch = envContent.match(/JWT_SECRET=(.+)/);
    if (jwtMatch) {
        possibleSecrets.add(jwtMatch[1]);
        console.log(`Found in apps/backend/.env: ${jwtMatch[1].substring(0, 8)}...`);
    }
} catch (error) {
    console.log('Could not read apps/backend/.env');
}

try {
    const envTestContent = fs.readFileSync('apps/backend/.env.test', 'utf8');
    const jwtMatch = envTestContent.match(/JWT_SECRET=(.+)/);
    if (jwtMatch) {
        possibleSecrets.add(jwtMatch[1]);
        console.log(`Found in apps/backend/.env.test: ${jwtMatch[1].substring(0, 8)}...`);
    }
} catch (error) {
    console.log('Could not read apps/backend/.env.test');
}

try {
    const envProdContent = fs.readFileSync('.env.production', 'utf8');
    const jwtMatch = envProdContent.match(/JWT_SECRET=(.+)/);
    if (jwtMatch) {
        possibleSecrets.add(jwtMatch[1]);
        console.log(`Found in .env.production: ${jwtMatch[1].substring(0, 8)}...`);
    }
} catch (error) {
    console.log('Could not read .env.production');
}

// From docker-compose files
try {
    const dockerOverrideContent = fs.readFileSync('docker-compose.override.yml', 'utf8');
    const jwtMatch = dockerOverrideContent.match(/JWT_SECRET:\s*(.+)/);
    if (jwtMatch) {
        possibleSecrets.add(jwtMatch[1]);
        console.log(`Found in docker-compose.override.yml: ${jwtMatch[1].substring(0, 8)}...`);
    }
} catch (error) {
    console.log('Could not read docker-compose.override.yml');
}

// Common test/default secrets
const commonSecrets = [
    'default-secret-change-in-production',
    'test-jwt-secret',
    'test-secret-key',
    'test-secret',
    'development-secret',
    'dev-secret',
    'secret',
    'jwt-secret',
    'your-secret-key',
    'your-jwt-secret',
    'booking-swap-secret',
    'booking-swap-jwt-secret',
];

commonSecrets.forEach(secret => possibleSecrets.add(secret));

console.log(`\nTesting ${possibleSecrets.size} possible secrets...\n`);

let found = false;
let secretIndex = 1;

for (const secret of possibleSecrets) {
    try {
        const verified = jwt.verify(token, secret);
        console.log(`✅ SUCCESS! Secret #${secretIndex}: ${secret.substring(0, 8)}...`);
        console.log(`   Full secret: ${secret}`);
        console.log(`   User ID: ${verified.userId}`);
        console.log(`   Email: ${verified.email}`);
        found = true;
        break;
    } catch (error) {
        console.log(`❌ Secret #${secretIndex}: ${secret.substring(0, 8)}... - ${error.message}`);
    }
    secretIndex++;
}

if (!found) {
    console.log('\n🚨 NO MATCHING SECRET FOUND!');
    console.log('This suggests:');
    console.log('1. The token was signed with a secret not in any config file');
    console.log('2. There might be a hardcoded secret somewhere in the code');
    console.log('3. The login service might be a different application entirely');
    console.log('4. The token might be corrupted or from a different system');

    console.log('\n🔍 Next steps:');
    console.log('1. Check if there are multiple backend services running');
    console.log('2. Look for hardcoded JWT secrets in the codebase');
    console.log('3. Check if login is handled by a different service/port');
    console.log('4. Verify the token was actually created by this system');
} else {
    console.log('\n🎯 SOLUTION:');
    console.log('Update the backend to use the same JWT_SECRET that created this token.');
}