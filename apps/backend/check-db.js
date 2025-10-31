// Simple script to check database connection and users
const { Pool } = require('pg');
const { parse } = require('pg-connection-string');

async function checkDatabase() {
  let pool;
  
  try {
    // Parse database config
    const parsed = parse('postgresql://booking_swap:P@ssword123@localhost:5432/booking_swap_db');
    const config = {
      host: parsed.host || 'localhost',
      port: parseInt(parsed.port || '5432'),
      database: parsed.database || 'booking_swap_db',
      user: parsed.user || 'postgres',
      password: parsed.password || 'password',
    };
    
    console.log('Connecting to database with config:', {
      ...config,
      password: '***'
    });
    
    pool = new Pool(config);
    
    // Test connection
    console.log('Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('✓ Database connection successful');
    
    // Check if users table exists
    console.log('Checking if users table exists...');
    const tableResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    if (tableResult.rows[0].exists) {
      console.log('✓ Users table exists');
      
      // Check users count
      const countResult = await pool.query('SELECT COUNT(*) FROM users');
      console.log(`Users in database: ${countResult.rows[0].count}`);
      
      // Show sample users (without passwords)
      const usersResult = await pool.query(`
        SELECT id, username, email, wallet_address, 
               CASE WHEN password_hash IS NOT NULL THEN 'YES' ELSE 'NO' END as has_password
        FROM users 
        LIMIT 5
      `);
      
      if (usersResult.rows.length > 0) {
        console.log('Sample users:');
        usersResult.rows.forEach(user => {
          console.log(`  - ID: ${user.id}`);
          console.log(`    Username: ${user.username || 'NULL'}`);
          console.log(`    Email: ${user.email || 'NULL'}`);
          console.log(`    Wallet: ${user.wallet_address || 'NULL'}`);
          console.log(`    Has Password: ${user.has_password}`);
          console.log('');
        });
      } else {
        console.log('No users found in database');
      }
    } else {
      console.log('✗ Users table does not exist');
    }
    
  } catch (error) {
    console.error('Database check failed:', error.message);
    console.error('Full error:', error);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

checkDatabase();