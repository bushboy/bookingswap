import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Pool } from 'pg';
import { AuthService } from '../AuthService';
import { UserRepository } from '../../../database/repositories/UserRepository';
import { JwtTokenBlacklistRepository } from '../../../database/repositories/JwtTokenBlacklistRepository';
import { WalletService } from '../../hedera/WalletService';
import { User } from '@booking-swap/shared';

// This is an integration test that requires a real database connection
// Skip if no database is available
const shouldSkip = !process.env.DATABASE_URL && !process.env.DB_HOST;

describe.skipIf(shouldSkip)('Session Invalidation Integration', () => {
  let pool: Pool;
  let authService: AuthService;
  let userRepository: UserRepository;
  let jwtTokenBlacklistRepository: JwtTokenBlacklistRepository;
  let testUser: User;

  beforeEach(async () => {
    // Create database connection
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'password'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'bookingswap_test'}`,
    });

    // Initialize repositories
    userRepository = new UserRepository(pool);
    jwtTokenBlacklistRepository = new JwtTokenBlacklistRepository(pool);

    // Initialize AuthService with JWT blacklist support
    authService = new AuthService(
      userRepository,
      {} as WalletService, // Mock wallet service for this test
      undefined, // No password reset repository needed
      undefined, // No email service needed
      jwtTokenBlacklistRepository,
      'test-secret-for-integration'
    );

    // Create a test user
    testUser = await userRepository.create({
      walletAddress: '0.0.test123',
      profile: {
        preferences: { notifications: true },
      },
      verification: {
        level: 'basic',
        documents: [],
      },
      reputation: {
        score: 100,
        completedSwaps: 0,
        cancelledSwaps: 0,
        reviews: [],
      },
      lastActiveAt: new Date(),
    });
  });

  afterEach(async () => {
    // Clean up test data
    if (testUser) {
      await pool.query('DELETE FROM jwt_token_blacklist WHERE user_id = $1', [testUser.id]);
      await pool.query('DELETE FROM users WHERE id = $1', [testUser.id]);
    }
    
    // Close database connection
    await pool.end();
  });

  it('should invalidate all user sessions and reject subsequent token verification', async () => {
    // Generate a JWT token for the user
    const token = authService.generateToken(testUser);
    
    // Verify the token is initially valid
    const initialPayload = await authService.verifyToken(token);
    expect(initialPayload.userId).toBe(testUser.id);
    
    // Invalidate all user sessions
    await authService.invalidateAllUserSessions(testUser.id, 'Integration test');
    
    // Verify the token is now invalid
    await expect(authService.verifyToken(token)).rejects.toThrow('User sessions have been invalidated');
    
    // Verify isTokenValid returns false
    const isValid = await authService.isTokenValid(token);
    expect(isValid).toBe(false);
  });

  it('should allow new tokens after session invalidation', async () => {
    // Generate initial token
    const oldToken = authService.generateToken(testUser);
    
    // Invalidate all sessions
    await authService.invalidateAllUserSessions(testUser.id, 'Integration test');
    
    // Old token should be invalid
    await expect(authService.verifyToken(oldToken)).rejects.toThrow('User sessions have been invalidated');
    
    // Generate new token after invalidation
    const newToken = authService.generateToken(testUser);
    
    // New token should be valid
    const newPayload = await authService.verifyToken(newToken);
    expect(newPayload.userId).toBe(testUser.id);
  });

  it('should revoke specific tokens', async () => {
    // Generate two tokens
    const token1 = authService.generateToken(testUser);
    const token2 = authService.generateToken(testUser);
    
    // Both tokens should be valid initially
    await expect(authService.verifyToken(token1)).resolves.toBeDefined();
    await expect(authService.verifyToken(token2)).resolves.toBeDefined();
    
    // Revoke only the first token
    await authService.revokeToken(token1, 'Integration test - specific revocation');
    
    // First token should be invalid
    await expect(authService.verifyToken(token1)).rejects.toThrow('Token has been revoked');
    
    // Second token should still be valid
    const payload2 = await authService.verifyToken(token2);
    expect(payload2.userId).toBe(testUser.id);
  });

  it('should clean up expired blacklist entries', async () => {
    // Generate and revoke a token
    const token = authService.generateToken(testUser);
    await authService.revokeToken(token, 'Integration test - cleanup');
    
    // Verify the blacklist entry exists
    const stats = await jwtTokenBlacklistRepository.getBlacklistStatistics();
    expect(stats.active).toBeGreaterThan(0);
    
    // Manually expire the entry by updating the database
    await pool.query(
      'UPDATE jwt_token_blacklist SET expires_at = NOW() - INTERVAL \'1 day\' WHERE user_id = $1',
      [testUser.id]
    );
    
    // Clean up expired entries
    const cleanedCount = await jwtTokenBlacklistRepository.cleanupExpiredEntries();
    expect(cleanedCount).toBeGreaterThan(0);
    
    // Verify the entry was cleaned up
    const statsAfterCleanup = await jwtTokenBlacklistRepository.getBlacklistStatistics();
    expect(statsAfterCleanup.active).toBe(0);
  });
});