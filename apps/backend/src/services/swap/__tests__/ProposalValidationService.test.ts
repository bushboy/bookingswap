import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { ProposalValidationService, ProposalValidationContext, DetailedValidationResult } from '../ProposalValidationService';
import { SwapRepository } from '../../../database/repositories/SwapRepository';
import { BookingRepository } from '../../../database/repositories/BookingRepository';
import { CreateProposalFromBrowseRequest, CompatibilityAnalysis } from '@booking-swap/shared';

// Mock dependencies
vi.mock('../../../database/repositories/SwapRepository');
vi.mock('../../../database/repositories/BookingRepository');
vi.mock('../../../utils/proposalErrorHandling', () => ({
  ProposalErrorFactory: {
    createEligibilityError: vi.fn((code, sourceId, targetId, userId, reason) => {
      const error = new Error(reason);
      (error as any).code = code;
      return error;
    })
  },
  PROPOSAL_ERROR_CODES: {
    USER_NOT_AUTHORIZED: 'USER_NOT_AUTHORIZED',
    INVALID_SOURCE_SWAP: 'INVALID_SOURCE_SWAP',
    INVALID_TARGET_SWAP: 'INVALID_TARGET_SWAP',
    EXISTING_PROPOSAL: 'EXISTING_PROPOSAL',
    SWAP_NOT_AVAILABLE: 'SWAP_NOT_AVAILABLE'
  },
  ProposalRateLimiter: {
    checkRateLimit: vi.fn()
  },
  validateProposalRequest: vi.fn()
}));
vi.mock('../../../utils/logger');

