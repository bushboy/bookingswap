import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Pool } from 'pg';
import { SwapRepository, DatabaseSchemaError, SwapMatchingError } from '../SwapRepository';
import { Swap } from '@booking-swap/shared';

describe('SwapRepository', () => {
  let mockPool: Pool;
  let repository: SwapRepository;

  const mockSwapRow = {
    id: '123',
    source_booking_id: 'booking-123',
    target_booking_id: 'booking-456',
    proposer_id: 'user-123',
    owner_id: 'user-456',
    status: 'pending',
    additional_payment: '50.00',
    conditions: JSON.stringify(['No smoking', 'Pet friendly']),
    expires_at: new Date('2024-01-31'),
    proposal_transaction_id: 'tx-proposal-123',
    execution_transaction_id: 'tx-execution-123',
    escrow_contract_id: 'contract-123',
    proposed_at: new Date('2024-01-01'),
    responded_at: new Date('2024-01-02'),
    completed_at: new Date('2024-01-03'),
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-03'),
  };

  beforeEach(() => {
    mockPool = {
      query: vi.fn(),
      connect: vi.fn(),
    } as any;

    repository = new SwapRepository(mockPool);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('mapRowToEntity', () => {
    it('should correctly map database row to Swap entity', () => {
      const result = repository.mapRowToEntity(mockSwapRow);

      expect(result).toEqual({
        id: '123',
        sourceBookingId: 'booking-123',
        targetBookingId: 'booking-456',
        proposerId: 'user-123',
        ownerId: 'user-456',
        status: 'pending',
        terms: {
          additionalPayment: 50.00,
          conditions: ['No smoking', 'Pet friendly'],
          expiresAt: new Date('2024-01-31'),
        },
        blockchain: {
          proposalTransactionId: 'tx-proposal-123',
          executionTransactionId: 'tx-execution-123',
          escrowContractId: 'contract-123',
        },
        timeline: {
          proposedAt: new Date('2024-01-01'),
          respondedAt: new Date('2024-01-02'),
          completedAt: new Date('2024-01-03'),
        },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-03'),
      });
    });

    it('should handle null additional payment', () => {
      const rowWithoutPayment = { ...mockSwapRow, additional_payment: null };
      const result = repository.mapRowToEntity(rowWithoutPayment);

      expect(result.terms.additionalPayment).toBeUndefined();
    });
  });

  describe('mapEntityToRow', () => {
    it('should correctly map Swap entity to database row', () => {
      const swap: Omit<Swap, 'id' | 'createdAt' | 'updatedAt'> = {
        sourceBookingId: 'booking-123',
        targetBookingId: 'booking-456',
        proposerId: 'user-123',
        ownerId: 'user-456',
        status: 'pending',
        terms: {
          additionalPayment: 50.00,
          conditions: ['No smoking', 'Pet friendly'],
          expiresAt: new Date('2024-01-31'),
        },
        blockchain: {
          proposalTransactionId: 'tx-proposal-123',
          executionTransactionId: 'tx-execution-123',
          escrowContractId: 'contract-123',
        },
        timeline: {
          proposedAt: new Date('2024-01-01'),
          respondedAt: new Date('2024-01-02'),
          completedAt: new Date('2024-01-03'),
        },
      };

      const result = repository.mapEntityToRow(swap);

      expect(result).toEqual({
        source_booking_id: 'booking-123',
        target_booking_id: 'booking-456',
        proposer_id: 'user-123',
        owner_id: 'user-456',
        status: 'pending',
        additional_payment: 50.00,
        conditions: JSON.stringify(['No smoking', 'Pet friendly']),
        expires_at: new Date('2024-01-31'),
        proposal_transaction_id: 'tx-proposal-123',
        execution_transaction_id: 'tx-execution-123',
        escrow_contract_id: 'contract-123',
        proposed_at: new Date('2024-01-01'),
        responded_at: new Date('2024-01-02'),
        completed_at: new Date('2024-01-03'),
      });
    });
  });

  describe('findByUserId', () => {
    it('should find swaps by user ID (as proposer or owner)', async () => {
      (mockPool.query as any).mockResolvedValue({
        rows: [mockSwapRow],
      });

      const result = await repository.findByUserId('user-123');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE proposer_id = $1 OR owner_id = $1'),
        ['user-123', 100, 0]
      );
      expect(result).toHaveLength(1);
      expect(result[0].proposerId).toBe('user-123');
    });
  });

  describe('findByBookingId', () => {
    it('should find swaps by booking ID (as source or target)', async () => {
      (mockPool.query as any).mockResolvedValue({
        rows: [mockSwapRow],
      });

      const result = await repository.findByBookingId('booking-123');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE source_booking_id = $1 OR target_booking_id = $1'),
        ['booking-123', 100, 0]
      );
      expect(result).toHaveLength(1);
      expect(result[0].sourceBookingId).toBe('booking-123');
    });
  });

  describe('findEligibleSwapsWithBookingDetails', () => {
    it('should call database function and return eligible swaps', async () => {
      const mockFunctionResult = {
        rows: [
          {
            swap_id: 'swap-123',
            source_booking_id: 'booking-123',
            booking_title: 'Test Booking',
            booking_description: 'Test Description',
            city: 'New York',
            country: 'USA',
            check_in_date: '2024-01-01',
            check_out_date: '2024-01-03',
            booking_type: 'hotel',
            estimated_value: '100.00',
            swap_status: 'pending',
            created_at: '2024-01-01T00:00:00Z'
          }
        ]
      };

      (mockPool.query as any).mockResolvedValue(mockFunctionResult);

      const result = await repository.findEligibleSwapsWithBookingDetails('user-123', 'target-swap-456');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM find_eligible_swaps_optimized($1, $2, $3)'),
        ['user-123', 'target-swap-456', 50]
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'swap-123',
        sourceBookingId: 'booking-123',
        title: 'Test Booking',
        description: 'Test Description',
        bookingDetails: {
          location: 'New York, USA',
          dateRange: {
            checkIn: new Date('2024-01-01'),
            checkOut: new Date('2024-01-03')
          },
          accommodationType: 'hotel',
          guests: 1,
          estimatedValue: 100
        },
        status: 'pending',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        isCompatible: false,
        compatibilityScore: undefined
      });
    });

    it('should handle database schema errors (42703)', async () => {
      const schemaError = new Error('column "owner_id" does not exist');
      (schemaError as any).code = '42703';

      (mockPool.query as any).mockRejectedValue(schemaError);

      await expect(
        repository.findEligibleSwapsWithBookingDetails('user-123', 'target-swap-456')
      ).rejects.toThrow('The system is experiencing database schema issues');
    });

    it('should handle function not found errors (42883)', async () => {
      const functionError = new Error('function find_eligible_swaps_optimized does not exist');
      (functionError as any).code = '42883';

      (mockPool.query as any).mockRejectedValue(functionError);

      await expect(
        repository.findEligibleSwapsWithBookingDetails('user-123', 'target-swap-456')
      ).rejects.toThrow('The system is experiencing database function issues');
    });

    it('should handle other database errors', async () => {
      const dbError = new Error('Connection timeout');
      (mockPool.query as any).mockRejectedValue(dbError);

      await expect(
        repository.findEligibleSwapsWithBookingDetails('user-123', 'target-swap-456')
      ).rejects.toThrow('Failed to get eligible swaps');
    });
  });

  describe('findByFilters', () => {
    it('should find swaps by proposer ID filter', async () => {
      (mockPool.query as any).mockResolvedValue({
        rows: [mockSwapRow],
      });

      const result = await repository.findByFilters({
        proposerId: 'user-123',
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE proposer_id = $1'),
        ['user-123', 100, 0]
      );
      expect(result).toHaveLength(1);
    });

    it('should find swaps by status filter', async () => {
      (mockPool.query as any).mockResolvedValue({
        rows: [mockSwapRow],
      });

      const result = await repository.findByFilters({
        status: 'pending',
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = $1'),
        ['pending', 100, 0]
      );
      expect(result).toHaveLength(1);
    });

    it('should find swaps by expiration date range', async () => {
      (mockPool.query as any).mockResolvedValue({
        rows: [mockSwapRow],
      });

      const expiresAfter = new Date('2024-01-01');
      const expiresBefore = new Date('2024-02-01');

      const result = await repository.findByFilters({
        expiresAfter,
        expiresBefore,
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE expires_at > $1 AND expires_at < $2'),
        [expiresAfter, expiresBefore, 100, 0]
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('findPendingSwapsForUser', () => {
    it('should find pending swaps for user as owner', async () => {
      (mockPool.query as any).mockResolvedValue({
        rows: [mockSwapRow],
      });

      const result = await repository.findPendingSwapsForUser('user-456');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE owner_id = $1 AND status = 'pending' AND expires_at > NOW()"),
        ['user-456']
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('findExpiredSwaps', () => {
    it('should find expired pending swaps', async () => {
      (mockPool.query as any).mockResolvedValue({
        rows: [mockSwapRow],
      });

      const result = await repository.findExpiredSwaps();

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE status = 'pending' AND expires_at <= NOW()")
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('updateStatus', () => {
    it('should update swap status', async () => {
      (mockPool.query as any).mockResolvedValue({
        rows: [{ ...mockSwapRow, status: 'accepted' }],
      });

      const respondedAt = new Date();
      const result = await repository.updateStatus('123', 'accepted', respondedAt);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SET status = $2, responded_at = $3'),
        ['123', 'accepted', respondedAt]
      );
      expect(result?.status).toBe('accepted');
    });

    it('should update status with completion date', async () => {
      (mockPool.query as any).mockResolvedValue({
        rows: [{ ...mockSwapRow, status: 'completed' }],
      });

      const respondedAt = new Date();
      const completedAt = new Date();
      const result = await repository.updateStatus('123', 'completed', respondedAt, completedAt);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SET status = $2, responded_at = $3, completed_at = $4'),
        ['123', 'completed', respondedAt, completedAt]
      );
      expect(result?.status).toBe('completed');
    });

    it('should return null when swap not found', async () => {
      (mockPool.query as any).mockResolvedValue({
        rows: [],
      });

      const result = await repository.updateStatus('123', 'accepted');

      expect(result).toBeNull();
    });
  });

  describe('updateBlockchainInfo', () => {
    it('should update blockchain information', async () => {
      (mockPool.query as any).mockResolvedValue({
        rows: [{ ...mockSwapRow, execution_transaction_id: 'new-tx-123' }],
      });

      const result = await repository.updateBlockchainInfo('123', {
        executionTransactionId: 'new-tx-123',
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SET execution_transaction_id = $2'),
        ['123', 'new-tx-123']
      );
      expect(result?.blockchain.executionTransactionId).toBe('new-tx-123');
    });

    it('should return existing swap when no updates provided', async () => {
      vi.spyOn(repository, 'findById').mockResolvedValue({
        id: '123',
      } as Swap);

      const result = await repository.updateBlockchainInfo('123', {});

      expect(repository.findById).toHaveBeenCalledWith('123');
      expect(result?.id).toBe('123');
    });
  });

  describe('getSwapStatistics', () => {
    it('should return swap statistics for all users', async () => {
      (mockPool.query as any).mockResolvedValue({
        rows: [{
          total: '100',
          pending: '10',
          completed: '80',
          cancelled: '5',
          rejected: '5',
        }],
      });

      const result = await repository.getSwapStatistics();

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*) as total'),
        []
      );
      expect(result).toEqual({
        total: 100,
        pending: 10,
        completed: 80,
        cancelled: 5,
        rejected: 5,
      });
    });

    it('should return swap statistics for specific user', async () => {
      (mockPool.query as any).mockResolvedValue({
        rows: [{
          total: '20',
          pending: '2',
          completed: '15',
          cancelled: '2',
          rejected: '1',
        }],
      });

      const result = await repository.getSwapStatistics('user-123');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE proposer_id = $1 OR owner_id = $1'),
        ['user-123']
      );
      expect(result).toEqual({
        total: 20,
        pending: 2,
        completed: 15,
        cancelled: 2,
        rejected: 1,
      });
    });
  });

  describe('findActiveSwapsForBookings', () => {
    it('should find active swaps for multiple bookings', async () => {
      (mockPool.query as any).mockResolvedValue({
        rows: [mockSwapRow],
      });

      const result = await repository.findActiveSwapsForBookings(['booking-123', 'booking-456']);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE (source_booking_id IN ($1, $2) OR target_booking_id IN ($1, $2))'),
        ['booking-123', 'booking-456', 'booking-123', 'booking-456']
      );
      expect(result).toHaveLength(1);
    });

    it('should return empty array for empty booking list', async () => {
      const result = await repository.findActiveSwapsForBookings([]);

      expect(result).toEqual([]);
      expect(mockPool.query).not.toHaveBeenCalled();
    });
  });
});