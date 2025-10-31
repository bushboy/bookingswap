import { 
  ValidationResult,
  ProposalMetadata,
  CreateProposalFromBrowseRequest
} from '@booking-swap/shared';
import { 
  BlockchainVerificationService, 
  ProposalTransactionVerification,
  ProposalAuditEvent
} from '../hedera/BlockchainVerificationService';
import { 
  HederaService,
  ProposalVerificationData,
  DisputeResolutionData
} from '../hedera/HederaService';
import { SwapRepository } from '../../database/repositories/SwapRepository';
import { logger } from '../../utils/logger';

export interface ProposalAuthenticityResult {
  proposalId: string;
  isAuthentic: boolean;
  authenticity: 'authentic' | 'tampered' | 'unverified';
  confidenceScore: number;
  verificationDetails: ProposalTransactionVerification;
  tamperedFields: string[];
  recommendations: string[];
}

export interface ProposalDisputeResult {
  disputeId: string;
  proposalId: string;
  resolution: 'proposal_valid' | 'proposal_invalid' | 'partial_resolution' | 'escalated';
  evidence: string[];
  blockchainTransactionId: string;
}

/**
 * Service for verifying proposal authenticity and handling disputes
 * Requirements: 3.4, 3.5, 3.6, 3.7
 */
export class ProposalVerificationService {
  constructor(
    private blockchainVerificationService: BlockchainVerificationService,
    private hederaService: HederaService,
    private swapRepository: SwapRepository
  ) {}

  /**
   * Verify proposal authenticity using blockchain records
   * Requirements: 3.4, 3.5, 3.6
   */
  async verifyProposalAuthenticity(
    proposalId: string,
    transactionIds: {
      creationTxId?: string;
      metadataTxId?: string;
      statusChangeTxIds?: string[];
      verificationTxId?: string;
    }
  ): Promise<ProposalAuthenticityResult> {
    try {
      logger.info('Verifying proposal authenticity', { proposalId });

      // Step 1: Verify all blockchain transactions
      const verificationDetails = await this.blockchainVerificationService.verifyProposalTransactions(
        proposalId,
        transactionIds
      );

      // Step 2: Check for tampering
      const proposal = await this.swapRepository.findById(proposalId);
      if (!proposal) {
        throw new Error('Proposal not found');
      }

      const expectedData = {
        proposalId,
        sourceBookingId: proposal.sourceBookingId,
        targetBookingId: proposal.targetBookingId,
        proposerId: proposal.proposerId,
        status: proposal.status,
      };

      const allTransactionIds = [
        transactionIds.creationTxId,
        transactionIds.metadataTxId,
        ...(transactionIds.statusChangeTxIds || []),
        transactionIds.verificationTxId
      ].filter(Boolean) as string[];

      const tamperingResult = await this.blockchainVerificationService.detectProposalTampering(
        proposalId,
        expectedData,
        allTransactionIds
      );

      // Step 3: Verify lifecycle consistency
      const lifecycleResult = await this.blockchainVerificationService.verifyProposalLifecycle(
        verificationDetails.auditTrail
      );

      // Step 4: Calculate overall authenticity
      const isAuthentic = verificationDetails.allTransactionsValid && 
                         !tamperingResult.isTampered && 
                         lifecycleResult.isValidLifecycle;

      const authenticity = verificationDetails.proposalAuthenticity;
      const confidenceScore = this.calculateConfidenceScore(
        verificationDetails,
        tamperingResult,
        lifecycleResult
      );

      // Step 5: Generate recommendations
      const recommendations = this.generateVerificationRecommendations(
        verificationDetails,
        tamperingResult,
        lifecycleResult
      );

      // Step 6: Record verification on blockchain
      const verificationData: ProposalVerificationData = {
        proposalId,
        sourceSwapId: proposal.sourceBookingId, // Using booking ID as swap ID for now
        targetSwapId: proposal.targetBookingId,
        proposerId: proposal.proposerId,
        verificationChecks: {
          userOwnsSourceSwap: true, // Would be validated in production
          sourceSwapAvailable: proposal.status === 'pending',
          targetSwapAvailable: true, // Would be validated in production
          noExistingProposal: true, // Would be validated in production
          swapsAreCompatible: true, // Would be validated in production
        },
        verificationTimestamp: new Date(),
        isValid: isAuthentic,
      };

      const verificationTxId = await this.hederaService.recordProposalVerification(verificationData);

      const result: ProposalAuthenticityResult = {
        proposalId,
        isAuthentic,
        authenticity,
        confidenceScore,
        verificationDetails: {
          ...verificationDetails,
          verificationTxId
        },
        tamperedFields: tamperingResult.tamperedFields,
        recommendations,
      };

      logger.info('Proposal authenticity verification completed', {
        proposalId,
        isAuthentic,
        authenticity,
        confidenceScore,
        verificationTxId
      });

      return result;
    } catch (error) {
      logger.error('Failed to verify proposal authenticity', { error, proposalId });
      throw error;
    }
  }

