import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  SwapPlatformError,
  ValidationError,
  BusinessLogicError,
  ERROR_CODES,
} from '@booking-swap/shared';
import {
  EligibleSwapResponse,
  CreateProposalRequest,
  ProposalResponse,
  CompatibilityAnalysis,
  ApiErrorResponse,
  EligibleSwapsRequestOptions,
  ApiRequestConfig,
} from '../types/api';
import {
  validateProposalRequest,
  DEFAULT_PROPOSAL_VALIDATION_SCHEMA,
  ValidationContext,
} from '../types/validation';
import { swapCacheService } from './cacheService';
import { proposalCacheService } from './proposalCacheService';
import { apiPerformanceMonitor } from './performanceMonitor';

/**
 * API service layer for swap operations
 * Handles authentication, error handling, and response parsing
 */
class SwapApiService {
  private axiosInstance: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
      // Configure to handle 304 responses properly
      validateStatus: (status) => {
        // Accept 2xx and 304 status codes as successful
        return (status >= 200 && status < 300) || status === 304;
      },
    });

    this.setupInterceptors();
  }

  /**
   * Set up request and response interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor for authentication and caching
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const token = this.getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add request ID for tracking
        config.headers['X-Request-ID'] = this.generateRequestId();

        // Disable caching for eligible swaps endpoint since it's dynamic data
        if (config.url?.includes('/swaps/user/eligible')) {
          config.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
          config.headers['Pragma'] = 'no-cache';
          config.headers['Expires'] = '0';
        } else if (config.method === 'get') {
          config.headers['Cache-Control'] = 'max-age=300'; // 5 minutes for other GET requests
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => {
        // Log unusual status codes for debugging
        if (response.status === 203 || response.status === 204) {
          console.warn('Unusual status code received:', {
            status: response.status,
            url: response.config.url,
            method: response.config.method,
            headers: response.headers,
            data: response.data
          });
        }

        // Handle 304 Not Modified responses
        if (response.status === 304) {
          console.log('304 Not Modified received - this is normal for cached responses');
          // For 304 responses, the browser should have the cached data
          // We don't need to do anything special here as the browser handles it
        }

        return response;
      },
      (error) => {
        // Log error details for debugging
        if (error.response) {
          console.error('API Error Response:', {
            status: error.response.status,
            url: error.config?.url,
            method: error.config?.method,
            headers: error.response.headers,
            data: error.response.data
          });
        }
        return Promise.reject(this.handleApiError(error));
      }
    );
  }



  /**
   * Get authentication token from storage
   * Checks both 'authToken' and 'auth_token' keys for compatibility
   */
  private getAuthToken(): string | null {
    return localStorage.getItem('auth_token') || localStorage.getItem('authToken');
  }

  /**
   * Generate unique request ID for tracking
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Handle API errors and convert to platform-specific error types
   */
  private handleApiError(error: any): SwapPlatformError {
    if (error.response) {
      const { status, data } = error.response;
      const errorData = data as ApiErrorResponse;

      switch (status) {
        case 400:
          return new ValidationError(
            errorData.error?.message || 'Invalid request data',
            errorData.error?.details
          );
        case 401:
          // Handle token expiration/invalid token
          this.handleAuthenticationError();
          return new SwapPlatformError(
            ERROR_CODES.INVALID_TOKEN,
            'Authentication required',
            'authentication'
          );
        case 403:
          return new SwapPlatformError(
            ERROR_CODES.ACCESS_DENIED,
            'You don\'t have permission to access this resource',
            'authorization'
          );
        case 404:
          return new BusinessLogicError(
            ERROR_CODES.SWAP_NOT_FOUND,
            'The requested swap was not found'
          );
        case 409:
          if (errorData.error?.code === 'PROPOSAL_ALREADY_RESPONDED') {
            return new BusinessLogicError(
              'PROPOSAL_ALREADY_RESPONDED',
              'This proposal has already been accepted or rejected'
            );
          }
          return new BusinessLogicError(
            ERROR_CODES.INVALID_SWAP_STATE,
            errorData.error?.message || 'Invalid swap state for this operation'
          );
        case 422:
          if (errorData.error?.code === 'PAYMENT_PROCESSING_FAILED') {
            return new BusinessLogicError(
              'PAYMENT_PROCESSING_FAILED',
              'Payment processing failed. Please check your payment method and try again.'
            );
          }
          if (errorData.error?.code === 'ESCROW_TRANSFER_FAILED') {
            return new BusinessLogicError(
              'ESCROW_TRANSFER_FAILED',
              'Fund transfer failed. Please contact support for assistance.'
            );
          }
          if (errorData.error?.code === 'BLOCKCHAIN_RECORDING_FAILED') {
            return new BusinessLogicError(
              'BLOCKCHAIN_RECORDING_FAILED',
              'Blockchain recording failed. The operation will be retried automatically.'
            );
          }
          return new ValidationError(
            errorData.error?.message || 'Unable to process request due to validation errors',
            errorData.error?.details
          );
        case 429:
          return new SwapPlatformError(
            ERROR_CODES.RATE_LIMIT_EXCEEDED,
            'Too many requests. Please try again later.',
            'rate_limiting',
            true
          );
        default:
          return new SwapPlatformError(
            ERROR_CODES.INTERNAL_SERVER_ERROR,
            'An unexpected error occurred. Please try again.',
            'server_error',
            true
          );
      }
    } else if (error.request) {
      return new SwapPlatformError(
        ERROR_CODES.NETWORK_ERROR,
        'Network error. Please check your internet connection.',
        'integration',
        true
      );
    } else {
      return new SwapPlatformError(
        ERROR_CODES.INTERNAL_SERVER_ERROR,
        error.message || 'An unexpected error occurred',
        'server_error'
      );
    }
  }

  /**
   * Handle authentication errors (redirect to login, clear tokens, etc.)
   */
  private handleAuthenticationError(): void {
    // Clear invalid tokens from both possible storage keys
    localStorage.removeItem('auth_token');
    localStorage.removeItem('authToken');
    localStorage.removeItem('auth_user');

    // Trigger a custom event that the AuthContext can listen to
    window.dispatchEvent(new CustomEvent('auth:token-expired'));

    console.warn('Authentication failed. Tokens cleared and logout event dispatched.');
  }

  /**
   * Fetch eligible swaps for a user that are compatible with the target swap
   * @param userId - The user's ID
   * @param options - Request options including targetSwapId and pagination
   * @param config - Additional request configuration
   */
  async getEligibleSwaps(
    userId: string,
    options: EligibleSwapsRequestOptions,
    config?: ApiRequestConfig
  ): Promise<EligibleSwapResponse> {
    // Check cache first (only for basic requests without pagination)
    const shouldCache = !options.offset && !options.includeIneligible;
    if (shouldCache) {
      const cachedResponse = swapCacheService.getEligibleSwaps(userId, options.targetSwapId);
      if (cachedResponse) {
        return cachedResponse;
      }
    }

    const endpoint = `/swaps/user/eligible`;
    const method = 'GET';

    return apiPerformanceMonitor.measureApiCall(
      endpoint,
      method,
      async () => {
        try {
          const params = new URLSearchParams({
            targetSwapId: options.targetSwapId,
            ...(options.limit && { limit: options.limit.toString() }),
            ...(options.offset && { offset: options.offset.toString() }),
            ...(options.includeIneligible && { includeIneligible: options.includeIneligible.toString() }),
            ...(options.minCompatibilityScore && { minCompatibilityScore: options.minCompatibilityScore.toString() }),
          });

          const requestConfig = {
            ...(config?.timeout && { timeout: config.timeout }),
            ...(config?.abortController && { signal: config.abortController.signal }),
            ...(config?.headers && { headers: config.headers }),
          };

          const response: AxiosResponse<{ success: boolean; data: EligibleSwapResponse }> = await this.axiosInstance.get(
            `${endpoint}?${params.toString()}`,
            requestConfig
          );

          // Parse dates in the response - handle nested data structure
          // The API returns { success: true, data: { eligibleSwaps: [...], ... } }
          const responseData = response.data.data; // Extract the actual data from the success wrapper
          console.log('swapApiService - Raw response data:', response.data);
          console.log('swapApiService - Extracted responseData:', responseData);
          const parsedResponse = this.parseEligibleSwapsResponse(responseData);
          console.log('swapApiService - Parsed response:', parsedResponse);

          // Cache the response if appropriate
          if (shouldCache) {
            swapCacheService.setEligibleSwaps(userId, options.targetSwapId, parsedResponse);
          }

          return parsedResponse;
        } catch (error) {
          throw error;
        }
      },
      {
        userId,
        targetSwapId: options.targetSwapId,
        limit: options.limit,
        offset: options.offset,
      }
    );
  }

  /**
   * Create a new proposal for a swap
   * @param targetSwapId - The ID of the swap to propose to
   * @param proposalData - The proposal data
   * @param context - Additional validation context
   * @param config - Additional request configuration
   */
  async createProposal(
    targetSwapId: string,
    proposalData: CreateProposalRequest,
    context?: ValidationContext,
    config?: ApiRequestConfig
  ): Promise<ProposalResponse> {
    const endpoint = `/swaps/${targetSwapId}/proposals`;
    const method = 'POST';

    return apiPerformanceMonitor.measureApiCall(
      endpoint,
      method,
      async () => {
        try {
          // Validate proposal data using the new validation system
          const validationResult = validateProposalRequest(
            proposalData,
            DEFAULT_PROPOSAL_VALIDATION_SCHEMA,
            { ...context, targetSwapId }
          );

          if (!validationResult.isValid) {
            console.error('❌ swapApiService.createProposal - Client-side validation FAILED', {
              fullErrors: validationResult.errors,
              errorMessages: validationResult.errors.map(e => e.message),
              errorFields: validationResult.errors.map(e => ({ field: e.field, message: e.message, value: e.value })),
              proposalData,
              targetSwapId,
              context,
            });
            throw new ValidationError(
              'Invalid proposal data',
              { errors: validationResult.errors.map(e => e.message) }
            );
          }

          const requestConfig = {
            ...(config?.timeout && { timeout: config.timeout }),
            ...(config?.abortController && { signal: config.abortController.signal }),
            ...(config?.headers && { headers: config.headers }),
          };

          let response: AxiosResponse<ProposalResponse>;
          try {
            console.log('swapApiService.createProposal - POST', { endpoint, proposalData });
            response = await this.axiosInstance.post(
              endpoint,
              proposalData,
              requestConfig
            );
            console.log('swapApiService.createProposal - Response OK', response.data);
          } catch (error: any) {
            // Enhanced error logging to show full error details
            console.error('swapApiService.createProposal - Server error', {
              message: error?.message,
              status: error?.response?.status,
              url: error?.config?.url,
              method: error?.config?.method,
              payload: proposalData,
            });
            console.error('swapApiService.createProposal - Full error data:',
              JSON.stringify(error?.response?.data, null, 2)
            );
            if (error?.response?.data?.error) {
              console.error('swapApiService.createProposal - Error details:', {
                code: error.response.data.error.code,
                message: error.response.data.error.message,
                details: error.response.data.error.details,
                category: error.response.data.error.category,
              });
            }
            throw error;
          }

          // Invalidate related caches after successful proposal creation
          if (proposalData.sourceSwapId) {
            // Invalidate eligible swaps cache as the user's swaps may have changed
            const userId = this.getUserIdFromToken();
            if (userId) {
              swapCacheService.invalidateEligibleSwaps(userId);
            }

            // Invalidate compatibility cache for the involved swaps
            swapCacheService.invalidateCompatibility(proposalData.sourceSwapId, targetSwapId);
          }

          // Unwrap the response data to return ProposalResponse directly
          // Backend returns { success: true, data: ProposalResponse }
          return response.data.data;
        } catch (error) {
          throw error;
        }
      },
      {
        targetSwapId,
        sourceSwapId: proposalData.sourceSwapId,
      }
    );
  }

  /**
   * Get compatibility analysis between two swaps
   * @param sourceSwapId - The source swap ID
   * @param targetSwapId - The target swap ID
   * @param config - Additional request configuration
   */
  async getSwapCompatibility(
    sourceSwapId: string,
    targetSwapId: string,
    config?: ApiRequestConfig
  ): Promise<CompatibilityAnalysis> {
    // Check cache first
    const cachedAnalysis = swapCacheService.getCompatibilityAnalysis(sourceSwapId, targetSwapId);
    if (cachedAnalysis) {
      return cachedAnalysis;
    }

    const endpoint = `/swaps/${sourceSwapId}/compatibility/${targetSwapId}`;
    const method = 'GET';

    return apiPerformanceMonitor.measureApiCall(
      endpoint,
      method,
      async () => {
        try {
          const requestConfig = {
            ...(config?.timeout && { timeout: config.timeout }),
            ...(config?.abortController && { signal: config.abortController.signal }),
            ...(config?.headers && { headers: config.headers }),
          };

          const response: AxiosResponse<{ success: boolean, data: { compatibility: CompatibilityAnalysis, recommendation: string }, requestId: string, timestamp: string }> = await this.axiosInstance.get(
            endpoint,
            requestConfig
          );

          // Extract the compatibility analysis from the response
          const compatibilityAnalysis = response.data.data.compatibility;

          // Cache the response
          swapCacheService.setCompatibilityAnalysis(sourceSwapId, targetSwapId, compatibilityAnalysis);

          return compatibilityAnalysis;
        } catch (error) {
          throw error;
        }
      },
      {
        sourceSwapId,
        targetSwapId,
      }
    );
  }

  /**
   * Parse eligible swaps response and convert date strings to Date objects
   * Unified with the normalizer above: always return { eligibleSwaps, totalCount, compatibilityAnalysis? }
   */
  private parseEligibleSwapsResponse(response: any): EligibleSwapResponse {
    const swaps = response?.eligibleSwaps || response?.swaps || [];
    const parsedSwaps = swaps.map((swap: any) => ({
      ...swap,
      bookingDetails: {
        ...swap.bookingDetails,
        dateRange: swap.bookingDetails?.dateRange
          ? {
            checkIn: new Date(swap.bookingDetails.dateRange.checkIn),
            checkOut: new Date(swap.bookingDetails.dateRange.checkOut),
          }
          : undefined,
      },
    }));

    return {
      swaps: parsedSwaps,
      eligibleSwaps: parsedSwaps,
      totalCount: response?.totalCount || parsedSwaps.length,
      compatibilityThreshold: response?.compatibilityThreshold || 60,
      compatibilityAnalysis: response?.compatibilityAnalysis, // Include compatibility analysis from API
    } as EligibleSwapResponse;
  }



  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    const token = this.getAuthToken();
    return !!token && this.isTokenValid(token);
  }

  /**
   * Validate token format and expiration (basic client-side validation)
   */
  private isTokenValid(token: string): boolean {
    if (!token) return false;

    try {
      // Basic JWT format validation (header.payload.signature)
      const parts = token.split('.');
      if (parts.length !== 3) return false;

      // Decode payload to check expiration
      const payload = JSON.parse(atob(parts[1]));
      const now = Math.floor(Date.now() / 1000);

      // Check if token is expired (with 30 second buffer)
      if (payload.exp && payload.exp < (now + 30)) {
        return false;
      }

      return true;
    } catch (error) {
      console.warn('Invalid token format:', error);
      return false;
    }
  }

  /**
   * Extract user ID from JWT token
   */
  private getUserIdFromToken(): string | null {
    const token = this.getAuthToken();
    if (!token) return null;

    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = JSON.parse(atob(parts[1]));
      return payload.sub || payload.userId || payload.id || null;
    } catch (error) {
      console.warn('Failed to extract user ID from token:', error);
      return null;
    }
  }

  /**
   * Validate authentication before making API calls
   */
  private validateAuthentication(): void {
    const token = this.getAuthToken();

    if (!token) {
      throw new SwapPlatformError(
        ERROR_CODES.MISSING_TOKEN,
        'Authentication required. Please log in.',
        'authentication'
      );
    }

    if (!this.isTokenValid(token)) {
      // Clear invalid token and trigger logout
      this.handleAuthenticationError();
      throw new SwapPlatformError(
        ERROR_CODES.INVALID_TOKEN,
        'Your session has expired. Please log in again.',
        'authentication'
      );
    }
  }

  /**
   * Accept a proposal for a swap
   * @param proposalId - The ID of the proposal to accept
   * @param userId - The ID of the user accepting the proposal
   * @param autoProcessPayment - Whether to automatically process payment for financial proposals
   * @param config - Additional request configuration
   */
  async acceptProposal(
    proposalId: string,
    userId: string,
    autoProcessPayment: boolean = true,
    config?: ApiRequestConfig
  ): Promise<any> {
    const endpoint = `/proposals/${proposalId}/accept`;
    const method = 'POST';

    return apiPerformanceMonitor.measureApiCall(
      endpoint,
      method,
      async () => {
        try {
          this.validateAuthentication();

          const requestConfig = {
            ...(config?.timeout && { timeout: config.timeout }),
            ...(config?.abortController && { signal: config.abortController.signal }),
            ...(config?.headers && { headers: config.headers }),
          };

          const response = await this.axiosInstance.post(
            endpoint,
            { userId, autoProcessPayment },
            requestConfig
          );

          // Invalidate proposal status cache after acceptance
          proposalCacheService.invalidateProposalStatus(proposalId);

          // Invalidate user's proposal response history
          proposalCacheService.invalidateProposalResponseHistory(userId);

          return response.data;
        } catch (error) {
          throw error;
        }
      },
      { proposalId, userId }
    );
  }

  /**
   * Reject a proposal for a swap
   * @param proposalId - The ID of the proposal to reject
   * @param userId - The ID of the user rejecting the proposal
   * @param reason - Optional reason for rejection
   * @param config - Additional request configuration
   */
  async rejectProposal(
    proposalId: string,
    userId: string,
    reason?: string,
    config?: ApiRequestConfig
  ): Promise<any> {
    const endpoint = `/proposals/${proposalId}/reject`;
    const method = 'POST';

    return apiPerformanceMonitor.measureApiCall(
      endpoint,
      method,
      async () => {
        try {
          this.validateAuthentication();

          const requestConfig = {
            ...(config?.timeout && { timeout: config.timeout }),
            ...(config?.abortController && { signal: config.abortController.signal }),
            ...(config?.headers && { headers: config.headers }),
          };

          const response = await this.axiosInstance.post(
            endpoint,
            { userId, reason },
            requestConfig
          );

          // Invalidate proposal status cache after rejection
          proposalCacheService.invalidateProposalStatus(proposalId);

          // Invalidate user's proposal response history
          proposalCacheService.invalidateProposalResponseHistory(userId);

          return response.data;
        } catch (error) {
          throw error;
        }
      },
      { proposalId, userId }
    );
  }

  /**
   * Get proposal status with caching support
   * @param proposalId - The ID of the proposal
   * @param config - Additional request configuration
   */
  async getProposalStatus(
    proposalId: string,
    config?: ApiRequestConfig
  ): Promise<any> {
    // Check cache first
    const cachedStatus = proposalCacheService.getProposalStatus(proposalId);
    if (cachedStatus) {
      return cachedStatus;
    }

    const endpoint = `/proposals/${proposalId}/status`;
    const method = 'GET';

    return apiPerformanceMonitor.measureApiCall(
      endpoint,
      method,
      async () => {
        try {
          this.validateAuthentication();

          const requestConfig = {
            ...(config?.timeout && { timeout: config.timeout }),
            ...(config?.abortController && { signal: config.abortController.signal }),
            ...(config?.headers && { headers: config.headers }),
            // Enable caching for status queries
            headers: {
              ...config?.headers,
              'Cache-Control': 'max-age=60', // Cache for 1 minute
            },
          };

          const response = await this.axiosInstance.get(endpoint, requestConfig);

          // Cache the response
          proposalCacheService.setProposalStatus(proposalId, response.data);

          return response.data;
        } catch (error) {
          throw error;
        }
      },
      { proposalId }
    );
  }

  /**
   * Create an AbortController for request cancellation
   */
  createAbortController(): AbortController {
    return new AbortController();
  }

  /**
   * Make a request with cancellation support
   */
  async makeRequest<T>(
    method: 'get' | 'post' | 'put' | 'delete',
    url: string,
    data?: any,
    abortController?: AbortController
  ): Promise<T> {
    this.validateAuthentication();

    const config = {
      ...(abortController && { signal: abortController.signal }),
    };

    let response: AxiosResponse<T>;

    switch (method) {
      case 'get':
        response = await this.axiosInstance.get(url, config);
        break;
      case 'post':
        response = await this.axiosInstance.post(url, data, config);
        break;
      case 'put':
        response = await this.axiosInstance.put(url, data, config);
        break;
      case 'delete':
        response = await this.axiosInstance.delete(url, config);
        break;
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }

    return response.data;
  }
}

// Export singleton instance
export const swapApiService = new SwapApiService();