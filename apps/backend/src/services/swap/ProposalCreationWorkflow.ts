import {
  CreateProposalFromBrowseRequest,
  SwapProposalResult,
  ValidationResult,
  ProposalValidationError,
  ProposalMetadata
} from '@booking-swap/shared';
import { SwapRepository } from '../../database/repositories/SwapRepository';
import { BookingService } from '../booking/BookingService';
import { SwapProposalService, CreateSwapProposalRequest } from './SwapProposalService';
import { SwapMatchingService } from './SwapMatchingService';
import { HederaService, TransactionData } from '../hedera/HederaService';
import { NotificationService } from '../notification/NotificationService';
import { logger } from '../../utils/logger';

export interface SwapLockInfo {
  swapId: string;
  lockedAt: Date;
  lockedBy: string;
  lockDuration: number; // milliseconds
}

export class ProposalCreationWorkflow {
  private readonly LOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes
  private readonly swapLocks = new Map<string, SwapLockInfo>();

  constructor(
    private swapRepository: SwapRepository,
    private bookingService: BookingService,
    private swapProposalService: SwapProposalService,
    private swapMatchingService: SwapMatchingService,
    private hederaService: HederaService,
    private notificationService: NotificationService
  ) {
    // Clean up expired locks every minute
    setInterval(() => this.cleanupExpiredLocks(), 60 * 1000);
  }

  /**
   * Create proposal from browse page with comprehensive workflow
   * Requirements: 1.1, 1.2, 1.3, 1.6, 1.7
   */
  async createProposalFromBrowse(request: CreateProposalFromBrowseRequest): Promise<SwapProposalResult> {
    const lockIds: string[] = [];
    
    try {
      logger.info('Starting browse proposal creation workflow', {
        targetSwapId: request.targetSwapId,
        sourceSwapId: request.sourceSwapId,
        proposerId: request.proposerId
      });

      // Step 1: Validate the proposal request
      const validation = await this.swapMatchingService.validateProposalEligibility(
        request.proposerId,
        request.sourceSwapId,
        request.targetSwapId
      );

      if (!validation.isValid) {
        throw this.createValidationError(validation, request);
      }

      // Step 2: Lock both swaps to prevent concurrent modifications
      await this.lockSwaps([request.sourceSwapId, request.targetSwapId], request.proposerId);
      lockIds.push(request.sourceSwapId, request.targetSwapId);

      // Step 3: Re-validate after locking (double-check pattern)
      const postLockValidation = await this.swapMatchingService.validateProposalEligibility(
        request.proposerId,
        request.sourceSwapId,
        request.targetSwapId
      );

      if (!postLockValidation.isValid) {
        throw this.createValidationError(postLockValidation, request);
      }

      // Step 4: Get swap and booking details
      const [sourceSwap, targetSwap] = await Promise.all([
        this.swapRepository.findById(request.sourceSwapId),
        this.swapRepository.findById(request.targetSwapId)
      ]);

      if (!sourceSwap || !targetSwap) {
        throw new Error('Unable to retrieve swap details after locking');
      }

      // Step 5: Calculate compatibility score for metadata
      const compatibilityScore = await this.swapMatchingService.getSwapCompatibility(
        request.sourceSwapId,
        request.targetSwapId
      );

      // Step 6: Create traditional swap proposal request
      const swapProposalRequest: CreateSwapProposalRequest = {
        sourceBookingId: sourceSwap.sourceBookingId,
        targetBookingId: targetSwap.sourceBookingId,
        proposerId: request.proposerId,
        terms: {
          additionalPayment: 0,
          conditions: request.conditions,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        },
      };

      // Step 7: Create the swap proposal using existing service
      const proposalResult = await this.swapProposalService.createSwapProposal(swapProposalRequest);

      // Step 8: Record browse-specific metadata and blockchain transaction
      const metadata: ProposalMetadata = {
        proposalId: proposalResult.swap.id,
        sourceSwapId: request.sourceSwapId,
        targetSwapId: request.targetSwapId,
        message: request.message,
        compatibilityScore: compatibilityScore.compatibility.overallScore,
        createdFromBrowse: true,
        proposalSource: 'browse',
        proposerId: request.proposerId,
        targetOwnerId: targetSwap.ownerId,
        blockchainTransactionId: proposalResult.blockchainTransaction.transactionId,
      };

      await this.recordBrowseProposalMetadata(metadata);
      await this.recordBrowseProposalOnBlockchain(metadata);

      // Step 9: Send enhanced notifications for browse proposals
      await this.sendBrowseProposalNotifications(proposalResult.swap, request, compatibilityScore);

      // Step 10: Transform result to match expected interface
      const result: SwapProposalResult = {
        proposalId: proposalResult.swap.id,
        swap: proposalResult.swap,
        status: 'pending_review',
        blockchainTransaction: proposalResult.blockchainTransaction,
        estimatedResponseTime: this.calculateEstimatedResponseTime(compatibilityScore.compatibility.overallScore),
        nextSteps: this.generateNextSteps(compatibilityScore.compatibility.overallScore),
      };

      logger.info('Browse proposal created successfully', {
        proposalId: result.proposalId,
        sourceSwapId: request.sourceSwapId,
        targetSwapId: request.targetSwapId,
        compatibilityScore: compatibilityScore.compatibility.overallScore,
        transactionId: result.blockchainTransaction.transactionId
      });

      return result;
    } catch (error) {
      logger.error('Failed to create proposal from browse', { error, request });
      throw error;
    } finally {
      // Step 11: Always unlock swaps in finally block
      if (lockIds.length > 0) {
        await this.unlockSwaps(lockIds);
      }
    }
  }

