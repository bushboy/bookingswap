import {
  EligibleSwap,
  CompatibilityAnalysis,
  CompatibilityFactor,
  ValidationResult,
  CreateProposalFromBrowseRequest,
  SwapProposalResult,
  ProposalValidationError,
  CompatibilityResponse
} from '@booking-swap/shared';
import { SwapRepository, DatabaseSchemaError, SwapMatchingError } from '../../database/repositories/SwapRepository';
import { UserRepository } from '../../database/repositories/UserRepository';
import { BookingService } from '../booking/BookingService';
import { SwapProposalService, CreateSwapProposalRequest } from './SwapProposalService';
import { CompatibilityAnalysisEngine, SwapBookingDetails } from './CompatibilityAnalysisEngine';
import { ProposalCreationWorkflow } from './ProposalCreationWorkflow';
import { BrowseProposalNotificationService } from '../notification/BrowseProposalNotificationService';
import { SwapMatchingCacheService } from './SwapMatchingCacheService';
import { logger } from '../../utils/logger';

export class SwapMatchingService {
  private compatibilityEngine: CompatibilityAnalysisEngine;
  private proposalWorkflow?: ProposalCreationWorkflow;
  private browseProposalNotificationService?: BrowseProposalNotificationService;
  private cacheService?: SwapMatchingCacheService;

  constructor(
    private swapRepository: SwapRepository,
    private bookingService: BookingService,
    private swapProposalService: SwapProposalService,
    private userRepository?: UserRepository,
    hederaService?: any,
    notificationService?: any,
    cacheService?: SwapMatchingCacheService
  ) {
    this.compatibilityEngine = new CompatibilityAnalysisEngine();
    this.cacheService = cacheService;

    // Initialize proposal workflow if services are provided
    if (hederaService && notificationService) {
      this.proposalWorkflow = new ProposalCreationWorkflow(
        swapRepository,
        bookingService,
        swapProposalService,
        this,
        hederaService,
        notificationService
      );

      // Initialize browse proposal notification service if userRepository is available
      if (userRepository) {
        this.browseProposalNotificationService = new BrowseProposalNotificationService(
          notificationService,
          swapRepository,
          bookingService,
          userRepository,
          this
        );
      }
    }
  }

  /**
   * Find user's eligible swaps for proposing to a target swap
   * Requirements: 2.1, 2.2, 2.3
   */
  async getUserEligibleSwaps(userId: string, targetSwapId: string): Promise<EligibleSwap[]> {
    try {
      logger.info('Finding eligible swaps for user', { userId, targetSwapId });

      // Try to get from cache first
      if (this.cacheService) {
        const cachedSwaps = await this.cacheService.getCachedEligibleSwaps(userId, targetSwapId);
        if (cachedSwaps) {
          logger.info('Retrieved eligible swaps from cache', {
            userId,
            targetSwapId,
            count: cachedSwaps.length
          });
          return cachedSwaps;
        }
      }

      // Get eligible swaps with booking details from repository
      const eligibleSwaps = await this.swapRepository.findEligibleSwapsWithBookingDetails(userId, targetSwapId);

      // Calculate compatibility scores for each eligible swap
      const swapsWithCompatibility = await Promise.all(
        eligibleSwaps.map(async (swap) => {
          try {
            const compatibility = await this.analyzeSwapCompatibility(swap.id, targetSwapId);
            return {
              ...swap,
              compatibilityScore: compatibility.overallScore,
              isCompatible: compatibility.overallScore >= 60, // 60% threshold for compatibility
            };
          } catch (error) {
            logger.warn('Failed to calculate compatibility for swap', {
              swapId: swap.id,
              targetSwapId,
              error: error.message
            });
            return {
              ...swap,
              compatibilityScore: 0,
              isCompatible: false,
            };
          }
        })
      );

      // Sort by compatibility score (highest first)
      const sortedSwaps = swapsWithCompatibility.sort((a, b) =>
        (b.compatibilityScore || 0) - (a.compatibilityScore || 0)
      );

      // Cache the results
      if (this.cacheService) {
        await this.cacheService.cacheUserEligibleSwaps(userId, targetSwapId, sortedSwaps);
      }

      logger.info('Found eligible swaps', {
        userId,
        targetSwapId,
        count: sortedSwaps.length,
        compatibleCount: sortedSwaps.filter(s => s.isCompatible).length
      });

      return sortedSwaps;
    } catch (error: any) {
      // Handle database schema errors specifically (Requirements: 3.1, 3.2)
      if (error instanceof DatabaseSchemaError) {
        logger.error('Database schema error in getUserEligibleSwaps', {
          error: error.message,
          originalError: error.originalError.message,
          userId,
          targetSwapId,
          requirement: '3.1'
        });

        throw new SwapMatchingError(
          'Unable to find eligible swaps due to database schema issues. Please contact support.',
          error
        );
      }

      // Handle swap matching errors
      if (error instanceof SwapMatchingError) {
        logger.error('Swap matching error in getUserEligibleSwaps', {
          error: error.message,
          originalError: error.originalError?.message,
          userId,
          targetSwapId,
          requirement: '3.2'
        });

        throw error;
      }

      // Handle other errors
      logger.error('Failed to get user eligible swaps', {
        error: error.message,
        stack: error.stack,
        userId,
        targetSwapId,
        requirement: '3.2'
      });

      throw new SwapMatchingError('Failed to get eligible swaps', error);
    }
  }

