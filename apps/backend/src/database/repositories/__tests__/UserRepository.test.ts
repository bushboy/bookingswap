import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Pool } from 'pg';
import { UserRepository } from '../UserRepository';
import { User } from '@booking-swap/shared';

describe('UserRepository', () => {
  let mockPool: Pool;
  let mockClient: any;
  let repository: UserRepository;

  const mockUserRow = {
    id: '123',
    wallet_address: '0x1234567890abcdef',
    display_name: 'John Doe',
    email: 'john@example.com',
    phone: '+1234567890',
    notifications_enabled: true,
    auto_accept_criteria: JSON.stringify({ maxAdditionalPayment: 100 }),
    verification_level: 'verified',
    verification_documents: JSON.stringify(['doc1.pdf', 'doc2.pdf']),
    verified_at: new Date('2023-01-01'),
    reputation_score: '4.5',
    completed_swaps: '10',
    cancelled_swaps: '2',
    last_active_at: new Date('2023-12-01'),
    created_at: new Date('2023-01-01'),
    updated_at: new Date('2023-12-01'),
  };

  beforeEach(() => {
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };

    mockPool = {
      query: vi.fn(),
      connect: vi.fn().mockResolvedValue(mockClient),
    } as any;

    repository = new UserRepository(mockPool);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('mapRowToEntity', () => {
    it('should correctly map database row to User entity', () => {
      const result = repository.mapRowToEntity(mockUserRow);

      expect(result).toEqual({
        id: '123',
        walletAddress: '0x1234567890abcdef',
        profile: {
          displayName: 'John Doe',
          email: 'john@example.com',
          phone: '+1234567890',
          preferences: {
            notifications: true,
            autoAcceptCriteria: { maxAdditionalPayment: 100 },
          },
        },
        verification: {
          level: 'verified',
          documents: ['doc1.pdf', 'doc2.pdf'],
          verifiedAt: new Date('2023-01-01'),
        },
        reputation: {
          score: 4.5,
          completedSwaps: 10,
          cancelledSwaps: 2,
          reviews: [],
        },
        lastActiveAt: new Date('2023-12-01'),
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-12-01'),
      });
    });
  });

  describe('mapEntityToRow', () => {
    it('should correctly map User entity to database row', () => {
      const user: Omit<User, 'id' | 'createdAt' | 'updatedAt'> = {
        walletAddress: '0x1234567890abcdef',
        profile: {
          displayName: 'John Doe',
          email: 'john@example.com',
          phone: '+1234567890',
          preferences: {
            notifications: true,
            autoAcceptCriteria: { maxAdditionalPayment: 100 },
          },
        },
        verification: {
          level: 'verified',
          documents: ['doc1.pdf', 'doc2.pdf'],
          verifiedAt: new Date('2023-01-01'),
        },
        reputation: {
          score: 4.5,
          completedSwaps: 10,
          cancelledSwaps: 2,
          reviews: [],
        },
        lastActiveAt: new Date('2023-12-01'),
      };

      const result = repository.mapEntityToRow(user);

      expect(result).toEqual({
        wallet_address: '0x1234567890abcdef',
        display_name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        notifications_enabled: true,
        auto_accept_criteria: JSON.stringify({ maxAdditionalPayment: 100 }),
        verification_level: 'verified',
        verification_documents: JSON.stringify(['doc1.pdf', 'doc2.pdf']),
        verified_at: new Date('2023-01-01'),
        reputation_score: 4.5,
        completed_swaps: 10,
        cancelled_swaps: 2,
        last_active_at: new Date('2023-12-01'),
      });
    });
  });

  describe('findByWalletAddress', () => {
    it('should find user by wallet address', async () => {
      (mockPool.query as any).mockResolvedValue({
        rows: [mockUserRow],
      });

      const result = await repository.findByWalletAddress('0x1234567890abcdef');

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE wallet_address = $1',
        ['0x1234567890abcdef']
      );
      expect(result?.walletAddress).toBe('0x1234567890abcdef');
    });

    it('should return null when user not found', async () => {
      (mockPool.query as any).mockResolvedValue({
        rows: [],
      });

      const result = await repository.findByWalletAddress('0xnotfound');

      expect(result).toBeNull();
    });
  });

  describe('findByFilters', () => {
    it('should find users by wallet address filter', async () => {
      (mockPool.query as any).mockResolvedValue({
        rows: [mockUserRow],
      });

      const result = await repository.findByFilters({
        walletAddress: '0x1234567890abcdef',
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE wallet_address = $1'),
        ['0x1234567890abcdef', 100, 0]
      );
      expect(result).toHaveLength(1);
    });

    it('should find users by verification level filter', async () => {
      (mockPool.query as any).mockResolvedValue({
        rows: [mockUserRow],
      });

      const result = await repository.findByFilters({
        verificationLevel: 'verified',
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE verification_level = $1'),
        ['verified', 100, 0]
      );
      expect(result).toHaveLength(1);
    });

    it('should find active users', async () => {
      (mockPool.query as any).mockResolvedValue({
        rows: [mockUserRow],
      });

      const result = await repository.findByFilters({
        isActive: true,
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE last_active_at > $1'),
        [expect.any(Date), 100, 0]
      );
      expect(result).toHaveLength(1);
    });

    it('should combine multiple filters', async () => {
      (mockPool.query as any).mockResolvedValue({
        rows: [mockUserRow],
      });

      const result = await repository.findByFilters({
        verificationLevel: 'verified',
        isActive: true,
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE verification_level = $1 AND last_active_at > $2'),
        ['verified', expect.any(Date), 100, 0]
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('updateLastActive', () => {
    it('should update last active timestamp', async () => {
      (mockPool.query as any).mockResolvedValue({});

      await repository.updateLastActive('123');

      expect(mockPool.query).toHaveBeenCalledWith(
        'UPDATE users SET last_active_at = NOW() WHERE id = $1',
        ['123']
      );
    });
  });

  describe('updateReputation', () => {
    it('should update reputation score', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [mockUserRow] }) // UPDATE
        .mockResolvedValueOnce({}); // COMMIT

      const result = await repository.updateReputation('123', {
        scoreChange: 0.5,
        completedSwapsChange: 1,
      });

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        ['123', 0.5, 1]
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(result?.id).toBe('123');
    });

    it('should rollback on error', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('Database error')); // UPDATE fails

      await expect(
        repository.updateReputation('123', { scoreChange: 0.5 })
      ).rejects.toThrow('Database error');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should return existing user when no changes provided', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}); // ROLLBACK

      vi.spyOn(repository, 'findById').mockResolvedValue({
        id: '123',
      } as User);

      const result = await repository.updateReputation('123', {});

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(repository.findById).toHaveBeenCalledWith('123');
      expect(result?.id).toBe('123');
    });
  });
});