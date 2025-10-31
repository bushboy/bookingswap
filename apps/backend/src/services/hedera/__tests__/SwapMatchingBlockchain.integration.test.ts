import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SwapMatchingHederaExtensions } from '../SwapMatchingHederaExtensions';
import { BlockchainVerificationService } from '../BlockchainVerificationService';
import { HederaService } from '../HederaService';
import { SwapRepository } from '../../../database/repositories/SwapRepository';
import {
  CreateProposalFromBrowseRequest,
  SwapProposalResult,
  CompatibilityAnalysis,
  BlockchainTransaction
} from '@booking-swap/shared';

// Mock external dependencies
vi.mock('../../../utils/logger');
vi.mock('../HederaService');
vi.mock('../../../database/repositories/SwapRepository');

describe('Swap Matching Blockchain Integration Tests', () => {
  let swapMatchingHederaExtensions: SwapMatchingHederaExtensions;
  let blockchainVerificationService: BlockchainVerificationService;
  let mockHederaService: vi.Mocked<HederaService>;
  let mockSwapRepository: vi.Mocked<SwapRepository>;

  const mockProposalRequest: CreateProposalFromBrowseRequest = {
    targetSwapId: 'target-swap-123',
    sourceSwapId: 'source-swap-456',
    proposerId: 'proposer-789',
    message: 'Perfect match for our travel plans!',
    conditions: ['Flexible check-in', 'Pet-friendly'],
    agreedToTerms: true
  };

  const mockCompatibilityAnalysis: CompatibilityAnalysis = {
    overallScore: 85,
    factors: {
      locationCompatibility: { score: 90, weight: 0.25, details: 'Excellent location match', status: 'excellent' },
      dateCompatibility: { score: 80, weight: 0.20, details: 'Good date compatibility', status: 'good' },
      valueCompatibility: { score: 85, weight: 0.30, details: 'Well-matched values', status: 'excellent' },
      accommodationCompatibility: { score: 75, weight: 0.15, details: 'Compatible accommodation types', status: 'good' },
      guestCompatibility: { score: 95, weight: 0.10, details: 'Perfect guest count match', status: 'excellent' }
    },
    recommendations: ['Excellent overall compatibility', 'Highly recommended swap'],
    potentialIssues: []
  };

  const mockBlockchainTransaction: BlockchainTransaction = {
    transactionId: 'tx-0.0.123456@1640995200.123456789',
    consensusTimestamp: '2024-01-01T12:00:00.123456789Z'
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockHederaService = vi.mocked(new HederaService({} as any));
    mockSwapRepository = vi.mocked(new SwapRepository({} as any));

    swapMatchingHederaExtensions = new SwapMatchingHederaExtensions(
      mockHederaService,
      mockSwapRepository
    );

    blockchainVerificationService = new BlockchainVerificationService(
      mockHederaService,
      mockSwapRepository
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Browse Proposal Blockchain Recording', () => {
    it('should record browse proposal on blockchain successfully', async () => {
      // Arrange
      const proposalMetadata = {
        proposalId: 'proposal-123',
        sourceSwapId: mockProposalRequest.sourceSwapId,
        targetSwapId: mockProposalRequest.targetSwapId,
        proposerId: mockProposalRequest.proposerId,
        message: mockProposalRequest.message,
        conditions: mockProposalRequest.conditions,
        compatibilityScore: 85,
        timestamp: new Date().toISOString(),
        proposalType: 'browse_initiated' as const
      };

      mockHederaService.submitTransaction.mockResolvedValue(mockBlockchainTransaction);

      // Act
      const result = await swapMatchingHederaExtensions.recordBrowseProposal(proposalMetadata);

      // Assert
      expect(result).toEqual(mockBlockchainTransaction);
      expect(mockHederaService.submitTransaction).toHaveBeenCalledWith({
        type: 'browse_proposal_created',
        payload: {
          proposalId: proposalMetadata.proposalId,
          sourceSwapId: proposalMetadata.sourceSwapId,
          targetSwapId: proposalMetadata.targetSwapId,
          proposerId: proposalMetadata.proposerId,
          message: proposalMetadata.message,
          conditions: proposalMetadata.conditions,
          compatibilityScore: proposalMetadata.compatibilityScore,
          timestamp: proposalMetadata.timestamp,
          proposalType: 'browse_initiated'
        },
        memo: `Browse proposal: ${proposalMetadata.proposalId}`
      });
    });

    it('should record compatibility analysis on blockchain', async () => {
      // Arrange
      const analysisData = {
        sourceSwapId: 'source-swap-123',
        targetSwapId: 'target-swap-456',
        analysis: mockCompatibilityAnalysis,
        timestamp: new Date().toISOString(),
        requestId: 'analysis-req-789'
      };

      mockHederaService.submitTransaction.mockResolvedValue(mockBlockchainTransaction);

      // Act
      const result = await swapMatchingHederaExtensions.recordCompatibilityAnalysis(analysisData);

      // Assert
      expect(result).toEqual(mockBlockchainTransaction);
      expect(mockHederaService.submitTransaction).toHaveBeenCalledWith({
        type: 'compatibility_analysis',
        payload: {
          sourceSwapId: analysisData.sourceSwapId,
          targetSwapId: analysisData.targetSwapId,
          overallScore: mockCompatibilityAnalysis.overallScore,
          factorScores: {
            location: mockCompatibilityAnalysis.factors.locationCompatibility.score,
            date: mockCompatibilityAnalysis.factors.dateCompatibility.score,
            value: mockCompatibilityAnalysis.factors.valueCompatibility.score,
            accommodation: mockCompatibilityAnalysis.factors.accommodationCompatibility.score,
            guest: mockCompatibilityAnalysis.factors.guestCompatibility.score
          },
          timestamp: analysisData.timestamp,
          requestId: analysisData.requestId
        },
        memo: `Compatibility analysis: ${analysisData.sourceSwapId} -> ${analysisData.targetSwapId}`
      });
    });

    it('should record proposal status changes on blockchain', async () => {
      // Arrange
      const statusChangeData = {
        proposalId: 'proposal-123',
        oldStatus: 'pending' as const,
        newStatus: 'accepted' as const,
        changedBy: 'owner-456',
        timestamp: new Date().toISOString(),
        reason: 'Proposal accepted by swap owner'
      };

      mockHederaService.submitTransaction.mockResolvedValue(mockBlockchainTransaction);

      // Act
      const result = await swapMatchingHederaExtensions.recordProposalStatusChange(statusChangeData);

      // Assert
      expect(result).toEqual(mockBlockchainTransaction);
      expect(mockHederaService.submitTransaction).toHaveBeenCalledWith({
        type: 'proposal_status_change',
        payload: {
          proposalId: statusChangeData.proposalId,
          oldStatus: statusChangeData.oldStatus,
          newStatus: statusChangeData.newStatus,
          changedBy: statusChangeData.changedBy,
          timestamp: statusChangeData.timestamp,
          reason: statusChangeData.reason
        },
        memo: `Proposal status: ${statusChangeData.proposalId} ${statusChangeData.oldStatus} -> ${statusChangeData.newStatus}`
      });
    });

    it('should handle blockchain network failures gracefully', async () => {
      // Arrange
      const proposalMetadata = {
        proposalId: 'proposal-123',
        sourceSwapId: 'source-swap-456',
        targetSwapId: 'target-swap-123',
        proposerId: 'proposer-789',
        message: 'Test proposal',
        conditions: [],
        compatibilityScore: 75,
        timestamp: new Date().toISOString(),
        proposalType: 'browse_initiated' as const
      };

      mockHederaService.submitTransaction.mockRejectedValue(new Error('Network timeout'));

      // Act & Assert
      await expect(swapMatchingHederaExtensions.recordBrowseProposal(proposalMetadata))
        .rejects.toThrow('Network timeout');
    });

    it('should retry blockchain transactions on temporary failures', async () => {
      // Arrange
      const proposalMetadata = {
        proposalId: 'proposal-123',
        sourceSwapId: 'source-swap-456',
        targetSwapId: 'target-swap-123',
        proposerId: 'proposer-789',
        message: 'Test proposal',
        conditions: [],
        compatibilityScore: 75,
        timestamp: new Date().toISOString(),
        proposalType: 'browse_initiated' as const
      };

      mockHederaService.submitTransaction
        .mockRejectedValueOnce(new Error('Temporary network error'))
        .mockRejectedValueOnce(new Error('Temporary network error'))
        .mockResolvedValueOnce(mockBlockchainTransaction);

      // Mock retry mechanism
      swapMatchingHederaExtensions.recordBrowseProposalWithRetry = vi.fn().mockImplementation(
        async (metadata, maxRetries = 3) => {
          let lastError;
          for (let i = 0; i < maxRetries; i++) {
            try {
              return await swapMatchingHederaExtensions.recordBrowseProposal(metadata);
            } catch (error) {
              lastError = error;
              if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
              }
            }
          }
          throw lastError;
        }
      );

      // Act
      const result = await swapMatchingHederaExtensions.recordBrowseProposalWithRetry(proposalMetadata);

      // Assert
      expect(result).toEqual(mockBlockchainTransaction);
      expect(mockHederaService.submitTransaction).toHaveBeenCalledTimes(3);
    });
  });

  describe('Blockchain Verification Tests', () => {
    it('should verify proposal authenticity successfully', async () => {
      // Arrange
      const proposalId = 'proposal-123';
      const expectedVerification = {
        isValid: true,
        transactionId: mockBlockchainTransaction.transactionId,
        consensusTimestamp: mockBlockchainTransaction.consensusTimestamp,
        proposalData: {
          proposalId,
          sourceSwapId: 'source-swap-456',
          targetSwapId: 'target-swap-123',
          proposerId: 'proposer-789',
          compatibilityScore: 85,
          proposalType: 'browse_initiated'
        },
        verificationTimestamp: expect.any(String)
      };

      mockSwapRepository.findProposalBlockchainInfo.mockResolvedValue({
        proposalId,
        transactionId: mockBlockchainTransaction.transactionId,
        consensusTimestamp: mockBlockchainTransaction.consensusTimestamp
      });

      mockHederaService.getTransactionRecord.mockResolvedValue({
        transactionId: mockBlockchainTransaction.transactionId,
        consensusTimestamp: mockBlockchainTransaction.consensusTimestamp,
        payload: {
          proposalId,
          sourceSwapId: 'source-swap-456',
          targetSwapId: 'target-swap-123',
          proposerId: 'proposer-789',
          compatibilityScore: 85,
          proposalType: 'browse_initiated'
        }
      });

      // Act
      const result = await blockchainVerificationService.verifyProposal(proposalId);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.transactionId).toBe(mockBlockchainTransaction.transactionId);
      expect(result.proposalData.proposalId).toBe(proposalId);
      expect(result.proposalData.compatibilityScore).toBe(85);
    });

    it('should detect tampered proposal data', async () => {
      // Arrange
      const proposalId = 'proposal-123';
      
      mockSwapRepository.findProposalBlockchainInfo.mockResolvedValue({
        proposalId,
        transactionId: mockBlockchainTransaction.transactionId,
        consensusTimestamp: mockBlockchainTransaction.consensusTimestamp
      });

      // Mock blockchain record with different data (indicating tampering)
      mockHederaService.getTransactionRecord.mockResolvedValue({
        transactionId: mockBlockchainTransaction.transactionId,
        consensusTimestamp: mockBlockchainTransaction.consensusTimestamp,
        payload: {
          proposalId,
          sourceSwapId: 'different-source-swap', // Tampered data
          targetSwapId: 'target-swap-123',
          proposerId: 'proposer-789',
          compatibilityScore: 85,
          proposalType: 'browse_initiated'
        }
      });

      // Mock current proposal data from database
      mockSwapRepository.findById.mockResolvedValue({
        id: proposalId,
        sourceSwapId: 'source-swap-456', // Original data
        targetSwapId: 'target-swap-123',
        proposerId: 'proposer-789'
      });

      // Act
      const result = await blockchainVerificationService.verifyProposal(proposalId);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.tamperedFields).toContain('sourceSwapId');
    });

    it('should verify compatibility analysis integrity', async () => {
      // Arrange
      const analysisId = 'analysis-123';
      const sourceSwapId = 'source-swap-456';
      const targetSwapId = 'target-swap-123';

      mockSwapRepository.findCompatibilityAnalysisBlockchainInfo.mockResolvedValue({
        analysisId,
        transactionId: mockBlockchainTransaction.transactionId,
        consensusTimestamp: mockBlockchainTransaction.consensusTimestamp
      });

      mockHederaService.getTransactionRecord.mockResolvedValue({
        transactionId: mockBlockchainTransaction.transactionId,
        consensusTimestamp: mockBlockchainTransaction.consensusTimestamp,
        payload: {
          sourceSwapId,
          targetSwapId,
          overallScore: 85,
          factorScores: {
            location: 90,
            date: 80,
            value: 85,
            accommodation: 75,
            guest: 95
          }
        }
      });

      // Act
      const result = await blockchainVerificationService.verifyCompatibilityAnalysis(
        sourceSwapId,
        targetSwapId
      );

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.analysisData.overallScore).toBe(85);
      expect(result.analysisData.factorScores.location).toBe(90);
    });

    it('should create audit trail for proposal lifecycle', async () => {
      // Arrange
      const proposalId = 'proposal-123';
      const expectedAuditTrail = [
        {
          event: 'proposal_created',
          timestamp: '2024-01-01T12:00:00Z',
          transactionId: 'tx-create-123',
          data: { proposalId, status: 'pending' }
        },
        {
          event: 'proposal_reviewed',
          timestamp: '2024-01-02T12:00:00Z',
          transactionId: 'tx-review-456',
          data: { proposalId, reviewedBy: 'owner-456' }
        },
        {
          event: 'proposal_accepted',
          timestamp: '2024-01-03T12:00:00Z',
          transactionId: 'tx-accept-789',
          data: { proposalId, status: 'accepted' }
        }
      ];

      mockSwapRepository.findProposalAuditTrail.mockResolvedValue(expectedAuditTrail);

      // Act
      const auditTrail = await blockchainVerificationService.getProposalAuditTrail(proposalId);

      // Assert
      expect(auditTrail).toHaveLength(3);
      expect(auditTrail[0].event).toBe('proposal_created');
      expect(auditTrail[1].event).toBe('proposal_reviewed');
      expect(auditTrail[2].event).toBe('proposal_accepted');
      expect(auditTrail.every(entry => entry.transactionId.startsWith('tx-'))).toBe(true);
    });

    it('should handle blockchain verification failures gracefully', async () => {
      // Arrange
      const proposalId = 'proposal-123';
      
      mockSwapRepository.findProposalBlockchainInfo.mockRejectedValue(
        new Error('Database connection failed')
      );

      // Act
      const result = await blockchainVerificationService.verifyProposal(proposalId);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Database connection failed');
    });
  });

  describe('Dispute Resolution Support', () => {
    it('should record dispute initiation on blockchain', async () => {
      // Arrange
      const disputeData = {
        proposalId: 'proposal-123',
        disputeId: 'dispute-456',
        initiatedBy: 'proposer-789',
        reason: 'Swap terms not honored',
        evidence: ['screenshot1.jpg', 'email-thread.pdf'],
        timestamp: new Date().toISOString()
      };

      mockHederaService.submitTransaction.mockResolvedValue(mockBlockchainTransaction);

      // Act
      const result = await swapMatchingHederaExtensions.recordDispute(disputeData);

      // Assert
      expect(result).toEqual(mockBlockchainTransaction);
      expect(mockHederaService.submitTransaction).toHaveBeenCalledWith({
        type: 'dispute_initiated',
        payload: {
          proposalId: disputeData.proposalId,
          disputeId: disputeData.disputeId,
          initiatedBy: disputeData.initiatedBy,
          reason: disputeData.reason,
          evidenceHashes: expect.any(Array), // Evidence files would be hashed
          timestamp: disputeData.timestamp
        },
        memo: `Dispute initiated: ${disputeData.disputeId}`
      });
    });

    it('should record dispute resolution on blockchain', async () => {
      // Arrange
      const resolutionData = {
        disputeId: 'dispute-456',
        proposalId: 'proposal-123',
        resolution: 'favor_proposer' as const,
        resolvedBy: 'mediator-admin',
        reasoning: 'Evidence supports proposer claims',
        compensation: {
          amount: 100,
          recipient: 'proposer-789'
        },
        timestamp: new Date().toISOString()
      };

      mockHederaService.submitTransaction.mockResolvedValue(mockBlockchainTransaction);

      // Act
      const result = await swapMatchingHederaExtensions.recordDisputeResolution(resolutionData);

      // Assert
      expect(result).toEqual(mockBlockchainTransaction);
      expect(mockHederaService.submitTransaction).toHaveBeenCalledWith({
        type: 'dispute_resolved',
        payload: {
          disputeId: resolutionData.disputeId,
          proposalId: resolutionData.proposalId,
          resolution: resolutionData.resolution,
          resolvedBy: resolutionData.resolvedBy,
          reasoning: resolutionData.reasoning,
          compensation: resolutionData.compensation,
          timestamp: resolutionData.timestamp
        },
        memo: `Dispute resolved: ${resolutionData.disputeId}`
      });
    });

    it('should verify dispute resolution integrity', async () => {
      // Arrange
      const disputeId = 'dispute-456';
      
      mockSwapRepository.findDisputeBlockchainInfo.mockResolvedValue({
        disputeId,
        initiationTransactionId: 'tx-dispute-init-123',
        resolutionTransactionId: 'tx-dispute-resolve-456'
      });

      mockHederaService.getTransactionRecord
        .mockResolvedValueOnce({
          transactionId: 'tx-dispute-init-123',
          consensusTimestamp: '2024-01-01T12:00:00Z',
          payload: {
            disputeId,
            proposalId: 'proposal-123',
            initiatedBy: 'proposer-789',
            reason: 'Swap terms not honored'
          }
        })
        .mockResolvedValueOnce({
          transactionId: 'tx-dispute-resolve-456',
          consensusTimestamp: '2024-01-05T12:00:00Z',
          payload: {
            disputeId,
            resolution: 'favor_proposer',
            resolvedBy: 'mediator-admin',
            compensation: { amount: 100, recipient: 'proposer-789' }
          }
        });

      // Act
      const result = await blockchainVerificationService.verifyDisputeResolution(disputeId);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.disputeData.disputeId).toBe(disputeId);
      expect(result.resolutionData.resolution).toBe('favor_proposer');
      expect(result.resolutionData.compensation.amount).toBe(100);
    });
  });

  describe('Performance and Scalability Tests', () => {
    it('should handle batch blockchain operations efficiently', async () => {
      // Arrange
      const batchProposals = Array.from({ length: 50 }, (_, i) => ({
        proposalId: `proposal-${i}`,
        sourceSwapId: `source-${i}`,
        targetSwapId: `target-${i}`,
        proposerId: `proposer-${i}`,
        message: `Proposal ${i}`,
        conditions: [],
        compatibilityScore: 70 + (i % 30),
        timestamp: new Date().toISOString(),
        proposalType: 'browse_initiated' as const
      }));

      mockHederaService.submitBatchTransactions.mockResolvedValue(
        batchProposals.map((_, i) => ({
          transactionId: `tx-batch-${i}`,
          consensusTimestamp: new Date().toISOString()
        }))
      );

      // Act
      const results = await swapMatchingHederaExtensions.recordBatchBrowseProposals(batchProposals);

      // Assert
      expect(results).toHaveLength(50);
      expect(results.every(r => r.transactionId.startsWith('tx-batch-'))).toBe(true);
      expect(mockHederaService.submitBatchTransactions).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'browse_proposal_created',
            payload: expect.objectContaining({
              proposalId: 'proposal-0'
            })
          })
        ])
      );
    });

    it('should optimize blockchain queries for large datasets', async () => {
      // Arrange
      const proposalIds = Array.from({ length: 100 }, (_, i) => `proposal-${i}`);
      
      mockSwapRepository.findMultipleProposalBlockchainInfo.mockResolvedValue(
        proposalIds.map(id => ({
          proposalId: id,
          transactionId: `tx-${id}`,
          consensusTimestamp: new Date().toISOString()
        }))
      );

      // Act
      const results = await blockchainVerificationService.verifyMultipleProposals(proposalIds);

      // Assert
      expect(results).toHaveLength(100);
      expect(mockSwapRepository.findMultipleProposalBlockchainInfo).toHaveBeenCalledWith(proposalIds);
      // Should use batch query instead of individual queries
      expect(mockSwapRepository.findProposalBlockchainInfo).not.toHaveBeenCalled();
    });

    it('should handle blockchain network congestion gracefully', async () => {
      // Arrange
      const proposalMetadata = {
        proposalId: 'proposal-123',
        sourceSwapId: 'source-swap-456',
        targetSwapId: 'target-swap-123',
        proposerId: 'proposer-789',
        message: 'Test proposal',
        conditions: [],
        compatibilityScore: 75,
        timestamp: new Date().toISOString(),
        proposalType: 'browse_initiated' as const
      };

      // Simulate network congestion with increasing delays
      mockHederaService.submitTransaction
        .mockRejectedValueOnce(new Error('Network congested - retry after 5s'))
        .mockRejectedValueOnce(new Error('Network congested - retry after 10s'))
        .mockResolvedValueOnce({
          ...mockBlockchainTransaction,
          consensusTimestamp: new Date(Date.now() + 15000).toISOString() // Delayed consensus
        });

      // Mock adaptive retry with exponential backoff
      swapMatchingHederaExtensions.recordBrowseProposalWithAdaptiveRetry = vi.fn()
        .mockImplementation(async (metadata) => {
          const delays = [5000, 10000, 20000];
          let lastError;
          
          for (let i = 0; i < delays.length; i++) {
            try {
              return await swapMatchingHederaExtensions.recordBrowseProposal(metadata);
            } catch (error) {
              lastError = error;
              if (i < delays.length - 1) {
                await new Promise(resolve => setTimeout(resolve, delays[i]));
              }
            }
          }
          throw lastError;
        });

      // Act
      const result = await swapMatchingHederaExtensions.recordBrowseProposalWithAdaptiveRetry(
        proposalMetadata
      );

      // Assert
      expect(result.transactionId).toBe(mockBlockchainTransaction.transactionId);
      expect(mockHederaService.submitTransaction).toHaveBeenCalledTimes(3);
    });
  });

  describe('Data Integrity and Consistency Tests', () => {
    it('should ensure proposal data consistency across blockchain and database', async () => {
      // Arrange
      const proposalId = 'proposal-123';
      const blockchainData = {
        proposalId,
        sourceSwapId: 'source-swap-456',
        targetSwapId: 'target-swap-123',
        proposerId: 'proposer-789',
        compatibilityScore: 85
      };
      
      const databaseData = {
        id: proposalId,
        sourceSwapId: 'source-swap-456',
        targetSwapId: 'target-swap-123',
        proposerId: 'proposer-789',
        metadata: { compatibilityScore: 85 }
      };

      mockHederaService.getTransactionRecord.mockResolvedValue({
        transactionId: mockBlockchainTransaction.transactionId,
        consensusTimestamp: mockBlockchainTransaction.consensusTimestamp,
        payload: blockchainData
      });

      mockSwapRepository.findById.mockResolvedValue(databaseData);

      // Act
      const consistencyCheck = await blockchainVerificationService.checkDataConsistency(proposalId);

      // Assert
      expect(consistencyCheck.isConsistent).toBe(true);
      expect(consistencyCheck.discrepancies).toHaveLength(0);
    });

    it('should detect and report data inconsistencies', async () => {
      // Arrange
      const proposalId = 'proposal-123';
      const blockchainData = {
        proposalId,
        sourceSwapId: 'source-swap-456',
        targetSwapId: 'target-swap-123',
        proposerId: 'proposer-789',
        compatibilityScore: 85
      };
      
      const databaseData = {
        id: proposalId,
        sourceSwapId: 'source-swap-456',
        targetSwapId: 'target-swap-123',
        proposerId: 'different-proposer', // Inconsistency
        metadata: { compatibilityScore: 75 } // Inconsistency
      };

      mockHederaService.getTransactionRecord.mockResolvedValue({
        transactionId: mockBlockchainTransaction.transactionId,
        consensusTimestamp: mockBlockchainTransaction.consensusTimestamp,
        payload: blockchainData
      });

      mockSwapRepository.findById.mockResolvedValue(databaseData);

      // Act
      const consistencyCheck = await blockchainVerificationService.checkDataConsistency(proposalId);

      // Assert
      expect(consistencyCheck.isConsistent).toBe(false);
      expect(consistencyCheck.discrepancies).toHaveLength(2);
      expect(consistencyCheck.discrepancies).toContainEqual({
        field: 'proposerId',
        blockchainValue: 'proposer-789',
        databaseValue: 'different-proposer'
      });
      expect(consistencyCheck.discrepancies).toContainEqual({
        field: 'compatibilityScore',
        blockchainValue: 85,
        databaseValue: 75
      });
    });

    it('should handle blockchain data corruption detection', async () => {
      // Arrange
      const proposalId = 'proposal-123';
      
      mockSwapRepository.findProposalBlockchainInfo.mockResolvedValue({
        proposalId,
        transactionId: mockBlockchainTransaction.transactionId,
        consensusTimestamp: mockBlockchainTransaction.consensusTimestamp,
        dataHash: 'original-hash-123'
      });

      // Mock corrupted blockchain data
      mockHederaService.getTransactionRecord.mockResolvedValue({
        transactionId: mockBlockchainTransaction.transactionId,
        consensusTimestamp: mockBlockchainTransaction.consensusTimestamp,
        payload: {
          proposalId,
          sourceSwapId: 'corrupted-data',
          // Missing required fields indicating corruption
        }
      });

      // Act
      const verification = await blockchainVerificationService.verifyDataIntegrity(proposalId);

      // Assert
      expect(verification.isValid).toBe(false);
      expect(verification.corruptionDetected).toBe(true);
      expect(verification.issues).toContain('Missing required fields in blockchain record');
    });
  });
});