  /**
   * Validate proposal eligibility with comprehensive checks
   * Requirements: 2.1, 2.2, 2.3, 2.7
   */
  async validateProposalEligibility(
    userId: string,
    sourceSwapId: string,
    targetSwapId: string
  ): Promise<ValidationResult> {
    try {
      logger.info('Validating proposal eligibility', { userId, sourceSwapId, targetSwapId });

      const errors: string[] = [];
      const warnings: string[] = [];
      const eligibilityChecks = {
        userOwnsSourceSwap: false,
        sourceSwapAvailable: false,
        targetSwapAvailable: false,
        noExistingProposal: false,
        swapsAreCompatible: false,
      };

      // Check 1: User owns source swap
      const sourceSwap = await this.swapRepository.findById(sourceSwapId);
      if (!sourceSwap) {
        errors.push('Source swap not found');
      } else if (sourceSwap.ownerId !== userId) {
        errors.push('User does not own the source swap');
      } else {
        eligibilityChecks.userOwnsSourceSwap = true;
      }

      // Check 2: Source swap is available (more permissive status check)
      const allowedStatuses = ['active', 'available', 'open', 'pending', 'listed'];
      if (sourceSwap && allowedStatuses.includes(sourceSwap.status)) {
        eligibilityChecks.sourceSwapAvailable = true;
      } else if (sourceSwap) {
        errors.push(`Source swap is not available (status: ${sourceSwap.status})`);
      }

      // Check 3: Target swap is available (more permissive status check)
      const targetSwap = await this.swapRepository.findById(targetSwapId);
      if (!targetSwap) {
        errors.push('Target swap not found');
      } else if (!allowedStatuses.includes(targetSwap.status)) {
        errors.push(`Target swap is not available (status: ${targetSwap.status})`);
      } else if (targetSwap.ownerId === userId) {
        errors.push('Cannot propose to your own swap');
      } else {
        eligibilityChecks.targetSwapAvailable = true;
      }

      // Check 4: No existing proposal between swaps
      if (sourceSwap && targetSwap) {
        const hasExistingProposal = await this.swapRepository.hasExistingProposalBetweenSwaps(
          sourceSwapId,
          targetSwapId
        );
        if (hasExistingProposal) {
          errors.push('A proposal already exists between these swaps');
        } else {
          eligibilityChecks.noExistingProposal = true;
        }
      }

      // Check 5: Swaps are compatible (basic compatibility check)
      if (sourceSwap && targetSwap && eligibilityChecks.noExistingProposal) {
        try {
          const compatibility = await this.analyzeSwapCompatibility(sourceSwapId, targetSwapId);
          if (compatibility.overallScore >= 30) { // Lower threshold for basic compatibility
            eligibilityChecks.swapsAreCompatible = true;
            if (compatibility.overallScore < 60) {
              warnings.push('Low compatibility score - proposal may be less likely to be accepted');
            }
          } else {
            warnings.push('Very low compatibility score - consider reviewing swap details');
          }
        } catch (compatibilityError) {
          logger.warn('Failed to check compatibility during validation', {
            sourceSwapId,
            targetSwapId,
            error: compatibilityError.message
          });
          warnings.push('Unable to calculate compatibility score');
          eligibilityChecks.swapsAreCompatible = true; // Allow proposal to proceed
        }
      }

      const isValid = errors.length === 0;

      logger.info('Proposal eligibility validation completed', {
        userId,
        sourceSwapId,
        targetSwapId,
        isValid,
        errorCount: errors.length,
        warningCount: warnings.length
      });

      return {
        isValid,
        errors,
        warnings,
        eligibilityChecks,
      };
    } catch (error) {
      logger.error('Failed to validate proposal eligibility', {
        error,
        userId,
        sourceSwapId,
        targetSwapId
      });
      throw error;
    }
  }

