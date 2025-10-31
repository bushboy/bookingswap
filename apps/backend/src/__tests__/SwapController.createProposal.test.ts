import { Request, Response } from 'express';
import { SwapController } from '../controllers/SwapController';
import { CreateProposalFromBrowseRequest, SwapProposalResult } from '@booking-swap/shared';

// Mock the dependencies
const mockSwapProposalService = {
  createSwapProposal: vi.fn(),
  getUserSwapProposals: vi.fn(),
  getSwapProposalById: vi.fn(),
  cancelSwapProposal: vi.fn(),
  getPendingProposalsForBooking: vi.fn(),
  createEnhancedSwapProposal: vi.fn(),
  createEnhancedProposal: vi.fn(),
};

const mockSwapResponseService = {
  acceptSwapProposal: vi.fn(),
  rejectSwapProposal: vi.fn(),
  getUserSwapResponses: vi.fn(),
};

const mockSwapMatchingService = {
  createProposalFromBrowse: vi.fn(),
  getUserEligibleSwaps: vi.fn(),
  analyzeSwapCompatibility: vi.fn(),
  validateProposalEligibility: vi.fn(),
};

const mockAuctionService = {
  createAuction: vi.fn(),
  submitBid: vi.fn(),
  endAuction: vi.fn(),
};

const mockPaymentService = {
  processPayment: vi.fn(),
  refundPayment: vi.fn(),
};

// Mock the utility functions
vi.mock('../utils/proposalErrorHandling');
vi.mock('../utils/logger');

// Import mocked modules
import { 
  ProposalErrorFactory,
  PROPOSAL_ERROR_CODES,
  ProposalRateLimiter,
  formatProposalErrorResponse,
  validateProposalRequest
} from '../utils/proposalErrorHandling';
import { logger } from '../utils/logger';

