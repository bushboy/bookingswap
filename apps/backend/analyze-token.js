const jwt = require('jsonwebtoken');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzOGVhYjNlOC1hMDEzLTQwMzAtYmRkYi01NTEwYjIyYmJjMjIiLCJqdGkiOiI5NWE0MDQwMWE4OGUzYmNlMTNlNmM4ZWJhOTI0MzIwOCIsImVtYWlsIjoidHNlbGlzby5tb3NpdW9hQGdtYWlsLmNvbSIsInVzZXJuYW1lIjoidHNlbGlzbyIsImlhdCI6MTc1OTgwNDY2NCwiZXhwIjoxNzU5ODkxMDY0fQ.ppbZ2KFtlcSFrin1jwM9Ud6y-dy_uKj_rBhgLYmqrvo';

console.log('🔍 Token Analysis');
console.log('=================');

// Decode without verification
try {
    const decoded = jwt.decode(token, { complete: true });
    if (decoded && decoded.payload) {
        console.log('📋 Token Structure:');
        console.log(`  Algorithm: ${decoded.header.alg}`);
        console.log(`  Type: ${decoded.header.typ}`);
        console.log(`  User ID: ${decoded.payload.userId}`);
        console.log(`  JTI: ${decoded.payload.jti}`);
        console.log(`  Email: ${decoded.payload.email}`);
        console.log(`  Username: ${decoded.payload.username}`);
        console.log(`  Issued: ${new Date(decoded.payload.iat * 1000).toISOString()}`);
        console.log(`  Expires: ${new Date(decoded.payload.exp * 1000).toISOString()}`);
        console.log(`  Current Time: ${new Date().toISOString()}`);
        console.log(`  Is Expired: ${decoded.payload.exp < Date.now() / 1000 ? '❌ YES' : '✅ NO'}`);

        if (decoded.payload.exp < Date.now() / 1000) {
            console.log('\n🚨 TOKEN IS EXPIRED!');
            console.log('This is why you\'re getting 401 errors.');
            console.log('Solution: Logout and login again to get a fresh token.');
        } else {
            console.log('\n✅ Token is not expired. Issue is likely JWT_SECRET mismatch.');
        }
    }
} catch (error) {
    console.log(`❌ Token decode failed: ${error.message}`);
}

// Test with current JWT_SECRET
const JWT_SECRET = 'E4p+9jdS5T82WGwa00WI8fZoMTQXQuXbkclBLrxCe64=';
console.log('\n🔍 Testing with current JWT_SECRET...');
try {
    const verified = jwt.verify(token, JWT_SECRET);
    console.log('✅ SUCCESS! Token verified with current JWT_SECRET');
    console.log(`User ID: ${verified.userId}`);
} catch (error) {
    console.log(`❌ FAILED: ${error.message}`);

    if (error.message.includes('expired')) {
        console.log('💡 Token has expired - user needs to login again');
    } else if (error.message.includes('signature')) {
        console.log('💡 Token was signed with different JWT_SECRET');
    }
}

// Test with Docker dev secret
const DOCKER_SECRET = 'dev_jwt_secret_not_for_production';
console.log('\n🔍 Testing with Docker dev JWT_SECRET...');
try {
    const verified = jwt.verify(token, DOCKER_SECRET);
    console.log('✅ SUCCESS! Token verified with Docker dev JWT_SECRET');
    console.log(`User ID: ${verified.userId}`);
    console.log('\n🔧 SOLUTION: JWT_SECRET mismatch detected!');
    console.log('The token was created with Docker dev secret but backend is using .env secret');
} catch (error) {
    console.log(`❌ FAILED: ${error.message}`);
}

console.log('\n🚀 RECOMMENDED SOLUTION:');
console.log('User should logout and login again to get a fresh token with current JWT_SECRET');