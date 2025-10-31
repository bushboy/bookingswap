import { Request, Response } from 'express';
import {
  SwapProposalService,
  CreateSwapProposalRequest,
  SwapResponseService,
  SwapResponseRequest
} from '../services/swap';
import { TargetingDisplayError, TargetingDisplayErrorCodes } from '../services/swap/SwapProposalService';
import { SwapTargetingService } from '../services/swap/SwapTargetingService';
import { SwapRepository } from '../database/repositories/SwapRepository';
import { SwapMatchingService } from '../services/swap/SwapMatchingService';
import { ProposalValidationService } from '../services/swap/ProposalValidationService';
import { AuctionManagementService } from '../services/auction';
import { PaymentProcessingService } from '../services/payment';
import {
  SwapOfferWorkflowService,
  SwapOfferRequest,
  SwapOfferResult,
  OfferMode
} from '../services/swap/SwapOfferWorkflowService';
import { SwapOfferError } from '../services/swap/SwapOfferErrorHandler';
import {
  ProposalErrorFactory,
  PROPOSAL_ERROR_CODES,
  ProposalRateLimiter,
  ProposalValidationError,
  ProposalBusinessError,
  ProposalRateLimitError,
  formatProposalErrorResponse,
  logProposalError,
  validateProposalRequest
} from '../utils/proposalErrorHandling';
import {
  SwapStatus,
  SwapWithBookingDetails,
  EnhancedCreateSwapRequest,
  CreateEnhancedProposalRequest,
  PaymentTypePreference,
  AcceptanceStrategy,
  AuctionSettings,
  CreateProposalFromBrowseRequest,
  EligibleSwapsResponse,
  SwapDetailsResponse,
  CompatibilityResponse,
  EnhancedSwapCardData,
  BalanceCalculator
} from '@booking-swap/shared';
import { logger } from '../utils/logger';
import { PerformanceMonitor } from '../services/monitoring/PerformanceMonitor';
import { validateAcceptanceStrategy } from '@/validation/enhanced-swap-validation';
import {
  handleSwapError,
  generateRequestId,
  SWAP_ERROR_CODES,
  isServiceError
} from '../utils/swap-error-handler';
import { HederaBalanceService } from '../services/hedera/HederaBalanceService';
import { RequestWithWalletValidation } from '../middleware/walletValidation';
import {
  WalletValidationErrorCodes,
  handleInvalidWalletAddressError,
  handleInsufficientBalanceError,
  handleBlockchainNetworkError,
  sendWalletValidationErrorResponse,
  logWalletValidationFailure,
  createWalletValidationAuditLog
} from '../utils/walletValidationErrorHandler';

export class SwapController {
  constructor(
    private swapProposalService: SwapProposalService,
    private swapResponseService: SwapResponseService,
    private swapMatchingService: SwapMatchingService,
    private swapTargetingService: SwapTargetingService,
    private swapRepository: SwapRepository,
    private auctionService: AuctionManagementService,
    private paymentService: PaymentProcessingService,
    private swapOfferWorkflowService: SwapOfferWorkflowService,
    private hederaBalanceService: HederaBalanceService,
    private balanceCalculator: BalanceCalculator,
    private performanceMonitor?: PerformanceMonitor
  ) { }

