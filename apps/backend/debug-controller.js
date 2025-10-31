// Debug the exact AuthController logic
const { Pool } = require('pg');
const { parse } = require('pg-connection-string');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('@hapi/joi');

// Mock the UserRepository (same as before)
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

// Mock AuthService (same as before)
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
    now.setHours(now.getHours() + 24);
    return now;
  }

  async authenticateWithEmail(email, password) {
    console.log('AuthService.authenticateWithEmail called', { email });
    
    const user = await this.userRepository.findByEmail(email);
    console.log('User lookup result', { found: !!user, hasPasswordHash: !!(user?.passwordHash) });
    
    if (!user || !user.passwordHash) {
      console.warn('User not found or no password hash', { email, userFound: !!user });
      throw new Error('Invalid email or password');
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    console.log('Password verification result', { email, isValid: isValidPassword });
    
    if (!isValidPassword) {
      console.warn('Password verification failed', { email });
      throw new Error('Invalid email or password');
    }

    const token = this.generateToken({
      id: user.id,
      username: user.username,
      email: user.email,
    });

    const expiresAt = this.getTokenExpirationDate();

    return {
      user,
      token,
      expiresAt,
    };
  }
}

// Joi schema (from AuthController)
const loginSchema = Joi.object({
  email: Joi.string().email({ tlds: false }).required(),
  password: Joi.string().required(),
});

// Mock AuthController emailLogin method
async function mockEmailLogin(authService, reqBody) {
  try {
    console.log('AuthController.emailLogin called', { body: reqBody });
    
    // Step 1: Validate request
    console.log('Step 1: Validating request...');
    const { error, value } = loginSchema.validate(reqBody);
    if (error) {
      console.warn('Validation error in emailLogin', { error: error.details[0].message });
      return {
        status: 400,
        body: {
          success: false,
          message: error.details[0].message,
        }
      };
    }

    const { email, password } = value;
    console.log('Attempting email login', { email });

    // Step 2: Authenticate
    console.log('Step 2: Calling AuthService...');
    const loginResult = await authService.authenticateWithEmail(email, password);
    console.log('AuthService returned result');

    // Step 3: Format response (this is where the error might be)
    console.log('Step 3: Formatting response...');
    console.log('loginResult.user structure:', {
      id: loginResult.user.id,
      username: loginResult.user.username,
      email: loginResult.user.email,
      verification: loginResult.user.verification,
      verificationLevel: loginResult.user.verification?.level
    });

    const responseBody = {
      success: true,
      message: 'Login successful',
      user: {
        id: loginResult.user.id,
        username: loginResult.user.username,
        email: loginResult.user.email,
        verificationLevel: loginResult.user.verification?.level || 'basic',
      },
      token: loginResult.token,
    };

    console.log('Response body created:', responseBody);

    return {
      status: 200,
      body: responseBody
    };

  } catch (error) {
    console.error('Login failed', { error: error.message, stack: error.stack });
    
    if (error.message === 'Invalid email or password') {
      return {
        status: 401,
        body: {
          success: false,
          message: 'Invalid email or password',
        }
      };
    }

    return {
      status: 500,
      body: {
        success: false,
        message: 'Internal server error',
      }
    };
  }
}

async function debugController() {
  let pool;
  
  try {
    console.log('=== Debugging AuthController Logic ===');
    
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
    
    // Test request body
    const reqBody = {
      email: 'debug@test.com',
      password: 'password123'
    };
    
    console.log(`\\nTesting controller logic with:`, reqBody);
    
    const result = await mockEmailLogin(authService, reqBody);
    
    console.log('\\n=== Controller Result ===');
    console.log('Status:', result.status);
    console.log('Body:', JSON.stringify(result.body, null, 2));
    
    if (result.status === 200) {
      console.log('\\n✓ Controller logic works perfectly!');
      console.log('The 500 error must be coming from somewhere else.');
    } else {
      console.log('\\n✗ Controller logic failed');
    }
    
  } catch (error) {
    console.error('Debug failed:', error.message);
    console.error('Full error:', error);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

debugController();