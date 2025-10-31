import { HederaService, TransactionData, TransactionResult } from './HederaService';
import { 
  CreateProposalFromBrowseRequest, 
  ProposalMetadata, 
  CompatibilityAnalysis,
  ValidationResult 
} from '@booking-swap/shared';
import { logger } from '../../utils/logger';

export interface BrowseProposalCreationData {
  proposalId: string;
  sourceSwapId: string;
  targetSwapId: string;
  proposerId: string;
  targetOwnerId: string;
  compatibilityScore: number;
  message?: string;
  conditions: string[];
  proposalSource: 'browse';
  createdAt: Date;
}

export interface ProposalStatusChangeData {
  proposalId: string;
  previousStatus: string;
  newStatus: string;
  changedBy: string;
  changedAt: Date;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface CompatibilityAnalysisData {
  sourceSwapId: string;
  targetSwapId: string;
  overallScore: number;
  factors: {
    locationCompatibility: number;
    dateCompatibility: number;
    valueCompatibility: number;
    accommodationCompatibility: number;
    guestCompatibility: number;
  };
  analysisTimestamp: Date;
  requestedBy: string;
}

export interface ProposalVerificationData {
  proposalId: string;
  sourceSwapId: string;
  targetSwapId: string;
  proposerId: string;
  verificationChecks: {
    userOwnsSourceSwap: boolean;
    sourceSwapAvailable: boolean;
    targetSwapAvailable: boolean;
    noExistingProposal: boolean;
    swapsAreCompatible: boolean;
  };
  verificationTimestamp: Date;
  isValid: boolean;
}

export interface DisputeResolutionData {
  proposalId: string;
  disputeId: string;
  disputeType: 'authenticity' | 'compatibility' | 'terms' | 'fraud';
  resolution: 'proposal_valid' | 'proposal_invalid' | 'partial_resolution' | 'escalated';
  resolvedBy: string;
  resolvedAt: Date;
  evidence: string[];
  outcome: string;
}

/**
 * Extension of HederaService with swap matching proposal-specific blockchain operations
 * Requirements: 1.7, 3.4, 3.5, 3.6, 3.7
 */
export class SwapMatchingHederaExtensions {
  constructor(private hederaService: HederaService) {}

  /**
   * Record browse-initiated proposal creation on blockchain
   * Requirements: 1.7, 3.4, 3.5
   */
  async recordBrowseProposalCreation(data: BrowseProposalCreationData): Promise<string> {
    try {
      logger.info('Recording browse proposal creation on blockchain', { 
        proposalId: data.proposalId,
        sourceSwapId: data.sourceSwapId,
        targetSwapId: data.targetSwapId
      });

      const transactionData: TransactionData = {
        type: 'swap_proposal',
        payload: {
          proposalId: data.proposalId,
          sourceSwapId: data.sourceSwapId,
          targetSwapId: data.targetSwapId,
          proposerId: data.proposerId,
          targetOwnerId: data.targetOwnerId,
          compatibilityScore: data.compatibilityScore,
          proposalSource: data.proposalSource,
          hasMessage: !!data.message,
          conditionsCount: data.conditions.length,
          createdAt: data.createdAt.toISOString(),
          metadata: {
            proposalType: 'browse_initiated',
            status: 'pending',
            compatibilityTier: this.getCompatibilityTier(data.compatibilityScore),
            blockchainVersion: '1.0'
          }
        },
        timestamp: new Date()
      };

      const result = await this.hederaService.submitTransaction(transactionData);
      
      logger.info('Browse proposal creation recorded on blockchain', {
        proposalId: data.proposalId,
        transactionId: result.transactionId,
        compatibilityScore: data.compatibilityScore
      });

      return result.transactionId;
    } catch (error) {
      logger.error('Failed to record browse proposal creation on blockchain', { error, data });
      throw error;
    }
  }

  /**
   * Record proposal metadata for audit trail
   * Requirements: 3.4, 3.5, 3.7
   */
  async recordProposalMetadata(metadata: ProposalMetadata): Promise<string> {
    try {
      logger.info('Recording proposal metadata on blockchain', { 
        proposalId: metadata.proposalId 
      });

      const transactionData: TransactionData = {
        type: 'swap_proposal',
        payload: {
          proposalId: metadata.proposalId,
          sourceSwapId: metadata.sourceSwapId,
          targetSwapId: metadata.targetSwapId,
          proposerId: metadata.proposerId,
          targetOwnerId: metadata.targetOwnerId,
          compatibilityScore: metadata.compatibilityScore,
          proposalSource: metadata.proposalSource,
          createdFromBrowse: metadata.createdFromBrowse,
          hasMessage: !!metadata.message,
          originalTransactionId: metadata.blockchainTransactionId,
          metadata: {
            metadataType: 'proposal_metadata',
            recordedAt: new Date().toISOString(),
            compatibilityTier: this.getCompatibilityTier(metadata.compatibilityScore),
            auditTrail: true
          }
        },
        timestamp: new Date()
      };

      const result = await this.hederaService.submitTransaction(transactionData);
      
      logger.info('Proposal metadata recorded on blockchain', {
        proposalId: metadata.proposalId,
        transactionId: result.transactionId
      });

      return result.transactionId;
    } catch (error) {
      logger.error('Failed to record proposal metadata on blockchain', { error, metadata });
      throw error;
    }
  }