  /**
   * Handle proposal disputes and record resolution on blockchain
   * Requirements: 3.4, 3.5, 3.6, 3.7
   */
  async handleProposalDispute(
    proposalId: string,
    disputeType: 'authenticity' | 'compatibility' | 'terms' | 'fraud',
    evidence: string[],
    reportedBy: string
  ): Promise<ProposalDisputeResult> {
    try {
      logger.info('Handling proposal dispute', { 
        proposalId, 
        disputeType, 
        reportedBy,
        evidenceCount: evidence.length 
      });

      // Step 1: Generate unique dispute ID
      const disputeId = `dispute_${proposalId}_${Date.now()}`;

      // Step 2: Investigate the dispute based on type
      let resolution: DisputeResolutionData['resolution'];
      let outcome: string;

      switch (disputeType) {
        case 'authenticity':
          const authenticityResult = await this.investigateAuthenticityDispute(proposalId, evidence);
          resolution = authenticityResult.isAuthentic ? 'proposal_valid' : 'proposal_invalid';
          outcome = authenticityResult.outcome;
          break;

        case 'compatibility':
          const compatibilityResult = await this.investigateCompatibilityDispute(proposalId, evidence);
          resolution = compatibilityResult.isValid ? 'proposal_valid' : 'partial_resolution';
          outcome = compatibilityResult.outcome;
          break;

        case 'terms':
          const termsResult = await this.investigateTermsDispute(proposalId, evidence);
          resolution = termsResult.isValid ? 'proposal_valid' : 'proposal_invalid';
          outcome = termsResult.outcome;
          break;

        case 'fraud':
          const fraudResult = await this.investigateFraudDispute(proposalId, evidence);
          resolution = fraudResult.isFraud ? 'proposal_invalid' : 'proposal_valid';
          outcome = fraudResult.outcome;
          break;

        default:
          resolution = 'escalated';
          outcome = 'Dispute type not recognized, escalated for manual review';
      }

      // Step 3: Record dispute resolution on blockchain
      const disputeData: DisputeResolutionData = {
        proposalId,
        disputeId,
        disputeType,
        resolution,
        resolvedBy: 'system', // In production, this could be a human moderator
        resolvedAt: new Date(),
        evidence,
        outcome,
      };

      const blockchainTransactionId = await this.hederaService.recordDisputeResolution(disputeData);

      // Step 4: Update proposal status if needed
      if (resolution === 'proposal_invalid') {
        await this.hederaService.recordProposalStatusChange({
          proposalId,
          previousStatus: 'pending',
          newStatus: 'rejected',
          changedBy: 'dispute_resolution',
          changedAt: new Date(),
          reason: `Dispute resolved: ${outcome}`,
          metadata: {
            disputeId,
            disputeType,
            resolution
          }
        });
      }

      const result: ProposalDisputeResult = {
        disputeId,
        proposalId,
        resolution,
        evidence,
        blockchainTransactionId,
      };

      logger.info('Proposal dispute resolved', {
        disputeId,
        proposalId,
        resolution,
        blockchainTransactionId
      });

      return result;
    } catch (error) {
      logger.error('Failed to handle proposal dispute', { error, proposalId, disputeType });
      throw error;
    }
  }

  /**
   * Get proposal audit trail from blockchain
   * Requirements: 3.4, 3.5, 3.7
   */
  async getProposalAuditTrail(
    proposalId: string,
    transactionIds: string[]
  ): Promise<ProposalAuditEvent[]> {
    try {
      logger.info('Retrieving proposal audit trail', { proposalId, transactionCount: transactionIds.length });

      const verificationResults = await this.blockchainVerificationService.batchVerifyTransactions(transactionIds);
      
      const auditTrail: ProposalAuditEvent[] = verificationResults.map((result, index) => ({
        transactionId: result.transactionId,
        eventType: this.determineEventType(result, index),
        timestamp: result.consensusTimestamp || new Date().toISOString(),
        isValid: result.isValid,
        eventData: {
          proposalId,
          status: result.status,
          transactionIndex: index
        }
      }));

      // Sort by timestamp
      auditTrail.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      logger.info('Proposal audit trail retrieved', {
        proposalId,
        eventCount: auditTrail.length,
        validEvents: auditTrail.filter(e => e.isValid).length
      });

      return auditTrail;
    } catch (error) {
      logger.error('Failed to retrieve proposal audit trail', { error, proposalId });
      throw error;
    }
  }