  /**
   * Analyze compatibility between two swaps
   * Requirements: 2.6, 2.7
   */
  async analyzeSwapCompatibility(sourceSwapId: string, targetSwapId: string): Promise<CompatibilityAnalysis> {
    try {
      logger.info('Analyzing swap compatibility', { sourceSwapId, targetSwapId });

      // Try to get from cache first
      if (this.cacheService) {
        const cachedAnalysis = await this.cacheService.getCachedCompatibilityAnalysis(sourceSwapId, targetSwapId);
        if (cachedAnalysis) {
          logger.info('Retrieved compatibility analysis from cache', {
            sourceSwapId,
            targetSwapId,
            overallScore: cachedAnalysis.overallScore
          });
          return cachedAnalysis;
        }
      }

      // Get swap details with booking information
      const [sourceSwapDetails, targetSwapDetails] = await Promise.all([
        this.getSwapWithBookingDetails(sourceSwapId),
        this.getSwapWithBookingDetails(targetSwapId)
      ]);

      if (!sourceSwapDetails) {
        throw new Error(`Source swap not found: ${sourceSwapId}`);
      }

      if (!targetSwapDetails) {
        throw new Error(`Target swap not found: ${targetSwapId}`);
      }

      // Convert to booking details format for compatibility engine
      const sourceBookingDetails: SwapBookingDetails = {
        location: sourceSwapDetails.booking.location || '',
        dateRange: {
          checkIn: new Date(sourceSwapDetails.booking.dateRange.checkIn),
          checkOut: new Date(sourceSwapDetails.booking.dateRange.checkOut)
        },
        totalPrice: sourceSwapDetails.booking.totalPrice || 0,
        accommodationType: sourceSwapDetails.booking.accommodationType || '',
        guests: sourceSwapDetails.booking.guests || 1
      };

      const targetBookingDetails: SwapBookingDetails = {
        location: targetSwapDetails.booking.location || '',
        dateRange: {
          checkIn: new Date(targetSwapDetails.booking.dateRange.checkIn),
          checkOut: new Date(targetSwapDetails.booking.dateRange.checkOut)
        },
        totalPrice: targetSwapDetails.booking.totalPrice || 0,
        accommodationType: targetSwapDetails.booking.accommodationType || '',
        guests: targetSwapDetails.booking.guests || 1
      };

      // Use the compatibility engine for analysis
      const analysis = await this.compatibilityEngine.analyzeCompatibility(
        sourceBookingDetails,
        targetBookingDetails
      );

      // Cache the analysis result
      if (this.cacheService) {
        await this.cacheService.cacheCompatibilityAnalysis(sourceSwapId, targetSwapId, analysis);
      }

      logger.info('Compatibility analysis completed', {
        sourceSwapId,
        targetSwapId,
        overallScore: analysis.overallScore,
        locationScore: analysis.factors.locationCompatibility.score,
        dateScore: analysis.factors.dateCompatibility.score,
        valueScore: analysis.factors.valueCompatibility.score
      });

      return analysis;
    } catch (error) {
      logger.error('Failed to analyze swap compatibility', {
        error,
        sourceSwapId,
        targetSwapId
      });
      throw error;
    }
  }

