import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { SwapMatchingService } from '../SwapMatchingService';
import { SwapRepository } from '../../../database/repositories/SwapRepository';
import { UserRepository } from '../../../database/repositories/UserRepository';
import { BookingService } from '../../booking/BookingService';
import { SwapProposalService } from '../SwapProposalService';
import { CompatibilityAnalysisEngine } from '../CompatibilityAnalysisEngine';
import { ProposalCreationWorkflow } from '../ProposalCreationWorkflow';
import { BrowseProposalNotificationService } from '../../notification/BrowseProposalNotificationService';
import {
  EligibleSwap,
  CreateProposalFromBrowseRequest,
  ValidationResult,
  CompatibilityAnalysis,
  ProposalValidationError,
  SwapProposalResult
} from '@booking-swap/shared';

// Mock dependencies
vi.mock('../../../database/repositories/SwapRepository');
vi.mock('../../../database/repositories/UserRepository');
vi.mock('../../booking/BookingService');
vi.mock('../SwapProposalService');
vi.mock('../CompatibilityAnalysisEngine');
vi.mock('../ProposalCreationWorkflow');
vi.mock('../../notification/BrowseProposalNotificationService');
vi.mock('../../../utils/logger');

describe('SwapMatchingService', () => {
  let swapMatchingService: SwapMatchingService;
  let mockSwapRepository: vi.Mocked<SwapRepository>;
  let mockUserRepository: vi.Mocked<UserRepository>;
  let mockBookingService: vi.Mocked<BookingService>;
  let mockSwapProposalService: vi.Mocked<SwapProposalService>;
  let mockCompatibilityEngine: vi.Mocked<CompatibilityAnalysisEngine>;
  let mockProposalWorkflow: vi.Mocked<ProposalCreationWorkflow>;
  let mockBrowseNotificationService: vi.Mocked<BrowseProposalNotificationService>;
  let mockHederaService: any;
  let mockNotificationService: any;

  const mockEligibleSwaps: EligibleSwap[] = [
    {
      id: 'swap-1',
      sourceBookingId: 'booking-1',
      title: 'Paris Hotel',
      description: 'Nice hotel in Paris',
      bookingDetails: {
        location: 'Paris, France',
        dateRange: {
          checkIn: new Date('2024-06-01'),
          checkOut: new Date('2024-06-05')
        },
        accommodationType: 'hotel',
        guests: 2,
        estimatedValue: 500
      },
      status: 'active',
      createdAt: new Date(),
      isCompatible: true,
      compatibilityScore: 85
    },
    {
      id: 'swap-2',
      sourceBookingId: 'booking-2',
      title: 'London Apartment',
      description: 'Modern apartment in London',
      bookingDetails: {
        location: 'London, UK',
        dateRange: {
          checkIn: new Date('2024-06-10'),
          checkOut: new Date('2024-06-15')
        },
        accommodationType: 'apartment',
        guests: 4,
        estimatedValue: 600
      },
      status: 'active',
      createdAt: new Date(),
      isCompatible: false,
      compatibilityScore: 45
    }
  ];

  const mockCompatibilityAnalysis: CompatibilityAnalysis = {
    overallScore: 75,
    factors: {
      locationCompatibility: {
        score: 80,
        weight: 0.25,
        details: 'Good location match',
        status: 'good'
      },
      dateCompatibility: {
        score: 70,
        weight: 0.20,
        details: 'Similar duration',
        status: 'good'
      },
      valueCompatibility: {
        score: 85,
        weight: 0.30,
        details: 'Well matched values',
        status: 'excellent'
      },
      accommodationCompatibility: {
        score: 60,
        weight: 0.15,
        details: 'Different types but compatible',
        status: 'fair'
      },
      guestCompatibility: {
        score: 90,
        weight: 0.10,
        details: 'Perfect guest match',
        status: 'excellent'
      }
    },
    recommendations: ['Great match overall'],
    potentialIssues: []
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockSwapRepository = vi.mocked(new SwapRepository({} as any));
    mockUserRepository = vi.mocked(new UserRepository({} as any));
    mockBookingService = vi.mocked(new BookingService({} as any, {} as any, {} as any));
    mockSwapProposalService = vi.mocked(new SwapProposalService({} as any, {} as any, {} as any, {} as any));
    mockCompatibilityEngine = vi.mocked(new CompatibilityAnalysisEngine());

    mockHederaService = {
      submitTransaction: vi.fn()
    };

    mockNotificationService = {
      sendNotification: vi.fn()
    };

    swapMatchingService = new SwapMatchingService(
      mockSwapRepository,
      mockBookingService,
      mockSwapProposalService,
      mockUserRepository,
      mockHederaService,
      mockNotificationService
    );

    // Mock the compatibility engine instance
    vi.mocked(CompatibilityAnalysisEngine).mockImplementation(() => mockCompatibilityEngine);
  });

  describe('getUserEligibleSwaps', () => {
    it('should return eligible swaps with compatibility scores', async () => {
      // Arrange
      const userId = 'user-123';
      const targetSwapId = 'target-swap-456';

      mockSwapRepository.findEligibleSwapsWithBookingDetails.mockResolvedValue(mockEligibleSwaps);
      mockCompatibilityEngine.analyzeCompatibility.mockResolvedValue(mockCompatibilityAnalysis);

      // Act
      const result = await swapMatchingService.getUserEligibleSwaps(userId, targetSwapId);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].compatibilityScore).toBe(75); // From compatibility analysis
      expect(result[0].isCompatible).toBe(true); // Score >= 60
      expect(result[1].compatibilityScore).toBe(75);
      expect(result[1].isCompatible).toBe(true);

      // Should be sorted by compatibility score (highest first)
      expect(result[0].compatibilityScore).toBeGreaterThanOrEqual(result[1].compatibilityScore);

      expect(mockSwapRepository.findEligibleSwapsWithBookingDetails).toHaveBeenCalledWith(userId, targetSwapId);
      expect(mockCompatibilityEngine.analyzeCompatibility).toHaveBeenCalledTimes(2);
    });

    it('should handle compatibility analysis failures gracefully', async () => {
      // Arrange
      const userId = 'user-123';
      const targetSwapId = 'target-swap-456';

      mockSwapRepository.findEligibleSwapsWithBookingDetails.mockResolvedValue([mockEligibleSwaps[0]]);
      mockCompatibilityEngine.analyzeCompatibility.mockRejectedValue(new Error('Compatibility analysis failed'));

      // Act
      const result = await swapMatchingService.getUserEligibleSwaps(userId, targetSwapId);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].compatibilityScore).toBe(0);
      expect(result[0].isCompatible).toBe(false);
    });

    it('should return empty array when no eligible swaps found', async () => {
      // Arrange
      const userId = 'user-123';
      const targetSwapId = 'target-swap-456';

      mockSwapRepository.findEligibleSwapsWithBookingDetails.mockResolvedValue([]);

      // Act
      const result = await swapMatchingService.getUserEligibleSwaps(userId, targetSwapId);

      // Assert
      expect(result).toHaveLength(0);
      expect(mockSwapRepository.findEligibleSwapsWithBookingDetails).toHaveBeenCalledWith(userId, targetSwapId);
    });

    it('should throw error when repository fails', async () => {
      // Arrange
      const userId = 'user-123';
      const targetSwapId = 'target-swap-456';

      mockSwapRepository.findEligibleSwapsWithBookingDetails.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(swapMatchingService.getUserEligibleSwaps(userId, targetSwapId))
        .rejects.toThrow('Failed to get eligible swaps');
    });

    it('should handle database schema errors (42703)', async () => {
      // Arrange
      const userId = 'user-123';
      const targetSwapId = 'target-swap-456';

      const schemaError = new Error('column "owner_id" does not exist');
      (schemaError as any).code = '42703';

      // Create a DatabaseSchemaError manually for the test
      const dbSchemaError = {
        name: 'DatabaseSchemaError',
        message: 'Database functions need to be updated for simplified schema',
        code: '42703',
        originalError: schemaError
      };

      mockSwapRepository.findEligibleSwapsWithBookingDetails.mockRejectedValue(dbSchemaError);

      // Act & Assert
      await expect(swapMatchingService.getUserEligibleSwaps(userId, targetSwapId))
        .rejects.toThrow('Unable to find eligible swaps due to database schema issues');
    });

    it('should handle function not found errors (42883)', async () => {
      // Arrange
      const userId = 'user-123';
      const targetSwapId = 'target-swap-456';

      const functionError = new Error('function find_eligible_swaps_optimized does not exist');
      (functionError as any).code = '42883';

      // Create a DatabaseSchemaError manually for the test
      const dbSchemaError = {
        name: 'DatabaseSchemaError',
        message: 'Database function find_eligible_swaps_optimized does not exist',
        code: '42883',
        originalError: functionError
      };

      mockSwapRepository.findEligibleSwapsWithBookingDetails.mockRejectedValue(dbSchemaError);

      // Act & Assert
      await expect(swapMatchingService.getUserEligibleSwaps(userId, targetSwapId))
        .rejects.toThrow('Unable to find eligible swaps due to database schema issues');
    });
  });

  describe('validateProposalEligibility', () => {
    const userId = 'user-123';
    const sourceSwapId = 'source-swap-456';
    const targetSwapId = 'target-swap-789';

    const mockSourceSwap = {
      id: sourceSwapId,
      ownerId: userId,
      status: 'active',
      sourceBookingId: 'booking-1'
    };

    const mockTargetSwap = {
      id: targetSwapId,
      ownerId: 'other-user',
      status: 'active',
      sourceBookingId: 'booking-2'
    };

    it('should return valid result when all checks pass', async () => {
      // Arrange
      mockSwapRepository.findById
        .mockResolvedValueOnce(mockSourceSwap as any)
        .mockResolvedValueOnce(mockTargetSwap as any);
      mockSwapRepository.hasExistingProposalBetweenSwaps.mockResolvedValue(false);
      mockCompatibilityEngine.analyzeCompatibility.mockResolvedValue(mockCompatibilityAnalysis);

      // Act
      const result = await swapMatchingService.validateProposalEligibility(userId, sourceSwapId, targetSwapId);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.eligibilityChecks.userOwnsSourceSwap).toBe(true);
      expect(result.eligibilityChecks.sourceSwapAvailable).toBe(true);
      expect(result.eligibilityChecks.targetSwapAvailable).toBe(true);
      expect(result.eligibilityChecks.noExistingProposal).toBe(true);
      expect(result.eligibilityChecks.swapsAreCompatible).toBe(true);
    });

    it('should return invalid result when user does not own source swap', async () => {
      // Arrange
      const wrongOwnerSwap = { ...mockSourceSwap, ownerId: 'different-user' };
      mockSwapRepository.findById.mockResolvedValueOnce(wrongOwnerSwap as any);

      // Act
      const result = await swapMatchingService.validateProposalEligibility(userId, sourceSwapId, targetSwapId);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('User does not own the source swap');
      expect(result.eligibilityChecks.userOwnsSourceSwap).toBe(false);
    });

    it('should return invalid result when source swap is not active', async () => {
      // Arrange
      const inactiveSwap = { ...mockSourceSwap, status: 'completed' };
      mockSwapRepository.findById.mockResolvedValueOnce(inactiveSwap as any);

      // Act
      const result = await swapMatchingService.validateProposalEligibility(userId, sourceSwapId, targetSwapId);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Source swap is not available (status: completed)');
      expect(result.eligibilityChecks.sourceSwapAvailable).toBe(false);
    });

    it('should return invalid result when target swap not found', async () => {
      // Arrange
      mockSwapRepository.findById
        .mockResolvedValueOnce(mockSourceSwap as any)
        .mockResolvedValueOnce(null);

      // Act
      const result = await swapMatchingService.validateProposalEligibility(userId, sourceSwapId, targetSwapId);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Target swap not found');
      expect(result.eligibilityChecks.targetSwapAvailable).toBe(false);
    });

    it('should return invalid result when trying to propose to own swap', async () => {
      // Arrange
      const ownTargetSwap = { ...mockTargetSwap, ownerId: userId };
      mockSwapRepository.findById
        .mockResolvedValueOnce(mockSourceSwap as any)
        .mockResolvedValueOnce(ownTargetSwap as any);

      // Act
      const result = await swapMatchingService.validateProposalEligibility(userId, sourceSwapId, targetSwapId);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Cannot propose to your own swap');
    });

    it('should return invalid result when existing proposal exists', async () => {
      // Arrange
      mockSwapRepository.findById
        .mockResolvedValueOnce(mockSourceSwap as any)
        .mockResolvedValueOnce(mockTargetSwap as any);
      mockSwapRepository.hasExistingProposalBetweenSwaps.mockResolvedValue(true);

      // Act
      const result = await swapMatchingService.validateProposalEligibility(userId, sourceSwapId, targetSwapId);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('A proposal already exists between these swaps');
      expect(result.eligibilityChecks.noExistingProposal).toBe(false);
    });

    it('should add warning for low compatibility score', async () => {
      // Arrange
      const lowCompatibilityAnalysis = { ...mockCompatibilityAnalysis, overallScore: 45 };

      mockSwapRepository.findById
        .mockResolvedValueOnce(mockSourceSwap as any)
        .mockResolvedValueOnce(mockTargetSwap as any);
      mockSwapRepository.hasExistingProposalBetweenSwaps.mockResolvedValue(false);
      mockCompatibilityEngine.analyzeCompatibility.mockResolvedValue(lowCompatibilityAnalysis);

      // Act
      const result = await swapMatchingService.validateProposalEligibility(userId, sourceSwapId, targetSwapId);

      // Assert
      expect(result.isValid).toBe(true); // Still valid, just warning
      expect(result.warnings).toContain('Low compatibility score - proposal may be less likely to be accepted');
      expect(result.eligibilityChecks.swapsAreCompatible).toBe(true);
    });

    it('should handle compatibility analysis failure gracefully', async () => {
      // Arrange
      mockSwapRepository.findById
        .mockResolvedValueOnce(mockSourceSwap as any)
        .mockResolvedValueOnce(mockTargetSwap as any);
      mockSwapRepository.hasExistingProposalBetweenSwaps.mockResolvedValue(false);
      mockCompatibilityEngine.analyzeCompatibility.mockRejectedValue(new Error('Analysis failed'));

      // Act
      const result = await swapMatchingService.validateProposalEligibility(userId, sourceSwapId, targetSwapId);

      // Assert
      expect(result.isValid).toBe(true); // Should still be valid
      expect(result.warnings).toContain('Unable to calculate compatibility score');
      expect(result.eligibilityChecks.swapsAreCompatible).toBe(true); // Allow proposal to proceed
    });
  });

  describe('analyzeSwapCompatibility', () => {
    const sourceSwapId = 'source-swap-123';
    const targetSwapId = 'target-swap-456';

    const mockSwapWithBooking = {
      swap: { id: sourceSwapId },
      booking: {
        location: 'Paris, France',
        dateRange: {
          checkIn: new Date('2024-06-01'),
          checkOut: new Date('2024-06-05')
        },
        totalPrice: 500,
        accommodationType: 'hotel',
        guests: 2
      }
    };

    it('should return compatibility analysis successfully', async () => {
      // Arrange
      mockSwapRepository.findById.mockResolvedValue({ id: sourceSwapId, sourceBookingId: 'booking-1' } as any);
      mockBookingService.getBookingById.mockResolvedValue(mockSwapWithBooking.booking as any);
      mockCompatibilityEngine.analyzeCompatibility.mockResolvedValue(mockCompatibilityAnalysis);

      // Mock the private method by spying on the service
      const getSwapWithBookingDetailsSpy = vi.spyOn(swapMatchingService as any, 'getSwapWithBookingDetails');
      getSwapWithBookingDetailsSpy.mockResolvedValue(mockSwapWithBooking);

      // Act
      const result = await swapMatchingService.analyzeSwapCompatibility(sourceSwapId, targetSwapId);

      // Assert
      expect(result).toEqual(mockCompatibilityAnalysis);
      expect(getSwapWithBookingDetailsSpy).toHaveBeenCalledTimes(2);
      expect(mockCompatibilityEngine.analyzeCompatibility).toHaveBeenCalledWith(
        expect.objectContaining({
          location: 'Paris, France',
          dateRange: expect.any(Object),
          totalPrice: 500,
          accommodationType: 'hotel',
          guests: 2
        }),
        expect.objectContaining({
          location: 'Paris, France',
          dateRange: expect.any(Object),
          totalPrice: 500,
          accommodationType: 'hotel',
          guests: 2
        })
      );
    });

    it('should throw error when swap details cannot be retrieved', async () => {
      // Arrange
      const getSwapWithBookingDetailsSpy = vi.spyOn(swapMatchingService as any, 'getSwapWithBookingDetails');
      getSwapWithBookingDetailsSpy.mockResolvedValueOnce(null);

      // Act & Assert
      await expect(swapMatchingService.analyzeSwapCompatibility(sourceSwapId, targetSwapId))
        .rejects.toThrow('Unable to retrieve swap details for compatibility analysis');
    });

    it('should throw error when compatibility engine fails', async () => {
      // Arrange
      const getSwapWithBookingDetailsSpy = vi.spyOn(swapMatchingService as any, 'getSwapWithBookingDetails');
      getSwapWithBookingDetailsSpy.mockResolvedValue(mockSwapWithBooking);
      mockCompatibilityEngine.analyzeCompatibility.mockRejectedValue(new Error('Engine failure'));

      // Act & Assert
      await expect(swapMatchingService.analyzeSwapCompatibility(sourceSwapId, targetSwapId))
        .rejects.toThrow('Engine failure');
    });
  });

  describe('createProposalFromBrowse', () => {
    const mockRequest: CreateProposalFromBrowseRequest = {
      targetSwapId: 'target-swap-123',
      sourceSwapId: 'source-swap-456',
      proposerId: 'user-789',
      message: 'Great match!',
      conditions: ['Flexible dates'],
      agreedToTerms: true
    };

    it('should use proposal workflow when available', async () => {
      // Arrange
      const mockResult: SwapProposalResult = {
        proposalId: 'proposal-123',
        swap: { id: 'swap-123' } as any,
        status: 'pending_review',
        blockchainTransaction: { transactionId: 'tx-123' },
        estimatedResponseTime: '2-3 business days',
        nextSteps: ['Wait for response']
      };

      mockProposalWorkflow = vi.mocked(new ProposalCreationWorkflow({} as any, {} as any, {} as any, {} as any, {} as any, {} as any));
      mockProposalWorkflow.createProposalFromBrowse.mockResolvedValue(mockResult);

      // Create service with workflow
      const serviceWithWorkflow = new SwapMatchingService(
        mockSwapRepository,
        mockBookingService,
        mockSwapProposalService,
        mockUserRepository,
        mockHederaService,
        mockNotificationService
      );

      // Mock the workflow property
      (serviceWithWorkflow as any).proposalWorkflow = mockProposalWorkflow;

      // Act
      const result = await serviceWithWorkflow.createProposalFromBrowse(mockRequest);

      // Assert
      expect(result).toEqual(mockResult);
      expect(mockProposalWorkflow.createProposalFromBrowse).toHaveBeenCalledWith(mockRequest);
    });

    it('should use fallback implementation when workflow not available', async () => {
      // Arrange
      const mockValidationResult: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        eligibilityChecks: {
          userOwnsSourceSwap: true,
          sourceSwapAvailable: true,
          targetSwapAvailable: true,
          noExistingProposal: true,
          swapsAreCompatible: true
        }
      };

      const mockSourceSwap = { id: 'source-swap-456', sourceBookingId: 'booking-1', ownerId: 'user-789' };
      const mockTargetSwap = { id: 'target-swap-123', sourceBookingId: 'booking-2', ownerId: 'other-user' };
      const mockSwapProposalResult = {
        swap: { id: 'proposal-123' },
        blockchainTransaction: { transactionId: 'tx-123' }
      };

      // Mock validation
      const validateSpy = vi.spyOn(swapMatchingService, 'validateProposalEligibility');
      validateSpy.mockResolvedValue(mockValidationResult);

      mockSwapRepository.findById
        .mockResolvedValueOnce(mockSourceSwap as any)
        .mockResolvedValueOnce(mockTargetSwap as any);
      mockSwapProposalService.createSwapProposal.mockResolvedValue(mockSwapProposalResult as any);

      // Mock private methods
      const recordMetadataSpy = vi.spyOn(swapMatchingService as any, 'recordBrowseProposalMetadata');
      recordMetadataSpy.mockResolvedValue(undefined);
      const getCompatibilityScoreSpy = vi.spyOn(swapMatchingService as any, 'getCompatibilityScore');
      getCompatibilityScoreSpy.mockResolvedValue(75);

      // Act
      const result = await swapMatchingService.createProposalFromBrowse(mockRequest);

      // Assert
      expect(result.proposalId).toBe('proposal-123');
      expect(result.status).toBe('pending_review');
      expect(result.blockchainTransaction.transactionId).toBe('tx-123');
      expect(validateSpy).toHaveBeenCalledWith('user-789', 'source-swap-456', 'target-swap-123');
      expect(mockSwapProposalService.createSwapProposal).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceBookingId: 'booking-1',
          targetBookingId: 'booking-2',
          proposerId: 'user-789',
          terms: expect.objectContaining({
            conditions: ['Flexible dates'],
            additionalPayment: 0
          })
        })
      );
    });

    it('should throw validation error when proposal is invalid', async () => {
      // Arrange
      const mockValidationResult: ValidationResult = {
        isValid: false,
        errors: ['User does not own the source swap'],
        warnings: [],
        eligibilityChecks: {
          userOwnsSourceSwap: false,
          sourceSwapAvailable: true,
          targetSwapAvailable: true,
          noExistingProposal: true,
          swapsAreCompatible: true
        }
      };

      const validateSpy = vi.spyOn(swapMatchingService, 'validateProposalEligibility');
      validateSpy.mockResolvedValue(mockValidationResult);

      // Act & Assert
      await expect(swapMatchingService.createProposalFromBrowse(mockRequest))
        .rejects.toThrow('Proposal validation failed');

      const error = await swapMatchingService.createProposalFromBrowse(mockRequest)
        .catch(e => e as ProposalValidationError);

      expect(error.code).toBe('USER_NOT_AUTHORIZED');
      expect(error.details.reason).toContain('User does not own the source swap');
    });

    it('should handle different validation error types correctly', async () => {
      // Test different error scenarios
      const testCases = [
        {
          eligibilityChecks: { userOwnsSourceSwap: false, sourceSwapAvailable: true, targetSwapAvailable: true, noExistingProposal: true, swapsAreCompatible: true },
          expectedCode: 'USER_NOT_AUTHORIZED'
        },
        {
          eligibilityChecks: { userOwnsSourceSwap: true, sourceSwapAvailable: false, targetSwapAvailable: true, noExistingProposal: true, swapsAreCompatible: true },
          expectedCode: 'INVALID_SOURCE_SWAP'
        },
        {
          eligibilityChecks: { userOwnsSourceSwap: true, sourceSwapAvailable: true, targetSwapAvailable: false, noExistingProposal: true, swapsAreCompatible: true },
          expectedCode: 'INVALID_TARGET_SWAP'
        },
        {
          eligibilityChecks: { userOwnsSourceSwap: true, sourceSwapAvailable: true, targetSwapAvailable: true, noExistingProposal: false, swapsAreCompatible: true },
          expectedCode: 'EXISTING_PROPOSAL'
        }
      ];

      for (const testCase of testCases) {
        const mockValidationResult: ValidationResult = {
          isValid: false,
          errors: ['Test error'],
          warnings: [],
          eligibilityChecks: testCase.eligibilityChecks
        };

        const validateSpy = vi.spyOn(swapMatchingService, 'validateProposalEligibility');
        validateSpy.mockResolvedValue(mockValidationResult);

        try {
          await swapMatchingService.createProposalFromBrowse(mockRequest);
        } catch (error) {
          expect((error as ProposalValidationError).code).toBe(testCase.expectedCode);
        }
      }
    });
  });

  describe('getSwapCompatibility', () => {
    const sourceSwapId = 'source-swap-123';
    const targetSwapId = 'target-swap-456';

    it('should return compatibility with highly_recommended recommendation', async () => {
      // Arrange
      const highCompatibilityAnalysis = { ...mockCompatibilityAnalysis, overallScore: 85 };
      const analyzeSpy = vi.spyOn(swapMatchingService, 'analyzeSwapCompatibility');
      analyzeSpy.mockResolvedValue(highCompatibilityAnalysis);

      // Act
      const result = await swapMatchingService.getSwapCompatibility(sourceSwapId, targetSwapId);

      // Assert
      expect(result.compatibility).toEqual(highCompatibilityAnalysis);
      expect(result.recommendation).toBe('highly_recommended');
    });

    it('should return compatibility with recommended recommendation', async () => {
      // Arrange
      const goodCompatibilityAnalysis = { ...mockCompatibilityAnalysis, overallScore: 70 };
      const analyzeSpy = vi.spyOn(swapMatchingService, 'analyzeSwapCompatibility');
      analyzeSpy.mockResolvedValue(goodCompatibilityAnalysis);

      // Act
      const result = await swapMatchingService.getSwapCompatibility(sourceSwapId, targetSwapId);

      // Assert
      expect(result.compatibility).toEqual(goodCompatibilityAnalysis);
      expect(result.recommendation).toBe('recommended');
    });

    it('should return compatibility with possible recommendation', async () => {
      // Arrange
      const fairCompatibilityAnalysis = { ...mockCompatibilityAnalysis, overallScore: 50 };
      const analyzeSpy = vi.spyOn(swapMatchingService, 'analyzeSwapCompatibility');
      analyzeSpy.mockResolvedValue(fairCompatibilityAnalysis);

      // Act
      const result = await swapMatchingService.getSwapCompatibility(sourceSwapId, targetSwapId);

      // Assert
      expect(result.compatibility).toEqual(fairCompatibilityAnalysis);
      expect(result.recommendation).toBe('possible');
    });

    it('should return compatibility with not_recommended recommendation', async () => {
      // Arrange
      const poorCompatibilityAnalysis = { ...mockCompatibilityAnalysis, overallScore: 25 };
      const analyzeSpy = vi.spyOn(swapMatchingService, 'analyzeSwapCompatibility');
      analyzeSpy.mockResolvedValue(poorCompatibilityAnalysis);

      // Act
      const result = await swapMatchingService.getSwapCompatibility(sourceSwapId, targetSwapId);

      // Assert
      expect(result.compatibility).toEqual(poorCompatibilityAnalysis);
      expect(result.recommendation).toBe('not_recommended');
    });

    it('should throw error when analysis fails', async () => {
      // Arrange
      const analyzeSpy = vi.spyOn(swapMatchingService, 'analyzeSwapCompatibility');
      analyzeSpy.mockRejectedValue(new Error('Analysis failed'));

      // Act & Assert
      await expect(swapMatchingService.getSwapCompatibility(sourceSwapId, targetSwapId))
        .rejects.toThrow('Analysis failed');
    });
  });
});