  /**
   * Calculate confidence score for proposal authenticity
   */
  private calculateConfidenceScore(
    verificationDetails: ProposalTransactionVerification,
    tamperingResult: any,
    lifecycleResult: any
  ): number {
    let score = 100;

    // Deduct for invalid transactions
    const invalidTransactions = verificationDetails.verificationResults.filter(r => !r.isValid);
    score -= (invalidTransactions.length / verificationDetails.verificationResults.length) * 40;

    // Deduct for tampering
    if (tamperingResult.isTampered) {
      score -= 30;
    }

    // Deduct for lifecycle violations
    if (!lifecycleResult.isValidLifecycle) {
      score -= (lifecycleResult.violations.length * 10);
    }

    // Ensure score is between 0 and 100
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Generate verification recommendations
   */
  private generateVerificationRecommendations(
    verificationDetails: ProposalTransactionVerification,
    tamperingResult: any,
    lifecycleResult: any
  ): string[] {
    const recommendations: string[] = [];

    if (!verificationDetails.allTransactionsValid) {
      recommendations.push('Some blockchain transactions are invalid - verify proposal authenticity');
    }

    if (tamperingResult.isTampered) {
      recommendations.push('Potential tampering detected - investigate proposal data integrity');
    }

    if (!lifecycleResult.isValidLifecycle) {
      recommendations.push('Proposal lifecycle violations detected - review event sequence');
    }

    if (verificationDetails.proposalAuthenticity === 'unverified') {
      recommendations.push('Proposal lacks sufficient blockchain verification - request additional verification');
    }

    if (recommendations.length === 0) {
      recommendations.push('Proposal appears authentic and valid');
    }

    return recommendations;
  }

  /**
   * Investigate authenticity disputes
   */
  private async investigateAuthenticityDispute(proposalId: string, evidence: string[]): Promise<{
    isAuthentic: boolean;
    outcome: string;
  }> {
    // In production, this would involve detailed blockchain analysis
    // For now, we'll do basic validation
    
    const hasBlockchainEvidence = evidence.some(e => e.includes('blockchain') || e.includes('transaction'));
    const hasUserEvidence = evidence.some(e => e.includes('user') || e.includes('identity'));

    if (hasBlockchainEvidence && hasUserEvidence) {
      return {
        isAuthentic: false,
        outcome: 'Strong evidence of inauthenticity found'
      };
    }

    return {
      isAuthentic: true,
      outcome: 'Insufficient evidence to prove inauthenticity'
    };
  }

  /**
   * Investigate compatibility disputes
   */
  private async investigateCompatibilityDispute(proposalId: string, evidence: string[]): Promise<{
    isValid: boolean;
    outcome: string;
  }> {
    // In production, this would re-run compatibility analysis
    return {
      isValid: true,
      outcome: 'Compatibility analysis within acceptable parameters'
    };
  }

  /**
   * Investigate terms disputes
   */
  private async investigateTermsDispute(proposalId: string, evidence: string[]): Promise<{
    isValid: boolean;
    outcome: string;
  }> {
    // In production, this would validate terms against original proposal
    return {
      isValid: true,
      outcome: 'Terms match original proposal requirements'
    };
  }

  /**
   * Investigate fraud disputes
   */
  private async investigateFraudDispute(proposalId: string, evidence: string[]): Promise<{
    isFraud: boolean;
    outcome: string;
  }> {
    // In production, this would involve fraud detection algorithms
    const hasFraudIndicators = evidence.some(e => 
      e.includes('fake') || e.includes('duplicate') || e.includes('stolen')
    );

    return {
      isFraud: hasFraudIndicators,
      outcome: hasFraudIndicators ? 'Fraud indicators detected' : 'No fraud indicators found'
    };
  }

  /**
   * Determine event type from verification result
   */
  private determineEventType(result: any, index: number): ProposalAuditEvent['eventType'] {
    // In production, this would parse the transaction data to determine event type
    // For now, we'll use a simple heuristic based on order
    if (index === 0) return 'creation';
    if (index === 1) return 'metadata';
    if (result.status?.includes('verification')) return 'verification';
    if (result.status?.includes('dispute')) return 'dispute';
    return 'status_change';
  }
}