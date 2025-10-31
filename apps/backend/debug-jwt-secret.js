const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '.env') });

console.log('🔍 JWT_SECRET Debug Check');
console.log('=========================');

console.log('Environment variables loaded from .env:');
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`JWT_SECRET exists: ${!!process.env.JWT_SECRET}`);
console.log(`JWT_SECRET length: ${process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 0}`);

if (process.env.JWT_SECRET) {
    console.log(`JWT_SECRET preview: ${process.env.JWT_SECRET.substring(0, 8)}...${process.env.JWT_SECRET.substring(process.env.JWT_SECRET.length - 4)}`);
    console.log(`Full JWT_SECRET: ${process.env.JWT_SECRET}`);
} else {
    console.log('❌ JWT_SECRET is not set!');
}

console.log('');
console.log('🧪 Testing all possible JWT secrets with the new token...');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzOGVhYjNlOC1hMDEzLTQwMzAtYmRkYi01NTEwYjIyYmJjMjIiLCJqdGkiOiI5NWE0MDQwMWE4OGUzYmNlMTNlNmM4ZWJhOTI0MzIwOCIsImVtYWlsIjoidHNlbGlzby5tb3NpdW9hQGdtYWlsLmNvbSIsInVzZXJuYW1lIjoidHNlbGlzbyIsImlhdCI6MTc1OTgwNDY2NCwiZXhwIjoxNzU5ODkxMDY0fQ.ppbZ2KFtlcSFrin1jwM9Ud6y-dy_uKj_rBhgLYmqrvo';

const jwt = require('jsonwebtoken');

// Test with various possible secrets
const possibleSecrets = [
    process.env.JWT_SECRET,
    'E4p+9jdS5T82WGwa00WI8fZoMTQXQuXbkclBLrxCe64=', // From .env file
    'dev_jwt_secret_not_for_production', // Docker dev secret
    'default-secret-change-in-production', // Default fallback
    'test-jwt-secret', // Test secret
    'test-secret-key', // Another test secret
];

console.log('Testing token with different secrets:');

for (let i = 0; i < possibleSecrets.length; i++) {
    const secret = possibleSecrets[i];
    if (!secret) {
        console.log(`${i + 1}. (empty secret) - SKIPPED`);
        continue;
    }

    const secretName =
        secret === process.env.JWT_SECRET ? 'Current process.env.JWT_SECRET' :
            secret === 'E4p+9jdS5T82WGwa00WI8fZoMTQXQuXbkclBLrxCe64=' ? '.env file secret' :
                secret === 'dev_jwt_secret_not_for_production' ? 'Docker dev secret' :
                    secret === 'default-secret-change-in-production' ? 'Default fallback secret' :
                        secret.startsWith('test-') ? 'Test secret' : 'Unknown secret';

    try {
        const verified = jwt.verify(token, secret);
        console.log(`${i + 1}. ✅ SUCCESS with ${secretName}`);
        console.log(`   Secret: ${secret.substring(0, 8)}...${secret.substring(secret.length - 4)}`);
        console.log(`   User ID: ${verified.userId}`);
        console.log(`   Email: ${verified.email}`);
        break;
    } catch (error) {
        console.log(`${i + 1}. ❌ Failed with ${secretName}: ${error.message}`);
    }
}

console.log('');
console.log('🔧 If no secret worked, the issue might be:');
console.log('1. Backend server is not using the .env file');
console.log('2. Backend server is running with different environment variables');
console.log('3. Login endpoint is using a different JWT_SECRET than the API endpoints');
console.log('4. There are multiple backend instances running');

console.log('');
console.log('💡 Next steps:');
console.log('1. Check if backend server is actually running and using this .env file');
console.log('2. Restart the backend server to ensure .env is loaded');
console.log('3. Check server logs for JWT_SECRET warnings');
console.log('4. Verify there\'s only one backend instance running');