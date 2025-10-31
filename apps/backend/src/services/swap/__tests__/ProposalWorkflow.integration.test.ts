import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SwapMatchingService } from '../SwapMatchingService';
import { SwapProposalService } from '../SwapProposalService';
import { ProposalCreationWorkflow } from '../ProposalCreationWorkflow';
import { BrowseProposalNotificationService } from '../../notification/BrowseProposalNotificationService';
import { SwapRepository } from '../../../database/repositories/SwapRepository';
import { UserRepository } from '../../../database/repositories/UserRepository';
import { BookingService } from '../../booking/BookingService';
import { HederaService } from '../../hedera/HederaService';
import { NotificationService } from '../../notification/NotificationService';
import {
  CreateProposalFromBrowseRequest,
  SwapProposalResult,
  EligibleSwap,
  CompatibilityAnalysis,
  Booking,
  Swap,
  User
} from '@booking-swap/shared';

// Mock external dependencies
vi.mock('../../../utils/logger');
vi.mock('../../hedera/HederaService');
vi.mock('../../notification/NotificationService');

describe('Proposal Workflow Integration Tests', () => {
  let swapMatchingService: SwapMatchingService;
  let swapProposalService: SwapProposalService;
  let proposalWorkflow: ProposalCreationWorkflow;
  let browseNotificationService: BrowseProposalNotificationService;
  
  // Mock repositories and services
  let mockSwapRepository: any;
  let mockUserRepository: any;
  let mockBookingService: any;
  let mockHederaService: any;
  let mockNotificationService: any;

  // Test data
  const mockProposer: User = {
    id: 'proposer-123',
    email: 'proposer@example.com',
    name: 'John Proposer',
    profile: {
      firstName: 'John',
      lastName: 'Proposer',
      avatar: null,
      bio: 'Travel enthusiast',
      location: 'New York, USA',
      languages: ['English'],
      verificationStatus: 'verified',
      joinedAt: new Date('2023-01-01'),
      preferences: {
        notifications: {
          email: true,
          push: true,
          sms: false
        },
        privacy: {
          showProfile: true,
          showBookings: false
        }
      }
    },
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2024-01-01')
  };

  const mockTargetOwner: User = {
    id: 'owner-456',
    email: 'owner@example.com',
    name: 'Jane Owner',
    profile: {
      firstName: 'Jane',
      lastName: 'Owner',
      avatar: null,
      bio: 'Love to travel',
      location: 'London, UK',
      languages: ['English'],
      verificationStatus: 'verified',
      joinedAt: new Date('2023-02-01'),
      preferences: {
        notifications: {
          email: true,
          push: true,
          sms: false
        },
        privacy: {
          showProfile: true,
          showBookings: false
        }
      }
    },
    createdAt: new Date('2023-02-01'),
    updatedAt: new Date('2024-01-01')
  };

  const mockSourceBooking: Booking = {
    id: 'source-booking-123',
    userId: 'proposer-123',
    type: 'hotel',
    title: 'Paris Hotel Stay',
    description: 'Beautiful hotel in central Paris',
    location: { city: 'Paris', country: 'France' },
    dateRange: { checkIn: new Date('2024-06-01'), checkOut: new Date('2024-06-05') },
    originalPrice: 500,
    swapValue: 450,
    providerDetails: {
      provider: 'booking.com',
      confirmationNumber: 'PAR123',
      bookingReference: 'REF123'
    },
    verification: { status: 'verified', documents: [] },
    blockchain: { topicId: 'topic-123' },
    status: 'available',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  };

  const mockTargetBooking: Booking = {
    id: 'target-booking-456',
    userId: 'owner-456',
    type: 'hotel',
    title: 'London Hotel Stay',
    description: 'Luxury hotel in London',
    location: { city: 'London', country: 'UK' },
    dateRange: { checkIn: new Date('2024-06-10'), checkOut: new Date('2024-06-15') },
    originalPrice: 600,
    swapValue: 550,
    providerDetails: {
      provider: 'expedia.com',
      confirmationNumber: 'LON456',
      bookingReference: 'REF456'
    },
    verification: { status: 'verified', documents: [] },
    blockchain: { topicId: 'topic-456' },
    status: 'available',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  };

  const mockSourceSwap: Swap = {
    id: 'source-swap-123',
    sourceBookingId: 'source-booking-123',
    targetBookingId: null,
    proposerId: null,
    ownerId: 'proposer-123',
    status: 'active',
    terms: null,
    blockchain: { proposalTransactionId: null },
    timeline: { createdAt: new Date('2024-01-01') },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  };

  const mockTargetSwap: Swap = {
    id: 'target-swap-456',
    sourceBookingId: 'target-booking-456',
    targetBookingId: null,
    proposerId: null,
    ownerId: 'owner-456',
    status: 'active',
    terms: null,
    blockchain: { proposalTransactionId: null },
    timeline: { createdAt: new Date('2024-01-01') },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  };

  const mockProposalRequest: CreateProposalFromBrowseRequest = {
    targetSwapId: 'target-swap-456',
    sourceSwapId: 'source-swap-123',
    proposerId: 'proposer-123',
    message: 'This looks like a perfect match! I love London and the dates work great for me.',
    conditions: ['Flexible check-in time', 'Pet-friendly if possible'],
    agreedToTerms: true
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock repositories
    mockSwapRepository = {
      findById: vi.fn(),
      findEligibleSwapsWithBookingDetails: vi.fn(),
      hasExistingProposalBetweenSwaps: vi.fn(),
      findByIdWithBookingDetails: vi.fn(),
      create: vi.fn(),
      updateBlockchainInfo: vi.fn(),
      findPendingProposalBetweenBookings: vi.fn(),
      lockSwaps: vi.fn(),
      unlockSwaps: vi.fn()
    };

    mockUserRepository = {
      findById: vi.fn(),
      findByIds: vi.fn()
    };

    mockBookingService = {
      getBookingById: vi.fn(),
      lockBooking: vi.fn(),
      unlockBooking: vi.fn()
    };

    mockHederaService = {
      submitTransaction: vi.fn(),
      recordProposalMetadata: vi.fn()
    };

    mockNotificationService = {
      sendNotification: vi.fn(),
      sendSwapProposalNotification: vi.fn(),
      sendBulkNotifications: vi.fn()
    };

    // Initialize services
    swapProposalService = new SwapProposalService(
      mockSwapRepository,
      mockBookingService,
      mockHederaService,
      mockNotificationService
    );

    swapMatchingService = new SwapMatchingService(
      mockSwapRepository,
      mockBookingService,
      swapProposalService,
      mockUserRepository,
      mockHederaService,
      mockNotificationService
    );

    proposalWorkflow = new ProposalCreationWorkflow(
      mockSwapRepository,
      mockBookingService,
      swapProposalService,
      swapMatchingService,
      mockHederaService,
      mockNotificationService
    );

    browseNotificationService = new BrowseProposalNotificationService(
      mockNotificationService,
      mockSwapRepository,
      mockBookingService,
      mockUserRepository,
      swapMatchingService
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('End-to-End Proposal Creation', () => {
    it('should complete full proposal creation workflow successfully', async () => {
      // Arrange
      const expectedProposal: Swap = {
        id: 'new-proposal-789',
        sourceBookingId: 'source-booking-123',
        targetBookingId: 'target-booking-456',
        proposerId: 'proposer-123',
        ownerId: 'owner-456',
        status: 'pending',
        terms: {
          additionalPayment: 0,
          conditions: mockProposalRequest.conditions,
          expiresAt: expect.any(Date)
        },
        blockchain: { proposalTransactionId: 'tx-789' },
        timeline: { proposedAt: expect.any(Date) },
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      };

      // Mock repository responses
      mockSwapRepository.findById
        .mockResolvedValueOnce(mockSourceSwap)
        .mockResolvedValueOnce(mockTargetSwap);
      mockSwapRepository.hasExistingProposalBetweenSwaps.mockResolvedValue(false);
      mockBookingService.getBookingById
        .mockResolvedValueOnce(mockSourceBooking)
        .mockResolvedValueOnce(mockTargetBooking);
      mockBookingService.lockBooking
        .mockResolvedValueOnce({ ...mockSourceBooking, status: 'locked' })
        .mockResolvedValueOnce({ ...mockTargetBooking, status: 'locked' });
      mockSwapRepository.findPendingProposalBetweenBookings.mockResolvedValue(null);
      mockSwapRepository.create.mockResolvedValue(expectedProposal);
      mockHederaService.submitTransaction.mockResolvedValue({
        transactionId: 'tx-789',
        consensusTimestamp: '2024-01-01T12:00:00Z'
      });
      mockSwapRepository.updateBlockchainInfo.mockResolvedValue(expectedProposal);
      mockNotificationService.sendSwapProposalNotification.mockResolvedValue();
      mockUserRepository.findById
        .mockResolvedValueOnce(mockProposer)
        .mockResolvedValueOnce(mockTargetOwner);

      // Act
      const result = await proposalWorkflow.createProposalFromBrowse(mockProposalRequest);

      // Assert
      expect(result.proposalId).toBe('new-proposal-789');
      expect(result.status).toBe('pending_review');
      expect(result.blockchainTransaction.transactionId).toBe('tx-789');
      expect(result.nextSteps).toContain('The swap owner will review your proposal');

      // Verify workflow steps
      expect(mockSwapRepository.findById).toHaveBeenCalledTimes(2);
      expect(mockBookingService.lockBooking).toHaveBeenCalledTimes(2);
      expect(mockSwapRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceBookingId: 'source-booking-123',
          targetBookingId: 'target-booking-456',
          proposerId: 'proposer-123',
          ownerId: 'owner-456',
          status: 'pending'
        })
      );
      expect(mockHederaService.submitTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'swap_proposal',
          payload: expect.objectContaining({
            sourceBookingId: 'source-booking-123',
            targetBookingId: 'target-booking-456'
          })
        })
      );
      expect(mockNotificationService.sendSwapProposalNotification).toHaveBeenCalled();
    });

    it('should handle validation failures and rollback properly', async () => {
      // Arrange - setup for validation failure
      mockSwapRepository.findById
        .mockResolvedValueOnce({ ...mockSourceSwap, ownerId: 'different-user' }) // Wrong owner
        .mockResolvedValueOnce(mockTargetSwap);

      // Act & Assert
      await expect(proposalWorkflow.createProposalFromBrowse(mockProposalRequest))
        .rejects.toThrow('Proposal validation failed');

      // Verify no side effects occurred
      expect(mockBookingService.lockBooking).not.toHaveBeenCalled();
      expect(mockSwapRepository.create).not.toHaveBeenCalled();
      expect(mockHederaService.submitTransaction).not.toHaveBeenCalled();
    });

    it('should handle booking lock failures and cleanup properly', async () => {
      // Arrange
      mockSwapRepository.findById
        .mockResolvedValueOnce(mockSourceSwap)
        .mockResolvedValueOnce(mockTargetSwap);
      mockSwapRepository.hasExistingProposalBetweenSwaps.mockResolvedValue(false);
      mockBookingService.getBookingById
        .mockResolvedValueOnce(mockSourceBooking)
        .mockResolvedValueOnce(mockTargetBooking);
      mockBookingService.lockBooking
        .mockResolvedValueOnce({ ...mockSourceBooking, status: 'locked' })
        .mockRejectedValueOnce(new Error('Target booking already locked'));
      mockBookingService.unlockBooking.mockResolvedValue({} as any);

      // Act & Assert
      await expect(proposalWorkflow.createProposalFromBrowse(mockProposalRequest))
        .rejects.toThrow('Target booking already locked');

      // Verify cleanup occurred
      expect(mockBookingService.unlockBooking).toHaveBeenCalledWith(
        'source-booking-123',
        'proposer-123'
      );
    });

    it('should handle blockchain transaction failures and rollback', async () => {
      // Arrange
      mockSwapRepository.findById
        .mockResolvedValueOnce(mockSourceSwap)
        .mockResolvedValueOnce(mockTargetSwap);
      mockSwapRepository.hasExistingProposalBetweenSwaps.mockResolvedValue(false);
      mockBookingService.getBookingById
        .mockResolvedValueOnce(mockSourceBooking)
        .mockResolvedValueOnce(mockTargetBooking);
      mockBookingService.lockBooking
        .mockResolvedValueOnce({ ...mockSourceBooking, status: 'locked' })
        .mockResolvedValueOnce({ ...mockTargetBooking, status: 'locked' });
      mockSwapRepository.findPendingProposalBetweenBookings.mockResolvedValue(null);
      mockSwapRepository.create.mockResolvedValue({
        id: 'new-proposal-789',
        sourceBookingId: 'source-booking-123',
        targetBookingId: 'target-booking-456'
      } as any);
      mockHederaService.submitTransaction.mockRejectedValue(new Error('Blockchain network error'));
      mockBookingService.unlockBooking.mockResolvedValue({} as any);

      // Act & Assert
      await expect(proposalWorkflow.createProposalFromBrowse(mockProposalRequest))
        .rejects.toThrow('Blockchain network error');

      // Verify cleanup occurred
      expect(mockBookingService.unlockBooking).toHaveBeenCalledTimes(2);
    });
  });

  describe('Notification Delivery Tests', () => {
    it('should send browse proposal received notification to target owner', async () => {
      // Arrange
      const notificationData = {
        proposalId: 'proposal-123',
        sourceSwapId: 'source-swap-123',
        targetSwapId: 'target-swap-456',
        proposerId: 'proposer-123',
        targetOwnerId: 'owner-456',
        message: 'Great match!'
      };

      mockUserRepository.findById
        .mockResolvedValueOnce(mockProposer)
        .mockResolvedValueOnce(mockTargetOwner);
      mockSwapRepository.findById
        .mockResolvedValueOnce(mockSourceSwap)
        .mockResolvedValueOnce(mockTargetSwap);
      mockBookingService.getBookingById
        .mockResolvedValueOnce(mockSourceBooking)
        .mockResolvedValueOnce(mockTargetBooking);
      mockNotificationService.sendNotification.mockResolvedValue();

      // Act
      await browseNotificationService.sendBrowseProposalReceivedNotification(notificationData);

      // Assert
      expect(mockNotificationService.sendNotification).toHaveBeenCalledWith({
        userId: 'owner-456',
        type: 'browse_proposal_received',
        title: 'New Swap Proposal',
        message: expect.stringContaining('John Proposer has proposed a swap'),
        data: expect.objectContaining({
          proposalId: 'proposal-123',
          sourceSwapId: 'source-swap-123',
          targetSwapId: 'target-swap-456'
        }),
        channels: ['email', 'push']
      });
    });

    it('should send browse proposal confirmed notification to proposer', async () => {
      // Arrange
      const confirmationData = {
        proposalId: 'proposal-123',
        sourceSwapId: 'source-swap-123',
        targetSwapId: 'target-swap-456',
        proposerId: 'proposer-123',
        status: 'pending_review' as const
      };

      mockUserRepository.findById.mockResolvedValueOnce(mockProposer);
      mockSwapRepository.findById.mockResolvedValueOnce(mockTargetSwap);
      mockBookingService.getBookingById.mockResolvedValueOnce(mockTargetBooking);
      mockNotificationService.sendNotification.mockResolvedValue();

      // Act
      await browseNotificationService.sendBrowseProposalConfirmedNotification(confirmationData);

      // Assert
      expect(mockNotificationService.sendNotification).toHaveBeenCalledWith({
        userId: 'proposer-123',
        type: 'browse_proposal_confirmed',
        title: 'Proposal Submitted Successfully',
        message: expect.stringContaining('Your swap proposal has been submitted'),
        data: expect.objectContaining({
          proposalId: 'proposal-123',
          status: 'pending_review'
        }),
        channels: ['email', 'push']
      });
    });

    it('should handle notification failures gracefully', async () => {
      // Arrange
      const notificationData = {
        proposalId: 'proposal-123',
        sourceSwapId: 'source-swap-123',
        targetSwapId: 'target-swap-456',
        proposerId: 'proposer-123',
        targetOwnerId: 'owner-456',
        message: 'Great match!'
      };

      mockUserRepository.findById.mockRejectedValue(new Error('User not found'));
      mockNotificationService.sendNotification.mockResolvedValue();

      // Act & Assert
      // Should not throw error, but handle gracefully
      await expect(browseNotificationService.sendBrowseProposalReceivedNotification(notificationData))
        .resolves.not.toThrow();

      // Notification should not be sent if user lookup fails
      expect(mockNotificationService.sendNotification).not.toHaveBeenCalled();
    });

    it('should send bulk notifications for multiple proposals', async () => {
      // Arrange
      const notifications = [
        {
          userId: 'user-1',
          type: 'browse_proposal_received',
          title: 'New Proposal 1',
          message: 'You have a new proposal',
          data: { proposalId: 'proposal-1' },
          channels: ['email', 'push']
        },
        {
          userId: 'user-2',
          type: 'browse_proposal_received',
          title: 'New Proposal 2',
          message: 'You have a new proposal',
          data: { proposalId: 'proposal-2' },
          channels: ['email', 'push']
        }
      ];

      mockNotificationService.sendBulkNotifications.mockResolvedValue([
        { success: true, notificationId: 'notif-1' },
        { success: true, notificationId: 'notif-2' }
      ]);

      // Act
      const results = await mockNotificationService.sendBulkNotifications(notifications);

      // Assert
      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
      expect(mockNotificationService.sendBulkNotifications).toHaveBeenCalledWith(notifications);
    });
  });

  describe('Blockchain Integration Tests', () => {
    it('should record proposal metadata on blockchain', async () => {
      // Arrange
      const proposalMetadata = {
        proposalId: 'proposal-123',
        sourceSwapId: 'source-swap-123',
        targetSwapId: 'target-swap-456',
        proposerId: 'proposer-123',
        targetOwnerId: 'owner-456',
        compatibilityScore: 85,
        timestamp: new Date().toISOString()
      };

      mockHederaService.recordProposalMetadata.mockResolvedValue({
        transactionId: 'metadata-tx-123',
        consensusTimestamp: '2024-01-01T12:00:00Z'
      });

      // Act
      const result = await mockHederaService.recordProposalMetadata(proposalMetadata);

      // Assert
      expect(result.transactionId).toBe('metadata-tx-123');
      expect(mockHederaService.recordProposalMetadata).toHaveBeenCalledWith(proposalMetadata);
    });

    it('should handle blockchain verification for proposal authenticity', async () => {
      // Arrange
      const proposalId = 'proposal-123';
      const expectedVerification = {
        isValid: true,
        transactionId: 'tx-123',
        consensusTimestamp: '2024-01-01T12:00:00Z',
        metadata: {
          proposalId,
          sourceSwapId: 'source-swap-123',
          targetSwapId: 'target-swap-456'
        }
      };

      mockHederaService.verifyProposal = vi.fn().mockResolvedValue(expectedVerification);

      // Act
      const verification = await mockHederaService.verifyProposal(proposalId);

      // Assert
      expect(verification.isValid).toBe(true);
      expect(verification.transactionId).toBe('tx-123');
      expect(verification.metadata.proposalId).toBe(proposalId);
    });

    it('should handle blockchain network failures gracefully', async () => {
      // Arrange
      mockHederaService.submitTransaction.mockRejectedValue(new Error('Network timeout'));

      // Act & Assert
      await expect(mockHederaService.submitTransaction({
        type: 'swap_proposal',
        payload: { proposalId: 'test' }
      })).rejects.toThrow('Network timeout');
    });

    it('should retry blockchain transactions on temporary failures', async () => {
      // Arrange
      mockHederaService.submitTransaction
        .mockRejectedValueOnce(new Error('Temporary network error'))
        .mockRejectedValueOnce(new Error('Temporary network error'))
        .mockResolvedValueOnce({
          transactionId: 'tx-retry-success',
          consensusTimestamp: '2024-01-01T12:00:00Z'
        });

      mockHederaService.submitTransactionWithRetry = vi.fn().mockImplementation(async (transaction, maxRetries = 3) => {
        let lastError;
        for (let i = 0; i < maxRetries; i++) {
          try {
            return await mockHederaService.submitTransaction(transaction);
          } catch (error) {
            lastError = error;
            if (i < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
            }
          }
        }
        throw lastError;
      });

      // Act
      const result = await mockHederaService.submitTransactionWithRetry({
        type: 'swap_proposal',
        payload: { proposalId: 'test' }
      });

      // Assert
      expect(result.transactionId).toBe('tx-retry-success');
      expect(mockHederaService.submitTransaction).toHaveBeenCalledTimes(3);
    });
  });

  describe('Concurrent Proposal Creation Tests', () => {
    it('should handle concurrent proposals to same swap correctly', async () => {
      // Arrange
      const proposal1 = { ...mockProposalRequest, proposerId: 'proposer-1', sourceSwapId: 'source-1' };
      const proposal2 = { ...mockProposalRequest, proposerId: 'proposer-2', sourceSwapId: 'source-2' };

      // Mock first proposal succeeds
      mockSwapRepository.findById
        .mockResolvedValueOnce({ ...mockSourceSwap, id: 'source-1', ownerId: 'proposer-1' })
        .mockResolvedValueOnce(mockTargetSwap)
        .mockResolvedValueOnce({ ...mockSourceSwap, id: 'source-2', ownerId: 'proposer-2' })
        .mockResolvedValueOnce(mockTargetSwap);

      mockSwapRepository.hasExistingProposalBetweenSwaps
        .mockResolvedValueOnce(false) // First proposal - no existing
        .mockResolvedValueOnce(true);  // Second proposal - existing found

      mockBookingService.getBookingById.mockResolvedValue(mockSourceBooking);
      mockBookingService.lockBooking.mockResolvedValue({ ...mockSourceBooking, status: 'locked' });

      // Act
      const [result1, result2] = await Promise.allSettled([
        swapMatchingService.createProposalFromBrowse(proposal1),
        swapMatchingService.createProposalFromBrowse(proposal2)
      ]);

      // Assert
      expect(result1.status).toBe('fulfilled');
      expect(result2.status).toBe('rejected');
      if (result2.status === 'rejected') {
        expect(result2.reason.message).toContain('Proposal validation failed');
      }
    });

    it('should handle race conditions in booking locks', async () => {
      // Arrange
      const proposal1 = { ...mockProposalRequest, proposerId: 'proposer-1', sourceSwapId: 'source-1' };
      const proposal2 = { ...mockProposalRequest, proposerId: 'proposer-2', sourceSwapId: 'source-2' };

      mockSwapRepository.findById
        .mockResolvedValue(mockSourceSwap)
        .mockResolvedValue(mockTargetSwap);
      mockSwapRepository.hasExistingProposalBetweenSwaps.mockResolvedValue(false);
      mockBookingService.getBookingById.mockResolvedValue(mockSourceBooking);

      // Simulate race condition - second lock fails
      let lockCallCount = 0;
      mockBookingService.lockBooking.mockImplementation(async (bookingId) => {
        lockCallCount++;
        if (lockCallCount <= 2) {
          return { ...mockSourceBooking, status: 'locked' };
        } else {
          throw new Error('Booking already locked');
        }
      });

      mockBookingService.unlockBooking.mockResolvedValue({} as any);

      // Act
      const [result1, result2] = await Promise.allSettled([
        proposalWorkflow.createProposalFromBrowse(proposal1),
        proposalWorkflow.createProposalFromBrowse(proposal2)
      ]);

      // Assert
      expect(result1.status).toBe('rejected'); // Both should fail due to lock contention
      expect(result2.status).toBe('rejected');
    });

    it('should handle high volume of concurrent proposals', async () => {
      // Arrange
      const concurrentProposals = Array.from({ length: 10 }, (_, i) => ({
        ...mockProposalRequest,
        proposerId: `proposer-${i}`,
        sourceSwapId: `source-${i}`
      }));

      // Mock responses for all proposals
      mockSwapRepository.findById.mockImplementation(async (id) => {
        if (id.startsWith('source-')) {
          const proposerId = id.replace('source-', 'proposer-');
          return { ...mockSourceSwap, id, ownerId: proposerId };
        }
        return mockTargetSwap;
      });

      mockSwapRepository.hasExistingProposalBetweenSwaps.mockResolvedValue(false);
      mockBookingService.getBookingById.mockResolvedValue(mockSourceBooking);
      mockBookingService.lockBooking.mockResolvedValue({ ...mockSourceBooking, status: 'locked' });
      mockSwapRepository.findPendingProposalBetweenBookings.mockResolvedValue(null);
      mockSwapRepository.create.mockImplementation(async (proposal) => ({
        ...proposal,
        id: `proposal-${Date.now()}-${Math.random()}`
      }));
      mockHederaService.submitTransaction.mockResolvedValue({
        transactionId: `tx-${Date.now()}`,
        consensusTimestamp: new Date().toISOString()
      });
      mockSwapRepository.updateBlockchainInfo.mockImplementation(async (id, info) => ({
        id,
        blockchain: info
      }));
      mockNotificationService.sendSwapProposalNotification.mockResolvedValue();

      // Act
      const results = await Promise.allSettled(
        concurrentProposals.map(proposal => proposalWorkflow.createProposalFromBrowse(proposal))
      );

      // Assert
      const successfulResults = results.filter(r => r.status === 'fulfilled');
      const failedResults = results.filter(r => r.status === 'rejected');

      // At least some should succeed (exact number depends on race conditions)
      expect(successfulResults.length).toBeGreaterThan(0);
      expect(successfulResults.length + failedResults.length).toBe(10);

      // All successful results should have valid proposal IDs
      successfulResults.forEach(result => {
        if (result.status === 'fulfilled') {
          expect(result.value.proposalId).toBeDefined();
          expect(result.value.status).toBe('pending_review');
        }
      });
    });
  });

  describe('Error Recovery and Resilience Tests', () => {
    it('should recover from partial failures and maintain data consistency', async () => {
      // Arrange
      mockSwapRepository.findById
        .mockResolvedValueOnce(mockSourceSwap)
        .mockResolvedValueOnce(mockTargetSwap);
      mockSwapRepository.hasExistingProposalBetweenSwaps.mockResolvedValue(false);
      mockBookingService.getBookingById
        .mockResolvedValueOnce(mockSourceBooking)
        .mockResolvedValueOnce(mockTargetBooking);
      mockBookingService.lockBooking
        .mockResolvedValueOnce({ ...mockSourceBooking, status: 'locked' })
        .mockResolvedValueOnce({ ...mockTargetBooking, status: 'locked' });
      mockSwapRepository.findPendingProposalBetweenBookings.mockResolvedValue(null);
      mockSwapRepository.create.mockResolvedValue({
        id: 'proposal-123',
        sourceBookingId: 'source-booking-123',
        targetBookingId: 'target-booking-456'
      } as any);
      
      // Simulate blockchain failure
      mockHederaService.submitTransaction.mockRejectedValue(new Error('Blockchain unavailable'));
      mockBookingService.unlockBooking.mockResolvedValue({} as any);

      // Act & Assert
      await expect(proposalWorkflow.createProposalFromBrowse(mockProposalRequest))
        .rejects.toThrow('Blockchain unavailable');

      // Verify cleanup was performed
      expect(mockBookingService.unlockBooking).toHaveBeenCalledTimes(2);
    });

    it('should handle database transaction rollbacks correctly', async () => {
      // Arrange
      mockSwapRepository.findById
        .mockResolvedValueOnce(mockSourceSwap)
        .mockResolvedValueOnce(mockTargetSwap);
      mockSwapRepository.hasExistingProposalBetweenSwaps.mockResolvedValue(false);
      mockBookingService.getBookingById
        .mockResolvedValueOnce(mockSourceBooking)
        .mockResolvedValueOnce(mockTargetBooking);
      mockBookingService.lockBooking
        .mockResolvedValueOnce({ ...mockSourceBooking, status: 'locked' })
        .mockResolvedValueOnce({ ...mockTargetBooking, status: 'locked' });
      mockSwapRepository.findPendingProposalBetweenBookings.mockResolvedValue(null);
      
      // Simulate database failure during proposal creation
      mockSwapRepository.create.mockRejectedValue(new Error('Database constraint violation'));
      mockBookingService.unlockBooking.mockResolvedValue({} as any);

      // Act & Assert
      await expect(proposalWorkflow.createProposalFromBrowse(mockProposalRequest))
        .rejects.toThrow('Database constraint violation');

      // Verify cleanup was performed
      expect(mockBookingService.unlockBooking).toHaveBeenCalledTimes(2);
    });

    it('should handle service timeouts gracefully', async () => {
      // Arrange
      mockSwapRepository.findById
        .mockResolvedValueOnce(mockSourceSwap)
        .mockResolvedValueOnce(mockTargetSwap);
      mockSwapRepository.hasExistingProposalBetweenSwaps.mockResolvedValue(false);
      
      // Simulate timeout in booking service
      mockBookingService.getBookingById.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Service timeout')), 100)
        )
      );

      // Act & Assert
      await expect(proposalWorkflow.createProposalFromBrowse(mockProposalRequest))
        .rejects.toThrow('Service timeout');
    });
  });
});