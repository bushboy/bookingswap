import {
  SwapAuction,
  AuctionStatus,
  AuctionSettings,
  AuctionProposal,
  ProposalType,
  ProposalStatus,
  CreateAuctionRequest,
  CreateProposalRequest,
  AuctionResult,
  AuctionTimingValidation,
  ProposalValidation,
  CashOffer,
  ValidationError
} from '@booking-swap/shared';
import { AuctionRepository } from '../../database/repositories/AuctionRepository';
import { SwapRepository } from '../../database/repositories/SwapRepository';
import { BookingService } from '../booking/BookingService';
import { HederaService, TransactionData } from '../hedera/HederaService';
import {
  AuctionCreationData,
  AuctionProposalData,
  AuctionCompletionData,
  AuctionCancellationData
} from '../hedera/AuctionHederaExtensions';
import { NotificationService } from '../notification/NotificationService';
import { AuctionNotificationService } from '../notification/AuctionNotificationService';
import { PaymentNotificationService } from '../notification/PaymentNotificationService';
import { TimingNotificationService } from '../notification/TimingNotificationService';
import { logger, enhancedLogger } from '../../utils/logger';
import { DateValidator } from '../../utils/DateValidator';
import { AuctionSettingsValidator, ValidatedAuctionSettings } from '../../utils/AuctionSettingsValidator';
import { AuctionErrorMonitoringService } from '../monitoring/AuctionErrorMonitoringService';
import { AuctionErrorResponseBuilder } from '../../utils/AuctionErrorResponseBuilder';
import {
  AuctionCreationError as AuctionCreationErrorUtil,
  ValidationError as AuctionValidationError,
  DateValidationError,
  AuctionSettingsValidationError,
  AuctionErrorUtils
} from '../../utils/AuctionErrors';

export interface AuctionCreationResult {
  auction: SwapAuction;
  blockchainTransaction: {
    transactionId: string;
    consensusTimestamp?: string;
  };
}

export interface AuctionValidationErrorResponse {
  error: 'AUCTION_VALIDATION_FAILED';
  message: string;
  details: {
    field: string;
    value: any;
    expectedType: string;
    validationRule: string;
  }[];
}

export class AuctionCreationError extends Error {
  constructor(
    message: string,
    public auctionId?: string,
    public swapId?: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'AuctionCreationError';
  }
}

export interface ProposalSubmissionResult {
  proposal: AuctionProposal;
  blockchainTransaction: {
    transactionId: string;
    consensusTimestamp?: string;
  };
}

export interface WinnerSelectionResult {
  auction: SwapAuction;
  winningProposal: AuctionProposal;
  blockchainTransaction: {
    transactionId: string;
    consensusTimestamp?: string;
  };
}

export class AuctionManagementService {
  private readonly ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000; // One week in milliseconds
  private readonly AUTO_SELECT_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  private errorMonitoringService: AuctionErrorMonitoringService;

  constructor(
    private auctionRepository: AuctionRepository,
    private swapRepository: SwapRepository,
    private bookingService: BookingService,
    private hederaService: HederaService,
    private notificationService: NotificationService,
    private auctionNotificationService: AuctionNotificationService,
    private paymentNotificationService: PaymentNotificationService,
    private timingNotificationService: TimingNotificationService
  ) {
    this.errorMonitoringService = AuctionErrorMonitoringService.getInstance();
  }

