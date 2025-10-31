import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { apiErrorRecoveryService, PartialUpdateFailure, RecoveryStrategy } from '../apiErrorRecoveryService';
import { bookingEditService } from '../bookingEditService';
import { swapSpecificationService } from '../swapSpecificationService';

// Mock the services
vi.mock('../bookingEditService');
vi.mock('../swapSpecificationService');

describe('ApiErrorRecoveryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiErrorRecoveryService.clearSnapshots();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createSnapshot', () => {
    it('should create a snapshot with booking data', async () => {
      const mockBookingData = {
        id: 'booking-123',
        title: 'Test Booking',
        type: 'hotel',
      };

      vi.mocked(bookingEditService.getBooking).mockResolvedValue(mockBookingData as any);

      const snapshot = await apiErrorRecoveryService.createSnapshot(
        'operation-123',
        'booking-123'
      );

      expect(snapshot.operationId).toBe('operation-123');
      expect(snapshot.bookingData).toEqual(mockBookingData);
      expect(snapshot.timestamp).toBeInstanceOf(Date);
    });

    it('should create a snapshot with swap data', async () => {
      const mockSwapData = {
        id: 'swap-123',
        bookingId: 'booking-123',
        paymentTypes: ['booking', 'cash'],
      };

      vi.mocked(swapSpecificationService.getSwapSpecification).mockResolvedValue(mockSwapData as any);

      const snapshot = await apiErrorRecoveryService.createSnapshot(
        'operation-123',
        undefined,
        'swap-123'
      );

      expect(snapshot.operationId).toBe('operation-123');
      expect(snapshot.swapData).toEqual(mockSwapData);
    });

    it('should create a snapshot with both booking and swap data', async () => {
      const mockBookingData = { id: 'booking-123', title: 'Test Booking' };
      const mockSwapData = { id: 'swap-123', bookingId: 'booking-123' };

      vi.mocked(bookingEditService.getBooking).mockResolvedValue(mockBookingData as any);
      vi.mocked(swapSpecificationService.getSwapSpecificationByBooking).mockResolvedValue(mockSwapData as any);

      const snapshot = await apiErrorRecoveryService.createSnapshot(
        'operation-123',
        'booking-123'
      );

      expect(snapshot.bookingData).toEqual(mockBookingData);
      expect(snapshot.swapData).toEqual(mockSwapData);
    });

    it('should handle errors when creating snapshots', async () => {
      vi.mocked(bookingEditService.getBooking).mockRejectedValue(new Error('API Error'));

      await expect(
        apiErrorRecoveryService.createSnapshot('operation-123', 'booking-123')
      ).rejects.toThrow('Failed to create data snapshot');
    });
  });

  describe('recoverFromPartialFailure', () => {
    const mockFailures: PartialUpdateFailure[] = [
      {
        operation: 'booking',
        field: 'title',
        error: 'Validation failed',
        recoveryAttempted: false,
      },
      {
        operation: 'swap',
        field: 'paymentTypes',
        error: 'Invalid payment types',
        recoveryAttempted: false,
      },
    ];

    it('should handle retry recovery strategy', async () => {
      const strategy: RecoveryStrategy = {
        type: 'retry',
        maxRetries: 2,
        retryDelay: 100,
      };

      const result = await apiErrorRecoveryService.recoverFromPartialFailure(
        'operation-123',
        mockFailures,
        strategy
      );

      expect(result.success).toBe(true);
      expect(result.recoveredOperations).toHaveLength(2);
      expect(result.remainingFailures).toHaveLength(0);
    });

    it('should handle partial_accept recovery strategy', async () => {
      const strategy: RecoveryStrategy = {
        type: 'partial_accept',
      };

      const result = await apiErrorRecoveryService.recoverFromPartialFailure(
        'operation-123',
        mockFailures,
        strategy
      );

      expect(result.success).toBe(true);
      expect(result.recoveredOperations).toHaveLength(2);
      expect(result.remainingFailures).toHaveLength(0);
    });

    it('should handle user_intervention recovery strategy', async () => {
      const strategy: RecoveryStrategy = {
        type: 'user_intervention',
      };

      const result = await apiErrorRecoveryService.recoverFromPartialFailure(
        'operation-123',
        mockFailures,
        strategy
      );

      expect(result.success).toBe(false);
      expect(result.remainingFailures).toEqual(mockFailures);
      expect(result.newErrors).toContain('User intervention required for recovery');
    });

    it('should handle invalid recovery strategy', async () => {
      const strategy: RecoveryStrategy = {
        type: 'invalid' as any,
      };

      const result = await apiErrorRecoveryService.recoverFromPartialFailure(
        'operation-123',
        mockFailures,
        strategy
      );

      expect(result.success).toBe(false);
      expect(result.newErrors).toContain('Invalid recovery strategy');
    });
  });

  describe('validateDataConsistency', () => {
    it('should validate consistent data', async () => {
      const mockBookingData = {
        id: 'booking-123',
        title: 'Test Booking',
        type: 'hotel',
      };

      const mockSwapData = {
        id: 'swap-123',
        bookingId: 'booking-123',
        paymentTypes: ['booking'],
      };

      vi.mocked(bookingEditService.getBooking).mockResolvedValue(mockBookingData as any);
      vi.mocked(swapSpecificationService.getSwapSpecificationByBooking).mockResolvedValue(mockSwapData as any);

      const result = await apiErrorRecoveryService.validateDataConsistency(
        'booking-123',
        mockBookingData,
        mockSwapData
      );

      expect(result.consistent).toBe(true);
      expect(result.inconsistencies).toHaveLength(0);
    });

    it('should detect booking data inconsistencies', async () => {
      const expectedBookingData = {
        id: 'booking-123',
        title: 'Expected Title',
        type: 'hotel',
      };

      const actualBookingData = {
        id: 'booking-123',
        title: 'Actual Title',
        type: 'hotel',
      };

      vi.mocked(bookingEditService.getBooking).mockResolvedValue(actualBookingData as any);
      vi.mocked(swapSpecificationService.getSwapSpecificationByBooking).mockResolvedValue(null);

      const result = await apiErrorRecoveryService.validateDataConsistency(
        'booking-123',
        expectedBookingData
      );

      expect(result.consistent).toBe(false);
      expect(result.inconsistencies).toHaveLength(1);
      expect(result.inconsistencies[0]).toEqual({
        type: 'booking',
        field: 'title',
        expected: 'Expected Title',
        actual: 'Actual Title',
      });
    });

    it('should detect relationship inconsistencies', async () => {
      const mockBookingData = { id: 'booking-123', title: 'Test' };
      const mockSwapData = {
        id: 'swap-123',
        bookingId: 'different-booking-id', // Inconsistent relationship
        paymentTypes: ['booking'],
      };

      vi.mocked(bookingEditService.getBooking).mockResolvedValue(mockBookingData as any);
      vi.mocked(swapSpecificationService.getSwapSpecificationByBooking).mockResolvedValue(mockSwapData as any);

      const result = await apiErrorRecoveryService.validateDataConsistency('booking-123');

      expect(result.consistent).toBe(false);
      expect(result.inconsistencies).toHaveLength(1);
      expect(result.inconsistencies[0]).toEqual({
        type: 'relationship',
        field: 'bookingId',
        expected: 'booking-123',
        actual: 'different-booking-id',
      });
    });
  });

  describe('repairDataInconsistencies', () => {
    it('should repair booking field inconsistencies', async () => {
      const inconsistencies = [
        {
          type: 'booking' as const,
          field: 'title',
          expected: 'Correct Title',
          actual: 'Wrong Title',
        },
      ];

      vi.mocked(bookingEditService.updateBooking).mockResolvedValue({} as any);

      const result = await apiErrorRecoveryService.repairDataInconsistencies(
        'booking-123',
        inconsistencies
      );

      expect(result.success).toBe(true);
      expect(result.repairedFields).toContain('booking.title');
      expect(result.unrepairedFields).toHaveLength(0);
      expect(bookingEditService.updateBooking).toHaveBeenCalledWith(
        'booking-123',
        { title: 'Correct Title' }
      );
    });

    it('should repair swap field inconsistencies', async () => {
      const inconsistencies = [
        {
          type: 'swap' as const,
          field: 'paymentTypes',
          expected: ['booking', 'cash'],
          actual: ['booking'],
        },
      ];

      const mockSwapData = { id: 'swap-123', bookingId: 'booking-123' };
      vi.mocked(swapSpecificationService.getSwapSpecificationByBooking).mockResolvedValue(mockSwapData as any);
      vi.mocked(swapSpecificationService.updateSwapSpecification).mockResolvedValue({} as any);

      const result = await apiErrorRecoveryService.repairDataInconsistencies(
        'booking-123',
        inconsistencies
      );

      expect(result.success).toBe(true);
      expect(result.repairedFields).toContain('swap.paymentTypes');
      expect(swapSpecificationService.updateSwapSpecification).toHaveBeenCalledWith(
        'swap-123',
        { paymentTypes: ['booking', 'cash'] }
      );
    });

    it('should handle relationship inconsistencies as unrepaired', async () => {
      const inconsistencies = [
        {
          type: 'relationship' as const,
          field: 'bookingId',
          expected: 'booking-123',
          actual: 'wrong-booking-id',
        },
      ];

      const result = await apiErrorRecoveryService.repairDataInconsistencies(
        'booking-123',
        inconsistencies
      );

      expect(result.success).toBe(false);
      expect(result.repairedFields).toHaveLength(0);
      expect(result.unrepairedFields).toHaveLength(1);
      expect(result.unrepairedFields[0].reason).toContain('manual intervention');
    });

    it('should handle repair errors', async () => {
      const inconsistencies = [
        {
          type: 'booking' as const,
          field: 'title',
          expected: 'Correct Title',
          actual: 'Wrong Title',
        },
      ];

      vi.mocked(bookingEditService.updateBooking).mockRejectedValue(new Error('Update failed'));

      const result = await apiErrorRecoveryService.repairDataInconsistencies(
        'booking-123',
        inconsistencies
      );

      expect(result.success).toBe(false);
      expect(result.repairedFields).toHaveLength(0);
      expect(result.unrepairedFields).toHaveLength(1);
      expect(result.unrepairedFields[0].reason).toBe('Update failed');
    });
  });

  describe('getRecoveryRecommendations', () => {
    it('should recommend retry for network errors', () => {
      const failures: PartialUpdateFailure[] = [
        {
          operation: 'booking',
          error: 'Network timeout occurred',
          recoveryAttempted: false,
        },
      ];

      const recommendations = apiErrorRecoveryService.getRecoveryRecommendations(failures);

      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].type).toBe('retry');
      expect(recommendations[0].maxRetries).toBe(3);
      expect(recommendations[0].retryDelay).toBe(2000);
    });

    it('should recommend user intervention for validation errors', () => {
      const failures: PartialUpdateFailure[] = [
        {
          operation: 'booking',
          error: 'Validation failed for field',
          recoveryAttempted: false,
        },
      ];

      const recommendations = apiErrorRecoveryService.getRecoveryRecommendations(failures);

      expect(recommendations).toContainEqual({
        type: 'user_intervention',
      });
    });

    it('should recommend rollback for permission errors', () => {
      const failures: PartialUpdateFailure[] = [
        {
          operation: 'swap',
          error: 'Access denied - insufficient permissions',
          recoveryAttempted: false,
        },
      ];

      const recommendations = apiErrorRecoveryService.getRecoveryRecommendations(failures);

      expect(recommendations).toContainEqual({
        type: 'rollback',
        rollbackToSnapshot: true,
      });
    });

    it('should provide default recommendation for unknown errors', () => {
      const failures: PartialUpdateFailure[] = [
        {
          operation: 'booking',
          error: 'Unknown error occurred',
          recoveryAttempted: false,
        },
      ];

      const recommendations = apiErrorRecoveryService.getRecoveryRecommendations(failures);

      expect(recommendations).toContainEqual({
        type: 'partial_accept',
      });
    });

    it('should handle multiple error types', () => {
      const failures: PartialUpdateFailure[] = [
        {
          operation: 'booking',
          error: 'Network timeout',
          recoveryAttempted: false,
        },
        {
          operation: 'swap',
          error: 'Validation failed',
          recoveryAttempted: false,
        },
      ];

      const recommendations = apiErrorRecoveryService.getRecoveryRecommendations(failures);

      expect(recommendations.length).toBeGreaterThan(1);
      expect(recommendations.some(r => r.type === 'retry')).toBe(true);
      expect(recommendations.some(r => r.type === 'user_intervention')).toBe(true);
    });
  });

  describe('snapshot management', () => {
    it('should cleanup old snapshots when limit exceeded', async () => {
      // Create more snapshots than the limit
      for (let i = 0; i < 15; i++) {
        await apiErrorRecoveryService.createSnapshot(`operation-${i}`);
      }

      const snapshotInfo = apiErrorRecoveryService.getSnapshotInfo();
      expect(snapshotInfo.length).toBeLessThanOrEqual(10); // MAX_SNAPSHOTS
    });

    it('should provide snapshot information', async () => {
      await apiErrorRecoveryService.createSnapshot('operation-123', 'booking-123');

      const snapshotInfo = apiErrorRecoveryService.getSnapshotInfo();

      expect(snapshotInfo).toHaveLength(1);
      expect(snapshotInfo[0].operationId).toBe('operation-123');
      expect(snapshotInfo[0].timestamp).toBeInstanceOf(Date);
      expect(snapshotInfo[0].hasBookingData).toBe(true);
      expect(snapshotInfo[0].hasSwapData).toBe(false);
    });

    it('should clear all snapshots', async () => {
      await apiErrorRecoveryService.createSnapshot('operation-1');
      await apiErrorRecoveryService.createSnapshot('operation-2');

      expect(apiErrorRecoveryService.getSnapshotInfo()).toHaveLength(2);

      apiErrorRecoveryService.clearSnapshots();

      expect(apiErrorRecoveryService.getSnapshotInfo()).toHaveLength(0);
    });
  });
});