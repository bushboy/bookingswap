import { SwapMatchingHederaExtensions } from '../SwapMatchingHederaExtensions';
import { HederaService } from '../HederaService';
import { logger } from '../../../utils/logger';

// Mock the logger
jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock HederaService
const mockHederaService = {
  submitTransaction: jest.fn(),
} as unknown as HederaService;

describe('SwapMatchingHederaExtensions', () => {
  let swapMatchingExtensions: SwapMatchingHederaExtensions;

  beforeEach(() => {
    swapMatchingExtensions = new SwapMatchingHederaExtensions(mockHederaService);
    jest.clearAllMocks();
  });

  describe('recordBrowseProposalCreation', () => {
    it('should record browse proposal creation on blockchain', async () => {
      // Arrange
      const mockTransactionResult = {
        transactionId: 'tx_123',
        status: 'SUCCESS',
        consensusTimestamp: '2024-01-01T00:00:00Z',
      };

      (mockHederaService.submitTransaction as jest.Mock).mockResolvedValue(mockTransactionResult);

      const proposalData = {
        proposalId: 'proposal_123',
        sourceSwapId: 'swap_source',
        targetSwapId: 'swap_target',
        proposerId: 'user_123',
        targetOwnerId: 'user_456',
        compatibilityScore: 85,
        message: 'Great match!',
        conditions: ['condition1', 'condition2'],
        proposalSource: 'browse' as const,
        createdAt: new Date('2024-01-01T00:00:00Z'),
      };

      // Act
      const result = await swapMatchingExtensions.recordBrowseProposalCreation(proposalData);

      // Assert
      expect(result).toBe('tx_123');
      expect(mockHederaService.submitTransaction).toHaveBeenCalledWith({
        type: 'swap_proposal',
        payload: {
          proposalId: 'proposal_123',
          sourceSwapId: 'swap_source',
          targetSwapId: 'swap_target',
          proposerId: 'user_123',
          targetOwnerId: 'user_456',
          compatibilityScore: 85,
          proposalSource: 'browse',
          hasMessage: true,
          conditionsCount: 2,
          createdAt: '2024-01-01T00:00:00.000Z',
          metadata: {
            proposalType: 'browse_initiated',
            status: 'pending',
            compatibilityTier: 'excellent',
            blockchainVersion: '1.0'
          }
        },
        timestamp: expect.any(Date)
      });
      expect(logger.info).toHaveBeenCalledWith(
        'Browse proposal creation recorded on blockchain',
        expect.objectContaining({
          proposalId: 'proposal_123',
          transactionId: 'tx_123',
          compatibilityScore: 85
        })
      );
    });

    it('should handle blockchain submission errors', async () => {
      // Arrange
      const error = new Error('Blockchain submission failed');
      (mockHederaService.submitTransaction as jest.Mock).mockRejectedValue(error);

      const proposalData = {
        proposalId: 'proposal_123',
        sourceSwapId: 'swap_source',
        targetSwapId: 'swap_target',
        proposerId: 'user_123',
        targetOwnerId: 'user_456',
        compatibilityScore: 85,
        conditions: [],
        proposalSource: 'browse' as const,
        createdAt: new Date(),
      };

      // Act & Assert
      await expect(swapMatchingExtensions.recordBrowseProposalCreation(proposalData))
        .rejects.toThrow('Blockchain submission failed');
      
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to record browse proposal creation on blockchain',
        expect.objectContaining({ error, data: proposalData })
      );
    });
  });

  describe('recordCompatibilityAnalysis', () => {
    it('should record compatibility analysis on blockchain', async () => {
      // Arrange
      const mockTransactionResult = {
        transactionId: 'tx_456',
        status: 'SUCCESS',
      };

      (mockHederaService.submitTransaction as jest.Mock).mockResolvedValue(mockTransactionResult);

      const analysisData = {
        sourceSwapId: 'swap_source',
        targetSwapId: 'swap_target',
        overallScore: 75,
        factors: {
          locationCompatibility: 80,
          dateCompatibility: 70,
          valueCompatibility: 75,
          accommodationCompatibility: 85,
          guestCompatibility: 65,
        },
        analysisTimestamp: new Date('2024-01-01T00:00:00Z'),
        requestedBy: 'user_123',
      };

      // Act
      const result = await swapMatchingExtensions.recordCompatibilityAnalysis(analysisData);

      // Assert
      expect(result).toBe('tx_456');
      expect(mockHederaService.submitTransaction).toHaveBeenCalledWith({
        type: 'swap_proposal',
        payload: {
          sourceSwapId: 'swap_source',
          targetSwapId: 'swap_target',
          overallScore: 75,
          factors: analysisData.factors,
          analysisTimestamp: '2024-01-01T00:00:00.000Z',
          requestedBy: 'user_123',
          metadata: {
            analysisType: 'compatibility_analysis',
            compatibilityTier: 'good',
            factorCount: 5,
            auditTrail: true
          }
        },
        timestamp: expect.any(Date)
      });
    });
  });

  describe('recordProposalStatusChange', () => {
    it('should record proposal status change on blockchain', async () => {
      // Arrange
      const mockTransactionResult = {
        transactionId: 'tx_789',
        status: 'SUCCESS',
      };

      (mockHederaService.submitTransaction as jest.Mock).mockResolvedValue(mockTransactionResult);

      const statusChangeData = {
        proposalId: 'proposal_123',
        previousStatus: 'pending',
        newStatus: 'accepted',
        changedBy: 'user_456',
        changedAt: new Date('2024-01-01T00:00:00Z'),
        reason: 'User accepted proposal',
        metadata: {
          acceptanceType: 'manual',
        },
      };

      // Act
      const result = await swapMatchingExtensions.recordProposalStatusChange(statusChangeData);

      // Assert
      expect(result).toBe('tx_789');
      expect(mockHederaService.submitTransaction).toHaveBeenCalledWith({
        type: 'swap_proposal_accepted',
        payload: {
          proposalId: 'proposal_123',
          previousStatus: 'pending',
          newStatus: 'accepted',
          changedBy: 'user_456',
          changedAt: '2024-01-01T00:00:00.000Z',
          reason: 'User accepted proposal',
          metadata: {
            acceptanceType: 'manual',
            statusChangeType: 'proposal_lifecycle',
            auditTrail: true,
            blockchainVersion: '1.0'
          }
        },
        timestamp: expect.any(Date)
      });
    });

    it('should use correct transaction type for different status changes', async () => {
      // Arrange
      const mockTransactionResult = { transactionId: 'tx_test', status: 'SUCCESS' };
      (mockHederaService.submitTransaction as jest.Mock).mockResolvedValue(mockTransactionResult);

      const baseData = {
        proposalId: 'proposal_123',
        previousStatus: 'pending',
        changedBy: 'user_456',
        changedAt: new Date(),
      };

      // Test different status changes
      const testCases = [
        { newStatus: 'accepted', expectedType: 'swap_proposal_accepted' },
        { newStatus: 'rejected', expectedType: 'swap_proposal_rejected' },
        { newStatus: 'cancelled', expectedType: 'swap_proposal_cancelled' },
        { newStatus: 'expired', expectedType: 'swap_proposal_expired' },
        { newStatus: 'unknown', expectedType: 'swap_proposal' },
      ];

      for (const testCase of testCases) {
        // Act
        await swapMatchingExtensions.recordProposalStatusChange({
          ...baseData,
          newStatus: testCase.newStatus,
        });

        // Assert
        expect(mockHederaService.submitTransaction).toHaveBeenCalledWith(
          expect.objectContaining({
            type: testCase.expectedType,
          })
        );
      }
    });
  });

  describe('recordProposalVerification', () => {
    it('should record proposal verification on blockchain', async () => {
      // Arrange
      const mockTransactionResult = {
        transactionId: 'tx_verification',
        status: 'SUCCESS',
      };

      (mockHederaService.submitTransaction as jest.Mock).mockResolvedValue(mockTransactionResult);

      const verificationData = {
        proposalId: 'proposal_123',
        sourceSwapId: 'swap_source',
        targetSwapId: 'swap_target',
        proposerId: 'user_123',
        verificationChecks: {
          userOwnsSourceSwap: true,
          sourceSwapAvailable: true,
          targetSwapAvailable: true,
          noExistingProposal: true,
          swapsAreCompatible: true,
        },
        verificationTimestamp: new Date('2024-01-01T00:00:00Z'),
        isValid: true,
      };

      // Act
      const result = await swapMatchingExtensions.recordProposalVerification(verificationData);

      // Assert
      expect(result).toBe('tx_verification');
      expect(mockHederaService.submitTransaction).toHaveBeenCalledWith({
        type: 'swap_proposal',
        payload: {
          proposalId: 'proposal_123',
          sourceSwapId: 'swap_source',
          targetSwapId: 'swap_target',
          proposerId: 'user_123',
          verificationChecks: verificationData.verificationChecks,
          verificationTimestamp: '2024-01-01T00:00:00.000Z',
          isValid: true,
          metadata: {
            verificationType: 'proposal_verification',
            checksPerformed: 5,
            validationResult: 'valid',
            auditTrail: true
          }
        },
        timestamp: expect.any(Date)
      });
    });
  });

  describe('recordDisputeResolution', () => {
    it('should record dispute resolution on blockchain', async () => {
      // Arrange
      const mockTransactionResult = {
        transactionId: 'tx_dispute',
        status: 'SUCCESS',
      };

      (mockHederaService.submitTransaction as jest.Mock).mockResolvedValue(mockTransactionResult);

      const disputeData = {
        proposalId: 'proposal_123',
        disputeId: 'dispute_456',
        disputeType: 'authenticity' as const,
        resolution: 'proposal_valid' as const,
        resolvedBy: 'moderator_789',
        resolvedAt: new Date('2024-01-01T00:00:00Z'),
        evidence: ['evidence1', 'evidence2'],
        outcome: 'Proposal verified as authentic',
      };

      // Act
      const result = await swapMatchingExtensions.recordDisputeResolution(disputeData);

      // Assert
      expect(result).toBe('tx_dispute');
      expect(mockHederaService.submitTransaction).toHaveBeenCalledWith({
        type: 'swap_proposal',
        payload: {
          proposalId: 'proposal_123',
          disputeId: 'dispute_456',
          disputeType: 'authenticity',
          resolution: 'proposal_valid',
          resolvedBy: 'moderator_789',
          resolvedAt: '2024-01-01T00:00:00.000Z',
          evidenceCount: 2,
          outcome: 'Proposal verified as authentic',
          metadata: {
            disputeResolutionType: 'proposal_dispute',
            disputeCategory: 'authenticity',
            resolutionStatus: 'proposal_valid',
            auditTrail: true,
            blockchainVersion: '1.0'
          }
        },
        timestamp: expect.any(Date)
      });
    });
  });

  describe('compatibility tier calculation', () => {
    it('should calculate correct compatibility tiers', () => {
      // Test the private method indirectly through recordCompatibilityAnalysis
      const testCases = [
        { score: 90, expectedTier: 'excellent' },
        { score: 80, expectedTier: 'excellent' },
        { score: 70, expectedTier: 'good' },
        { score: 60, expectedTier: 'good' },
        { score: 50, expectedTier: 'fair' },
        { score: 40, expectedTier: 'fair' },
        { score: 30, expectedTier: 'poor' },
        { score: 0, expectedTier: 'poor' },
      ];

      testCases.forEach(async (testCase) => {
        const mockTransactionResult = { transactionId: 'tx_test', status: 'SUCCESS' };
        (mockHederaService.submitTransaction as jest.Mock).mockResolvedValue(mockTransactionResult);

        const analysisData = {
          sourceSwapId: 'swap_source',
          targetSwapId: 'swap_target',
          overallScore: testCase.score,
          factors: {
            locationCompatibility: testCase.score,
            dateCompatibility: testCase.score,
            valueCompatibility: testCase.score,
            accommodationCompatibility: testCase.score,
            guestCompatibility: testCase.score,
          },
          analysisTimestamp: new Date(),
          requestedBy: 'user_123',
        };

        await swapMatchingExtensions.recordCompatibilityAnalysis(analysisData);

        expect(mockHederaService.submitTransaction).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({
              metadata: expect.objectContaining({
                compatibilityTier: testCase.expectedTier,
              }),
            }),
          })
        );
      });
    });
  });
});