import { HederaService, TransactionData } from './HederaService';
import { logger } from '../../utils/logger';

export interface TargetingCreationData {
    targetingId: string;
    sourceSwapId: string;
    targetSwapId: string;
    proposalId: string;
    userId: string;
    timestamp: Date;
    metadata?: Record<string, any>;
}

export interface TargetingRetargetData {
    targetingId: string;
    sourceSwapId: string;
    previousTargetSwapId: string;
    newTargetSwapId: string;
    previousProposalId: string;
    newProposalId: string;
    userId: string;
    timestamp: Date;
    reason?: string;
    metadata?: Record<string, any>;
}

export interface TargetingRemovalData {
    targetingId: string;
    sourceSwapId: string;
    targetSwapId: string;
    proposalId: string;
    userId: string;
    timestamp: Date;
    reason?: string;
    metadata?: Record<string, any>;
}

export interface TargetingStatusChangeData {
    targetingId: string;
    sourceSwapId: string;
    targetSwapId: string;
    proposalId: string;
    previousStatus: string;
    newStatus: string;
    userId: string;
    timestamp: Date;
    reason?: string;
    metadata?: Record<string, any>;
}

export interface TargetingVerificationData {
    targetingId: string;
    sourceSwapId: string;
    targetSwapId: string;
    proposalId: string;
    verificationResult: 'authentic' | 'tampered' | 'unverified';
    verificationDetails: Record<string, any>;
    verifiedBy: string;
    timestamp: Date;
    metadata?: Record<string, any>;
}

export interface TargetingDisputeData {
    disputeId: string;
    targetingId: string;
    sourceSwapId: string;
    targetSwapId: string;
    proposalId: string;
    disputeType: 'targeting_fraud' | 'proposal_manipulation' | 'status_tampering' | 'other';
    disputeReason: string;
    reportedBy: string;
    evidenceHash?: string;
    timestamp: Date;
    metadata?: Record<string, any>;
}

/**
 * Hedera blockchain extensions for swap targeting operations
 * Requirements: 5.4, 5.5, 5.6, 8.4, 8.5
 */
export class TargetingHederaExtensions {
    constructor(private hederaService: HederaService) { }

