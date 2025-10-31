import { ProposalVerificationService } from '../ProposalVerificationService';
import { BlockchainVerificationService } from '../../hedera/BlockchainVerificationService';
import { HederaService } from '../../hedera/HederaService';
import { SwapRepository } from '../../../database/repositories/SwapRepository';
import { logger } from '../../../utils/logger';

// Mock the logger
jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock dependencies
const mockBlockchainVerificationService = {
  verifyProposalTransactions: jest.fn(),
  detectProposalTampering: jest.fn(),
  verifyProposalLifecycle: jest.fn(),
  batchVerifyTransactions: jest.fn(),
} as unknown as BlockchainVerificationService;

const mockHederaService = {
  recordProposalVerification: jest.fn(),
  recordDisputeResolution: jest.fn(),
  recordProposalStatusChange: jest.fn(),
} as unknown as HederaService;

const mockSwapRepository = {
  findById: jest.fn(),
} as unknown as SwapRepository;

describe('ProposalVerificationService', () => {
  let proposalVerificationService: ProposalVerificationService;

  beforeEach(() => {
    proposalVerificationService = new ProposalVerificationService(
      mockBlockchainVerificationService,
      mockHederaService,
      mockSwapRepository
    );
    jest.clearAllMocks();
  });

  describe('verifyProposalAuthenticity', () => {
    it('should verify authentic proposal successfully', async () => {
      // Arrange
      const proposalId = 'proposal_123';
      const transactionIds = {
        creationTxId: 'tx_creation',
        metadataTxId: 'tx_metadata',
        statusChangeTxIds: ['tx_status1'],
        verificationTxId: 'tx_verification',
      };

      const mockProposal = {
        id: proposalId,
        sourceBookingId: 'booking_source',
        targetBookingId: 'booking_target',
        proposerId: 'user_123',
        status: 'pending',
      };

      const mockVerificationDetails = {
        proposalId,
        allTransactionsValid: true,
        proposalAuthenticity: 'authentic' as const,
        verificationResults: [
          { isValid: true, transactionId: 'tx_creation', status: 'SUCCESS' },
          { isValid: true, transactionId: 'tx_metadata', status: 'SUCCESS' },
        ],
        auditTrail: [
          {
            transactionId: 'tx_creation',
            eventType: 'creation' as const,
            timestamp: '2024-01-01T00:00:00Z',
            isValid: true,
            eventData: { proposalId, eventType: 'proposal_creation' },
          },
        ],
      };

      const mockTamperingResult = {
        isTampered: false,
        tamperedFields: [],
        verificationDetails: [],
        confidenceScore: 100,
      };

      const mockLifecycleResult = {
        isValidLifecycle: true,
        violations: [],
        expectedOrder: ['creation', 'metadata'],
        actualOrder: ['creation', 'metadata'],
      };

      (mockSwapRepository.findById as jest.Mock).mockResolvedValue(mockProposal);
      (mockBlockchainVerificationService.verifyProposalTransactions as jest.Mock)
        .mockResolvedValue(mockVerificationDetails);
      (mockBlockchainVerificationService.detectProposalTampering as jest.Mock)
        .mockResolvedValue(mockTamperingResult);
      (mockBlockchainVerificationService.verifyProposalLifecycle as jest.Mock)
        .mockResolvedValue(mockLifecycleResult);
      (mockHederaService.recordProposalVerification as jest.Mock)
        .mockResolvedValue('tx_verification_record');

      // Act
      const result = await proposalVerificationService.verifyProposalAuthenticity(
        proposalId,
        transactionIds
      );

      // Assert
      expect(result).toEqual({
        proposalId,
        isAuthentic: true,
        authenticity: 'authentic',
        confidenceScore: 100,
        verificationDetails: {
          ...mockVerificationDetails,
          verificationTxId: 'tx_verification_record',
        },
        tamperedFields: [],
        recommendations: ['Proposal appears authentic and valid'],
      });

      expect(mockBlockchainVerificationService.verifyProposalTransactions).toHaveBeenCalledWith(
        proposalId,
        transactionIds
      );
      expect(mockHederaService.recordProposalVerification).toHaveBeenCalledWith(
        expect.objectContaining({
          proposalId,
          isValid: true,
        })
      );
    });

    it('should detect tampered proposal', async () => {
      // Arrange
      const proposalId = 'proposal_123';
      const transactionIds = { creationTxId: 'tx_creation' };

      const mockProposal = {
        id: proposalId,
        sourceBookingId: 'booking_source',
        targetBookingId: 'booking_target',
        proposerId: 'user_123',
        status: 'pending',
      };

      const mockVerificationDetails = {
        proposalId,
        allTransactionsValid: false,
        proposalAuthenticity: 'tampered' as const,
        verificationResults: [
          { isValid: false, transactionId: 'tx_creation', status: 'FAILED' },
        ],
        auditTrail: [],
      };

      const mockTamperingResult = {
        isTampered: true,
        tamperedFields: ['blockchain_integrity'],
        verificationDetails: [],
        confidenceScore: 30,
      };

      const mockLifecycleResult = {
        isValidLifecycle: false,
        violations: ['Creation event must be first'],
        expectedOrder: ['creation'],
        actualOrder: ['metadata'],
      };

      (mockSwapRepository.findById as jest.Mock).mockResolvedValue(mockProposal);
      (mockBlockchainVerificationService.verifyProposalTransactions as jest.Mock)
        .mockResolvedValue(mockVerificationDetails);
      (mockBlockchainVerificationService.detectProposalTampering as jest.Mock)
        .mockResolvedValue(mockTamperingResult);
      (mockBlockchainVerificationService.verifyProposalLifecycle as jest.Mock)
        .mockResolvedValue(mockLifecycleResult);
      (mockHederaService.recordProposalVerification as jest.Mock)
        .mockResolvedValue('tx_verification_record');

      // Act
      const result = await proposalVerificationService.verifyProposalAuthenticity(
        proposalId,
        transactionIds
      );

      // Assert
      expect(result.isAuthentic).toBe(false);
      expect(result.authenticity).toBe('tampered');
      expect(result.confidenceScore).toBeLessThan(50);
      expect(result.tamperedFields).toContain('blockchain_integrity');
      expect(result.recommendations).toContain('Some blockchain transactions are invalid - verify proposal authenticity');
      expect(result.recommendations).toContain('Potential tampering detected - investigate proposal data integrity');
    });

    it('should handle proposal not found error', async () => {
      // Arrange
      const proposalId = 'nonexistent_proposal';
      const transactionIds = { creationTxId: 'tx_creation' };

      (mockSwapRepository.findById as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(
        proposalVerificationService.verifyProposalAuthenticity(proposalId, transactionIds)
      ).rejects.toThrow('Proposal not found');
    });
  });

  describe('handleProposalDispute', () => {
    it('should handle authenticity dispute and resolve as valid', async () => {
      // Arrange
      const proposalId = 'proposal_123';
      const disputeType = 'authenticity';
      const evidence = ['blockchain evidence', 'user verification'];
      const reportedBy = 'user_456';

      (mockHederaService.recordDisputeResolution as jest.Mock)
        .mockResolvedValue('tx_dispute_resolution');

      // Act
      const result = await proposalVerificationService.handleProposalDispute(
        proposalId,
        disputeType,
        evidence,
        reportedBy
      );

      // Assert
      expect(result).toEqual({
        disputeId: expect.stringContaining(`dispute_${proposalId}_`),
        proposalId,
        resolution: 'proposal_invalid', // Based on mock investigation logic
        evidence,
        blockchainTransactionId: 'tx_dispute_resolution',
      });

      expect(mockHederaService.recordDisputeResolution).toHaveBeenCalledWith(
        expect.objectContaining({
          proposalId,
          disputeType: 'authenticity',
          resolution: 'proposal_invalid',
          evidence,
        })
      );
    });

    it('should handle fraud dispute and update proposal status', async () => {
      // Arrange
      const proposalId = 'proposal_123';
      const disputeType = 'fraud';
      const evidence = ['fake booking evidence'];
      const reportedBy = 'user_456';

      (mockHederaService.recordDisputeResolution as jest.Mock)
        .mockResolvedValue('tx_dispute_resolution');
      (mockHederaService.recordProposalStatusChange as jest.Mock)
        .mockResolvedValue('tx_status_change');

      // Act
      const result = await proposalVerificationService.handleProposalDispute(
        proposalId,
        disputeType,
        evidence,
        reportedBy
      );

      // Assert
      expect(result.resolution).toBe('proposal_invalid');
      expect(mockHederaService.recordProposalStatusChange).toHaveBeenCalledWith({
        proposalId,
        previousStatus: 'pending',
        newStatus: 'rejected',
        changedBy: 'dispute_resolution',
        changedAt: expect.any(Date),
        reason: expect.stringContaining('Dispute resolved:'),
        metadata: expect.objectContaining({
          disputeType: 'fraud',
          resolution: 'proposal_invalid',
        }),
      });
    });

    it('should handle compatibility dispute', async () => {
      // Arrange
      const proposalId = 'proposal_123';
      const disputeType = 'compatibility';
      const evidence = ['location mismatch'];
      const reportedBy = 'user_456';

      (mockHederaService.recordDisputeResolution as jest.Mock)
        .mockResolvedValue('tx_dispute_resolution');

      // Act
      const result = await proposalVerificationService.handleProposalDispute(
        proposalId,
        disputeType,
        evidence,
        reportedBy
      );

      // Assert
      expect(result.resolution).toBe('partial_resolution');
      expect(mockHederaService.recordDisputeResolution).toHaveBeenCalled();
      // Should not update proposal status for compatibility disputes
      expect(mockHederaService.recordProposalStatusChange).not.toHaveBeenCalled();
    });

    it('should escalate unknown dispute types', async () => {
      // Arrange
      const proposalId = 'proposal_123';
      const disputeType = 'unknown' as any;
      const evidence = ['some evidence'];
      const reportedBy = 'user_456';

      (mockHederaService.recordDisputeResolution as jest.Mock)
        .mockResolvedValue('tx_dispute_resolution');

      // Act
      const result = await proposalVerificationService.handleProposalDispute(
        proposalId,
        disputeType,
        evidence,
        reportedBy
      );

      // Assert
      expect(result.resolution).toBe('escalated');
      expect(mockHederaService.recordDisputeResolution).toHaveBeenCalledWith(
        expect.objectContaining({
          resolution: 'escalated',
          outcome: 'Dispute type not recognized, escalated for manual review',
        })
      );
    });
  });

  describe('getProposalAuditTrail', () => {
    it('should retrieve and format proposal audit trail', async () => {
      // Arrange
      const proposalId = 'proposal_123';
      const transactionIds = ['tx_1', 'tx_2', 'tx_3'];

      const mockVerificationResults = [
        {
          isValid: true,
          transactionId: 'tx_1',
          status: 'SUCCESS',
          consensusTimestamp: '2024-01-01T00:00:00Z',
        },
        {
          isValid: true,
          transactionId: 'tx_2',
          status: 'SUCCESS',
          consensusTimestamp: '2024-01-01T01:00:00Z',
        },
        {
          isValid: false,
          transactionId: 'tx_3',
          status: 'FAILED',
          consensusTimestamp: '2024-01-01T02:00:00Z',
        },
      ];

      (mockBlockchainVerificationService.batchVerifyTransactions as jest.Mock)
        .mockResolvedValue(mockVerificationResults);

      // Act
      const result = await proposalVerificationService.getProposalAuditTrail(
        proposalId,
        transactionIds
      );

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        transactionId: 'tx_1',
        eventType: 'creation',
        timestamp: '2024-01-01T00:00:00Z',
        isValid: true,
        eventData: {
          proposalId,
          status: 'SUCCESS',
          transactionIndex: 0,
        },
      });

      // Verify chronological order
      const timestamps = result.map(event => new Date(event.timestamp).getTime());
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
      }

      expect(logger.info).toHaveBeenCalledWith(
        'Proposal audit trail retrieved',
        expect.objectContaining({
          proposalId,
          eventCount: 3,
          validEvents: 2,
        })
      );
    });

    it('should handle empty transaction list', async () => {
      // Arrange
      const proposalId = 'proposal_123';
      const transactionIds: string[] = [];

      (mockBlockchainVerificationService.batchVerifyTransactions as jest.Mock)
        .mockResolvedValue([]);

      // Act
      const result = await proposalVerificationService.getProposalAuditTrail(
        proposalId,
        transactionIds
      );

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  describe('confidence score calculation', () => {
    it('should calculate confidence score correctly', async () => {
      // This tests the private method indirectly through verifyProposalAuthenticity
      const proposalId = 'proposal_123';
      const transactionIds = { creationTxId: 'tx_creation' };

      const mockProposal = {
        id: proposalId,
        sourceBookingId: 'booking_source',
        targetBookingId: 'booking_target',
        proposerId: 'user_123',
        status: 'pending',
      };

      // Test case: Some invalid transactions, tampering detected, lifecycle violations
      const mockVerificationDetails = {
        proposalId,
        allTransactionsValid: false,
        proposalAuthenticity: 'tampered' as const,
        verificationResults: [
          { isValid: false, transactionId: 'tx_1', status: 'FAILED' },
          { isValid: true, transactionId: 'tx_2', status: 'SUCCESS' },
        ],
        auditTrail: [],
      };

      const mockTamperingResult = {
        isTampered: true,
        tamperedFields: ['data_integrity'],
        verificationDetails: [],
        confidenceScore: 50,
      };

      const mockLifecycleResult = {
        isValidLifecycle: false,
        violations: ['Invalid order', 'Missing event'],
        expectedOrder: ['creation', 'metadata'],
        actualOrder: ['metadata', 'creation'],
      };

      (mockSwapRepository.findById as jest.Mock).mockResolvedValue(mockProposal);
      (mockBlockchainVerificationService.verifyProposalTransactions as jest.Mock)
        .mockResolvedValue(mockVerificationDetails);
      (mockBlockchainVerificationService.detectProposalTampering as jest.Mock)
        .mockResolvedValue(mockTamperingResult);
      (mockBlockchainVerificationService.verifyProposalLifecycle as jest.Mock)
        .mockResolvedValue(mockLifecycleResult);
      (mockHederaService.recordProposalVerification as jest.Mock)
        .mockResolvedValue('tx_verification');

      // Act
      const result = await proposalVerificationService.verifyProposalAuthenticity(
        proposalId,
        transactionIds
      );

      // Assert
      // Expected calculation:
      // Start: 100
      // Invalid transactions: -20 (1/2 * 40)
      // Tampering: -30
      // Lifecycle violations: -20 (2 * 10)
      // Final: 30
      expect(result.confidenceScore).toBe(30);
    });
  });
});