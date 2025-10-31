import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TargetingBlockchainService } from '../TargetingBlockchainService';
import { HederaService } from '../HederaService';
import { BlockchainVerificationService } from '../BlockchainVerificationService';
import { TargetingCreationData } from '../TargetingHederaExtensions';

// Mock the dependencies
vi.mock('../HederaService');
vi.mock('../BlockchainVerificationService');
vi.mock('../TargetingVerificationService', () => ({
    TargetingVerificationService: vi.fn().mockImplementation(() => ({
        verifyTargetingTransaction: vi.fn(),
        getTargetingAuditTrail: vi.fn(),
        detectTargetingTampering: vi.fn(),
        collectDisputeEvidence: vi.fn(),
    }))
}));

describe('TargetingBlockchainService', () => {
    let targetingBlockchainService: TargetingBlockchainService;
    let mockHederaService: vi.Mocked<HederaService>;
    let mockBlockchainVerificationService: vi.Mocked<BlockchainVerificationService>;

    beforeEach(() => {
        mockHederaService = {
            recordTargetingCreation: vi.fn(),
            recordTargetingRetarget: vi.fn(),
            recordTargetingRemoval: vi.fn(),
            recordTargetingStatusChange: vi.fn(),
            recordTargetingDispute: vi.fn(),
            queryTransaction: vi.fn(),
        } as any;

        mockBlockchainVerificationService = {
            verifyTransaction: vi.fn(),
        } as any;

        targetingBlockchainService = new TargetingBlockchainService(
            mockHederaService,
            mockBlockchainVerificationService
        );
    });

    describe('recordTargetingCreation', () => {
        it('should successfully record targeting creation', async () => {
            // Arrange
            const targetingData: TargetingCreationData = {
                targetingId: 'targeting-123',
                sourceSwapId: 'swap-456',
                targetSwapId: 'swap-789',
                proposalId: 'proposal-101',
                userId: 'user-202',
                timestamp: new Date(),
                metadata: { test: 'data' }
            };

            mockHederaService.recordTargetingCreation.mockResolvedValue('tx-123');

            // Act
            const result = await targetingBlockchainService.recordTargetingCreation(targetingData);

            // Assert
            expect(result.success).toBe(true);
            expect(result.transactionId).toBe('tx-123');
            expect(mockHederaService.recordTargetingCreation).toHaveBeenCalledWith(targetingData);
        });

        it('should handle errors gracefully', async () => {
            // Arrange
            const targetingData: TargetingCreationData = {
                targetingId: 'targeting-123',
                sourceSwapId: 'swap-456',
                targetSwapId: 'swap-789',
                proposalId: 'proposal-101',
                userId: 'user-202',
                timestamp: new Date()
            };

            mockHederaService.recordTargetingCreation.mockRejectedValue(new Error('Blockchain error'));

            // Act
            const result = await targetingBlockchainService.recordTargetingCreation(targetingData);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBe('Blockchain error');
        });
    });
});