  /**
   * Lock swaps to prevent concurrent modifications during proposal creation
   * Requirements: 1.1, 1.2, 1.3
   */
  private async lockSwaps(swapIds: string[], userId: string): Promise<void> {
    try {
      logger.info('Locking swaps for proposal creation', { swapIds, userId });

      for (const swapId of swapIds) {
        // Check if swap is already locked
        const existingLock = this.swapLocks.get(swapId);
        if (existingLock && !this.isLockExpired(existingLock)) {
          throw new Error(`Swap ${swapId} is currently locked by another operation`);
        }

        // Create new lock
        const lockInfo: SwapLockInfo = {
          swapId,
          lockedAt: new Date(),
          lockedBy: userId,
          lockDuration: this.LOCK_DURATION_MS,
        };

        this.swapLocks.set(swapId, lockInfo);
      }

      logger.info('Swaps locked successfully', { swapIds, userId });
    } catch (error) {
      logger.error('Failed to lock swaps', { error, swapIds, userId });
      throw error;
    }
  }

  /**
   * Unlock swaps after proposal creation
   */
  private async unlockSwaps(swapIds: string[]): Promise<void> {
    try {
      logger.info('Unlocking swaps', { swapIds });

      for (const swapId of swapIds) {
        this.swapLocks.delete(swapId);
      }

      logger.info('Swaps unlocked successfully', { swapIds });
    } catch (error) {
      logger.warn('Failed to unlock swaps', { error, swapIds });
      // Don't throw error as this is cleanup
    }
  }

  /**
   * Check if a lock has expired
   */
  private isLockExpired(lock: SwapLockInfo): boolean {
    const now = new Date().getTime();
    const lockExpiry = lock.lockedAt.getTime() + lock.lockDuration;
    return now > lockExpiry;
  }

  /**
   * Clean up expired locks
   */
  private cleanupExpiredLocks(): void {
    const now = new Date().getTime();
    const expiredLocks: string[] = [];

    for (const [swapId, lock] of this.swapLocks.entries()) {
      if (this.isLockExpired(lock)) {
        expiredLocks.push(swapId);
      }
    }

    for (const swapId of expiredLocks) {
      this.swapLocks.delete(swapId);
    }

    if (expiredLocks.length > 0) {
      logger.info('Cleaned up expired swap locks', { expiredLocks });
    }
  }

  /**
   * Create validation error with appropriate error code
   */
  private createValidationError(validation: ValidationResult, request: CreateProposalFromBrowseRequest): ProposalValidationError {
    const error = new Error('Proposal validation failed') as ProposalValidationError;
    error.details = {
      sourceSwapId: request.sourceSwapId,
      targetSwapId: request.targetSwapId,
      userId: request.proposerId,
      reason: validation.errors.join(', ')
    };

    // Determine specific error code based on validation results
    if (!validation.eligibilityChecks.userOwnsSourceSwap) {
      error.code = 'USER_NOT_AUTHORIZED';
    } else if (!validation.eligibilityChecks.sourceSwapAvailable) {
      error.code = 'INVALID_SOURCE_SWAP';
    } else if (!validation.eligibilityChecks.targetSwapAvailable) {
      error.code = 'INVALID_TARGET_SWAP';
    } else if (!validation.eligibilityChecks.noExistingProposal) {
      error.code = 'EXISTING_PROPOSAL';
    } else {
      error.code = 'SWAP_NOT_AVAILABLE';
    }

    return error;
  }

  /**
   * Record browse-specific proposal metadata
   * Requirements: 1.6, 1.7
   */
  private async recordBrowseProposalMetadata(metadata: ProposalMetadata): Promise<void> {
    try {
      logger.info('Recording browse proposal metadata', { 
        proposalId: metadata.proposalId,
        compatibilityScore: metadata.compatibilityScore 
      });

      // In a production system, this would store metadata in a dedicated table
      // For now, we'll log it for tracking purposes
      // TODO: Implement actual metadata storage if needed for analytics or features
      
      logger.info('Browse proposal metadata recorded', metadata);
    } catch (error) {
      logger.warn('Failed to record browse proposal metadata', { error, metadata });
      // Don't throw error as this is not critical for proposal creation
    }
  }

