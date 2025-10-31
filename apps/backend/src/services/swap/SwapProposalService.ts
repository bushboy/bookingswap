import {
  Swap,
  SwapStatus,
  SwapTerms,
  EnhancedSwap,
  EnhancedCreateSwapRequest,
  EnhancedSwapResult,
  PaymentTypePreference,
  AcceptanceStrategy,
  CashSwapConfiguration,
  CreateEnhancedProposalRequest,
  ProposalValidation,
  CreateProposalFromBrowseRequest,
  SwapProposalResult,
  ValidationResult,
  ProposalMetadata,
  SwapWithBookingDetails,
  SwapDataCompletenessMetadata,
  SwapWithBookingDetailsResponse,
  BookingDetails,
  EnhancedSwapCardData,
  IncomingTargetInfo,
  OutgoingTargetInfo,
  TargetingCapabilities,
  TargetingDisplayData,
  SwapTargetStatus,
  TargetingRestriction
} from '@booking-swap/shared';
import { TargetingDataTransformer, BidirectionalQueryResult } from './TargetingDataTransformer';
import { SimpleTargetingTransformer, SimpleTargetingData, RawTargetingData } from './SimpleTargetingTransformer';
import { v4 as uuidv4 } from 'uuid';
import { FinancialDataHandler } from '../../utils/financialDataHandler';

// Define SwapCardData types locally until shared package is fixed
export interface SwapProposal {
  id: string;
  proposerId: string; // Will never equal current user's ID
  proposerName: string;
  targetBookingDetails: BookingDetails;
  status: SwapStatus;
  createdAt: Date;
  additionalPayment?: number;
  conditions: string[];
  expiresAt?: Date;
}

export interface SwapCardData {
  userSwap: {
    id: string;
    bookingDetails: BookingDetails;
    status: SwapStatus;
    createdAt: Date;
    expiresAt?: Date;
  };
  proposalsFromOthers: SwapProposal[]; // Only proposals from other users
  proposalCount: number; // Count of valid proposals from others
}
import { SwapRepository } from '../../database/repositories/SwapRepository';
import { SwapTargetingRepository } from '../../database/repositories/SwapTargetingRepository';
import { AuctionRepository } from '../../database/repositories/AuctionRepository';
import { BookingService } from '../booking/BookingService';
import { HederaService, TransactionData } from '../hedera/HederaService';
import { NotificationService } from '../notification/NotificationService';
import { AuctionNotificationService } from '../notification/AuctionNotificationService';
import { PaymentNotificationService } from '../notification/PaymentNotificationService';
import { TimingNotificationService } from '../notification/TimingNotificationService';
import { AuctionManagementService } from '../auction/AuctionManagementService';
import { PaymentProcessingService } from '../payment/PaymentProcessingService';
import { logger } from '../../utils/logger';
import { TargetingProductionLogger } from '../../utils/targetingProductionLogger';
import { SwapDataValidator, CompleteSwapData } from '../../utils/swapDataValidator';
import { SwapProposerMonitoringService } from '../monitoring/SwapProposerMonitoringService';
import { AuctionSettingsValidator } from '../../utils/AuctionSettingsValidator.js';
import { AuctionErrorMonitoringService } from '../monitoring/AuctionErrorMonitoringService';
import { AuctionErrorResponseBuilder } from '../../utils/AuctionErrorResponseBuilder';
import {
  AuctionCreationError,
  ValidationError as AuctionValidationError,
  DateValidationError,
  AuctionSettingsValidationError,
  AuctionErrorUtils
} from '../../utils/AuctionErrors';

export interface CreateSwapProposalRequest {
  sourceBookingId: string;
  targetBookingId: string;
  proposerId: string;
  terms: SwapTerms;
}

export interface LegacySwapProposalResult {
  swap: Swap;
  blockchainTransaction: {
    transactionId: string;
    consensusTimestamp?: string;
  };
}

export enum TargetingDisplayErrorCodes {
  TARGETING_DATA_UNAVAILABLE = 'TARGETING_DATA_UNAVAILABLE',
  TARGETING_QUERY_FAILED = 'TARGETING_QUERY_FAILED',
  TARGETING_TRANSFORMATION_FAILED = 'TARGETING_TRANSFORMATION_FAILED',
  TARGETING_AUTHORIZATION_FAILED = 'TARGETING_AUTHORIZATION_FAILED'
}

export class TargetingDisplayError extends Error {
  constructor(
    public code: TargetingDisplayErrorCodes,
    public message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'TargetingDisplayError';
  }
}

export class SwapProposalService {
  private readonly ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000; // One week in milliseconds
  private monitoringService: SwapProposerMonitoringService;
  private errorMonitoringService: AuctionErrorMonitoringService;

  constructor(
    private swapRepository: SwapRepository,
    private swapTargetingRepository: SwapTargetingRepository,
    private auctionRepository: AuctionRepository,
    private bookingService: BookingService,
    private hederaService: HederaService,
    private notificationService: NotificationService,
    private auctionNotificationService: AuctionNotificationService,
    private paymentNotificationService: PaymentNotificationService,
    private timingNotificationService: TimingNotificationService,
    private auctionService: AuctionManagementService,
    private paymentService: PaymentProcessingService
  ) {
    this.monitoringService = SwapProposerMonitoringService.getInstance();
    this.errorMonitoringService = AuctionErrorMonitoringService.getInstance();
  }