  /**
   * Create a new enhanced swap proposal with comprehensive error handling
   * Updated for simplified schema - relationships derived from booking connections
   * POST /api/swaps/enhanced
   */
  createEnhancedSwapProposal = async (req: Request, res: Response): Promise<void> => {
    const requestId = generateRequestId('create-enhanced-swap');

    try {
      const userId = req.user?.id;
      if (!userId) {
        handleSwapError(
          new Error('User authentication required'),
          res,
          {
            operation: 'createEnhancedSwapProposal',
            requestId,
            requestData: { hasBody: !!req.body }
          }
        );
        return;
      }

      // Enhanced validation for enhanced swap request
      const validationErrors = this.validateEnhancedSwapRequest(req.body);
      if (validationErrors.length > 0) {
        const validationError = new Error(`Enhanced swap validation failed: ${validationErrors.join(', ')}`);
        (validationError as any).code = SWAP_ERROR_CODES.SWAP_VALIDATION_FAILED;
        (validationError as any).validationErrors = validationErrors;

        handleSwapError(validationError, res, {
          operation: 'createEnhancedSwapProposal',
          userId,
          requestId,
          requestData: req.body
        });
        return;
      }

      logger.info('Creating enhanced swap proposal', {
        requestId,
        userId,
        sourceBookingId: req.body.sourceBookingId,
        paymentTypes: req.body.paymentTypes,
        acceptanceStrategy: req.body.acceptanceStrategy?.type
      });

      const result = await this.swapProposalService.createEnhancedSwapProposal(req.body);

      logger.info('Enhanced swap proposal created successfully', {
        requestId,
        userId,
        swapId: result.swap.id,
        auctionId: result.auction?.id,
        hasValidationWarnings: result.validationWarnings && result.validationWarnings.length > 0
      });

      res.status(201).json({
        success: true,
        data: {
          swap: {
            ...result.swap,
            // Include derived relationship metadata for simplified schema
            proposerId: userId, // Derived from authenticated user
            relationshipsSource: 'derived_from_bookings'
          },
          auction: result.auction,
          validationWarnings: result.validationWarnings,
        },
        metadata: {
          schemaVersion: 'simplified',
          relationshipsSource: 'derived_from_bookings',
          redundantFieldsRemoved: ['target_booking_id', 'proposer_id', 'owner_id']
        },
        requestId,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      handleSwapError(error, res, {
        operation: 'createEnhancedSwapProposal',
        userId: req.user?.id,
        requestId,
        requestData: req.body
      });
    }
  };

  /**
   * Create a new swap listing (general swap availability)
   * POST /api/swaps/listings
   */
  createSwapListing = async (req: Request, res: Response): Promise<void> => {
    const requestId = generateRequestId('create-swap-listing');

    try {
      const userId = req.user?.id;
      if (!userId) {
        handleSwapError(
          new Error('User authentication required'),
          res,
          {
            operation: 'createSwapListing',
            requestId,
            requestData: { hasBody: !!req.body }
          }
        );
        return;
      }

      const {
        sourceBookingId,
        title,
        description,
        swapPreferences,
        expirationDate,
        autoAccept,
      } = req.body;

      // Enhanced validation
      const validationErrors = this.validateSwapListingRequest(req.body);
      if (validationErrors.length > 0) {
        const validationError = new Error(`Swap listing validation failed: ${validationErrors.join(', ')}`);
        (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
        (validationError as any).validationErrors = validationErrors;

        handleSwapError(validationError, res, {
          operation: 'createSwapListing',
          userId,
          requestId,
          requestData: req.body
        });
        return;
      }

      const expiresAt = new Date(expirationDate);

      // Create the swap listing
      const swapListing = {
        id: `swap_${Date.now()}`, // Temporary ID generation
        userId,
        sourceBookingId,
        title,
        description,
        swapPreferences: swapPreferences || {},
        expirationDate: expiresAt,
        autoAccept: autoAccept || false,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      logger.info('Swap listing created successfully', {
        requestId,
        userId,
        swapId: swapListing.id,
        sourceBookingId
      });

      res.status(201).json({
        success: true,
        data: {
          swap: swapListing,
        },
        requestId,
        timestamp: new Date().toISOString(),
      });

    } catch (error: any) {
      handleSwapError(error, res, {
        operation: 'createSwapListing',
        userId: req.user?.id,
        requestId,
        requestData: req.body
      });
    }
  };

  /**
   * Get compatibility analysis between two swaps
   * GET /api/swaps/:sourceSwapId/compatibility/:targetSwapId
   */
  getSwapCompatibility = async (req: Request, res: Response): Promise<void> => {
    const requestId = generateRequestId('get-swap-compatibility');

    try {
      const userId = req.user?.id;
      if (!userId) {
        handleSwapError(
          new Error('User authentication required'),
          res,
          {
            operation: 'getSwapCompatibility',
            requestId,
            requestData: { params: req.params }
          }
        );
        return;
      }

      const { sourceSwapId, targetSwapId } = req.params;

      // Ensure parameters exist
      if (!sourceSwapId || !targetSwapId) {
        const validationError = new Error('Missing required parameters: sourceSwapId and targetSwapId');
        (validationError as any).code = SWAP_ERROR_CODES.MISSING_REQUIRED_FIELDS;
        handleSwapError(validationError, res, {
          operation: 'getSwapCompatibility',
          userId,
          requestId,
          requestData: { sourceSwapId, targetSwapId }
        });
        return;
      }

      // Validate UUID format for both swap IDs
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      if (!uuidRegex.test(sourceSwapId)) {
        const validationError = new Error('Invalid sourceSwapId format');
        (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
        handleSwapError(validationError, res, {
          operation: 'getSwapCompatibility',
          userId,
          requestId,
          requestData: { sourceSwapId, targetSwapId }
        });
        return;
      }

      if (!uuidRegex.test(targetSwapId)) {
        const validationError = new Error('Invalid targetSwapId format');
        (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
        handleSwapError(validationError, res, {
          operation: 'getSwapCompatibility',
          userId,
          requestId,
          requestData: { sourceSwapId, targetSwapId }
        });
        return;
      }

      // Ensure sourceSwapId !== targetSwapId to prevent same-swap analysis
      if (sourceSwapId === targetSwapId) {
        const validationError = new Error('Cannot analyze compatibility between the same swap');
        (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
        handleSwapError(validationError, res, {
          operation: 'getSwapCompatibility',
          userId,
          requestId,
          requestData: { sourceSwapId, targetSwapId }
        });
        return;
      }

      // Check if both swaps exist and user has permission to view them
      const sourceSwap = await this.swapProposalService.getSwapProposalById(sourceSwapId);
      if (!sourceSwap) {
        const notFoundError = new Error('Source swap not found');
        (notFoundError as any).code = SWAP_ERROR_CODES.BOOKING_NOT_FOUND;
        handleSwapError(notFoundError, res, {
          operation: 'getSwapCompatibility',
          userId,
          requestId,
          requestData: { sourceSwapId, targetSwapId }
        });
        return;
      }

      const targetSwap = await this.swapProposalService.getSwapProposalById(targetSwapId);
      if (!targetSwap) {
        const notFoundError = new Error('Target swap not found');
        (notFoundError as any).code = SWAP_ERROR_CODES.BOOKING_NOT_FOUND;
        handleSwapError(notFoundError, res, {
          operation: 'getSwapCompatibility',
          userId,
          requestId,
          requestData: { sourceSwapId, targetSwapId }
        });
        return;
      }

      // Check user has permission to view both swaps (owns source swap or both are public)
      // User must own the source swap
      const canAccessSourceSwap = sourceSwap.ownerId === userId || sourceSwap.proposerId === userId;
      if (!canAccessSourceSwap) {
        const forbiddenError = new Error('Access denied to source swap');
        (forbiddenError as any).code = SWAP_ERROR_CODES.BOOKING_ACCESS_DENIED;
        handleSwapError(forbiddenError, res, {
          operation: 'getSwapCompatibility',
          userId,
          requestId,
          requestData: { sourceSwapId, targetSwapId }
        });
        return;
      }

      // For target swap, user needs access (owns it, proposed to it, or it's publicly available)
      // Allow access if user owns it, proposed to it, or if the swap is pending (publicly available for proposals)
      const canAccessTargetSwap = targetSwap.ownerId === userId ||
        targetSwap.proposerId === userId ||
        targetSwap.status === 'pending';

      if (!canAccessTargetSwap) {
        const forbiddenError = new Error('Access denied to target swap');
        (forbiddenError as any).code = SWAP_ERROR_CODES.BOOKING_ACCESS_DENIED;
        handleSwapError(forbiddenError, res, {
          operation: 'getSwapCompatibility',
          userId,
          requestId,
          requestData: { sourceSwapId, targetSwapId }
        });
        return;
      }

      logger.info('Getting swap compatibility analysis', {
        requestId,
        userId,
        sourceSwapId,
        targetSwapId
      });

      // Call SwapMatchingService.getSwapCompatibility() method
      const compatibilityResponse = await this.swapMatchingService.getSwapCompatibility(sourceSwapId, targetSwapId);

      // Validate the response format
      if (!compatibilityResponse || !compatibilityResponse.compatibility) {
        const serviceError = new Error('Invalid compatibility analysis response from service');
        (serviceError as any).code = SWAP_ERROR_CODES.SERVICE_INTEGRATION_FAILED;
        handleSwapError(serviceError, res, {
          operation: 'getSwapCompatibility',
          userId,
          requestId,
          requestData: { sourceSwapId, targetSwapId }
        });
        return;
      }

      logger.info('Swap compatibility analysis completed successfully', {
        requestId,
        userId,
        sourceSwapId,
        targetSwapId,
        overallScore: compatibilityResponse.compatibility.overallScore,
        recommendation: compatibilityResponse.recommendation
      });

      // Return CompatibilityResponse in expected format
      res.status(200).json({
        success: true,
        data: compatibilityResponse,
        requestId,
        timestamp: new Date().toISOString(),
      });

    } catch (error: any) {
      handleSwapError(error, res, {
        operation: 'getSwapCompatibility',
        userId: req.user?.id,
        requestId,
        requestData: req.params
      });
    }
  };

  /**
   * Validates enhanced swap request data
   */
  private validateEnhancedSwapRequest(body: any): string[] {
    const errors: string[] = [];

    if (!body.sourceBookingId) {
      errors.push('sourceBookingId is required');
    } else if (typeof body.sourceBookingId !== 'string') {
      errors.push('sourceBookingId must be a string');
    }

    if (!body.paymentTypes || !Array.isArray(body.paymentTypes) || body.paymentTypes.length === 0) {
      errors.push('paymentTypes array is required and must not be empty');
    } else {
      const validPaymentTypes = ['booking', 'cash'];
      for (const paymentType of body.paymentTypes) {
        if (!validPaymentTypes.includes(paymentType)) {
          errors.push(`Invalid payment type: ${paymentType}. Must be one of: ${validPaymentTypes.join(', ')}`);
        }
      }
    }

    if (!body.acceptanceStrategy) {
      errors.push('acceptanceStrategy is required');
    } else {
      if (!body.acceptanceStrategy.type) {
        errors.push('acceptanceStrategy.type is required');
      } else if (!['first_match', 'auction'].includes(body.acceptanceStrategy.type)) {
        errors.push('acceptanceStrategy.type must be either "first_match" or "auction"');
      }

      if (body.acceptanceStrategy.type === 'auction' && !body.auctionSettings) {
        errors.push('auctionSettings is required when acceptanceStrategy.type is "auction"');
      }
    }

    if (body.expirationDate) {
      const expiresAt = new Date(body.expirationDate);
      if (isNaN(expiresAt.getTime())) {
        errors.push('expirationDate must be a valid date');
      } else if (expiresAt <= new Date()) {
        errors.push('expirationDate must be in the future');
      }
    }

    return errors;
  }

  /**
   * Validates swap listing request data
   */
  private validateSwapListingRequest(body: any): string[] {
    const errors: string[] = [];

    if (!body.sourceBookingId) {
      errors.push('sourceBookingId is required');
    } else if (typeof body.sourceBookingId !== 'string') {
      errors.push('sourceBookingId must be a string');
    }

    if (!body.title) {
      errors.push('title is required');
    } else if (typeof body.title !== 'string') {
      errors.push('title must be a string');
    } else if (body.title.length < 3) {
      errors.push('title must be at least 3 characters long');
    }

    if (!body.description) {
      errors.push('description is required');
    } else if (typeof body.description !== 'string') {
      errors.push('description must be a string');
    } else if (body.description.length < 10) {
      errors.push('description must be at least 10 characters long');
    }

    if (!body.expirationDate) {
      errors.push('expirationDate is required');
    } else {
      const expiresAt = new Date(body.expirationDate);
      if (isNaN(expiresAt.getTime())) {
        errors.push('expirationDate must be a valid date');
      } else if (expiresAt <= new Date()) {
        errors.push('expirationDate must be in the future');
      }
    }

    return errors;
  }

  /**
   * Create a new swap proposal
   * Updated for simplified schema - proposer derived from booking relationship
   * POST /api/swaps
   */
  createSwapProposal = async (req: Request, res: Response): Promise<void> => {
    const requestId = generateRequestId('create-swap-proposal');

    try {
      const userId = req.user?.id;
      if (!userId) {
        handleSwapError(
          new Error('User authentication required'),
          res,
          {
            operation: 'createSwapProposal',
            requestId,
            requestData: { hasBody: !!req.body }
          }
        );
        return;
      }

      const {
        sourceBookingId,
        targetBookingId,
        terms,
      } = req.body;

      // Enhanced validation with specific error messages
      const validationErrors = this.validateSwapProposalRequest(req.body);
      if (validationErrors.length > 0) {
        const validationError = new Error(`Validation failed: ${validationErrors.join(', ')}`);
        (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
        (validationError as any).validationErrors = validationErrors;

        handleSwapError(validationError, res, {
          operation: 'createSwapProposal',
          userId,
          requestId,
          requestData: req.body
        });
        return;
      }

      const expiresAt = new Date(terms.expiresAt);
      const createRequest: CreateSwapProposalRequest = {
        sourceBookingId,
        targetBookingId,
        proposerId: userId, // This will be derived from booking relationship in service layer
        terms: {
          additionalPayment: terms.additionalPayment || 0,
          conditions: terms.conditions || [],
          expiresAt,
        },
      };

      logger.info('Creating swap proposal', {
        requestId,
        userId,
        sourceBookingId,
        targetBookingId,
        hasTerms: !!terms
      });

      const result = await this.swapProposalService.createSwapProposal(createRequest);

      logger.info('Swap proposal created successfully', {
        requestId,
        userId,
        swapId: result.swap.id,
        transactionId: result.blockchainTransaction.transactionId
      });

      res.status(201).json({
        success: true,
        data: {
          swap: {
            ...result.swap,
            // Include derived relationship metadata for simplified schema
            proposerId: userId, // Derived from authenticated user
            relationshipsSource: 'derived_from_bookings'
          },
          blockchain: result.blockchainTransaction,
        },
        metadata: {
          schemaVersion: 'simplified',
          relationshipsSource: 'derived_from_bookings',
          redundantFieldsRemoved: ['target_booking_id', 'proposer_id', 'owner_id']
        },
        requestId,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      handleSwapError(error, res, {
        operation: 'createSwapProposal',
        userId: req.user?.id,
        requestId,
        requestData: req.body
      });
    }
  };

  /**
   * Validates swap proposal request data
   */
  private validateSwapProposalRequest(body: any): string[] {
    const errors: string[] = [];

    if (!body.sourceBookingId) {
      errors.push('sourceBookingId is required');
    } else if (typeof body.sourceBookingId !== 'string') {
      errors.push('sourceBookingId must be a string');
    }

    if (!body.targetBookingId) {
      errors.push('targetBookingId is required');
    } else if (typeof body.targetBookingId !== 'string') {
      errors.push('targetBookingId must be a string');
    }

    if (!body.terms) {
      errors.push('terms object is required');
    } else {
      if (!body.terms.expiresAt) {
        errors.push('terms.expiresAt is required');
      } else {
        const expiresAt = new Date(body.terms.expiresAt);
        if (isNaN(expiresAt.getTime())) {
          errors.push('terms.expiresAt must be a valid date');
        } else if (expiresAt <= new Date()) {
          errors.push('terms.expiresAt must be in the future');
        }
      }

      if (body.terms.additionalPayment !== undefined &&
        (typeof body.terms.additionalPayment !== 'number' || body.terms.additionalPayment < 0)) {
        errors.push('terms.additionalPayment must be a non-negative number');
      }

      if (body.terms.conditions !== undefined && !Array.isArray(body.terms.conditions)) {
        errors.push('terms.conditions must be an array');
      }
    }

    return errors;
  }

  /**
   * Get swap cards for the authenticated user with proposals from others
   * Updated for simplified schema - derives proposer and target information from booking relationships
   * GET /api/swaps/cards
   */
  getUserSwapCards = async (req: Request, res: Response): Promise<void> => {
    const requestId = `swap-cards-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const startTime = Date.now();

    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required',
            category: 'authentication',
          },
        });
        return;
      }

      const {
        limit = '100',
        offset = '0'
      } = req.query;

      const parsedLimit = Math.min(parseInt(limit as string) || 100, 100);
      const parsedOffset = parseInt(offset as string) || 0;

      // Get user swaps with proposals from others using simplified schema
      // This now derives proposer and target information from booking relationships
      const swapCardData = await this.swapProposalService.getUserSwapsWithProposals(userId, parsedLimit, parsedOffset);

      // Performance monitoring
      const executionTime = Date.now() - startTime;

      // Calculate comprehensive response metadata
      const totalProposals = swapCardData.reduce((sum, card) => sum + card.proposalCount, 0);
      const swapsWithProposals = swapCardData.filter(card => card.proposalCount > 0).length;
      const swapsWithoutProposals = swapCardData.filter(card => card.proposalCount === 0).length;

      // Structure the response with derived relationship information
      const structuredResponse = {
        success: true,
        data: {
          swapCards: swapCardData.map(card => ({
            // User's swap (left side of card) - now includes derived proposer info
            userSwap: {
              id: card.userSwap.id,
              bookingDetails: card.userSwap.bookingDetails,
              status: card.userSwap.status,
              createdAt: card.userSwap.createdAt,
              expiresAt: card.userSwap.expiresAt,
              // Derived proposer information from booking relationship
              proposerId: userId, // Always the current user for their own swaps
              proposerName: req.user?.displayName || req.user?.email || 'Unknown'
            },
            // Proposals from other users (right side of card) - includes derived target info
            proposalsFromOthers: card.proposalsFromOthers.map(proposal => ({
              id: proposal.id,
              proposerId: proposal.proposerId,
              proposerName: proposal.proposerName,
              targetBookingDetails: proposal.targetBookingDetails,
              status: proposal.status,
              createdAt: proposal.createdAt,
              terms: proposal.terms,
              // Additional derived relationship metadata
              relationshipType: 'incoming_proposal'
            })),
            // Proposal count for easy access
            proposalCount: card.proposalCount,
            // Enhanced metadata for simplified schema
            cardMetadata: {
              hasProposals: card.proposalCount > 0,
              proposalStatus: card.proposalCount === 0 ? 'no_proposals' :
                card.proposalCount === 1 ? 'single_proposal' : 'multiple_proposals',
              schemaVersion: 'simplified',
              relationshipsSource: 'derived_from_bookings'
            }
          }))
        },
        // Enhanced metadata with simplified schema information
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          performance: {
            executionTime,
            meetsTarget: executionTime <= 2000,
            category: executionTime <= 500 ? 'excellent' :
              executionTime <= 1000 ? 'good' :
                executionTime <= 2000 ? 'acceptable' : 'poor'
          },
          dataQuality: {
            totalSwaps: swapCardData.length,
            totalProposals,
            swapsWithProposals,
            swapsWithoutProposals,
            selfProposalsFiltered: true,
            dataStructure: 'swap_cards',
            dataIntegrity: 'verified',
            schemaVersion: 'simplified',
            relationshipsSource: 'derived_from_bookings'
          },
          pagination: {
            limit: parsedLimit,
            offset: parsedOffset,
            total: swapCardData.length,
            hasMore: swapCardData.length === parsedLimit,
            nextOffset: swapCardData.length === parsedLimit ? parsedOffset + parsedLimit : null
          },
          // Summary statistics for frontend consumption
          summary: {
            activeSwaps: swapCardData.filter(card => card.userSwap.status === 'pending').length,
            pendingSwaps: swapCardData.filter(card => card.userSwap.status === 'pending').length,
            completedSwaps: swapCardData.filter(card => card.userSwap.status === 'completed').length,
            averageProposalsPerSwap: swapCardData.length > 0 ?
              Math.round((totalProposals / swapCardData.length) * 100) / 100 : 0
          }
        }
      };

      // Log successful response with simplified schema context
      logger.info('Successfully retrieved swap cards with derived relationships', {
        requestId,
        userId,
        executionTime,
        totalSwaps: swapCardData.length,
        totalProposals,
        swapsWithProposals,
        swapsWithoutProposals,
        schemaVersion: 'simplified',
        relationshipsSource: 'derived_from_bookings'
      });

      res.json(structuredResponse);

    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      // Enhanced error handling for simplified schema issues
      let enhancedError = isServiceError(error) ? error : {
        ...error,
        code: 'SWAP_CARDS_RETRIEVAL_FAILED',
        category: 'system',
        recoverable: true,
        userMessage: 'Unable to retrieve your swap cards. Please try again.',
        technicalDetails: {
          executionTime,
          endpoint: '/api/swaps/cards',
          errorType: error.constructor.name,
          query: req.query,
          schemaVersion: 'simplified'
        }
      };

      // Handle specific simplified schema errors
      if (error.message?.includes('missing derived') || error.message?.includes('booking relationship')) {
        enhancedError = {
          ...enhancedError,
          code: 'SCHEMA_MIGRATION_INCOMPLETE',
          userMessage: 'Data migration in progress. Please try again in a moment.',
          technicalDetails: {
            ...enhancedError.technicalDetails,
            migrationStatus: 'incomplete',
            missingRelationships: true
          }
        };
      }

      logger.error('Failed to get user swap cards with simplified schema', {
        error: enhancedError.message,
        code: enhancedError.code,
        category: enhancedError.category,
        recoverable: enhancedError.recoverable,
        errorStack: error.stack,
        userId: req.user?.id,
        requestId,
        executionTime,
        errorType: error.constructor.name,
        query: req.query,
        schemaVersion: 'simplified',
        technicalDetails: enhancedError.technicalDetails
      });

      // Use the enhanced error handler for consistent error responses
      handleSwapError(enhancedError, res, {
        operation: 'getUserSwapCards',
        userId: req.user?.id,
        requestId,
        requestData: req.query
      });
    }
  };

  /**
   * Get swap cards for the authenticated user with proposals from others (legacy endpoint)
   * GET /api/swaps
   */
  getUserSwaps = async (req: Request, res: Response): Promise<void> => {
    // TEMPORARY DEBUG LOGGING FOR 401 ISSUE
    const requestId = `swaps-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const authHeader = req.headers.authorization;

    logger.info('getUserSwaps called - DEBUG INFO', {
      requestId,
      hasAuthHeader: !!authHeader,
      authHeaderFormat: authHeader ? (authHeader.startsWith('Bearer ') ? 'Bearer' : 'Invalid') : 'None',
      authHeaderLength: authHeader ? authHeader.length : 0,
      hasUser: !!req.user,
      hasTokenPayload: !!req.tokenPayload,
      userId: req.user?.id,
      userEmail: req.user?.email,
      tokenUserId: req.tokenPayload?.userId,
      tokenExp: req.tokenPayload?.exp ? new Date(req.tokenPayload.exp * 1000).toISOString() : undefined,
      endpoint: req.path,
      method: req.method,
      ip: req.ip,
    });

    // Performance monitoring - start timer
    const startTime = Date.now();

    try {
      const userId = req.user?.id;
      if (!userId) {
        logger.warn('getUserSwaps - 401 UNAUTHORIZED', {
          requestId,
          reason: 'req.user?.id is falsy',
          reqUser: req.user,
          reqTokenPayload: req.tokenPayload,
          authHeader: authHeader ? `${authHeader.substring(0, 20)}...` : 'none',
        });

        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required',
            category: 'authentication',
          },
        });
        return;
      }

      logger.info('getUserSwaps - Authentication successful', {
        requestId,
        userId,
        userEmail: req.user?.email,
      });

      const {
        status,
        limit = '100',
        offset = '0'
      } = req.query;

      const parsedLimit = Math.min(parseInt(limit as string) || 100, 100);
      const parsedOffset = parseInt(offset as string) || 0;

      // Get user swaps with proposals and targeting data (enhanced method)
      // This replaces getUserSwapsWithProposals to include targeting information
      let swapCardData = await this.swapProposalService.getUserSwapsWithTargeting(userId, parsedLimit, parsedOffset);

      // Apply status filter if provided (client-side filtering for now)
      if (status) {
        swapCardData = swapCardData.filter(card => card.userSwap.status === status);
      }

      // Performance monitoring - log execution time and detailed metrics
      const executionTime = Date.now() - startTime;
      const performanceMetrics = {
        requestId,
        userId,
        executionTime,
        swapCount: swapCardData.length,
        limit: parsedLimit,
        offset: parsedOffset,
        meetsPerformanceTarget: executionTime <= 2000,
        performanceCategory: executionTime <= 500 ? 'excellent' :
          executionTime <= 1000 ? 'good' :
            executionTime <= 2000 ? 'acceptable' : 'poor',
        endpoint: 'getUserSwaps',
        queryType: 'swap_cards_with_proposals',
        timestamp: new Date().toISOString()
      };

      // Enhanced performance monitoring with targeting-specific metrics
      if (this.performanceMonitor) {
        // Add timing metrics for targeting data queries
        this.performanceMonitor.recordMetric('api_response_time', executionTime, 'ms', {
          endpoint: 'getUserSwaps',
          userId,
          requestId,
          queryType: 'swap_cards_with_targeting',
          resultCount: swapCardData.length,
          limit: parsedLimit,
          offset: parsedOffset,
          hasTargetingData: true
        });

        // Monitor targeting data payload sizes and response times
        const totalIncomingTargets = swapCardData.reduce((sum, card) =>
          sum + (card.targeting?.incomingTargetCount || 0), 0);
        const totalOutgoingTargets = swapCardData.filter(card =>
          card.targeting?.outgoingTarget).length;
        const payloadSize = JSON.stringify(swapCardData).length;

        this.performanceMonitor.recordMetric('targeting_payload_size', payloadSize, 'bytes', {
          endpoint: 'getUserSwaps',
          userId,
          requestId,
          totalSwaps: swapCardData.length,
          totalIncomingTargets,
          totalOutgoingTargets
        });

        // Track targeting data availability and error rates
        const swapsWithTargetingData = swapCardData.filter(card =>
          card.targeting && (card.targeting.incomingTargetCount > 0 || card.targeting.outgoingTarget)).length;
        const targetingDataAvailabilityRate = swapCardData.length > 0 ?
          (swapsWithTargetingData / swapCardData.length) * 100 : 100;

        this.performanceMonitor.recordMetric('targeting_data_availability_rate', targetingDataAvailabilityRate, 'percentage', {
          endpoint: 'getUserSwaps',
          userId,
          requestId,
          totalSwaps: swapCardData.length,
          swapsWithTargetingData,
          totalIncomingTargets,
          totalOutgoingTargets
        });

        // Record API success rate
        this.performanceMonitor.recordMetric('api_success_rate', 100, 'percentage', {
          endpoint: 'getUserSwaps',
          userId,
          requestId,
          status: 'success',
          targetingDataIncluded: true
        });

        // Record proposal filtering success rate (enhanced with targeting context)
        const totalProposals = swapCardData.reduce((sum, card) => sum + card.proposalCount, 0);
        this.performanceMonitor.recordMetric('proposal_filtering_success_rate', 100, 'percentage', {
          endpoint: 'getUserSwaps',
          userId,
          requestId,
          totalSwaps: swapCardData.length,
          totalProposals,
          swapsWithProposals: swapCardData.filter(card => card.proposalCount > 0).length,
          totalIncomingTargets,
          totalOutgoingTargets
        });

        // Create alerts for targeting performance degradation
        if (executionTime > 2000) {
          this.performanceMonitor.recordMetric('targeting_performance_alert', 1, 'count', {
            endpoint: 'getUserSwaps',
            userId,
            requestId,
            alertType: 'response_time_exceeded',
            executionTime,
            threshold: 2000,
            severity: 'warning'
          });
        }

        if (targetingDataAvailabilityRate < 95) {
          this.performanceMonitor.recordMetric('targeting_performance_alert', 1, 'count', {
            endpoint: 'getUserSwaps',
            userId,
            requestId,
            alertType: 'data_availability_low',
            availabilityRate: targetingDataAvailabilityRate,
            threshold: 95,
            severity: 'warning'
          });
        }

        if (payloadSize > 1024 * 1024) { // 1MB threshold
          this.performanceMonitor.recordMetric('targeting_performance_alert', 1, 'count', {
            endpoint: 'getUserSwaps',
            userId,
            requestId,
            alertType: 'payload_size_large',
            payloadSize,
            threshold: 1024 * 1024,
            severity: 'info'
          });
        }
      }

      // Log performance metrics with appropriate level
      if (executionTime > 2000) {
        logger.warn('API response time exceeds 2-second target', performanceMetrics);
      } else if (executionTime > 1000) {
        logger.info('API response time approaching target threshold', performanceMetrics);
      } else {
        logger.debug('API performance within acceptable range', performanceMetrics);
      }

      // Calculate response metadata including proposal counts
      const totalProposals = swapCardData.reduce((sum, card) => sum + card.proposalCount, 0);
      const swapsWithProposals = swapCardData.filter(card => card.proposalCount > 0).length;
      const swapsWithoutProposals = swapCardData.filter(card => card.proposalCount === 0).length;

      // Enhanced response metadata for swap card data
      const responseMetadata = {
        performance: {
          executionTime,
          meetsTarget: executionTime <= 2000,
          category: performanceMetrics.performanceCategory
        },
        dataQuality: {
          totalSwaps: swapCardData.length,
          totalProposals,
          swapsWithProposals,
          swapsWithoutProposals,
          selfProposalsFiltered: true, // Indicates self-proposals have been filtered out
          dataStructure: 'swap_cards' // Indicates this is structured swap card data
        },
        pagination: {
          limit: parsedLimit,
          offset: parsedOffset,
          total: swapCardData.length,
          hasMore: swapCardData.length === parsedLimit // Indicates if there might be more data
        }
      };

      // Enhanced response with targeting data and derived relationships for simplified schema
      const enhancedResponse = {
        success: true,
        data: {
          swapCards: swapCardData.map(card => ({
            // Enhanced swap card structure with derived relationships
            userSwap: {
              ...card.userSwap,
              // Derived proposer information from booking relationship
              proposerId: userId, // Always the current user for their own swaps
              proposerName: req.user?.displayName || req.user?.email || 'Unknown'
            },
            proposalsFromOthers: card.proposalsFromOthers.map(proposal => ({
              ...proposal,
              // Enhanced proposal metadata for simplified schema
              relationshipType: 'incoming_proposal',
              derivedFromBooking: true
            })),
            proposalCount: card.proposalCount,

            // Enhanced targeting information with derived relationships
            targeting: card.targeting ? {
              incomingTargets: card.targeting.incomingTargets,
              incomingTargetCount: card.targeting.incomingTargetCount,
              outgoingTarget: card.targeting.outgoingTarget,
              canReceiveTargets: card.targeting.canReceiveTargets,
              canTarget: card.targeting.canTarget,
              targetingRestrictions: card.targeting.targetingRestrictions,
              // Additional metadata for simplified schema
              relationshipsSource: 'derived_from_bookings'
            } : undefined,

            // Enhanced metadata for simplified schema
            cardMetadata: {
              schemaVersion: 'simplified',
              relationshipsSource: 'derived_from_bookings',
              hasProposals: card.proposalCount > 0,
              hasTargeting: !!card.targeting
            }
          })).filter(card => card.targeting !== undefined ? card : { ...card, targeting: undefined }),
          pagination: {
            limit: parsedLimit,
            offset: parsedOffset,
            total: swapCardData.length,
          },
        },
        metadata: {
          ...responseMetadata,
          targeting: {
            dataIncluded: true,
            totalIncomingTargets: swapCardData.reduce((sum, card) =>
              sum + (card.targeting?.incomingTargetCount || 0), 0),
            totalOutgoingTargets: swapCardData.filter(card =>
              card.targeting?.outgoingTarget).length,
            swapsWithIncomingTargets: swapCardData.filter(card =>
              (card.targeting?.incomingTargetCount || 0) > 0).length,
            swapsWithOutgoingTargets: swapCardData.filter(card =>
              card.targeting?.outgoingTarget).length,
            relationshipsSource: 'derived_from_bookings'
          },
          // Enhanced schema information
          schema: {
            version: 'simplified',
            relationshipsSource: 'derived_from_bookings',
            redundantFieldsRemoved: ['target_booking_id', 'proposer_id', 'owner_id']
          }
        },
      };

      res.json(enhancedResponse);
    } catch (error: any) {
      // Performance monitoring - log error execution time
      const executionTime = Date.now() - startTime;

      // Enhanced error metrics with targeting-specific monitoring
      if (this.performanceMonitor) {
        this.performanceMonitor.recordMetric('api_response_time', executionTime, 'ms', {
          endpoint: 'getUserSwaps',
          userId: req.user?.id,
          requestId,
          status: 'error',
          errorType: error.constructor.name,
          isTargetingError: error instanceof TargetingDisplayError,
          targetingErrorCode: error instanceof TargetingDisplayError ? error.code : undefined
        });

        this.performanceMonitor.recordMetric('api_error_rate', 100, 'percentage', {
          endpoint: 'getUserSwaps',
          userId: req.user?.id,
          requestId,
          errorType: error.constructor.name,
          errorMessage: error.message,
          isTargetingError: error instanceof TargetingDisplayError
        });

        // Track targeting-specific error rates
        if (error instanceof TargetingDisplayError) {
          this.performanceMonitor.recordMetric('targeting_error_rate', 100, 'percentage', {
            endpoint: 'getUserSwaps',
            userId: req.user?.id,
            requestId,
            targetingErrorCode: error.code,
            targetingErrorMessage: error.message,
            errorDetails: error.details
          });

          // Create alerts for targeting performance degradation
          this.performanceMonitor.recordMetric('targeting_performance_alert', 1, 'count', {
            endpoint: 'getUserSwaps',
            userId: req.user?.id,
            requestId,
            alertType: 'targeting_error_occurred',
            targetingErrorCode: error.code,
            severity: error.code === TargetingDisplayErrorCodes.TARGETING_DATA_UNAVAILABLE ? 'warning' : 'error'
          });
        }
      }

      // Enhanced error handling with targeting-specific error support
      logger.error('Failed to get user swap cards with targeting data', {
        error: error.message,
        errorStack: error.stack,
        userId: req.user?.id,
        requestId,
        executionTime,
        errorType: error.constructor.name,
        isTargetingError: error instanceof TargetingDisplayError,
        targetingErrorCode: error instanceof TargetingDisplayError ? error.code : undefined,
        query: req.query,
      });

      // Handle TargetingDisplayError exceptions with appropriate HTTP responses
      if (error instanceof TargetingDisplayError) {
        return this.handleTargetingDisplayError(error, req, res, {
          requestId,
          executionTime,
          userId: req.user?.id
        });
      }

      // Handle specific error types with appropriate responses
      let statusCode = 500;
      let errorCode = 'SWAP_CARDS_RETRIEVAL_FAILED';
      let errorMessage = error.message;

      // Handle database connection errors
      if (error.message.includes('connection') || error.message.includes('timeout')) {
        statusCode = 503;
        errorCode = 'DATABASE_UNAVAILABLE';
        errorMessage = 'Database service temporarily unavailable. Please try again later.';
      }
      // Handle proposal filtering errors (data inconsistency)
      else if (error.message.includes('self-proposal') || error.message.includes('proposal filtering')) {
        statusCode = 200; // Return partial data with warnings
        logger.warn('Proposal filtering encountered issues', {
          userId: req.user?.id,
          requestId,
          error: error.message,
        });

        // Return empty data with metadata about filtering issues
        res.json({
          success: true,
          data: {
            swapCards: [], // Empty array as fallback
            pagination: {
              limit: Math.min(parseInt(req.query.limit as string) || 100, 100),
              offset: parseInt(req.query.offset as string) || 0,
              total: 0,
            },
          },
          warnings: [{
            code: 'PROPOSAL_FILTERING_ISSUE',
            message: 'Some proposal data could not be properly filtered. Displaying available information.',
            category: 'data_consistency',
          }],
          metadata: {
            dataCompleteness: 'partial',
            proposalFilteringIssues: true,
            selfProposalsFiltered: false, // Indicates filtering may have failed
          },
        });
        return;
      }
      // Handle booking data retrieval errors (partial failures)
      else if (error.message.includes('booking details') || error.message.includes('booking not found')) {
        statusCode = 200; // Return partial data with warnings
        logger.warn('Partial booking details retrieval failure', {
          userId: req.user?.id,
          requestId,
          error: error.message,
        });

        // Return partial data with metadata about missing information
        res.json({
          success: true,
          data: {
            swapCards: [], // Empty array as fallback
            pagination: {
              limit: Math.min(parseInt(req.query.limit as string) || 100, 100),
              offset: parseInt(req.query.offset as string) || 0,
              total: 0,
            },
          },
          warnings: [{
            code: 'PARTIAL_BOOKING_DETAILS',
            message: 'Some booking details could not be retrieved. Displaying available information.',
            category: 'data_completeness',
          }],
          metadata: {
            dataCompleteness: 'partial',
            missingBookingDetails: true,
          },
        });
        return;
      }
      // Handle validation errors
      else if (error.message.includes('validation') || error.message.includes('invalid')) {
        statusCode = 400;
        errorCode = 'VALIDATION_ERROR';
      }
      // Handle authorization errors
      else if (error.message.includes('unauthorized') || error.message.includes('forbidden')) {
        statusCode = 403;
        errorCode = 'AUTHORIZATION_ERROR';
      }

      res.status(statusCode).json({
        error: {
          code: errorCode,
          message: errorMessage,
          category: 'business',
          requestId,
          timestamp: new Date().toISOString(),
        },
      });
    }
  };

  /**
   * Get swap proposal by ID
   * GET /api/swaps/:id
   */
  getSwapById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required',
            category: 'authentication',
          },
        });
        return;
      }

      if (!id) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Swap ID is required',
            category: 'validation',
          },
        });
        return;
      }

      const swap = await this.swapProposalService.getSwapProposalById(id);

      if (!swap) {
        res.status(404).json({
          error: {
            code: 'SWAP_NOT_FOUND',
            message: 'Swap proposal not found',
            category: 'business',
          },
        });
        return;
      }

      // Check if user is authorized to view this swap using derived relationships
      // In simplified schema, we derive ownership from booking relationships
      const isOwner = swap.proposerId === userId; // User created this swap
      const isTargetOwner = swap.ownerId === userId; // User is target of this swap
      const isAdmin = req.user?.isAdmin || false;

      if (!isOwner && !isTargetOwner && !isAdmin) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Cannot access this swap proposal',
            category: 'authorization',
          },
        });
        return;
      }

      res.json({
        success: true,
        data: {
          swap,
        },
      });
    } catch (error: any) {
      logger.error('Failed to get swap by ID', { error: error.message, swapId: req.params.id });

      res.status(500).json({
        error: {
          code: 'SWAP_RETRIEVAL_FAILED',
          message: error.message,
          category: 'business',
        },
      });
    }
  };

  /**
   * Accept a swap proposal
   * PUT /api/swaps/:id/accept
   */
  acceptSwap = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required',
            category: 'authentication',
          },
        });
        return;
      }

      if (!id) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Swap ID is required',
            category: 'validation',
          },
        });
        return;
      }

      const responseRequest: SwapResponseRequest = {
        swapId: id,
        userId,
        response: 'accept',
      };

      const result = await this.swapResponseService.acceptSwapProposal(responseRequest);

      res.json({
        success: true,
        data: {
          swap: result.swap,
          blockchain: result.blockchainTransaction,
        },
      });
    } catch (error: any) {
      logger.error('Failed to accept swap', { error: error.message, swapId: req.params.id, userId: req.user?.id });

      const statusCode = error.message.includes('not found') ? 404 :
        error.message.includes('expired') ? 410 :
          error.message.includes('Unauthorized') || error.message.includes('Only the') ? 403 : 500;

      res.status(statusCode).json({
        error: {
          code: 'SWAP_ACCEPTANCE_FAILED',
          message: error.message,
          category: 'business',
        },
      });
    }
  };

  /**
   * Reject a swap proposal
   * PUT /api/swaps/:id/reject
   */
  rejectSwap = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required',
            category: 'authentication',
          },
        });
        return;
      }

      if (!id) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Swap ID is required',
            category: 'validation',
          },
        });
        return;
      }

      const responseRequest: SwapResponseRequest = {
        swapId: id,
        userId,
        response: 'reject',
      };

      const result = await this.swapResponseService.rejectSwapProposal(responseRequest);

      res.json({
        success: true,
        data: {
          swap: result.swap,
          blockchain: result.blockchainTransaction,
        },
      });
    } catch (error: any) {
      logger.error('Failed to reject swap', { error: error.message, swapId: req.params.id, userId: req.user?.id });

      const statusCode = error.message.includes('not found') ? 404 :
        error.message.includes('expired') ? 410 :
          error.message.includes('Unauthorized') || error.message.includes('Only the') ? 403 : 500;

      res.status(statusCode).json({
        error: {
          code: 'SWAP_REJECTION_FAILED',
          message: error.message,
          category: 'business',
        },
      });
    }
  };

  /**
   * Cancel a swap proposal (only by proposer)
   * DELETE /api/swaps/:id
   */
  cancelSwap = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required',
            category: 'authentication',
          },
        });
        return;
      }

      if (!id) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Swap ID is required',
            category: 'validation',
          },
        });
        return;
      }

      const cancelledSwap = await this.swapProposalService.cancelSwapProposal(id, userId);

      res.json({
        success: true,
        data: {
          swap: cancelledSwap,
        },
      });
    } catch (error: any) {
      logger.error('Failed to cancel swap', { error: error.message, swapId: req.params.id, userId: req.user?.id });

      const statusCode = error.message.includes('not found') ? 404 :
        error.message.includes('Only the proposer') ? 403 : 500;

      res.status(statusCode).json({
        error: {
          code: 'SWAP_CANCELLATION_FAILED',
          message: error.message,
          category: 'business',
        },
      });
    }
  };

  /**
   * Get swap status and history
   * GET /api/swaps/:id/status
   */
  getSwapStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required',
            category: 'authentication',
          },
        });
        return;
      }

      if (!id) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Swap ID is required',
            category: 'validation',
          },
        });
        return;
      }

      const swap = await this.swapProposalService.getSwapProposalById(id);

      if (!swap) {
        res.status(404).json({
          error: {
            code: 'SWAP_NOT_FOUND',
            message: 'Swap proposal not found',
            category: 'business',
          },
        });
        return;
      }

      // Check if user is authorized to view this swap status
      if (swap.proposerId !== userId && swap.ownerId !== userId && !req.user?.isAdmin) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Cannot access this swap proposal status',
            category: 'authorization',
          },
        });
        return;
      }

      // Return status and timeline information
      res.json({
        success: true,
        data: {
          swapId: swap.id,
          status: swap.status,
          timeline: swap.timeline,
          blockchain: swap.blockchain,
          terms: swap.terms,
        },
      });
    } catch (error: any) {
      logger.error('Failed to get swap status', { error: error.message, swapId: req.params.id });

      res.status(500).json({
        error: {
          code: 'SWAP_STATUS_RETRIEVAL_FAILED',
          message: error.message,
          category: 'business',
        },
      });
    }
  };

  /**
   * Get pending proposals for a specific booking
   * GET /api/swaps/booking/:bookingId/proposals
   */
  getBookingProposals = async (req: Request, res: Response): Promise<void> => {
    try {
      const { bookingId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required',
            category: 'authentication',
          },
        });
        return;
      }

      if (!bookingId) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Booking ID is required',
            category: 'validation',
          },
        });
        return;
      }

      const proposals = await this.swapProposalService.getPendingProposalsForBooking(bookingId);

      res.json({
        success: true,
        data: {
          bookingId,
          proposals,
          count: proposals.length,
        },
      });
    } catch (error: any) {
      logger.error('Failed to get booking proposals', { error: error.message, bookingId: req.params.bookingId });

      res.status(500).json({
        error: {
          code: 'BOOKING_PROPOSALS_RETRIEVAL_FAILED',
          message: error.message,
          category: 'business',
        },
      });
    }
  };

  /**
   * Get proposals for a specific swap
   * GET /api/swaps/:id/proposals
   */
  getSwapProposals = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id: swapId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required',
            category: 'authentication',
          },
        });
        return;
      }

      if (!swapId) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Swap ID is required',
            category: 'validation',
          },
        });
        return;
      }

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(swapId)) {
        res.status(400).json({
          error: {
            code: 'INVALID_SWAP_ID',
            message: 'Invalid swap ID format. Expected UUID format.',
            category: 'validation',
          },
        });
        return;
      }

      // First check if the swap exists and user has access
      const swap = await this.swapProposalService.getSwapProposalById(swapId);

      if (!swap) {
        // For non-existent swaps (like mock data), return empty proposals instead of error
        res.json({
          success: true,
          data: {
            swapId,
            proposals: [],
            count: 0,
          },
        });
        return;
      }

      // Check if user is authorized to view proposals for this swap
      if (swap.proposerId !== userId && swap.ownerId !== userId && !req.user?.isAdmin) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Cannot access proposals for this swap',
            category: 'authorization',
          },
        });
        return;
      }

      // In this system, a swap IS a proposal. Return the swap details as a proposal.
      // If there are multiple proposals for a swap, they would be separate swap records
      // targeting the same booking.
      const proposals = [
        {
          id: swap.id,
          swapId: swap.id,
          proposerId: swap.proposerId,
          ownerId: swap.ownerId,
          sourceBookingId: swap.sourceBookingId,
          targetBookingId: swap.targetBookingId,
          status: swap.status,
          terms: swap.terms,
          timeline: swap.timeline,
          blockchain: swap.blockchain,
          createdAt: swap.createdAt,
          updatedAt: swap.updatedAt,
        },
      ];

      res.json({
        success: true,
        data: {
          swapId,
          proposals,
          count: proposals.length,
        },
      });
    } catch (error: any) {
      logger.error('Failed to get swap proposals', { error: error.message, swapId: req.params.id });

      res.status(500).json({
        error: {
          code: 'SWAP_PROPOSALS_RETRIEVAL_FAILED',
          message: error.message,
          category: 'business',
        },
      });
    }
  };

  // ===== ENHANCED SWAP ENDPOINTS =====

  /**
   * Create enhanced swap with payment options and auction support
   * POST /api/swaps/enhanced
   */
  createEnhancedSwap = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required',
            category: 'authentication',
          },
        });
        return;
      }

      // Validate user authentication
      const user = req.user;
      if (!user) {
        res.status(401).json({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required',
            category: 'authentication',
          },
        });
        return;
      }

      const {
        sourceBookingId,
        title,
        description,
        paymentTypes,
        acceptanceStrategy,
        auctionSettings,
        swapPreferences,
        expirationDate,
        walletAddress,
      } = req.body;

      console.log('DEBUG: Swap creation with wallet address:', {
        userId: user.id,
        providedWalletAddress: walletAddress,
        userRecordWalletAddress: user.walletAddress
      });

      // Validate required fields
      if (!sourceBookingId || !title || !description || !paymentTypes || !acceptanceStrategy || !walletAddress) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields: sourceBookingId, title, description, paymentTypes, acceptanceStrategy, walletAddress',
            category: 'validation',
          },
        });
        return;
      }

      // Validate wallet address format (Hedera account ID format)
      if (!walletAddress.match(/^0\.0\.\d+$/)) {
        const error = handleInvalidWalletAddressError(walletAddress);
        const auditLog = createWalletValidationAuditLog(
          WalletValidationErrorCodes.INVALID_WALLET_ADDRESS,
          error.message,
          'createEnhancedSwap',
          {
            userId,
            walletAddress,
            technicalDetails: { providedFormat: walletAddress, expectedFormat: '0.0.123456' }
          }
        );

        logWalletValidationFailure(auditLog);
        sendWalletValidationErrorResponse(res, error);
        return;
      }

      // SERVER-SIDE WALLET BALANCE VALIDATION
      try {
        // Calculate balance requirements based on swap configuration
        const balanceRequirement = this.balanceCalculator.calculateSwapRequirements(req.body);

        // Validate wallet balance on Hedera blockchain
        const balanceValidation = await this.hederaBalanceService.validateSufficientBalance(
          walletAddress,
          balanceRequirement
        );

        if (!balanceValidation.isSufficient) {
          const error = handleInsufficientBalanceError(balanceValidation, walletAddress);
          const auditLog = createWalletValidationAuditLog(
            WalletValidationErrorCodes.INSUFFICIENT_WALLET_BALANCE,
            error.message,
            'createEnhancedSwap',
            {
              userId,
              walletAddress,
              balanceDetails: {
                currentBalance: balanceValidation.currentBalance,
                requiredBalance: balanceValidation.requirement.totalRequired,
                shortfall: balanceValidation.shortfall,
                currency: balanceValidation.requirement.currency
              },
              technicalDetails: {
                swapType: paymentTypes.cashPayment ? 'cash_enabled' : 'booking_exchange',
                validationSource: 'server_side_hedera_check'
              }
            }
          );

          logWalletValidationFailure(auditLog);
          sendWalletValidationErrorResponse(res, error);
          return;
        }

        logger.info('Server-side wallet validation passed', {
          userId,
          walletAddress: `${walletAddress.substring(0, 10)}...`,
          currentBalance: balanceValidation.currentBalance,
          requiredBalance: balanceValidation.requirement.totalRequired,
          swapType: paymentTypes.cashPayment ? 'cash_enabled' : 'booking_exchange'
        });
      } catch (validationError: any) {
        // Handle blockchain network errors or validation timeouts
        const error = handleBlockchainNetworkError(walletAddress, validationError.message);
        const auditLog = createWalletValidationAuditLog(
          WalletValidationErrorCodes.BLOCKCHAIN_NETWORK_ERROR,
          error.message,
          'createEnhancedSwap',
          {
            userId,
            walletAddress,
            technicalDetails: {
              originalError: validationError.message,
              errorStack: validationError.stack,
              validationStep: 'balance_check'
            }
          }
        );

        logWalletValidationFailure(auditLog);
        sendWalletValidationErrorResponse(res, error);
        return;
      }

      // Validate payment types
      console.log('DEBUG: Payment types validation:', {
        paymentTypes,
        isValid: this.validatePaymentTypes(paymentTypes)
      });

      if (!this.validatePaymentTypes(paymentTypes)) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid payment type configuration. At least one payment type must be enabled.',
            category: 'validation',
          },
        });
        return;
      }

      // Validate acceptance strategy
      if (!this.validateAcceptanceStrategy(acceptanceStrategy, auctionSettings)) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid acceptance strategy configuration. Auction mode requires valid auction settings.',
            category: 'validation',
          },
        });
        return;
      }

      // Validate expiration date
      const expiresAt = new Date(expirationDate);
      if (isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Valid future expiration date is required',
            category: 'validation',
          },
        });
        return;
      }

      // Create enhanced swap request
      const createRequest: EnhancedCreateSwapRequest = {
        sourceBookingId,
        title,
        description,
        paymentTypes,
        acceptanceStrategy,
        auctionSettings,
        swapPreferences: swapPreferences || {},
        expirationDate: expiresAt,
        walletAddress,
      };

      const result = await this.swapProposalService.createEnhancedSwapProposal(createRequest);

      res.status(201).json({
        success: true,
        data: {
          swap: result.swap,
          auction: result.auction,
          validationWarnings: result.validationWarnings,
        },
      });
    } catch (error: any) {
      logger.error('Failed to create enhanced swap', { error: error.message, userId: req.user?.id });

      // Handle specific error types
      let statusCode = 500;
      let errorCode = 'ENHANCED_SWAP_CREATION_FAILED';

      if (error.message.includes('not found')) {
        statusCode = 404;
        errorCode = 'BOOKING_NOT_FOUND';
      } else if (error.message.includes('not available')) {
        statusCode = 409;
        errorCode = 'BOOKING_NOT_AVAILABLE';
      } else if (error.message.includes('not verified')) {
        statusCode = 422;
        errorCode = 'BOOKING_NOT_VERIFIED';
      } else if (error.message.includes('Auctions are not allowed')) {
        statusCode = 400;
        errorCode = 'LAST_MINUTE_RESTRICTION';
      } else if (error.message.includes('Auction must end')) {
        statusCode = 400;
        errorCode = 'AUCTION_TIMING_INVALID';
      }

      res.status(statusCode).json({
        error: {
          code: errorCode,
          message: error.message,
          category: 'business',
        },
      });
    }
  };

  /**
   * Create enhanced proposal (booking or cash)
   * POST /api/swaps/:id/proposals/enhanced
   */
  createEnhancedProposal = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id: swapId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required',
            category: 'authentication',
          },
        });
        return;
      }

      if (!swapId) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Swap ID is required',
            category: 'validation',
          },
        });
        return;
      }

      const {
        proposalType,
        bookingId,
        cashOffer,
        message,
        conditions,
      } = req.body;

      // Validate required fields
      if (!proposalType || !['booking', 'cash'].includes(proposalType)) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Valid proposal type (booking or cash) is required',
            category: 'validation',
          },
        });
        return;
      }

      // Validate proposal type specific requirements
      if (proposalType === 'booking' && !bookingId) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Booking ID is required for booking proposals',
            category: 'validation',
          },
        });
        return;
      }

      if (proposalType === 'cash' && !cashOffer) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Cash offer details are required for cash proposals',
            category: 'validation',
          },
        });
        return;
      }

      // Validate cash offer if provided
      if (cashOffer && !this.validateCashOffer(cashOffer)) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid cash offer. Amount, currency, and payment method are required.',
            category: 'validation',
          },
        });
        return;
      }

      // Create enhanced proposal request
      const proposalRequest: CreateEnhancedProposalRequest = {
        swapId,
        proposalType,
        bookingId,
        cashOffer,
        message,
        conditions: conditions || [],
      };

      const result = await this.swapProposalService.createEnhancedProposal(proposalRequest, userId);

      res.status(201).json({
        success: true,
        data: {
          proposalId: result.proposalId,
          validationResult: result.validationResult,
          requiresAuctionSubmission: result.requiresAuctionSubmission,
        },
      });
    } catch (error: any) {
      logger.error('Failed to create enhanced proposal', { error: error.message, swapId: req.params.id, userId: req.user?.id });

      // Handle specific error types
      let statusCode = 500;
      let errorCode = 'ENHANCED_PROPOSAL_CREATION_FAILED';

      if (error.message.includes('not found')) {
        statusCode = 404;
        errorCode = 'SWAP_NOT_FOUND';
      } else if (error.message.includes('not accept')) {
        statusCode = 409;
        errorCode = 'PROPOSAL_TYPE_NOT_ACCEPTED';
      } else if (error.message.includes('validation failed')) {
        statusCode = 400;
        errorCode = 'PROPOSAL_VALIDATION_FAILED';
      } else if (error.message.includes('Payment method')) {
        statusCode = 422;
        errorCode = 'PAYMENT_METHOD_INVALID';
      }

      res.status(statusCode).json({
        error: {
          code: errorCode,
          message: error.message,
          category: 'business',
        },
      });
    }
  };

  // ===== PROPOSAL ENDPOINTS =====

  /**
   * Create proposal for a swap
   * POST /api/swaps/:id/proposals
   * Requirements: 1.1, 1.2, 1.3, 3.1, 3.2, 3.3, 4.4
   */
  createProposal = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id: targetSwapId } = req.params;
      const userId = req.user?.id;

      // Authentication check
      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required',
            category: 'authentication',
          },
        });
        return;
      }

      // Parameter validation
      if (!targetSwapId) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Target swap ID is required',
            category: 'validation',
          },
        });
        return;
      }

      const {
        sourceSwapId,
        bookingId, // Legacy field name for backward compatibility
        message,
        conditions,
        agreedToTerms,
        walletAddress, // Accept wallet address from request body
      } = req.body;

      // Handle both sourceSwapId and bookingId for backward compatibility
      const actualSourceSwapId = sourceSwapId || bookingId;

      // Debug logging to identify parameter issues
      logger.debug('Proposal creation parameters', {
        targetSwapId,
        sourceSwapId,
        bookingId,
        actualSourceSwapId,
        userId,
        requestBody: req.body,
        requestId: (req as any).requestId,
      });

      // Check rate limiting before processing
      try {
        await ProposalRateLimiter.checkRateLimit(userId);
      } catch (rateLimitError) {
        const errorResponse = formatProposalErrorResponse(rateLimitError, (req as any).requestId);
        res.status(429)
          .setHeader('Retry-After', errorResponse.error.retryAfter || 60)
          .json(errorResponse);
        return;
      }

      // Comprehensive request validation using utility functions
      try {
        validateProposalRequest({
          sourceSwapId: actualSourceSwapId,
          targetSwapId,
          message,
          conditions,
          agreedToTerms
        });
      } catch (validationError) {
        const errorResponse = formatProposalErrorResponse(validationError, (req as any).requestId);
        res.status(400).json(errorResponse);
        return;
      }

      // WALLET VALIDATION: Check if user has a wallet connected
      // Accept wallet address from request body (for newly connected wallets) or user record (for persisted wallets)
      // This prevents race conditions when wallet is connected but database hasn't updated yet
      const userWalletAddress = walletAddress || req.user?.walletAddress;

      // Wallet is optional for proposal creation - it will be required when accepting/executing
      // This allows users to browse and propose without blockchain integration
      if (userWalletAddress) {
        // Log wallet address source for debugging
        logger.debug('Proposal wallet validation', {
          userId,
          walletFromRequest: !!walletAddress,
          walletFromUser: !!req.user?.walletAddress,
          walletAddress: userWalletAddress.substring(0, 10) + '...'
        });
      } else {
        logger.debug('Proposal created without wallet - wallet will be required for acceptance', {
          userId
        });
      }

      // TODO: Add blockchain balance check here
      // For cash proposals, verify wallet has sufficient balance for:
      // - Transaction fee (~0.1 HBAR)
      // - Escrow amount (proposal amount)
      // - Platform fee (5% of escrow)
      // Example: await this.hederaService.checkAccountBalance(userWalletAddress, requiredAmount);

      // Additional validation for array types and data integrity
      if (!Array.isArray(conditions)) {
        const validationError = ProposalErrorFactory.createValidationError(
          PROPOSAL_ERROR_CODES.INVALID_CONDITIONS,
          'conditions',
          conditions
        );
        const errorResponse = formatProposalErrorResponse(validationError, (req as any).requestId);
        res.status(400).json(errorResponse);
        return;
      }

      if (typeof agreedToTerms !== 'boolean') {
        const validationError = ProposalErrorFactory.createValidationError(
          PROPOSAL_ERROR_CODES.TERMS_NOT_AGREED,
          'agreedToTerms',
          agreedToTerms
        );
        const errorResponse = formatProposalErrorResponse(validationError, (req as any).requestId);
        res.status(400).json(errorResponse);
        return;
      }

      // Validate UUID format for swap IDs
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(targetSwapId)) {
        const validationError = ProposalErrorFactory.createValidationError(
          PROPOSAL_ERROR_CODES.INVALID_TARGET_SWAP,
          'targetSwapId',
          targetSwapId
        );
        const errorResponse = formatProposalErrorResponse(validationError, (req as any).requestId);
        res.status(400).json(errorResponse);
        return;
      }

      if (!uuidRegex.test(actualSourceSwapId)) {
        const validationError = ProposalErrorFactory.createValidationError(
          PROPOSAL_ERROR_CODES.INVALID_SOURCE_SWAP,
          'sourceSwapId',
          actualSourceSwapId
        );
        const errorResponse = formatProposalErrorResponse(validationError, (req as any).requestId);
        res.status(400).json(errorResponse);
        return;
      }

      // Transform request to match browse proposal format and delegate to existing logic
      const proposalRequest: CreateProposalFromBrowseRequest = {
        targetSwapId,
        sourceSwapId: actualSourceSwapId,
        proposerId: userId,
        message: message || '',
        conditions: conditions || [],
        agreedToTerms: agreedToTerms || false,
      };

      // Record successful rate limit check
      ProposalRateLimiter.recordAttempt(userId);

      // Use the targeting system to update existing swaps instead of creating new ones
      logger.debug('Attempting to target swap for proposal creation', {
        actualSourceSwapId,
        targetSwapId,
        userId,
        requestId: (req as any).requestId,
      });

      const targetingResult = await this.swapTargetingService.targetSwap(
        actualSourceSwapId,
        targetSwapId,
        userId
      );

      if (!targetingResult.success) {
        logger.error('Swap targeting failed during proposal creation', {
          actualSourceSwapId,
          targetSwapId,
          userId,
          error: targetingResult.error,
          warnings: targetingResult.warnings,
          requestId: (req as any).requestId,
        });

        const validationError = ProposalErrorFactory.createValidationError(
          PROPOSAL_ERROR_CODES.INVALID_TARGET_SWAP,
          'targeting',
          targetingResult.error
        );
        const errorResponse = formatProposalErrorResponse(validationError, (req as any).requestId);

        // Add more details to the error response for better debugging
        if (errorResponse.error) {
          errorResponse.error.details = {
            ...errorResponse.error.details,
            targetingError: targetingResult.error,
            warnings: targetingResult.warnings,
            sourceSwapId: actualSourceSwapId,
            targetSwapId: targetSwapId,
          };
        }

        res.status(400).json(errorResponse);
        return;
      }

      const result = {
        proposalId: targetingResult.proposalId!,
        status: 'pending' as const,
        estimatedResponseTime: '2-3 business days'
      };

      // Log successful proposal creation for monitoring
      logger.info('Proposal created successfully', {
        proposalId: result.proposalId,
        targetId: targetingResult.targetId,
        userId,
        sourceSwapId: actualSourceSwapId,
        targetSwapId,
        status: result.status,
        hasBlockchainTransaction: false, // Targeting system doesn't use blockchain transactions yet
        requestId: (req as any).requestId,
        timestamp: new Date().toISOString()
      });

      // Return response in expected format (matching ProposalResponse interface)
      res.status(201).json({
        success: true,
        data: {
          proposalId: result.proposalId,
          status: result.status,
          estimatedResponseTime: result.estimatedResponseTime,
        },
      });
    } catch (error: any) {
      this.handleProposalError(error, req, res, {
        sourceSwapId: req.body.sourceSwapId || req.body.bookingId,
        targetSwapId: req.params.id,
        operation: 'createProposal'
      });
    }
  };

  /**
   * Create proposal from browse page
   * POST /api/swaps/:targetSwapId/proposals/from-browse
   * Requirements: 1.1, 1.2, 1.4, 1.6, 1.7
   */
  createProposalFromBrowse = async (req: Request, res: Response): Promise<void> => {
    try {
      const { targetSwapId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required',
            category: 'authentication',
          },
        });
        return;
      }

      if (!targetSwapId) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Target swap ID is required',
            category: 'validation',
          },
        });
        return;
      }

      const {
        sourceSwapId,
        message,
        conditions,
        agreedToTerms,
        walletAddress, // Accept wallet address from request body
      } = req.body;

      // WALLET VALIDATION: Check if user has a wallet connected
      // Accept wallet address from request body (for newly connected wallets) or user record (for persisted wallets)
      // This prevents race conditions when wallet is connected but database hasn't updated yet
      const userWalletAddress = walletAddress || req.user?.walletAddress;

      if (!userWalletAddress) {
        res.status(400).json({
          error: {
            code: 'WALLET_NOT_CONNECTED',
            message: 'Wallet connection required. Please connect your wallet before creating a proposal.',
            category: 'validation',
          },
        });
        return;
      }

      // Log wallet address source for debugging
      logger.debug('Browse proposal wallet validation', {
        userId,
        walletFromRequest: !!walletAddress,
        walletFromUser: !!req.user?.walletAddress,
        walletAddress: userWalletAddress.substring(0, 10) + '...'
      });

      // TODO: Add blockchain balance check here
      // For cash proposals, verify wallet has sufficient balance for:
      // - Transaction fee (~0.1 HBAR)
      // - Escrow amount (proposal amount)
      // - Platform fee (5% of escrow)
      // Example: await this.hederaService.checkAccountBalance(userWalletAddress, requiredAmount);

      // Create browse proposal request
      const proposalRequest: CreateProposalFromBrowseRequest = {
        targetSwapId,
        sourceSwapId,
        proposerId: userId,
        message: message || '',
        conditions: conditions || [],
        agreedToTerms: agreedToTerms || false,
      };

      // Enhanced validation and error handling
      const result = await this.swapMatchingService.createProposalFromBrowse(proposalRequest);

      res.status(201).json({
        success: true,
        data: {
          proposalId: result.proposalId,
          swap: result.swap,
          status: result.status,
          blockchain: result.blockchainTransaction,
          estimatedResponseTime: result.estimatedResponseTime,
          nextSteps: result.nextSteps,
          validationWarnings: result.validationWarnings,
          compatibilityScore: result.compatibilityScore,
        },
      });
    } catch (error: any) {
      // Enhanced error handling is now handled by proposalErrorHandler middleware
      // Just re-throw to let the middleware handle it
      throw error;
    }
  };

  /**
   * Get user's eligible swaps for proposing
   * GET /api/swaps/user/eligible?targetSwapId=:targetSwapId
   * Requirements: 1.1, 1.2, 1.4
   */
  getUserEligibleSwaps = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { targetSwapId } = req.query;

      // Log request details for debugging
      logger.info('getUserEligibleSwaps called', {
        userId,
        targetSwapId,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        headers: req.headers
      });

      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required',
            category: 'authentication',
          },
        });
        return;
      }

      if (!targetSwapId || typeof targetSwapId !== 'string') {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Target swap ID is required as query parameter',
            category: 'validation',
          },
        });
        return;
      }

      // Validate that target swap exists
      const targetSwap = await this.swapRepository.findById(targetSwapId);
      if (!targetSwap) {
        res.status(404).json({
          success: false,
          error: {
            message: `Target swap not found: ${targetSwapId}`,
            category: 'not_found',
          },
        });
        return;
      }

      // Get eligible swaps from the matching service
      const eligibleSwaps = await this.swapMatchingService.getUserEligibleSwaps(userId, targetSwapId);

      // Calculate compatibility analysis for each eligible swap
      const compatibilityAnalysis = await Promise.all(
        eligibleSwaps.map(async (swap) => {
          try {
            return await this.swapMatchingService.analyzeSwapCompatibility(swap.id, targetSwapId);
          } catch (error) {
            logger.warn('Failed to analyze compatibility for eligible swap', {
              swapId: swap.id,
              targetSwapId,
              error: error.message
            });
            // Return default compatibility analysis
            return {
              overallScore: 50,
              factors: {
                locationCompatibility: { score: 50, weight: 0.3, details: 'Unable to analyze', status: 'fair' as const },
                dateCompatibility: { score: 50, weight: 0.25, details: 'Unable to analyze', status: 'fair' as const },
                valueCompatibility: { score: 50, weight: 0.2, details: 'Unable to analyze', status: 'fair' as const },
                accommodationCompatibility: { score: 50, weight: 0.15, details: 'Unable to analyze', status: 'fair' as const },
                guestCompatibility: { score: 50, weight: 0.1, details: 'Unable to analyze', status: 'fair' as const },
              },
              recommendations: ['Review swap details manually'],
              potentialIssues: ['Compatibility analysis unavailable'],
            };
          }
        })
      );

      const response: EligibleSwapsResponse = {
        eligibleSwaps,
        totalCount: eligibleSwaps.length,
        compatibilityAnalysis,
      };

      // Log successful response
      logger.info('getUserEligibleSwaps success', {
        userId,
        targetSwapId,
        eligibleSwapsCount: eligibleSwaps.length,
        statusCode: 200
      });

      // Disable caching for eligible swaps since it's dynamic data
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      res.json({
        success: true,
        data: response,
      });
    } catch (error: any) {
      logger.error('Failed to get user eligible swaps', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id,
        targetSwapId: req.query.targetSwapId
      });

      const statusCode = 500;

      // Log the status code being returned
      logger.warn('Returning error status code', { statusCode, error: error.message });

      res.status(statusCode).json({
        error: {
          code: 'ELIGIBLE_SWAPS_RETRIEVAL_FAILED',
          message: error.message,
          category: 'business',
        },
      });
    }
  };

  /**
   * Get enhanced swap details with proposal information
   * GET /api/swaps/:id/enhanced
   * Requirements: 1.1, 1.2, 1.4, 1.6, 1.7
   */
  getEnhancedSwapDetails = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required',
            category: 'authentication',
          },
        });
        return;
      }

      if (!id) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Swap ID is required',
            category: 'validation',
          },
        });
        return;
      }

      // Get basic swap details
      const swap = await this.swapProposalService.getSwapProposalById(id);

      if (!swap) {
        res.status(404).json({
          error: {
            code: 'SWAP_NOT_FOUND',
            message: 'Swap not found',
            category: 'business',
          },
        });
        return;
      }

      // Get proposal count for this swap
      const proposals = await this.swapProposalService.getPendingProposalsForBooking(swap.targetBookingId || swap.sourceBookingId);
      const proposalCount = proposals.length;

      // Check if current user can make a proposal to this swap
      let userCanPropose = false;
      let userEligibleSwapsCount = 0;

      if (swap.ownerId !== userId) { // User doesn't own this swap
        try {
          const eligibleSwaps = await this.swapMatchingService.getUserEligibleSwaps(userId, id);
          userEligibleSwapsCount = eligibleSwaps.length;
          userCanPropose = userEligibleSwapsCount > 0;
        } catch (error) {
          logger.warn('Failed to check user eligibility for swap', { swapId: id, userId, error: error.message });
        }
      }

      const response: SwapDetailsResponse = {
        swap,
        proposalCount,
        userCanPropose,
        userEligibleSwapsCount,
      };

      res.json({
        success: true,
        data: response,
      });
    } catch (error: any) {
      logger.error('Failed to get enhanced swap details', {
        error: error.message,
        swapId: req.params.id,
        userId: req.user?.id
      });

      res.status(500).json({
        error: {
          code: 'ENHANCED_SWAP_DETAILS_FAILED',
          message: error.message,
          category: 'business',
        },
      });
    }
  };

  // ===== AUCTION MANAGEMENT ENDPOINTS =====

  /**
   * Get auction details and proposals
   * GET /api/auctions/:id
   */
  getAuctionDetails = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id: auctionId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required',
            category: 'authentication',
          },
        });
        return;
      }

      if (!auctionId) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Auction ID is required',
            category: 'validation',
          },
        });
        return;
      }

      const auction = await this.auctionService.getAuctionById(auctionId);
      if (!auction) {
        res.status(404).json({
          error: {
            code: 'AUCTION_NOT_FOUND',
            message: 'Auction not found',
            category: 'business',
          },
        });
        return;
      }

      // Check if user is authorized to view this auction
      const isOwner = auction.ownerId === userId;
      const hasProposal = auction.proposals.some(p => p.proposerId === userId);
      const isAdmin = req.user?.isAdmin;

      if (!isOwner && !hasProposal && !isAdmin) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Cannot access this auction',
            category: 'authorization',
          },
        });
        return;
      }

      // Get proposals (filter sensitive data for non-owners)
      const proposals = await this.auctionService.getAuctionProposals(auctionId);
      const filteredProposals = isOwner || isAdmin ? proposals :
        proposals.filter(p => p.proposerId === userId);

      // Calculate time remaining
      const now = new Date();
      const timeRemaining = Math.max(0, auction.settings.endDate.getTime() - now.getTime());

      res.json({
        success: true,
        data: {
          auction,
          proposals: filteredProposals,
          timeRemaining,
          canSelectWinner: isOwner && auction.status === 'ended' && !auction.winningProposalId,
          totalProposals: proposals.length,
        },
      });
    } catch (error: any) {
      logger.error('Failed to get auction details', { error: error.message, auctionId: req.params.id });

      res.status(500).json({
        error: {
          code: 'AUCTION_RETRIEVAL_FAILED',
          message: error.message,
          category: 'business',
        },
      });
    }
  };

  /**
   * Submit proposal to auction
   * POST /api/auctions/:id/proposals
   */
  submitAuctionProposal = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id: auctionId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required',
            category: 'authentication',
          },
        });
        return;
      }

      if (!auctionId) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Auction ID is required',
            category: 'validation',
          },
        });
        return;
      }

      // Get auction to find associated swap
      const auction = await this.auctionService.getAuctionById(auctionId);
      if (!auction) {
        res.status(404).json({
          error: {
            code: 'AUCTION_NOT_FOUND',
            message: 'Auction not found',
            category: 'business',
          },
        });
        return;
      }

      const {
        proposalType,
        bookingId,
        cashOffer,
        message,
        conditions,
      } = req.body;

      // Validate required fields
      if (!proposalType || !['booking', 'cash'].includes(proposalType)) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Valid proposal type (booking or cash) is required',
            category: 'validation',
          },
        });
        return;
      }

      // Validate proposal type specific requirements
      if (proposalType === 'booking' && !bookingId) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Booking ID is required for booking proposals',
            category: 'validation',
          },
        });
        return;
      }

      if (proposalType === 'cash' && !cashOffer) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Cash offer details are required for cash proposals',
            category: 'validation',
          },
        });
        return;
      }

      // Validate cash offer if provided
      if (cashOffer && !this.validateCashOffer(cashOffer)) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid cash offer. Amount, currency, and payment method are required.',
            category: 'validation',
          },
        });
        return;
      }

      // Submit proposal to auction
      const result = await this.auctionService.submitProposal({
        swapId: auction.swapId,
        proposerId: userId,
        proposalType,
        bookingId,
        cashOffer,
        message,
        conditions: conditions || [],
      });

      res.status(201).json({
        success: true,
        data: {
          proposal: result.proposal,
          blockchain: result.blockchainTransaction,
        },
      });
    } catch (error: any) {
      logger.error('Failed to submit auction proposal', { error: error.message, auctionId: req.params.id, userId: req.user?.id });

      // Handle specific error types
      let statusCode = 500;
      let errorCode = 'AUCTION_PROPOSAL_SUBMISSION_FAILED';

      if (error.message.includes('not found')) {
        statusCode = 404;
        errorCode = 'AUCTION_NOT_FOUND';
      } else if (error.message.includes('ended')) {
        statusCode = 409;
        errorCode = 'AUCTION_ENDED';
      } else if (error.message.includes('not allowed')) {
        statusCode = 409;
        errorCode = 'PROPOSAL_TYPE_NOT_ALLOWED';
      } else if (error.message.includes('validation failed')) {
        statusCode = 400;
        errorCode = 'PROPOSAL_VALIDATION_FAILED';
      } else if (error.message.includes('your own auction')) {
        statusCode = 403;
        errorCode = 'CANNOT_PROPOSE_TO_OWN_AUCTION';
      }

      res.status(statusCode).json({
        error: {
          code: errorCode,
          message: error.message,
          category: 'business',
        },
      });
    }
  };

  /**
   * Select winning proposal for auction
   * PUT /api/auctions/:id/select-winner
   */
  selectAuctionWinner = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id: auctionId } = req.params;
      const { proposalId } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required',
            category: 'authentication',
          },
        });
        return;
      }

      if (!auctionId || !proposalId) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Auction ID and proposal ID are required',
            category: 'validation',
          },
        });
        return;
      }

      const result = await this.auctionService.selectWinningProposal(auctionId, proposalId, userId);

      res.json({
        success: true,
        data: {
          auction: result.auction,
          winningProposal: result.winningProposal,
          blockchain: result.blockchainTransaction,
        },
      });
    } catch (error: any) {
      logger.error('Failed to select auction winner', { error: error.message, auctionId: req.params.id, userId: req.user?.id });

      // Handle specific error types
      let statusCode = 500;
      let errorCode = 'AUCTION_WINNER_SELECTION_FAILED';

      if (error.message.includes('not found')) {
        statusCode = 404;
        errorCode = 'AUCTION_NOT_FOUND';
      } else if (error.message.includes('Only the auction owner')) {
        statusCode = 403;
        errorCode = 'UNAUTHORIZED_WINNER_SELECTION';
      } else if (error.message.includes('not ended')) {
        statusCode = 409;
        errorCode = 'AUCTION_NOT_ENDED';
      } else if (error.message.includes('already been selected')) {
        statusCode = 409;
        errorCode = 'WINNER_ALREADY_SELECTED';
      } else if (error.message.includes('Proposal not found')) {
        statusCode = 404;
        errorCode = 'PROPOSAL_NOT_FOUND';
      }

      res.status(statusCode).json({
        error: {
          code: errorCode,
          message: error.message,
          category: 'business',
        },
      });
    }
  };

  /**
   * Get user's auction management dashboard
   * GET /api/auctions/user/:userId
   */
  getUserAuctions = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId: targetUserId } = req.params;
      const currentUserId = req.user?.id;

      if (!currentUserId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required',
            category: 'authentication',
          },
        });
        return;
      }

      // Users can only view their own auctions unless they're admin
      if (targetUserId !== currentUserId && !req.user?.isAdmin) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Cannot access other user\'s auctions',
            category: 'authorization',
          },
        });
        return;
      }

      const {
        limit = '20',
        offset = '0',
        status
      } = req.query;

      const parsedLimit = Math.min(parseInt(limit as string) || 20, 100);
      const parsedOffset = parseInt(offset as string) || 0;

      // Get user's auctions
      const auctions = await this.auctionService.getUserAuctions(targetUserId, parsedLimit, parsedOffset);

      // Filter by status if provided
      const filteredAuctions = status ?
        auctions.filter(auction => auction.status === status) :
        auctions;

      // Get proposal counts and time remaining for each auction
      const auctionsWithDetails = await Promise.all(
        filteredAuctions.map(async (auction) => {
          const proposals = await this.auctionService.getAuctionProposals(auction.id);
          const now = new Date();
          const timeRemaining = Math.max(0, auction.settings.endDate.getTime() - now.getTime());

          return {
            ...auction,
            proposalCount: proposals.length,
            timeRemaining,
            canSelectWinner: auction.status === 'ended' && !auction.winningProposalId,
          };
        })
      );

      res.json({
        success: true,
        data: {
          auctions: auctionsWithDetails,
          pagination: {
            limit: parsedLimit,
            offset: parsedOffset,
            total: filteredAuctions.length,
          },
        },
      });
    } catch (error: any) {
      logger.error('Failed to get user auctions', { error: error.message, userId: req.params.userId });

      res.status(500).json({
        error: {
          code: 'USER_AUCTIONS_RETRIEVAL_FAILED',
          message: error.message,
          category: 'business',
        },
      });
    }
  };

  // ===== PAYMENT PROCESSING ENDPOINTS =====

  /**
   * Submit swap offer using enhanced workflow service (supports both cash and booking offers)
   * POST /api/swaps/:id/offers
   */
  submitSwapOffer = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required',
            category: 'authentication',
          },
        });
        return;
      }

      const { id: swapId } = req.params;
      const {
        offerMode = 'direct', // Default to direct mode if not specified
        amount, // For cash offers
        currency, // For cash offers
        paymentMethodId, // For cash offers
        bookingId, // For booking swap offers
        message,
        conditions,
      } = req.body;

      // Validate required fields
      if (!swapId) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Swap ID is required',
            category: 'validation',
          },
        });
        return;
      }

      // Validate offer mode
      if (offerMode && !['auction', 'direct'].includes(offerMode)) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid offer mode. Must be "auction" or "direct"',
            category: 'validation',
          },
        });
        return;
      }

      // Validate cash offer fields if amount is provided
      if (amount && (!currency || !paymentMethodId)) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'For cash offers, currency and paymentMethodId are required',
            category: 'validation',
          },
        });
        return;
      }

      // Validate amount if provided
      if (amount && (typeof amount !== 'number' || amount <= 0)) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Amount must be a positive number',
            category: 'validation',
          },
        });
        return;
      }

      // Validate that either cash offer or booking offer is provided
      if (!amount && !bookingId) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Either cash offer (amount, currency, paymentMethodId) or booking offer (bookingId) must be provided',
            category: 'validation',
          },
        });
        return;
      }

      // Create swap offer request using new workflow service
      const swapOfferRequest: SwapOfferRequest = {
        swapId,
        userId,
        offerMode: offerMode as OfferMode,
        amount,
        currency,
        paymentMethodId,
        bookingId,
        message,
        conditions: conditions || [],
      };

      // Use the enhanced workflow service for orchestration
      const result: SwapOfferResult = await this.swapOfferWorkflowService.submitSwapOffer(swapOfferRequest);

      // Return enhanced response with new validation structure
      res.status(201).json({
        success: true,
        data: {
          paymentTransaction: {
            id: result.paymentTransaction.id,
            swapId: result.paymentTransaction.swapId,
            amount: result.paymentTransaction.amount,
            currency: result.paymentTransaction.currency,
            status: result.paymentTransaction.status,
            createdAt: result.paymentTransaction.createdAt,
          },
          auctionProposal: result.auctionProposal ? {
            id: result.auctionProposal.id,
            status: result.auctionProposal.status,
            createdAt: result.auctionProposal.createdAt,
          } : undefined,
          offerMode: result.offerMode,
          validationWarnings: result.validationWarnings || [],
        },
        metadata: {
          timestamp: new Date().toISOString(),
          workflowUsed: 'SwapOfferWorkflowService',
          userSelectedMode: offerMode,
          actualMode: result.offerMode,
          offerType: amount ? 'cash' : 'booking',
        },
      });
    } catch (error: any) {
      logger.error('Failed to submit swap offer via workflow service', {
        error: error.message,
        userId: req.user?.id,
        swapId: req.params.id,
        offerMode: req.body.offerMode,
        errorType: error.constructor.name,
        offerType: req.body.amount ? 'cash' : 'booking'
      });

      // Use enhanced error handling for SwapOfferError instances
      if (error instanceof SwapOfferError) {
        const statusCode = this.getStatusCodeForSwapOfferError(error);
        const userFriendlyMessage = this.getUserFriendlyErrorMessage(error);

        res.status(statusCode).json({
          error: {
            code: error.code,
            message: userFriendlyMessage,
            category: 'business',
            timestamp: new Date().toISOString(),
            details: {
              swapId: req.params.id,
              offerMode: req.body.offerMode,
              workflowUsed: 'SwapOfferWorkflowService',
              offerType: req.body.amount ? 'cash' : 'booking',
            },
          },
        });
        return;
      }

      // Handle other error types with fallback logic
      let statusCode = 500;
      let errorCode = 'SWAP_OFFER_SUBMISSION_FAILED';

      if (error.message.includes('not found')) {
        statusCode = 404;
        errorCode = 'SWAP_NOT_FOUND';
      } else if (error.message.includes('not accept')) {
        statusCode = 409;
        errorCode = 'OFFERS_NOT_ACCEPTED';
      } else if (error.message.includes('validation failed')) {
        statusCode = 400;
        errorCode = 'OFFER_VALIDATION_FAILED';
      } else if (error.message.includes('Payment method')) {
        statusCode = 422;
        errorCode = 'PAYMENT_METHOD_INVALID';
      } else if (error.message.includes('constraint')) {
        statusCode = 409;
        errorCode = 'DATABASE_CONSTRAINT_VIOLATION';
      }

      res.status(statusCode).json({
        error: {
          code: errorCode,
          message: error.message,
          category: 'business',
          timestamp: new Date().toISOString(),
          details: {
            swapId: req.params.id,
            offerMode: req.body.offerMode,
            workflowUsed: 'SwapOfferWorkflowService',
            offerType: req.body.amount ? 'cash' : 'booking',
          },
        },
      });
    }
  };

  /**
   * Submit cash offer proposal using enhanced workflow service (legacy endpoint)
   * POST /api/payments/cash-offer
   */
  submitCashOffer = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required',
            category: 'authentication',
          },
        });
        return;
      }

      const {
        swapId,
        amount,
        currency,
        paymentMethodId,
        offerMode = 'direct', // Default to direct mode if not specified
        message,
        conditions,
      } = req.body;

      // Validate required fields
      if (!swapId || !amount || !currency || !paymentMethodId) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields: swapId, amount, currency, paymentMethodId',
            category: 'validation',
          },
        });
        return;
      }

      // Validate amount
      if (typeof amount !== 'number' || amount <= 0) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Amount must be a positive number',
            category: 'validation',
          },
        });
        return;
      }

      // Validate offer mode
      if (offerMode && !['auction', 'direct'].includes(offerMode)) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid offer mode. Must be "auction" or "direct"',
            category: 'validation',
          },
        });
        return;
      }

      // Create swap offer request using new workflow service
      const swapOfferRequest: SwapOfferRequest = {
        swapId,
        userId,
        offerMode: offerMode as OfferMode,
        amount,
        currency,
        paymentMethodId,
        message,
        conditions: conditions || [],
      };

      // Use the enhanced workflow service for orchestration
      const result: SwapOfferResult = await this.swapOfferWorkflowService.submitSwapOffer(swapOfferRequest);

      // Return enhanced response with new validation structure
      res.status(201).json({
        success: true,
        data: {
          paymentTransaction: {
            id: result.paymentTransaction.id,
            swapId: result.paymentTransaction.swapId,
            amount: result.paymentTransaction.amount,
            currency: result.paymentTransaction.currency,
            status: result.paymentTransaction.status,
            createdAt: result.paymentTransaction.createdAt,
          },
          auctionProposal: result.auctionProposal ? {
            id: result.auctionProposal.id,
            status: result.auctionProposal.status,
            createdAt: result.auctionProposal.createdAt,
          } : undefined,
          offerMode: result.offerMode,
          validationWarnings: result.validationWarnings || [],
        },
        metadata: {
          timestamp: new Date().toISOString(),
          workflowUsed: 'SwapOfferWorkflowService',
          userSelectedMode: offerMode,
          actualMode: result.offerMode,
        },
      });
    } catch (error: any) {
      logger.error('Failed to submit cash offer via workflow service', {
        error: error.message,
        userId: req.user?.id,
        swapId: req.body.swapId,
        offerMode: req.body.offerMode,
        errorType: error.constructor.name
      });

      // Use enhanced error handling for SwapOfferError instances
      if (error instanceof SwapOfferError) {
        const statusCode = this.getStatusCodeForSwapOfferError(error);
        const userFriendlyMessage = this.getUserFriendlyErrorMessage(error);

        res.status(statusCode).json({
          error: {
            code: error.code,
            message: userFriendlyMessage,
            category: 'business',
            timestamp: new Date().toISOString(),
            details: {
              swapId: req.body.swapId,
              offerMode: req.body.offerMode,
              workflowUsed: 'SwapOfferWorkflowService',
            },
          },
        });
        return;
      }

      // Handle other error types with fallback logic
      let statusCode = 500;
      let errorCode = 'CASH_OFFER_SUBMISSION_FAILED';

      if (error.message.includes('not found')) {
        statusCode = 404;
        errorCode = 'SWAP_NOT_FOUND';
      } else if (error.message.includes('not accept')) {
        statusCode = 409;
        errorCode = 'CASH_OFFERS_NOT_ACCEPTED';
      } else if (error.message.includes('validation failed')) {
        statusCode = 400;
        errorCode = 'CASH_OFFER_VALIDATION_FAILED';
      } else if (error.message.includes('Payment method')) {
        statusCode = 422;
        errorCode = 'PAYMENT_METHOD_INVALID';
      } else if (error.message.includes('constraint')) {
        statusCode = 409;
        errorCode = 'DATABASE_CONSTRAINT_VIOLATION';
      }

      res.status(statusCode).json({
        error: {
          code: errorCode,
          message: error.message,
          category: 'business',
          timestamp: new Date().toISOString(),
          details: {
            swapId: req.body.swapId,
            offerMode: req.body.offerMode,
            workflowUsed: 'SwapOfferWorkflowService',
          },
        },
      });
    }
  };

  /**
   * Get user's payment methods
   * GET /api/payments/methods
   */
  getUserPaymentMethods = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required',
            category: 'authentication',
          },
        });
        return;
      }

      // Get user's payment methods (this would typically come from a payment repository)
      // For now, we'll return a mock response since the payment methods are managed by the payment service
      const paymentMethods = [
        {
          id: 'pm_1',
          type: 'credit_card',
          displayName: '**** **** **** 1234',
          isVerified: true,
          createdAt: new Date(),
        },
        {
          id: 'pm_2',
          type: 'bank_transfer',
          displayName: 'Bank Account ****5678',
          isVerified: true,
          createdAt: new Date(),
        },
      ];

      res.json({
        success: true,
        data: {
          paymentMethods,
          count: paymentMethods.length,
        },
      });
    } catch (error: any) {
      logger.error('Failed to get user payment methods', { error: error.message, userId: req.user?.id });

      res.status(500).json({
        error: {
          code: 'PAYMENT_METHODS_RETRIEVAL_FAILED',
          message: error.message,
          category: 'business',
        },
      });
    }
  };

  /**
   * Create escrow account for cash transaction
   * POST /api/payments/escrow
   */
  createEscrowAccount = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required',
            category: 'authentication',
          },
        });
        return;
      }

      const {
        amount,
        currency,
        recipientId,
        swapId,
        proposalId,
      } = req.body;

      // Validate required fields
      if (!amount || !currency || !recipientId || !swapId || !proposalId) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields: amount, currency, recipientId, swapId, proposalId',
            category: 'validation',
          },
        });
        return;
      }

      // Validate amount
      if (typeof amount !== 'number' || amount <= 0) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Amount must be a positive number',
            category: 'validation',
          },
        });
        return;
      }

      // Create escrow account
      const escrowResult = await this.paymentService.createEscrow({
        amount,
        currency,
        payerId: userId,
        recipientId,
        swapId,
        proposalId,
      });

      res.status(201).json({
        success: true,
        data: {
          escrow: escrowResult,
        },
      });
    } catch (error: any) {
      logger.error('Failed to create escrow account', { error: error.message, userId: req.user?.id });

      // Handle specific error types
      let statusCode = 500;
      let errorCode = 'ESCROW_CREATION_FAILED';

      if (error.message.includes('Minimum escrow amount')) {
        statusCode = 400;
        errorCode = 'ESCROW_AMOUNT_TOO_LOW';
      } else if (error.message.includes('Maximum escrow amount')) {
        statusCode = 400;
        errorCode = 'ESCROW_AMOUNT_TOO_HIGH';
      } else if (error.message.includes('not supported')) {
        statusCode = 400;
        errorCode = 'CURRENCY_NOT_SUPPORTED';
      }

      res.status(statusCode).json({
        error: {
          code: errorCode,
          message: error.message,
          category: 'business',
        },
      });
    }
  };

  /**
   * Release escrow funds to recipient
   * PUT /api/payments/escrow/:id/release
   */
  releaseEscrowFunds = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id: escrowId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required',
            category: 'authentication',
          },
        });
        return;
      }

      if (!escrowId) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Escrow ID is required',
            category: 'validation',
          },
        });
        return;
      }

      const {
        recipientId,
        releaseAmount,
        reason,
      } = req.body;

      // Validate required fields
      if (!recipientId || !reason) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields: recipientId, reason',
            category: 'validation',
          },
        });
        return;
      }

      // Release escrow funds
      const result = await this.paymentService.releaseEscrow({
        escrowId,
        recipientId,
        releaseAmount,
        reason,
      });

      res.json({
        success: true,
        data: {
          transaction: result,
        },
      });
    } catch (error: any) {
      logger.error('Failed to release escrow funds', { error: error.message, escrowId: req.params.id, userId: req.user?.id });

      // Handle specific error types
      let statusCode = 500;
      let errorCode = 'ESCROW_RELEASE_FAILED';

      if (error.message.includes('not found')) {
        statusCode = 404;
        errorCode = 'ESCROW_NOT_FOUND';
      } else if (error.message.includes('Cannot release escrow')) {
        statusCode = 409;
        errorCode = 'ESCROW_NOT_RELEASABLE';
      } else if (error.message.includes('does not match')) {
        statusCode = 403;
        errorCode = 'RECIPIENT_MISMATCH';
      }

      res.status(statusCode).json({
        error: {
          code: errorCode,
          message: error.message,
          category: 'business',
        },
      });
    }
  };

  /**
   * Get payment transaction status
   * GET /api/payments/transactions/:id/status
   */
  getPaymentTransactionStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id: transactionId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required',
            category: 'authentication',
          },
        });
        return;
      }

      if (!transactionId) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Transaction ID is required',
            category: 'validation',
          },
        });
        return;
      }

      const status = await this.paymentService.getTransactionStatus(transactionId);

      res.json({
        success: true,
        data: {
          transactionId,
          status,
        },
      });
    } catch (error: any) {
      logger.error('Failed to get payment transaction status', { error: error.message, transactionId: req.params.id });

      let statusCode = 500;
      let errorCode = 'TRANSACTION_STATUS_RETRIEVAL_FAILED';

      if (error.message.includes('not found')) {
        statusCode = 404;
        errorCode = 'TRANSACTION_NOT_FOUND';
      }

      res.status(statusCode).json({
        error: {
          code: errorCode,
          message: error.message,
          category: 'business',
        },
      });
    }
  };

  /**
   * Generate payment receipt
   * GET /api/payments/transactions/:id/receipt
   */
  generatePaymentReceipt = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id: transactionId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required',
            category: 'authentication',
          },
        });
        return;
      }

      if (!transactionId) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Transaction ID is required',
            category: 'validation',
          },
        });
        return;
      }

      const receipt = await this.paymentService.generateReceipt(transactionId);

      res.json({
        success: true,
        data: {
          receipt,
        },
      });
    } catch (error: any) {
      logger.error('Failed to generate payment receipt', { error: error.message, transactionId: req.params.id });

      let statusCode = 500;
      let errorCode = 'RECEIPT_GENERATION_FAILED';

      if (error.message.includes('not found')) {
        statusCode = 404;
        errorCode = 'TRANSACTION_NOT_FOUND';
      } else if (error.message.includes('incomplete transaction')) {
        statusCode = 409;
        errorCode = 'TRANSACTION_NOT_COMPLETED';
      }

      res.status(statusCode).json({
        error: {
          code: errorCode,
          message: error.message,
          category: 'business',
        },
      });
    }
  };

  // ===== VALIDATION HELPERS =====

  /**
   * Validate payment type preferences
   */
  private validatePaymentTypes(paymentTypes: PaymentTypePreference): boolean {
    if (!paymentTypes) return false;

    // At least one payment type must be enabled
    if (!paymentTypes.bookingExchange && !paymentTypes.cashPayment) {
      return false;
    }

    // If cash payment is enabled, minimum amount must be specified
    if (paymentTypes.cashPayment) {
      if (!paymentTypes.minimumCashAmount || paymentTypes.minimumCashAmount <= 0) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate acceptance strategy configuration
   */
  private validateAcceptanceStrategy(
    acceptanceStrategy: AcceptanceStrategy,
    auctionSettings?: AuctionSettings
  ): boolean {
    if (!acceptanceStrategy || !acceptanceStrategy.type) return false;

    if (acceptanceStrategy.type === 'auction') {
      if (!auctionSettings) return false;

      // Validate auction settings
      if (!auctionSettings.endDate) return false;

      const endDate = new Date(auctionSettings.endDate);
      if (isNaN(endDate.getTime()) || endDate <= new Date()) return false;

      // At least one proposal type must be allowed
      if (!auctionSettings.allowBookingProposals && !auctionSettings.allowCashProposals) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate cash offer details
   */
  private validateCashOffer(cashOffer: any): boolean {
    if (!cashOffer) return false;

    return (
      typeof cashOffer.amount === 'number' &&
      cashOffer.amount > 0 &&
      typeof cashOffer.currency === 'string' &&
      cashOffer.currency.length > 0 &&
      typeof cashOffer.paymentMethodId === 'string' &&
      cashOffer.paymentMethodId.length > 0 &&
      typeof cashOffer.escrowAgreement === 'boolean'
    );
  }

  /**
   * Browse available swaps (bookings with active swap proposals)
   * GET /api/swaps/browse
   * 
   * Returns swaps with status 'pending' or 'rejected' that:
   * - Are not owned by the current user
   * - Have not expired
   * - Do NOT have accepted targets (excludes committed swaps)
   * 
   * This ensures users only see swaps that are truly available for new proposals.
   */
  browseAvailableSwaps = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id; // Optional - for filtering out user's own swaps
      const {
        limit = '100',
        offset = '0',
        location,
        priceRange,
        swapType,
      } = req.query;

      const parsedLimit = Math.min(parseInt(limit as string) || 100, 100);
      const parsedOffset = parseInt(offset as string) || 0;

      // Build filters for browsable swaps (service will include open statuses)
      const filters: any = {
        // status handling is applied in service to include open statuses
      };

      // Exclude user's own swaps if logged in
      if (userId) {
        filters.excludeOwnerId = userId;
      }

      // Add additional filters
      if (swapType && ['booking', 'cash'].includes(swapType as string)) {
        filters.paymentTypes = [swapType as string];
      }

      if (priceRange) {
        try {
          const range = JSON.parse(priceRange as string);
          if (range.min !== undefined || range.max !== undefined) {
            filters.cashAmountRange = range;
          }
        } catch (e) {
          // Invalid price range format, ignore
        }
      }

      // Get swaps with enhanced filtering
      const swaps = await this.swapProposalService.getBrowsableSwaps(filters, parsedLimit, parsedOffset);

      // Transform swaps to include booking details and owner information for frontend
      const swapsWithBookingDetails = await Promise.all(
        swaps.map(async (swap) => {
          try {
            // Get booking details for the source booking
            const booking = await this.swapProposalService.getBookingDetails(swap.sourceBookingId);

            // Get owner information
            let ownerName = 'Unknown User';
            if (booking?.userId) {
              try {
                const owner = await (this.swapProposalService as any).userRepository.findById(booking.userId);
                if (owner) {
                  // Use display_name, fallback to username, then email
                  ownerName = owner.profile?.displayName || owner.username || owner.email || 'Unknown User';
                }
              } catch (ownerError) {
                logger.warn('Failed to get owner info for swap', { swapId: swap.id, userId: booking.userId });
              }
            }

            return {
              id: swap.id,
              swapType: swap.paymentTypes?.cashPayment ?
                (swap.paymentTypes?.bookingExchange ? 'both' : 'cash') : 'booking',
              paymentTypes: swap.paymentTypes,
              acceptanceStrategy: swap.acceptanceStrategy,
              auctionId: swap.auctionId,
              ownerName, // Add owner name to response
              ownerId: booking?.userId, // Add owner ID
              sourceBooking: booking ? {
                id: booking.id,
                title: booking.title,
                description: booking.description,
                location: booking.location,
                dateRange: booking.dateRange,
                originalPrice: booking.originalPrice,
                swapValue: booking.swapValue,
                type: booking.type,
                status: booking.status,
                userId: booking.userId,
                createdAt: booking.createdAt,
              } : null,
              hasActiveProposals: true, // By definition, since we're browsing active swaps
              createdAt: swap.createdAt,
              expiresAt: swap.terms?.expiresAt,
            };
          } catch (error) {
            logger.warn('Failed to get booking details for swap', { swapId: swap.id, error: error.message });
            return null;
          }
        })
      );

      // Filter out any swaps where we couldn't get booking details
      const validSwaps = swapsWithBookingDetails.filter(swap => swap !== null && swap.sourceBooking !== null);

      res.json({
        success: true,
        data: {
          swaps: validSwaps,
          pagination: {
            limit: parsedLimit,
            offset: parsedOffset,
            total: validSwaps.length,
            hasMore: validSwaps.length === parsedLimit,
          },
          filters: {
            excludeOwnSwaps: !!userId,
            onlyActiveSwaps: true,
            includedStatuses: ['pending', 'rejected'],
            ...filters,
          },
        },
      });
    } catch (error: any) {
      logger.error('Failed to browse available swaps', { error: error.message, userId: req.user?.id });

      res.status(500).json({
        error: {
          code: 'SWAP_BROWSE_FAILED',
          message: error.message,
          category: 'business',
        },
      });
    }
  };

  // ===== PRIVATE HELPER METHODS =====

  /**
   * Handle proposal-specific errors with comprehensive error responses
   * @private
   */
  private handleProposalError(
    error: any,
    req: Request,
    res: Response,
    context: {
      sourceSwapId?: string;
      targetSwapId?: string;
      operation: string;
    }
  ): void {
    // Track error metrics for monitoring and alerting
    this.trackErrorMetrics(error, context.operation, req.user?.id);

    // Use comprehensive error logging with full context
    logProposalError(error, {
      userId: req.user?.id,
      sourceSwapId: context.sourceSwapId,
      targetSwapId: context.targetSwapId,
      operation: context.operation,
      requestId: (req as any).requestId,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });

    // Handle specific error types with comprehensive error response format
    let statusCode = 500;
    let errorResponse: any;

    if (error instanceof ProposalValidationError) {
      statusCode = 400;
      errorResponse = formatProposalErrorResponse(error, (req as any).requestId);
    } else if (error instanceof ProposalBusinessError) {
      statusCode = 409;
      errorResponse = formatProposalErrorResponse(error, (req as any).requestId);
    } else if (error instanceof ProposalRateLimitError) {
      statusCode = 429;
      errorResponse = formatProposalErrorResponse(error, (req as any).requestId);
      res.setHeader('Retry-After', errorResponse.error.retryAfter || 60);
    } else {
      // Handle service-level errors with specific status codes and user-friendly messages
      errorResponse = this.createServiceErrorResponse(error, req, context);
      statusCode = this.getStatusCodeForError(error);
    }

    res.status(statusCode).json(errorResponse);
  }

  /**
   * Create user-friendly error responses for service-level errors
   * @private
   */
  private createServiceErrorResponse(
    error: any,
    req: Request,
    context: { sourceSwapId?: string; targetSwapId?: string }
  ): any {
    const baseResponse = {
      timestamp: new Date().toISOString(),
      requestId: (req as any).requestId
    };

    // Handle network and database connection errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      return {
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Service temporarily unavailable. Please try again later.',
          category: 'infrastructure',
          details: { errorCode: error.code },
          suggestedActions: [
            'Try again in a few moments',
            'Check your internet connection',
            'Contact support if the problem persists'
          ],
          retryable: true,
          ...baseResponse
        }
      };
    }

    // Handle database connection errors
    if (error.message.includes('database') || error.message.includes('connection') || error.code === 'ECONNRESET') {
      return {
        error: {
          code: 'DATABASE_ERROR',
          message: 'Database connection error. Please try again.',
          category: 'infrastructure',
          details: { errorType: 'database_connection' },
          suggestedActions: [
            'Try again in a few moments',
            'Contact support if the problem persists'
          ],
          retryable: true,
          ...baseResponse
        }
      };
    }

    // Handle timeout errors
    if (error.message.includes('timeout') || error.code === 'TIMEOUT') {
      return {
        error: {
          code: 'REQUEST_TIMEOUT',
          message: 'Request timed out. Please try again.',
          category: 'infrastructure',
          details: { errorType: 'timeout' },
          suggestedActions: [
            'Try again with a stable internet connection',
            'Contact support if timeouts persist'
          ],
          retryable: true,
          ...baseResponse
        }
      };
    }

    if (error.message.includes('not found') || error.code === 'SWAP_NOT_FOUND') {
      return {
        error: {
          code: 'SWAP_NOT_FOUND',
          message: 'The target swap was not found or is no longer available',
          category: 'resource',
          details: { targetSwapId: context.targetSwapId },
          suggestedActions: [
            'Refresh the page to see current availability',
            'Browse other available swaps',
            'Try again later'
          ],
          retryable: true,
          ...baseResponse
        }
      };
    } else if (error.message.includes('not available') || error.code === 'SWAP_NOT_AVAILABLE') {
      return {
        error: {
          code: 'SWAP_NOT_AVAILABLE',
          message: 'One or both swaps are no longer available for proposals',
          category: 'business',
          details: { sourceSwapId: context.sourceSwapId, targetSwapId: context.targetSwapId },
          suggestedActions: [
            'Check that your swap is still active',
            'Refresh the page to see current availability',
            'Browse other available swaps'
          ],
          retryable: true,
          ...baseResponse
        }
      };
    } else if (error.message.includes('not authorized') || error.code === 'USER_NOT_AUTHORIZED') {
      return {
        error: {
          code: 'FORBIDDEN',
          message: 'You are not authorized to make this proposal',
          category: 'authorization',
          details: { userId: req.user?.id, targetSwapId: context.targetSwapId },
          suggestedActions: [
            'Ensure you are logged in',
            'Check that you own the source swap',
            'Verify the target swap allows proposals'
          ],
          retryable: false,
          ...baseResponse
        }
      };
    } else if (error.message.includes('invalid') || error.code === 'INVALID_SOURCE_SWAP') {
      return {
        error: {
          code: 'INVALID_SOURCE_SWAP',
          message: 'The selected swap is not valid or no longer available for proposing',
          category: 'validation',
          details: { sourceSwapId: context.sourceSwapId },
          suggestedActions: [
            'Select a different swap to propose',
            'Check that your swap is still active',
            'Refresh the page and try again'
          ],
          retryable: true,
          ...baseResponse
        }
      };
    } else if (error.message.includes('existing proposal') || error.code === 'EXISTING_PROPOSAL') {
      return {
        error: {
          code: 'EXISTING_PROPOSAL',
          message: 'You have already made a proposal for this swap',
          category: 'business',
          details: { sourceSwapId: context.sourceSwapId, targetSwapId: context.targetSwapId },
          suggestedActions: [
            'Check your proposals page for status',
            'Wait for a response to your existing proposal',
            'Browse other available swaps'
          ],
          retryable: false,
          ...baseResponse
        }
      };
    } else if (error.message.includes('owner cannot propose') || error.code === 'SWAP_OWNER_CANNOT_PROPOSE') {
      return {
        error: {
          code: 'SWAP_OWNER_CANNOT_PROPOSE',
          message: 'You cannot make a proposal to your own swap',
          category: 'business',
          details: { userId: req.user?.id, targetSwapId: context.targetSwapId },
          suggestedActions: [
            'Browse swaps from other users',
            'Share your swap to attract proposals',
            'Wait for others to propose to your swap'
          ],
          retryable: false,
          ...baseResponse
        }
      };
    } else {
      // Generic server error with user-friendly message
      return {
        error: {
          code: 'PROPOSAL_CREATION_FAILED',
          message: 'Unable to create proposal due to a server error. Please try again.',
          category: 'server',
          details: {
            originalError: error.message,
            timestamp: new Date().toISOString()
          },
          suggestedActions: [
            'Try again in a few moments',
            'Check your internet connection',
            'Contact support if the problem persists'
          ],
          retryable: true,
          ...baseResponse
        }
      };
    }
  }

  /**
   * Get appropriate HTTP status code for different error types
   * @private
   */
  private getStatusCodeForError(error: any): number {
    // Network and infrastructure errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      return 503; // Service Unavailable
    } else if (error.message.includes('database') || error.message.includes('connection') || error.code === 'ECONNRESET') {
      return 503; // Service Unavailable
    } else if (error.message.includes('timeout') || error.code === 'TIMEOUT') {
      return 408; // Request Timeout
    }
    // Business logic errors
    else if (error.message.includes('not found') || error.code === 'SWAP_NOT_FOUND') {
      return 404;
    } else if (error.message.includes('not available') || error.code === 'SWAP_NOT_AVAILABLE') {
      return 409;
    } else if (error.message.includes('not authorized') || error.code === 'USER_NOT_AUTHORIZED') {
      return 403;
    } else if (error.message.includes('invalid') || error.code === 'INVALID_SOURCE_SWAP') {
      return 400;
    } else if (error.message.includes('existing proposal') || error.code === 'EXISTING_PROPOSAL') {
      return 409;
    } else if (error.message.includes('owner cannot propose') || error.code === 'SWAP_OWNER_CANNOT_PROPOSE') {
      return 400;
    } else {
      return 500;
    }
  }

  /**
   * Track error metrics for monitoring and alerting
   * @private
   */
  private trackErrorMetrics(error: any, operation: string, userId?: string): void {
    const errorType = this.categorizeError(error);
    const timestamp = new Date().toISOString();

    // Log metrics for monitoring systems
    logger.info('Error metrics', {
      metric: 'proposal_error',
      operation,
      errorType,
      errorCode: error.code || 'UNKNOWN',
      userId,
      timestamp,
      retryable: this.isRetryableError(error),
      severity: this.getErrorSeverity(error)
    });

    // Additional metrics for specific error types that need immediate attention
    if (errorType === 'infrastructure' || errorType === 'database') {
      logger.error('Critical infrastructure error detected', {
        metric: 'critical_error',
        operation,
        errorType,
        errorCode: error.code,
        errorMessage: error.message,
        timestamp,
        requiresImmedateAttention: true
      });
    }
  }

  /**
   * Categorize errors for metrics tracking
   * @private
   */
  private categorizeError(error: any): string {
    if (error instanceof ProposalValidationError) {
      return 'validation';
    } else if (error instanceof ProposalBusinessError) {
      return 'business';
    } else if (error instanceof ProposalRateLimitError) {
      return 'rate_limiting';
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      return 'infrastructure';
    } else if (error.message.includes('database') || error.message.includes('connection')) {
      return 'database';
    } else if (error.message.includes('timeout')) {
      return 'timeout';
    } else if (error.message.includes('not found')) {
      return 'not_found';
    } else if (error.message.includes('not authorized') || error.message.includes('forbidden')) {
      return 'authorization';
    } else {
      return 'server';
    }
  }

  /**
   * Determine if an error is retryable
   * @private
   */
  private isRetryableError(error: any): boolean {
    const retryableErrors = [
      'infrastructure',
      'database',
      'timeout',
      'not_found'
    ];
    return retryableErrors.includes(this.categorizeError(error));
  }

  /**
   * Get error severity level for alerting
   * @private
   */
  private getErrorSeverity(error: any): 'low' | 'medium' | 'high' | 'critical' {
    const errorType = this.categorizeError(error);

    switch (errorType) {
      case 'infrastructure':
      case 'database':
        return 'critical';
      case 'timeout':
      case 'server':
        return 'high';
      case 'authorization':
      case 'not_found':
        return 'medium';
      case 'validation':
      case 'business':
      case 'rate_limiting':
        return 'low';
      default:
        return 'medium';
    }
  }

  /**
   * Get appropriate HTTP status code for SwapOfferError instances
   * Maps SwapOfferError instances to appropriate HTTP responses
   * 
   * Requirements: 4.3, 6.5
   */
  private getStatusCodeForSwapOfferError(error: SwapOfferError): number {
    switch (error.code) {
      // Validation errors (400)
      case 'SWAP_NOT_FOUND':
      case 'PROPOSAL_NOT_FOUND':
      case 'USER_NOT_FOUND':
      case 'SCENARIO_MISMATCH':
        return 400;

      // Not found errors (404)
      case 'INVALID_SWAP_REFERENCE':
        return 404;

      // Conflict errors (409)
      case 'CASH_OFFERS_NOT_ACCEPTED':
      case 'AUCTION_NOT_ACTIVE':
      case 'DATABASE_CONSTRAINT_VIOLATION':
      case 'FOREIGN_KEY_VIOLATION':
        return 409;

      // Unprocessable entity (422)
      case 'PAYMENT_METHOD_NOT_VERIFIED':
      case 'CANNOT_OFFER_ON_OWN_SWAP':
        return 422;

      // Server errors (500)
      case 'ROLLBACK_FAILURE':
      case 'CRITICAL_ROLLBACK_FAILURE':
      case 'WORKFLOW_EXECUTION_FAILED':
        return 500;

      // Default to 500 for unknown error codes
      default:
        logger.warn('Unknown SwapOfferError code encountered', {
          errorCode: error.code,
          errorMessage: error.message,
          context: error.context
        });
        return 500;
    }
  }

  /**
   * Get user-friendly error message without exposing internal details
   * Provides user-friendly error messages without exposing internal details
   * 
   * Requirements: 4.3, 6.5
   */
  private getUserFriendlyErrorMessage(error: SwapOfferError): string {
    switch (error.code) {
      case 'SWAP_NOT_FOUND':
        return 'The requested swap could not be found or is no longer available.';

      case 'PROPOSAL_NOT_FOUND':
        return 'The auction proposal reference is invalid. Please try submitting your offer again.';

      case 'USER_NOT_FOUND':
        return 'User information could not be verified. Please ensure you are properly logged in.';

      case 'SCENARIO_MISMATCH':
        return 'The selected offer type is not compatible with this swap. Please choose a different offer mode.';

      case 'CASH_OFFERS_NOT_ACCEPTED':
        return 'This swap does not accept cash offers. Please consider submitting a booking exchange instead.';

      case 'AUCTION_NOT_ACTIVE':
        return 'No active auction is available for this swap. Please try submitting a direct offer instead.';

      case 'PAYMENT_METHOD_NOT_VERIFIED':
        return 'Your payment method needs to be verified before submitting cash offers. Please verify your payment method and try again.';

      case 'CANNOT_OFFER_ON_OWN_SWAP':
        return 'You cannot submit offers on your own swap listings.';

      case 'DATABASE_CONSTRAINT_VIOLATION':
      case 'FOREIGN_KEY_VIOLATION':
        return 'There was a data consistency issue with your request. Please try again or contact support if the problem persists.';

      case 'ROLLBACK_FAILURE':
      case 'CRITICAL_ROLLBACK_FAILURE':
        return 'Your offer submission encountered an error and could not be completed. Please try again or contact support.';

      case 'WORKFLOW_EXECUTION_FAILED':
        return 'Your offer could not be processed at this time. Please try again later.';

      default:
        // For unknown error codes, provide a generic message
        logger.warn('Providing generic error message for unknown SwapOfferError code', {
          errorCode: error.code,
          originalMessage: error.message
        });
        return 'Your offer could not be submitted at this time. Please try again or contact support if the problem persists.';
    }
  }

  /**
   * Handle TargetingDisplayError exceptions with appropriate HTTP responses
   * Requirements: 3.4, 3.5, 7.1, 7.2
   */
  private handleTargetingDisplayError(
    error: TargetingDisplayError,
    req: Request,
    res: Response,
    context: {
      requestId: string;
      executionTime: number;
      userId?: string;
    }
  ): void {
    const { requestId, executionTime, userId } = context;

    // Log targeting-specific error details with performance monitoring
    logger.error('Targeting display error occurred', {
      targetingErrorCode: error.code,
      targetingErrorMessage: error.message,
      targetingErrorDetails: error.details,
      requestId,
      userId,
      executionTime,
      endpoint: 'getUserSwaps'
    });

    // Record targeting error metrics
    if (this.performanceMonitor) {
      this.performanceMonitor.recordMetric('targeting_error_handled', 1, 'count', {
        endpoint: 'getUserSwaps',
        userId,
        requestId,
        targetingErrorCode: error.code,
        executionTime,
        errorHandlingStrategy: 'fallback_response'
      });
    }

    // Handle different targeting error types
    switch (error.code) {
      case TargetingDisplayErrorCodes.TARGETING_DATA_UNAVAILABLE:
        // Implement fallback response when targeting data is partially available
        logger.warn('Targeting data unavailable, falling back to basic swap cards', {
          requestId,
          userId,
          errorDetails: error.details
        });

        res.status(200).json({
          success: true,
          data: {
            swapCards: [], // Empty array as fallback
            pagination: {
              limit: Math.min(parseInt(req.query.limit as string) || 100, 100),
              offset: parseInt(req.query.offset as string) || 0,
              total: 0,
            },
          },
          warnings: [{
            code: 'TARGETING_DATA_UNAVAILABLE',
            message: 'Targeting information is temporarily unavailable. Basic swap information is displayed.',
            category: 'targeting_service',
            severity: 'warning'
          }],
          metadata: {
            dataCompleteness: 'partial',
            targetingDataAvailable: false,
            fallbackMode: true,
            performance: {
              executionTime,
              meetsTarget: executionTime <= 2000,
              category: executionTime <= 500 ? 'excellent' :
                executionTime <= 1000 ? 'good' :
                  executionTime <= 2000 ? 'acceptable' : 'poor'
            }
          },
        });
        break;

      case TargetingDisplayErrorCodes.TARGETING_QUERY_FAILED:
        // Handle targeting query failures with detailed error logging
        logger.error('Targeting query failed, providing fallback response', {
          requestId,
          userId,
          errorDetails: error.details,
          retryRecommended: true
        });

        res.status(503).json({
          error: {
            code: 'TARGETING_SERVICE_UNAVAILABLE',
            message: 'Targeting service is temporarily unavailable. Please try again in a few moments.',
            category: 'service_unavailable',
            severity: 'error',
            userMessage: 'We\'re having trouble loading targeting information. Your swaps are still available, but targeting details may be missing.',
            technicalDetails: {
              targetingErrorCode: error.code,
              requestId,
              executionTime,
              retryAfter: 30 // seconds
            }
          },
          metadata: {
            requestId,
            timestamp: new Date().toISOString(),
            retryRecommended: true,
            fallbackAvailable: true
          }
        });
        break;

      case TargetingDisplayErrorCodes.TARGETING_TRANSFORMATION_FAILED:
        // Handle data transformation failures
        logger.error('Targeting data transformation failed', {
          requestId,
          userId,
          errorDetails: error.details
        });

        res.status(200).json({
          success: true,
          data: {
            swapCards: [], // Empty array as fallback
            pagination: {
              limit: Math.min(parseInt(req.query.limit as string) || 100, 100),
              offset: parseInt(req.query.offset as string) || 0,
              total: 0,
            },
          },
          warnings: [{
            code: 'TARGETING_TRANSFORMATION_FAILED',
            message: 'Targeting data could not be properly formatted. Basic swap information is displayed.',
            category: 'data_processing',
            severity: 'warning'
          }],
          metadata: {
            dataCompleteness: 'partial',
            targetingDataTransformationFailed: true,
            fallbackMode: true
          },
        });
        break;

      case TargetingDisplayErrorCodes.TARGETING_AUTHORIZATION_FAILED:
        // Handle authorization failures for targeting data
        logger.warn('Targeting authorization failed', {
          requestId,
          userId,
          errorDetails: error.details
        });

        res.status(200).json({
          success: true,
          data: {
            swapCards: [], // Empty array as fallback
            pagination: {
              limit: Math.min(parseInt(req.query.limit as string) || 100, 100),
              offset: parseInt(req.query.offset as string) || 0,
              total: 0,
            },
          },
          warnings: [{
            code: 'TARGETING_AUTHORIZATION_FAILED',
            message: 'You do not have permission to view targeting information for some swaps.',
            category: 'authorization',
            severity: 'info'
          }],
          metadata: {
            dataCompleteness: 'partial',
            targetingAuthorizationIssues: true,
            fallbackMode: true
          },
        });
        break;

      default:
        // Handle unknown targeting errors
        logger.error('Unknown targeting display error', {
          requestId,
          userId,
          targetingErrorCode: error.code,
          errorMessage: error.message,
          errorDetails: error.details
        });

        res.status(500).json({
          error: {
            code: 'TARGETING_DISPLAY_ERROR',
            message: 'An unexpected error occurred while loading targeting information.',
            category: 'system',
            severity: 'error',
            userMessage: 'We encountered an issue loading targeting details. Please try refreshing the page.',
            technicalDetails: {
              targetingErrorCode: error.code,
              requestId,
              executionTime
            }
          },
          metadata: {
            requestId,
            timestamp: new Date().toISOString(),
            retryRecommended: true
          }
        });
        break;
    }
  }

  /**
   * Get targeting history for a specific swap
   * GET /api/swaps/:swapId/targeting/history
   */
  getTargetingHistory = async (req: Request, res: Response): Promise<void> => {
    const requestId = generateRequestId('get-targeting-history');
    const startTime = Date.now();

    try {
      const userId = req.user?.id;
      if (!userId) {
        handleSwapError(
          new Error('User authentication required'),
          res,
          {
            operation: 'getTargetingHistory',
            requestId,
            requestData: { params: req.params, query: req.query }
          }
        );
        return;
      }

      const { swapId } = req.params;
      const {
        page = '1',
        limit = '50',
        eventTypes,
        severity,
        startDate,
        endDate,
        searchQuery,
        sortField = 'timestamp',
        sortDirection = 'desc'
      } = req.query;

      // Validate swap ID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(swapId)) {
        const validationError = new Error('Invalid swapId format');
        (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
        handleSwapError(validationError, res, {
          operation: 'getTargetingHistory',
          userId,
          requestId,
          requestData: { swapId }
        });
        return;
      }

      // Validate pagination parameters
      const parsedPage = Math.max(parseInt(page as string) || 1, 1);
      const parsedLimit = Math.min(Math.max(parseInt(limit as string) || 50, 1), 100);
      const parsedOffset = (parsedPage - 1) * parsedLimit;

      // Parse filters
      const filters: any = {};

      if (eventTypes) {
        const eventTypeArray = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
        filters.eventTypes = eventTypeArray.filter(type =>
          ['targeting_created', 'targeting_accepted', 'targeting_rejected', 'targeting_cancelled',
            'targeting_retargeted', 'auction_started', 'auction_ended', 'proposal_submitted',
            'proposal_withdrawn'].includes(type as string)
        );
      }

      if (severity) {
        const severityArray = Array.isArray(severity) ? severity : [severity];
        filters.severity = severityArray.filter(sev =>
          ['info', 'warning', 'success', 'error'].includes(sev as string)
        );
      }

      if (startDate) {
        const parsedStartDate = new Date(startDate as string);
        if (!isNaN(parsedStartDate.getTime())) {
          filters.startDate = parsedStartDate;
        }
      }

      if (endDate) {
        const parsedEndDate = new Date(endDate as string);
        if (!isNaN(parsedEndDate.getTime())) {
          filters.endDate = parsedEndDate;
        }
      }

      if (searchQuery && typeof searchQuery === 'string' && searchQuery.trim()) {
        filters.searchQuery = searchQuery.trim();
      }

      // Validate sort parameters
      const validSortFields = ['timestamp', 'type', 'actor', 'severity'];
      const validSortDirections = ['asc', 'desc'];

      const finalSortField = validSortFields.includes(sortField as string) ? sortField as string : 'timestamp';
      const finalSortDirection = validSortDirections.includes(sortDirection as string) ? sortDirection as string : 'desc';

      logger.info('Getting targeting history', {
        requestId,
        userId,
        swapId,
        page: parsedPage,
        limit: parsedLimit,
        filters,
        sorting: { field: finalSortField, direction: finalSortDirection }
      });

      // Check if user has access to this swap
      const swap = await this.swapProposalService.getSwapProposalById(swapId);
      if (!swap) {
        const notFoundError = new Error('Swap not found');
        (notFoundError as any).code = SWAP_ERROR_CODES.BOOKING_NOT_FOUND;
        handleSwapError(notFoundError, res, {
          operation: 'getTargetingHistory',
          userId,
          requestId,
          requestData: { swapId }
        });
        return;
      }

      // Check authorization - user must own the swap or have participated in targeting
      const hasAccess = swap.ownerId === userId || swap.proposerId === userId;
      if (!hasAccess) {
        // Check if user has participated in targeting for this swap
        const hasTargetingAccess = await this.swapTargetingService.hasTargetingAccess(userId, swapId);
        if (!hasTargetingAccess) {
          const forbiddenError = new Error('Access denied to targeting history');
          (forbiddenError as any).code = SWAP_ERROR_CODES.BOOKING_ACCESS_DENIED;
          handleSwapError(forbiddenError, res, {
            operation: 'getTargetingHistory',
            userId,
            requestId,
            requestData: { swapId }
          });
          return;
        }
      }

      // Get targeting history from service
      const historyResponse = await this.swapTargetingService.getTargetingHistory({
        swapId,
        userId,
        filters,
        sorting: { field: finalSortField, direction: finalSortDirection },
        pagination: { page: parsedPage, limit: parsedLimit }
      });

      const executionTime = Date.now() - startTime;

      logger.info('Targeting history retrieved successfully', {
        requestId,
        userId,
        swapId,
        totalEvents: historyResponse.pagination.total,
        returnedEvents: historyResponse.events.length,
        executionTime
      });

      res.status(200).json({
        success: true,
        data: historyResponse,
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          performance: {
            executionTime,
            meetsTarget: executionTime <= 2000,
            category: executionTime <= 500 ? 'excellent' :
              executionTime <= 1000 ? 'good' :
                executionTime <= 2000 ? 'acceptable' : 'poor'
          }
        }
      });

    } catch (error: any) {
      handleSwapError(error, res, {
        operation: 'getTargetingHistory',
        userId: req.user?.id,
        requestId,
        requestData: { params: req.params, query: req.query }
      });
    }
  };

  /**
   * Get targeting history for a user across all their swaps
   * GET /api/users/targeting/history
   */
  getUserTargetingHistory = async (req: Request, res: Response): Promise<void> => {
    const requestId = generateRequestId('get-user-targeting-history');
    const startTime = Date.now();

    try {
      const userId = req.user?.id;
      if (!userId) {
        handleSwapError(
          new Error('User authentication required'),
          res,
          {
            operation: 'getUserTargetingHistory',
            requestId,
            requestData: { query: req.query }
          }
        );
        return;
      }

      const {
        page = '1',
        limit = '50',
        eventTypes,
        severity,
        startDate,
        endDate,
        searchQuery,
        sortField = 'timestamp',
        sortDirection = 'desc',
        swaps // Optional filter for specific swaps
      } = req.query;

      // Validate pagination parameters
      const parsedPage = Math.max(parseInt(page as string) || 1, 1);
      const parsedLimit = Math.min(Math.max(parseInt(limit as string) || 50, 1), 100);

      // Parse filters (same as above)
      const filters: any = {};

      if (eventTypes) {
        const eventTypeArray = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
        filters.eventTypes = eventTypeArray.filter(type =>
          ['targeting_created', 'targeting_accepted', 'targeting_rejected', 'targeting_cancelled',
            'targeting_retargeted', 'auction_started', 'auction_ended', 'proposal_submitted',
            'proposal_withdrawn'].includes(type as string)
        );
      }

      if (severity) {
        const severityArray = Array.isArray(severity) ? severity : [severity];
        filters.severity = severityArray.filter(sev =>
          ['info', 'warning', 'success', 'error'].includes(sev as string)
        );
      }

      if (startDate) {
        const parsedStartDate = new Date(startDate as string);
        if (!isNaN(parsedStartDate.getTime())) {
          filters.startDate = parsedStartDate;
        }
      }

      if (endDate) {
        const parsedEndDate = new Date(endDate as string);
        if (!isNaN(parsedEndDate.getTime())) {
          filters.endDate = parsedEndDate;
        }
      }

      if (searchQuery && typeof searchQuery === 'string' && searchQuery.trim()) {
        filters.searchQuery = searchQuery.trim();
      }

      if (swaps) {
        const swapArray = Array.isArray(swaps) ? swaps : [swaps];
        // Validate swap IDs
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        filters.swaps = swapArray.filter(swapId => uuidRegex.test(swapId as string));
      }

      // Validate sort parameters
      const validSortFields = ['timestamp', 'type', 'actor', 'severity'];
      const validSortDirections = ['asc', 'desc'];

      const finalSortField = validSortFields.includes(sortField as string) ? sortField as string : 'timestamp';
      const finalSortDirection = validSortDirections.includes(sortDirection as string) ? sortDirection as string : 'desc';

      logger.info('Getting user targeting history', {
        requestId,
        userId,
        page: parsedPage,
        limit: parsedLimit,
        filters,
        sorting: { field: finalSortField, direction: finalSortDirection }
      });

      // Get targeting history from service
      const historyResponse = await this.swapTargetingService.getTargetingHistory({
        userId,
        filters,
        sorting: { field: finalSortField, direction: finalSortDirection },
        pagination: { page: parsedPage, limit: parsedLimit }
      });

      const executionTime = Date.now() - startTime;

      logger.info('User targeting history retrieved successfully', {
        requestId,
        userId,
        totalEvents: historyResponse.pagination.total,
        returnedEvents: historyResponse.events.length,
        executionTime
      });

      res.status(200).json({
        success: true,
        data: historyResponse,
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          performance: {
            executionTime,
            meetsTarget: executionTime <= 2000,
            category: executionTime <= 500 ? 'excellent' :
              executionTime <= 1000 ? 'good' :
                executionTime <= 2000 ? 'acceptable' : 'poor'
          }
        }
      });

    } catch (error: any) {
      handleSwapError(error, res, {
        operation: 'getUserTargetingHistory',
        userId: req.user?.id,
        requestId,
        requestData: { query: req.query }
      });
    }
  };
}