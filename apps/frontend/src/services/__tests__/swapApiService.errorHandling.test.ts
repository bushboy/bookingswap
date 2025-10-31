import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import {
  SwapPlatformError,
  ValidationError,
  BusinessLogicError,
  ERROR_CODES,
} from '@booking-swap/shared';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

// Mock the SwapApiService module
vi.mock('../swapApiService', async () => {
  const actual = await vi.importActual('../swapApiService');
  return {
    ...actual,
    swapApiService: {
      getEligibleSwaps: vi.fn(),
      createProposal: vi.fn(),
      getSwapCompatibility: vi.fn(),
      isAuthenticated: vi.fn(),
      createAbortController: vi.fn(),
    },
  };
});

import { swapApiService } from '../swapApiService';
const mockSwapApiService = vi.mocked(swapApiService);

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock window.dispatchEvent
const mockDispatchEvent = vi.fn();
Object.defineProperty(window, 'dispatchEvent', {
  value: mockDispatchEvent,
});

describe('SwapApiService - Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue('mock-token');
    mockDispatchEvent.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication Error Handling', () => {
    it('should handle 401 errors and clear tokens', async () => {
      const mockError = {
        response: {
          status: 401,
          data: {
            error: {
              code: 'INVALID_TOKEN',
              message: 'Token expired',
            },
          },
        },
      };

      mockSwapApiService.getEligibleSwaps.mockRejectedValue(mockError);

      await expect(
        swapApiService.getEligibleSwaps('user-1', { targetSwapId: 'swap-1' })
      ).rejects.toThrow(SwapPlatformError);

      // Should clear both possible token keys
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('auth_token');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('auth_user');

      // Should dispatch logout event
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'auth:token-expired',
        })
      );
    });

    it('should handle authentication errors during proposal submission', async () => {
      const mockError = {
        response: {
          status: 401,
          data: {
            error: {
              code: 'INVALID_TOKEN',
              message: 'Authentication required',
            },
          },
        },
      };

      mockSwapApiService.createProposal.mockRejectedValue(mockError);

      const proposalData = {
        sourceSwapId: 'source-1',
        message: 'Test proposal',
        conditions: ['Test condition'],
        agreedToTerms: true,
      };

      await expect(
        swapApiService.createProposal('target-1', proposalData)
      ).rejects.toThrow(SwapPlatformError);

      expect(mockLocalStorage.removeItem).toHaveBeenCalledTimes(3);
      expect(mockDispatchEvent).toHaveBeenCalled();
    });
  });

  describe('Validation Error Handling', () => {
    it('should handle 400 validation errors with field details', async () => {
      const mockError = {
        response: {
          status: 400,
          data: {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request data',
              details: {
                sourceSwapId: ['Source swap ID is required'],
                conditions: ['At least one condition is required'],
              },
            },
          },
        },
      };

      mockAxiosInstance.post.mockRejectedValue(mockError);

      const proposalData = {
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
        expect(error.details).toEqual({
          sourceSwapId: ['Source swap ID is required'],
          conditions: ['At least one condition is required'],
        });
      }
    });

    it('should handle validation errors without field details', async () => {
      const mockError = {
        response: {
          status: 400,
          data: {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid data format',
            },
          },
        },
      };

      mockAxiosInstance.get.mockRejectedValue(mockError);

      try {
        await swapApiService.getEligibleSwaps('user-1', { targetSwapId: 'invalid' });
        expect.fail('Should have thrown ValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toBe('Invalid data format');
        expect(error.details).toBeUndefined();
      }
    });
  });

  describe('Business Logic Error Handling', () => {
    it('should handle 404 swap not found errors', async () => {
      const mockError = {
        response: {
          status: 404,
          data: {
            error: {
              code: 'SWAP_NOT_FOUND',
              message: 'Swap not found',
            },
          },
        },
      };

      mockAxiosInstance.get.mockRejectedValue(mockError);

      try {
        await swapApiService.getEligibleSwaps('user-1', { targetSwapId: 'nonexistent' });
        expect.fail('Should have thrown BusinessLogicError');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessLogicError);
        expect(error.code).toBe(ERROR_CODES.SWAP_NOT_FOUND);
        expect(error.message).toBe('The requested swap was not found');
      }
    });

    it('should handle 409 invalid swap state errors', async () => {
      const mockError = {
        response: {
          status: 409,
          data: {
            error: {
              code: 'INVALID_SWAP_STATE',
              message: 'Swap is no longer available for proposals',
            },
          },
        },
      };

      mockAxiosInstance.post.mockRejectedValue(mockError);

      const proposalData = {
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
        expect(error.message).toBe('Swap is no longer available for proposals');
      }
    });
  });

  describe('Network Error Handling', () => {
    it('should handle network timeout errors', async () => {
      const mockError = {
        request: {},
        message: 'timeout of 15000ms exceeded',
        code: 'ECONNABORTED',
      };

      mockAxiosInstance.get.mockRejectedValue(mockError);

      try {
        await swapApiService.getEligibleSwaps('user-1', { targetSwapId: 'swap-1' });
        expect.fail('Should have thrown SwapPlatformError');
      } catch (error) {
        expect(error).toBeInstanceOf(SwapPlatformError);
        expect(error.code).toBe(ERROR_CODES.NETWORK_ERROR);
        expect(error.message).toBe('Network error. Please check your internet connection.');
        expect(error.retryable).toBe(true);
      }
    });

    it('should handle connection refused errors', async () => {
      const mockError = {
        request: {},
        message: 'connect ECONNREFUSED 127.0.0.1:3001',
        code: 'ECONNREFUSED',
      };

      mockAxiosInstance.post.mockRejectedValue(mockError);

      const proposalData = {
        sourceSwapId: 'source-1',
        conditions: ['Test condition'],
        agreedToTerms: true,
      };

      try {
        await swapApiService.createProposal('target-1', proposalData);
        expect.fail('Should have thrown SwapPlatformError');
      } catch (error) {
        expect(error).toBeInstanceOf(SwapPlatformError);
        expect(error.code).toBe(ERROR_CODES.NETWORK_ERROR);
        expect(error.retryable).toBe(true);
      }
    });
  });

  describe('Rate Limiting Error Handling', () => {
    it('should handle 429 rate limit errors as retryable', async () => {
      const mockError = {
        response: {
          status: 429,
          data: {
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many requests',
            },
          },
        },
      };

      mockAxiosInstance.get.mockRejectedValue(mockError);

      try {
        await swapApiService.getEligibleSwaps('user-1', { targetSwapId: 'swap-1' });
        expect.fail('Should have thrown SwapPlatformError');
      } catch (error) {
        expect(error).toBeInstanceOf(SwapPlatformError);
        expect(error.code).toBe(ERROR_CODES.RATE_LIMIT_EXCEEDED);
        expect(error.message).toBe('Too many requests. Please try again later.');
        expect(error.retryable).toBe(true);
      }
    });

    it('should handle rate limiting during compatibility checks', async () => {
      const mockError = {
        response: {
          status: 429,
          data: {
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Rate limit exceeded for compatibility checks',
            },
          },
        },
      };

      mockAxiosInstance.get.mockRejectedValue(mockError);

      try {
        await swapApiService.getSwapCompatibility('source-1', 'target-1');
        expect.fail('Should have thrown SwapPlatformError');
      } catch (error) {
        expect(error).toBeInstanceOf(SwapPlatformError);
        expect(error.retryable).toBe(true);
      }
    });
  });

  describe('Server Error Handling', () => {
    it('should handle 500 internal server errors as retryable', async () => {
      const mockError = {
        response: {
          status: 500,
          data: {
            error: {
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Internal server error',
            },
          },
        },
      };

      mockAxiosInstance.get.mockRejectedValue(mockError);

      try {
        await swapApiService.getEligibleSwaps('user-1', { targetSwapId: 'swap-1' });
        expect.fail('Should have thrown SwapPlatformError');
      } catch (error) {
        expect(error).toBeInstanceOf(SwapPlatformError);
        expect(error.code).toBe(ERROR_CODES.INTERNAL_SERVER_ERROR);
        expect(error.message).toBe('An unexpected error occurred. Please try again.');
        expect(error.retryable).toBe(true);
      }
    });

    it('should handle 503 service unavailable errors', async () => {
      const mockError = {
        response: {
          status: 503,
          data: {
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Service temporarily unavailable',
            },
          },
        },
      };

      mockAxiosInstance.post.mockRejectedValue(mockError);

      const proposalData = {
        sourceSwapId: 'source-1',
        conditions: ['Test condition'],
        agreedToTerms: true,
      };

      try {
        await swapApiService.createProposal('target-1', proposalData);
        expect.fail('Should have thrown SwapPlatformError');
      } catch (error) {
        expect(error).toBeInstanceOf(SwapPlatformError);
        expect(error.code).toBe(ERROR_CODES.INTERNAL_SERVER_ERROR);
        expect(error.retryable).toBe(true);
      }
    });
  });

  describe('Generic Error Handling', () => {
    it('should handle errors without response or request', async () => {
      const mockError = new Error('Unexpected error occurred');

      mockAxiosInstance.get.mockRejectedValue(mockError);

      try {
        await swapApiService.getEligibleSwaps('user-1', { targetSwapId: 'swap-1' });
        expect.fail('Should have thrown SwapPlatformError');
      } catch (error) {
        expect(error).toBeInstanceOf(SwapPlatformError);
        expect(error.code).toBe(ERROR_CODES.INTERNAL_SERVER_ERROR);
        expect(error.message).toBe('Unexpected error occurred');
      }
    });

    it('should handle errors with empty message', async () => {
      const mockError = new Error('');

      mockAxiosInstance.post.mockRejectedValue(mockError);

      const proposalData = {
        sourceSwapId: 'source-1',
        conditions: ['Test condition'],
        agreedToTerms: true,
      };

      try {
        await swapApiService.createProposal('target-1', proposalData);
        expect.fail('Should have thrown SwapPlatformError');
      } catch (error) {
        expect(error).toBeInstanceOf(SwapPlatformError);
        expect(error.message).toBe('An unexpected error occurred');
      }
    });
  });

  describe('Authorization Error Handling', () => {
    it('should handle 403 forbidden errors', async () => {
      const mockError = {
        response: {
          status: 403,
          data: {
            error: {
              code: 'ACCESS_DENIED',
              message: 'Insufficient permissions',
            },
          },
        },
      };

      mockAxiosInstance.get.mockRejectedValue(mockError);

      try {
        await swapApiService.getEligibleSwaps('user-1', { targetSwapId: 'private-swap' });
        expect.fail('Should have thrown SwapPlatformError');
      } catch (error) {
        expect(error).toBeInstanceOf(SwapPlatformError);
        expect(error.code).toBe(ERROR_CODES.ACCESS_DENIED);
        expect(error.message).toBe('You don\'t have permission to access this resource');
        expect(error.category).toBe('authorization');
      }
    });

    it('should not clear tokens for authorization errors', async () => {
      const mockError = {
        response: {
          status: 403,
          data: {
            error: {
              code: 'ACCESS_DENIED',
              message: 'Access denied',
            },
          },
        },
      };

      mockAxiosInstance.post.mockRejectedValue(mockError);

      const proposalData = {
        sourceSwapId: 'source-1',
        conditions: ['Test condition'],
        agreedToTerms: true,
      };

      try {
        await swapApiService.createProposal('restricted-swap', proposalData);
        expect.fail('Should have thrown SwapPlatformError');
      } catch (error) {
        expect(error).toBeInstanceOf(SwapPlatformError);
        // Should not clear tokens for authorization errors (only authentication errors)
        expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
        expect(mockDispatchEvent).not.toHaveBeenCalled();
      }
    });
  });
});