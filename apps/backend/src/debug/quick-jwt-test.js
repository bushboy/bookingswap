const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

console.log('🔍 Quick JWT Verification Test');
console.log('==============================');

const JWT_SECRET = process.env.JWT_SECRET;
console.log(`JWT_SECRET configured: ${!!JWT_SECRET}`);
console.log(`JWT_SECRET length: ${JWT_SECRET ? JWT_SECRET.length : 0}`);
if (JWT_SECRET && JWT_SECRET.length >= 8) {
    console.log(`JWT_SECRET preview: ${JWT_SECRET.substring(0, 4)}...${JWT_SECRET.substring(JWT_SECRET.length - 4)}`);
}
console.log('');

// Test token verification with a sample token
const samplePayload = {
    userId: '38eab3e8-a013-4030-bddb-5510b22bbc22',
    email: 'test@example.com',
    username: 'testuser',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
};

console.log('📝 Creating test token...');
try {
    const testToken = jwt.sign(samplePayload, JWT_SECRET);
    console.log(`✅ Test token created: ${testToken.substring(0, 50)}...`);

    console.log('');
    console.log('🔍 Verifying test token...');

    const verified = jwt.verify(testToken, JWT_SECRET);
    console.log('✅ Test token verification successful!');
    console.log(`User ID: ${verified.userId}`);
    console.log(`Email: ${verified.email}`);
    console.log(`Expires: ${new Date(verified.exp * 1000).toISOString()}`);

} catch (error) {
    console.log('❌ Test token verification failed:', error.message);
}

console.log('');
console.log('💡 Instructions:');
console.log('1. Check the browser network tab for the actual token being sent');
console.log('2. Copy the Authorization header value');
console.log('3. Test it with: node quick-jwt-test.js "Bearer your_actual_token_here"');

// If a token is provided as argument, test it
const args = process.argv.slice(2);
if (args.length > 0) {
    console.log('');
    console.log('🧪 Testing provided token...');

    let token = args[0];
    if (token.startsWith('Bearer ')) {
        token = token.substring(7);
    }

    console.log(`Token: ${token.substring(0, 50)}...`);

    try {
        // First try to decode without verification
        const decoded = jwt.decode(token, { complete: true });
        if (decoded && decoded.payload) {
            console.log('📋 Token structure:');
            console.log(`  Algorithm: ${decoded.header.alg}`);
            console.log(`  Type: ${decoded.header.typ}`);
            console.log(`  User ID: ${decoded.payload.userId}`);
            console.log(`  Email: ${decoded.payload.email}`);
            console.log(`  Issued: ${new Date(decoded.payload.iat * 1000).toISOString()}`);
            console.log(`  Expires: ${new Date(decoded.payload.exp * 1000).toISOString()}`);
            console.log(`  Is Expired: ${decoded.payload.exp < Date.now() / 1000}`);
        }

        // Now try to verify
        console.log('');
        console.log('🔍 Verifying provided token...');
        const verified = jwt.verify(token, JWT_SECRET);
        console.log('✅ Provided token verification successful!');
        console.log(`User ID: ${verified.userId}`);

    } catch (error) {
        console.log('❌ Provided token verification failed:', error.message);

        if (error.message.includes('signature')) {
            console.log('💡 This suggests the token was signed with a different secret');
        } else if (error.message.includes('expired')) {
            console.log('💡 The token has expired - user needs to login again');
        } else if (error.message.includes('malformed')) {
            console.log('💡 The token format is invalid');
        }
    }
}