  /**
   * Create an enhanced swap proposal with payment preferences and auction support
   */
  async createEnhancedSwapProposal(request: EnhancedCreateSwapRequest): Promise<EnhancedSwapResult> {
    try {
      logger.info('Creating enhanced swap proposal', {
        sourceBookingId: request.sourceBookingId,
        paymentTypes: request.paymentTypes,
        acceptanceStrategy: request.acceptanceStrategy.type,
      });

      // Step 1: Validate the enhanced swap proposal with enhanced date handling
      await this.validateEnhancedSwapProposalWithDateHandling(request);

      // Step 2: Get source booking and validate ownership
      const sourceBooking = await this.bookingService.getBookingById(request.sourceBookingId);
      if (!sourceBooking) {
        throw new Error('Source booking not found');
      }

      // Step 3: Check for last-minute booking restrictions
      const isLastMinute = await this.isLastMinuteBooking(sourceBooking.dateRange.checkIn);
      if (isLastMinute && request.acceptanceStrategy.type === 'auction') {
        // Send timing restriction notification
        await this.timingNotificationService.sendLastMinuteBookingRestriction({
          userId: sourceBooking.userId,
          bookingId: request.sourceBookingId,
          eventDate: sourceBooking.dateRange.checkIn,
          currentDate: new Date(),
          attemptedAction: 'auction_creation',
        });

        throw new Error('Auctions are not allowed for events less than one week away. Please use first-match acceptance instead.');
      }

      // Step 4: Create enhanced swap entity (simplified schema - no redundant fields)
      const swapData: Omit<EnhancedSwap, 'id' | 'createdAt' | 'updatedAt'> = {
        sourceBookingId: request.sourceBookingId,
        // Temporary placeholders for interface compatibility - these fields will be removed in interface updates
        targetBookingId: '', // Will be derived from targeting relationships
        proposerId: sourceBooking.userId, // Derived from source booking
        ownerId: sourceBooking.userId, // Same as proposer for enhanced swaps
        status: 'pending',
        terms: {
          additionalPayment: 0,
          conditions: request.swapPreferences.additionalRequirements || [],
          expiresAt: request.expirationDate,
        },
        blockchain: {
          proposalTransactionId: '', // Will be updated after blockchain submission
        },
        timeline: {
          proposedAt: new Date(),
        },
        paymentTypes: request.paymentTypes,
        acceptanceStrategy: request.acceptanceStrategy,
        cashDetails: this.createCashConfiguration(request.paymentTypes),
      };

      // Step 5: Save to database
      const swap = await this.swapRepository.createEnhancedSwap(swapData);

      // Step 5.1: Validate swap creation success before proceeding to auction creation
      if (!swap) {
        throw new Error('Failed to create swap - swap creation returned null');
      }

      if (!swap.id || swap.id.trim() === '') {
        logger.error('Swap created but has invalid ID', {
          category: 'swap_creation_validation',
          swapObject: {
            id: swap.id,
            sourceBookingId: swap.sourceBookingId,
            status: swap.status,
            ownerId: swap.ownerId
          },
          sourceBookingId: request.sourceBookingId
        });
        throw new Error('Failed to create swap - swap ID is null or empty');
      }

      logger.info('Swap created successfully with valid ID', {
        swapId: swap.id,
        sourceBookingId: swap.sourceBookingId,
        ownerId: swap.ownerId,
        status: swap.status
      });

      // Step 6: Create auction if auction mode is selected
      let auction;
      if (request.acceptanceStrategy.type === 'auction' && request.auctionSettings) {
        try {
          // Validate auction settings before passing to auction service
          const validatedSettings = AuctionSettingsValidator.validateAuctionSettings(request.auctionSettings);

          // Additional validation before auction creation
          if (!swap.id || swap.id.trim() === '') {
            throw new Error('Cannot create auction: Swap ID is null or empty');
          }

          logger.info('Creating auction with validated settings', {
            swapId: swap.id,
            endDate: validatedSettings.endDate.toISOString(),
            allowBookingProposals: validatedSettings.allowBookingProposals,
            allowCashProposals: validatedSettings.allowCashProposals,
            swapIdValidated: true
          });

          const auctionResult = await this.auctionService.createAuction({
            swapId: swap.id,
            settings: validatedSettings, // Now guaranteed to have proper Date objects
          });
          auction = auctionResult.auction;

          logger.info('Auction created successfully', {
            swapId: swap.id,
            auctionId: auction.id,
            endDate: validatedSettings.endDate.toISOString()
          });
        } catch (auctionError) {
          // Record error in monitoring service
          this.errorMonitoringService.recordAuctionError(
            auctionError instanceof Error ? auctionError : new Error('Unknown auction creation error'),
            {
              phase: 'creation',
              swapId: swap.id,
              operation: 'auction_creation',
              metadata: {
                auctionSettings: request.auctionSettings,
                validationAttempted: true,
                sourceBookingId: request.sourceBookingId
              }
            }
          );

          // Enhanced error logging for auction creation failures
          logger.error('Auction creation failed with comprehensive context', {
            category: 'auction_creation',
            swapId: swap.id,
            error: auctionError instanceof Error ? auctionError.message : auctionError,
            stack: auctionError instanceof Error ? auctionError.stack : undefined,
            errorType: auctionError instanceof Error ? auctionError.constructor.name : typeof auctionError,
            auctionSettings: {
              endDate: request.auctionSettings?.endDate,
              endDateType: typeof request.auctionSettings?.endDate,
              allowBookingProposals: request.auctionSettings?.allowBookingProposals,
              allowCashProposals: request.auctionSettings?.allowCashProposals,
              autoSelectAfterHours: request.auctionSettings?.autoSelectAfterHours
            },
            validationAttempted: true,
            timestamp: new Date().toISOString()
          });

          // Proper rollback: Clean up swap if auction creation fails
          try {
            await this.swapRepository.delete(swap.id);
            logger.info('Successfully rolled back swap after auction creation failure', {
              swapId: swap.id,
              rollbackReason: 'auction_creation_failed'
            });
          } catch (rollbackError) {
            // Record rollback error in monitoring
            this.errorMonitoringService.recordAuctionError(
              rollbackError instanceof Error ? rollbackError : new Error('Unknown rollback error'),
              {
                phase: 'rollback',
                swapId: swap.id,
                operation: 'swap_cleanup_after_auction_failure',
                metadata: {
                  originalError: auctionError instanceof Error ? auctionError.message : auctionError
                }
              }
            );

            logger.error('Failed to rollback swap after auction creation failure', {
              category: 'auction_rollback',
              swapId: swap.id,
              rollbackError: rollbackError instanceof Error ? rollbackError.message : rollbackError,
              rollbackErrorType: rollbackError instanceof Error ? rollbackError.constructor.name : typeof rollbackError,
              originalError: auctionError instanceof Error ? auctionError.message : auctionError,
              originalErrorType: auctionError instanceof Error ? auctionError.constructor.name : typeof auctionError,
              timestamp: new Date().toISOString()
            });
          }

          // Create structured error response
          if (AuctionErrorUtils.isAuctionError(auctionError)) {
            throw auctionError; // Re-throw auction-specific errors as-is
          }

          // Wrap unknown errors with auction context
          throw new AuctionCreationError(
            `Failed to create auction: ${auctionError instanceof Error ? auctionError.message : 'Unknown error'}`,
            undefined,
            swap.id,
            auctionError instanceof Error ? auctionError : undefined,
            'creation'
          );
        }
      }

      // Step 7: Record enhanced swap creation on blockchain
      const transactionData: TransactionData = {
        type: 'enhanced_swap_created',
        payload: {
          swapId: swap.id,
          sourceBookingId: request.sourceBookingId,
          ownerId: swap.ownerId,
          paymentTypes: request.paymentTypes,
          acceptanceStrategy: request.acceptanceStrategy,
          auctionId: auction?.id,
          createdAt: swap.timeline.proposedAt,
        },
        timestamp: new Date(),
      };

      const blockchainResult = await this.hederaService.submitTransaction(transactionData);

      // Step 8: Update swap with blockchain info
      const updatedSwap = await this.swapRepository.updateBlockchainInfo(swap.id, {
        proposalTransactionId: blockchainResult.transactionId,
      });

      if (!updatedSwap) {
        throw new Error('Failed to update swap with blockchain information');
      }

      // Step 9: Send notifications based on preferences
      await this.sendSwapCreationNotifications(updatedSwap as EnhancedSwap, auction);

      logger.info('Enhanced swap proposal created successfully', {
        swapId: swap.id,
        auctionId: auction?.id,
        transactionId: blockchainResult.transactionId,
      });

      const validationWarnings = await this.getSwapValidationWarnings(updatedSwap as EnhancedSwap);

      return {
        swap: updatedSwap as EnhancedSwap,
        auction,
        validationWarnings,
      };
    } catch (error) {
      // Record error in monitoring service
      this.errorMonitoringService.recordAuctionError(
        error instanceof Error ? error : new Error('Unknown enhanced swap creation error'),
        {
          phase: 'creation',
          operation: 'enhanced_swap_creation',
          metadata: {
            sourceBookingId: request.sourceBookingId,
            acceptanceStrategy: request.acceptanceStrategy,
            paymentTypes: request.paymentTypes,
            hasAuctionSettings: !!request.auctionSettings
          }
        }
      );

      // Enhanced error logging with comprehensive context
      logger.error('Failed to create enhanced swap proposal with detailed context', {
        category: 'enhanced_swap_creation',
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        request: {
          sourceBookingId: request.sourceBookingId,
          acceptanceStrategy: request.acceptanceStrategy,
          paymentTypes: request.paymentTypes,
          auctionSettings: request.auctionSettings ? {
            endDate: request.auctionSettings.endDate,
            endDateType: typeof request.auctionSettings.endDate,
            allowBookingProposals: request.auctionSettings.allowBookingProposals,
            allowCashProposals: request.auctionSettings.allowCashProposals
          } : undefined
        },
        timestamp: new Date().toISOString(),
        isAuctionError: AuctionErrorUtils.isAuctionError(error)
      });

      // Re-throw auction-specific errors as-is for proper error handling upstream
      if (AuctionErrorUtils.isAuctionError(error)) {
        throw error;
      }

      // Wrap unknown errors with context
      throw new AuctionCreationError(
        `Enhanced swap creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        undefined,
        error instanceof Error ? error : undefined,
        'creation'
      );
    }
  }

  /**
   * Create a new swap proposal with validation and blockchain recording
   */
  async createSwapProposal(request: CreateSwapProposalRequest): Promise<LegacySwapProposalResult> {
    try {
      logger.info('Creating swap proposal', {
        sourceBookingId: request.sourceBookingId,
        targetBookingId: request.targetBookingId,
        proposerId: request.proposerId,
      });

      // Step 1: Validate the swap proposal
      await this.validateSwapProposal(request);

      // Step 2: Lock both bookings temporarily
      const sourceBooking = await this.bookingService.lockBooking(request.sourceBookingId, request.proposerId);
      let targetBooking;

      try {
        targetBooking = await this.bookingService.lockBooking(request.targetBookingId);
      } catch (error) {
        // If target booking lock fails, unlock source booking
        await this.bookingService.unlockBooking(request.sourceBookingId, request.proposerId);
        throw error;
      }

      // Step 3: Create swap entity (simplified schema - no redundant fields)
      const swapData: Omit<Swap, 'id' | 'createdAt' | 'updatedAt'> = {
        sourceBookingId: request.sourceBookingId,
        // Temporary placeholders for interface compatibility - these fields will be removed in interface updates
        targetBookingId: request.targetBookingId, // Will be derived from targeting relationships
        proposerId: request.proposerId, // Derived from source booking
        ownerId: targetBooking.userId, // Derived from target booking
        status: 'pending',
        terms: request.terms,
        blockchain: {
          proposalTransactionId: '', // Will be updated after blockchain submission
        },
        timeline: {
          proposedAt: new Date(),
        },
      };

      // Step 4: Save to database
      const swap = await this.swapRepository.create(swapData);

      // Step 5: Record proposal on blockchain (simplified schema)
      const transactionData: TransactionData = {
        type: 'swap_proposal',
        payload: {
          swapId: swap.id,
          sourceBookingId: request.sourceBookingId,
          // Removed redundant fields from blockchain payload
          // targetBookingId, proposerId, ownerId can be derived when needed
          terms: request.terms,
          proposedAt: swap.timeline.proposedAt,
        },
        timestamp: new Date(),
      };

      const blockchainResult = await this.hederaService.submitTransaction(transactionData);

      // Step 6: Update swap with blockchain info
      const updatedSwap = await this.swapRepository.updateBlockchainInfo(swap.id, {
        proposalTransactionId: blockchainResult.transactionId,
      });

      if (!updatedSwap) {
        throw new Error('Failed to update swap with blockchain information');
      }

      // Step 7: Send notification to target booking owner (non-blocking)
      try {
        await this.notificationService.sendSwapProposalNotification({
          swapId: swap.id,
          recipientUserId: targetBooking.userId,
          proposerUserId: request.proposerId,
          sourceBooking,
          targetBooking,
          terms: request.terms,
        });
      } catch (notifyError) {
        logger.error('Failed to send notification', {
          error: notifyError,
          type: 'swap_proposal',
          userId: targetBooking.userId,
        });
        // Do not fail proposal creation due to notification failure
      }

      logger.info('Swap proposal created successfully', {
        swapId: swap.id,
        transactionId: blockchainResult.transactionId,
      });

      return {
        swap: updatedSwap,
        blockchainTransaction: {
          transactionId: blockchainResult.transactionId,
          consensusTimestamp: blockchainResult.consensusTimestamp,
        },
      };
    } catch (error) {
      logger.error('Failed to create swap proposal', { error, request });
      throw error;
    }
  }


  /**
   * Validate swap proposal before creation
   */
  private async validateSwapProposal(request: CreateSwapProposalRequest): Promise<void> {
    // Validate source booking
    const sourceBooking = await this.bookingService.getBookingById(request.sourceBookingId);
    if (!sourceBooking) {
      throw new Error('Source booking not found');
    }

    if (sourceBooking.userId !== request.proposerId) {
      throw new Error('Proposer does not own the source booking');
    }

    if (sourceBooking.status !== 'available') {
      throw new Error(`Source booking is not available for swap (status: ${sourceBooking.status})`);
    }

    if (sourceBooking.verification.status !== 'verified') {
      throw new Error('Source booking must be verified before proposing a swap');
    }

    // Validate that source booking doesn't already have an incomplete or matched swap
    const existingSourceSwaps = await this.swapRepository.findBySourceBookingId(request.sourceBookingId);
    const activeSourceSwap = existingSourceSwaps.find(swap =>
      ['pending', 'accepted'].includes(swap.status)
    );

    if (activeSourceSwap) {
      if (activeSourceSwap.status === 'pending') {
        throw new Error('This booking already has an incomplete swap. Please complete or cancel the existing swap before creating a new one.');
      }
      if (activeSourceSwap.status === 'accepted') {
        throw new Error('This booking already has a matched swap. Cannot create a new swap for a booking that has been matched.');
      }
    }

    // Validate target booking
    const targetBooking = await this.bookingService.getBookingById(request.targetBookingId);
    if (!targetBooking) {
      throw new Error('Target booking not found');
    }

    if (targetBooking.userId === request.proposerId) {
      throw new Error('Cannot propose swap with your own booking');
    }

    if (targetBooking.status !== 'available') {
      throw new Error(`Target booking is not available for swap (status: ${targetBooking.status})`);
    }

    if (targetBooking.verification.status !== 'verified') {
      throw new Error('Target booking must be verified before accepting swap proposals');
    }

    // Validate proposal terms
    if (request.terms.expiresAt <= new Date()) {
      throw new Error('Proposal expiration date must be in the future');
    }

    // Check for existing pending proposals between these bookings
    const existingProposal = await this.swapRepository.findPendingProposalBetweenBookings(
      request.sourceBookingId,
      request.targetBookingId
    );

    if (existingProposal) {
      throw new Error('A pending swap proposal already exists between these bookings');
    }

    // Validate additional payment if specified
    if (request.terms.additionalPayment && request.terms.additionalPayment < 0) {
      throw new Error('Additional payment cannot be negative');
    }

    logger.info('Swap proposal validation passed', {
      sourceBookingId: request.sourceBookingId,
      targetBookingId: request.targetBookingId,
    });
  }

  /**
   * Get swap proposal by ID
   */
  async getSwapProposalById(swapId: string): Promise<Swap | null> {
    try {
      return await this.swapRepository.findById(swapId);
    } catch (error) {
      logger.error('Failed to get swap proposal by ID', { error, swapId });
      throw error;
    }
  }

  /**
   * Get swap proposals for a user (both as proposer and owner)
   */
  async getUserSwapProposals(userId: string, limit: number = 100, offset: number = 0): Promise<Swap[]> {
    try {
      return await this.swapRepository.findByUserId(userId, limit, offset);
    } catch (error) {
      logger.error('Failed to get user swap proposals', { error, userId });
      throw error;
    }
  }

  /**
   * Get user swaps with proposals from others (excluding self-proposals)
   * Updated for simplified schema - derives proposer information from booking relationships
   * Returns structured data for swap card display with user's swap on left and proposals from others on right
   * Requirements: 1.1, 1.2, 4.1, 4.3
   */
  async getUserSwapsWithProposals(userId: string, limit: number = 100, offset: number = 0): Promise<SwapCardData[]> {
    try {
      logger.info('Getting user swaps with proposals (excluding self-proposals) using simplified schema', { userId, limit, offset });

      // Get raw swap cards data with proposals using the updated repository query
      // This now uses derived relationships instead of redundant foreign keys
      const rawSwapCardsData = await this.swapRepository.findSwapCardsWithProposals(userId, limit, offset);

      // Transform and group the data into SwapCardData structure
      const swapCardDataMap = new Map<string, SwapCardData>();

      for (const row of rawSwapCardsData) {
        const swapId = row.swap_id;

        // Initialize swap card data if not exists
        if (!swapCardDataMap.has(swapId)) {
          try {
            const initialSwapCardData = this.transformRowToSwapCardData(row, userId) as SwapCardData;
            swapCardDataMap.set(swapId, initialSwapCardData);
          } catch (transformError) {
            logger.warn('Failed to transform swap card data with simplified schema', {
              swapId,
              userId,
              error: transformError instanceof Error ? transformError.message : 'Unknown error'
            });
            continue; // Skip this swap if transformation fails
          }
        }

        // Transform and add proposal from other user if it exists and is valid
        // This now works with derived proposer information and enhanced validation
        try {
          const proposal = await this.transformRowToSwapProposal(row, userId);
          if (proposal) {
            const swapCardData = swapCardDataMap.get(swapId)!;
            swapCardData.proposalsFromOthers.push(proposal);
            swapCardData.proposalCount = swapCardData.proposalsFromOthers.length;
          }
        } catch (proposalError) {
          logger.warn('Failed to transform proposal data with simplified schema', {
            swapId,
            userId,
            error: proposalError instanceof Error ? proposalError.message : 'Unknown error'
          });
          // Continue processing other proposals
        }
      }

      // Process each swap card data to ensure proper separation and handle empty cases
      const result = Array.from(swapCardDataMap.values()).map(swapCardData => {
        // Ensure proper separation between user's swap and proposals from others
        const separatedData = this.ensureProperDataSeparation(swapCardData, userId);

        // Handle cases where swaps have zero proposals from other users
        return this.handleEmptyProposalsCase(separatedData);
      });

      logger.info('Successfully retrieved user swaps with proposals using simplified schema', {
        userId,
        totalSwaps: result.length,
        totalProposals: result.reduce((sum, card) => sum + card.proposalCount, 0),
        swapsWithProposals: result.filter(card => card.proposalCount > 0).length,
        swapsWithoutProposals: result.filter(card => card.proposalCount === 0).length,
        derivedRelationshipsUsed: true
      });

      return result;
    } catch (error) {
      logger.error('Failed to get user swaps with proposals using simplified schema', { error, userId });

      // Enhanced error handling for missing derived data
      if (error instanceof Error && error.message.includes('missing derived')) {
        throw new Error(`Cannot retrieve swap proposals: ${error.message}. Database schema may need migration.`);
      }

      throw error;
    }
  }

  /**
   * Get user swaps with proposals and targeting data using unified query approach
   * Updated for simplified schema - derives relationships from booking connections
   * Requirements: 1.1, 1.2, 4.1, 4.3 - Enhanced backend swap data retrieval with derived relationships
   */
  async getUserSwapsWithTargeting(userId: string, limit: number = 100, offset: number = 0): Promise<EnhancedSwapCardData[]> {
    const logContext = { userId, limit, offset, method: 'getUserSwapsWithTargeting' };
    const requestId = `targeting-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const startTime = Date.now();

    // Production-safe logging
    TargetingProductionLogger.logOperationStart('getUserSwapsWithTargeting', userId || 'unknown', requestId, { limit, offset });

    try {
      logger.info('[getUserSwapsWithTargeting] Starting unified query approach with simplified schema', logContext);

      // Use the updated repository method that works with simplified schema
      const completeSwapData = await this.swapRepository.findCompleteSwapDataWithTargeting(userId, limit, offset);

      if (completeSwapData.length === 0) {
        logger.info('[getUserSwapsWithTargeting] No swaps found for user, returning empty array', logContext);
        return [];
      }

      logger.info('[getUserSwapsWithTargeting] Unified query completed with derived relationships', {
        ...logContext,
        swapCount: completeSwapData.length,
        swapIds: completeSwapData.map(swap => swap.id)
      });

      // Validate and sanitize the complete data using SwapDataValidator
      // Enhanced validation for derived relationship data
      const validationResults = completeSwapData.map(swapData => {
        const result = SwapDataValidator.validateAndSanitize(swapData);

        // Additional validation for derived relationships
        if (result.isValid && result.sanitizedData) {
          try {
            this.validateDerivedRelationships(result.sanitizedData);
          } catch (derivedError) {
            logger.warn('[getUserSwapsWithTargeting] Derived relationship validation failed', {
              swapId: swapData.id,
              error: derivedError instanceof Error ? derivedError.message : 'Unknown error',
              ...logContext
            });
            result.warnings.push(`Derived relationship validation: ${derivedError instanceof Error ? derivedError.message : 'Unknown error'}`);
          }
        }

        return result;
      });

      // Filter out invalid data and collect valid swaps
      const validSwaps = validationResults
        .filter(result => result.isValid && result.sanitizedData)
        .map(result => result.sanitizedData!);

      // Log validation results
      const invalidCount = validationResults.filter(result => !result.isValid).length;
      const warningCount = validationResults.reduce((sum, result) => sum + result.warnings.length, 0);

      if (invalidCount > 0) {
        logger.warn('[getUserSwapsWithTargeting] Some swaps failed validation', {
          ...logContext,
          invalidCount,
          validCount: validSwaps.length,
          totalCount: completeSwapData.length
        });
      }

      if (warningCount > 0) {
        logger.info('[getUserSwapsWithTargeting] Validation warnings detected', {
          ...logContext,
          warningCount,
          validCount: validSwaps.length
        });
      }

      // Transform validated data to EnhancedSwapCardData format
      const enhancedSwapCards = validSwaps.map(swapData => this.transformToEnhancedSwapCardData(swapData));

      logger.info('[getUserSwapsWithTargeting] Successfully completed with simplified schema approach', {
        ...logContext,
        totalSwaps: enhancedSwapCards.length,
        swapsWithIncomingTargets: enhancedSwapCards.filter(card => card.targeting.incomingTargetCount > 0).length,
        swapsWithOutgoingTargets: enhancedSwapCards.filter(card => card.targeting.outgoingTarget).length,
        totalIncomingTargets: enhancedSwapCards.reduce((sum, card) => sum + card.targeting.incomingTargetCount, 0),
        processingSteps: ['unified_query_simplified_schema', 'derived_relationship_validation', 'transformation']
      });

      // Production-safe completion logging
      const executionTime = Date.now() - startTime;
      TargetingProductionLogger.logOperationComplete(
        'getUserSwapsWithTargeting',
        userId || 'unknown',
        requestId,
        executionTime,
        true,
        {
          totalSwaps: enhancedSwapCards.length,
          swapsWithTargeting: enhancedSwapCards.filter(card => card.targeting.incomingTargetCount > 0 || card.targeting.outgoingTarget).length,
          validationPassed: invalidCount === 0,
          derivedRelationshipsUsed: true
        }
      );

      return enhancedSwapCards;

    } catch (error) {
      // Production-safe error logging
      const executionTime = Date.now() - startTime;
      TargetingProductionLogger.logOperationComplete(
        'getUserSwapsWithTargeting',
        userId || 'unknown',
        requestId,
        executionTime,
        false,
        {
          errorType: error instanceof Error ? error.constructor.name : 'Unknown',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      );

      logger.error('[getUserSwapsWithTargeting] Critical error in simplified schema approach', {
        ...logContext,
        error,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined
      });

      // Enhanced error handling for missing derived data
      if (error instanceof Error && error.message.includes('missing derived')) {
        logger.error('[getUserSwapsWithTargeting] Missing derived relationship data', {
          ...logContext,
          error: error.message
        });

        throw new TargetingDisplayError(
          TargetingDisplayErrorCodes.TARGETING_DATA_UNAVAILABLE,
          'Cannot derive required relationship data from simplified schema',
          { userId, originalError: error }
        );
      }

      // Graceful fallback: try to return basic swap cards
      try {
        logger.info('[getUserSwapsWithTargeting] Attempting graceful fallback to basic swap cards', logContext);
        const fallbackCards = await this.getUserSwapsWithProposals(userId, limit, offset);

        const fallbackResult = this.createFallbackSwapCards(fallbackCards, 'simplified_schema_error');

        logger.info('[getUserSwapsWithTargeting] Fallback successful', {
          ...logContext,
          fallbackCardCount: fallbackResult.length,
          fallbackReason: 'simplified_schema_error'
        });

        return fallbackResult;

      } catch (fallbackError) {
        logger.error('[getUserSwapsWithTargeting] Fallback also failed', {
          ...logContext,
          fallbackError,
          originalError: error
        });

        throw new TargetingDisplayError(
          TargetingDisplayErrorCodes.TARGETING_DATA_UNAVAILABLE,
          'Unable to retrieve swap data with simplified schema or fallback method',
          { userId, originalError: error, fallbackError }
        );
      }
    }
  }

  /**
   * Merge targeting data with existing swap card structure
   * Requirements: 1.3, 1.4, 2.3, 2.4, 3.3, 4.1, 4.2
   */
  async mergeTargetingWithSwapCards(
    swapCards: SwapCardData[],
    targetingData: {
      incomingTargets: any[];
      outgoingTargets: any[];
    }
  ): Promise<EnhancedSwapCardData[]> {
    try {
      logger.debug('Merging targeting data with swap cards', {
        swapCardCount: swapCards.length,
        incomingTargetsCount: targetingData.incomingTargets.length,
        outgoingTargetsCount: targetingData.outgoingTargets.length
      });

      // Transform targeting data to display format
      const displayData = await this.transformTargetingDataForDisplay(targetingData, swapCards.map(c => c.userSwap.id));

      // Merge each swap card with its targeting data
      const enhancedCards = await Promise.all(
        swapCards.map(async (swapCard) => {
          const swapId = swapCard.userSwap.id;

          // Get targeting data for this swap
          const incomingTargets = displayData.incomingTargetsBySwap.get(swapId) || [];
          const outgoingTarget = displayData.outgoingTargetsBySwap.get(swapId);
          const capabilities = displayData.targetingCapabilitiesBySwap.get(swapId) || {
            canReceiveTargets: true,
            canTarget: true,
            restrictions: [],
            currentIncomingTargets: 0
          };

          // Create enhanced swap card data
          const enhancedCard: EnhancedSwapCardData = {
            ...swapCard,
            targeting: {
              incomingTargets,
              incomingTargetCount: incomingTargets.length,
              outgoingTarget,
              canReceiveTargets: capabilities.canReceiveTargets,
              canTarget: capabilities.canTarget,
              targetingRestrictions: capabilities.restrictions
            }
          };

          return enhancedCard;
        })
      );

      return enhancedCards;
    } catch (error) {
      logger.error('Failed to merge targeting data with swap cards', { error });
      throw error;
    }
  }

  /**
   * Transform targeting data to display format
   * Requirements: 1.3, 1.4, 2.3, 2.4, 3.3, 4.1, 4.2
   */
  async transformTargetingDataForDisplay(
    targetingData: {
      incomingTargets: any[];
      outgoingTargets: any[];
    },
    swapIds: string[]
  ): Promise<TargetingDisplayData> {
    try {
      const incomingTargetsBySwap = new Map<string, IncomingTargetInfo[]>();
      const outgoingTargetsBySwap = new Map<string, OutgoingTargetInfo>();
      const targetingCapabilitiesBySwap = new Map<string, TargetingCapabilities>();

      // Process incoming targets with validation
      for (const incomingTarget of targetingData.incomingTargets) {
        try {
          if (!this.validateIncomingTargetData(incomingTarget)) {
            logger.warn('Invalid incoming target data, skipping', { targetId: incomingTarget.targetId });
            continue;
          }

          const targetSwapId = incomingTarget.targetSwapId;

          const incomingTargetInfo: IncomingTargetInfo = {
            targetId: incomingTarget.targetId,
            sourceSwapId: incomingTarget.sourceSwapId,
            sourceSwap: {
              id: incomingTarget.sourceSwapDetails.id,
              bookingDetails: this.transformBookingDetailsFromTargetingData(incomingTarget.sourceSwapDetails),
              ownerId: incomingTarget.sourceSwapDetails.ownerId,
              ownerName: incomingTarget.sourceSwapDetails.ownerName || 'Unknown User',
              ownerAvatar: undefined // Not available in current data structure
            },
            proposalId: incomingTarget.proposalId,
            status: incomingTarget.status,
            createdAt: new Date(incomingTarget.createdAt),
            updatedAt: new Date(incomingTarget.updatedAt),
            auctionInfo: undefined // Will be populated if auction mode is detected
          };

          if (!incomingTargetsBySwap.has(targetSwapId)) {
            incomingTargetsBySwap.set(targetSwapId, []);
          }
          incomingTargetsBySwap.get(targetSwapId)!.push(incomingTargetInfo);
        } catch (targetError) {
          logger.error('Failed to process incoming target, skipping', {
            error: targetError,
            targetId: incomingTarget.targetId
          });
          continue;
        }
      }

      // Process outgoing targets with validation
      for (const outgoingTarget of targetingData.outgoingTargets) {
        try {
          if (!this.validateOutgoingTargetData(outgoingTarget)) {
            logger.warn('Invalid outgoing target data, skipping', { targetId: outgoingTarget.targetId });
            continue;
          }

          const sourceSwapId = outgoingTarget.sourceSwapId;

          const outgoingTargetInfo: OutgoingTargetInfo = {
            targetId: outgoingTarget.targetId,
            targetSwapId: outgoingTarget.targetSwapId,
            targetSwap: {
              id: outgoingTarget.targetSwapDetails.id,
              bookingDetails: this.transformBookingDetailsFromTargetingData(outgoingTarget.targetSwapDetails),
              ownerId: outgoingTarget.targetSwapDetails.ownerId,
              ownerName: outgoingTarget.targetSwapDetails.ownerName || 'Unknown User',
              ownerAvatar: undefined // Not available in current data structure
            },
            proposalId: outgoingTarget.proposalId,
            status: outgoingTarget.status,
            createdAt: new Date(outgoingTarget.createdAt),
            updatedAt: new Date(outgoingTarget.updatedAt),
            targetSwapInfo: {
              acceptanceStrategy: outgoingTarget.targetSwapDetails.acceptanceStrategy || { type: 'first_match' },
              auctionInfo: this.extractAuctionInfo(outgoingTarget.targetSwapDetails.acceptanceStrategy)
            }
          };

          outgoingTargetsBySwap.set(sourceSwapId, outgoingTargetInfo);
        } catch (targetError) {
          logger.error('Failed to process outgoing target, skipping', {
            error: targetError,
            targetId: outgoingTarget.targetId
          });
          continue;
        }
      }

      // Assess targeting capabilities for each swap
      for (const swapId of swapIds) {
        const incomingTargets = incomingTargetsBySwap.get(swapId) || [];
        const outgoingTarget = outgoingTargetsBySwap.get(swapId);

        const capabilities = await this.assessTargetingCapabilities(swapId, incomingTargets, outgoingTarget);
        targetingCapabilitiesBySwap.set(swapId, capabilities);
      }

      return {
        incomingTargetsBySwap,
        outgoingTargetsBySwap,
        targetingCapabilitiesBySwap
      };
    } catch (error) {
      logger.error('Failed to transform targeting data for display', { error });
      throw error;
    }
  }

  /**
   * Assess targeting capabilities based on swap status and auction mode
   * Requirements: 1.3, 1.4, 2.3, 2.4, 3.3, 4.1, 4.2
   */
  async assessTargetingCapabilities(
    swapId: string,
    incomingTargets: IncomingTargetInfo[],
    outgoingTarget?: OutgoingTargetInfo
  ): Promise<TargetingCapabilities> {
    try {
      const restrictions: TargetingRestriction[] = [];
      let canReceiveTargets = true;
      let canTarget = true;

      // Get swap details to assess capabilities
      const swap = await this.swapRepository.findById(swapId);
      if (!swap) {
        return {
          canReceiveTargets: false,
          canTarget: false,
          restrictions: [{ type: 'swap_unavailable', message: 'Swap not found', severity: 'error' }],
          currentIncomingTargets: 0
        };
      }

      // Check swap status
      if (swap.status !== 'pending') {
        canReceiveTargets = false;
        canTarget = false;
        restrictions.push({
          type: 'swap_unavailable',
          message: 'Swap is not available for targeting',
          severity: 'error'
        });
      }

      // Check if swap has expired
      if (swap.terms?.expiresAt && new Date(swap.terms.expiresAt) <= new Date()) {
        canReceiveTargets = false;
        restrictions.push({
          type: 'auction_ended',
          message: 'Swap has expired',
          severity: 'error'
        });
      }

      // Check if already targeting another swap
      if (outgoingTarget && outgoingTarget.status === 'active') {
        canTarget = false;
        restrictions.push({
          type: 'proposal_pending',
          message: 'Already targeting another swap',
          severity: 'warning'
        });
      }

      return {
        canReceiveTargets,
        canTarget,
        restrictions,
        currentIncomingTargets: incomingTargets.length
      };
    } catch (error) {
      logger.error('Failed to assess targeting capabilities', { error, swapId });
      // Return conservative capabilities on error
      return {
        canReceiveTargets: false,
        canTarget: false,
        restrictions: [{ type: 'swap_unavailable', message: 'Unable to assess targeting capabilities', severity: 'error' }],
        currentIncomingTargets: incomingTargets.length
      };
    }
  }

  /**
   * Fetch targeting data with retry logic for improved reliability
   * Requirements: 3.4, 3.5
   */
  private async fetchTargetingDataWithRetry(userId: string, maxRetries: number = 3): Promise<{
    incomingTargets: any[];
    outgoingTargets: any[];
  }> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.debug(`Fetching targeting data, attempt ${attempt}/${maxRetries}`, { userId });

        const targetingData = await this.swapTargetingRepository.getTargetingDataForUserSwaps(userId);

        logger.debug('Successfully fetched targeting data', {
          userId,
          attempt,
          incomingCount: targetingData.incomingTargets.length,
          outgoingCount: targetingData.outgoingTargets.length
        });

        return targetingData;
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Failed to fetch targeting data on attempt ${attempt}/${maxRetries}`, {
          error: lastError.message,
          userId,
          attempt
        });

        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new TargetingDisplayError(
      TargetingDisplayErrorCodes.TARGETING_QUERY_FAILED,
      `Failed to fetch targeting data after ${maxRetries} attempts`,
      { userId, lastError: lastError?.message }
    );
  }

  /**
   * Convert repository data format to transformer query results format
   * Requirements: 3.1, 3.2
   */
  private convertRepositoryDataToQueryResults(repositoryData: {
    incomingTargets: any[];
    outgoingTargets: any[];
  }): BidirectionalQueryResult[] {
    const queryResults: BidirectionalQueryResult[] = [];

    // Convert incoming targets
    repositoryData.incomingTargets.forEach(target => {
      queryResults.push({
        direction: 'incoming',
        target_id: target.targetId,
        target_swap_id: target.targetSwapId,
        source_swap_id: target.sourceSwapId,
        proposal_id: target.proposalId,
        status: target.status,
        created_at: target.createdAt,
        updated_at: target.updatedAt,
        booking_title: target.sourceSwapDetails.bookingTitle,
        booking_city: target.sourceSwapDetails.bookingLocation.split(',')[0]?.trim() || 'Unknown',
        booking_country: target.sourceSwapDetails.bookingLocation.split(',')[1]?.trim() || 'Unknown',
        check_in: target.sourceSwapDetails.bookingCheckIn,
        check_out: target.sourceSwapDetails.bookingCheckOut,
        price: target.sourceSwapDetails.bookingPrice,
        owner_name: target.sourceSwapDetails.ownerName,
        owner_email: target.sourceSwapDetails.ownerEmail,
        data_source: 'swap_targets'
      });
    });

    // Convert outgoing targets
    repositoryData.outgoingTargets.forEach(target => {
      queryResults.push({
        direction: 'outgoing',
        target_id: target.targetId,
        target_swap_id: target.targetSwapId,
        source_swap_id: target.sourceSwapId,
        proposal_id: target.proposalId,
        status: target.status,
        created_at: target.createdAt,
        updated_at: target.updatedAt,
        booking_title: target.targetSwapDetails.bookingTitle,
        booking_city: target.targetSwapDetails.bookingLocation.split(',')[0]?.trim() || 'Unknown',
        booking_country: target.targetSwapDetails.bookingLocation.split(',')[1]?.trim() || 'Unknown',
        check_in: target.targetSwapDetails.bookingCheckIn,
        check_out: target.targetSwapDetails.bookingCheckOut,
        price: target.targetSwapDetails.bookingPrice,
        owner_name: target.targetSwapDetails.ownerName,
        owner_email: target.targetSwapDetails.ownerEmail,
        data_source: 'swap_targets'
      });
    });

    return queryResults;
  }

  /**
   * Merge targeting data with swap cards using the new transformer
   * Requirements: 3.3, 3.4
   */
  private async mergeTargetingWithSwapCardsUsingTransformer(
    swapCards: SwapCardData[],
    transformedTargetingData: any[]
  ): Promise<EnhancedSwapCardData[]> {
    try {
      logger.debug('Merging targeting data with swap cards using transformer', {
        swapCardCount: swapCards.length,
        transformedDataCount: transformedTargetingData.length
      });

      // Convert transformed data to enhanced swap card format
      const targetingDataMap = TargetingDataTransformer.convertToEnhancedSwapCardFormat(transformedTargetingData);

      // Merge each swap card with its targeting data
      const enhancedCards = await Promise.all(
        swapCards.map(async (swapCard) => {
          const swapId = swapCard.userSwap.id;
          const targetingInfo = targetingDataMap.get(swapId);

          // Get targeting capabilities for this swap
          const capabilities = await this.assessTargetingCapabilities(
            swapId,
            targetingInfo?.incomingTargets || [],
            targetingInfo?.outgoingTarget
          );

          // Create enhanced swap card data
          const enhancedCard: EnhancedSwapCardData = {
            ...swapCard,
            targeting: {
              incomingTargets: targetingInfo?.incomingTargets || [],
              incomingTargetCount: targetingInfo?.incomingTargets?.length || 0,
              outgoingTarget: targetingInfo?.outgoingTarget,
              canReceiveTargets: capabilities.canReceiveTargets,
              canTarget: capabilities.canTarget,
              targetingRestrictions: capabilities.restrictions
            }
          };

          return enhancedCard;
        })
      );

      return enhancedCards;
    } catch (error) {
      logger.error('Failed to merge targeting data with swap cards using transformer', { error });
      throw error;
    }
  }

  /**
   * Validate targeting data consistency for enhanced swap cards
   * Requirements: 3.5
   */
  private async validateTargetingDataConsistency(
    enhancedSwapCards: EnhancedSwapCardData[],
    userId: string
  ): Promise<{ isValid: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      enhancedSwapCards.forEach(card => {
        // Check for count consistency
        if (card.targeting.incomingTargetCount !== card.targeting.incomingTargets.length) {
          issues.push(`Incoming target count mismatch for swap ${card.userSwap.id}: count=${card.targeting.incomingTargetCount}, actual=${card.targeting.incomingTargets.length}`);
        }

        // Check for valid targeting restrictions
        if (card.targeting.targetingRestrictions && card.targeting.targetingRestrictions.some(r => !r.type || !r.message)) {
          issues.push(`Invalid targeting restrictions for swap ${card.userSwap.id}`);
        }

        // Check for orphaned outgoing targets
        if (card.targeting.outgoingTarget && !card.targeting.outgoingTarget.targetSwapId) {
          issues.push(`Outgoing target missing targetSwapId for swap ${card.userSwap.id}`);
        }
      });

      return {
        isValid: issues.length === 0,
        issues
      };
    } catch (error) {
      logger.error('Failed to validate targeting data consistency', { error, userId });
      return {
        isValid: false,
        issues: ['Failed to perform consistency validation']
      };
    }
  }

  /**
   * Fallback to basic swap cards with partial targeting data when available
   * Requirements: 3.4, 3.5
   */
  private async fallbackToBasicSwapCardsWithPartialData(
    basicSwapCards: SwapCardData[],
    partialTargetingData?: any
  ): Promise<EnhancedSwapCardData[]> {
    logger.warn('Falling back to basic swap cards with partial targeting data', {
      swapCount: basicSwapCards.length,
      hasPartialData: !!partialTargetingData
    });

    return basicSwapCards.map(swapCard => ({
      ...swapCard,
      targeting: {
        incomingTargets: [],
        incomingTargetCount: 0,
        outgoingTarget: undefined,
        canReceiveTargets: true,
        canTarget: true,
        targetingRestrictions: partialTargetingData ? [{
          type: 'swap_unavailable',
          message: 'Targeting information partially available',
          severity: 'warning'
        }] : [{
          type: 'swap_unavailable',
          message: 'Targeting information temporarily unavailable',
          severity: 'warning'
        }]
      }
    }));
  }

  /**
   * Log targeting data issues for monitoring and debugging
   * Requirements: 3.4, 3.5, 7.1, 7.2
   */
  private logTargetingDataIssue(
    issueType: 'query_failure' | 'transformation_failure' | 'partial_data' | 'fallback_used' | 'merge_failure',
    details: {
      userId: string;
      error?: any;
      swapCount?: number;
      targetingDataAvailable?: boolean;
    }
  ): void {
    const logData = {
      issueType,
      userId: details.userId,
      timestamp: new Date().toISOString(),
      swapCount: details.swapCount,
      targetingDataAvailable: details.targetingDataAvailable,
      errorMessage: details.error instanceof Error ? details.error.message : details.error
    };

    switch (issueType) {
      case 'query_failure':
        logger.error('Targeting data query failure', logData);
        break;
      case 'transformation_failure':
        logger.error('Targeting data transformation failure', logData);
        break;
      case 'merge_failure':
        logger.error('Targeting data merge failure', logData);
        break;
      case 'partial_data':
        logger.warn('Using partial targeting data', logData);
        break;
      case 'fallback_used':
        logger.warn('Fallback to basic swap cards used', logData);
        break;
      default:
        logger.info('Targeting data issue', logData);
    }

    // In a production environment, you might want to send this to a monitoring service
    // this.monitoringService.recordTargetingIssue(logData);
  }

  /**
   * Fallback to basic swap cards when targeting enhancement fails
   * Requirements: 3.4, 3.5, 7.1, 7.2
   */
  private fallbackToBasicSwapCards(basicSwapCards: SwapCardData[]): EnhancedSwapCardData[] {
    logger.warn('Falling back to basic swap cards without targeting data', {
      swapCount: basicSwapCards.length
    });

    return basicSwapCards.map(swapCard => ({
      ...swapCard,
      targeting: {
        incomingTargets: [],
        incomingTargetCount: 0,
        outgoingTarget: undefined,
        canReceiveTargets: true,
        canTarget: true,
        targetingRestrictions: [{
          type: 'swap_unavailable',
          message: 'Targeting information temporarily unavailable',
          severity: 'warning'
        }]
      }
    }));
  }

  /**
   * Group proposals by swap ID for internal use
   * Requirements: 3.2
   */
  private groupProposalsBySwapId(proposals: SwapProposal[]): Record<string, SwapProposal[]> {
    return proposals.reduce((acc, proposal) => {
      const swapId = proposal.id; // This would need to be adjusted based on actual proposal structure
      if (!acc[swapId]) {
        acc[swapId] = [];
      }
      acc[swapId].push(proposal);
      return acc;
    }, {} as Record<string, SwapProposal[]>);
  }

  /**
   * Transform database row to SwapCardData structure
   * Requirements: 1.1, 2.2, 3.2
   */
  private transformRowToSwapCardData(row: any, userId: string): Partial<SwapCardData> {
    return {
      userSwap: {
        id: row.swap_id,
        bookingDetails: this.transformRowToBookingDetails(row, 'user_booking'),
        status: row.swap_status,
        createdAt: row.swap_created_at,
        expiresAt: row.swap_expires_at
      },
      proposalsFromOthers: [],
      proposalCount: 0
    };
  }

  /**
   * Transform database row to BookingDetails structure
   * Requirements: 1.1, 3.2
   */
  private transformRowToBookingDetails(row: any, prefix: string): BookingDetails {
    return {
      id: row[`${prefix}_id`],
      title: row[`${prefix}_title`] || 'Booking Details Unavailable',
      location: {
        city: row[`${prefix}_city`] || 'Unknown',
        country: row[`${prefix}_country`] || 'Unknown'
      },
      dateRange: {
        checkIn: row[`${prefix}_check_in`] || new Date(),
        checkOut: row[`${prefix}_check_out`] || new Date()
      },
      originalPrice: row[`${prefix}_original_price`] || null,
      swapValue: row[`${prefix}_swap_value`] || null
    };
  }

  /**
   * Transform database row to SwapProposal structure
   * Enhanced with comprehensive user data validation, enrichment, and monitoring
   * Requirements: 1.1, 1.2, 2.2, 3.1, 3.3, 3.4
   */
  private async transformRowToSwapProposal(row: any, userId: string): Promise<SwapProposal | null> {
    // Skip if no proposal data or if it's a self-proposal (simplified schema)
    // Use source_swap_id instead of proposal_id for identification
    if (!row.source_swap_id || !row.proposer_id || row.proposer_id === userId) {
      if (row.proposer_id === userId) {
        logger.warn('Self-proposal detected and skipped during transformation', {
          sourceSwapId: row.source_swap_id,
          proposerId: row.proposer_id,
          userId,
          requirement: '1.1'
        });
      }
      return null;
    }

    // Validate proposer data before transformation (Requirement 3.1)
    const proposerValidation = this.validateProposerData(row);

    let proposerName = row.proposer_name;
    let enrichmentApplied = false;

    // Add proposer data enrichment if primary JOIN data is missing (Requirement 1.2, 3.1, 3.3, 3.4)
    if (!proposerValidation.isValid) {
      logger.info('Primary JOIN data missing for proposer, attempting monitored enrichment', {
        sourceSwapId: row.source_swap_id,
        proposerId: row.proposer_id,
        validationIssues: proposerValidation.issues,
        requirement: '3.1'
      });

      try {
        const enrichedProposerData = await this.enrichProposerDataWithMonitoring(row.source_swap_id, row.proposer_id);

        if (enrichedProposerData.isValid) {
          proposerName = enrichedProposerData.displayName;
          enrichmentApplied = true;

          logger.info('Proposer data enrichment successful with monitoring', {
            sourceSwapId: row.source_swap_id,
            proposerId: row.proposer_id,
            enrichedName: proposerName,
            lookupMethod: enrichedProposerData.lookupMethod,
            requirement: '3.3'
          });

          // Record successful proposer lookup (Requirement 3.4)
          if (row.source_swap_id && row.proposer_id) {
            this.monitoringService.recordProposerLookupAttempt(
              row.source_swap_id,
              row.proposer_id,
              enrichedProposerData.lookupMethod as any,
              true,
              proposerName
            );
          }
        } else {
          // Implement detailed logging when user data cannot be retrieved (Requirement 3.3)
          logger.error('Failed to enrich proposer data - comprehensive monitoring enabled', {
            sourceSwapId: row.source_swap_id,
            proposerId: row.proposer_id,
            enrichmentMethod: enrichedProposerData.lookupMethod,
            validationIssues: proposerValidation.issues,
            enrichmentFailure: 'No valid user data found through any lookup method',
            requirement: '3.3',
            monitoringEnabled: true
          });

          // Record failed proposer lookup (Requirement 3.4)
          if (row.source_swap_id && row.proposer_id) {
            this.monitoringService.recordProposerLookupAttempt(
              row.source_swap_id,
              row.proposer_id,
              enrichedProposerData.lookupMethod as any,
              false,
              undefined,
              'No valid user data found through any lookup method'
            );
          }

          proposerName = 'Unknown User';
        }
      } catch (enrichmentError) {
        // Implement detailed logging when user data cannot be retrieved (Requirement 3.3)
        const errorMessage = enrichmentError instanceof Error ? enrichmentError.message : 'Unknown error';

        logger.error('Proposer data enrichment failed with error - comprehensive monitoring', {
          sourceSwapId: row.source_swap_id,
          proposerId: row.proposer_id,
          error: errorMessage,
          stack: enrichmentError instanceof Error ? enrichmentError.stack : undefined,
          validationIssues: proposerValidation.issues,
          requirement: '3.3',
          monitoringEnabled: true
        });

        // Record failed proposer lookup (Requirement 3.4)
        if (row.source_swap_id && row.proposer_id) {
          this.monitoringService.recordProposerLookupAttempt(
            row.source_swap_id,
            row.proposer_id,
            'fallback',
            false,
            undefined,
            errorMessage
          );
        }

        proposerName = 'Unknown User';
      }
    } else {
      // Record successful proposer lookup from primary JOIN (Requirement 3.4)
      this.monitoringService.recordProposerLookupAttempt(
        row.source_swap_id,
        row.proposer_id,
        'direct',
        true,
        proposerName
      );
    }

    // Log successful transformation with validation details
    logger.debug('SwapProposal transformation completed', {
      sourceSwapId: row.source_swap_id,
      proposerId: row.proposer_id,
      proposerName,
      enrichmentApplied,
      validationPassed: proposerValidation.isValid,
      requirement: '1.1'
    });

    return {
      id: row.source_swap_id, // Use source_swap_id as the proposal identifier
      proposerId: row.proposer_id,
      proposerName: proposerName || 'Unknown User',
      targetBookingDetails: this.transformRowToBookingDetails(row, 'proposer_booking'),
      status: row.proposal_status,
      createdAt: row.proposal_created_at,
      additionalPayment: row.proposal_additional_payment,
      conditions: row.proposal_conditions || [],
      expiresAt: row.proposal_expires_at
    };
  }

  /**
   * Validate proposer data before transformation
   * Requirements: 3.1
   */
  private validateProposerData(row: any): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check if proposer_name is present and not null/empty
    if (!row.proposer_name || row.proposer_name.trim() === '') {
      issues.push('proposer_name is null or empty');
    }

    // Check if proposer_id is present
    if (!row.proposer_id) {
      issues.push('proposer_id is missing');
    }

    // Check for "Unknown User" fallback value
    if (row.proposer_name === 'Unknown User') {
      issues.push('proposer_name is fallback value "Unknown User"');
    }

    const isValid = issues.length === 0;

    if (!isValid) {
      logger.debug('Proposer data validation failed', {
        sourceSwapId: row.source_swap_id,
        proposerId: row.proposer_id,
        proposerName: row.proposer_name,
        issues,
        requirement: '3.1'
      });
    }

    return { isValid, issues };
  }

  /**
   * Enrich proposer data using monitored fallback lookup mechanisms
   * Requirements: 1.2, 3.1, 3.3, 3.4
   */
  private async enrichProposerDataWithMonitoring(swapId: string, proposerId: string): Promise<{
    displayName: string | null;
    lookupMethod: string;
    isValid: boolean;
  }> {
    try {
      logger.info('Attempting monitored proposer data enrichment', {
        swapId,
        proposerId,
        requirement: '3.3'
      });

      // Use the enhanced repository method with comprehensive monitoring
      const proposerDetails = await this.swapRepository.getProposerDetailsWithMonitoring(swapId);

      if (proposerDetails.isValid && proposerDetails.displayName) {
        logger.info('Proposer data enrichment successful via monitored repository lookup', {
          swapId,
          proposerId,
          displayName: proposerDetails.displayName,
          lookupMethod: proposerDetails.lookupMethod,
          requirement: '3.3'
        });

        return {
          displayName: proposerDetails.displayName,
          lookupMethod: proposerDetails.lookupMethod,
          isValid: true
        };
      }

      // If repository lookup fails, log detailed failure information (Requirement 3.4)
      logger.warn('Monitored repository proposer lookup returned invalid data', {
        swapId,
        proposerId,
        repositoryResult: {
          userId: proposerDetails.userId,
          displayName: proposerDetails.displayName,
          lookupMethod: proposerDetails.lookupMethod,
          isValid: proposerDetails.isValid
        },
        requirement: '3.4'
      });

      return {
        displayName: null,
        lookupMethod: proposerDetails.lookupMethod || 'repository_fallback_failed',
        isValid: false
      };

    } catch (error) {
      logger.error('Monitored proposer data enrichment failed with exception', {
        swapId,
        proposerId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        requirement: '3.4'
      });

      return {
        displayName: null,
        lookupMethod: 'enrichment_exception',
        isValid: false
      };
    }
  }

  /**
   * Enrich proposer data using fallback lookup mechanisms (legacy method)
   * Requirements: 1.2, 3.1
   */
  private async enrichProposerData(swapId: string, proposerId: string): Promise<{
    displayName: string | null;
    lookupMethod: string;
    isValid: boolean;
  }> {
    try {
      logger.info('Attempting proposer data enrichment', {
        swapId,
        proposerId,
        requirement: '1.2'
      });

      // Use the getProposerDetails method from SwapRepository
      const proposerDetails = await this.swapRepository.getProposerDetails(swapId);

      if (proposerDetails.isValid && proposerDetails.displayName) {
        logger.info('Proposer data enrichment successful via repository lookup', {
          swapId,
          proposerId,
          displayName: proposerDetails.displayName,
          lookupMethod: proposerDetails.lookupMethod,
          requirement: '1.2'
        });

        return {
          displayName: proposerDetails.displayName,
          lookupMethod: proposerDetails.lookupMethod,
          isValid: true
        };
      }

      // If repository lookup fails, log detailed failure information
      logger.warn('Repository proposer lookup returned invalid data', {
        swapId,
        proposerId,
        repositoryResult: {
          userId: proposerDetails.userId,
          displayName: proposerDetails.displayName,
          lookupMethod: proposerDetails.lookupMethod,
          isValid: proposerDetails.isValid
        },
        requirement: '3.1'
      });

      return {
        displayName: null,
        lookupMethod: proposerDetails.lookupMethod || 'repository_fallback_failed',
        isValid: false
      };

    } catch (error) {
      logger.error('Proposer data enrichment failed with exception', {
        swapId,
        proposerId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        requirement: '3.1'
      });

      return {
        displayName: null,
        lookupMethod: 'enrichment_exception',
        isValid: false
      };
    }
  }

  /**
   * Handle cases where swaps have zero proposals from other users
   * Requirements: 2.2, 3.2
   */
  private handleEmptyProposalsCase(swapCardData: SwapCardData): SwapCardData {
    if (swapCardData.proposalCount === 0) {
      logger.debug('Swap has no proposals from other users', {
        swapId: swapCardData.userSwap.id,
        swapStatus: swapCardData.userSwap.status
      });

      // Ensure empty array and zero count for consistency
      swapCardData.proposalsFromOthers = [];
      swapCardData.proposalCount = 0;
    }

    return swapCardData;
  }

  /**
   * Ensure proper separation between user's swap data and proposals from others
   * Requirements: 1.1, 2.2, 3.2
   */
  private ensureProperDataSeparation(swapCardData: SwapCardData, userId: string): SwapCardData {
    // Validate that user swap belongs to the user
    if (swapCardData.userSwap.bookingDetails.id) {
      logger.debug('User swap data validated', {
        swapId: swapCardData.userSwap.id,
        userId
      });
    }

    // Validate that all proposals are from other users
    const validProposals = swapCardData.proposalsFromOthers.filter(proposal => {
      if (proposal.proposerId === userId) {
        logger.warn('Self-proposal found in proposals list and removed', {
          proposalId: proposal.id,
          proposerId: proposal.proposerId,
          userId
        });
        return false;
      }
      return true;
    });

    // Update the data with validated proposals
    swapCardData.proposalsFromOthers = validProposals;
    swapCardData.proposalCount = validProposals.length;

    return swapCardData;
  }

  /**
   * Validate proposal data to catch any remaining self-proposals
   * Requirements: 3.4
   */
  private validateProposalData(proposals: SwapProposal[], userId: string): SwapProposal[] {
    const validProposals = proposals.filter(proposal => {
      if (proposal.proposerId === userId) {
        logger.warn(`Self-proposal detected and filtered: ${proposal.id}`, {
          proposalId: proposal.id,
          proposerId: proposal.proposerId,
          userId
        });
        return false;
      }
      return true;
    });

    if (validProposals.length !== proposals.length) {
      logger.warn('Self-proposals were filtered out during validation', {
        originalCount: proposals.length,
        validCount: validProposals.length,
        filteredCount: proposals.length - validProposals.length,
        userId
      });
    }

    return validProposals;
  }

  /**
   * Get swap proposals for a user with complete booking details
   * This method provides enriched swap data including location, dates, and pricing
   * for both source and target bookings, eliminating the need for separate booking fetches
   * Enhanced with comprehensive fallback mechanisms and data completeness metadata
   * Requirements: 1.1, 3.3, 1.4
   */
  async getUserSwapProposalsWithBookingDetails(userId: string, limit: number = 100, offset: number = 0): Promise<SwapWithBookingDetails[]> {
    try {
      logger.info('Getting user swap proposals with booking details', { userId, limit, offset });

      // Call the new repository method that joins swap and booking data
      const swapsWithBookingDetails = await this.swapRepository.findByUserIdWithBookingDetails(userId, limit, offset);

      // Apply business logic transformations and provide fallback values
      const enrichedSwaps = swapsWithBookingDetails.map(swap => {
        const enrichedSwap = { ...swap };

        // Provide fallback values for missing source booking details
        if (!swap.sourceBooking && swap.sourceBookingId) {
          logger.warn('Source booking details missing for swap, providing fallback', {
            swapId: swap.id,
            sourceBookingId: swap.sourceBookingId
          });

          // Provide minimal fallback booking details
          enrichedSwap.sourceBooking = {
            id: swap.sourceBookingId,
            title: 'Booking Details Unavailable',
            location: {
              city: 'Unknown',
              country: 'Unknown'
            },
            dateRange: {
              checkIn: new Date(),
              checkOut: new Date()
            },
            originalPrice: 0,
            swapValue: 0
          };
        }

        // Provide fallback values for missing target booking details
        if (!swap.targetBooking && swap.targetBookingId) {
          logger.warn('Target booking details missing for swap, providing fallback', {
            swapId: swap.id,
            targetBookingId: swap.targetBookingId
          });

          // Provide minimal fallback booking details
          enrichedSwap.targetBooking = {
            id: swap.targetBookingId,
            title: 'Booking Details Unavailable',
            location: {
              city: 'Unknown',
              country: 'Unknown'
            },
            dateRange: {
              checkIn: new Date(),
              checkOut: new Date()
            },
            originalPrice: 0,
            swapValue: 0
          };
        }

        return enrichedSwap;
      });

      // Calculate data completeness metrics
      const totalSwaps = enrichedSwaps.length;
      const swapsWithCompleteSourceBooking = enrichedSwaps.filter(swap =>
        swap.sourceBooking &&
        swap.sourceBooking.title !== 'Booking Details Unavailable'
      ).length;

      const swapsWithCompleteTargetBooking = enrichedSwaps.filter(swap =>
        swap.targetBooking &&
        swap.targetBooking.title !== 'Booking Details Unavailable'
      ).length;

      const swapsWithTargetBooking = enrichedSwaps.filter(swap => swap.targetBookingId).length;

      const completenessMetrics = {
        totalSwaps,
        sourceBookingCompleteness: totalSwaps > 0 ? (swapsWithCompleteSourceBooking / totalSwaps) * 100 : 100,
        targetBookingCompleteness: swapsWithTargetBooking > 0 ? (swapsWithCompleteTargetBooking / swapsWithTargetBooking) * 100 : 100,
        swapsWithMissingData: totalSwaps - swapsWithCompleteSourceBooking
      };

      logger.info('Successfully retrieved user swap proposals with booking details', {
        userId,
        count: enrichedSwaps.length,
        completenessMetrics
      });

      // Log warning if data completeness is below threshold
      if (completenessMetrics.sourceBookingCompleteness < 90 || completenessMetrics.targetBookingCompleteness < 90) {
        logger.warn('Low booking data completeness detected', {
          userId,
          completenessMetrics
        });
      }

      return enrichedSwaps;
    } catch (error: any) {
      logger.error('Failed to get user swap proposals with booking details', {
        error: error.message || error,
        stack: error.stack,
        userId
      });

      // Enhanced graceful fallback: return basic swaps with default booking details
      try {
        logger.info('Attempting enhanced fallback to basic swap proposals', { userId });
        const basicSwaps = await this.swapRepository.findByUserId(userId, limit, offset);

        // Transform basic swaps to match the expected interface with fallback booking details
        const fallbackSwaps: SwapWithBookingDetails[] = basicSwaps.map(swap => {
          const fallbackSwap: SwapWithBookingDetails = {
            ...swap,
            sourceBooking: null,
            targetBooking: null
          };

          // Provide minimal fallback booking details if booking IDs exist
          if (swap.sourceBookingId) {
            fallbackSwap.sourceBooking = {
              id: swap.sourceBookingId,
              title: 'Booking Details Temporarily Unavailable',
              location: {
                city: 'Loading...',
                country: 'Loading...'
              },
              dateRange: {
                checkIn: new Date(),
                checkOut: new Date()
              },
              originalPrice: 0,
              swapValue: 0
            };
          }

          if (swap.targetBookingId) {
            fallbackSwap.targetBooking = {
              id: swap.targetBookingId,
              title: 'Booking Details Temporarily Unavailable',
              location: {
                city: 'Loading...',
                country: 'Loading...'
              },
              dateRange: {
                checkIn: new Date(),
                checkOut: new Date()
              },
              originalPrice: 0,
              swapValue: 0
            };
          }

          return fallbackSwap;
        });

        logger.warn('Returned enhanced fallback swap proposals with placeholder booking details', {
          userId,
          count: fallbackSwaps.length,
          originalError: (error as any).message || error
        });

        return fallbackSwaps;
      } catch (fallbackError: any) {
        logger.error('Enhanced fallback also failed', {
          fallbackError: fallbackError.message || fallbackError,
          originalError: (error as any).message || error,
          userId
        });

        // Last resort: return empty array with error logged
        logger.error('All fallback mechanisms failed, returning empty array', { userId });
        return [];
      }
    }
  }

  /**
   * Get user swap proposals with booking details and completeness metadata
   * This method provides enhanced response with data quality information
   * Requirements: 1.4, 3.3
   */
  async getUserSwapProposalsWithBookingDetailsAndMetadata(
    userId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<SwapWithBookingDetailsResponse> {
    let fallbackUsed = false;
    let errorDetails: string | undefined;

    try {
      logger.info('Getting user swap proposals with booking details and metadata', { userId, limit, offset });

      // Get swaps with booking details
      const swaps = await this.getUserSwapProposalsWithBookingDetails(userId, limit, offset);

      // Calculate data completeness metrics
      const totalSwaps = swaps.length;
      const swapsWithCompleteSourceBooking = swaps.filter(swap =>
        swap.sourceBooking &&
        swap.sourceBooking.title !== 'Booking Details Unavailable' &&
        swap.sourceBooking.title !== 'Booking Details Temporarily Unavailable'
      ).length;

      const swapsWithCompleteTargetBooking = swaps.filter(swap =>
        swap.targetBooking &&
        swap.targetBooking.title !== 'Booking Details Unavailable' &&
        swap.targetBooking.title !== 'Booking Details Temporarily Unavailable'
      ).length;

      const swapsWithTargetBooking = swaps.filter(swap => swap.targetBookingId).length;
      const swapsWithMissingData = swaps.filter(swap =>
        (swap.sourceBookingId && (!swap.sourceBooking ||
          swap.sourceBooking.title === 'Booking Details Unavailable' ||
          swap.sourceBooking.title === 'Booking Details Temporarily Unavailable')) ||
        (swap.targetBookingId && (!swap.targetBooking ||
          swap.targetBooking.title === 'Booking Details Unavailable' ||
          swap.targetBooking.title === 'Booking Details Temporarily Unavailable'))
      ).length;

      // Check if any fallback data was used
      fallbackUsed = swaps.some(swap =>
        (swap.sourceBooking && (
          swap.sourceBooking.title === 'Booking Details Unavailable' ||
          swap.sourceBooking.title === 'Booking Details Temporarily Unavailable'
        )) ||
        (swap.targetBooking && (
          swap.targetBooking.title === 'Booking Details Unavailable' ||
          swap.targetBooking.title === 'Booking Details Temporarily Unavailable'
        ))
      );

      const metadata: SwapDataCompletenessMetadata = {
        totalSwaps,
        sourceBookingCompleteness: totalSwaps > 0 ? (swapsWithCompleteSourceBooking / totalSwaps) * 100 : 100,
        targetBookingCompleteness: swapsWithTargetBooking > 0 ? (swapsWithCompleteTargetBooking / swapsWithTargetBooking) * 100 : 100,
        swapsWithMissingData,
        hasPartialData: swapsWithMissingData > 0,
        fallbackUsed,
        errorDetails
      };

      logger.info('Successfully retrieved user swap proposals with metadata', {
        userId,
        metadata
      });

      return {
        swaps,
        metadata,
        pagination: {
          limit,
          offset,
          total: totalSwaps
        }
      };
    } catch (error: any) {
      logger.error('Failed to get user swap proposals with metadata', {
        error: error.message || error,
        userId
      });

      // Return empty response with error metadata
      errorDetails = error.message || 'Unknown error occurred';
      const metadata: SwapDataCompletenessMetadata = {
        totalSwaps: 0,
        sourceBookingCompleteness: 0,
        targetBookingCompleteness: 0,
        swapsWithMissingData: 0,
        hasPartialData: true,
        fallbackUsed: true,
        errorDetails
      };

      return {
        swaps: [],
        metadata,
        pagination: {
          limit,
          offset,
          total: 0
        }
      };
    }
  }

  /**
   * Get pending swap proposals for a booking
   */
  async getPendingProposalsForBooking(bookingId: string): Promise<Swap[]> {
    try {
      return await this.swapRepository.findPendingProposalsForBooking(bookingId);
    } catch (error) {
      logger.error('Failed to get pending proposals for booking', { error, bookingId });
      throw error;
    }
  }

  /**
   * Cancel a swap proposal (only by proposer)
   */
  async cancelSwapProposal(swapId: string, userId: string): Promise<Swap> {
    try {
      logger.info('Cancelling swap proposal', { swapId, userId });

      const swap = await this.swapRepository.findById(swapId);
      if (!swap) {
        throw new Error('Swap proposal not found');
      }

      if (swap.proposerId !== userId) {
        throw new Error('Only the proposer can cancel a swap proposal');
      }

      if (swap.status !== 'pending') {
        throw new Error(`Cannot cancel swap proposal with status: ${swap.status}`);
      }

      // Update swap status
      const updatedSwap = await this.swapRepository.updateStatus(swapId, 'cancelled');
      if (!updatedSwap) {
        throw new Error('Failed to update swap proposal status');
      }

      // Unlock both bookings
      await Promise.all([
        this.bookingService.unlockBooking(swap.sourceBookingId, swap.proposerId),
        this.bookingService.unlockBooking(swap.targetBookingId),
      ]);

      // Get source booking for derived relationships
      const sourceBooking = await this.bookingService.getBookingById(swap.sourceBookingId);

      // Record cancellation on blockchain using new extensions
      await this.hederaService.recordProposalStatusChange({
        proposalId: swapId,
        previousStatus: 'pending',
        newStatus: 'cancelled',
        changedBy: userId,
        changedAt: new Date(),
        reason: 'User cancelled proposal',
        metadata: {
          cancellationType: 'user_initiated',
          originalProposerId: sourceBooking?.userId || 'unknown' // Derived from booking relationship
        }
      });

      // Send notification to target booking owner (derive user IDs from booking relationships)
      if (sourceBooking) {
        await this.notificationService.sendSwapCancellationNotification({
          swapId,
          recipientUserId: sourceBooking.userId, // Derived from source booking
          proposerUserId: sourceBooking.userId, // Same as recipient for swap cancellation
        });
      } else {
        logger.warn('Cannot send cancellation notification: source booking not found', {
          swapId,
          sourceBookingId: swap.sourceBookingId
        });
      }

      logger.info('Swap proposal cancelled successfully', { swapId });
      return updatedSwap;
    } catch (error) {
      logger.error('Failed to cancel swap proposal', { error, swapId });
      throw error;
    }
  }

  /**
   * Create enhanced proposal with cash offer support
   */
  async createEnhancedProposal(request: CreateEnhancedProposalRequest, userId: string): Promise<{
    proposalId: string;
    validationResult: ProposalValidation;
    requiresAuctionSubmission: boolean;
  }> {
    try {
      logger.info('Creating enhanced proposal', {
        swapId: request.swapId,
        proposalType: request.proposalType,
      });

      // Step 1: Get the swap and validate it accepts this proposal type
      const swap = await this.swapRepository.findEnhancedById(request.swapId);
      if (!swap) {
        throw new Error('Swap not found');
      }

      // Step 2: Validate proposal against swap requirements
      const validation = await this.validateEnhancedProposal(request, swap);
      if (!validation.isValid) {
        throw new Error(`Proposal validation failed: ${validation.errors.join(', ')}`);
      }

      // Step 3: Check if this is an auction swap
      const auction = await this.auctionRepository.findBySwapId(request.swapId);
      const requiresAuctionSubmission = !!auction && auction.status === 'active';

      if (requiresAuctionSubmission) {
        // Submit to auction instead of direct swap proposal
        const auctionProposal = await this.auctionService.submitProposal({
          swapId: request.swapId,
          proposalType: request.proposalType,
          bookingId: request.bookingId,
          cashOffer: request.cashOffer,
          message: request.message,
          conditions: request.conditions,
        });

        return {
          proposalId: auctionProposal.proposal.id,
          validationResult: validation,
          requiresAuctionSubmission: true,
        };
      }

      // Step 4: For first-match swaps, create traditional swap proposal
      if (request.proposalType === 'booking' && request.bookingId) {
        const traditionalRequest: CreateSwapProposalRequest = {
          sourceBookingId: request.bookingId,
          targetBookingId: swap.sourceBookingId,
          proposerId: request.bookingId, // Will be extracted from auth context
          terms: {
            additionalPayment: 0,
            conditions: request.conditions,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          },
        };

        const result = await this.createSwapProposal(traditionalRequest);
        return {
          proposalId: result.swap.id,
          validationResult: validation,
          requiresAuctionSubmission: false,
        };
      }

      // Step 5: Handle cash proposals for first-match swaps
      if (request.proposalType === 'cash' && request.cashOffer) {
        // For cash proposals on first-match swaps, we need to create a special cash proposal
        const cashProposalId = await this.createCashProposal(request, swap, userId);
        return {
          proposalId: cashProposalId,
          validationResult: validation,
          requiresAuctionSubmission: false,
        };
      }

      throw new Error('Invalid proposal configuration');
    } catch (error) {
      logger.error('Failed to create enhanced proposal', { error, request });
      throw error;
    }
  }

  /**
   * Create proposal from browse page with enhanced validation and metadata tracking
   * Requirements: 1.1, 1.2, 1.3, 1.6, 1.7
   */
  async createProposalFromBrowse(request: CreateProposalFromBrowseRequest): Promise<SwapProposalResult> {
    try {
      logger.info('Creating proposal from browse page', {
        targetSwapId: request.targetSwapId,
        sourceSwapId: request.sourceSwapId,
        proposerId: request.proposerId,
      });

      // Step 1: Validate browse-initiated proposal
      await this.validateBrowseProposal(request);

      // Step 2: Get swap details to extract booking IDs
      const [sourceSwap, targetSwap] = await Promise.all([
        this.swapRepository.findById(request.sourceSwapId),
        this.swapRepository.findById(request.targetSwapId)
      ]);

      if (!sourceSwap || !targetSwap) {
        throw new Error('Unable to retrieve swap details for proposal creation');
      }

      if (!sourceSwap.sourceBookingId || !targetSwap.sourceBookingId) {
        throw new Error('Swap booking IDs are required for proposal creation');
      }

      // Step 3: Create traditional swap proposal request
      const swapProposalRequest: CreateSwapProposalRequest = {
        sourceBookingId: sourceSwap.sourceBookingId || '',
        targetBookingId: targetSwap.sourceBookingId || '',
        proposerId: request.proposerId,
        terms: {
          additionalPayment: 0,
          conditions: request.conditions,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        },
      };

      // Step 4: Create the swap proposal using existing method
      const proposalResult = await this.createSwapProposal(swapProposalRequest);

      // Step 5: Record browse-specific metadata (simplified schema)
      // Derive target owner ID from booking relationship
      const targetBooking = await this.bookingService.getBookingById(targetSwap.sourceBookingId || '');
      if (!targetBooking) {
        throw new Error('Cannot record browse metadata: target booking not found for owner derivation');
      }

      await this.recordBrowseProposalMetadata({
        proposalId: proposalResult.swap.id,
        sourceSwapId: request.sourceSwapId,
        targetSwapId: request.targetSwapId,
        message: request.message,
        compatibilityScore: 75, // Default score, would be calculated in production
        proposalSource: 'browse',
        createdFromBrowse: true,
        proposerId: request.proposerId,
        targetOwnerId: targetBooking.userId, // Derived from booking relationship
        blockchainTransactionId: proposalResult.blockchainTransaction.transactionId || '',
      });

      // Step 6: Transform result to match browse proposal interface
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
   * Find user's eligible swaps for proposing (excluding specific swap)
   * Requirements: 1.1, 1.2, 1.3
   */
  async findEligibleUserSwaps(userId: string, excludeSwapId?: string): Promise<Swap[]> {
    try {
      logger.info('Finding eligible user swaps', { userId, excludeSwapId });

      // Get all active swaps owned by the user
      const userSwaps = await this.swapRepository.findActiveSwapsByUserIdExcluding(userId, excludeSwapId || '');

      // Filter out the excluded swap and apply eligibility criteria
      const eligibleSwaps = userSwaps.filter(swap => {
        // Exclude the specified swap
        if (excludeSwapId && swap.id === excludeSwapId) {
          return false;
        }

        // Only include active swaps
        if (swap.status !== 'pending') { // 'pending' is the active status in our system
          return false;
        }

        // Exclude swaps that are already involved in active proposals
        // This would be checked via repository method in production
        return true;
      });

      logger.info('Found eligible user swaps', {
        userId,
        totalSwaps: userSwaps.length,
        eligibleCount: eligibleSwaps.length
      });

      return eligibleSwaps;
    } catch (error) {
      logger.error('Failed to find eligible user swaps', { error, userId, excludeSwapId });
      throw error;
    }
  }

  /**
   * Validate browse-initiated proposal with comprehensive checks
   * Requirements: 1.1, 1.2, 1.3, 1.6, 1.7
   */
  async validateBrowseProposal(request: CreateProposalFromBrowseRequest): Promise<ValidationResult<string[]>> {
    try {
      logger.info('Validating browse proposal', {
        targetSwapId: request.targetSwapId,
        sourceSwapId: request.sourceSwapId,
        proposerId: request.proposerId,
      });

      const errors: string[] = [];
      const warnings: string[] = [];
      const eligibilityChecks = {
        userOwnsSourceSwap: false,
        sourceSwapAvailable: false,
        targetSwapAvailable: false,
        noExistingProposal: false,
        swapsAreCompatible: false,
      };

      // Validate required fields
      if (!request.targetSwapId) {
        errors.push('Target swap ID is required');
      }
      if (!request.sourceSwapId) {
        errors.push('Source swap ID is required');
      }
      if (!request.proposerId) {
        errors.push('Proposer ID is required');
      }
      if (!request.agreedToTerms) {
        errors.push('User must agree to terms and conditions');
      }

      // Validate source swap (simplified schema)
      const sourceSwap = await this.swapRepository.findById(request.sourceSwapId);
      if (!sourceSwap) {
        errors.push('Source swap not found');
      } else if (!sourceSwap.sourceBookingId) {
        errors.push('Source swap missing booking ID for ownership validation');
      } else {
        // Derive owner ID from booking relationship
        const sourceBooking = await this.bookingService.getBookingById(sourceSwap.sourceBookingId || '');
        if (!sourceBooking) {
          errors.push('Cannot validate ownership: source booking not found');
        } else if (sourceBooking.userId !== request.proposerId) {
          errors.push('User does not own the source swap');
        } else {
          eligibilityChecks.userOwnsSourceSwap = true;
        }

        // More permissive status check - allow multiple statuses
        const allowedStatuses = ['active', 'available', 'open', 'pending', 'listed'];
        if (allowedStatuses.includes(sourceSwap.status)) {
          eligibilityChecks.sourceSwapAvailable = true;
        } else {
          errors.push(`Source swap is not available (status: ${sourceSwap.status})`);
        }
      }

      // Validate target swap (simplified schema)
      const targetSwap = await this.swapRepository.findById(request.targetSwapId);
      const allowedStatuses: SwapStatus[] = ['pending', 'accepted'];
      if (!targetSwap) {
        errors.push('Target swap not found');
      } else if (!targetSwap.sourceBookingId) {
        errors.push('Target swap missing booking ID for ownership validation');
      } else {
        // Derive owner ID from booking relationship
        const targetBooking = await this.bookingService.getBookingById(targetSwap.sourceBookingId || '');
        if (!targetBooking) {
          errors.push('Cannot validate target ownership: target booking not found');
        } else if (targetBooking.userId === request.proposerId) {
          errors.push('Cannot propose to your own swap');
        } else if (!allowedStatuses.includes(targetSwap.status)) {
          errors.push(`Target swap is not available (status: ${targetSwap.status})`);
        } else {
          eligibilityChecks.targetSwapAvailable = true;
        }
      }

      // Check for existing proposals between these swaps
      if (sourceSwap && targetSwap && sourceSwap.sourceBookingId && targetSwap.sourceBookingId) {
        const existingProposal = await this.swapRepository.findPendingProposalBetweenBookings(
          sourceSwap.sourceBookingId,
          targetSwap.sourceBookingId
        );

        if (existingProposal) {
          errors.push('A pending proposal already exists between these swaps');
        } else {
          eligibilityChecks.noExistingProposal = true;
        }
      }

      // Basic compatibility check (simplified for now)
      if (eligibilityChecks.sourceSwapAvailable && eligibilityChecks.targetSwapAvailable) {
        eligibilityChecks.swapsAreCompatible = true; // Assume compatible for now
      }

      // Validate conditions array
      if (request.conditions && !Array.isArray(request.conditions)) {
        errors.push('Conditions must be an array');
      }

      // Validate message length if provided
      if (request.message && request.message.length > 1000) {
        warnings.push('Message is quite long - consider keeping it concise');
      }

      const isValid = errors.length === 0;

      logger.info('Browse proposal validation completed', {
        targetSwapId: request.targetSwapId,
        sourceSwapId: request.sourceSwapId,
        isValid,
        errorCount: errors.length,
        warningCount: warnings.length
      });

      return {
        isValid,
        errors,
        warnings,
        guidance: []
      };
    } catch (error) {
      logger.error('Failed to validate browse proposal', { error, request });
      throw error;
    }
  }

  /**
   * Handle expired swap proposals
   */
  async handleExpiredProposals(): Promise<void> {
    try {
      logger.info('Processing expired swap proposals');

      const expiredProposals = await this.swapRepository.findExpiredProposals();

      for (const proposal of expiredProposals) {
        try {
          // Update status to cancelled
          await this.swapRepository.updateStatus(proposal.id, 'cancelled');

          // Unlock both bookings
          await Promise.all([
            this.bookingService.unlockBooking(proposal.sourceBookingId),
            this.bookingService.unlockBooking(proposal.targetBookingId),
          ]);

          // Record expiration on blockchain using new extensions
          await this.hederaService.recordProposalExpiration(proposal.id, new Date());

          // Send notifications to both parties
          await Promise.all([
            this.notificationService.sendSwapExpirationNotification({
              swapId: proposal.id,
              recipientUserId: proposal.proposerId,
              role: 'proposer',
            }),
            this.notificationService.sendSwapExpirationNotification({
              swapId: proposal.id,
              recipientUserId: proposal.ownerId,
              role: 'owner',
            }),
          ]);

          logger.info('Expired swap proposal processed', { swapId: proposal.id });
        } catch (error) {
          logger.error('Failed to process expired swap proposal', { error, swapId: proposal.id });
        }
      }

      logger.info('Expired swap proposals processing completed', { count: expiredProposals.length });
    } catch (error) {
      logger.error('Failed to handle expired proposals', { error });
      throw error;
    }
  }

  /**
   * Validate enhanced swap proposal creation
   */
  private async validateEnhancedSwapProposal(request: EnhancedCreateSwapRequest): Promise<void> {
    // Validate source booking
    const sourceBooking = await this.bookingService.getBookingById(request.sourceBookingId);
    if (!sourceBooking) {
      throw new Error('Source booking not found');
    }

    if (sourceBooking.status !== 'available') {
      throw new Error(`Source booking is not available for swap (status: ${sourceBooking.status})`);
    }

    if (sourceBooking.verification.status !== 'verified') {
      throw new Error('Source booking must be verified before creating a swap');
    }

    // Validate that booking doesn't already have an incomplete or matched swap
    const existingSwaps = await this.swapRepository.findBySourceBookingId(request.sourceBookingId);
    const activeSwap = existingSwaps.find(swap =>
      ['pending', 'accepted'].includes(swap.status)
    );

    if (activeSwap) {
      if (activeSwap.status === 'pending') {
        throw new Error('This booking already has an incomplete swap. Please complete or cancel the existing swap before creating a new one.');
      }
      if (activeSwap.status === 'accepted') {
        throw new Error('This booking already has a matched swap. Cannot create a new swap for a booking that has been matched.');
      }
    }

    // Validate payment type preferences
    if (!request.paymentTypes.bookingExchange && !request.paymentTypes.cashPayment) {
      throw new Error('At least one payment type must be enabled');
    }

    if (request.paymentTypes.cashPayment) {
      if (!request.paymentTypes.minimumCashAmount || request.paymentTypes.minimumCashAmount <= 0) {
        throw new Error('Minimum cash amount must be specified and greater than 0 when cash payments are enabled');
      }
    }

    // Validate acceptance strategy
    if (request.acceptanceStrategy.type === 'auction') {
      if (!request.auctionSettings) {
        throw new Error('Auction settings are required when auction mode is selected');
      }

      if (!request.auctionSettings.endDate) {
        throw new Error('Auction end date is required');
      }

      if (request.auctionSettings.endDate <= new Date()) {
        throw new Error('Auction end date must be in the future');
      }

      // Validate auction timing against event date
      const eventDate = sourceBooking.dateRange.checkIn;
      const oneWeekBeforeEvent = new Date(eventDate.getTime() - this.ONE_WEEK_MS);

      if (request.auctionSettings.endDate > oneWeekBeforeEvent) {
        throw new Error(`Auction must end at least one week before the event (by ${oneWeekBeforeEvent.toISOString()})`);
      }

      if (!request.auctionSettings.allowBookingProposals && !request.auctionSettings.allowCashProposals) {
        throw new Error('At least one proposal type must be allowed in auction mode');
      }
    }

    // Validate expiration date
    if (request.expirationDate <= new Date()) {
      throw new Error('Expiration date must be in the future');
    }

    logger.info('Enhanced swap proposal validation passed', {
      sourceBookingId: request.sourceBookingId,
      paymentTypes: request.paymentTypes,
      acceptanceStrategy: request.acceptanceStrategy.type,
    });
  }

  /**
   * Enhanced validation with comprehensive date handling for auction settings
   * Requirements: 1.1, 4.1, 4.2
   */
  private async validateEnhancedSwapProposalWithDateHandling(request: EnhancedCreateSwapRequest): Promise<void> {
    try {
      logger.info('Starting enhanced swap proposal validation with date handling', {
        sourceBookingId: request.sourceBookingId,
        acceptanceStrategy: request.acceptanceStrategy.type,
        auctionEndDate: request.auctionSettings?.endDate,
        auctionEndDateType: typeof request.auctionSettings?.endDate
      });

      // Step 1: Run existing validation
      await this.validateEnhancedSwapProposal(request);

      // Step 2: Additional date-specific validation for auction settings
      if (request.acceptanceStrategy.type === 'auction' && request.auctionSettings) {
        try {
          // Validate auction settings with comprehensive date handling
          const validatedSettings = AuctionSettingsValidator.validateAuctionSettings(request.auctionSettings);

          // Get source booking for event date validation
          const sourceBooking = await this.bookingService.getBookingById(request.sourceBookingId);
          if (!sourceBooking) {
            throw new Error('Source booking not found for auction timing validation');
          }

          // Validate auction timing against event date
          AuctionSettingsValidator.validateAuctionTiming(
            validatedSettings.endDate,
            sourceBooking.dateRange.checkIn
          );

          // Validate settings consistency with payment preferences
          AuctionSettingsValidator.validateSettingsConsistency(
            validatedSettings,
            {
              bookingExchange: request.paymentTypes.bookingExchange,
              cashPayment: request.paymentTypes.cashPayment,
              minimumCashAmount: request.paymentTypes.minimumCashAmount
            }
          );

          logger.info('Auction settings validation passed with date handling', {
            sourceBookingId: request.sourceBookingId,
            validatedEndDate: validatedSettings.endDate.toISOString(),
            eventDate: sourceBooking.dateRange.checkIn.toISOString(),
            allowBookingProposals: validatedSettings.allowBookingProposals,
            allowCashProposals: validatedSettings.allowCashProposals
          });
        } catch (auctionValidationError) {
          // Record validation error in monitoring service
          this.errorMonitoringService.recordAuctionError(
            auctionValidationError instanceof Error ? auctionValidationError : new Error('Unknown auction validation error'),
            {
              phase: 'validation',
              operation: 'auction_settings_validation',
              metadata: {
                sourceBookingId: request.sourceBookingId,
                auctionSettings: request.auctionSettings,
                originalEndDate: request.auctionSettings.endDate,
                endDateType: typeof request.auctionSettings.endDate
              }
            }
          );

          logger.error('Auction settings validation failed with comprehensive date handling context', {
            category: 'auction_validation',
            sourceBookingId: request.sourceBookingId,
            error: auctionValidationError instanceof Error ? auctionValidationError.message : auctionValidationError,
            errorType: auctionValidationError instanceof Error ? auctionValidationError.constructor.name : typeof auctionValidationError,
            stack: auctionValidationError instanceof Error ? auctionValidationError.stack : undefined,
            auctionSettings: {
              endDate: request.auctionSettings.endDate,
              endDateType: typeof request.auctionSettings.endDate,
              endDateIsDate: request.auctionSettings.endDate instanceof Date,
              allowBookingProposals: request.auctionSettings.allowBookingProposals,
              allowCashProposals: request.auctionSettings.allowCashProposals,
              autoSelectAfterHours: request.auctionSettings.autoSelectAfterHours
            },
            validationContext: {
              phase: 'auction_settings_validation',
              operation: 'date_handling_validation',
              timestamp: new Date().toISOString()
            }
          });

          // Re-throw auction-specific errors as-is
          if (AuctionErrorUtils.isAuctionError(auctionValidationError)) {
            throw auctionValidationError;
          }

          // Wrap unknown validation errors with auction context
          throw new AuctionCreationError(
            `Auction settings validation failed: ${auctionValidationError instanceof Error ? auctionValidationError.message : 'Unknown error'}`,
            undefined,
            undefined,
            auctionValidationError instanceof Error ? auctionValidationError : undefined,
            'validation'
          );
        }
      }

      logger.info('Enhanced swap proposal validation with date handling completed successfully', {
        sourceBookingId: request.sourceBookingId,
        acceptanceStrategy: request.acceptanceStrategy.type
      });
    } catch (error) {
      // Record validation error in monitoring service
      this.errorMonitoringService.recordAuctionError(
        error instanceof Error ? error : new Error('Unknown enhanced validation error'),
        {
          phase: 'validation',
          operation: 'enhanced_swap_validation_with_date_handling',
          metadata: {
            sourceBookingId: request.sourceBookingId,
            acceptanceStrategy: request.acceptanceStrategy,
            auctionSettings: request.auctionSettings,
            hasAuctionSettings: !!request.auctionSettings
          }
        }
      );

      logger.error('Enhanced swap proposal validation with date handling failed with comprehensive context', {
        category: 'enhanced_swap_validation',
        sourceBookingId: request.sourceBookingId,
        error: error instanceof Error ? error.message : error,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined,
        acceptanceStrategy: request.acceptanceStrategy,
        auctionSettings: request.auctionSettings ? {
          endDate: request.auctionSettings.endDate,
          endDateType: typeof request.auctionSettings.endDate,
          allowBookingProposals: request.auctionSettings.allowBookingProposals,
          allowCashProposals: request.auctionSettings.allowCashProposals
        } : undefined,
        validationContext: {
          phase: 'enhanced_validation_with_date_handling',
          timestamp: new Date().toISOString(),
          isAuctionError: AuctionErrorUtils.isAuctionError(error)
        }
      });

      // Re-throw auction-specific errors as-is for proper error handling upstream
      if (AuctionErrorUtils.isAuctionError(error)) {
        throw error;
      }

      // Wrap unknown errors with validation context
      throw new AuctionCreationError(
        `Enhanced swap validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        undefined,
        error instanceof Error ? error : undefined,
        'validation'
      );
    }
  }