  /**
   * Record compatibility analysis results on blockchain for audit trail
   * Requirements: 3.4, 3.5, 3.7
   */
  async recordCompatibilityAnalysis(data: CompatibilityAnalysisData): Promise<string> {
    try {
      logger.info('Recording compatibility analysis on blockchain', { 
        sourceSwapId: data.sourceSwapId,
        targetSwapId: data.targetSwapId,
        overallScore: data.overallScore
      });

      const transactionData: TransactionData = {
        type: 'swap_proposal',
        payload: {
          sourceSwapId: data.sourceSwapId,
          targetSwapId: data.targetSwapId,
          overallScore: data.overallScore,
          factors: data.factors,
          analysisTimestamp: data.analysisTimestamp.toISOString(),
          requestedBy: data.requestedBy,
          metadata: {
            analysisType: 'compatibility_analysis',
            compatibilityTier: this.getCompatibilityTier(data.overallScore),
            factorCount: Object.keys(data.factors).length,
            auditTrail: true
          }
        },
        timestamp: new Date()
      };

      const result = await this.hederaService.submitTransaction(transactionData);
      
      logger.info('Compatibility analysis recorded on blockchain', {
        sourceSwapId: data.sourceSwapId,
        targetSwapId: data.targetSwapId,
        transactionId: result.transactionId,
        overallScore: data.overallScore
      });

      return result.transactionId;
    } catch (error) {
      logger.error('Failed to record compatibility analysis on blockchain', { error, data });
      throw error;
    }
  }

  /**
   * Record proposal status changes on blockchain for lifecycle tracking
   * Requirements: 3.4, 3.5, 3.6, 3.7
   */
  async recordProposalStatusChange(data: ProposalStatusChangeData): Promise<string> {
    try {
      logger.info('Recording proposal status change on blockchain', { 
        proposalId: data.proposalId,
        previousStatus: data.previousStatus,
        newStatus: data.newStatus
      });

      const transactionData: TransactionData = {
        type: this.getStatusChangeTransactionType(data.newStatus),
        payload: {
          proposalId: data.proposalId,
          previousStatus: data.previousStatus,
          newStatus: data.newStatus,
          changedBy: data.changedBy,
          changedAt: data.changedAt.toISOString(),
          reason: data.reason,
          metadata: {
            ...data.metadata,
            statusChangeType: 'proposal_lifecycle',
            auditTrail: true,
            blockchainVersion: '1.0'
          }
        },
        timestamp: new Date()
      };

      const result = await this.hederaService.submitTransaction(transactionData);
      
      logger.info('Proposal status change recorded on blockchain', {
        proposalId: data.proposalId,
        newStatus: data.newStatus,
        transactionId: result.transactionId
      });

      return result.transactionId;
    } catch (error) {
      logger.error('Failed to record proposal status change on blockchain', { error, data });
      throw error;
    }
  }

  /**
   * Record proposal verification results for authenticity checking
   * Requirements: 3.4, 3.5, 3.6
   */
  async recordProposalVerification(data: ProposalVerificationData): Promise<string> {
    try {
      logger.info('Recording proposal verification on blockchain', { 
        proposalId: data.proposalId,
        isValid: data.isValid
      });

      const transactionData: TransactionData = {
        type: 'swap_proposal',
        payload: {
          proposalId: data.proposalId,
          sourceSwapId: data.sourceSwapId,
          targetSwapId: data.targetSwapId,
          proposerId: data.proposerId,
          verificationChecks: data.verificationChecks,
          verificationTimestamp: data.verificationTimestamp.toISOString(),
          isValid: data.isValid,
          metadata: {
            verificationType: 'proposal_verification',
            checksPerformed: Object.keys(data.verificationChecks).length,
            validationResult: data.isValid ? 'valid' : 'invalid',
            auditTrail: true
          }
        },
        timestamp: new Date()
      };

      const result = await this.hederaService.submitTransaction(transactionData);
      
      logger.info('Proposal verification recorded on blockchain', {
        proposalId: data.proposalId,
        isValid: data.isValid,
        transactionId: result.transactionId
      });

      return result.transactionId;
    } catch (error) {
      logger.error('Failed to record proposal verification on blockchain', { error, data });
      throw error;
    }
  }