  /**
   * Create a new auction with enhanced validation
   */
  async createAuction(request: CreateAuctionRequest): Promise<AuctionCreationResult> {
    try {
      logger.info('Creating auction with enhanced validation', {
        swapId: request.swapId,
        auctionEndDate: request.settings?.endDate,
        auctionEndDateType: typeof request.settings?.endDate
      });

      // Step 0: Validate swap ID is not null/undefined
      if (!request.swapId || request.swapId.trim() === '') {
        const swapIdError = new ValidationError('Swap ID is required and cannot be null or empty');

        // Record swap ID validation error in monitoring service
        this.errorMonitoringService.recordAuctionError(
          swapIdError,
          {
            phase: 'validation',
            swapId: request.swapId,
            operation: 'swap_id_validation',
            metadata: {
              swapIdValue: request.swapId,
              swapIdType: typeof request.swapId,
              validationRule: 'swap_id_not_null_or_empty'
            }
          }
        );

        logger.error('Swap ID validation failed - null or empty swap ID provided', {
          category: 'swap_id_validation',
          error: swapIdError.message,
          swapIdValue: request.swapId,
          swapIdType: typeof request.swapId,
          validationContext: {
            phase: 'auction_creation_validation',
            timestamp: new Date().toISOString(),
            rule: 'swap_id_required'
          }
        });

        throw new AuctionCreationError(
          'Cannot create auction: Swap ID is required and cannot be null or empty',
          undefined,
          request.swapId,
          swapIdError
        );
      }

      // Step 1: Enhanced auction settings validation
      let validatedSettings: ValidatedAuctionSettings;
      try {
        validatedSettings = AuctionSettingsValidator.validateAuctionSettings(request.settings);
        logger.info('Auction settings validation passed', {
          swapId: request.swapId,
          endDate: validatedSettings.endDate.toISOString(),
          allowBookingProposals: validatedSettings.allowBookingProposals,
          allowCashProposals: validatedSettings.allowCashProposals
        });
      } catch (validationError) {
        // Record validation error in monitoring service
        this.errorMonitoringService.recordAuctionError(
          validationError instanceof Error ? validationError : new Error('Unknown auction settings validation error'),
          {
            phase: 'validation',
            swapId: request.swapId,
            operation: 'auction_settings_validation',
            metadata: {
              originalSettings: request.settings,
              settingsEndDate: request.settings?.endDate,
              settingsEndDateType: typeof request.settings?.endDate
            }
          }
        );

        logger.error('Auction settings validation failed with comprehensive context', {
          category: 'auction_settings_validation',
          error: validationError instanceof Error ? validationError.message : validationError,
          errorType: validationError instanceof Error ? validationError.constructor.name : typeof validationError,
          stack: validationError instanceof Error ? validationError.stack : undefined,
          originalSettings: {
            endDate: request.settings?.endDate,
            endDateType: typeof request.settings?.endDate,
            endDateIsDate: request.settings?.endDate instanceof Date,
            allowBookingProposals: request.settings?.allowBookingProposals,
            allowCashProposals: request.settings?.allowCashProposals,
            autoSelectAfterHours: request.settings?.autoSelectAfterHours
          },
          swapId: request.swapId,
          validationContext: {
            phase: 'auction_settings_validation',
            timestamp: new Date().toISOString()
          }
        });

        if (validationError instanceof ValidationError) {
          const errorResponse = this.createValidationErrorResponse(validationError, { swapId: request.swapId });
          logger.error('Structured validation error response created', {
            errorResponse,
            category: 'structured_error_response'
          });
          throw new AuctionCreationError(
            errorResponse.message,
            undefined,
            request.swapId,
            validationError
          );
        }

        // Re-throw auction-specific errors as-is
        if (AuctionErrorUtils.isAuctionError(validationError)) {
          throw validationError;
        }

        throw new AuctionCreationError(
          `Auction settings validation failed: ${validationError instanceof Error ? validationError.message : 'Unknown validation error'}`,
          undefined,
          request.swapId,
          validationError instanceof Error ? validationError : undefined
        );
      }

      // Step 2: Get the swap to determine owner and validate timing
      const swap = await this.swapRepository.findById(request.swapId);
      if (!swap) {
        const swapNotFoundError = new ValidationError(`Swap not found with ID: ${request.swapId}`);

        // Record swap not found error in monitoring service
        this.errorMonitoringService.recordAuctionError(
          swapNotFoundError,
          {
            phase: 'validation',
            swapId: request.swapId,
            operation: 'swap_existence_validation',
            metadata: {
              swapId: request.swapId,
              validationRule: 'swap_must_exist'
            }
          }
        );

        logger.error('Swap existence validation failed - swap not found', {
          category: 'swap_existence_validation',
          error: swapNotFoundError.message,
          swapId: request.swapId,
          validationContext: {
            phase: 'auction_creation_validation',
            timestamp: new Date().toISOString(),
            rule: 'swap_must_exist_before_auction_creation'
          }
        });

        throw new AuctionCreationError(
          `Cannot create auction: Swap not found with ID ${request.swapId}`,
          undefined,
          request.swapId,
          swapNotFoundError
        );
      }

      // Additional validation: Ensure swap has a valid ID
      if (!swap.id || swap.id.trim() === '') {
        const invalidSwapIdError = new ValidationError('Retrieved swap has invalid or empty ID');

        logger.error('Retrieved swap has invalid ID', {
          category: 'swap_id_validation',
          error: invalidSwapIdError.message,
          requestedSwapId: request.swapId,
          retrievedSwapId: swap.id,
          swapObject: {
            id: swap.id,
            sourceBookingId: swap.sourceBookingId,
            status: swap.status
          }
        });

        throw new AuctionCreationError(
          'Cannot create auction: Retrieved swap has invalid ID',
          undefined,
          request.swapId,
          invalidSwapIdError
        );
      }

      // Step 3: Get source booking for event date validation
      const sourceBooking = await this.bookingService.getBookingById(swap.sourceBookingId);
      if (!sourceBooking) {
        throw new ValidationError('Source booking not found');
      }

      // Step 4: Validate auction timing against event date
      try {
        AuctionSettingsValidator.validateAuctionTiming(
          validatedSettings.endDate,
          sourceBooking.dateRange.checkIn
        );
        logger.info('Auction timing validation passed', {
          swapId: request.swapId,
          auctionEndDate: validatedSettings.endDate.toISOString(),
          eventDate: sourceBooking.dateRange.checkIn.toISOString()
        });
      } catch (timingError) {
        // Record timing validation error in monitoring service
        this.errorMonitoringService.recordAuctionError(
          timingError instanceof Error ? timingError : new Error('Unknown auction timing validation error'),
          {
            phase: 'validation',
            swapId: request.swapId,
            operation: 'auction_timing_validation',
            metadata: {
              auctionEndDate: validatedSettings.endDate.toISOString(),
              eventDate: sourceBooking.dateRange.checkIn.toISOString(),
              timeDifference: validatedSettings.endDate.getTime() - sourceBooking.dateRange.checkIn.getTime(),
              oneWeekMs: this.ONE_WEEK_MS
            }
          }
        );

        logger.error('Auction timing validation failed with comprehensive context', {
          category: 'auction_timing_validation',
          error: timingError instanceof Error ? timingError.message : timingError,
          errorType: timingError instanceof Error ? timingError.constructor.name : typeof timingError,
          stack: timingError instanceof Error ? timingError.stack : undefined,
          auctionEndDate: validatedSettings.endDate.toISOString(),
          eventDate: sourceBooking.dateRange.checkIn.toISOString(),
          timeDifference: validatedSettings.endDate.getTime() - sourceBooking.dateRange.checkIn.getTime(),
          oneWeekThreshold: this.ONE_WEEK_MS,
          swapId: request.swapId,
          validationContext: {
            phase: 'auction_timing_validation',
            timestamp: new Date().toISOString(),
            rule: 'auction_end_must_be_before_event_minus_one_week'
          }
        });

        if (timingError instanceof ValidationError) {
          const errorResponse = this.createValidationErrorResponse(timingError, { swapId: request.swapId });
          logger.error('Structured timing validation error response created', {
            errorResponse,
            category: 'structured_error_response'
          });
          throw new AuctionCreationError(
            errorResponse.message,
            undefined,
            request.swapId,
            timingError
          );
        }

        // Re-throw auction-specific errors as-is
        if (AuctionErrorUtils.isAuctionError(timingError)) {
          throw timingError;
        }

        throw new AuctionCreationError(
          `Auction timing validation failed: ${timingError instanceof Error ? timingError.message : 'Unknown timing error'}`,
          undefined,
          request.swapId,
          timingError instanceof Error ? timingError : undefined
        );
      }

      // Step 5: Validate settings consistency with swap payment preferences
      // Note: Basic Swap interface doesn't have payment preferences, so we'll skip consistency validation
      // This would be implemented when using EnhancedSwap interface
      try {
        // For now, we'll perform basic validation without swap-specific constraints
        // In a full implementation, this would check against EnhancedSwap payment preferences
        logger.info('Skipping swap payment consistency validation for basic Swap interface', {
          swapId: request.swapId
        });
      } catch (consistencyError) {
        logger.error('Auction settings consistency validation failed', {
          error: consistencyError instanceof Error ? consistencyError.message : consistencyError,
          swapId: request.swapId
        });

        if (consistencyError instanceof ValidationError) {
          const errorResponse = this.createValidationErrorResponse(consistencyError, { swapId: request.swapId });
          logger.error('Structured consistency validation error response created', { errorResponse });
          throw new AuctionCreationError(
            errorResponse.message,
            undefined,
            request.swapId,
            consistencyError
          );
        }
        throw new AuctionCreationError(
          `Auction settings consistency validation failed: ${consistencyError instanceof Error ? consistencyError.message : 'Unknown consistency error'}`,
          undefined,
          request.swapId,
          consistencyError instanceof Error ? consistencyError : undefined
        );
      }

      // Step 6: Create auction entity with validated settings
      const auctionData: Omit<SwapAuction, 'id' | 'createdAt' | 'updatedAt' | 'proposals'> = {
        swapId: request.swapId,
        ownerId: sourceBooking.userId, // Get owner ID from the source booking
        status: 'active',
        settings: validatedSettings, // Use validated settings with proper Date objects
        blockchain: {
          creationTransactionId: '', // Will be updated after blockchain submission
        },
      };

      // Step 7: Save to database
      const auction = await this.auctionRepository.createAuction(auctionData);

      // Step 8: Record auction creation on blockchain with validated settings
      let blockchainResult: string;
      try {
        blockchainResult = await this.hederaService.recordAuctionCreation({
          auctionId: auction.id,
          swapId: request.swapId,
          ownerId: auction.ownerId,
          settings: validatedSettings, // Pass validated settings with proper Date objects
        });

        logger.info('Blockchain auction creation recorded successfully', {
          auctionId: auction.id,
          transactionId: blockchainResult,
          endDate: validatedSettings.endDate.toISOString()
        });
      } catch (blockchainError) {
        logger.error('Failed to record auction creation on blockchain', {
          error: blockchainError instanceof Error ? blockchainError.message : blockchainError,
          stack: blockchainError instanceof Error ? blockchainError.stack : undefined,
          auctionId: auction.id,
          swapId: request.swapId,
          validatedSettings: {
            endDate: validatedSettings.endDate.toISOString(),
            endDateType: typeof validatedSettings.endDate,
            allowBookingProposals: validatedSettings.allowBookingProposals,
            allowCashProposals: validatedSettings.allowCashProposals
          }
        });

        // Clean up auction if blockchain recording fails
        await this.auctionRepository.delete(auction.id);
        throw new AuctionCreationError(
          `Failed to record auction on blockchain: ${blockchainError instanceof Error ? blockchainError.message : 'Unknown blockchain error'}`,
          auction.id,
          request.swapId,
          blockchainError instanceof Error ? blockchainError : undefined
        );
      }

      // Step 9: Update auction with blockchain info
      const updatedAuction = await this.auctionRepository.updateBlockchainTransactionIds(auction.id, {
        blockchain_creation_transaction_id: blockchainResult,
      });

      if (!updatedAuction) {
        throw new Error('Failed to update auction with blockchain information');
      }

      // Step 10: Schedule auction end timer
      await this.scheduleAuctionEnd(auction.id, validatedSettings.endDate);

      // Step 11: Send notifications to interested users
      await this.notificationService.sendAuctionCreatedNotification({
        auctionId: auction.id,
        swapId: request.swapId,
        ownerId: auction.ownerId,
        endDate: validatedSettings.endDate,
      });

      logger.info('Auction created successfully with enhanced validation', {
        auctionId: auction.id,
        blockchainTransactionId: blockchainResult,
        endDate: validatedSettings.endDate.toISOString(),
        validationPassed: true
      });

      return {
        auction: updatedAuction,
        blockchainTransaction: {
          transactionId: blockchainResult,
          consensusTimestamp: undefined,
        },
      };
    } catch (error) {
      logger.error('Failed to create auction with enhanced validation', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        request: {
          swapId: request.swapId,
          settings: request.settings
        }
      });

      // Re-throw AuctionCreationError and ValidationError as-is for proper error handling
      if (error instanceof AuctionCreationError || error instanceof ValidationError) {
        throw error;
      }

      // Wrap other errors in AuctionCreationError for consistency
      throw new AuctionCreationError(
        `Auction creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        request.swapId,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Create structured error response for validation failures with comprehensive context
   */
  private createValidationErrorResponse(
    error: ValidationError,
    context: { swapId?: string; auctionId?: string }
  ): AuctionValidationErrorResponse {
    // Use the enhanced error response builder for comprehensive error responses
    const errorResponseBuilder = new AuctionErrorResponseBuilder();
    const structuredResponse = errorResponseBuilder.buildErrorResponse(error, {
      operation: 'auction_validation',
      auctionId: context.auctionId,
      swapId: context.swapId,
      metadata: {
        validationPhase: 'auction_creation',
        timestamp: new Date().toISOString()
      }
    });

    // Log the structured response for monitoring
    logger.info('Comprehensive validation error response created', {
      category: 'structured_error_response',
      errorCode: structuredResponse.error.code,
      errorType: structuredResponse.error.type,
      context: context,
      hasDebugging: !!structuredResponse.debugging
    });

    // Create legacy-compatible response for backward compatibility
    return AuctionErrorResponseBuilder.createLegacyValidationErrorResponse(error, context);
  }

  /**
   * Validate auction creation request
   */
  private async validateAuctionCreation(request: CreateAuctionRequest): Promise<AuctionTimingValidation> {
    try {
      // Get the swap and source booking to check event date
      const swap = await this.swapRepository.findById(request.swapId);
      if (!swap) {
        return {
          eventDate: new Date(),
          auctionEndDate: request.settings.endDate,
          isValid: false,
          minimumEndDate: new Date(),
          isLastMinute: false,
          errors: ['Swap not found'],
        };
      }

      const sourceBooking = await this.bookingService.getBookingById(swap.sourceBookingId);
      if (!sourceBooking) {
        return {
          eventDate: new Date(),
          auctionEndDate: request.settings.endDate,
          isValid: false,
          minimumEndDate: new Date(),
          isLastMinute: false,
          errors: ['Source booking not found'],
        };
      }

      const eventDate = sourceBooking.dateRange.checkIn;
      const auctionEndDate = request.settings.endDate;
      const now = new Date();
      const oneWeekBeforeEvent = new Date(eventDate.getTime() - this.ONE_WEEK_MS);

      const errors: string[] = [];

      // Check if auction end date is in the past
      if (auctionEndDate <= now) {
        errors.push('Auction end date must be in the future');
      }

      // Check if event is less than one week away (last-minute booking)
      const isLastMinute = eventDate.getTime() - now.getTime() < this.ONE_WEEK_MS;
      if (isLastMinute) {
        errors.push('Auctions are not allowed for events less than one week away');
      }

      // Check if auction end date is at least one week before event
      if (auctionEndDate > oneWeekBeforeEvent) {
        errors.push(`Auction must end at least one week before the event (by ${oneWeekBeforeEvent.toISOString()})`);
      }

      // Validate auction settings
      if (request.settings.autoSelectAfterHours && request.settings.autoSelectAfterHours < 1) {
        errors.push('Auto-select timeout must be at least 1 hour');
      }

      if (request.settings.minimumCashOffer && request.settings.minimumCashOffer <= 0) {
        errors.push('Minimum cash offer must be greater than 0');
      }

      if (!request.settings.allowBookingProposals && !request.settings.allowCashProposals) {
        errors.push('At least one proposal type must be allowed');
      }

      return {
        eventDate,
        auctionEndDate,
        isValid: errors.length === 0,
        minimumEndDate: oneWeekBeforeEvent,
        isLastMinute,
        errors,
      };
    } catch (error) {
      logger.error('Failed to validate auction creation', { error, request });
      return {
        eventDate: new Date(),
        auctionEndDate: request.settings.endDate,
        isValid: false,
        minimumEndDate: new Date(),
        isLastMinute: false,
        errors: ['Validation error occurred'],
      };
    }
  }

  /**
   * End an auction and update its status
   */
  async endAuction(auctionId: string): Promise<AuctionResult> {
    try {
      logger.info('Ending auction', { auctionId });

      const auction = await this.auctionRepository.findById(auctionId);
      if (!auction) {
        throw new Error('Auction not found');
      }

      if (auction.status !== 'active') {
        throw new Error(`Cannot end auction with status: ${auction.status}`);
      }

      const endedAt = new Date();
      const updatedAuction = await this.auctionRepository.updateStatus(auctionId, 'ended', endedAt);
      if (!updatedAuction) {
        throw new Error('Failed to update auction status');
      }

      // Record auction end on blockchain
      const blockchainResult = await this.hederaService.recordAuctionCompletion({
        auctionId,
        endedAt,
        totalProposals: auction.proposals.length,
        completionReason: 'owner_selection',
      });

      // Update auction with end transaction ID
      await this.auctionRepository.updateBlockchainTransactionIds(auctionId, {
        blockchain_end_transaction_id: blockchainResult,
      });

      // Send notification to auction owner
      await this.notificationService.sendAuctionEndedNotification({
        auctionId,
        ownerId: auction.ownerId,
        totalProposals: auction.proposals.length,
        endedAt,
      });

      // Send notifications to active bidders
      const activeBidderIds = auction.proposals
        .filter(p => p.status === 'pending')
        .map(p => p.proposerId);

      if (activeBidderIds.length > 0) {
        await this.notificationService.sendAuctionEndedToBidders({
          auctionId,
          bidderIds: activeBidderIds,
          endedAt,
          totalProposals: auction.proposals.length,
        });
      }

      // Schedule auto-selection timeout if configured
      if (auction.settings.autoSelectAfterHours) {
        await this.scheduleAutoSelection(auctionId, auction.settings.autoSelectAfterHours);
      }

      logger.info('Auction ended successfully', { auctionId, totalProposals: auction.proposals.length });

      return {
        auctionId,
        status: 'ended',
        endedAt,
        totalProposals: auction.proposals.length,
      };
    } catch (error) {
      logger.error('Failed to end auction', { error, auctionId });
      throw error;
    }
  }

  /**
   * Get auction by ID with proposals
   */
  async getAuctionById(auctionId: string): Promise<SwapAuction | null> {
    try {
      return await this.auctionRepository.findById(auctionId);
    } catch (error) {
      logger.error('Failed to get auction by ID', { error, auctionId });
      throw error;
    }
  }

  /**
   * Get auction by swap ID
   */
  async getAuctionBySwapId(swapId: string): Promise<SwapAuction | null> {
    try {
      return await this.auctionRepository.findBySwapId(swapId);
    } catch (error) {
      logger.error('Failed to get auction by swap ID', { error, swapId });
      throw error;
    }
  }

  /**
   * Get active auctions
   */
  async getActiveAuctions(limit: number = 100, offset: number = 0): Promise<SwapAuction[]> {
    try {
      return await this.auctionRepository.findAuctions({ status: 'active' }, limit, offset);
    } catch (error) {
      logger.error('Failed to get active auctions', { error });
      throw error;
    }
  }

  /**
   * Get auctions for a user (as owner)
   */
  async getUserAuctions(userId: string, limit: number = 100, offset: number = 0): Promise<SwapAuction[]> {
    try {
      return await this.auctionRepository.findAuctions({ ownerId: userId }, limit, offset);
    } catch (error) {
      logger.error('Failed to get user auctions', { error, userId });
      throw error;
    }
  }

  /**
   * Cancel an auction (only by owner)
   */
  async cancelAuction(auctionId: string, userId: string): Promise<SwapAuction> {
    try {
      logger.info('Cancelling auction', { auctionId, userId });

      const auction = await this.auctionRepository.findById(auctionId);
      if (!auction) {
        throw new Error('Auction not found');
      }

      if (auction.ownerId !== userId) {
        throw new Error('Only the auction owner can cancel an auction');
      }

      if (auction.status !== 'active') {
        throw new Error(`Cannot cancel auction with status: ${auction.status}`);
      }

      const cancelledAt = new Date();
      const updatedAuction = await this.auctionRepository.updateStatus(auctionId, 'cancelled', cancelledAt);
      if (!updatedAuction) {
        throw new Error('Failed to update auction status');
      }

      // Record cancellation on blockchain
      await this.hederaService.recordAuctionCancellation({
        auctionId,
        reason: 'cancelled_by_owner',
        cancelledBy: userId,
        cancelledAt,
      });

      // Send notifications to all proposers
      for (const proposal of auction.proposals) {
        if (proposal.status === 'pending') {
          await this.notificationService.sendAuctionCancelledNotification({
            auctionId,
            recipientUserId: proposal.proposerId,
            cancelledAt,
          });
        }
      }

      logger.info('Auction cancelled successfully', { auctionId });
      return updatedAuction;
    } catch (error) {
      logger.error('Failed to cancel auction', { error, auctionId });
      throw error;
    }
  }

  /**
   * Check if a booking is last-minute (less than one week to event)
   */
  async isLastMinuteBooking(bookingId: string): Promise<boolean> {
    try {
      const booking = await this.bookingService.getBookingById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      const now = new Date();
      const eventDate = booking.dateRange.checkIn;
      const timeToEvent = eventDate.getTime() - now.getTime();

      return timeToEvent < this.ONE_WEEK_MS;
    } catch (error) {
      logger.error('Failed to check if booking is last-minute', { error, bookingId });
      throw error;
    }
  }

  /**
   * Validate auction timing against event date
   */
  async validateAuctionTiming(eventDate: Date, auctionEndDate: Date): Promise<AuctionTimingValidation> {
    const now = new Date();
    const oneWeekBeforeEvent = new Date(eventDate.getTime() - this.ONE_WEEK_MS);
    const errors: string[] = [];

    // Check if auction end date is in the past
    if (auctionEndDate <= now) {
      errors.push('Auction end date must be in the future');
    }

    // Check if event is less than one week away
    const isLastMinute = eventDate.getTime() - now.getTime() < this.ONE_WEEK_MS;
    if (isLastMinute) {
      errors.push('Auctions are not allowed for events less than one week away');
    }

    // Check if auction end date is at least one week before event
    if (auctionEndDate > oneWeekBeforeEvent) {
      errors.push(`Auction must end at least one week before the event`);
    }

    return {
      eventDate,
      auctionEndDate,
      isValid: errors.length === 0,
      minimumEndDate: oneWeekBeforeEvent,
      isLastMinute,
      errors,
    };
  }

  /**
   * Schedule auction end timer (placeholder for timer integration)
   */
  private async scheduleAuctionEnd(auctionId: string, endDate: Date): Promise<void> {
    // TODO: Integrate with timer service or job scheduler
    logger.info('Scheduling auction end', { auctionId, endDate });

    // For now, we'll rely on a periodic job to check for expired auctions
    // In a production system, this would integrate with a job scheduler like Bull or Agenda
  }

  /**
   * Schedule auto-selection timeout (placeholder for timer integration)
   */
  private async scheduleAutoSelection(auctionId: string, hoursAfterEnd: number): Promise<void> {
    // TODO: Integrate with timer service or job scheduler
    logger.info('Scheduling auto-selection', { auctionId, hoursAfterEnd });

    // For now, we'll rely on a periodic job to check for auctions needing auto-selection
    // In a production system, this would integrate with a job scheduler
  }

  /**
   * Submit a proposal to an auction
   */
  async submitProposal(request: CreateProposalRequest): Promise<ProposalSubmissionResult> {
    try {
      logger.info('Submitting auction proposal', {
        swapId: request.swapId,
        proposalType: request.proposalType
      });

      // Step 1: Validate the proposal
      const validation = await this.validateProposal(request);
      if (!validation.isValid) {
        throw new Error(`Proposal validation failed: ${validation.errors.join(', ')}`);
      }

      // Step 2: Get the auction
      const auction = await this.auctionRepository.findBySwapId(request.swapId);
      if (!auction) {
        throw new Error('Auction not found for this swap');
      }

      if (auction.status !== 'active') {
        throw new Error(`Cannot submit proposal to auction with status: ${auction.status}`);
      }

      // Step 3: Check if auction has ended
      if (new Date() > auction.settings.endDate) {
        throw new Error('Auction has ended');
      }

      // Step 4: Create proposal entity
      const proposalData: Omit<AuctionProposal, 'id' | 'createdAt' | 'updatedAt'> = {
        auctionId: auction.id,
        proposerId: request.proposerId || '', // Will be set from auth context
        proposalType: request.proposalType,
        bookingId: request.bookingId,
        cashOffer: request.cashOffer ? {
          amount: request.cashOffer.amount,
          currency: request.cashOffer.currency,
          paymentMethodId: request.cashOffer.paymentMethodId,
          escrowRequired: request.cashOffer.escrowAgreement,
        } : undefined,
        message: request.message,
        conditions: request.conditions,
        status: 'pending',
        submittedAt: new Date(),
        blockchain: {
          transactionId: '', // Will be updated after blockchain submission
        },
      };

      // Step 5: Save to database
      const proposal = await this.auctionRepository.createProposal(proposalData);

      // Step 6: Record proposal on blockchain
      const blockchainResult = await this.hederaService.recordAuctionProposal({
        proposalId: proposal.id,
        auctionId: auction.id,
        proposerId: proposal.proposerId,
        proposalType: request.proposalType,
        bookingId: request.bookingId,
        cashOffer: proposal.cashOffer,
        message: request.message,
        conditions: request.conditions,
      });

      // Step 7: Update proposal with blockchain info
      const updatedProposal = await this.auctionRepository.updateProposalStatus(proposal.id, 'pending');
      if (!updatedProposal) {
        throw new Error('Failed to update proposal with blockchain information');
      }

      // Step 8: Send notification to auction owner
      await this.notificationService.sendAuctionProposalNotification({
        auctionId: auction.id,
        proposalId: proposal.id,
        ownerId: auction.ownerId,
        proposerId: proposal.proposerId,
        proposalType: request.proposalType,
      });

      logger.info('Auction proposal submitted successfully', {
        proposalId: proposal.id,
        auctionId: auction.id,
        transactionId: blockchainResult.transactionId,
      });

      return {
        proposal: updatedProposal,
        blockchainTransaction: {
          transactionId: blockchainResult,
          consensusTimestamp: undefined,
        },
      };
    } catch (error) {
      logger.error('Failed to submit auction proposal', { error, request });
      throw error;
    }
  }

  /**
   * Validate proposal submission
   */
  private async validateProposal(request: CreateProposalRequest): Promise<ProposalValidation> {
    try {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Get the auction and swap
      const auction = await this.auctionRepository.findBySwapId(request.swapId);
      if (!auction) {
        return {
          isValid: false,
          errors: ['Auction not found for this swap'],
          warnings: [],
        };
      }

      const swap = await this.swapRepository.findById(request.swapId);
      if (!swap) {
        return {
          isValid: false,
          errors: ['Swap not found'],
          warnings: [],
        };
      }

      // Check if proposer is not the auction owner
      if (auction.ownerId === request.proposerId) {
        errors.push('Cannot submit proposal to your own auction');
      }

      // Validate proposal type is allowed
      if (request.proposalType === 'booking' && !auction.settings.allowBookingProposals) {
        errors.push('Booking proposals are not allowed for this auction');
      }

      if (request.proposalType === 'cash' && !auction.settings.allowCashProposals) {
        errors.push('Cash proposals are not allowed for this auction');
      }

      // Validate booking proposal
      if (request.proposalType === 'booking') {
        if (!request.bookingId) {
          errors.push('Booking ID is required for booking proposals');
        } else {
          const booking = await this.bookingService.getBookingById(request.bookingId);
          if (!booking) {
            errors.push('Booking not found');
          } else {
            if (booking.userId !== request.proposerId) {
              errors.push('You can only propose your own bookings');
            }
            if (booking.status !== 'available') {
              errors.push('Booking is not available for swap');
            }
            if (booking.verification.status !== 'verified') {
              errors.push('Booking must be verified before proposing');
            }
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

          if (auction.settings.minimumCashOffer && request.cashOffer.amount < auction.settings.minimumCashOffer) {
            errors.push(`Cash offer must be at least ${auction.settings.minimumCashOffer}`);
          }

          if (!request.cashOffer.paymentMethodId) {
            errors.push('Payment method is required for cash offers');
          }

          // TODO: Validate payment method exists and is verified
          // This would require integration with payment service
        }
      }

      // Check for duplicate proposals from same user
      const existingProposals = await this.auctionRepository.findProposals({
        auctionId: auction.id,
        proposerId: request.proposerId,
        status: 'pending',
      });

      if (existingProposals.length > 0) {
        warnings.push('You already have a pending proposal for this auction');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        paymentMethodValid: request.proposalType === 'cash' ? true : undefined, // TODO: Implement actual validation
        escrowRequired: request.proposalType === 'cash' ? request.cashOffer?.escrowAgreement : undefined,
      };
    } catch (error) {
      logger.error('Failed to validate proposal', { error, request });
      return {
        isValid: false,
        errors: ['Validation error occurred'],
        warnings: [],
      };
    }
  }

  /**
   * Get proposals for an auction
   */
  async getAuctionProposals(auctionId: string): Promise<AuctionProposal[]> {
    try {
      return await this.auctionRepository.getAuctionProposals(auctionId);
    } catch (error) {
      logger.error('Failed to get auction proposals', { error, auctionId });
      throw error;
    }
  }

  /**
   * Select winning proposal
   */
  async selectWinningProposal(auctionId: string, proposalId: string, userId: string): Promise<WinnerSelectionResult> {
    try {
      logger.info('Selecting winning proposal', { auctionId, proposalId, userId });

      const auction = await this.auctionRepository.findById(auctionId);
      if (!auction) {
        throw new Error('Auction not found');
      }

      if (auction.ownerId !== userId) {
        throw new Error('Only the auction owner can select winning proposal');
      }

      if (auction.status !== 'ended') {
        throw new Error(`Cannot select winner for auction with status: ${auction.status}`);
      }

      if (auction.winningProposalId) {
        throw new Error('Winning proposal has already been selected');
      }

      // Find the proposal
      const proposal = auction.proposals.find(p => p.id === proposalId);
      if (!proposal) {
        throw new Error('Proposal not found in this auction');
      }

      if (proposal.status !== 'pending') {
        throw new Error(`Cannot select proposal with status: ${proposal.status}`);
      }

      // Update auction and proposals
      const updatedAuction = await this.auctionRepository.selectWinningProposal(auctionId, proposalId);
      if (!updatedAuction) {
        throw new Error('Failed to select winning proposal');
      }

      // Get the updated winning proposal
      const winningProposal = updatedAuction.proposals.find(p => p.id === proposalId);
      if (!winningProposal) {
        throw new Error('Failed to retrieve winning proposal');
      }

      // Record winner selection on blockchain
      const blockchainResult = await this.hederaService.recordWinnerSelection(auctionId, proposalId, userId);

      // Send notifications using specialized service
      const loserIds = auction.proposals
        .filter(p => p.id !== proposalId && p.status === 'rejected')
        .map(p => p.proposerId);

      await this.auctionNotificationService.sendAuctionCompletionNotifications({
        auctionId,
        ownerId: auction.ownerId,
        winningProposalId: proposalId,
        winnerId: proposal.proposerId,
        loserIds,
        proposalType: proposal.proposalType,
        swapId: auction.swapId,
      });

      // Also send individual notifications for backward compatibility
      await Promise.all([
        // Notify winner
        this.notificationService.sendAuctionWinnerNotification({
          auctionId,
          proposalId,
          winnerId: proposal.proposerId,
          ownerId: auction.ownerId,
        }),
        // Notify losers
        ...loserIds.map(loserId => this.notificationService.sendAuctionLoserNotification({
          auctionId,
          proposalId: p.id,
          loserId: p.proposerId,
          ownerId: auction.ownerId,
        })),
      ]);

      logger.info('Winning proposal selected successfully', {
        auctionId,
        proposalId,
        transactionId: blockchainResult.transactionId,
      });

      return {
        auction: updatedAuction,
        winningProposal,
        blockchainTransaction: {
          transactionId: blockchainResult,
          consensusTimestamp: undefined,
        },
      };
    } catch (error) {
      logger.error('Failed to select winning proposal', { error, auctionId, proposalId });
      throw error;
    }
  }

  /**
   * Compare and rank proposals for an auction
   */
  async compareProposals(auctionId: string): Promise<{
    bookingProposals: AuctionProposal[];
    cashProposals: AuctionProposal[];
    rankedCashProposals: AuctionProposal[];
    highestCashOffer?: CashOffer;
    recommendedProposal?: string;
  }> {
    try {
      const proposals = await this.getAuctionProposals(auctionId);

      const bookingProposals = proposals.filter(p => p.proposalType === 'booking' && p.status === 'pending');
      const cashProposals = proposals.filter(p => p.proposalType === 'cash' && p.status === 'pending');

      // Rank cash proposals by amount (highest first)
      const rankedCashProposals = cashProposals.sort((a, b) => {
        const amountA = a.cashOffer?.amount || 0;
        const amountB = b.cashOffer?.amount || 0;
        return amountB - amountA;
      });

      const highestCashOffer = rankedCashProposals[0]?.cashOffer;

      // Simple recommendation: highest cash offer if available, otherwise first booking proposal
      let recommendedProposal: string | undefined;
      if (rankedCashProposals.length > 0) {
        recommendedProposal = rankedCashProposals[0].id;
      } else if (bookingProposals.length > 0) {
        recommendedProposal = bookingProposals[0].id;
      }

      return {
        bookingProposals,
        cashProposals,
        rankedCashProposals,
        highestCashOffer,
        recommendedProposal,
      };
    } catch (error) {
      logger.error('Failed to compare proposals', { error, auctionId });
      throw error;
    }
  }

  /**
   * Handle automatic winner selection after timeout
   */
  async handleAutoSelection(auctionId: string): Promise<WinnerSelectionResult | null> {
    try {
      logger.info('Handling auto-selection for auction', { auctionId });

      const auction = await this.auctionRepository.findById(auctionId);
      if (!auction) {
        throw new Error('Auction not found');
      }

      if (auction.status !== 'ended') {
        logger.warn('Auto-selection called for non-ended auction', { auctionId, status: auction.status });
        return null;
      }

      if (auction.winningProposalId) {
        logger.info('Auction already has winning proposal', { auctionId });
        return null;
      }

      if (!auction.settings.autoSelectAfterHours) {
        logger.info('Auto-selection not configured for auction', { auctionId });
        return null;
      }

      // Check if enough time has passed since auction ended
      if (!auction.endedAt) {
        logger.warn('Auction ended but no endedAt timestamp', { auctionId });
        return null;
      }

      const timeoutMs = auction.settings.autoSelectAfterHours * 60 * 60 * 1000;
      const timeSinceEnd = new Date().getTime() - auction.endedAt.getTime();

      if (timeSinceEnd < timeoutMs) {
        logger.info('Auto-selection timeout not reached yet', {
          auctionId,
          timeSinceEnd,
          timeoutMs
        });
        return null;
      }

      // Get the best proposal automatically
      const comparison = await this.compareProposals(auctionId);
      if (!comparison.recommendedProposal) {
        logger.info('No proposals available for auto-selection', { auctionId });
        return null;
      }

      // Select the recommended proposal automatically
      const result = await this.selectWinningProposal(
        auctionId,
        comparison.recommendedProposal,
        auction.ownerId
      );

      // Send notification about auto-selection using specialized service
      const winningProposal = auction.proposals.find(p => p.id === comparison.recommendedProposal);
      if (winningProposal) {
        const loserIds = auction.proposals
          .filter(p => p.id !== comparison.recommendedProposal)
          .map(p => p.proposerId);

        await this.auctionNotificationService.sendAutoSelectionNotifications({
          auctionId,
          ownerId: auction.ownerId,
          winningProposalId: comparison.recommendedProposal,
          winnerId: winningProposal.proposerId,
          loserIds,
          reason: 'Owner did not respond within the specified timeframe',
        });
      }

      // Also send the original notification for backward compatibility
      await this.notificationService.sendAutoSelectionNotification({
        auctionId,
        ownerId: auction.ownerId,
        winningProposalId: comparison.recommendedProposal,
      });

      logger.info('Auto-selection completed', {
        auctionId,
        selectedProposalId: comparison.recommendedProposal
      });

      return result;
    } catch (error) {
      logger.error('Failed to handle auto-selection', { error, auctionId });
      throw error;
    }
  }

  /**
   * Process auctions needing auto-selection (to be called by scheduled job)
   */
  async processAutoSelections(): Promise<void> {
    try {
      logger.info('Processing auctions needing auto-selection');

      // Find ended auctions without winners that have auto-selection configured
      const endedAuctions = await this.auctionRepository.findAuctions({
        status: 'ended',
        hasProposals: true,
      });

      const auctionsNeedingAutoSelection = endedAuctions.filter(auction =>
        !auction.winningProposalId &&
        auction.settings.autoSelectAfterHours &&
        auction.endedAt
      );

      for (const auction of auctionsNeedingAutoSelection) {
        try {
          await this.handleAutoSelection(auction.id);
        } catch (error) {
          logger.error('Failed to process auto-selection for auction', {
            error,
            auctionId: auction.id
          });
        }
      }

      logger.info('Auto-selection processing completed', {
        count: auctionsNeedingAutoSelection.length
      });
    } catch (error) {
      logger.error('Failed to process auto-selections', { error });
      throw error;
    }
  }

  /**
   * Check if auction mode is available for a booking
   */
  async checkAuctionAvailability(bookingId: string): Promise<{
    available: boolean;
    reason?: string;
    isLastMinute: boolean;
    eventDate: Date;
    minimumAuctionEndDate?: Date;
  }> {
    try {
      const booking = await this.bookingService.getBookingById(bookingId);
      if (!booking) {
        return {
          available: false,
          reason: 'Booking not found',
          isLastMinute: false,
          eventDate: new Date(),
        };
      }

      const eventDate = booking.dateRange.checkIn;
      const now = new Date();
      const timeToEvent = eventDate.getTime() - now.getTime();
      const isLastMinute = timeToEvent < this.ONE_WEEK_MS;

      if (isLastMinute) {
        return {
          available: false,
          reason: 'Auctions are not available for events less than one week away',
          isLastMinute: true,
          eventDate,
        };
      }

      const minimumAuctionEndDate = new Date(eventDate.getTime() - this.ONE_WEEK_MS);

      return {
        available: true,
        isLastMinute: false,
        eventDate,
        minimumAuctionEndDate,
      };
    } catch (error) {
      logger.error('Failed to check auction availability', { error, bookingId });
      return {
        available: false,
        reason: 'Error checking availability',
        isLastMinute: false,
        eventDate: new Date(),
      };
    }
  }

  /**
   * Convert auction to first-match mode when approaching deadline
   */
  async convertToFirstMatch(auctionId: string, reason: string): Promise<SwapAuction> {
    try {
      logger.info('Converting auction to first-match mode', { auctionId, reason });

      const auction = await this.auctionRepository.findById(auctionId);
      if (!auction) {
        throw new Error('Auction not found');
      }

      if (auction.status !== 'active') {
        throw new Error(`Cannot convert auction with status: ${auction.status}`);
      }

      // End the auction immediately
      const endResult = await this.endAuction(auctionId);

      // If there are proposals, auto-select the best one
      if (auction.proposals.length > 0) {
        const comparison = await this.compareProposals(auctionId);
        if (comparison.recommendedProposal) {
          await this.selectWinningProposal(
            auctionId,
            comparison.recommendedProposal,
            auction.ownerId
          );
        }
      }

      // Record conversion on blockchain
      const transactionData: TransactionData = {
        type: 'auction_converted_to_first_match',
        payload: {
          auctionId,
          reason,
          convertedAt: new Date(),
        },
        timestamp: new Date(),
      };

      await this.hederaService.submitTransaction(transactionData);

      // Send notification to owner
      await this.notificationService.sendAuctionConvertedNotification({
        auctionId,
        ownerId: auction.ownerId,
        reason,
        convertedAt: new Date(),
      });

      const updatedAuction = await this.auctionRepository.findById(auctionId);
      if (!updatedAuction) {
        throw new Error('Failed to retrieve updated auction');
      }

      logger.info('Auction converted to first-match successfully', { auctionId, reason });
      return updatedAuction;
    } catch (error) {
      logger.error('Failed to convert auction to first-match', { error, auctionId, reason });
      throw error;
    }
  }

  /**
   * Check for auctions approaching event deadline and convert them
   */
  async processApproachingDeadlines(): Promise<void> {
    try {
      logger.info('Processing auctions approaching event deadlines');

      const activeAuctions = await this.auctionRepository.findAuctions({ status: 'active' });
      const conversions: string[] = [];

      for (const auction of activeAuctions) {
        try {
          // Get the swap and booking to check event date
          const swap = await this.swapRepository.findById(auction.swapId);
          if (!swap) {
            logger.warn('Swap not found for auction', { auctionId: auction.id });
            continue;
          }

          const booking = await this.bookingService.getBookingById(swap.sourceBookingId);
          if (!booking) {
            logger.warn('Booking not found for auction', { auctionId: auction.id });
            continue;
          }

          const eventDate = booking.dateRange.checkIn;
          const now = new Date();
          const timeToEvent = eventDate.getTime() - now.getTime();

          // If event is less than one week away, convert to first-match
          if (timeToEvent < this.ONE_WEEK_MS) {
            await this.convertToFirstMatch(
              auction.id,
              'Event is less than one week away'
            );
            conversions.push(auction.id);
          }
          // If auction end date is too close to event, also convert
          else if (auction.settings.endDate.getTime() > (eventDate.getTime() - this.ONE_WEEK_MS)) {
            await this.convertToFirstMatch(
              auction.id,
              'Auction end date too close to event date'
            );
            conversions.push(auction.id);
          }
        } catch (error) {
          logger.error('Failed to process auction deadline', {
            error,
            auctionId: auction.id
          });
        }
      }

      logger.info('Approaching deadlines processing completed', {
        conversions: conversions.length,
        convertedAuctions: conversions,
      });
    } catch (error) {
      logger.error('Failed to process approaching deadlines', { error });
      throw error;
    }
  }

  /**
   * Validate auction end date against event date with detailed feedback
   */
  async validateAuctionEndDate(bookingId: string, proposedEndDate: Date): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    eventDate: Date;
    minimumEndDate: Date;
    maximumEndDate: Date;
    suggestedEndDate?: Date;
  }> {
    try {
      const booking = await this.bookingService.getBookingById(bookingId);
      if (!booking) {
        return {
          isValid: false,
          errors: ['Booking not found'],
          warnings: [],
          eventDate: new Date(),
          minimumEndDate: new Date(),
          maximumEndDate: new Date(),
        };
      }

      const eventDate = booking.dateRange.checkIn;
      const now = new Date();
      const oneWeekBeforeEvent = new Date(eventDate.getTime() - this.ONE_WEEK_MS);

      // Minimum end date is now + 1 hour (to allow some time for setup)
      const minimumEndDate = new Date(now.getTime() + 60 * 60 * 1000);

      // Maximum end date is one week before event
      const maximumEndDate = oneWeekBeforeEvent;

      const errors: string[] = [];
      const warnings: string[] = [];

      // Check if event is too soon for auctions
      if (eventDate.getTime() - now.getTime() < this.ONE_WEEK_MS) {
        errors.push('Auctions are not available for events less than one week away');
      }

      // Check if proposed end date is in the past
      if (proposedEndDate <= now) {
        errors.push('Auction end date must be in the future');
      }

      // Check if proposed end date is too soon
      if (proposedEndDate < minimumEndDate) {
        errors.push('Auction end date must be at least 1 hour from now');
      }

      // Check if proposed end date is too close to event
      if (proposedEndDate > maximumEndDate) {
        errors.push(`Auction must end at least one week before the event (by ${maximumEndDate.toISOString()})`);
      }

      // Warnings for suboptimal timing
      const threeDaysBeforeEvent = new Date(eventDate.getTime() - (3 * 24 * 60 * 60 * 1000));
      if (proposedEndDate > threeDaysBeforeEvent) {
        warnings.push('Consider ending the auction earlier to allow more time for booking transfer');
      }

      const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      if (proposedEndDate < oneDayFromNow) {
        warnings.push('Short auction duration may limit the number of proposals received');
      }

      // Suggest an optimal end date (3-5 days before event, but at least 2 days from now)
      let suggestedEndDate: Date | undefined;
      const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
      const fiveDaysBeforeEvent = new Date(eventDate.getTime() - (5 * 24 * 60 * 60 * 1000));

      if (fiveDaysBeforeEvent > twoDaysFromNow) {
        suggestedEndDate = fiveDaysBeforeEvent;
      } else if (threeDaysBeforeEvent > twoDaysFromNow) {
        suggestedEndDate = threeDaysBeforeEvent;
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        eventDate,
        minimumEndDate,
        maximumEndDate,
        suggestedEndDate,
      };
    } catch (error) {
      logger.error('Failed to validate auction end date', { error, bookingId });
      return {
        isValid: false,
        errors: ['Validation error occurred'],
        warnings: [],
        eventDate: new Date(),
        minimumEndDate: new Date(),
        maximumEndDate: new Date(),
      };
    }
  }

  /**
   * Get auction restrictions for a booking
   */
  async getAuctionRestrictions(bookingId: string): Promise<{
    canCreateAuction: boolean;
    restrictions: string[];
    recommendations: string[];
    eventDate: Date;
    timeToEvent: number; // milliseconds
    isLastMinute: boolean;
  }> {
    try {
      const booking = await this.bookingService.getBookingById(bookingId);
      if (!booking) {
        return {
          canCreateAuction: false,
          restrictions: ['Booking not found'],
          recommendations: [],
          eventDate: new Date(),
          timeToEvent: 0,
          isLastMinute: false,
        };
      }

      const eventDate = booking.dateRange.checkIn;
      const now = new Date();
      const timeToEvent = eventDate.getTime() - now.getTime();
      const isLastMinute = timeToEvent < this.ONE_WEEK_MS;

      const restrictions: string[] = [];
      const recommendations: string[] = [];

      if (isLastMinute) {
        restrictions.push('Auctions are not available for events less than one week away');
        recommendations.push('Use first-match acceptance for immediate responses');
      } else {
        if (timeToEvent < 2 * this.ONE_WEEK_MS) {
          recommendations.push('Consider shorter auction duration due to approaching event date');
        }

        if (booking.verification.status !== 'verified') {
          restrictions.push('Booking must be verified before creating auctions');
        }

        if (booking.status !== 'available') {
          restrictions.push('Booking must be available for swap');
        }

        recommendations.push('Set auction end date at least one week before your event');
        recommendations.push('Consider enabling both booking and cash proposals for more options');
        recommendations.push('Set a reasonable minimum cash amount if accepting cash offers');
      }

      return {
        canCreateAuction: restrictions.length === 0,
        restrictions,
        recommendations,
        eventDate,
        timeToEvent,
        isLastMinute,
      };
    } catch (error) {
      logger.error('Failed to get auction restrictions', { error, bookingId });
      return {
        canCreateAuction: false,
        restrictions: ['Error checking restrictions'],
        recommendations: [],
        eventDate: new Date(),
        timeToEvent: 0,
        isLastMinute: false,
      };
    }
  }

  /**
   * Handle auction timeout with automatic selection
   */
  async handleAuctionTimeout(auctionId: string): Promise<void> {
    try {
      logger.info('Handling auction timeout', { auctionId });

      const auction = await this.auctionRepository.findById(auctionId);
      if (!auction) {
        logger.warn('Auction not found for timeout handling', { auctionId });
        return;
      }

      if (auction.status !== 'ended') {
        logger.warn('Timeout handling called for non-ended auction', {
          auctionId,
          status: auction.status
        });
        return;
      }

      if (auction.winningProposalId) {
        logger.info('Auction already has winner, no timeout action needed', { auctionId });
        return;
      }

      // Check if auto-selection is configured
      if (!auction.settings.autoSelectAfterHours) {
        logger.info('Auto-selection not configured, sending reminder to owner', { auctionId });

        await this.notificationService.sendAuctionSelectionReminderNotification({
          auctionId,
          ownerId: auction.ownerId,
          proposalCount: auction.proposals.filter(p => p.status === 'pending').length,
        });
        return;
      }

      // Perform auto-selection
      await this.handleAutoSelection(auctionId);
    } catch (error) {
      logger.error('Failed to handle auction timeout', { error, auctionId });
      throw error;
    }
  }

  /**
   * Process expired auctions (to be called by a scheduled job)
   */
  async processExpiredAuctions(): Promise<void> {
    try {
      logger.info('Processing expired auctions');

      const expiredAuctions = await this.auctionRepository.findExpiredAuctions();

      for (const auction of expiredAuctions) {
        try {
          await this.endAuction(auction.id);
          logger.info('Expired auction processed', { auctionId: auction.id });
        } catch (error) {
          logger.error('Failed to process expired auction', { error, auctionId: auction.id });
        }
      }

      logger.info('Expired auctions processing completed', { count: expiredAuctions.length });
    } catch (error) {
      logger.error('Failed to process expired auctions', { error });
      throw error;
    }
  }
}