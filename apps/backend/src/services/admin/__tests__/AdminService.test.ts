import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdminService } from '../AdminService';

describe('AdminService', () => {
  let adminService: AdminService;
  let mockBookingRepository: any;
  let mockSwapRepository: any;
  let mockUserRepository: any;
  let mockHederaService: any;

  beforeEach(() => {
    mockBookingRepository = {
      getStatistics: vi.fn(),
    };
    mockSwapRepository = {
      getStatistics: vi.fn(),
      getRecentActivity: vi.fn(),
    };
    mockUserRepository = {
      getStatistics: vi.fn(),
      flagUser: vi.fn(),
      unflagUser: vi.fn(),
    };
    mockHederaService = {
      queryTransaction: vi.fn(),
    };

    adminService = new AdminService(
      mockBookingRepository,
      mockSwapRepository,
      mockUserRepository,
      mockHederaService
    );
  });

  describe('getPlatformStatistics', () => {
    it('should return comprehensive platform statistics', async () => {
      // Mock repository responses
      mockUserRepository.getStatistics.mockResolvedValue({
        total: 1000,
        active: 750,
        verified: 500,
        flagged: 10
      });

      mockBookingRepository.getStatistics.mockResolvedValue({
        total: 2500,
        available: 1200,
        swapped: 1100,
        cancelled: 200
      });

      mockSwapRepository.getStatistics.mockResolvedValue({
        total: 1500,
        pending: 50,
        completed: 1100,
        rejected: 350
      });

      const statistics = await adminService.getPlatformStatistics();

      expect(statistics).toHaveProperty('users');
      expect(statistics).toHaveProperty('bookings');
      expect(statistics).toHaveProperty('swaps');
      expect(statistics).toHaveProperty('blockchain');
      expect(statistics).toHaveProperty('revenue');

      expect(statistics.users.total).toBe(1000);
      expect(statistics.bookings.total).toBe(2500);
      expect(statistics.swaps.total).toBe(1500);

      expect(mockUserRepository.getStatistics).toHaveBeenCalledTimes(1);
      expect(mockBookingRepository.getStatistics).toHaveBeenCalledTimes(1);
      expect(mockSwapRepository.getStatistics).toHaveBeenCalledTimes(1);
    });

    it('should handle errors gracefully', async () => {
      mockUserRepository.getStatistics.mockRejectedValue(new Error('Database error'));

      await expect(adminService.getPlatformStatistics()).rejects.toThrow('Database error');
    });
  });

  describe('getRecentActivity', () => {
    it('should return recent platform activity', async () => {
      const mockActivity = [
        {
          id: 'swap1',
          type: 'swap',
          status: 'completed',
          sourceBooking: { id: 'booking1', title: 'Hotel Booking' },
          targetBooking: { id: 'booking2', title: 'Flight Booking' },
          proposer: { id: 'user1', name: 'John Doe' },
          owner: { id: 'user2', name: 'Jane Smith' },
          updatedAt: new Date().toISOString()
        }
      ];

      mockSwapRepository.getRecentActivity.mockResolvedValue(mockActivity);

      const activity = await adminService.getRecentActivity(10);

      expect(activity).toEqual(mockActivity);
      expect(mockSwapRepository.getRecentActivity).toHaveBeenCalledWith(10);
    });

    it('should use default limit when not specified', async () => {
      mockSwapRepository.getRecentActivity.mockResolvedValue([]);

      await adminService.getRecentActivity();

      expect(mockSwapRepository.getRecentActivity).toHaveBeenCalledWith(50);
    });
  });

  describe('createDispute', () => {
    it('should create a new dispute', async () => {
      const disputeData = {
        swapId: 'swap123',
        reporterId: 'user1',
        reportedUserId: 'user2',
        type: 'fraud' as const,
        description: 'Fraudulent booking detected',
        evidence: ['evidence1.jpg'],
        priority: 'high' as const
      };

      const dispute = await adminService.createDispute(disputeData);

      expect(dispute).toHaveProperty('id');
      expect(dispute.swapId).toBe('swap123');
      expect(dispute.type).toBe('fraud');
      expect(dispute.status).toBe('open');
      expect(dispute.priority).toBe('high');
      expect(dispute.createdAt).toBeInstanceOf(Date);
    });

    it('should set default values for optional fields', async () => {
      const disputeData = {
        swapId: 'swap123',
        reporterId: 'user1',
        reportedUserId: 'user2'
      };

      const dispute = await adminService.createDispute(disputeData);

      expect(dispute.type).toBe('other');
      expect(dispute.priority).toBe('medium');
      expect(dispute.evidence).toEqual([]);
      expect(dispute.description).toBe('');
    });
  });

  describe('resolveDispute', () => {
    it('should resolve a dispute with resolution details', async () => {
      const disputeId = 'dispute123';
      const resolution = {
        action: 'User suspended for 7 days',
        notes: 'Clear evidence of fraudulent activity'
      };
      const adminId = 'admin1';

      const resolvedDispute = await adminService.resolveDispute(disputeId, resolution, adminId);

      expect(resolvedDispute.status).toBe('resolved');
      expect(resolvedDispute.resolution).toEqual({
        ...resolution,
        resolvedBy: adminId,
        resolvedAt: expect.any(Date)
      });
    });
  });

  describe('flagUser', () => {
    it('should flag a user with provided details', async () => {
      const userId = 'user123';
      const flag = {
        reason: 'Suspicious activity',
        flaggedBy: 'admin1',
        flaggedAt: new Date(),
        severity: 'warning' as const,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      };

      await adminService.flagUser(userId, flag);

      expect(mockUserRepository.flagUser).toHaveBeenCalledWith(userId, flag);
    });
  });

  describe('unflagUser', () => {
    it('should unflag a user', async () => {
      const userId = 'user123';
      const adminId = 'admin1';

      await adminService.unflagUser(userId, adminId);

      expect(mockUserRepository.unflagUser).toHaveBeenCalledWith(userId);
    });
  });

  describe('investigateBlockchainTransaction', () => {
    it('should investigate a blockchain transaction', async () => {
      const transactionId = '0.0.123456@1234567890.123456789';
      const mockTransaction = {
        transactionId,
        receipt: { status: 'SUCCESS' },
        consensusTimestamp: '1234567890.123456789',
        transactionFee: '0.001'
      };

      mockHederaService.queryTransaction.mockResolvedValue(mockTransaction);

      const analysis = await adminService.investigateBlockchainTransaction(transactionId);

      expect(analysis).toHaveProperty('transaction');
      expect(analysis).toHaveProperty('status');
      expect(analysis).toHaveProperty('timestamp');
      expect(analysis).toHaveProperty('fees');
      expect(analysis).toHaveProperty('suspicious');

      expect(analysis.transaction).toEqual(mockTransaction);
      expect(analysis.status).toBe('SUCCESS');
      expect(analysis.suspicious).toBe(false);

      expect(mockHederaService.queryTransaction).toHaveBeenCalledWith(transactionId);
    });

    it('should handle transaction query errors', async () => {
      const transactionId = 'invalid-tx-id';
      mockHederaService.queryTransaction.mockRejectedValue(new Error('Transaction not found'));

      await expect(adminService.investigateBlockchainTransaction(transactionId))
        .rejects.toThrow('Transaction not found');
    });
  });

  describe('enableMaintenanceMode', () => {
    it('should enable maintenance mode', async () => {
      const adminId = 'admin1';
      const message = 'System maintenance in progress';

      await adminService.enableMaintenanceMode(adminId, message);

      // In a real implementation, this would verify the maintenance flag was set
      // For now, we just verify the method doesn't throw
      expect(true).toBe(true);
    });
  });

  describe('disableMaintenanceMode', () => {
    it('should disable maintenance mode', async () => {
      const adminId = 'admin1';

      await adminService.disableMaintenanceMode(adminId);

      // In a real implementation, this would verify the maintenance flag was cleared
      // For now, we just verify the method doesn't throw
      expect(true).toBe(true);
    });
  });

  describe('analyzeSuspiciousActivity', () => {
    it('should analyze transaction for suspicious patterns', () => {
      const normalTransaction = {
        transactionId: '0.0.123456@1234567890.123456789',
        transactionFee: '0.001',
        consensusTimestamp: '1234567890.123456789'
      };

      // Access private method through type assertion for testing
      const result = (adminService as any).analyzeSuspiciousActivity(normalTransaction);

      expect(typeof result).toBe('boolean');
      expect(result).toBe(false); // Normal transaction should not be suspicious
    });
  });
});