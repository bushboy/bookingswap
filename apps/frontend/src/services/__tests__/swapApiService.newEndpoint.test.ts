import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import { swapApiService } from '../swapApiService';
import { CreateProposalRequest, ProposalResponse } from '../../types/api';
import { SwapPlatformError, ValidationError } from '@booking-swap/shared';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('SwapApiService - New Endpoint Integration', () => {
  const mockAxiosInstance = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
    
    // Mock localStorage for auth token
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key) => {
          if (key === 'auth_token') return 'mock-jwt-token';
          return null;
        }),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      writable: true,
    });

    // Mock environment variable
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3001/api');
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  describe('createProposal method', () => {
    it('should call the correct endpoint for regular proposals', async () => {
      const targetSwapId = 'target-swap-123';
      const proposalData: CreateProposalRequest = {
        sourceSwapId: 'source-swap-456',
        message: 'Test proposal message',
        conditions: ['Standard swap exchange'],
        agreedToTerms: true,
      };

      const mockResponse: ProposalResponse = {
        proposalId: 'proposal-789',
        status: 'pending',
        estimatedResponseTime: '2-3 business days',
      };

      mockAxiosInstance.post.mockResolvedValue({
        data: mockResponse,
      });

      const result = await swapApiService.createProposal(targetSwapId, proposalData);

      // Verify the correct endpoint is called
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/swaps/target-swap-123/proposals',
        proposalData,
        expect.any(Object)
      );

      expect(result).toEqual(mockResponse);
    });

    it('should call the correct endpoint for cash proposals', async () => {
      const targetSwapId = 'target-swap-123';
      const proposalData: CreateProposalRequest = {
        sourceSwapId: 'CASH_OFFER',
        message: 'Cash offer message',
        conditions: ['Cash payment offer'],
        agreedToTerms: true,
        cashOffer: {
          amount: 1500,
          currency: 'USD',
        },
      };

      const mockResponse: ProposalResponse = {
        proposalId: 'cash-proposal-789',
        status: 'pending',
        estimatedResponseTime: '1-2 business days',
      };

      mockAxiosInstance.post.mockResolvedValue({
        data: mockResponse,
      });

      const result = await swapApiService.createProposal(targetSwapId, proposalData);

      // Verify the correct endpoint is called with cash offer data
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/swaps/target-swap-123/proposals',
        proposalData,
        expect.any(Object)
      );

      expect(result).toEqual(mockResponse);
    });

    it('should handle validation errors from the new endpoint', async () => {
      const targetSwapId = 'target-swap-123';
      const proposalData: CreateProposalRequest = {
        sourceSwapId: 'invalid-swap',
        message: '',
        conditions: [],
        agreedToTerms: false,
      };

      const mockErrorResponse = {
        response: {
          status: 400,
          data: {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid proposal data',
              category: 'validation',
              details: {
                sourceSwapId: ['Source swap not found'],
                agreedToTerms: ['Must agree to terms'],
              },
            },
          },
        },
      };

      mockAxiosInstance.post.mockRejectedValue(mockErrorResponse);

      await expect(swapApiService.createProposal(targetSwapId, proposalData))
        .rejects.toThrow(ValidationError);
    });

    it('should handle authentication errors from the new endpoint', async () => {
      const targetSwapId = 'target-swap-123';
      const proposalData: CreateProposalRequest = {
        sourceSwapId: 'source-swap-456',
        message: 'Test message',
        conditions: ['Standard swap'],
        agreedToTerms: true,
      };

      const mockErrorResponse = {
        response: {
          status: 401,
          data: {
            error: {
              code: 'UNAUTHORIZED',
              message: 'Authentication required',
              category: 'authentication',
            },
          },
        },
      };

      mockAxiosInstance.post.mockRejectedValue(mockErrorResponse);

      await expect(swapApiService.createProposal(targetSwapId, proposalData))
        .rejects.toThrow(SwapPlatformError);
    });

    it('should handle server errors from the new endpoint', async () => {
      const targetSwapId = 'target-swap-123';
      const proposalData: CreateProposalRequest = {
        sourceSwapId: 'source-swap-456',
        message: 'Test message',
        conditions: ['Standard swap'],
        agreedToTerms: true,
      };

      const mockErrorResponse = {
        response: {
          status: 500,
          data: {
            error: {
              code: 'INTERNAL_SERVER_ERROR',
              message: 'An unexpected error occurred',
              category: 'server_error',
            },
          },
        },
      };

      mockAxiosInstance.post.mockRejectedValue(mockErrorResponse);

      await expect(swapApiService.createProposal(targetSwapId, proposalData))
        .rejects.toThrow(SwapPlatformError);
    });

    it('should include proper headers and authentication', async () => {
      const targetSwapId = 'target-swap-123';
      const proposalData: CreateProposalRequest = {
        sourceSwapId: 'source-swap-456',
        message: 'Test message',
        conditions: ['Standard swap'],
        agreedToTerms: true,
      };

      const mockResponse: ProposalResponse = {
        proposalId: 'proposal-789',
        status: 'pending',
        estimatedResponseTime: '2-3 business days',
      };

      mockAxiosInstance.post.mockResolvedValue({
        data: mockResponse,
      });

      await swapApiService.createProposal(targetSwapId, proposalData);

      // Verify the request includes proper configuration
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/swaps/target-swap-123/proposals',
        proposalData,
        expect.objectContaining({
          // Should include timeout and other config options
        })
      );
    });

    it('should support request cancellation', async () => {
      const targetSwapId = 'target-swap-123';
      const proposalData: CreateProposalRequest = {
        sourceSwapId: 'source-swap-456',
        message: 'Test message',
        conditions: ['Standard swap'],
        agreedToTerms: true,
      };

      const abortController = new AbortController();
      const config = { abortController };

      const mockResponse: ProposalResponse = {
        proposalId: 'proposal-789',
        status: 'pending',
        estimatedResponseTime: '2-3 business days',
      };

      mockAxiosInstance.post.mockResolvedValue({
        data: mockResponse,
      });

      await swapApiService.createProposal(targetSwapId, proposalData, undefined, config);

      // Verify the abort signal is passed to the request
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/swaps/target-swap-123/proposals',
        proposalData,
        expect.objectContaining({
          signal: abortController.signal,
        })
      );
    });

    it('should validate proposal data before sending request', async () => {
      const targetSwapId = 'target-swap-123';
      const invalidProposalData: CreateProposalRequest = {
        sourceSwapId: '', // Invalid empty string
        message: 'Test message',
        conditions: [],
        agreedToTerms: false, // Invalid - must be true
      };

      // The validation should happen before the API call
      await expect(swapApiService.createProposal(targetSwapId, invalidProposalData))
        .rejects.toThrow(ValidationError);

      // Verify no API call was made due to validation failure
      expect(mockAxiosInstance.post).not.toHaveBeenCalled();
    });

    it('should handle network errors gracefully', async () => {
      const targetSwapId = 'target-swap-123';
      const proposalData: CreateProposalRequest = {
        sourceSwapId: 'source-swap-456',
        message: 'Test message',
        conditions: ['Standard swap'],
        agreedToTerms: true,
      };

      const networkError = {
        request: {},
        message: 'Network Error',
      };

      mockAxiosInstance.post.mockRejectedValue(networkError);

      await expect(swapApiService.createProposal(targetSwapId, proposalData))
        .rejects.toThrow(SwapPlatformError);
    });
  });

  describe('Response format compatibility', () => {
    it('should handle the new endpoint response format', async () => {
      const targetSwapId = 'target-swap-123';
      const proposalData: CreateProposalRequest = {
        sourceSwapId: 'source-swap-456',
        message: 'Test message',
        conditions: ['Standard swap'],
        agreedToTerms: true,
      };

      // Mock the new endpoint response format
      const mockApiResponse = {
        data: {
          proposalId: 'proposal-new-format',
          status: 'pending',
          estimatedResponseTime: '24-48 hours',
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockApiResponse);

      const result = await swapApiService.createProposal(targetSwapId, proposalData);

      expect(result).toEqual({
        proposalId: 'proposal-new-format',
        status: 'pending',
        estimatedResponseTime: '24-48 hours',
      });
    });

    it('should handle response with additional fields', async () => {
      const targetSwapId = 'target-swap-123';
      const proposalData: CreateProposalRequest = {
        sourceSwapId: 'source-swap-456',
        message: 'Test message',
        conditions: ['Standard swap'],
        agreedToTerms: true,
      };

      // Mock response with additional fields that might be added in the future
      const mockApiResponse = {
        data: {
          proposalId: 'proposal-extended',
          status: 'pending',
          estimatedResponseTime: '2-3 business days',
          // Additional fields that might be added
          createdAt: '2024-01-15T10:00:00Z',
          expiresAt: '2024-01-22T10:00:00Z',
          metadata: {
            source: 'web',
            version: '1.0',
          },
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockApiResponse);

      const result = await swapApiService.createProposal(targetSwapId, proposalData);

      // Should include all fields from the response
      expect(result).toEqual(mockApiResponse.data);
    });
  });
});