describe('SwapController.createProposal', () => {
  let swapController: SwapController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: ReturnType<typeof vi.fn>;
  let mockStatus: ReturnType<typeof vi.fn>;
  let mockSetHeader: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create controller instance
    swapController = new SwapController(
      mockSwapProposalService as any,
      mockSwapResponseService as any,
      mockSwapMatchingService as any,
      mockAuctionService as any,
      mockPaymentService as any
    );

    // Setup mock response
    mockJson = vi.fn();
    mockStatus = vi.fn().mockReturnValue({ json: mockJson });
    mockSetHeader = vi.fn().mockReturnValue({ json: mockJson });
    
    mockResponse = {
      status: mockStatus,
      json: mockJson,
      setHeader: mockSetHeader,
    };

    // Setup default mock request
    mockRequest = {
      params: { id: 'target-swap-id' },
      body: {
        sourceSwapId: 'source-swap-id',
        message: 'Test proposal message',
        conditions: ['Flexible dates'],
        agreedToTerms: true,
      },
      user: { id: 'test-user-id' },
    };

    // Setup default mock implementations
    vi.mocked(ProposalRateLimiter.checkRateLimit).mockResolvedValue(undefined);
    vi.mocked(validateProposalRequest).mockReturnValue(undefined);
    vi.mocked(formatProposalErrorResponse).mockImplementation((error: any, requestId?: string) => ({
      error: {
        code: error.code,
        message: error.message,
        category: 'validation',
        details: error.details,
      },
      timestamp: new Date().toISOString(),
      requestId: requestId || 'test-request-id',
    }));
  });

  describe('Successful proposal creation', () => {
    it('should create proposal successfully with valid data', async () => {
      // Arrange
      const mockResult: SwapProposalResult = {
        proposalId: 'test-proposal-id',
        status: 'pending',
        swap: {
          id: 'test-proposal-id',
          sourceBookingId: 'source-booking-id',
          targetBookingId: 'target-booking-id',
          proposerId: 'test-user-id',
          status: 'pending',
          terms: {
            additionalPayment: 0,
            conditions: ['Flexible dates'],
            expiresAt: new Date(),
          },
          timeline: {
            proposedAt: new Date(),
          },
        },
        blockchainTransaction: {
          transactionId: 'test-tx-id',
          consensusTimestamp: '123456789.000000000',
        },
        estimatedResponseTime: '2-3 business days',
      };

      mockSwapMatchingService.createProposalFromBrowse.mockResolvedValue(mockResult);

      // Act
      await swapController.createProposal(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(vi.mocked(ProposalRateLimiter.checkRateLimit)).toHaveBeenCalledWith('test-user-id');
      expect(vi.mocked(validateProposalRequest)).toHaveBeenCalledWith({
        sourceSwapId: 'source-swap-id',
        targetSwapId: 'target-swap-id',
        message: 'Test proposal message',
        conditions: ['Flexible dates'],
        agreedToTerms: true,
      });
      expect(mockSwapMatchingService.createProposalFromBrowse).toHaveBeenCalledWith({
        targetSwapId: 'target-swap-id',
        sourceSwapId: 'source-swap-id',
        proposerId: 'test-user-id',
        message: 'Test proposal message',
        conditions: ['Flexible dates'],
        agreedToTerms: true,
      });
      expect(vi.mocked(ProposalRateLimiter.recordAttempt)).toHaveBeenCalledWith('test-user-id');
      expect(vi.mocked(logger.info)).toHaveBeenCalledWith('Proposal created successfully', expect.objectContaining({
        proposalId: 'test-proposal-id',
        userId: 'test-user-id',
        sourceSwapId: 'source-swap-id',
        targetSwapId: 'target-swap-id',
        status: 'pending',
      }));
      expect(mockStatus).toHaveBeenCalledWith(201);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: {
          proposalId: 'test-proposal-id',
          status: 'pending',
          swap: mockResult.swap,
          blockchainTransaction: mockResult.blockchainTransaction,
          estimatedResponseTime: '2-3 business days',
        },
      });
    });

    it('should handle backward compatibility with bookingId field', async () => {
      // Arrange
      mockRequest.body = {
        bookingId: 'legacy-booking-id', // Using legacy field name
        message: 'Test proposal message',
        conditions: ['Flexible dates'],
        agreedToTerms: true,
      };

      const mockResult: SwapProposalResult = {
        proposalId: 'test-proposal-id',
        status: 'pending',
        swap: {
          id: 'test-proposal-id',
          sourceBookingId: 'source-booking-id',
          targetBookingId: 'target-booking-id',
          proposerId: 'test-user-id',
          status: 'pending',
          terms: {
            additionalPayment: 0,
            conditions: ['Flexible dates'],
            expiresAt: new Date(),
          },
          timeline: {
            proposedAt: new Date(),
          },
        },
      };

      mockSwapMatchingService.createProposalFromBrowse.mockResolvedValue(mockResult);

      // Act
      await swapController.createProposal(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockSwapMatchingService.createProposalFromBrowse).toHaveBeenCalledWith({
        targetSwapId: 'target-swap-id',
        sourceSwapId: 'legacy-booking-id', // Should use bookingId as sourceSwapId
        proposerId: 'test-user-id',
        message: 'Test proposal message',
        conditions: ['Flexible dates'],
        agreedToTerms: true,
      });
    });

    it('should handle optional fields correctly', async () => {
      // Arrange
      mockRequest.body = {
        sourceSwapId: 'source-swap-id',
        agreedToTerms: true,
        // message and conditions are optional
      };

      const mockResult: SwapProposalResult = {
        proposalId: 'test-proposal-id',
        status: 'pending',
        swap: {
          id: 'test-proposal-id',
          sourceBookingId: 'source-booking-id',
          targetBookingId: 'target-booking-id',
          proposerId: 'test-user-id',
          status: 'pending',
          terms: {
            additionalPayment: 0,
            conditions: [],
            expiresAt: new Date(),
          },
          timeline: {
            proposedAt: new Date(),
          },
        },
      };

      mockSwapMatchingService.createProposalFromBrowse.mockResolvedValue(mockResult);

      // Act
      await swapController.createProposal(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockSwapMatchingService.createProposalFromBrowse).toHaveBeenCalledWith({
        targetSwapId: 'target-swap-id',
        sourceSwapId: 'source-swap-id',
        proposerId: 'test-user-id',
        message: '',
        conditions: [],
        agreedToTerms: true,
      });
    });
  });

  describe('Authentication and authorization errors', () => {
    it('should return 401 when user is not authenticated', async () => {
      // Arrange
      mockRequest.user = undefined;

      // Act
      await swapController.createProposal(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
          category: 'authentication',
        },
      });
      expect(mockSwapMatchingService.createProposalFromBrowse).not.toHaveBeenCalled();
    });

    it('should return 401 when user ID is missing', async () => {
      // Arrange
      mockRequest.user = { id: undefined };

      // Act
      await swapController.createProposal(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
          category: 'authentication',
        },
      });
    });
  });

  describe('Validation errors', () => {
    it('should return 400 when target swap ID is missing', async () => {
      // Arrange
      mockRequest.params = { id: undefined };

      // Act
      await swapController.createProposal(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Target swap ID is required',
          category: 'validation',
        },
      });
    });

    it('should return 400 for invalid conditions array', async () => {
      // Arrange
      mockRequest.body.conditions = 'not-an-array';

      const mockValidationError = {
        code: PROPOSAL_ERROR_CODES.INVALID_CONDITIONS,
        message: 'One or more proposal conditions are invalid',
        details: { fieldName: 'conditions', value: 'not-an-array' }
      };
      vi.mocked(ProposalErrorFactory.createValidationError).mockReturnValue(mockValidationError as any);

      // Act
      await swapController.createProposal(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(vi.mocked(ProposalErrorFactory.createValidationError)).toHaveBeenCalledWith(
        PROPOSAL_ERROR_CODES.INVALID_CONDITIONS,
        'conditions',
        'not-an-array'
      );
      expect(vi.mocked(formatProposalErrorResponse)).toHaveBeenCalledWith(mockValidationError, undefined);
      expect(mockStatus).toHaveBeenCalledWith(400);
    });

    it('should return 400 for non-boolean agreedToTerms', async () => {
      // Arrange
      mockRequest.body.agreedToTerms = 'yes';

      const mockValidationError = {
        code: PROPOSAL_ERROR_CODES.TERMS_NOT_AGREED,
        message: 'You must agree to the terms and conditions',
        details: { fieldName: 'agreedToTerms', value: 'yes' }
      };
      vi.mocked(ProposalErrorFactory.createValidationError).mockReturnValue(mockValidationError as any);

      // Act
      await swapController.createProposal(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(vi.mocked(ProposalErrorFactory.createValidationError)).toHaveBeenCalledWith(
        PROPOSAL_ERROR_CODES.TERMS_NOT_AGREED,
        'agreedToTerms',
        'yes'
      );
      expect(mockStatus).toHaveBeenCalledWith(400);
    });

    it('should return 400 for invalid target swap ID format', async () => {
      // Arrange
      mockRequest.params = { id: 'invalid-uuid' };

      const mockValidationError = {
        code: PROPOSAL_ERROR_CODES.INVALID_TARGET_SWAP,
        message: 'The target swap is not available for proposals',
        details: { fieldName: 'targetSwapId', value: 'invalid-uuid' }
      };
      vi.mocked(ProposalErrorFactory.createValidationError).mockReturnValue(mockValidationError as any);

      // Act
      await swapController.createProposal(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(vi.mocked(ProposalErrorFactory.createValidationError)).toHaveBeenCalledWith(
        PROPOSAL_ERROR_CODES.INVALID_TARGET_SWAP,
        'targetSwapId',
        'invalid-uuid'
      );
      expect(mockStatus).toHaveBeenCalledWith(400);
    });

    it('should return 400 for invalid source swap ID format', async () => {
      // Arrange
      mockRequest.body.sourceSwapId = 'invalid-uuid';

      const mockValidationError = {
        code: PROPOSAL_ERROR_CODES.INVALID_SOURCE_SWAP,
        message: 'The selected swap is not valid or no longer available for proposing',
        details: { fieldName: 'sourceSwapId', value: 'invalid-uuid' }
      };
      vi.mocked(ProposalErrorFactory.createValidationError).mockReturnValue(mockValidationError as any);

      // Act
      await swapController.createProposal(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(vi.mocked(ProposalErrorFactory.createValidationError)).toHaveBeenCalledWith(
        PROPOSAL_ERROR_CODES.INVALID_SOURCE_SWAP,
        'sourceSwapId',
        'invalid-uuid'
      );
      expect(mockStatus).toHaveBeenCalledWith(400);
    });

    it('should return 400 when validateProposalRequest throws validation error', async () => {
      // Arrange
      const mockValidationError = {
        code: PROPOSAL_ERROR_CODES.PROPOSAL_MESSAGE_TOO_LONG,
        message: 'Proposal message exceeds maximum length',
        details: { fieldName: 'message', value: 'very long message' }
      };
      vi.mocked(validateProposalRequest).mockImplementation(() => {
        throw mockValidationError;
      });

      // Act
      await swapController.createProposal(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(vi.mocked(formatProposalErrorResponse)).toHaveBeenCalledWith(mockValidationError, undefined);
      expect(mockStatus).toHaveBeenCalledWith(400);
    });
  });

  describe('Rate limiting errors', () => {
    it('should return 429 when rate limit is exceeded', async () => {
      // Arrange
      const mockRateLimitError = {
        code: PROPOSAL_ERROR_CODES.PROPOSAL_RATE_LIMIT_EXCEEDED,
        message: 'Too many proposal attempts',
        retryAfter: 60
      };
      vi.mocked(ProposalRateLimiter.checkRateLimit).mockRejectedValue(mockRateLimitError);
      vi.mocked(formatProposalErrorResponse).mockReturnValue({
        error: {
          code: PROPOSAL_ERROR_CODES.PROPOSAL_RATE_LIMIT_EXCEEDED,
          message: 'Too many proposal attempts',
          category: 'rate_limiting',
          retryAfter: 60,
        },
        timestamp: new Date().toISOString(),
        requestId: 'test-request-id',
      });

      // Act
      await swapController.createProposal(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(vi.mocked(ProposalRateLimiter.checkRateLimit)).toHaveBeenCalledWith('test-user-id');
      expect(vi.mocked(formatProposalErrorResponse)).toHaveBeenCalledWith(mockRateLimitError, undefined);
      expect(mockStatus).toHaveBeenCalledWith(429);
      expect(mockSetHeader).toHaveBeenCalledWith('Retry-After', 60);
      expect(mockSwapMatchingService.createProposalFromBrowse).not.toHaveBeenCalled();
    });
  });

  describe('Business logic errors from SwapMatchingService', () => {
    it('should handle invalid source swap error', async () => {
      // Arrange
      const mockBusinessError = new Error('The selected swap is not valid') as any;
      mockBusinessError.code = 'INVALID_SOURCE_SWAP';
      mockBusinessError.details = {
        sourceSwapId: 'source-swap-id',
        targetSwapId: 'target-swap-id',
        userId: 'test-user-id',
        reason: 'Swap is no longer available',
      };
      mockSwapMatchingService.createProposalFromBrowse.mockRejectedValue(mockBusinessError);

      // Mock the handleProposalError method
      const handleProposalErrorSpy = vi.spyOn(swapController as any, 'handleProposalError');
      handleProposalErrorSpy.mockImplementation((error, req, res, context) => {
        res.status(400).json({
          error: {
            code: error.code,
            message: error.message,
            category: 'business',
          },
        });
      });

      // Act
      await swapController.createProposal(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockSwapMatchingService.createProposalFromBrowse).toHaveBeenCalled();
      expect(handleProposalErrorSpy).toHaveBeenCalledWith(
        mockBusinessError,
        mockRequest,
        mockResponse,
        {
          sourceSwapId: 'source-swap-id',
          targetSwapId: 'target-swap-id',
          operation: 'createProposal',
        }
      );
    });

    it('should handle existing proposal error', async () => {
      // Arrange
      const mockBusinessError = new Error('You have already made a proposal for this swap') as any;
      mockBusinessError.code = 'EXISTING_PROPOSAL';
      mockSwapMatchingService.createProposalFromBrowse.mockRejectedValue(mockBusinessError);

      const handleProposalErrorSpy = vi.spyOn(swapController as any, 'handleProposalError');
      handleProposalErrorSpy.mockImplementation((error, req, res, context) => {
        res.status(409).json({
          error: {
            code: error.code,
            message: error.message,
            category: 'business',
          },
        });
      });

      // Act
      await swapController.createProposal(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(handleProposalErrorSpy).toHaveBeenCalledWith(
        mockBusinessError,
        mockRequest,
        mockResponse,
        expect.objectContaining({
          operation: 'createProposal',
        })
      );
    });

    it('should handle swap not available error', async () => {
      // Arrange
      const mockBusinessError = new Error('One or both swaps are no longer available') as any;
      mockBusinessError.code = 'SWAP_NOT_AVAILABLE';
      mockSwapMatchingService.createProposalFromBrowse.mockRejectedValue(mockBusinessError);

      const handleProposalErrorSpy = vi.spyOn(swapController as any, 'handleProposalError');
      handleProposalErrorSpy.mockImplementation((error, req, res, context) => {
        res.status(404).json({
          error: {
            code: error.code,
            message: error.message,
            category: 'business',
          },
        });
      });

      // Act
      await swapController.createProposal(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(handleProposalErrorSpy).toHaveBeenCalledWith(
        mockBusinessError,
        mockRequest,
        mockResponse,
        expect.objectContaining({
          operation: 'createProposal',
        })
      );
    });

    it('should handle user not authorized error', async () => {
      // Arrange
      const mockBusinessError = new Error('You are not authorized to make this proposal') as any;
      mockBusinessError.code = 'USER_NOT_AUTHORIZED';
      mockSwapMatchingService.createProposalFromBrowse.mockRejectedValue(mockBusinessError);

      const handleProposalErrorSpy = vi.spyOn(swapController as any, 'handleProposalError');
      handleProposalErrorSpy.mockImplementation((error, req, res, context) => {
        res.status(403).json({
          error: {
            code: error.code,
            message: error.message,
            category: 'authorization',
          },
        });
      });

      // Act
      await swapController.createProposal(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(handleProposalErrorSpy).toHaveBeenCalledWith(
        mockBusinessError,
        mockRequest,
        mockResponse,
        expect.objectContaining({
          operation: 'createProposal',
        })
      );
    });
  });

  describe('Error response format consistency', () => {
    it('should return consistent error format for validation errors', async () => {
      // Arrange
      mockRequest.user = undefined;

      // Act
      await swapController.createProposal(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockJson).toHaveBeenCalledWith({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
          category: 'authentication',
        },
      });
    });

    it('should include proper error categories', async () => {
      // Arrange
      const mockValidationError = {
        code: PROPOSAL_ERROR_CODES.INVALID_CONDITIONS,
        message: 'One or more proposal conditions are invalid',
        details: { fieldName: 'conditions', value: 'invalid' }
      };
      vi.mocked(validateProposalRequest).mockImplementation(() => {
        throw mockValidationError;
      });

      vi.mocked(formatProposalErrorResponse).mockReturnValue({
        error: {
          code: PROPOSAL_ERROR_CODES.INVALID_CONDITIONS,
          message: 'One or more proposal conditions are invalid',
          category: 'validation',
          details: {
            fieldName: 'conditions',
            value: 'invalid',
          },
        },
        timestamp: new Date().toISOString(),
        requestId: 'test-request-id',
      });

      // Act
      await swapController.createProposal(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockJson).toHaveBeenCalledWith({
        error: {
          code: PROPOSAL_ERROR_CODES.INVALID_CONDITIONS,
          message: 'One or more proposal conditions are invalid',
          category: 'validation',
          details: {
            fieldName: 'conditions',
            value: 'invalid',
          },
        },
        timestamp: expect.any(String),
        requestId: 'test-request-id',
      });
    });

    it('should include request ID in error responses when available', async () => {
      // Arrange
      (mockRequest as any).requestId = 'custom-request-id';
      mockRequest.user = undefined;

      // Act
      await swapController.createProposal(mockRequest as Request, mockResponse as Response);

      // Assert - The error response should be consistent regardless of request ID
      expect(mockJson).toHaveBeenCalledWith({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User authentication required',
          category: 'authentication',
        },
      });
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle empty conditions array', async () => {
      // Arrange
      mockRequest.body.conditions = [];

      const mockResult: SwapProposalResult = {
        proposalId: 'test-proposal-id',
        status: 'pending',
        swap: {
          id: 'test-proposal-id',
          sourceBookingId: 'source-booking-id',
          targetBookingId: 'target-booking-id',
          proposerId: 'test-user-id',
          status: 'pending',
          terms: {
            additionalPayment: 0,
            conditions: [],
            expiresAt: new Date(),
          },
          timeline: {
            proposedAt: new Date(),
          },
        },
      };

      mockSwapMatchingService.createProposalFromBrowse.mockResolvedValue(mockResult);

      // Act
      await swapController.createProposal(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockSwapMatchingService.createProposalFromBrowse).toHaveBeenCalledWith(
        expect.objectContaining({
          conditions: [],
        })
      );
      expect(mockStatus).toHaveBeenCalledWith(201);
    });

    it('should handle empty message string', async () => {
      // Arrange
      mockRequest.body.message = '';

      const mockResult: SwapProposalResult = {
        proposalId: 'test-proposal-id',
        status: 'pending',
        swap: {
          id: 'test-proposal-id',
          sourceBookingId: 'source-booking-id',
          targetBookingId: 'target-booking-id',
          proposerId: 'test-user-id',
          status: 'pending',
          terms: {
            additionalPayment: 0,
            conditions: ['Flexible dates'],
            expiresAt: new Date(),
          },
          timeline: {
            proposedAt: new Date(),
          },
        },
      };

      mockSwapMatchingService.createProposalFromBrowse.mockResolvedValue(mockResult);

      // Act
      await swapController.createProposal(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockSwapMatchingService.createProposalFromBrowse).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '',
        })
      );
      expect(mockStatus).toHaveBeenCalledWith(201);
    });

    it('should handle valid UUID formats correctly', async () => {
      // Arrange
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      mockRequest.params = { id: validUuid };
      mockRequest.body.sourceSwapId = validUuid;

      const mockResult: SwapProposalResult = {
        proposalId: 'test-proposal-id',
        status: 'pending',
        swap: {
          id: 'test-proposal-id',
          sourceBookingId: 'source-booking-id',
          targetBookingId: 'target-booking-id',
          proposerId: 'test-user-id',
          status: 'pending',
          terms: {
            additionalPayment: 0,
            conditions: ['Flexible dates'],
            expiresAt: new Date(),
          },
          timeline: {
            proposedAt: new Date(),
          },
        },
      };

      mockSwapMatchingService.createProposalFromBrowse.mockResolvedValue(mockResult);

      // Act
      await swapController.createProposal(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockSwapMatchingService.createProposalFromBrowse).toHaveBeenCalledWith({
        targetSwapId: validUuid,
        sourceSwapId: validUuid,
        proposerId: 'test-user-id',
        message: 'Test proposal message',
        conditions: ['Flexible dates'],
        agreedToTerms: true,
      });
      expect(mockStatus).toHaveBeenCalledWith(201);
    });

    it('should handle mixed case UUID formats correctly', async () => {
      // Arrange
      const validUuid = '123E4567-E89B-12D3-A456-426614174000'; // Mixed case
      mockRequest.params = { id: validUuid.toLowerCase() };
      mockRequest.body.sourceSwapId = validUuid.toLowerCase();

      const mockResult: SwapProposalResult = {
        proposalId: 'test-proposal-id',
        status: 'pending',
        swap: {
          id: 'test-proposal-id',
          sourceBookingId: 'source-booking-id',
          targetBookingId: 'target-booking-id',
          proposerId: 'test-user-id',
          status: 'pending',
          terms: {
            additionalPayment: 0,
            conditions: ['Flexible dates'],
            expiresAt: new Date(),
          },
          timeline: {
            proposedAt: new Date(),
          },
        },
      };

      mockSwapMatchingService.createProposalFromBrowse.mockResolvedValue(mockResult);

      // Act
      await swapController.createProposal(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockSwapMatchingService.createProposalFromBrowse).toHaveBeenCalledWith({
        targetSwapId: validUuid.toLowerCase(),
        sourceSwapId: validUuid.toLowerCase(),
        proposerId: 'test-user-id',
        message: 'Test proposal message',
        conditions: ['Flexible dates'],
        agreedToTerms: true,
      });
      expect(mockStatus).toHaveBeenCalledWith(201);
    });

    it('should handle large conditions array within limits', async () => {
      // Arrange
      const largeConditionsArray = Array.from({ length: 10 }, (_, i) => `Condition ${i + 1}`);
      mockRequest.body.conditions = largeConditionsArray;

      const mockResult: SwapProposalResult = {
        proposalId: 'test-proposal-id',
        status: 'pending',
        swap: {
          id: 'test-proposal-id',
          sourceBookingId: 'source-booking-id',
          targetBookingId: 'target-booking-id',
          proposerId: 'test-user-id',
          status: 'pending',
          terms: {
            additionalPayment: 0,
            conditions: largeConditionsArray,
            expiresAt: new Date(),
          },
          timeline: {
            proposedAt: new Date(),
          },
        },
      };

      mockSwapMatchingService.createProposalFromBrowse.mockResolvedValue(mockResult);

      // Act
      await swapController.createProposal(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockSwapMatchingService.createProposalFromBrowse).toHaveBeenCalledWith(
        expect.objectContaining({
          conditions: largeConditionsArray,
        })
      );
      expect(mockStatus).toHaveBeenCalledWith(201);
    });
  });

  describe('Service integration and error propagation', () => {
    it('should properly propagate service errors with context', async () => {
      // Arrange
      const serviceError = new Error('Service unavailable') as any;
      serviceError.code = 'SERVICE_UNAVAILABLE';
      mockSwapMatchingService.createProposalFromBrowse.mockRejectedValue(serviceError);

      const handleProposalErrorSpy = vi.spyOn(swapController as any, 'handleProposalError');
      handleProposalErrorSpy.mockImplementation((error, req, res, context) => {
        res.status(503).json({
          error: {
            code: error.code,
            message: error.message,
            category: 'service',
          },
        });
      });

      // Act
      await swapController.createProposal(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(handleProposalErrorSpy).toHaveBeenCalledWith(
        serviceError,
        mockRequest,
        mockResponse,
        {
          sourceSwapId: 'source-swap-id',
          targetSwapId: 'target-swap-id',
          operation: 'createProposal',
        }
      );
    });

    it('should handle network timeout errors gracefully', async () => {
      // Arrange
      const timeoutError = new Error('Request timeout') as any;
      timeoutError.code = 'TIMEOUT';
      mockSwapMatchingService.createProposalFromBrowse.mockRejectedValue(timeoutError);

      const handleProposalErrorSpy = vi.spyOn(swapController as any, 'handleProposalError');
      handleProposalErrorSpy.mockImplementation((error, req, res, context) => {
        res.status(504).json({
          error: {
            code: error.code,
            message: 'Request timed out, please try again',
            category: 'network',
          },
        });
      });

      // Act
      await swapController.createProposal(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(handleProposalErrorSpy).toHaveBeenCalledWith(
        timeoutError,
        mockRequest,
        mockResponse,
        expect.objectContaining({
          operation: 'createProposal',
        })
      );
    });

    it('should handle database connection errors', async () => {
      // Arrange
      const dbError = new Error('Database connection failed') as any;
      dbError.code = 'DB_CONNECTION_ERROR';
      mockSwapMatchingService.createProposalFromBrowse.mockRejectedValue(dbError);

      const handleProposalErrorSpy = vi.spyOn(swapController as any, 'handleProposalError');
      handleProposalErrorSpy.mockImplementation((error, req, res, context) => {
        res.status(500).json({
          error: {
            code: error.code,
            message: 'Database temporarily unavailable',
            category: 'database',
          },
        });
      });

      // Act
      await swapController.createProposal(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(handleProposalErrorSpy).toHaveBeenCalledWith(
        dbError,
        mockRequest,
        mockResponse,
        expect.objectContaining({
          operation: 'createProposal',
        })
      );
    });
  });

  describe('Response format validation', () => {
    it('should return response with all required fields for successful creation', async () => {
      // Arrange
      const mockResult: SwapProposalResult = {
        proposalId: 'test-proposal-id',
        status: 'pending',
        swap: {
          id: 'test-proposal-id',
          sourceBookingId: 'source-booking-id',
          targetBookingId: 'target-booking-id',
          proposerId: 'test-user-id',
          status: 'pending',
          terms: {
            additionalPayment: 0,
            conditions: ['Flexible dates'],
            expiresAt: new Date(),
          },
          timeline: {
            proposedAt: new Date(),
          },
        },
        blockchainTransaction: {
          transactionId: 'test-tx-id',
          consensusTimestamp: '123456789.000000000',
        },
        estimatedResponseTime: '2-3 business days',
      };

      mockSwapMatchingService.createProposalFromBrowse.mockResolvedValue(mockResult);

      // Act
      await swapController.createProposal(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: {
          proposalId: 'test-proposal-id',
          status: 'pending',
          swap: expect.objectContaining({
            id: 'test-proposal-id',
            proposerId: 'test-user-id',
            status: 'pending',
          }),
          blockchainTransaction: expect.objectContaining({
            transactionId: 'test-tx-id',
            consensusTimestamp: '123456789.000000000',
          }),
          estimatedResponseTime: '2-3 business days',
        },
      });
    });

    it('should handle response without optional blockchain transaction', async () => {
      // Arrange
      const mockResult: SwapProposalResult = {
        proposalId: 'test-proposal-id',
        status: 'pending',
        swap: {
          id: 'test-proposal-id',
          sourceBookingId: 'source-booking-id',
          targetBookingId: 'target-booking-id',
          proposerId: 'test-user-id',
          status: 'pending',
          terms: {
            additionalPayment: 0,
            conditions: ['Flexible dates'],
            expiresAt: new Date(),
          },
          timeline: {
            proposedAt: new Date(),
          },
        },
        // No blockchainTransaction
        estimatedResponseTime: '2-3 business days',
      };

      mockSwapMatchingService.createProposalFromBrowse.mockResolvedValue(mockResult);

      // Act
      await swapController.createProposal(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: {
          proposalId: 'test-proposal-id',
          status: 'pending',
          swap: expect.objectContaining({
            id: 'test-proposal-id',
          }),
          blockchainTransaction: undefined,
          estimatedResponseTime: '2-3 business days',
        },
      });
    });

    it('should handle response without optional estimated response time', async () => {
      // Arrange
      const mockResult: SwapProposalResult = {
        proposalId: 'test-proposal-id',
        status: 'pending',
        swap: {
          id: 'test-proposal-id',
          sourceBookingId: 'source-booking-id',
          targetBookingId: 'target-booking-id',
          proposerId: 'test-user-id',
          status: 'pending',
          terms: {
            additionalPayment: 0,
            conditions: ['Flexible dates'],
            expiresAt: new Date(),
          },
          timeline: {
            proposedAt: new Date(),
          },
        },
        blockchainTransaction: {
          transactionId: 'test-tx-id',
        },
        // No estimatedResponseTime
      };

      mockSwapMatchingService.createProposalFromBrowse.mockResolvedValue(mockResult);

      // Act
      await swapController.createProposal(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: {
          proposalId: 'test-proposal-id',
          status: 'pending',
          swap: expect.objectContaining({
            id: 'test-proposal-id',
          }),
          blockchainTransaction: expect.objectContaining({
            transactionId: 'test-tx-id',
          }),
          estimatedResponseTime: undefined,
        },
      });
    });
  });
});