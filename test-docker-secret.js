const jwt = require('jsonwebtoken');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzOGVhYjNlOC1hMDEzLTQwMzAtYmRkYi01NTEwYjIyYmJjMjIiLCJqdGkiOiI5NWE0MDQwMWE4OGUzYmNlMTNlNmM4ZWJhOTI0MzIwOCIsImVtYWlsIjoidHNlbGlzby5tb3NpdW9hQGdtYWlsLmNvbSIsInVzZXJuYW1lIjoidHNlbGlzbyIsImlhdCI6MTc1OTgwNDY2NCwiZXhwIjoxNzU5ODkxMDY0fQ.ppbZ2KFtlcSFrin1jwM9Ud6y-dy_uKj_rBhgLYmqrvo';

console.log('🔍 Testing Token with Docker Dev Secret');
console.log('=======================================');

const dockerSecret = 'dev_jwt_secret_not_for_production';
console.log(`Docker secret: ${dockerSecret}`);

try {
    const verified = jwt.verify(token, dockerSecret);
    console.log('✅ SUCCESS! Token verified with Docker dev secret');
    console.log(`User ID: ${verified.userId}`);
    console.log(`Email: ${verified.email}`);
    console.log(`Username: ${verified.username}`);
    console.log('');
    console.log('🎯 SOLUTION CONFIRMED:');
    console.log('The login service is using the Docker dev JWT_SECRET but the API is using the .env JWT_SECRET');
    console.log('');
    console.log('🔧 Fix options:');
    console.log('1. Update .env JWT_SECRET to match Docker: dev_jwt_secret_not_for_production');
    console.log('2. Stop Docker backend and use only local backend');
    console.log('3. Update docker-compose.override.yml to use .env JWT_SECRET');
} catch (error) {
    console.log(`❌ Failed with Docker secret: ${error.message}`);
    console.log('The token was not signed with the Docker dev secret either.');
    console.log('This suggests there might be yet another JWT_SECRET being used.');
}