  /**
   * Create proposal from browse page with validation and workflow
   * Requirements: 1.1, 1.2, 1.3, 1.6, 1.7
   */
  async createProposalFromBrowse(request: CreateProposalFromBrowseRequest): Promise<SwapProposalResult> {
    if (this.proposalWorkflow) {
      // Use the comprehensive workflow if available
      return this.proposalWorkflow.createProposalFromBrowse(request);
    }

    // Fallback to basic implementation
    try {
      logger.info('Creating proposal from browse page (basic implementation)', {
        targetSwapId: request.targetSwapId,
        sourceSwapId: request.sourceSwapId,
        proposerId: request.proposerId
      });

      // Step 1: Validate the proposal request
      const validation = await this.validateProposalEligibility(
        request.proposerId,
        request.sourceSwapId,
        request.targetSwapId
      );

      if (!validation.isValid) {
        const error = new Error('Proposal validation failed') as ProposalValidationError;
        error.code = 'INVALID_SOURCE_SWAP'; // Default, will be refined based on specific errors
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
        } else if (!validation.eligibilityChecks.swapsAreCompatible) {
          error.code = 'SWAP_NOT_AVAILABLE';
        }

        throw error;
      }

      // Step 2: Get booking IDs for the traditional swap proposal
      const [sourceSwap, targetSwap] = await Promise.all([
        this.swapRepository.findById(request.sourceSwapId),
        this.swapRepository.findById(request.targetSwapId)
      ]);

      if (!sourceSwap || !targetSwap) {
        throw new Error('Unable to retrieve swap details');
      }

      // Step 3: Create traditional swap proposal request
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

      // Step 4: Create the swap proposal using existing service
      const proposalResult = await this.swapProposalService.createSwapProposal(swapProposalRequest);

      // Step 5: Send enhanced browse proposal notifications
      if (this.browseProposalNotificationService) {
        try {
          // Send notification to target swap owner
          await this.browseProposalNotificationService.sendBrowseProposalReceivedNotification({
            proposalId: proposalResult.swap.id,
            sourceSwapId: request.sourceSwapId,
            targetSwapId: request.targetSwapId,
            proposerId: request.proposerId,
            targetOwnerId: targetSwap.ownerId,
            message: request.message,
          });

          // Send confirmation to proposer
          await this.browseProposalNotificationService.sendBrowseProposalConfirmedNotification({
            proposalId: proposalResult.swap.id,
            sourceSwapId: request.sourceSwapId,
            targetSwapId: request.targetSwapId,
            proposerId: request.proposerId,
            status: 'pending_review',
          });
        } catch (notificationError) {
          logger.warn('Failed to send browse proposal notifications', {
            error: notificationError instanceof Error ? notificationError.message : 'Unknown error',
            proposalId: proposalResult.swap.id
          });
          // Don't fail the proposal creation if notifications fail
        }
      }

      // Step 6: Record browse-specific metadata (if needed for future features)
      await this.recordBrowseProposalMetadata({
        proposalId: proposalResult.swap.id,
        sourceSwapId: request.sourceSwapId,
        targetSwapId: request.targetSwapId,
        message: request.message,
        compatibilityScore: await this.getCompatibilityScore(request.sourceSwapId, request.targetSwapId),
      });

      // Step 7: Transform result to match expected interface
      const result: SwapProposalResult = {
        proposalId: proposalResult.swap.id,
        swap: proposalResult.swap,
        status: 'pending_review',
        blockchainTransaction: proposalResult.blockchainTransaction,
        estimatedResponseTime: '2-3 business days',
        nextSteps: [
          'The swap owner will review your proposal',
          'You will receive a notification when they respond',
          'Check your proposals page for status updates',
        ],
      };

      logger.info('Browse proposal created successfully', {
        proposalId: result.proposalId,
        sourceSwapId: request.sourceSwapId,
        targetSwapId: request.targetSwapId,
        transactionId: result.blockchainTransaction.transactionId
      });

      return result;
    } catch (error) {
      logger.error('Failed to create proposal from browse', { error, request });
      throw error;
    }
  }

  /**
   * Get compatibility analysis with recommendation
   */
  async getSwapCompatibility(sourceSwapId: string, targetSwapId: string): Promise<CompatibilityResponse> {
    try {
      const compatibility = await this.analyzeSwapCompatibility(sourceSwapId, targetSwapId);

      let recommendation: CompatibilityResponse['recommendation'];
      if (compatibility.overallScore >= 80) {
        recommendation = 'highly_recommended';
      } else if (compatibility.overallScore >= 65) {
        recommendation = 'recommended';
      } else if (compatibility.overallScore >= 40) {
        recommendation = 'possible';
      } else {
        recommendation = 'not_recommended';
      }

      return {
        compatibility,
        recommendation,
      };
    } catch (error) {
      logger.error('Failed to get swap compatibility', { error, sourceSwapId, targetSwapId });
      throw error;
    }
  }

  // Private helper methods

  /**
   * Get swap details with booking information
   */
  private async getSwapWithBookingDetails(swapId: string): Promise<any> {
    try {
      const swap = await this.swapRepository.findById(swapId);
      if (!swap) {
        logger.warn('Swap not found in database', { swapId });
        return null;
      }

      const booking = await this.bookingService.getBookingById(swap.sourceBookingId);
      if (!booking) {
        logger.warn('Associated booking not found for swap', {
          swapId,
          sourceBookingId: swap.sourceBookingId
        });
        return null;
      }

      return {
        swap,
        booking,
      };
    } catch (error) {
      logger.error('Failed to get swap with booking details', { error, swapId });
      return null;
    }
  }



  /**
   * Get compatibility score between two swaps (cached if available)
   */
  private async getCompatibilityScore(sourceSwapId: string, targetSwapId: string): Promise<number> {
    try {
      const compatibility = await this.analyzeSwapCompatibility(sourceSwapId, targetSwapId);
      return compatibility.overallScore;
    } catch (error) {
      logger.warn('Failed to get compatibility score', { error, sourceSwapId, targetSwapId });
      return 50; // Default score
    }
  }

  /**
   * Record browse-specific proposal metadata
   */
  private async recordBrowseProposalMetadata(metadata: {
    proposalId: string;
    sourceSwapId: string;
    targetSwapId: string;
    message?: string;
    compatibilityScore: number;
  }): Promise<void> {
    try {
      // This would store additional metadata about browse-initiated proposals
      // For now, we'll just log it - in production, this might go to a separate table
      logger.info('Recording browse proposal metadata', metadata);

      // TODO: Implement actual metadata storage if needed for analytics or features
    } catch (error) {
      logger.warn('Failed to record browse proposal metadata', { error, metadata });
      // Don't throw error as this is not critical for proposal creation
    }
  }

  // ===== CACHE MANAGEMENT METHODS =====

  /**
   * Invalidate cache entries related to a user
   * Should be called when user's swaps change
   */
  async invalidateUserCache(userId: string): Promise<void> {
    if (this.cacheService) {
      try {
        const deletedKeys = await this.cacheService.invalidateUserCache(userId);
        logger.info('Invalidated user cache', { userId, deletedKeys });
      } catch (error) {
        logger.warn('Failed to invalidate user cache', { error, userId });
      }
    }
  }

  /**
   * Invalidate cache entries related to a swap
   * Should be called when swap status or details change
   */
  async invalidateSwapCache(swapId: string): Promise<void> {
    if (this.cacheService) {
      try {
        const deletedKeys = await this.cacheService.invalidateSwapCache(swapId);
        logger.info('Invalidated swap cache', { swapId, deletedKeys });
      } catch (error) {
        logger.warn('Failed to invalidate swap cache', { error, swapId });
      }
    }
  }

  /**
   * Invalidate compatibility cache for specific swap pairs
   * Should be called when swap details that affect compatibility change
   */
  async invalidateCompatibilityCache(sourceSwapId: string, targetSwapId: string): Promise<void> {
    if (this.cacheService) {
      try {
        const success = await this.cacheService.invalidateCompatibilityCache(sourceSwapId, targetSwapId);
        logger.info('Invalidated compatibility cache', { sourceSwapId, targetSwapId, success });
      } catch (error) {
        logger.warn('Failed to invalidate compatibility cache', { error, sourceSwapId, targetSwapId });
      }
    }
  }

  /**
   * Warm cache with frequently accessed data
   */
  async warmCache(warmingConfig: {
    popularUsers?: string[];
    popularSwaps?: string[];
    popularSearchQueries?: Array<Record<string, any>>;
  }): Promise<void> {
    if (this.cacheService) {
      try {
        await this.cacheService.warmCache(warmingConfig);
        logger.info('Cache warming completed', {
          userCount: warmingConfig.popularUsers?.length || 0,
          swapCount: warmingConfig.popularSwaps?.length || 0,
          queryCount: warmingConfig.popularSearchQueries?.length || 0
        });
      } catch (error) {
        logger.warn('Cache warming failed', { error });
      }
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  async getCacheStats(): Promise<any> {
    if (this.cacheService) {
      try {
        return await this.cacheService.getCacheStats();
      } catch (error) {
        logger.warn('Failed to get cache stats', { error });
        return null;
      }
    }
    return null;
  }

  /**
   * Batch process compatibility analyses with caching
   * Useful for warming cache or bulk operations
   */
  async batchAnalyzeCompatibility(swapPairs: Array<{
    sourceSwapId: string;
    targetSwapId: string;
  }>): Promise<Array<{
    sourceSwapId: string;
    targetSwapId: string;
    analysis: CompatibilityAnalysis;
  }>> {
    try {
      logger.info('Starting batch compatibility analysis', { pairCount: swapPairs.length });

      const results = await Promise.allSettled(
        swapPairs.map(async ({ sourceSwapId, targetSwapId }) => {
          const analysis = await this.analyzeSwapCompatibility(sourceSwapId, targetSwapId);
          return { sourceSwapId, targetSwapId, analysis };
        })
      );

      const successfulResults = results
        .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
        .map(result => result.value);

      const failedCount = results.length - successfulResults.length;
      if (failedCount > 0) {
        logger.warn('Some compatibility analyses failed', {
          total: swapPairs.length,
          successful: successfulResults.length,
          failed: failedCount
        });
      }

      // Batch cache the results if cache service is available
      if (this.cacheService && successfulResults.length > 0) {
        try {
          await this.cacheService.batchCacheCompatibilityAnalyses(successfulResults);
          logger.info('Batch cached compatibility analyses', { count: successfulResults.length });
        } catch (cacheError) {
          logger.warn('Failed to batch cache compatibility analyses', { error: cacheError });
        }
      }

      logger.info('Batch compatibility analysis completed', {
        successful: successfulResults.length,
        failed: failedCount
      });

      return successfulResults;
    } catch (error) {
      logger.error('Batch compatibility analysis failed', { error, pairCount: swapPairs.length });
      throw error;
    }
  }
}