  /**
   * Record dispute resolution data for proposal disputes
   * Requirements: 3.4, 3.5, 3.6, 3.7
   */
  async recordDisputeResolution(data: DisputeResolutionData): Promise<string> {
    try {
      logger.info('Recording dispute resolution on blockchain', { 
        proposalId: data.proposalId,
        disputeId: data.disputeId,
        resolution: data.resolution
      });

      const transactionData: TransactionData = {
        type: 'swap_proposal',
        payload: {
          proposalId: data.proposalId,
          disputeId: data.disputeId,
          disputeType: data.disputeType,
          resolution: data.resolution,
          resolvedBy: data.resolvedBy,
          resolvedAt: data.resolvedAt.toISOString(),
          evidenceCount: data.evidence.length,
          outcome: data.outcome,
          metadata: {
            disputeResolutionType: 'proposal_dispute',
            disputeCategory: data.disputeType,
            resolutionStatus: data.resolution,
            auditTrail: true,
            blockchainVersion: '1.0'
          }
        },
        timestamp: new Date()
      };

      const result = await this.hederaService.submitTransaction(transactionData);
      
      logger.info('Dispute resolution recorded on blockchain', {
        proposalId: data.proposalId,
        disputeId: data.disputeId,
        resolution: data.resolution,
        transactionId: result.transactionId
      });

      return result.transactionId;
    } catch (error) {
      logger.error('Failed to record dispute resolution on blockchain', { error, data });
      throw error;
    }
  }

  /**
   * Record proposal expiration event
   * Requirements: 3.4, 3.5, 3.7
   */
  async recordProposalExpiration(proposalId: string, expiredAt: Date): Promise<string> {
    try {
      logger.info('Recording proposal expiration on blockchain', { 
        proposalId,
        expiredAt
      });

      const transactionData: TransactionData = {
        type: 'swap_proposal_expired',
        payload: {
          proposalId,
          expiredAt: expiredAt.toISOString(),
          metadata: {
            expirationReason: 'timeout',
            auditTrail: true,
            blockchainVersion: '1.0'
          }
        },
        timestamp: new Date()
      };

      const result = await this.hederaService.submitTransaction(transactionData);
      
      logger.info('Proposal expiration recorded on blockchain', {
        proposalId,
        transactionId: result.transactionId
      });

      return result.transactionId;
    } catch (error) {
      logger.error('Failed to record proposal expiration on blockchain', { error, proposalId });
      throw error;
    }
  }

  /**
   * Record proposal acceptance event
   * Requirements: 3.4, 3.5, 3.7
   */
  async recordProposalAcceptance(proposalId: string, acceptedBy: string, acceptedAt: Date): Promise<string> {
    try {
      logger.info('Recording proposal acceptance on blockchain', { 
        proposalId,
        acceptedBy
      });

      const transactionData: TransactionData = {
        type: 'swap_proposal_accepted',
        payload: {
          proposalId,
          acceptedBy,
          acceptedAt: acceptedAt.toISOString(),
          metadata: {
            acceptanceType: 'manual',
            auditTrail: true,
            blockchainVersion: '1.0'
          }
        },
        timestamp: new Date()
      };

      const result = await this.hederaService.submitTransaction(transactionData);
      
      logger.info('Proposal acceptance recorded on blockchain', {
        proposalId,
        transactionId: result.transactionId
      });

      return result.transactionId;
    } catch (error) {
      logger.error('Failed to record proposal acceptance on blockchain', { error, proposalId });
      throw error;
    }
  }

  /**
   * Record proposal rejection event
   * Requirements: 3.4, 3.5, 3.7
   */
  async recordProposalRejection(proposalId: string, rejectedBy: string, rejectedAt: Date, reason?: string): Promise<string> {
    try {
      logger.info('Recording proposal rejection on blockchain', { 
        proposalId,
        rejectedBy,
        reason
      });

      const transactionData: TransactionData = {
        type: 'swap_proposal_rejected',
        payload: {
          proposalId,
          rejectedBy,
          rejectedAt: rejectedAt.toISOString(),
          reason,
          metadata: {
            rejectionType: 'manual',
            hasReason: !!reason,
            auditTrail: true,
            blockchainVersion: '1.0'
          }
        },
        timestamp: new Date()
      };

      const result = await this.hederaService.submitTransaction(transactionData);
      
      logger.info('Proposal rejection recorded on blockchain', {
        proposalId,
        transactionId: result.transactionId
      });

      return result.transactionId;
    } catch (error) {
      logger.error('Failed to record proposal rejection on blockchain', { error, proposalId });
      throw error;
    }
  }

  /**
   * Get compatibility tier based on score for categorization
   */
  private getCompatibilityTier(score: number): string {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    return 'poor';
  }

  /**
   * Get appropriate transaction type based on status change
   */
  private getStatusChangeTransactionType(newStatus: string): TransactionData['type'] {
    switch (newStatus) {
      case 'accepted':
        return 'swap_proposal_accepted';
      case 'rejected':
        return 'swap_proposal_rejected';
      case 'cancelled':
        return 'swap_proposal_cancelled';
      case 'expired':
        return 'swap_proposal_expired';
      default:
        return 'swap_proposal';
    }
  }
}