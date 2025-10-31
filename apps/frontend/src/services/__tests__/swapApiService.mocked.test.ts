import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SwapPlatformError,
  ValidationError,
  BusinessLogicError,
  ERROR_CODES,
} from '@booking-swap/shared';
import type {
  EligibleSwapResponse,
  CreateProposalRequest,
  ProposalResponse,
  CompatibilityAnalysis,
} from '../../types/api';

// Mock the entire SwapApiService module
vi.mock('../swapApiService', () => ({
  swapApiService: {
    getEligibleSwaps: vi.fn(),
    createProposal: vi.fn(),
    getSwapCompatibility: vi.fn(),
    isAuthenticated: vi.fn(),
    createAbortController: vi.fn(),
    makeRequest: vi.fn(),
  },
}));

import { swapApiService } from '../swapApiService';
const mockSwapApiService = vi.mocked(swapApiService);

describe('SwapApiService - Mocked Error Handling Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Network Error Scenarios', () => {
    it('should handle network timeout errors', async () => {
      const networkError = new SwapPlatformError(
        ERROR_CODES.NETWORK_ERROR,
        'Network timeout',
        'integration',
        true
      );

      mockSwapApiService.getEligibleSwaps.mockRejectedValue(networkError);

      await expect(
        swapApiService.getEligibleSwaps('user-1', { targetSwapId: 'swap-1' })
      ).rejects.toThrow(SwapPlatformError);

      expect(mockSwapApiService.getEligibleSwaps).toHaveBeenCalledWith(
        'user-1',
        { targetSwapId: 'swap-1' }
      );
    });

    it('should handle connection refused errors', async () => {
      const connectionError = new SwapPlatformError(
        ERROR_CODES.NETWORK_ERROR,
        'Connection refused',
        'integration',
        true
      );

      mockSwapApiService.createProposal.mockRejectedValue(connectionError);

      const proposalData: CreateProposalRequest = {
        sourceSwapId: 'source-1',
        conditions: ['Test condition'],
        agreedToTerms: true,
      };

      await expect(
        swapApiService.createProposal('target-1', proposalData)
      ).rejects.toThrow(SwapPlatformError);

      expect(mockSwapApiService.createProposal).toHaveBeenCalledWith(
        'target-1',
        proposalData
      );
    });

    it('should handle network errors as retryable', async () => {
      const networkError = new SwapPlatformError(
        ERROR_CODES.NETWORK_ERROR,
        'Network error',
        'integration',
        true
      );

      mockSwapApiService.getSwapCompatibility.mockRejectedValue(networkError);

      try {
        await swapApiService.getSwapCompatibility('source-1', 'target-1');
        expect.fail('Should have thrown network error');
      } catch (error) {
        expect(error).toBeInstanceOf(SwapPlatformError);
        expect(error.retryable).toBe(true);
      }
    });
  });

  describe('Authentication Error Scenarios', () => {
    it('should handle expired token errors', async () => {
      const authError = new SwapPlatformError(
        ERROR_CODES.INVALID_TOKEN,
        'Token expired',
        'authentication',
        false
      );

      mockSwapApiService.getEligibleSwaps.mockRejectedValue(authError);

      try {
        await swapApiService.getEligibleSwaps('user-1', { targetSwapId: 'swap-1' });
        expect.fail('Should have thrown authentication error');
      } catch (error) {
        expect(error).toBeInstanceOf(SwapPlatformError);
        expect(error.code).toBe(ERROR_CODES.INVALID_TOKEN);
        expect(error.category).toBe('authentication');
        expect(error.retryable).toBe(false);
      }
    });

    it('should handle invalid credentials during proposal submission', async () => {
      const authError = new SwapPlatformError(
        ERROR_CODES.INVALID_TOKEN,
        'Invalid credentials',
        'authentication',
        false
      );

      mockSwapApiService.createProposal.mockRejectedValue(authError);

      const proposalData: CreateProposalRequest = {
        sourceSwapId: 'source-1',
        conditions: ['Test condition'],
        agreedToTerms: true,
      };

      await expect(
        swapApiService.createProposal('target-1', proposalData)
      ).rejects.toThrow(SwapPlatformError);
    });
  });

  describe('Authorization Error Scenarios', () => {
    it('should handle access denied errors', async () => {
      const authzError = new SwapPlatformError(
        ERROR_CODES.ACCESS_DENIED,
        'Access denied',
        'authorization',
        false
      );

      mockSwapApiService.getEligibleSwaps.mockRejectedValue(authzError);

      try {
        await swapApiService.getEligibleSwaps('user-1', { targetSwapId: 'private-swap' });
        expect.fail('Should have thrown authorization error');
      } catch (error) {
        expect(error).toBeInstanceOf(SwapPlatformError);
        expect(error.code).toBe(ERROR_CODES.ACCESS_DENIED);
        expect(error.category).toBe('authorization');
        expect(error.retryable).toBe(false);
      }
    });

    it('should handle forbidden proposal creation', async () => {
      const authzError = new SwapPlatformError(
        ERROR_CODES.ACCESS_DENIED,
        'Cannot propose to own swap',
        'authorization',
        false
      );

      mockSwapApiService.createProposal.mockRejectedValue(authzError);

      const proposalData: CreateProposalRequest = {
        sourceSwapId: 'source-1',
        conditions: ['Test condition'],
        agreedToTerms: true,
      };

      await expect(
        swapApiService.createProposal('own-swap', proposalData)
      ).rejects.toThrow(SwapPlatformError);
    });
  });

  describe('Validation Error Scenarios', () => {
    it('should handle validation errors with field details', async () => {
      const validationError = new ValidationError(
        'Invalid request data',
        {
          sourceSwapId: ['Source swap ID is required'],
          conditions: ['At least one condition is required'],
        }
      );

      mockSwapApiService.createProposal.mockRejectedValue(validationError);

      const proposalData: CreateProposalRequest = {
        sourceSwapId: '',
        conditions: [],
        agreedToTerms: true,
      };

      try {
        await swapApiService.createProposal('target-1', proposalData);
        expect.fail('Should have thrown ValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toBe('Invalid request data');
        expect(error.context?.metadata).toEqual({
          sourceSwapId: ['Source swap ID is required'],
          conditions: ['At least one condition is required'],
        });
      }
    });

    it('should handle validation errors without field details', async () => {
      const validationError = new ValidationError('Invalid data format');

      mockSwapApiService.getEligibleSwaps.mockRejectedValue(validationError);

      try {
        await swapApiService.getEligibleSwaps('user-1', { targetSwapId: 'invalid' });
        expect.fail('Should have thrown ValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toBe('Invalid data format');
        expect(error.context?.metadata).toEqual({});
      }
    });
  });

  describe('Business Logic Error Scenarios', () => {
    it('should handle swap not found errors', async () => {
      const notFoundError = new BusinessLogicError(
        ERROR_CODES.SWAP_NOT_FOUND,
        'Swap not found'
      );

      mockSwapApiService.getEligibleSwaps.mockRejectedValue(notFoundError);

      try {
        await swapApiService.getEligibleSwaps('user-1', { targetSwapId: 'nonexistent' });
        expect.fail('Should have thrown BusinessLogicError');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessLogicError);
        expect(error.code).toBe(ERROR_CODES.SWAP_NOT_FOUND);
      }
    });

    it('should handle invalid swap state errors', async () => {
      const invalidStateError = new BusinessLogicError(
        ERROR_CODES.INVALID_SWAP_STATE,
        'Swap is no longer available for proposals'
      );

      mockSwapApiService.createProposal.mockRejectedValue(invalidStateError);

      const proposalData: CreateProposalRequest = {
        sourceSwapId: 'source-1',
        conditions: ['Test condition'],
        agreedToTerms: true,
      };

      try {
        await swapApiService.createProposal('unavailable-swap', proposalData);
        expect.fail('Should have thrown BusinessLogicError');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessLogicError);
        expect(error.code).toBe(ERROR_CODES.INVALID_SWAP_STATE);
      }
    });
  });

  describe('Rate Limiting Error Scenarios', () => {
    it('should handle rate limit errors as retryable', async () => {
      const rateLimitError = new SwapPlatformError(
        ERROR_CODES.RATE_LIMIT_EXCEEDED,
        'Too many requests',
        'rate_limiting',
        true
      );

      mockSwapApiService.getEligibleSwaps.mockRejectedValue(rateLimitError);

      try {
        await swapApiService.getEligibleSwaps('user-1', { targetSwapId: 'swap-1' });
        expect.fail('Should have thrown SwapPlatformError');
      } catch (error) {
        expect(error).toBeInstanceOf(SwapPlatformError);
        expect(error.code).toBe(ERROR_CODES.RATE_LIMIT_EXCEEDED);
        expect(error.retryable).toBe(true);
      }
    });

    it('should handle rate limiting during compatibility checks', async () => {
      const rateLimitError = new SwapPlatformError(
        ERROR_CODES.RATE_LIMIT_EXCEEDED,
        'Rate limit exceeded for compatibility checks',
        'rate_limiting',
        true
      );

      mockSwapApiService.getSwapCompatibility.mockRejectedValue(rateLimitError);

      await expect(
        swapApiService.getSwapCompatibility('source-1', 'target-1')
      ).rejects.toThrow(SwapPlatformError);
    });
  });

  describe('Server Error Scenarios', () => {
    it('should handle internal server errors as retryable', async () => {
      const serverError = new SwapPlatformError(
        ERROR_CODES.INTERNAL_SERVER_ERROR,
        'Internal server error',
        'server_error',
        true
      );

      mockSwapApiService.getEligibleSwaps.mockRejectedValue(serverError);

      try {
        await swapApiService.getEligibleSwaps('user-1', { targetSwapId: 'swap-1' });
        expect.fail('Should have thrown SwapPlatformError');
      } catch (error) {
        expect(error).toBeInstanceOf(SwapPlatformError);
        expect(error.code).toBe(ERROR_CODES.INTERNAL_SERVER_ERROR);
        expect(error.retryable).toBe(true);
      }
    });

    it('should handle service unavailable errors', async () => {
      const serviceError = new SwapPlatformError(
        ERROR_CODES.SERVICE_UNAVAILABLE,
        'Service temporarily unavailable',
        'server_error',
        true
      );

      mockSwapApiService.createProposal.mockRejectedValue(serviceError);

      const proposalData: CreateProposalRequest = {
        sourceSwapId: 'source-1',
        conditions: ['Test condition'],
        agreedToTerms: true,
      };

      await expect(
        swapApiService.createProposal('target-1', proposalData)
      ).rejects.toThrow(SwapPlatformError);
    });
  });

  describe('Successful API Calls', () => {
    it('should successfully fetch eligible swaps', async () => {
      const mockResponse: EligibleSwapResponse = {
        swaps: [
          {
            id: 'swap-1',
            title: 'Test Swap',
            bookingDetails: {
              location: 'Test Location',
              dateRange: {
                checkIn: new Date('2024-06-01'),
                checkOut: new Date('2024-06-07'),
              },
              accommodationType: 'Hotel',
              guests: 2,
              estimatedValue: 500,
            },
            compatibilityScore: 85,
            eligibilityReasons: ['Good match'],
            isEligible: true,
          },
        ],
        totalCount: 1,
        compatibilityThreshold: 60,
      };

      mockSwapApiService.getEligibleSwaps.mockResolvedValue(mockResponse);

      const result = await swapApiService.getEligibleSwaps('user-1', { targetSwapId: 'swap-1' });

      expect(result).toEqual(mockResponse);
      expect(mockSwapApiService.getEligibleSwaps).toHaveBeenCalledWith(
        'user-1',
        { targetSwapId: 'swap-1' }
      );
    });

    it('should successfully create proposal', async () => {
      const mockResponse: ProposalResponse = {
        proposalId: 'proposal-123',
        status: 'pending',
        estimatedResponseTime: '24 hours',
      };

      mockSwapApiService.createProposal.mockResolvedValue(mockResponse);

      const proposalData: CreateProposalRequest = {
        sourceSwapId: 'source-1',
        conditions: ['Test condition'],
        agreedToTerms: true,
      };

      const result = await swapApiService.createProposal('target-1', proposalData);

      expect(result).toEqual(mockResponse);
      expect(mockSwapApiService.createProposal).toHaveBeenCalledWith('target-1', proposalData);
    });

    it('should successfully get compatibility analysis', async () => {
      const mockResponse: CompatibilityAnalysis = {
        score: 88,
        reasons: ['Excellent location match', 'Perfect date overlap'],
        isEligible: true,
      };

      mockSwapApiService.getSwapCompatibility.mockResolvedValue(mockResponse);

      const result = await swapApiService.getSwapCompatibility('source-1', 'target-1');

      expect(result).toEqual(mockResponse);
      expect(mockSwapApiService.getSwapCompatibility).toHaveBeenCalledWith('source-1', 'target-1');
    });
  });

  describe('Authentication Status', () => {
    it('should check authentication status correctly', () => {
      mockSwapApiService.isAuthenticated.mockReturnValue(true);
      expect(swapApiService.isAuthenticated()).toBe(true);

      mockSwapApiService.isAuthenticated.mockReturnValue(false);
      expect(swapApiService.isAuthenticated()).toBe(false);
    });
  });

  describe('Request Cancellation', () => {
    it('should create abort controller', () => {
      const mockController = new AbortController();
      mockSwapApiService.createAbortController.mockReturnValue(mockController);

      const controller = swapApiService.createAbortController();
      expect(controller).toBeInstanceOf(AbortController);
    });

    it('should handle aborted requests', async () => {
      const abortError = new Error('AbortError');
      abortError.name = 'AbortError';

      mockSwapApiService.getEligibleSwaps.mockRejectedValue(abortError);

      try {
        await swapApiService.getEligibleSwaps('user-1', { targetSwapId: 'swap-1' });
        expect.fail('Should have thrown AbortError');
      } catch (error) {
        expect(error.name).toBe('AbortError');
      }
    });
  });
});