    /**
     * Record targeting creation on blockchain
     * Requirements: 5.4, 5.5, 8.4
     */
    async recordTargetingCreation(data: TargetingCreationData): Promise<string> {
        try {
            logger.info('Recording targeting creation on blockchain', {
                targetingId: data.targetingId,
                sourceSwapId: data.sourceSwapId,
                targetSwapId: data.targetSwapId,
                proposalId: data.proposalId
            });

            const transactionData: TransactionData = {
                type: 'targeting_created',
                payload: {
                    targetingId: data.targetingId,
                    sourceSwapId: data.sourceSwapId,
                    targetSwapId: data.targetSwapId,
                    proposalId: data.proposalId,
                    userId: data.userId,
                    timestamp: data.timestamp.toISOString(),
                    metadata: data.metadata || {},
                    eventType: 'targeting_creation',
                    version: '1.0'
                },
                timestamp: data.timestamp
            };

            const result = await this.hederaService.submitTransaction(transactionData);

            logger.info('Targeting creation recorded on blockchain', {
                targetingId: data.targetingId,
                transactionId: result.transactionId,
                consensusTimestamp: result.consensusTimestamp
            });

            return result.transactionId;
        } catch (error) {
            logger.error('Failed to record targeting creation on blockchain', {
                error,
                targetingId: data.targetingId,
                sourceSwapId: data.sourceSwapId,
                targetSwapId: data.targetSwapId
            });
            throw new Error(`Blockchain targeting creation recording failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Record targeting retarget operation on blockchain
     * Requirements: 5.4, 5.5, 8.4
     */
    async recordTargetingRetarget(data: TargetingRetargetData): Promise<string> {
        try {
            logger.info('Recording targeting retarget on blockchain', {
                targetingId: data.targetingId,
                sourceSwapId: data.sourceSwapId,
                previousTargetSwapId: data.previousTargetSwapId,
                newTargetSwapId: data.newTargetSwapId
            });

            const transactionData: TransactionData = {
                type: 'targeting_retargeted',
                payload: {
                    targetingId: data.targetingId,
                    sourceSwapId: data.sourceSwapId,
                    previousTargetSwapId: data.previousTargetSwapId,
                    newTargetSwapId: data.newTargetSwapId,
                    previousProposalId: data.previousProposalId,
                    newProposalId: data.newProposalId,
                    userId: data.userId,
                    timestamp: data.timestamp.toISOString(),
                    reason: data.reason,
                    metadata: data.metadata || {},
                    eventType: 'targeting_retarget',
                    version: '1.0'
                },
                timestamp: data.timestamp
            };

            const result = await this.hederaService.submitTransaction(transactionData);

            logger.info('Targeting retarget recorded on blockchain', {
                targetingId: data.targetingId,
                transactionId: result.transactionId,
                consensusTimestamp: result.consensusTimestamp
            });

            return result.transactionId;
        } catch (error) {
            logger.error('Failed to record targeting retarget on blockchain', {
                error,
                targetingId: data.targetingId,
                sourceSwapId: data.sourceSwapId
            });
            throw new Error(`Blockchain targeting retarget recording failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Record targeting removal on blockchain
     * Requirements: 5.4, 5.5, 8.4
     */
    async recordTargetingRemoval(data: TargetingRemovalData): Promise<string> {
        try {
            logger.info('Recording targeting removal on blockchain', {
                targetingId: data.targetingId,
                sourceSwapId: data.sourceSwapId,
                targetSwapId: data.targetSwapId
            });

            const transactionData: TransactionData = {
                type: 'targeting_removed',
                payload: {
                    targetingId: data.targetingId,
                    sourceSwapId: data.sourceSwapId,
                    targetSwapId: data.targetSwapId,
                    proposalId: data.proposalId,
                    userId: data.userId,
                    timestamp: data.timestamp.toISOString(),
                    reason: data.reason,
                    metadata: data.metadata || {},
                    eventType: 'targeting_removal',
                    version: '1.0'
                },
                timestamp: data.timestamp
            };

            const result = await this.hederaService.submitTransaction(transactionData);

            logger.info('Targeting removal recorded on blockchain', {
                targetingId: data.targetingId,
                transactionId: result.transactionId,
                consensusTimestamp: result.consensusTimestamp
            });

            return result.transactionId;
        } catch (error) {
            logger.error('Failed to record targeting removal on blockchain', {
                error,
                targetingId: data.targetingId,
                sourceSwapId: data.sourceSwapId
            });
            throw new Error(`Blockchain targeting removal recording failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Record targeting status change on blockchain
     * Requirements: 5.4, 5.5, 8.4
     */
    async recordTargetingStatusChange(data: TargetingStatusChangeData): Promise<string> {
        try {
            logger.info('Recording targeting status change on blockchain', {
                targetingId: data.targetingId,
                previousStatus: data.previousStatus,
                newStatus: data.newStatus
            });

            const transactionData: TransactionData = {
                type: 'targeting_status_changed',
                payload: {
                    targetingId: data.targetingId,
                    sourceSwapId: data.sourceSwapId,
                    targetSwapId: data.targetSwapId,
                    proposalId: data.proposalId,
                    previousStatus: data.previousStatus,
                    newStatus: data.newStatus,
                    userId: data.userId,
                    timestamp: data.timestamp.toISOString(),
                    reason: data.reason,
                    metadata: data.metadata || {},
                    eventType: 'targeting_status_change',
                    version: '1.0'
                },
                timestamp: data.timestamp
            };

            const result = await this.hederaService.submitTransaction(transactionData);

            logger.info('Targeting status change recorded on blockchain', {
                targetingId: data.targetingId,
                transactionId: result.transactionId,
                consensusTimestamp: result.consensusTimestamp
            });

            return result.transactionId;
        } catch (error) {
            logger.error('Failed to record targeting status change on blockchain', {
                error,
                targetingId: data.targetingId
            });
            throw new Error(`Blockchain targeting status change recording failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Record targeting verification on blockchain
     * Requirements: 5.5, 5.6, 8.4, 8.5
     */
    async recordTargetingVerification(data: TargetingVerificationData): Promise<string> {
        try {
            logger.info('Recording targeting verification on blockchain', {
                targetingId: data.targetingId,
                verificationResult: data.verificationResult,
                verifiedBy: data.verifiedBy
            });

            const transactionData: TransactionData = {
                type: 'targeting_verified',
                payload: {
                    targetingId: data.targetingId,
                    sourceSwapId: data.sourceSwapId,
                    targetSwapId: data.targetSwapId,
                    proposalId: data.proposalId,
                    verificationResult: data.verificationResult,
                    verificationDetails: data.verificationDetails,
                    verifiedBy: data.verifiedBy,
                    timestamp: data.timestamp.toISOString(),
                    metadata: data.metadata || {},
                    eventType: 'targeting_verification',
                    version: '1.0'
                },
                timestamp: data.timestamp
            };

            const result = await this.hederaService.submitTransaction(transactionData);

            logger.info('Targeting verification recorded on blockchain', {
                targetingId: data.targetingId,
                transactionId: result.transactionId,
                consensusTimestamp: result.consensusTimestamp
            });

            return result.transactionId;
        } catch (error) {
            logger.error('Failed to record targeting verification on blockchain', {
                error,
                targetingId: data.targetingId
            });
            throw new Error(`Blockchain targeting verification recording failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Record targeting dispute on blockchain
     * Requirements: 5.6, 5.7, 8.5
     */
    async recordTargetingDispute(data: TargetingDisputeData): Promise<string> {
        try {
            logger.info('Recording targeting dispute on blockchain', {
                disputeId: data.disputeId,
                targetingId: data.targetingId,
                disputeType: data.disputeType,
                reportedBy: data.reportedBy
            });

            const transactionData: TransactionData = {
                type: 'targeting_dispute_reported',
                payload: {
                    disputeId: data.disputeId,
                    targetingId: data.targetingId,
                    sourceSwapId: data.sourceSwapId,
                    targetSwapId: data.targetSwapId,
                    proposalId: data.proposalId,
                    disputeType: data.disputeType,
                    disputeReason: data.disputeReason,
                    reportedBy: data.reportedBy,
                    evidenceHash: data.evidenceHash,
                    timestamp: data.timestamp.toISOString(),
                    metadata: data.metadata || {},
                    eventType: 'targeting_dispute',
                    version: '1.0'
                },
                timestamp: data.timestamp
            };

            const result = await this.hederaService.submitTransaction(transactionData);

            logger.info('Targeting dispute recorded on blockchain', {
                disputeId: data.disputeId,
                targetingId: data.targetingId,
                transactionId: result.transactionId,
                consensusTimestamp: result.consensusTimestamp
            });

            return result.transactionId;
        } catch (error) {
            logger.error('Failed to record targeting dispute on blockchain', {
                error,
                disputeId: data.disputeId,
                targetingId: data.targetingId
            });
            throw new Error(`Blockchain targeting dispute recording failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Record targeting acceptance on blockchain
     * Requirements: 5.4, 5.5, 8.4
     */
    async recordTargetingAcceptance(
        targetingId: string,
        sourceSwapId: string,
        targetSwapId: string,
        proposalId: string,
        acceptedBy: string,
        acceptedAt: Date
    ): Promise<string> {
        try {
            logger.info('Recording targeting acceptance on blockchain', {
                targetingId,
                sourceSwapId,
                targetSwapId,
                acceptedBy
            });

            const transactionData: TransactionData = {
                type: 'targeting_accepted',
                payload: {
                    targetingId,
                    sourceSwapId,
                    targetSwapId,
                    proposalId,
                    acceptedBy,
                    acceptedAt: acceptedAt.toISOString(),
                    eventType: 'targeting_acceptance',
                    version: '1.0'
                },
                timestamp: acceptedAt
            };

            const result = await this.hederaService.submitTransaction(transactionData);

            logger.info('Targeting acceptance recorded on blockchain', {
                targetingId,
                transactionId: result.transactionId,
                consensusTimestamp: result.consensusTimestamp
            });

            return result.transactionId;
        } catch (error) {
            logger.error('Failed to record targeting acceptance on blockchain', {
                error,
                targetingId,
                sourceSwapId,
                targetSwapId
            });
            throw new Error(`Blockchain targeting acceptance recording failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Record targeting rejection on blockchain
     * Requirements: 5.4, 5.5, 8.4
     */
    async recordTargetingRejection(
        targetingId: string,
        sourceSwapId: string,
        targetSwapId: string,
        proposalId: string,
        rejectedBy: string,
        rejectedAt: Date,
        reason?: string
    ): Promise<string> {
        try {
            logger.info('Recording targeting rejection on blockchain', {
                targetingId,
                sourceSwapId,
                targetSwapId,
                rejectedBy,
                reason
            });

            const transactionData: TransactionData = {
                type: 'targeting_rejected',
                payload: {
                    targetingId,
                    sourceSwapId,
                    targetSwapId,
                    proposalId,
                    rejectedBy,
                    rejectedAt: rejectedAt.toISOString(),
                    reason,
                    eventType: 'targeting_rejection',
                    version: '1.0'
                },
                timestamp: rejectedAt
            };

            const result = await this.hederaService.submitTransaction(transactionData);

            logger.info('Targeting rejection recorded on blockchain', {
                targetingId,
                transactionId: result.transactionId,
                consensusTimestamp: result.consensusTimestamp
            });

            return result.transactionId;
        } catch (error) {
            logger.error('Failed to record targeting rejection on blockchain', {
                error,
                targetingId,
                sourceSwapId,
                targetSwapId
            });
            throw new Error(`Blockchain targeting rejection recording failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Record targeting expiration on blockchain
     * Requirements: 5.4, 5.5, 8.4
     */
    async recordTargetingExpiration(
        targetingId: string,
        sourceSwapId: string,
        targetSwapId: string,
        proposalId: string,
        expiredAt: Date
    ): Promise<string> {
        try {
            logger.info('Recording targeting expiration on blockchain', {
                targetingId,
                sourceSwapId,
                targetSwapId,
                expiredAt
            });

            const transactionData: TransactionData = {
                type: 'targeting_expired',
                payload: {
                    targetingId,
                    sourceSwapId,
                    targetSwapId,
                    proposalId,
                    expiredAt: expiredAt.toISOString(),
                    eventType: 'targeting_expiration',
                    version: '1.0'
                },
                timestamp: expiredAt
            };

            const result = await this.hederaService.submitTransaction(transactionData);

            logger.info('Targeting expiration recorded on blockchain', {
                targetingId,
                transactionId: result.transactionId,
                consensusTimestamp: result.consensusTimestamp
            });

            return result.transactionId;
        } catch (error) {
            logger.error('Failed to record targeting expiration on blockchain', {
                error,
                targetingId,
                sourceSwapId,
                targetSwapId
            });
            throw new Error(`Blockchain targeting expiration recording failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}