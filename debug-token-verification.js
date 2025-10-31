const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, 'apps/backend/.env') });

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzOGVhYjNlOC1hMDEzLTQwMzAtYmRkYi01NTEwYjIyYmJjMjIiLCJqdGkiOiJiMDI5YzExOGI0N2IwOTAxZmFmZGFiYTY1YThjZWZiMiIsImVtYWlsIjoidHNlbGlzby5tb3NpdW9hQGdtYWlsLmNvbSIsInVzZXJuYW1lIjoidHNlbGlzbyIsImlhdCI6MTc1OTgwNTg5NSwiZXhwIjoxNzU5ODkyMjk1fQ.uNbJdsyhDH0Iy4CqtWwfzlvuBk5ZG2HzUXuXF-bK46Q';
const JWT_SECRET = process.env.JWT_SECRET;

console.log('🔍 Detailed Token Verification Analysis');
console.log('======================================');

console.log(`JWT_SECRET: ${JWT_SECRET.substring(0, 8)}...`);
console.log(`Token: ${token.substring(0, 50)}...`);
console.log('');

// Step 1: Basic JWT verification (what jwt.verify does)
console.log('Step 1: Basic JWT Signature Verification');
console.log('----------------------------------------');

try {
    const payload = jwt.verify(token, JWT_SECRET);
    console.log('✅ JWT signature verification PASSED');
    console.log('Payload:', JSON.stringify(payload, null, 2));

    // Step 2: Check payload structure
    console.log('\nStep 2: Payload Structure Analysis');
    console.log('----------------------------------');

    console.log(`User ID: ${payload.userId}`);
    console.log(`JTI: ${payload.jti}`);
    console.log(`Email: ${payload.email}`);
    console.log(`Username: ${payload.username}`);
    console.log(`Issued At: ${new Date(payload.iat * 1000).toISOString()}`);
    console.log(`Expires At: ${new Date(payload.exp * 1000).toISOString()}`);
    console.log(`Is Expired: ${payload.exp < Date.now() / 1000 ? 'YES' : 'NO'}`);

    // Step 3: Check if this matches the expected AuthTokenPayload structure
    console.log('\nStep 3: AuthTokenPayload Structure Check');
    console.log('----------------------------------------');

    const requiredFields = ['userId', 'iat', 'exp'];
    const missingFields = requiredFields.filter(field => !payload[field]);

    if (missingFields.length === 0) {
        console.log('✅ All required fields present');
    } else {
        console.log(`❌ Missing required fields: ${missingFields.join(', ')}`);
    }

    // Step 4: Simulate the AuthService.verifyToken logic
    console.log('\nStep 4: AuthService.verifyToken Simulation');
    console.log('------------------------------------------');

    console.log('✅ JWT verification would pass');
    console.log('⚠️  Token blacklist check would be performed (if repository exists)');
    console.log('⚠️  User session invalidation check would be performed (if repository exists)');

    console.log('\n🎯 CONCLUSION:');
    console.log('The JWT signature verification passes with the current JWT_SECRET.');
    console.log('The failure must be occurring in one of these additional checks:');
    console.log('1. Token blacklist check');
    console.log('2. User session invalidation check');
    console.log('3. Database connectivity issue during these checks');

} catch (error) {
    console.log('❌ JWT signature verification FAILED');
    console.log(`Error: ${error.message}`);

    if (error.name === 'TokenExpiredError') {
        console.log('💡 Token has expired');
    } else if (error.name === 'JsonWebTokenError') {
        console.log('💡 Invalid token signature or format');
        console.log('This means the token was signed with a different JWT_SECRET');
    } else {
        console.log('💡 Unknown JWT verification error');
    }

    console.log('\n🎯 CONCLUSION:');
    console.log('The token cannot be verified with the current JWT_SECRET.');
    console.log('This confirms the token was created with a different secret.');
}

console.log('\n🔧 NEXT STEPS:');
console.log('1. If JWT verification passes, check token blacklist and session invalidation');
console.log('2. If JWT verification fails, the token was created with different JWT_SECRET');
console.log('3. User needs to login again to get a token with current JWT_SECRET');