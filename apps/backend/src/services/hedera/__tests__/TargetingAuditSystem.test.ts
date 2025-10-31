import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TargetingAuditSystem } from '../TargetingAuditSystem';
import { TargetingVerificationService } from '../TargetingVerificationService';
import { TargetingBlockchainService } from '../TargetingBlockchainService';

// Mock the dependencies
vi.mock('../TargetingVerificationService');
vi.mock('../TargetingBlockchainService');

describe('TargetingAuditSystem', () => {
    let auditSystem: TargetingAuditSystem;
    let mockVerificationService: vi.Mocked<TargetingVerificationService>;
    let mockBlockchainService: vi.Mocked<TargetingBlockchainService>;

    beforeEach(() => {
        mockVerificationService = {
            getTargetingAuditTrail: vi.fn(),
            detectTargetingTampering: vi.fn(),
            verifyTargetingWorkflowIntegrity: vi.fn(),
            collectDisputeEvidence: vi.fn(),
        } as any;

        mockBlockchainService = {
            verifyTargetingTransaction: vi.fn(),
        } as any;

        auditSystem = new TargetingAuditSystem(
            mockVerificationService,
            mockBlockchainService
        );
    });

    describe('performIntegrityAudit', () => {
        it('should perform comprehensive integrity audit', async () => {
            // Arrange
            const targetingId = 'targeting-123';

            mockVerificationService.getTargetingAuditTrail.mockResolvedValue({
                targetingId,
                events: [
                    {
                        transactionId: 'tx-1',
                        consensusTimestamp: '123456789.000000000',
                        targetingId,
                        sourceSwapId: 'swap-1',
                        targetSwapId: 'swap-2',
                        eventType: 'targeting_created',
                        payload: {},
                        verified: true
                    }
                ],
                verificationResults: [
                    {
                        isValid: true,
                        targetingId,
                        sourceSwapId: 'swap-1',
                        targetSwapId: 'swap-2',
                        eventType: 'targeting_created',
                        tamperDetected: false,
                        integrityScore: 95,
                        verificationTimestamp: new Date(),
                        transactionId: 'tx-1',
                        status: 'SUCCESS',
                        consensusTimestamp: '123456789.000000000'
                    }
                ],
                integrityStatus: 'verified',
                lastVerified: new Date(),
                totalEvents: 1
            });

            mockVerificationService.detectTargetingTampering.mockResolvedValue({
                tamperDetected: false,
                tamperDetails: [],
                affectedTransactions: [],
                riskLevel: 'low'
            });

            mockVerificationService.verifyTargetingWorkflowIntegrity.mockResolvedValue({
                isValid: true,
                integrityScore: 95,
                issues: [],
                recommendations: []
            });

            // Act
            const result = await auditSystem.performIntegrityAudit(targetingId);

            // Assert
            expect(result.targetingId).toBe(targetingId);
            expect(result.verificationStatus).toBe('verified');
            expect(result.riskLevel).toBe('low');
            expect(result.overallIntegrityScore).toBeGreaterThan(90);
            expect(result.totalTransactions).toBe(1);
            expect(result.verifiedTransactions).toBe(1);
            expect(result.tamperedTransactions).toBe(0);
            expect(result.issues).toHaveLength(0);
        });

        it('should detect tampering and create appropriate report', async () => {
            // Arrange
            const targetingId = 'targeting-456';

            mockVerificationService.getTargetingAuditTrail.mockResolvedValue({
                targetingId,
                events: [],
                verificationResults: [],
                integrityStatus: 'tampered',
                lastVerified: new Date(),
                totalEvents: 0
            });

            mockVerificationService.detectTargetingTampering.mockResolvedValue({
                tamperDetected: true,
                tamperDetails: ['Transaction hash mismatch detected'],
                affectedTransactions: ['tx-bad'],
                riskLevel: 'high'
            });

            mockVerificationService.verifyTargetingWorkflowIntegrity.mockResolvedValue({
                isValid: false,
                integrityScore: 30,
                issues: ['Missing required targeting_created event'],
                recommendations: ['Investigate missing transactions']
            });

            // Act
            const result = await auditSystem.performIntegrityAudit(targetingId);

            // Assert
            expect(result.verificationStatus).toBe('tampered');
            expect(result.riskLevel).toBe('high');
            expect(result.overallIntegrityScore).toBeLessThan(50);
            expect(result.issues.length).toBeGreaterThan(0);
            expect(result.recommendations.length).toBeGreaterThan(0);
        });
    });

    describe('createDisputeResolutionCase', () => {
        it('should create dispute case with evidence collection', async () => {
            // Arrange
            const disputeId = 'dispute-123';
            const targetingId = 'targeting-789';
            const caseType = 'targeting_fraud';
            const reportedBy = 'user-456';
            const description = 'Suspicious targeting activity detected';

            mockVerificationService.collectDisputeEvidence.mockResolvedValue([
                {
                    disputeId,
                    targetingId,
                    evidenceType: 'blockchain_record',
                    evidenceData: { test: 'data' },
                    evidenceHash: 'hash123',
                    collectedAt: new Date(),
                    collectedBy: 'system'
                }
            ]);

            // Act
            const result = await auditSystem.createDisputeResolutionCase(
                disputeId,
                targetingId,
                caseType,
                reportedBy,
                description
            );

            // Assert
            expect(result.disputeId).toBe(disputeId);
            expect(result.targetingId).toBe(targetingId);
            expect(result.caseType).toBe(caseType);
            expect(result.status).toBe('open');
            expect(result.priority).toBe('urgent'); // targeting_fraud should be urgent
            expect(result.evidence).toHaveLength(1);
        });
    });
});