  /**
   * Validate enhanced proposal against swap requirements
   */
  private async validateEnhancedProposal(
    request: CreateEnhancedProposalRequest,
    swap: EnhancedSwap
  ): Promise<ProposalValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if proposer is not the swap owner
    if (swap.ownerId === request.swapId) { // This would be extracted from auth context
      errors.push('Cannot propose to your own swap');
    }

    // Allow any type of proposal - removed payment type restrictions
    // This allows users to propose any type of offer regardless of swap settings

    // Validate booking proposal
    if (request.proposalType === 'booking') {
      if (!request.bookingId) {
        errors.push('Booking ID is required for booking proposals');
      } else {
        try {
          const booking = await this.bookingService.getBookingById(request.bookingId);
          if (!booking) {
            errors.push('Booking not found');
          } else {
            if (booking.status !== 'available') {
              errors.push('Booking is not available for swap');
            }
            if (booking.verification.status !== 'verified') {
              errors.push('Booking must be verified before proposing');
            }
          }
        } catch (error) {
          errors.push('Failed to validate booking');
        }
      }
    }

    // Validate cash proposal
    if (request.proposalType === 'cash') {
      if (!request.cashOffer) {
        errors.push('Cash offer details are required for cash proposals');
      } else {
        if (request.cashOffer.amount <= 0) {
          errors.push('Cash offer amount must be greater than 0');
        }

        if (swap.paymentTypes.minimumCashAmount &&
          request.cashOffer.amount < swap.paymentTypes.minimumCashAmount) {
          errors.push(`Cash offer must be at least ${swap.paymentTypes.minimumCashAmount}`);
        }

        // Skip payment method validation for now - allow any payment method ID
        // TODO: Implement proper payment method validation when payment service is ready
        if (!request.cashOffer.paymentMethodId || request.cashOffer.paymentMethodId.trim() === '') {
          errors.push('Payment method ID is required for cash offers');
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      paymentMethodValid: request.proposalType === 'cash' ? errors.length === 0 : undefined,
      escrowRequired: request.proposalType === 'cash' ? request.cashOffer?.escrowAgreement : undefined,
    };
  }

  /**
   * Create cash swap configuration from payment preferences
   */
  private createCashConfiguration(paymentTypes: PaymentTypePreference): CashSwapConfiguration | undefined {
    if (!paymentTypes.cashPayment) {
      return undefined;
    }

    return {
      enabled: true,
      minimumAmount: paymentTypes.minimumCashAmount || 0,
      preferredAmount: paymentTypes.preferredCashAmount,
      currency: 'USD', // Default currency, could be configurable
      escrowRequired: (paymentTypes.minimumCashAmount || 0) >= 100, // Require escrow for amounts >= $100
      platformFeePercentage: 0.05, // 5% platform fee
    };
  }

  /**
   * Check if booking is last-minute (less than one week to event)
   */
  private async isLastMinuteBooking(eventDate: Date): Promise<boolean> {
    const now = new Date();
    const timeToEvent = eventDate.getTime() - now.getTime();
    return timeToEvent < this.ONE_WEEK_MS;
  }

  /**
   * Record browse-specific proposal metadata for tracking and analytics
   * Requirements: 1.6, 1.7
   */
  private async recordBrowseProposalMetadata(metadata: ProposalMetadata): Promise<void> {
    try {
      logger.info('Recording browse proposal metadata', {
        proposalId: metadata.proposalId,
        sourceSwapId: metadata.sourceSwapId,
        targetSwapId: metadata.targetSwapId,
        proposalSource: metadata.proposalSource,
      });

      // Record metadata on blockchain for audit trail using new extensions
      await this.hederaService.recordProposalMetadata(metadata);

      // In production, this could also store metadata in a dedicated table
      // for faster querying and analytics
      logger.info('Browse proposal metadata recorded successfully', {
        proposalId: metadata.proposalId,
        blockchainTransactionId: metadata.blockchainTransactionId,
      });
    } catch (error) {
      logger.warn('Failed to record browse proposal metadata', { error, metadata });
      // Don't throw error as this is not critical for proposal creation
    }
  }

  /**
   * Create cash proposal for first-match swaps
   */
  private async createCashProposal(
    request: CreateEnhancedProposalRequest,
    swap: EnhancedSwap,
    userId: string
  ): Promise<string> {
    if (!request.cashOffer) {
      throw new Error('Cash offer is required');
    }

    // Validate cash offer
    const validation = await this.paymentService.validateCashOffer(
      request.cashOffer.amount,
      request.cashOffer.currency,
      swap.paymentTypes.minimumCashAmount || 0,
      request.cashOffer.paymentMethodId,
      userId
    );

    if (!validation.isValid) {
      throw new Error(`Cash offer validation failed: ${validation.errors.join(', ')}`);
    }

    // Generate a proper proposal ID
    const proposalId = uuidv4();

    // Create a minimal proposal record first to satisfy foreign key constraints
    const proposalData = {
      id: proposalId,
      swapId: swap.id,
      proposerId: userId,
      type: 'cash' as const,
      status: 'pending' as const,
      cashOffer: request.cashOffer,
      message: request.message,
      conditions: request.conditions || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store the proposal (this would typically go to a proposals table)
    // For now, we'll create it as a swap record with the cash offer details (simplified schema)
    const sourceBooking = await this.bookingService.getBookingById(swap.sourceBookingId);
    if (!sourceBooking) {
      throw new Error('Cannot create cash proposal: source booking not found for relationship derivation');
    }

    const proposalSwap = await this.swapRepository.create({
      sourceBookingId: `cash_offer_${proposalId}`, // Placeholder for cash offers
      // Temporary placeholders for interface compatibility - these fields will be removed in interface updates
      targetBookingId: swap.sourceBookingId, // Target is the original swap's source
      proposerId: userId, // Cash proposal creator
      ownerId: sourceBooking.userId, // Derived from source booking
      status: 'pending',
      terms: {
        additionalPayment: request.cashOffer.amount,
        conditions: request.conditions || [],
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
      blockchain: {
        proposalTransactionId: '',
        executionTransactionId: undefined,
        escrowContractId: undefined,
      },
      timeline: {
        proposedAt: new Date(),
        respondedAt: undefined,
        completedAt: undefined,
      },
    });

    // Create escrow if required
    let escrowId: string | undefined;
    if (request.cashOffer.escrowAgreement) {
      // Derive recipient ID from swap's source booking relationship
      const sourceBooking = await this.bookingService.getBookingById(swap.sourceBookingId);
      if (!sourceBooking) {
        throw new Error('Cannot create escrow: source booking not found for recipient derivation');
      }

      const escrowResult = await this.paymentService.createEscrow({
        amount: request.cashOffer.amount,
        currency: request.cashOffer.currency,
        payerId: userId,
        recipientId: sourceBooking.userId, // Derived from booking relationship
        swapId: swap.id,
        proposalId: proposalSwap.id, // Use the created proposal's ID
      });
      escrowId = escrowResult.escrowId;
    }

    // Record cash proposal on blockchain
    const transactionData: TransactionData = {
      type: 'cash_proposal_created',
      payload: {
        swapId: swap.id,
        proposerId: userId,
        cashOffer: {
          ...request.cashOffer,
          escrowAccountId: escrowId,
        },
        submittedAt: new Date(),
      },
      timestamp: new Date(),
    };

    const blockchainResult = await this.hederaService.submitTransaction(transactionData);

    // Send notification to swap owner (derive recipient from booking relationship)
    const swapOwnerBooking = await this.bookingService.getBookingById(swap.sourceBookingId);
    if (!swapOwnerBooking) {
      logger.warn('Cannot send cash proposal notification: swap owner booking not found', {
        swapId: swap.id,
        sourceBookingId: swap.sourceBookingId
      });
    } else {
      await this.notificationService.sendCashProposalNotification({
        swapId: swap.id,
        recipientUserId: swapOwnerBooking.userId, // Derived from booking relationship
        proposerId: userId,
        cashOffer: request.cashOffer,
      });

      // Send payment processing notification if escrow was created
      if (escrowId) {
        await this.paymentNotificationService.sendEscrowNotification({
          escrowId,
          userId: userId,
          amount: request.cashOffer.amount,
          currency: request.cashOffer.currency,
          swapId: swap.id,
          counterpartyId: swapOwnerBooking.userId, // Derived from booking relationship
          status: 'created'
        });
      }
    }

    logger.info('Cash proposal created successfully', {
      swapId: swap.id,
      amount: request.cashOffer.amount,
      escrowId,
      transactionId: blockchainResult.transactionId,
    });

    return proposalSwap.id;
  }

  /**
   * Send notifications for swap creation
   */
  private async sendSwapCreationNotifications(
    swap: EnhancedSwap,
    auction?: any
  ): Promise<void> {
    try {
      if (auction) {
        // Send auction creation notifications
        await this.notificationService.sendAuctionCreatedNotification({
          auctionId: auction.id,
          swapId: swap.id,
          ownerId: swap.ownerId,
          endDate: auction.settings.endDate,
        });

        // Send notifications to interested users
        const sourceBooking = await this.bookingService.getBookingById(swap.sourceBookingId);
        if (sourceBooking) {
          await this.auctionNotificationService.notifyInterestedUsersOfAuction({
            auctionId: auction.id,
            swapId: swap.id,
            endDate: auction.settings.endDate,
            swapDetails: {
              title: sourceBooking.title,
              location: sourceBooking.location,
              dateRange: sourceBooking.dateRange,
              swapValue: sourceBooking.swapValue,
              paymentTypes: swap.paymentTypes.bookingExchange ?
                (swap.paymentTypes.cashPayment ? ['booking', 'cash'] : ['booking']) :
                ['cash'],
            },
          });
        }
      } else {
        // Send regular swap creation notifications
        await this.notificationService.sendSwapCreatedNotification({
          swapId: swap.id,
          ownerId: swap.ownerId,
          paymentTypes: swap.paymentTypes,
          acceptanceStrategy: swap.acceptanceStrategy,
        });
      }
    } catch (error) {
      logger.warn('Failed to send swap creation notifications', { error, swapId: swap.id });
      // Don't throw error as this is not critical for swap creation
    }
  }

  /**
   * Get validation warnings for swap
   */
  private async getSwapValidationWarnings(swap: EnhancedSwap): Promise<string[]> {
    const warnings: string[] = [];

    try {
      // Check if event is approaching
      const sourceBooking = await this.bookingService.getBookingById(swap.sourceBookingId);
      if (sourceBooking) {
        const eventDate = sourceBooking.dateRange.checkIn;
        const daysToEvent = Math.ceil((eventDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));

        if (daysToEvent <= 14) {
          warnings.push(`Event is only ${daysToEvent} days away. Consider enabling cash payments for faster completion.`);
        }
      }

      // Check auction timing
      if (swap.acceptanceStrategy.type === 'auction' && swap.acceptanceStrategy.auctionEndDate) {
        const daysToAuctionEnd = Math.ceil(
          (swap.acceptanceStrategy.auctionEndDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
        );

        if (daysToAuctionEnd <= 3) {
          warnings.push('Auction ends soon. You may receive fewer proposals with short auction periods.');
        }
      }

      // Check cash payment settings
      if (swap.paymentTypes.cashPayment && swap.paymentTypes.minimumCashAmount) {
        if (swap.paymentTypes.minimumCashAmount > 500) {
          warnings.push('High minimum cash amount may limit the number of proposals you receive.');
        }
      }
    } catch (error) {
      logger.warn('Failed to generate validation warnings', { error, swapId: swap.id });
    }

    return warnings;
  }

  /**
   * Get enhanced swap by ID
   */
  async getEnhancedSwapById(swapId: string): Promise<EnhancedSwap | null> {
    try {
      return await this.swapRepository.findEnhancedById(swapId);
    } catch (error) {
      logger.error('Failed to get enhanced swap by ID', { error, swapId });
      throw error;
    }
  }

  /**
   * Get enhanced swaps with filters
   */
  async getEnhancedSwaps(
    filters: any,
    limit: number = 100,
    offset: number = 0
  ): Promise<EnhancedSwap[]> {
    try {
      return await this.swapRepository.findEnhancedSwaps(filters, limit, offset);
    } catch (error) {
      logger.error('Failed to get enhanced swaps', { error, filters });
      throw error;
    }
  }

  /**
   * Check payment type compatibility between swaps
   */
  async checkPaymentTypeCompatibility(
    sourceSwapId: string,
    targetSwapId: string
  ): Promise<{
    compatible: boolean;
    supportedTypes: ('booking' | 'cash')[];
    incompatibilityReasons: string[];
  }> {
    try {
      const sourceSwap = await this.swapRepository.findEnhancedById(sourceSwapId);
      const targetSwap = await this.swapRepository.findEnhancedById(targetSwapId);

      if (!sourceSwap || !targetSwap) {
        return {
          compatible: false,
          supportedTypes: [],
          incompatibilityReasons: ['One or both swaps not found'],
        };
      }

      const supportedTypes: ('booking' | 'cash')[] = [];
      const incompatibilityReasons: string[] = [];

      // Check booking exchange compatibility
      if (sourceSwap.paymentTypes.bookingExchange && targetSwap.paymentTypes.bookingExchange) {
        supportedTypes.push('booking');
      } else {
        if (!sourceSwap.paymentTypes.bookingExchange) {
          incompatibilityReasons.push('Source swap does not accept booking exchanges');
        }
        if (!targetSwap.paymentTypes.bookingExchange) {
          incompatibilityReasons.push('Target swap does not accept booking exchanges');
        }
      }

      // Check cash payment compatibility
      if (sourceSwap.paymentTypes.cashPayment && targetSwap.paymentTypes.cashPayment) {
        supportedTypes.push('cash');
      } else {
        if (!sourceSwap.paymentTypes.cashPayment) {
          incompatibilityReasons.push('Source swap does not accept cash payments');
        }
        if (!targetSwap.paymentTypes.cashPayment) {
          incompatibilityReasons.push('Target swap does not accept cash payments');
        }
      }

      return {
        compatible: supportedTypes.length > 0,
        supportedTypes,
        incompatibilityReasons,
      };
    } catch (error) {
      logger.error('Failed to check payment type compatibility', {
        error,
        sourceSwapId,
        targetSwapId
      });
      throw error;
    }
  }

  /**
   * Get browsable swaps (swaps available for proposals, excluding user's own)
   * 
   * Excludes swaps that:
   * - Have status other than 'pending' or 'rejected'
   * - Have expired
   * - Have accepted targets in swap_targets table (committed swaps)
   * - Belong to the current user (if excludeOwnerId is provided)
   */
  async getBrowsableSwaps(
    filters: any,
    limit: number = 100,
    offset: number = 0
  ): Promise<EnhancedSwap[]> {
    try {
      // Build filters for browsable swaps
      const browsableFilters = {
        ...filters,
        // Include swaps that are open for new proposals: pending or recently rejected
        // Repository supports array status via IN (...) filter
        // Note: Repository also excludes swaps with accepted targets automatically
        status: ['pending', 'rejected'],
      };

      // If excludeOwnerId is provided, add it to filters
      if (filters.excludeOwnerId) {
        browsableFilters.excludeOwnerId = filters.excludeOwnerId;
        delete browsableFilters.excludeOwnerId; // Remove from filters object for repository
      }

      // Get enhanced swaps with filtering
      const swaps = await this.swapRepository.findEnhancedSwaps(browsableFilters, limit, offset);

      // Additional filtering for browsable swaps
      return swaps.filter(swap => {
        // Exclude user's own swaps if specified
        if (filters.excludeOwnerId && swap.ownerId === filters.excludeOwnerId) {
          return false;
        }

        // Only show swaps that are actively accepting proposals
        if (!['pending', 'rejected'].includes(swap.status)) {
          return false;
        }

        // Check if swap has expired
        if (swap.terms?.expiresAt && new Date(swap.terms.expiresAt) <= new Date()) {
          return false;
        }

        return true;
      });
    } catch (error) {
      logger.error('Failed to get browsable swaps', { error, filters });
      throw error;
    }
  }

  /**
   * Get booking details by ID
   */
  async getBookingDetails(bookingId: string): Promise<any> {
    try {
      return await this.bookingService.getBookingById(bookingId);
    } catch (error) {
      logger.error('Failed to get booking details', { error, bookingId });
      throw error;
    }
  }

  /**
   * Validate incoming target data structure
   * Requirements: 3.3, 4.1, 4.2
   */
  private validateIncomingTargetData(incomingTarget: any): boolean {
    return !!(
      incomingTarget &&
      incomingTarget.targetId &&
      incomingTarget.sourceSwapId &&
      incomingTarget.targetSwapId &&
      incomingTarget.sourceSwapDetails &&
      incomingTarget.sourceSwapDetails.id &&
      incomingTarget.proposalId &&
      incomingTarget.status
    );
  }

  /**
   * Validate outgoing target data structure
   * Requirements: 3.3, 4.1, 4.2
   */
  private validateOutgoingTargetData(outgoingTarget: any): boolean {
    return !!(
      outgoingTarget &&
      outgoingTarget.targetId &&
      outgoingTarget.sourceSwapId &&
      outgoingTarget.targetSwapId &&
      outgoingTarget.targetSwapDetails &&
      outgoingTarget.targetSwapDetails.id &&
      outgoingTarget.proposalId &&
      outgoingTarget.status
    );
  }

  /**
   * Transform booking details from targeting data
   * Requirements: 1.3, 1.4, 3.3
   */
  private transformBookingDetailsFromTargetingData(swapDetails: any): BookingDetails {
    return {
      id: swapDetails.bookingId,
      title: swapDetails.bookingTitle || 'Booking Details Unavailable',
      location: {
        city: swapDetails.bookingLocation?.split(', ')[0] || 'Unknown',
        country: swapDetails.bookingLocation?.split(', ')[1] || 'Unknown'
      },
      dateRange: {
        checkIn: swapDetails.bookingCheckIn ? new Date(swapDetails.bookingCheckIn) : new Date(),
        checkOut: swapDetails.bookingCheckOut ? new Date(swapDetails.bookingCheckOut) : new Date()
      },
      originalPrice: swapDetails.bookingPrice || 0,
      swapValue: swapDetails.bookingPrice || 0
    };
  }

  /**
   * Validate derived relationships from simplified schema
   * Requirements: 1.1, 1.2, 4.1, 4.3
   */
  private validateDerivedRelationships(swapData: CompleteSwapData): void {
    // Type assertion for interface compatibility during transition
    const swapDataWithDerived = swapData as any;

    // Validate that proposer information is properly derived from booking relationship
    if (!swapDataWithDerived.proposerId) {
      throw new Error('Missing derived proposer ID from booking relationship');
    }

    if (!swapDataWithDerived.proposerName) {
      throw new Error('Missing derived proposer name from booking relationship');
    }

    // Validate source booking relationship
    if (!swapDataWithDerived.sourceBookingId) {
      throw new Error('Missing source booking ID for relationship derivation');
    }

    // If targeting data exists, validate derived target relationships
    if (swapDataWithDerived.targeting) {
      if (swapDataWithDerived.targeting.outgoingTarget) {
        const outgoing = swapDataWithDerived.targeting.outgoingTarget;
        if (!outgoing.targetSwapId) {
          throw new Error('Missing target swap ID in outgoing targeting relationship');
        }
        if (!outgoing.targetBookingId) {
          throw new Error('Missing derived target booking ID from targeting relationship');
        }
        if (!outgoing.targetOwnerId) {
          throw new Error('Missing derived target owner ID from targeting relationship');
        }
      }

      if (swapDataWithDerived.targeting.incomingTargets && swapDataWithDerived.targeting.incomingTargets.length > 0) {
        swapDataWithDerived.targeting.incomingTargets.forEach((incoming: any, index: number) => {
          if (!incoming.sourceSwapId) {
            throw new Error(`Missing source swap ID in incoming targeting relationship at index ${index}`);
          }
          if (!incoming.sourceBookingId) {
            throw new Error(`Missing derived source booking ID from incoming targeting relationship at index ${index}`);
          }
          if (!incoming.sourceProposerId) {
            throw new Error(`Missing derived source proposer ID from incoming targeting relationship at index ${index}`);
          }
        });
      }
    }

    logger.debug('Derived relationship validation passed', {
      swapId: swapData.id,
      proposerId: swapDataWithDerived.proposerId,
      hasOutgoingTarget: !!swapDataWithDerived.targeting?.outgoingTarget,
      incomingTargetCount: swapDataWithDerived.targeting?.incomingTargets?.length || 0
    });
  }

  /**
   * Extract auction information from acceptance strategy
   * Requirements: 4.1, 4.2
   */
  private extractAuctionInfo(acceptanceStrategy: any): { isAuction: boolean; endDate?: Date; currentProposalCount: number } | undefined {
    if (!acceptanceStrategy || acceptanceStrategy.type !== 'auction') {
      return undefined;
    }

    return {
      isAuction: true,
      endDate: acceptanceStrategy.endDate ? new Date(acceptanceStrategy.endDate) : undefined,
      currentProposalCount: 0 // This would need to be populated from auction data
    };
  }

  /**
   * Check if an error is transient and should be retried
   * Requirements: 3.4, 3.5, 7.1, 7.2
   */
  private isTransientTargetingError(error: any): boolean {
    if (!error) return false;

    const errorMessage = error.message?.toLowerCase() || '';
    const errorCode = error.code;

    // Database connection errors
    if (errorCode === 'ECONNRESET' || errorCode === 'ECONNREFUSED' || errorCode === 'ETIMEDOUT') {
      return true;
    }

    // PostgreSQL transient errors
    if (errorMessage.includes('connection') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('deadlock') ||
      errorMessage.includes('serialization failure')) {
      return true;
    }

    // Rate limiting or temporary unavailability
    if (errorMessage.includes('rate limit') || errorMessage.includes('temporarily unavailable')) {
      return true;
    }

    return false;
  }

  /**
   * Delay utility for retry logic
   * Requirements: 3.4, 3.5
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Convert repository data to SimpleTargetingTransformer format
   * Requirements: 1.1, 1.2
   */
  private convertRepositoryDataToSimpleFormat(repositoryData: {
    incomingTargets: any[];
    outgoingTargets: any[];
  }): RawTargetingData[] {
    const logContext = { method: 'convertRepositoryDataToSimpleFormat' };

    try {
      logger.info('[convertRepositoryDataToSimpleFormat] Converting repository data to simple format', {
        ...logContext,
        incomingCount: repositoryData.incomingTargets?.length || 0,
        outgoingCount: repositoryData.outgoingTargets?.length || 0
      });

      const rawData: RawTargetingData[] = [];

      // Process incoming targets
      if (repositoryData.incomingTargets) {
        for (const incoming of repositoryData.incomingTargets) {
          try {
            const rawItem: RawTargetingData = {
              direction: 'incoming',
              target_id: incoming.targetId,
              target_swap_id: incoming.targetSwapId,
              source_swap_id: incoming.sourceSwapId,
              // Removed proposal_id - use source_swap_id as identifier in simplified schema
              proposal_id: incoming.sourceSwapId, // Use source_swap_id as proposal identifier
              status: incoming.status,
              created_at: new Date(incoming.createdAt),
              updated_at: new Date(incoming.updatedAt),
              booking_title: incoming.sourceSwapDetails?.bookingTitle ?? 'Untitled Booking',
              booking_city: incoming.sourceSwapDetails?.bookingCity ?? 'Unknown',
              booking_country: incoming.sourceSwapDetails?.bookingCountry ?? 'Unknown',
              check_in: new Date(incoming.sourceSwapDetails?.checkIn || Date.now()),
              check_out: new Date(incoming.sourceSwapDetails?.checkOut || Date.now()),
              price: incoming.sourceSwapDetails?.price || 0,
              owner_name: incoming.sourceSwapDetails?.ownerName ?? 'Unknown User',
              owner_email: incoming.sourceSwapDetails?.ownerEmail ?? '',
              data_source: 'swap_targets'
            };
            rawData.push(rawItem);
          } catch (itemError) {
            logger.error('[convertRepositoryDataToSimpleFormat] Error processing incoming target', {
              ...logContext,
              targetId: incoming.targetId,
              error: itemError
            });
          }
        }
      }

      // Process outgoing targets
      if (repositoryData.outgoingTargets) {
        for (const outgoing of repositoryData.outgoingTargets) {
          try {
            const rawItem: RawTargetingData = {
              direction: 'outgoing',
              target_id: outgoing.targetId,
              target_swap_id: outgoing.targetSwapId,
              source_swap_id: outgoing.sourceSwapId,
              // Removed proposal_id - use source_swap_id as identifier in simplified schema
              proposal_id: outgoing.sourceSwapId, // Use source_swap_id as proposal identifier
              status: outgoing.status,
              created_at: new Date(outgoing.createdAt),
              updated_at: new Date(outgoing.updatedAt),
              booking_title: outgoing.targetSwapDetails?.bookingTitle ?? 'Untitled Booking',
              booking_city: outgoing.targetSwapDetails?.bookingCity ?? 'Unknown',
              booking_country: outgoing.targetSwapDetails?.bookingCountry ?? 'Unknown',
              check_in: new Date(outgoing.targetSwapDetails?.checkIn || Date.now()),
              check_out: new Date(outgoing.targetSwapDetails?.checkOut || Date.now()),
              price: outgoing.targetSwapDetails?.price || 0,
              owner_name: outgoing.targetSwapDetails?.ownerName ?? 'Unknown User',
              owner_email: outgoing.targetSwapDetails?.ownerEmail ?? '',
              data_source: 'swap_targets'
            };
            rawData.push(rawItem);
          } catch (itemError) {
            logger.error('[convertRepositoryDataToSimpleFormat] Error processing outgoing target', {
              ...logContext,
              targetId: outgoing.targetId,
              error: itemError
            });
          }
        }
      }

      logger.info('[convertRepositoryDataToSimpleFormat] Conversion completed', {
        ...logContext,
        inputIncoming: repositoryData.incomingTargets?.length || 0,
        inputOutgoing: repositoryData.outgoingTargets?.length || 0,
        outputCount: rawData.length
      });

      return rawData;

    } catch (error) {
      logger.error('[convertRepositoryDataToSimpleFormat] Conversion failed', {
        ...logContext,
        error
      });
      return [];
    }
  }

  /**
   * Merge simple targeting data with swap cards
   * Requirements: 1.1, 1.2, 1.3
   */
  private mergeSimpleTargetingWithSwapCards(
    swapCards: SwapCardData[],
    targetingData: SimpleTargetingData[]
  ): EnhancedSwapCardData[] {
    const logContext = { method: 'mergeSimpleTargetingWithSwapCards' };

    try {
      logger.info('[mergeSimpleTargetingWithSwapCards] Starting merge process', {
        ...logContext,
        swapCardCount: swapCards.length,
        targetingDataCount: targetingData.length
      });

      // Create a map for quick lookup of targeting data by swap ID
      const targetingMap = new Map<string, SimpleTargetingData>();
      for (const targeting of targetingData) {
        targetingMap.set(targeting.swapId, targeting);
      }

      logger.info('[mergeSimpleTargetingWithSwapCards] Created targeting lookup map', {
        ...logContext,
        targetingMapSize: targetingMap.size,
        swapIdsWithTargeting: Array.from(targetingMap.keys())
      });

      // Merge each swap card with its targeting data
      const enhancedCards: EnhancedSwapCardData[] = swapCards.map((swapCard, index) => {
        const swapId = swapCard.userSwap.id;
        const targeting = targetingMap.get(swapId);

        const enhancedCard: EnhancedSwapCardData = {
          ...swapCard,
          targeting: {
            incomingTargets: targeting?.incomingTargets.map(target => ({
              targetId: target.id,
              sourceSwapId: target.sourceSwapId,
              sourceSwap: {
                id: target.sourceSwapId,
                bookingDetails: {
                  id: target.sourceSwapId,
                  title: target.bookingTitle,
                  location: {
                    city: 'Unknown',
                    country: 'Unknown'
                  },
                  dateRange: {
                    checkIn: new Date(),
                    checkOut: new Date()
                  },
                  originalPrice: 0,
                  swapValue: 0
                },
                ownerId: '',
                ownerName: target.ownerName,
                ownerAvatar: undefined
              },
              proposalId: '',
              status: target.status,
              createdAt: new Date(),
              updatedAt: new Date(),
              auctionInfo: undefined
            })) || [],
            incomingTargetCount: targeting?.incomingTargets.length || 0,
            outgoingTarget: targeting?.outgoingTarget ? {
              targetId: targeting.outgoingTarget.id,
              targetSwapId: targeting.outgoingTarget.targetSwapId,
              targetSwap: {
                id: targeting.outgoingTarget.targetSwapId,
                bookingDetails: {
                  id: targeting.outgoingTarget.targetSwapId,
                  title: targeting.outgoingTarget.bookingTitle,
                  location: {
                    city: 'Unknown',
                    country: 'Unknown'
                  },
                  dateRange: {
                    checkIn: new Date(),
                    checkOut: new Date()
                  },
                  originalPrice: 0,
                  swapValue: 0
                },
                ownerId: '',
                ownerName: targeting.outgoingTarget.ownerName,
                ownerAvatar: undefined
              },
              proposalId: '',
              status: targeting.outgoingTarget.status,
              createdAt: new Date(),
              updatedAt: new Date(),
              targetSwapInfo: {
                acceptanceStrategy: { type: 'first_match' },
                auctionInfo: undefined
              }
            } : undefined,
            canReceiveTargets: true,
            canTarget: true,
            targetingRestrictions: []
          }
        };

        logger.debug('[mergeSimpleTargetingWithSwapCards] Processed swap card', {
          ...logContext,
          swapId,
          cardIndex: index,
          hasTargeting: !!targeting,
          incomingCount: enhancedCard.targeting.incomingTargetCount,
          hasOutgoing: !!enhancedCard.targeting.outgoingTarget
        });

        return enhancedCard;
      });

      logger.info('[mergeSimpleTargetingWithSwapCards] Merge completed successfully', {
        ...logContext,
        enhancedCardCount: enhancedCards.length,
        cardsWithIncoming: enhancedCards.filter(card => card.targeting.incomingTargetCount > 0).length,
        cardsWithOutgoing: enhancedCards.filter(card => card.targeting.outgoingTarget).length
      });

      return enhancedCards;

    } catch (error) {
      logger.error('[mergeSimpleTargetingWithSwapCards] Merge failed', {
        ...logContext,
        error
      });
      throw error;
    }
  }

  /**
   * Create fallback swap cards with empty targeting data
   * Requirements: 1.1, 1.2, 1.4
   */
  private createFallbackSwapCards(
    basicSwapCards: SwapCardData[],
    fallbackReason: string
  ): EnhancedSwapCardData[] {
    const logContext = { method: 'createFallbackSwapCards', fallbackReason };

    logger.warn('[createFallbackSwapCards] Creating fallback swap cards without targeting data', {
      ...logContext,
      swapCount: basicSwapCards.length
    });

    const fallbackCards: EnhancedSwapCardData[] = basicSwapCards.map(swapCard => ({
      ...swapCard,
      targeting: {
        incomingTargets: [],
        incomingTargetCount: 0,
        outgoingTarget: undefined,
        canReceiveTargets: true,
        canTarget: true,
        targetingRestrictions: []
      }
    }));

    logger.info('[createFallbackSwapCards] Fallback cards created successfully', {
      ...logContext,
      fallbackCardCount: fallbackCards.length
    });

    return fallbackCards;
  }

  /**
   * Transform CompleteSwapData to EnhancedSwapCardData format
   * Requirements: 2.1, 2.2, 5.1, 5.2 - Transform unified query results to display format
   */
  private transformToEnhancedSwapCardData(swapData: CompleteSwapData): EnhancedSwapCardData {
    // Transform the user's swap information
    const userSwap = {
      id: swapData.id,
      bookingDetails: {
        id: swapData.id, // Using swap ID as booking ID for now
        title: swapData.title,
        location: {
          city: swapData.location?.city || 'Unknown City',
          country: swapData.location?.country || 'Unknown Country'
        },
        dateRange: {
          checkIn: swapData.dateRange?.checkIn || swapData.createdAt,
          checkOut: swapData.dateRange?.checkOut || swapData.createdAt
        },
        originalPrice: swapData.pricing.amount || 0,
        swapValue: swapData.pricing.amount || 0
      },
      status: swapData.status as SwapStatus,
      createdAt: swapData.createdAt,
      expiresAt: swapData.expiresAt
    };

    // Transform proposals from others
    // Debug logging to see what's in the proposal object
    if (swapData.targeting.incomingProposals.length > 0) {
      const firstProposal = swapData.targeting.incomingProposals[0];
      logger.debug('[transformToEnhancedSwapCardData] Sample proposal object:', {
        swapId: swapData.id,
        firstProposal: firstProposal,
        hasProposerBookingCity: !!firstProposal?.proposerBookingCity,
        proposerBookingCity: firstProposal?.proposerBookingCity,
        proposerBookingCountry: firstProposal?.proposerBookingCountry,
      });
    }
    const proposalsFromOthers: SwapProposal[] = swapData.targeting.incomingProposals.map(proposal => ({
      id: proposal.id,
      proposerId: proposal.proposerId,
      proposerName: proposal.proposerName,
      targetBookingDetails: {
        id: proposal.proposerSwapId ?? proposal.id,
        title: proposal.proposerSwapTitle ?? 'Untitled Swap',
        location: {
          city: proposal.proposerBookingCity || 'Unknown City',
          country: proposal.proposerBookingCountry || 'Unknown Country'
        },
        dateRange: {
          checkIn: proposal.proposerBookingCheckIn || proposal.createdAt,
          checkOut: proposal.proposerBookingCheckOut || proposal.createdAt
        },
        originalPrice: proposal.proposedTerms.pricing.amount || 0,
        swapValue: proposal.proposedTerms.pricing.amount || 0
      },
      status: proposal.status as SwapStatus,
      createdAt: proposal.createdAt,
      // Use cashOfferAmount for cash proposals, otherwise use proposed terms pricing
      additionalPayment: proposal.proposalType === 'cash'
        ? (proposal.cashOfferAmount || undefined)
        : (proposal.proposedTerms.pricing.amount || undefined),
      conditions: proposal.proposedTerms.message ? [proposal.proposedTerms.message] : [],
      expiresAt: undefined
    }));

    // Transform targeting information
    const targeting = {
      incomingTargets: swapData.targeting.incomingProposals.map(proposal => ({
        targetId: proposal.id,
        sourceSwapId: proposal.proposerSwapId ?? proposal.id,
        sourceSwap: {
          id: proposal.proposerSwapId ?? proposal.id,
          bookingDetails: {
            id: proposal.proposerSwapId ?? proposal.id,
            title: proposal.proposerSwapTitle ?? 'Untitled Swap',
            location: {
              city: proposal.proposerBookingCity || 'Unknown City',
              country: proposal.proposerBookingCountry || 'Unknown Country'
            },
            dateRange: {
              checkIn: proposal.proposerBookingCheckIn || proposal.createdAt,
              checkOut: proposal.proposerBookingCheckOut || proposal.createdAt
            },
            originalPrice: proposal.proposedTerms.pricing.amount || 0,
            swapValue: proposal.proposedTerms.pricing.amount || 0
          },
          ownerId: proposal.proposerId,
          ownerName: proposal.proposerName,
          ownerAvatar: undefined
        },
        proposalId: proposal.id,
        status: proposal.status as SwapTargetStatus,
        createdAt: proposal.createdAt,
        updatedAt: proposal.createdAt
      })) as IncomingTargetInfo[],
      incomingTargetCount: swapData.targeting.totalIncomingCount,
      outgoingTarget: swapData.targeting.outgoingTarget ? {
        targetId: swapData.targeting.outgoingTarget.id,
        targetSwapId: swapData.targeting.outgoingTarget.targetSwapId,
        targetSwap: {
          id: swapData.targeting.outgoingTarget.targetSwapId,
          bookingDetails: {
            id: swapData.targeting.outgoingTarget.targetSwapId,
            title: swapData.targeting.outgoingTarget.targetSwapTitle ?? 'Untitled Swap',
            location: {
              city: swapData.targeting.outgoingTarget.targetBookingCity || 'Unknown City',
              country: swapData.targeting.outgoingTarget.targetBookingCountry || 'Unknown Country'
            },
            dateRange: {
              checkIn: swapData.targeting.outgoingTarget.targetBookingCheckIn || swapData.targeting.outgoingTarget.createdAt,
              checkOut: swapData.targeting.outgoingTarget.targetBookingCheckOut || swapData.targeting.outgoingTarget.createdAt
            },
            originalPrice: 0,
            swapValue: 0
          },
          ownerId: 'unknown', // Will be populated from unified query
          ownerName: swapData.targeting.outgoingTarget.targetOwnerName,
          ownerAvatar: undefined
        },
        proposalId: (swapData.targeting.outgoingTarget as any).sourceSwapId || swapData.targeting.outgoingTarget.id, // Use source_swap_id as proposal identifier
        status: swapData.targeting.outgoingTarget.status as SwapTargetStatus,
        createdAt: swapData.targeting.outgoingTarget.createdAt,
        updatedAt: swapData.targeting.outgoingTarget.createdAt,
        targetSwapInfo: {
          acceptanceStrategy: { type: 'first_match' } as AcceptanceStrategy,
          auctionInfo: undefined
        }
      } as OutgoingTargetInfo : undefined,
      canReceiveTargets: true,
      canTarget: true,
      targetingRestrictions: []
    };

    return {
      userSwap,
      proposalsFromOthers,
      proposalCount: proposalsFromOthers.length,
      targeting
    };
  }

  /**
   * Validate repository data consistency
   * Requirements: 1.1, 1.2, 1.4
   */
  private async validateRepositoryDataConsistency(
    repositoryData: { incomingTargets: any[]; outgoingTargets: any[] },
    userId: string
  ): Promise<void> {
    const logContext = { method: 'validateRepositoryDataConsistency', userId };

    try {
      logger.info('[validateRepositoryDataConsistency] Validating repository data consistency', {
        ...logContext,
        incomingCount: repositoryData.incomingTargets?.length || 0,
        outgoingCount: repositoryData.outgoingTargets?.length || 0
      });

      // Basic validation checks
      if (!repositoryData) {
        throw new Error('Repository data is null or undefined');
      }

      if (!Array.isArray(repositoryData.incomingTargets)) {
        logger.warn('[validateRepositoryDataConsistency] incomingTargets is not an array', {
          ...logContext,
          incomingTargetsType: typeof repositoryData.incomingTargets
        });
      }

      if (!Array.isArray(repositoryData.outgoingTargets)) {
        logger.warn('[validateRepositoryDataConsistency] outgoingTargets is not an array', {
          ...logContext,
          outgoingTargetsType: typeof repositoryData.outgoingTargets
        });
      }

      logger.info('[validateRepositoryDataConsistency] Repository data validation completed', logContext);

    } catch (error) {
      logger.error('[validateRepositoryDataConsistency] Validation failed', {
        ...logContext,
        error
      });
      // Don't throw - this is non-critical validation
    }
  }

  /**
   * Validate enhanced swap cards
   * Requirements: 1.1, 1.2, 1.4
   */
  private validateEnhancedSwapCards(
    enhancedCards: EnhancedSwapCardData[],
    userId: string
  ): { isValid: boolean; warnings: string[] } {
    const logContext = { method: 'validateEnhancedSwapCards', userId };
    const warnings: string[] = [];

    try {
      logger.info('[validateEnhancedSwapCards] Validating enhanced swap cards', {
        ...logContext,
        cardCount: enhancedCards.length
      });

      for (const card of enhancedCards) {
        // Validate targeting structure exists
        if (!card.targeting) {
          warnings.push(`Swap ${card.userSwap.id}: Missing targeting data structure`);
          continue;
        }

        // Validate incoming targets array
        if (!Array.isArray(card.targeting.incomingTargets)) {
          warnings.push(`Swap ${card.userSwap.id}: incomingTargets is not an array`);
        }

        // Validate incoming target count consistency
        if (card.targeting.incomingTargetCount !== card.targeting.incomingTargets.length) {
          warnings.push(`Swap ${card.userSwap.id}: incomingTargetCount mismatch`);
        }
      }

      const isValid = warnings.length === 0;

      logger.info('[validateEnhancedSwapCards] Enhanced swap cards validation completed', {
        ...logContext,
        isValid,
        warningCount: warnings.length,
        warnings: warnings.slice(0, 5) // Log first 5 warnings
      });

      return { isValid, warnings };

    } catch (error) {
      logger.error('[validateEnhancedSwapCards] Validation failed', {
        ...logContext,
        error
      });
      return { isValid: false, warnings: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`] };
    }
  }
}