describe('ProposalValidationService', () => {
  let validationService: ProposalValidationService;
  let mockSwapRepository: vi.Mocked<SwapRepository>;
  let mockBookingRepository: vi.Mocked<BookingRepository>;

  const mockRequest: CreateProposalFromBrowseRequest = {
    targetSwapId: 'target-swap-123',
    sourceSwapId: 'source-swap-456',
    proposerId: 'user-789',
    message: 'This looks like a great match for both of us!',
    conditions: ['Flexible check-in time', 'Pet-friendly accommodation'],
    agreedToTerms: true
  };

  const mockContext: ProposalValidationContext = {
    userId: 'user-789',
    requestId: 'req-123',
    userAgent: 'Mozilla/5.0',
    ip: '192.168.1.1'
  };

  const mockSourceSwap = {
    id: 'source-swap-456',
    userId: 'user-789',
    status: 'active',
    sourceBookingId: 'booking-1',
    createdAt: new Date()
  };

  const mockTargetSwap = {
    id: 'target-swap-123',
    userId: 'other-user-123',
    status: 'active',
    sourceBookingId: 'booking-2',
    createdAt: new Date()
  };

  const mockCompatibilityAnalysis: CompatibilityAnalysis = {
    overallScore: 75,
    factors: {
      locationCompatibility: { score: 80, weight: 0.25, details: 'Good match', status: 'good' },
      dateCompatibility: { score: 70, weight: 0.20, details: 'Similar duration', status: 'good' },
      valueCompatibility: { score: 85, weight: 0.30, details: 'Well matched', status: 'excellent' },
      accommodationCompatibility: { score: 60, weight: 0.15, details: 'Compatible types', status: 'fair' },
      guestCompatibility: { score: 90, weight: 0.10, details: 'Perfect match', status: 'excellent' }
    },
    recommendations: ['Great overall match'],
    potentialIssues: []
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockSwapRepository = vi.mocked(new SwapRepository({} as any));
    mockBookingRepository = vi.mocked(new BookingRepository({} as any));

    validationService = new ProposalValidationService(
      mockSwapRepository,
      mockBookingRepository
    );
  });

  describe('validateProposalRequest', () => {
    it('should return valid result when all validations pass', async () => {
      // Arrange
      mockSwapRepository.findById
        .mockResolvedValueOnce(mockSourceSwap as any)
        .mockResolvedValueOnce(mockTargetSwap as any);
      mockSwapRepository.findExistingProposal.mockResolvedValue(null);
      mockSwapRepository.findByIdWithBookingDetails
        .mockResolvedValueOnce({ ...mockSourceSwap, booking: { estimatedValue: 500 } } as any)
        .mockResolvedValueOnce({ ...mockTargetSwap, booking: { estimatedValue: 550 } } as any);
      mockSwapRepository.getUserRecentProposals.mockResolvedValue([]);

      // Mock private methods
      const calculateCompatibilitySpy = vi.spyOn(validationService as any, 'calculateCompatibilityAnalysis');
      calculateCompatibilitySpy.mockResolvedValue(mockCompatibilityAnalysis);
      const getUserAccountStatusSpy = vi.spyOn(validationService as any, 'getUserAccountStatus');
      getUserAccountStatusSpy.mockResolvedValue({ isRestricted: false, hasWarnings: false });

      // Act
      const result = await validationService.validateProposalRequest(mockRequest, mockContext);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.eligibilityChecks.userOwnsSourceSwap).toBe(true);
      expect(result.eligibilityChecks.sourceSwapAvailable).toBe(true);
      expect(result.eligibilityChecks.targetSwapAvailable).toBe(true);
      expect(result.eligibilityChecks.noExistingProposal).toBe(true);
      expect(result.eligibilityChecks.swapsAreCompatible).toBe(true);
      expect(result.compatibilityAnalysis).toEqual(mockCompatibilityAnalysis);
    });

    it('should return invalid result when user does not own source swap', async () => {
      // Arrange
      const wrongOwnerSwap = { ...mockSourceSwap, userId: 'different-user' };
      mockSwapRepository.findById.mockResolvedValueOnce(wrongOwnerSwap as any);

      // Act
      const result = await validationService.validateProposalRequest(mockRequest, mockContext);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('You do not own the source swap');
      expect(result.eligibilityChecks.userOwnsSourceSwap).toBe(false);
    });

    it('should return invalid result when source swap is not active', async () => {
      // Arrange
      const inactiveSwap = { ...mockSourceSwap, status: 'completed' };
      mockSwapRepository.findById.mockResolvedValueOnce(inactiveSwap as any);

      // Act
      const result = await validationService.validateProposalRequest(mockRequest, mockContext);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Source swap is not available for proposals');
      expect(result.eligibilityChecks.sourceSwapAvailable).toBe(false);
    });

    it('should return invalid result when target swap not found', async () => {
      // Arrange
      mockSwapRepository.findById
        .mockResolvedValueOnce(mockSourceSwap as any)
        .mockResolvedValueOnce(null);

      // Act
      const result = await validationService.validateProposalRequest(mockRequest, mockContext);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Target swap not found or no longer available');
      expect(result.eligibilityChecks.targetSwapAvailable).toBe(false);
    });

    it('should return invalid result when trying to propose to own swap', async () => {
      // Arrange
      const ownTargetSwap = { ...mockTargetSwap, userId: 'user-789' };
      mockSwapRepository.findById
        .mockResolvedValueOnce(mockSourceSwap as any)
        .mockResolvedValueOnce(ownTargetSwap as any);

      // Act
      const result = await validationService.validateProposalRequest(mockRequest, mockContext);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Cannot make a proposal to your own swap');
    });

    it('should return invalid result when existing proposal exists', async () => {
      // Arrange
      mockSwapRepository.findById
        .mockResolvedValueOnce(mockSourceSwap as any)
        .mockResolvedValueOnce(mockTargetSwap as any);
      mockSwapRepository.findExistingProposal.mockResolvedValue({ id: 'existing-proposal' } as any);

      // Act
      const result = await validationService.validateProposalRequest(mockRequest, mockContext);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('A proposal between these swaps already exists');
      expect(result.eligibilityChecks.noExistingProposal).toBe(false);
    });

    it('should add warnings for low compatibility score', async () => {
      // Arrange
      const lowCompatibilityAnalysis = { ...mockCompatibilityAnalysis, overallScore: 25 };
      
      mockSwapRepository.findById
        .mockResolvedValueOnce(mockSourceSwap as any)
        .mockResolvedValueOnce(mockTargetSwap as any);
      mockSwapRepository.findExistingProposal.mockResolvedValue(null);
      mockSwapRepository.findByIdWithBookingDetails
        .mockResolvedValueOnce({ ...mockSourceSwap, booking: { estimatedValue: 500 } } as any)
        .mockResolvedValueOnce({ ...mockTargetSwap, booking: { estimatedValue: 550 } } as any);
      mockSwapRepository.getUserRecentProposals.mockResolvedValue([]);

      const calculateCompatibilitySpy = vi.spyOn(validationService as any, 'calculateCompatibilityAnalysis');
      calculateCompatibilitySpy.mockResolvedValue(lowCompatibilityAnalysis);
      const getUserAccountStatusSpy = vi.spyOn(validationService as any, 'getUserAccountStatus');
      getUserAccountStatusSpy.mockResolvedValue({ isRestricted: false, hasWarnings: false });

      // Act
      const result = await validationService.validateProposalRequest(mockRequest, mockContext);

      // Assert
      expect(result.isValid).toBe(true); // Still valid, just warnings
      expect(result.warnings).toContain('Very low compatibility score (25%)');
      expect(result.riskFactors.some(rf => rf.type === 'high')).toBe(true);
    });

    it('should handle compatibility analysis failure gracefully', async () => {
      // Arrange
      mockSwapRepository.findById
        .mockResolvedValueOnce(mockSourceSwap as any)
        .mockResolvedValueOnce(mockTargetSwap as any);
      mockSwapRepository.findExistingProposal.mockResolvedValue(null);
      mockSwapRepository.findByIdWithBookingDetails
        .mockResolvedValueOnce(null) // Simulate failure to get booking details
        .mockResolvedValueOnce(null);
      mockSwapRepository.getUserRecentProposals.mockResolvedValue([]);

      const getUserAccountStatusSpy = vi.spyOn(validationService as any, 'getUserAccountStatus');
      getUserAccountStatusSpy.mockResolvedValue({ isRestricted: false, hasWarnings: false });

      // Act
      const result = await validationService.validateProposalRequest(mockRequest, mockContext);

      // Assert
      expect(result.isValid).toBe(true); // Should still be valid
      expect(result.warnings).toContain('Unable to analyze compatibility - swap details unavailable');
    });

    it('should validate message content and reject inappropriate content', async () => {
      // Arrange
      const inappropriateRequest = {
        ...mockRequest,
        message: 'Contact me at john@example.com or call 555-1234'
      };

      mockSwapRepository.findById
        .mockResolvedValueOnce(mockSourceSwap as any)
        .mockResolvedValueOnce(mockTargetSwap as any);

      // Act
      const result = await validationService.validateProposalRequest(inappropriateRequest, mockContext);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Message contains inappropriate content');
    });

    it('should validate message length', async () => {
      // Arrange
      const longMessageRequest = {
        ...mockRequest,
        message: 'A'.repeat(501) // Exceeds 500 character limit
      };

      mockSwapRepository.findById
        .mockResolvedValueOnce(mockSourceSwap as any)
        .mockResolvedValueOnce(mockTargetSwap as any);

      // Act
      const result = await validationService.validateProposalRequest(longMessageRequest, mockContext);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Message exceeds maximum length of 500 characters');
    });

    it('should validate conditions', async () => {
      // Arrange
      const tooManyConditionsRequest = {
        ...mockRequest,
        conditions: Array(11).fill('Condition') // Exceeds 10 condition limit
      };

      mockSwapRepository.findById
        .mockResolvedValueOnce(mockSourceSwap as any)
        .mockResolvedValueOnce(mockTargetSwap as any);

      // Act
      const result = await validationService.validateProposalRequest(tooManyConditionsRequest, mockContext);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Too many conditions specified (maximum 10)');
    });

    it('should detect spam patterns in message', async () => {
      // Arrange
      const spamRequest = {
        ...mockRequest,
        message: 'URGENT!!! LIMITED TIME OFFER!!! GUARANTEED AMAZING DEAL!!!'
      };

      mockSwapRepository.findById
        .mockResolvedValueOnce(mockSourceSwap as any)
        .mockResolvedValueOnce(mockTargetSwap as any);
      mockSwapRepository.findExistingProposal.mockResolvedValue(null);
      mockSwapRepository.getUserRecentProposals.mockResolvedValue([]);

      const getUserAccountStatusSpy = vi.spyOn(validationService as any, 'getUserAccountStatus');
      getUserAccountStatusSpy.mockResolvedValue({ isRestricted: false, hasWarnings: false });

      // Act
      const result = await validationService.validateProposalRequest(spamRequest, mockContext);

      // Assert
      expect(result.warnings).toContain('Message may appear promotional or spam-like');
    });

    it('should check business rules and warn about high proposal activity', async () => {
      // Arrange
      const manyRecentProposals = Array(11).fill({ id: 'proposal', targetOwnerId: 'different-user' });
      
      mockSwapRepository.findById
        .mockResolvedValueOnce(mockSourceSwap as any)
        .mockResolvedValueOnce(mockTargetSwap as any);
      mockSwapRepository.findExistingProposal.mockResolvedValue(null);
      mockSwapRepository.getUserRecentProposals.mockResolvedValue(manyRecentProposals as any);

      const getUserAccountStatusSpy = vi.spyOn(validationService as any, 'getUserAccountStatus');
      getUserAccountStatusSpy.mockResolvedValue({ isRestricted: false, hasWarnings: false });

      // Act
      const result = await validationService.validateProposalRequest(mockRequest, mockContext);

      // Assert
      expect(result.warnings).toContain('High proposal activity detected - ensure quality over quantity');
    });

    it('should warn about multiple proposals to same user', async () => {
      // Arrange
      const proposalsToSameUser = Array(4).fill({ id: 'proposal', targetOwnerId: 'other-user-123' });
      
      mockSwapRepository.findById
        .mockResolvedValueOnce(mockSourceSwap as any)
        .mockResolvedValueOnce(mockTargetSwap as any);
      mockSwapRepository.findExistingProposal.mockResolvedValue(null);
      mockSwapRepository.getUserRecentProposals.mockResolvedValue(proposalsToSameUser as any);

      const getUserAccountStatusSpy = vi.spyOn(validationService as any, 'getUserAccountStatus');
      getUserAccountStatusSpy.mockResolvedValue({ isRestricted: false, hasWarnings: false });

      // Act
      const result = await validationService.validateProposalRequest(mockRequest, mockContext);

      // Assert
      expect(result.warnings).toContain('Multiple recent proposals to the same user may appear excessive');
    });

    it('should reject proposals from restricted accounts', async () => {
      // Arrange
      mockSwapRepository.findById
        .mockResolvedValueOnce(mockSourceSwap as any)
        .mockResolvedValueOnce(mockTargetSwap as any);
      mockSwapRepository.findExistingProposal.mockResolvedValue(null);
      mockSwapRepository.getUserRecentProposals.mockResolvedValue([]);

      const getUserAccountStatusSpy = vi.spyOn(validationService as any, 'getUserAccountStatus');
      getUserAccountStatusSpy.mockResolvedValue({ isRestricted: true, hasWarnings: false });

      // Act
      const result = await validationService.validateProposalRequest(mockRequest, mockContext);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Account is restricted from creating proposals');
    });

    it('should generate appropriate recommendations', async () => {
      // Arrange
      const shortMessageRequest = { ...mockRequest, message: 'Hi' };
      
      mockSwapRepository.findById
        .mockResolvedValueOnce(mockSourceSwap as any)
        .mockResolvedValueOnce(mockTargetSwap as any);
      mockSwapRepository.findExistingProposal.mockResolvedValue(null);
      mockSwapRepository.findByIdWithBookingDetails
        .mockResolvedValueOnce({ ...mockSourceSwap, booking: { estimatedValue: 500 } } as any)
        .mockResolvedValueOnce({ ...mockTargetSwap, booking: { estimatedValue: 550 } } as any);
      mockSwapRepository.getUserRecentProposals.mockResolvedValue([]);

      const calculateCompatibilitySpy = vi.spyOn(validationService as any, 'calculateCompatibilityAnalysis');
      calculateCompatibilitySpy.mockResolvedValue(mockCompatibilityAnalysis);
      const getUserAccountStatusSpy = vi.spyOn(validationService as any, 'getUserAccountStatus');
      getUserAccountStatusSpy.mockResolvedValue({ isRestricted: false, hasWarnings: false });

      // Act
      const result = await validationService.validateProposalRequest(shortMessageRequest, mockContext);

      // Assert
      expect(result.recommendations).toContain('Consider adding a personal message to explain why this swap would work well');
    });

    it('should handle validation errors gracefully', async () => {
      // Arrange
      mockSwapRepository.findById.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await validationService.validateProposalRequest(mockRequest, mockContext);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Content Validation', () => {
    it('should detect phone numbers in message', () => {
      // Arrange
      const phoneRequest = { ...mockRequest, message: 'Call me at 555-123-4567' };
      const containsInappropriateSpy = vi.spyOn(validationService as any, 'containsInappropriateContent');

      // Act
      const result = containsInappropriateSpy(phoneRequest.message);

      // Assert
      expect(result).toBe(true);
    });

    it('should detect email addresses in message', () => {
      // Arrange
      const emailRequest = { ...mockRequest, message: 'Email me at test@example.com' };
      const containsInappropriateSpy = vi.spyOn(validationService as any, 'containsInappropriateContent');

      // Act
      const result = containsInappropriateSpy(emailRequest.message);

      // Assert
      expect(result).toBe(true);
    });

    it('should detect messaging app references', () => {
      // Arrange
      const messagingRequest = { ...mockRequest, message: 'Contact me on WhatsApp' };
      const containsInappropriateSpy = vi.spyOn(validationService as any, 'containsInappropriateContent');

      // Act
      const result = containsInappropriateSpy(messagingRequest.message);

      // Assert
      expect(result).toBe(true);
    });

    it('should detect spam patterns', () => {
      // Arrange
      const spamMessages = [
        'URGENT LIMITED TIME OFFER!!!',
        'GUARANTEED 100% AMAZING DEAL',
        'AAAAAAAAA', // Repeated characters
        'THIS IS ALL CAPS MESSAGE' // Too many capitals
      ];

      const containsSpamSpy = vi.spyOn(validationService as any, 'containsSpamPatterns');

      // Act & Assert
      spamMessages.forEach(message => {
        const result = containsSpamSpy(message);
        expect(result).toBe(true);
      });
    });

    it('should allow appropriate content', () => {
      // Arrange
      const appropriateMessage = 'This looks like a great match for both of us! I love the location and dates work perfectly.';
      const containsInappropriateSpy = vi.spyOn(validationService as any, 'containsInappropriateContent');
      const containsSpamSpy = vi.spyOn(validationService as any, 'containsSpamPatterns');

      // Act
      const hasInappropriate = containsInappropriateSpy(appropriateMessage);
      const hasSpam = containsSpamSpy(appropriateMessage);

      // Assert
      expect(hasInappropriate).toBe(false);
      expect(hasSpam).toBe(false);
    });
  });

  describe('Compatibility Analysis', () => {
    it('should calculate location compatibility correctly', () => {
      // Arrange
      const calculateLocationSpy = vi.spyOn(validationService as any, 'calculateLocationCompatibility');

      // Act
      const sameLocation = calculateLocationSpy('Paris, France', 'Paris, France');
      const differentLocation = calculateLocationSpy('Paris, France', 'Tokyo, Japan');

      // Assert
      expect(sameLocation).toBeGreaterThan(differentLocation);
      expect(sameLocation).toBeGreaterThan(80);
      expect(differentLocation).toBeLessThan(80);
    });

    it('should calculate value compatibility correctly', () => {
      // Arrange
      const calculateValueSpy = vi.spyOn(validationService as any, 'calculateValueCompatibility');

      // Act
      const similarValues = calculateValueSpy(500, 510); // 2% difference
      const differentValues = calculateValueSpy(500, 1000); // 100% difference

      // Assert
      expect(similarValues).toBeGreaterThan(differentValues);
      expect(similarValues).toBeGreaterThan(80);
      expect(differentValues).toBeLessThan(80);
    });

    it('should calculate accommodation compatibility correctly', () => {
      // Arrange
      const calculateAccommodationSpy = vi.spyOn(validationService as any, 'calculateAccommodationCompatibility');

      // Act
      const sameType = calculateAccommodationSpy('hotel', 'hotel');
      const similarType = calculateAccommodationSpy('hotel', 'resort');
      const differentType = calculateAccommodationSpy('hotel', 'hostel');

      // Assert
      expect(sameType).toBe(100);
      expect(similarType).toBeGreaterThan(differentType);
      expect(similarType).toBeGreaterThan(60);
      expect(differentType).toBeLessThan(60);
    });

    it('should calculate guest compatibility correctly', () => {
      // Arrange
      const calculateGuestSpy = vi.spyOn(validationService as any, 'calculateGuestCompatibility');

      // Act
      const sameGuests = calculateGuestSpy(2, 2);
      const similarGuests = calculateGuestSpy(2, 3);
      const differentGuests = calculateGuestSpy(2, 10);

      // Assert
      expect(sameGuests).toBe(100);
      expect(similarGuests).toBeGreaterThan(differentGuests);
      expect(similarGuests).toBeGreaterThan(60);
      expect(differentGuests).toBeLessThan(60);
    });
  });

  describe('String Similarity', () => {
    it('should calculate string similarity correctly', () => {
      // Arrange
      const calculateSimilaritySpy = vi.spyOn(validationService as any, 'calculateStringSimilarity');

      // Act
      const identical = calculateSimilaritySpy('Paris', 'Paris');
      const similar = calculateSimilaritySpy('Paris', 'Pairs');
      const different = calculateSimilaritySpy('Paris', 'Tokyo');

      // Assert
      expect(identical).toBe(1.0);
      expect(similar).toBeGreaterThan(different);
      expect(similar).toBeGreaterThan(0.5);
      expect(different).toBeLessThan(0.5);
    });

    it('should calculate Levenshtein distance correctly', () => {
      // Arrange
      const levenshteinSpy = vi.spyOn(validationService as any, 'levenshteinDistance');

      // Act
      const identical = levenshteinSpy('test', 'test');
      const oneChange = levenshteinSpy('test', 'best');
      const moreChanges = levenshteinSpy('test', 'completely different');

      // Assert
      expect(identical).toBe(0);
      expect(oneChange).toBe(1);
      expect(moreChanges).toBeGreaterThan(oneChange);
    });
  });
});