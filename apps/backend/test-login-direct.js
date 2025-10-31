// Test login directly against the AuthService
const { Pool } = require('pg');
const { parse } = require('pg-connection-string');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

async function testLoginDirect() {
  let pool;
  
  try {
    // Database config
    const parsed = parse('postgresql://booking_swap:P@ssword123@localhost:5432/booking_swap_db');
    const config = {
      host: parsed.host || 'localhost',
      port: parseInt(parsed.port || '5432'),
      database: parsed.database || 'booking_swap_db',
      user: parsed.user || 'postgres',
      password: parsed.password || 'password',
    };
    
    pool = new Pool(config);
    
    // Test email and password (use one of the existing users)
    const testEmail = 'test@example.com';
    const testPassword = 'testpassword'; // You'll need to know the actual password
    
    console.log(`Testing login for: ${testEmail}`);
    
    // Step 1: Find user by email
    console.log('Step 1: Finding user by email...');
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [testEmail]);
    
    if (userResult.rows.length === 0) {
      console.log('✗ User not found');
      return;
    }
    
    const user = userResult.rows[0];
    console.log('✓ User found:', {
      id: user.id,
      username: user.username,
      email: user.email,
      hasPasswordHash: !!user.password_hash
    });
    
    if (!user.password_hash) {
      console.log('✗ User has no password hash');
      return;
    }
    
    // Step 2: Verify password
    console.log('Step 2: Verifying password...');
    try {
      const isValidPassword = await bcrypt.compare(testPassword, user.password_hash);
      console.log('Password verification result:', isValidPassword);
      
      if (!isValidPassword) {
        console.log('✗ Invalid password');
        return;
      }
      
      console.log('✓ Password is valid');
    } catch (error) {
      console.error('✗ Password verification failed:', error.message);
      return;
    }
    
    // Step 3: Generate JWT token
    console.log('Step 3: Generating JWT token...');
    try {
      const jwtSecret = 'E4p+9jdS5T82WGwa00WI8fZoMTQXQuXbkclBLrxCe64='; // From .env
      const jti = require('crypto').randomBytes(16).toString('hex');
      
      const payload = {
        userId: user.id,
        email: user.email,
        username: user.username,
        jti
      };
      
      const token = jwt.sign(payload, jwtSecret, {
        expiresIn: '24h'
      });
      
      console.log('✓ JWT token generated successfully');
      console.log('Token length:', token.length);
      console.log('Token starts with:', token.substring(0, 50) + '...');
      
      // Step 4: Verify the token we just created
      console.log('Step 4: Verifying generated token...');
      const decoded = jwt.verify(token, jwtSecret);
      console.log('✓ Token verification successful');
      console.log('Decoded payload:', decoded);
      
      console.log('\\n✓ All steps completed successfully!');
      console.log('Login should work with these credentials.');
      
    } catch (error) {
      console.error('✗ JWT token generation/verification failed:', error.message);
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
    console.error('Full error:', error);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

testLoginDirect();