// Create a test user with known credentials
const { Pool } = require('pg');
const { parse } = require('pg-connection-string');
const bcrypt = require('bcryptjs');

async function createTestUser() {
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
    
    const testEmail = 'debug@test.com';
    const testUsername = 'debuguser';
    const testPassword = 'password123';
    
    console.log('Creating test user with credentials:');
    console.log('Email:', testEmail);
    console.log('Username:', testUsername);
    console.log('Password:', testPassword);
    
    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1 OR username = $2', [testEmail, testUsername]);
    
    if (existingUser.rows.length > 0) {
      console.log('User already exists, deleting first...');
      await pool.query('DELETE FROM users WHERE email = $1 OR username = $2', [testEmail, testUsername]);
    }
    
    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(testPassword, saltRounds);
    
    // Insert user
    const result = await pool.query(`
      INSERT INTO users (username, email, password_hash, verification_level)
      VALUES ($1, $2, $3, 'basic')
      RETURNING id, username, email
    `, [testUsername, testEmail, passwordHash]);
    
    const newUser = result.rows[0];
    console.log('✓ Test user created successfully:');
    console.log('  ID:', newUser.id);
    console.log('  Username:', newUser.username);
    console.log('  Email:', newUser.email);
    
    console.log('\\nYou can now test login with:');
    console.log('  Email: debug@test.com');
    console.log('  Password: password123');
    
  } catch (error) {
    console.error('Failed to create test user:', error.message);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

createTestUser();