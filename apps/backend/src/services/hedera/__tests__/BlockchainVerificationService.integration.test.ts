import { BlockchainVerificationService } from '../BlockchainVerificationService';
import { HederaService } from '../HederaService';
import { logger } from '../../../utils/logger';

// Mock the logger
jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock HederaService
const mockHederaService = {
  queryTransaction: jest.fn(),
  getAccountBalance: jest.fn(),
} as unknown as HederaService;

describe('BlockchainVerificationService Integration Tests', () => {
  let verificationService: BlockchainVerificationService;

  beforeEach(() => {
    verificationService = new BlockchainVerificationService(mockHederaService);
    jest.clearAllMocks();
  });

  describe('verifyProposalTransactions', () => {
    it('should verify complete proposal lifecycle', async () => {
      // Arrange
      const proposalId = 'proposal_integration_test';
      const transactionIds = {
        creationTxId: 'tx_creation_123',
        metadataTxId: 'tx_metadata_456',
        statusChangeTxIds: ['tx_status_789', 'tx_status_101'],
        verificationTxId: 'tx_verification_112',
      };

      // Mock successful transaction verifications
      const mockSuccessfulReceipt = {
        status: { toString: () => 'SUCCESS' },
        consensusTimestamp: { toString: () => '2024-01-01T00:00:00Z' },
      };

      (mockHederaService.queryTransaction as jest.Mock)
        .mockResolvedValue(mockSuccessfulReceipt);

      // Act
      const result = await verificationService.verifyProposalTransactions(
        proposalId,
        transactionIds
      );

      // Assert
      expect(result.proposalId).toBe(proposalId);
      expect(result.allTransactionsValid).toBe(true);
      expect(result.proposalAuthenticity).toBe('authentic');
      expect(result.verificationResults).toHaveLength(5); // creation + metadata + 2 status + verification
      expect(result.auditTrail).toHaveLength(5);

      // Verify all transactions were queried
      expect(mockHederaService.queryTransaction).toHaveBeenCalledTimes(5);
      expect(mockHederaService.queryTransaction).toHaveBeenCalledWith('tx_creation_123');
      expect(mockHederaService.queryTransaction).toHaveBeenCalledWith('tx_metadata_456');
      expect(mockHederaService.queryTransaction).toHaveBeenCalledWith('tx_status_789');
      expect(mockHederaService.queryTransaction).toHaveBeenCalledWith('tx_status_101');
      expect(mockHederaService.queryTransaction).toHaveBeenCalledWith('tx_verification_112');

      // Verify audit trail is chronologically ordered
      const timestamps = result.auditTrail.map(event => new Date(event.timestamp).getTime());
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
      }
    });

    it('should handle mixed valid/invalid transactions', async () => {
      // Arrange
      const proposalId = 'proposal_mixed_test';
      const transactionIds = {
        creationTxId: 'tx_creation_valid',
        metadataTxId: 'tx_metadata_invalid',
        statusChangeTxIds: ['tx_status_valid'],
      };

      // Mock mixed results
      (mockHederaService.queryTransaction as jest.Mock)
        .mockImplementation((txId: string) => {
          if (txId.includes('invalid')) {
            return Promise.reject(new Error('Transaction not found'));
          }
          return Promise.resolve({
            status: { toString: () => 'SUCCESS' },
            consensusTimestamp: { toString: () => '2024-01-01T00:00:00Z' },
          });
        });

      // Act
      const result = await verificationService.verifyProposalTransactions(
        proposalId,
        transactionIds
      );

      // Assert
      expect(result.allTransactionsValid).toBe(false);
      expect(result.proposalAuthenticity).toBe('tampered');
      expect(result.verificationResults).toHaveLength(3);
      
      const validResults = result.verificationResults.filter(r => r.isValid);
      const invalidResults = result.verificationResults.filter(r => !r.isValid);
      
      expect(validResults).toHaveLength(2); // creation and status
      expect(invalidResults).toHaveLength(1); // metadata
      expect(invalidResults[0].transactionId).toBe('tx_metadata_invalid');
    });

    it('should handle empty transaction IDs gracefully', async () => {
      // Arrange
      const proposalId = 'proposal_empty_test';
      const transactionIds = {};

      // Act
      const result = await verificationService.verifyProposalTransactions(
        proposalId,
        transactionIds
      );

      // Assert
      expect(result.proposalId).toBe(proposalId);
      expect(result.allTransactionsValid).toBe(true); // No transactions to fail
      expect(result.proposalAuthenticity).toBe('unverified'); // No transactions to verify
      expect(result.verificationResults).toHaveLength(0);
      expect(result.auditTrail).toHaveLength(0);
    });
  });

  describe('detectProposalTampering', () => {
    it('should detect tampering when transactions are invalid', async () => {
      // Arrange
      const proposalId = 'proposal_tampered_test';
      const expectedData = {
        proposalId,
        sourceBookingId: 'booking_123',
        targetBookingId: 'booking_456',
      };
      const transactionIds = ['tx_invalid_1', 'tx_invalid_2'];

      // Mock invalid transactions
      (mockHederaService.queryTransaction as jest.Mock)
        .mockRejectedValue(new Error('Transaction verification failed'));

      // Act
      const result = await verificationService.detectProposalTampering(
        proposalId,
        expectedData,
        transactionIds
      );

      // Assert
      expect(result.isTampered).toBe(true);
      expect(result.tamperedFields).toContain('blockchain_integrity');
      expect(result.confidenceScore).toBeLessThan(80);
      expect(result.verificationDetails).toHaveLength(2);
      expect(result.verificationDetails.every(r => !r.isValid)).toBe(true);
    });

    it('should pass when all transactions are valid', async () => {
      // Arrange
      const proposalId = 'proposal_valid_test';
      const expectedData = {
        proposalId,
        sourceBookingId: 'booking_123',
        targetBookingId: 'booking_456',
      };
      const transactionIds = ['tx_valid_1', 'tx_valid_2'];

      // Mock valid transactions
      (mockHederaService.queryTransaction as jest.Mock)
        .mockResolvedValue({
          status: { toString: () => 'SUCCESS' },
          consensusTimestamp: { toString: () => '2024-01-01T00:00:00Z' },
        });

      // Act
      const result = await verificationService.detectProposalTampering(
        proposalId,
        expectedData,
        transactionIds
      );

      // Assert
      expect(result.isTampered).toBe(false);
      expect(result.tamperedFields).toHaveLength(0);
      expect(result.confidenceScore).toBe(100);
      expect(result.verificationDetails).toHaveLength(2);
      expect(result.verificationDetails.every(r => r.isValid)).toBe(true);
    });
  });

  describe('verifyProposalLifecycle', () => {
    it('should validate correct proposal lifecycle', async () => {
      // Arrange
      const auditTrail = [
        {
          transactionId: 'tx_1',
          eventType: 'creation' as const,
          timestamp: '2024-01-01T00:00:00Z',
          isValid: true,
          eventData: { proposalId: 'test', eventType: 'proposal_creation' },
        },
        {
          transactionId: 'tx_2',
          eventType: 'metadata' as const,
          timestamp: '2024-01-01T01:00:00Z',
          isValid: true,
          eventData: { proposalId: 'test', eventType: 'metadata_recording' },
        },
        {
          transactionId: 'tx_3',
          eventType: 'verification' as const,
          timestamp: '2024-01-01T02:00:00Z',
          isValid: true,
          eventData: { proposalId: 'test', eventType: 'proposal_verification' },
        },
        {
          transactionId: 'tx_4',
          eventType: 'status_change' as const,
          timestamp: '2024-01-01T03:00:00Z',
          isValid: true,
          eventData: { proposalId: 'test', eventType: 'status_change' },
        },
      ];

      // Act
      const result = await verificationService.verifyProposalLifecycle(auditTrail);

      // Assert
      expect(result.isValidLifecycle).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.actualOrder).toEqual(['creation', 'metadata', 'verification', 'status_change']);
    });

    it('should detect lifecycle violations', async () => {
      // Arrange - Invalid lifecycle: metadata before creation
      const auditTrail = [
        {
          transactionId: 'tx_1',
          eventType: 'metadata' as const,
          timestamp: '2024-01-01T00:00:00Z',
          isValid: true,
          eventData: { proposalId: 'test', eventType: 'metadata_recording' },
        },
        {
          transactionId: 'tx_2',
          eventType: 'creation' as const,
          timestamp: '2024-01-01T01:00:00Z',
          isValid: true,
          eventData: { proposalId: 'test', eventType: 'proposal_creation' },
        },
      ];

      // Act
      const result = await verificationService.verifyProposalLifecycle(auditTrail);

      // Assert
      expect(result.isValidLifecycle).toBe(false);
      expect(result.violations).toContain('Creation event must be first');
      expect(result.actualOrder).toEqual(['metadata', 'creation']);
    });

    it('should detect multiple creation events', async () => {
      // Arrange
      const auditTrail = [
        {
          transactionId: 'tx_1',
          eventType: 'creation' as const,
          timestamp: '2024-01-01T00:00:00Z',
          isValid: true,
          eventData: { proposalId: 'test', eventType: 'proposal_creation' },
        },
        {
          transactionId: 'tx_2',
          eventType: 'creation' as const,
          timestamp: '2024-01-01T01:00:00Z',
          isValid: true,
          eventData: { proposalId: 'test', eventType: 'proposal_creation' },
        },
      ];

      // Act
      const result = await verificationService.verifyProposalLifecycle(auditTrail);

      // Assert
      expect(result.isValidLifecycle).toBe(false);
      expect(result.violations).toContain('Multiple creation events detected');
    });

    it('should detect chronological violations', async () => {
      // Arrange - Events with timestamps out of order
      const auditTrail = [
        {
          transactionId: 'tx_1',
          eventType: 'creation' as const,
          timestamp: '2024-01-01T02:00:00Z', // Later timestamp
          isValid: true,
          eventData: { proposalId: 'test', eventType: 'proposal_creation' },
        },
        {
          transactionId: 'tx_2',
          eventType: 'metadata' as const,
          timestamp: '2024-01-01T01:00:00Z', // Earlier timestamp
          isValid: true,
          eventData: { proposalId: 'test', eventType: 'metadata_recording' },
        },
      ];

      // Act
      const result = await verificationService.verifyProposalLifecycle(auditTrail);

      // Assert
      expect(result.isValidLifecycle).toBe(false);
      expect(result.violations).toContain('Event 1 occurs before event 0 chronologically');
    });
  });

  describe('end-to-end proposal verification', () => {
    it('should perform complete proposal verification workflow', async () => {
      // Arrange - Simulate a complete proposal with all transaction types
      const proposalId = 'proposal_e2e_test';
      const transactionIds = {
        creationTxId: 'tx_creation_e2e',
        metadataTxId: 'tx_metadata_e2e',
        statusChangeTxIds: ['tx_accepted_e2e'],
        verificationTxId: 'tx_verification_e2e',
      };

      // Mock all transactions as successful with proper timestamps
      let timestampCounter = 0;
      (mockHederaService.queryTransaction as jest.Mock)
        .mockImplementation(() => {
          timestampCounter++;
          return Promise.resolve({
            status: { toString: () => 'SUCCESS' },
            consensusTimestamp: { 
              toString: () => `2024-01-01T0${timestampCounter}:00:00Z` 
            },
          });
        });

      // Act - Perform complete verification
      const proposalVerification = await verificationService.verifyProposalTransactions(
        proposalId,
        transactionIds
      );

      const tamperingCheck = await verificationService.detectProposalTampering(
        proposalId,
        { proposalId, sourceBookingId: 'booking_123' },
        Object.values(transactionIds).flat()
      );

      const lifecycleCheck = await verificationService.verifyProposalLifecycle(
        proposalVerification.auditTrail
      );

      // Assert - All checks should pass
      expect(proposalVerification.allTransactionsValid).toBe(true);
      expect(proposalVerification.proposalAuthenticity).toBe('authentic');
      expect(tamperingCheck.isTampered).toBe(false);
      expect(tamperingCheck.confidenceScore).toBe(100);
      expect(lifecycleCheck.isValidLifecycle).toBe(true);

      // Verify comprehensive audit trail
      expect(proposalVerification.auditTrail).toHaveLength(4);
      expect(proposalVerification.auditTrail[0].eventType).toBe('creation');
      expect(proposalVerification.auditTrail[1].eventType).toBe('metadata');
      expect(proposalVerification.auditTrail[2].eventType).toBe('status_change');
      expect(proposalVerification.auditTrail[3].eventType).toBe('verification');

      // Verify all events are chronologically ordered
      const timestamps = proposalVerification.auditTrail.map(e => new Date(e.timestamp).getTime());
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThan(timestamps[i - 1]);
      }
    });

    it('should handle network connectivity issues gracefully', async () => {
      // Arrange
      const proposalId = 'proposal_network_test';
      const transactionIds = {
        creationTxId: 'tx_network_fail',
      };

      // Mock network failure
      (mockHederaService.queryTransaction as jest.Mock)
        .mockRejectedValue(new Error('Network timeout'));

      // Act
      const result = await verificationService.verifyProposalTransactions(
        proposalId,
        transactionIds
      );

      // Assert - Should handle gracefully
      expect(result.allTransactionsValid).toBe(false);
      expect(result.proposalAuthenticity).toBe('tampered');
      expect(result.verificationResults).toHaveLength(1);
      expect(result.verificationResults[0].isValid).toBe(false);
      expect(result.verificationResults[0].error).toContain('Network timeout');
    });
  });
});