  /**
   * Record browse proposal on blockchain for audit trail
   * Requirements: 1.7, 3.4, 3.5, 3.6, 3.7
   */
  private async recordBrowseProposalOnBlockchain(metadata: ProposalMetadata): Promise<void> {
    try {
      logger.info('Recording browse proposal on blockchain', { 
        proposalId: metadata.proposalId 
      });

      // Record browse proposal creation using new Hedera extensions
      const browseProposalData = {
        proposalId: metadata.proposalId,
        sourceSwapId: metadata.sourceSwapId,
        targetSwapId: metadata.targetSwapId,
        proposerId: metadata.proposerId,
        targetOwnerId: metadata.targetOwnerId,
        compatibilityScore: metadata.compatibilityScore,
        message: metadata.message,
        conditions: [], // Would be passed from request in production
        proposalSource: 'browse' as const,
        createdAt: new Date(),
      };

      const creationTxId = await this.hederaService.recordBrowseProposalCreation(browseProposalData);
      
      // Record proposal metadata separately for audit trail
      const metadataTxId = await this.hederaService.recordProposalMetadata(metadata);
      
      logger.info('Browse proposal recorded on blockchain', {
        proposalId: metadata.proposalId,
        creationTxId,
        metadataTxId
      });
    } catch (error) {
      logger.warn('Failed to record browse proposal on blockchain', { error, metadata });
      // Don't throw error as the main proposal was already created
    }
  }

  /**
   * Send enhanced notifications for browse proposals
   * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
   */
  private async sendBrowseProposalNotifications(
    swap: any,
    request: CreateProposalFromBrowseRequest,
    compatibilityAnalysis: any
  ): Promise<void> {
    try {
      logger.info('Sending browse proposal notifications', { 
        proposalId: swap.id,
        targetOwnerId: swap.ownerId,
        proposerId: request.proposerId
      });

      // Get target swap owner details
      const targetSwap = await this.swapRepository.findById(request.targetSwapId);
      if (!targetSwap) {
        logger.warn('Unable to find target swap for notifications', { targetSwapId: request.targetSwapId });
        return;
      }

      // Notification to proposal receiver (target swap owner)
      await this.notificationService.sendNotification({
        userId: targetSwap.ownerId,
        type: 'proposal_received_from_browse',
        title: 'New Swap Proposal from Browse',
        message: `You received a new swap proposal from someone browsing your listing. Compatibility score: ${compatibilityAnalysis.compatibility.overallScore}%`,
        data: {
          proposalId: swap.id,
          sourceSwapId: request.sourceSwapId,
          targetSwapId: request.targetSwapId,
          proposerId: request.proposerId,
          compatibilityScore: compatibilityAnalysis.compatibility.overallScore,
          recommendation: compatibilityAnalysis.recommendation,
          message: request.message,
        },
        priority: 'high',
      });

      // Confirmation notification to proposer
      await this.notificationService.sendNotification({
        userId: request.proposerId,
        type: 'proposal_submitted_confirmation',
        title: 'Proposal Submitted Successfully',
        message: `Your swap proposal has been submitted and recorded on the blockchain. The owner will be notified.`,
        data: {
          proposalId: swap.id,
          targetSwapId: request.targetSwapId,
          compatibilityScore: compatibilityAnalysis.compatibility.overallScore,
          estimatedResponseTime: this.calculateEstimatedResponseTime(compatibilityAnalysis.compatibility.overallScore),
        },
        priority: 'medium',
      });

      logger.info('Browse proposal notifications sent successfully', { 
        proposalId: swap.id 
      });
    } catch (error) {
      logger.warn('Failed to send browse proposal notifications', { error, swap, request });
      // Don't throw error as the proposal was already created
    }
  }

  /**
   * Calculate estimated response time based on compatibility score
   */
  private calculateEstimatedResponseTime(compatibilityScore: number): string {
    if (compatibilityScore >= 80) {
      return '1-2 business days';
    } else if (compatibilityScore >= 60) {
      return '2-3 business days';
    } else if (compatibilityScore >= 40) {
      return '3-5 business days';
    } else {
      return '5-7 business days';
    }
  }

  /**
   * Generate next steps based on compatibility score
   */
  private generateNextSteps(compatibilityScore: number): string[] {
    const baseSteps = [
      'The swap owner will review your proposal',
      'You will receive a notification when they respond',
      'Check your proposals page for status updates',
    ];

    if (compatibilityScore >= 80) {
      return [
        'Your proposal has excellent compatibility - high chance of acceptance!',
        ...baseSteps,
      ];
    } else if (compatibilityScore >= 60) {
      return [
        'Your proposal has good compatibility - looking promising!',
        ...baseSteps,
      ];
    } else if (compatibilityScore >= 40) {
      return [
        'Your proposal has moderate compatibility - the owner will consider the details',
        ...baseSteps,
        'Be prepared to discuss any compatibility concerns',
      ];
    } else {
      return [
        'Your proposal has low compatibility - consider reviewing the match details',
        ...baseSteps,
        'Be prepared to provide additional information or adjustments',
      ];
    }
  }

  /**
   * Get current swap locks (for debugging/monitoring)
   */
  public getCurrentLocks(): SwapLockInfo[] {
    return Array.from(this.swapLocks.values());
  }

  /**
   * Check if a swap is currently locked
   */
  public isSwapLocked(swapId: string): boolean {
    const lock = this.swapLocks.get(swapId);
    return lock ? !this.isLockExpired(lock) : false;
  }
}