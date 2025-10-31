// Debug the AuthService directly to find the exact error
const { Pool } = require('pg');
const { parse } = require('pg-connection-string');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Mock the UserRepository
class UserRepository {
  constructor(pool) {
    this.pool = pool;
    this.tableName = 'users';
  }

  mapRowToEntity(row) {
    return {
      id: row.id,
      walletAddress: row.wallet_address,
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash,
      profile: {
        displayName: row.display_name,
        email: row.email,
        phone: row.phone,
        preferences: {
          notifications: row.notifications_enabled,
          autoAcceptCriteria: {
            maxAdditionalPayment: row.auto_accept_max_payment ? parseFloat(row.auto_accept_max_payment) : undefined,
            preferredLocations: row.auto_accept_locations || [],
            bookingTypes: row.auto_accept_booking_types || [],
          },
        },
      },
      verification: {
        level: row.verification_level,
        documents: row.verification_documents || [],
        verifiedAt: row.verified_at,
      },
      reputation: {
        score: parseFloat(row.reputation_score || 0),
        completedSwaps: parseInt(row.completed_swaps || 0),
        cancelledSwaps: parseInt(row.cancelled_swaps || 0),
        reviews: [],
      },
      lastActiveAt: row.last_active_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findByEmail(email) {
    const query = `SELECT * FROM ${this.tableName} WHERE email = $1`;
    const result = await this.pool.query(query, [email]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToEntity(result.rows[0]);
  }
}

// Mock AuthService
class AuthService {
  constructor(userRepository, jwtSecret = 'E4p+9jdS5T82WGwa00WI8fZoMTQXQuXbkclBLrxCe64=', jwtExpiresIn = '24h') {
    this.userRepository = userRepository;
    this.jwtSecret = jwtSecret;
    this.jwtExpiresIn = jwtExpiresIn;
  }

  generateToken(user) {
    const jti = require('crypto').randomBytes(16).toString('hex');
    
    const payload = {
      userId: user.id,
      jti,
    };

    if (user.walletAddress) {
      payload.walletAddress = user.walletAddress;
    }

    if (user.email) {
      payload.email = user.email;
    }
    if (user.username) {
      payload.username = user.username;
    }

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn,
    });
  }

  getTokenExpirationDate() {
    const now = new Date();
    now.setHours(now.getHours() + 24); // 24 hours from now
    return now;
  }

  async authenticateWithEmail(email, password) {
    try {
      console.log('AuthService.authenticateWithEmail called', { email });
      
      // Find user by email
      console.log('Finding user by email...');
      const user = await this.userRepository.findByEmail(email);
      console.log('User lookup result', { found: !!user, hasPasswordHash: !!(user?.passwordHash) });
      
      if (!user || !user.passwordHash) {
        console.warn('User not found or no password hash', { email, userFound: !!user });
        throw new Error('Invalid email or password');
      }

      // Verify password
      console.log('Verifying password...');
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      console.log('Password verification result', { email, isValid: isValidPassword });
      
      if (!isValidPassword) {
        console.warn('Password verification failed', { email });
        throw new Error('Invalid email or password');
      }

      // Generate JWT token
      console.log('Generating JWT token...');
      const token = this.generateToken({
        id: user.id,
        username: user.username,
        email: user.email,
      });

      const expiresAt = this.getTokenExpirationDate();

      console.log('Login successful, returning result');
      return {
        user,
        token,
        expiresAt,
      };
    } catch (error) {
      console.error('Email authentication failed', { error: error.message, email, stack: error.stack });
      throw error;
    }
  }
}

async function debugAuthService() {
  let pool;
  
  try {
    console.log('=== Debugging AuthService ===');
    
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
    
    // Initialize services
    const userRepository = new UserRepository(pool);
    const authService = new AuthService(userRepository);
    
    // Test credentials
    const testEmail = 'debug@test.com';
    const testPassword = 'password123';
    
    console.log(`\\nTesting authentication for: ${testEmail}`);
    
    try {
      const result = await authService.authenticateWithEmail(testEmail, testPassword);
      console.log('\\n✓ Authentication successful!');
      console.log('User ID:', result.user.id);
      console.log('Token length:', result.token.length);
      console.log('Expires at:', result.expiresAt);
      
      // Test token verification
      console.log('\\nTesting token verification...');
      const decoded = jwt.verify(result.token, 'E4p+9jdS5T82WGwa00WI8fZoMTQXQuXbkclBLrxCe64=');
      console.log('✓ Token verification successful');
      console.log('Decoded payload:', decoded);
      
    } catch (error) {
      console.error('\\n✗ Authentication failed:', error.message);
      console.error('Error stack:', error.stack);
    }
    
  } catch (error) {
    console.error('Setup failed:', error.message);
    console.error('Full error:', error);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

debugAuthService();