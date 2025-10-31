import { HederaService } from './HederaService';
import { TargetingVerificationService } from './TargetingVerificationService';
import { BlockchainVerificationService } from './BlockchainVerificationService';
import {
    TargetingCreationData,
    TargetingRetargetData,
    TargetingRemovalData,
    TargetingStatusChangeData,
    TargetingVerificationData,
    TargetingDisputeData
} from './TargetingHederaExtensions';
import { logger } from '../../utils/logger';

export interface TargetingBlockchainResult {
    success: boolean;
    transactionId?: string;
    consensusTimestamp?: string;
    error?: string;
}

export interface TargetingBlockchainVerificationResult {
    isValid: boolean;
    integrityScore: number;
    tamperDetected: boolean;
    verificationDetails: Record<string, any>;
}

/**
 * Main service for targeting blockchain operations
 * Integrates targeting recording and verification
 * Requirements: 5.4, 5.5, 5.6, 8.4, 8.5
 */
export class TargetingBlockchainService {
    private verificationService: TargetingVerificationService;

    constructor(
        private hederaService: HederaService,
        blockchainVerificationService: BlockchainVerificationService
    ) {
        this.verificationService = new TargetingVerificationService(
            hederaService,
            blockchainVerificationService
        );
    }

    /**
     * Record targeting creation with verification
     * Requirements: 5.4, 5.5, 8.4
     */
    async recordTargetingCreation(data: TargetingCreationData): Promise<TargetingBlockchainResult> {
        try {
            logger.info('Recording targeting creation', {
                targetingId: data.targetingId,
                sourceSwapId: data.sourceSwapId,
                targetSwapId: data.targetSwapId
            });

            const transactionId = await this.hederaService.recordTargetingCreation(data);

            return {
                success: true,
                transactionId
            };
        } catch (error) {
            logger.error('Failed to record targeting creation', { error, data });
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    /**
       * Record targeting retarget with verification
       * Requirements: 5.4, 5.5, 8.4
       */
    async recordTargetingRetarget(data: TargetingRetargetData): Promise<TargetingBlockchainResult> {
        try {
            logger.info('Recording targeting retarget', {
                targetingId: data.targetingId,
                sourceSwapId: data.sourceSwapId,
                previousTargetSwapId: data.previousTargetSwapId,
                newTargetSwapId: data.newTargetSwapId
            });

            const transactionId = await this.hederaService.recordTargetingRetarget(data);

            return {
                success: true,
                transactionId
            };
        } catch (error) {
            logger.error('Failed to record targeting retarget', { error, data });
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Record targeting removal with verification
     * Requirements: 5.4, 5.5, 8.4
     */
    async recordTargetingRemoval(data: TargetingRemovalData): Promise<TargetingBlockchainResult> {
        try {
            logger.info('Recording targeting removal', {
                targetingId: data.targetingId,
                sourceSwapId: data.sourceSwapId,
                targetSwapId: data.targetSwapId
            });

            const transactionId = await this.hederaService.recordTargetingRemoval(data);

            return {
                success: true,
                transactionId
            };
        } catch (error) {
            logger.error('Failed to record targeting removal', { error, data });
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Record targeting status change with verification
     * Requirements: 5.4, 5.5, 8.4
     */
    async recordTargetingStatusChange(data: TargetingStatusChangeData): Promise<TargetingBlockchainResult> {
        try {
            logger.info('Recording targeting status change', {
                targetingId: data.targetingId,
                previousStatus: data.previousStatus,
                newStatus: data.newStatus
            });

            const transactionId = await this.hederaService.recordTargetingStatusChange(data);

            return {
                success: true,
                transactionId
            };
        } catch (error) {
            logger.error('Failed to record targeting status change', { error, data });
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Verify targeting transaction authenticity
     * Requirements: 5.5, 5.6, 8.5
        */
    async verifyTargetingTransaction(transactionId: string): Promise<TargetingBlockchainVerificationResult> {
        try {
            logger.info('Verifying targeting transaction', { transactionId });

            const result = await this.verificationService.verifyTargetingTransaction(transactionId);

            return {
                isValid: result.isValid,
                integrityScore: result.integrityScore,
                tamperDetected: result.tamperDetected,
                verificationDetails: {
                    targetingId: result.targetingId,
                    sourceSwapId: result.sourceSwapId,
                    targetSwapId: result.targetSwapId,
                    eventType: result.eventType,
                    verificationTimestamp: result.verificationTimestamp
                }
            };
        } catch (error) {
            logger.error('Failed to verify targeting transaction', { error, transactionId });
            return {
                isValid: false,
                integrityScore: 0,
                tamperDetected: true,
                verificationDetails: {
                    error: error instanceof Error ? error.message : String(error)
                }
            };
        }
    }

    /**
     * Get targeting audit trail
     * Requirements: 5.5, 5.6, 8.5
     */
    async getTargetingAuditTrail(targetingId: string) {
        try {
            logger.info('Retrieving targeting audit trail', { targetingId });
            return await this.verificationService.getTargetingAuditTrail(targetingId);
        } catch (error) {
            logger.error('Failed to retrieve targeting audit trail', { error, targetingId });
            throw error;
        }
    }

    /**
     * Detect targeting tampering
     * Requirements: 5.6, 8.5
     */
    async detectTargetingTampering(targetingId: string) {
        try {
            logger.info('Detecting targeting tampering', { targetingId });
            return await this.verificationService.detectTargetingTampering(targetingId);
        } catch (error) {
            logger.error('Failed to detect targeting tampering', { error, targetingId });
            throw error;
        }
    }

    /**
     * Collect dispute evidence
     * Requirements: 5.7, 8.5
     */
    async collectDisputeEvidence(
        disputeId: string,
        targetingId: string,
        evidenceTypes: ('blockchain_record' | 'verification_result' | 'audit_trail')[]
    ) {
        try {
            logger.info('Collecting dispute evidence', { disputeId, targetingId, evidenceTypes });
            return await this.verificationService.collectDisputeEvidence(disputeId, targetingId, evidenceTypes);
        } catch (error) {
            logger.error('Failed to collect dispute evidence', { error, disputeId, targetingId });
            throw error;
        }
    }

    /**
     * Record targeting dispute
     * Requirements: 5.6, 5.7, 8.5
     */
    async recordTargetingDispute(data: TargetingDisputeData): Promise<TargetingBlockchainResult> {
        try {
            logger.info('Recording targeting dispute', {
                disputeId: data.disputeId,
                targetingId: data.targetingId,
                disputeType: data.disputeType
            });

            const transactionId = await this.hederaService.recordTargetingDispute(data);

            return {
                success: true,
                transactionId
            };
        } catch (error) {
            logger.error('Failed to record targeting dispute', { error, data });
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
}