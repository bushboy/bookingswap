import axios, { AxiosResponse } from 'axios';
import {
  Swap,
  SwapStatus,
  SwapTerms,
  Booking,
  SwapPlatformError,
  ValidationError,
  BusinessLogicError,
  ERROR_CODES,
  SwapCardData,
} from '@booking-swap/shared';
import { swapFilterService, SwapFilters } from './SwapFilterService';

// Re-export types for convenience
export type { SwapStatus };

// Extended types for swap management
export interface SwapWithBookings extends Swap {
  sourceBooking: Booking;
  targetBooking?: Booking; // Optional for cash swaps
  proposer: UserProfile;
  owner: UserProfile;
  swapType: 'booking' | 'cash';
  cashDetails?: CashSwapDetails;
  hasActiveProposals: boolean;
  activeProposalCount: number;
}

export interface CashSwapDetails {
  minAmount: number;
  maxAmount: number;
  preferredAmount?: number;
  currency: string;
  paymentMethods: string[];
  escrowRequired: boolean;
  platformFeePercentage: number;
}

export interface UserProfile {
  id: string;
  walletAddress: string;
  verificationLevel: 'basic' | 'verified' | 'premium';
  reputation?: number;
}

export interface SwapProposal {
  id: string;
  swapId: string;
  proposerId: string;
  bookingId: string;
  message?: string;
  additionalPayment?: number;
  conditions: string[];
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
  respondedAt?: Date;
}

export interface SwapEvent {
  id: string;
  swapId: string;
  type:
  | 'created'
  | 'proposed'
  | 'accepted'
  | 'rejected'
  | 'completed'
  | 'cancelled';
  userId: string;
  data: Record<string, any>;
  timestamp: Date;
}

export interface CreateSwapRequest {
  sourceBookingId: string;
  targetBookingId: string;
  terms: {
    additionalPayment?: number;
    conditions: string[];
    expiresAt: Date;
  };
  message?: string;
}

export interface ProposalData {
  bookingId: string;
  message?: string;
  additionalPayment?: number;
  conditions: string[];
  walletAddress?: string; // Optional: wallet address to use for the proposal
}

export interface SwapServiceFilters {
  status?: SwapStatus[];
  userId?: string;
  bookingType?: string[];
  swapType?: 'booking' | 'cash' | 'both';
  dateRange?: {
    start: Date;
    end: Date;
  };
  priceRange?: {
    min: number;
    max: number;
  };
}

// Cache interface for filtered results
interface FilteredResultsCache {
  key: string;
  data: SwapWithBookings[];
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class SwapService {
  private baseURL: string;
  private axiosInstance;
  private filteredResultsCache: Map<string, FilteredResultsCache> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

  constructor() {
    this.baseURL =
      import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: 15000, // Longer timeout for blockchain operations
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.axiosInstance.interceptors.request.use(
      config => {
        const token = localStorage.getItem('auth_token');
        console.log('SwapService: Request interceptor - token exists:', !!token, 'URL:', config.url);
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
          console.log('SwapService: Added Authorization header');
        } else {
          console.log('SwapService: No token found in localStorage');
        }
        return config;
      },
      error => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      response => response,
      error => {
        console.log('SwapService: Response error:', error.response?.status, error.response?.data);
        console.log('SwapService: Full error object:', error);
        console.log('SwapService: Request config:', error.config);
        return Promise.reject(this.handleApiError(error));
      }
    );
  }

  private handleApiError(error: any): SwapPlatformError {
    if (error.response) {
      const { status, data } = error.response;

      switch (status) {
        case 400:
          return new ValidationError(
            data.error?.message || 'Invalid request data',
            data.error?.details
          );
        case 401:
          return new SwapPlatformError(
            ERROR_CODES.INVALID_TOKEN,
            'Authentication required',
            'authentication'
          );
        case 403:
          return new SwapPlatformError(
            ERROR_CODES.ACCESS_DENIED,
            'Access denied',
            'authorization'
          );
        case 404:
          return new BusinessLogicError(
            ERROR_CODES.SWAP_NOT_FOUND,
            'Swap not found'
          );
        case 409:
          return new BusinessLogicError(
            ERROR_CODES.INVALID_SWAP_STATE,
            data.error?.message || 'Invalid swap state for this operation'
          );
        case 410:
          return new BusinessLogicError(
            ERROR_CODES.BOOKING_EXPIRED,
            'Swap has expired'
          );
        case 429:
          return new SwapPlatformError(
            ERROR_CODES.RATE_LIMIT_EXCEEDED,
            'Too many requests',
            'rate_limiting',
            true
          );
        default:
          return new SwapPlatformError(
            ERROR_CODES.INTERNAL_SERVER_ERROR,
            'An unexpected error occurred',
            'server_error',
            true
          );
      }
    } else if (error.request) {
      return new SwapPlatformError(
        ERROR_CODES.NETWORK_ERROR,
        'Network error - please check your connection',
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

  // Swap Lifecycle Management
  async createSwap(data: CreateSwapRequest): Promise<Swap> {
    try {
      // Validate swap data
      this.validateSwapRequest(data);

      const response: AxiosResponse<Swap> = await this.axiosInstance.post(
        '/swaps',
        data
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getSwaps(
    userId?: string,
    filters?: SwapServiceFilters
  ): Promise<SwapWithBookings[]> {
    try {
      const params = this.buildFilterParams(filters);
      if (userId) {
        params.userId = userId;
      }

      const response: AxiosResponse<{
        success: boolean;
        data: {
          swaps: SwapWithBookings[];
          pagination: {
            limit: number;
            offset: number;
            total: number;
          };
        };
      }> = await this.axiosInstance.get('/swaps', { params });

      // Extract the swaps array from the API response structure
      return response.data.data.swaps;
    } catch (error) {
      throw error;
    }
  }

  async getSwap(id: string): Promise<SwapWithBookings> {
    try {
      const response: AxiosResponse<{
        success: boolean;
        data: {
          swap: SwapWithBookings;
        };
      }> = await this.axiosInstance.get(`/swaps/${id}`);

      // Extract the swap from the API response structure
      return response.data.data.swap;
    } catch (error) {
      throw error;
    }
  }

  async browseSwaps(options?: { limit?: number; offset?: number }): Promise<SwapWithBookings[]> {
    try {
      const params = {
        limit: options?.limit || 100,
        offset: options?.offset || 0,
      };

      const response: AxiosResponse<{
        success: boolean;
        data: {
          swaps: SwapWithBookings[];
          pagination: {
            limit: number;
            offset: number;
            total: number;
            hasMore: boolean;
          };
        };
      }> = await this.axiosInstance.get('/swaps/browse', { params });

      // Extract the swaps array from the API response structure
      return response.data.data.swaps;
    } catch (error) {
      throw error;
    }
  }

  async acceptSwap(id: string, message?: string): Promise<Swap> {
    try {
      const response: AxiosResponse<Swap> = await this.axiosInstance.post(
        `/swaps/${id}/accept`,
        {
          message,
        }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async rejectSwap(id: string, reason?: string): Promise<Swap> {
    try {
      const response: AxiosResponse<Swap> = await this.axiosInstance.post(
        `/swaps/${id}/reject`,
        {
          reason,
        }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async cancelSwap(id: string, reason?: string): Promise<Swap> {
    try {
      const response: AxiosResponse<Swap> = await this.axiosInstance.post(
        `/swaps/${id}/cancel`,
        {
          reason,
        }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async completeSwap(id: string): Promise<Swap> {
    try {
      const response: AxiosResponse<Swap> = await this.axiosInstance.post(
        `/swaps/${id}/complete`
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Proposal Management
  async createProposal(
    swapId: string,
    data: ProposalData
  ): Promise<SwapProposal> {
    try {
      // Validate proposal data
      this.validateProposalData(data);

      const response: AxiosResponse<SwapProposal> =
        await this.axiosInstance.post(`/swaps/${swapId}/proposals`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getProposals(swapId: string): Promise<SwapProposal[]> {
    try {
      const response: AxiosResponse<SwapProposal[]> =
        await this.axiosInstance.get(`/swaps/${swapId}/proposals`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async acceptProposal(
    swapId: string,
    proposalId: string
  ): Promise<SwapProposal> {
    try {
      const response: AxiosResponse<SwapProposal> =
        await this.axiosInstance.post(
          `/swaps/${swapId}/proposals/${proposalId}/accept`
        );
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async rejectProposal(
    swapId: string,
    proposalId: string,
    reason?: string
  ): Promise<SwapProposal> {
    try {
      const response: AxiosResponse<SwapProposal> =
        await this.axiosInstance.post(
          `/swaps/${swapId}/proposals/${proposalId}/reject`,
          { reason }
        );
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Status Tracking and History
  async getSwapHistory(swapId: string): Promise<SwapEvent[]> {
    try {
      const response: AxiosResponse<SwapEvent[]> = await this.axiosInstance.get(
        `/swaps/${swapId}/history`
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getSwapsByStatus(
    status: SwapStatus,
    userId?: string
  ): Promise<SwapWithBookings[]> {
    try {
      const filters: SwapServiceFilters = { status: [status] };
      return await this.getSwaps(userId, filters);
    } catch (error) {
      throw error;
    }
  }

  async getUserSwapStats(userId: string): Promise<{
    total: number;
    pending: number;
    completed: number;
    cancelled: number;
    successRate: number;
  }> {
    try {
      const response: AxiosResponse<any> = await this.axiosInstance.get(
        `/users/${userId}/swap-stats`
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Validation Methods
  private validateSwapRequest(data: CreateSwapRequest): void {
    const errors: string[] = [];

    if (!data.sourceBookingId || data.sourceBookingId.trim().length === 0) {
      errors.push('Source booking ID is required');
    }

    if (!data.targetBookingId || data.targetBookingId.trim().length === 0) {
      errors.push('Target booking ID is required');
    }

    if (data.sourceBookingId === data.targetBookingId) {
      errors.push('Source and target bookings cannot be the same');
    }

    if (!data.terms) {
      errors.push('Swap terms are required');
    } else {
      if (!data.terms.expiresAt) {
        errors.push('Expiration date is required');
      } else if (new Date(data.terms.expiresAt) <= new Date()) {
        errors.push('Expiration date must be in the future');
      }

      if (!data.terms.conditions || data.terms.conditions.length === 0) {
        errors.push('At least one condition is required');
      }

      if (data.terms.additionalPayment && data.terms.additionalPayment < 0) {
        errors.push('Additional payment cannot be negative');
      }
    }

    if (errors.length > 0) {
      throw new ValidationError('Invalid swap request', { errors });
    }
  }

  private validateProposalData(data: ProposalData): void {
    const errors: string[] = [];

    if (!data.bookingId || data.bookingId.trim().length === 0) {
      errors.push('Booking ID is required');
    }

    if (!data.conditions || data.conditions.length === 0) {
      errors.push('At least one condition is required');
    }

    if (data.additionalPayment && data.additionalPayment < 0) {
      errors.push('Additional payment cannot be negative');
    }

    if (data.message && data.message.length > 1000) {
      errors.push('Message must be less than 1000 characters');
    }

    if (errors.length > 0) {
      throw new ValidationError('Invalid proposal data', { errors });
    }
  }

  // Helper Methods
  private buildFilterParams(filters?: SwapServiceFilters): Record<string, any> {
    if (!filters) return {};

    const params: Record<string, any> = {};

    if (filters.status && filters.status.length > 0) {
      params.status = filters.status.join(',');
    }

    if (filters.bookingType && filters.bookingType.length > 0) {
      params.bookingType = filters.bookingType.join(',');
    }

    if (filters.swapType && filters.swapType !== 'both') {
      params.swapType = filters.swapType;
    }

    if (filters.dateRange) {
      params.startDate = filters.dateRange.start.toISOString();
      params.endDate = filters.dateRange.end.toISOString();
    }

    if (filters.priceRange) {
      if (filters.priceRange.min) {
        params.minPrice = filters.priceRange.min;
      }
      if (filters.priceRange.max) {
        params.maxPrice = filters.priceRange.max;
      }
    }

    return params;
  }

  // Cache Management Methods
  private generateCacheKey(currentUserId: string, filters?: SwapFilters): string {
    const filterStr = filters ? JSON.stringify(filters) : 'no-filters';
    return `${currentUserId}-${filterStr}`;
  }

  private getCachedResults(cacheKey: string): SwapWithBookings[] | null {
    const cached = this.filteredResultsCache.get(cacheKey);
    if (!cached) {
      return null;
    }

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      // Cache expired, remove it
      this.filteredResultsCache.delete(cacheKey);
      return null;
    }

    return cached.data;
  }

  private setCachedResults(
    cacheKey: string,
    data: SwapWithBookings[],
    ttl: number = this.CACHE_TTL
  ): void {
    this.filteredResultsCache.set(cacheKey, {
      key: cacheKey,
      data: [...data], // Create a copy to avoid mutations
      timestamp: Date.now(),
      ttl,
    });

    // Clean up expired entries periodically
    this.cleanupExpiredCache();
  }

  private cleanupExpiredCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.filteredResultsCache.entries()) {
      if (now - cached.timestamp > cached.ttl) {
        this.filteredResultsCache.delete(key);
      }
    }
  }

  public clearCache(): void {
    this.filteredResultsCache.clear();
  }

  // Get cache statistics for debugging/monitoring
  public getCacheStats(): {
    size: number;
    keys: string[];
    oldestEntry?: number;
    newestEntry?: number;
  } {
    const entries = Array.from(this.filteredResultsCache.values());
    const timestamps = entries.map(entry => entry.timestamp);

    return {
      size: this.filteredResultsCache.size,
      keys: Array.from(this.filteredResultsCache.keys()),
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : undefined,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : undefined,
    };
  }

  // Invalidate cache for specific user (useful when user data changes)
  public invalidateUserCache(userId: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.filteredResultsCache.keys()) {
      if (key.startsWith(userId)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.filteredResultsCache.delete(key));
  }

  // Additional methods referenced in the codebase
  async createEnhancedSwap(data: CreateSwapRequest): Promise<Swap> {
    try {
      // Enhanced swap creation with additional validation
      this.validateSwapRequest(data);

      const response: AxiosResponse<Swap> = await this.axiosInstance.post(
        '/swaps/enhanced',
        data
      );

      // Clear cache when new swap is created
      this.clearCache();

      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getSwapByBookingId(bookingId: string): Promise<SwapWithBookings | null> {
    try {
      if (!bookingId || bookingId.trim().length === 0) {
        throw new ValidationError('Booking ID is required', {
          field: 'bookingId',
        });
      }

      const response: AxiosResponse<SwapWithBookings> = await this.axiosInstance.get(
        `/swaps/by-booking/${bookingId}`
      );
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null; // No swap found for this booking
      }
      throw error;
    }
  }

  async updateSwap(swapId: string, data: Partial<CreateSwapRequest>): Promise<Swap> {
    try {
      if (!swapId || swapId.trim().length === 0) {
        throw new ValidationError('Swap ID is required', {
          field: 'swapId',
        });
      }

      const response: AxiosResponse<Swap> = await this.axiosInstance.put(
        `/swaps/${swapId}`,
        data
      );

      // Clear cache when swap is updated
      this.clearCache();

      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getSwapById(swapId: string): Promise<SwapWithBookings> {
    try {
      if (!swapId || swapId.trim().length === 0) {
        throw new ValidationError('Swap ID is required', {
          field: 'swapId',
        });
      }

      // This is an alias for getSwap method for consistency
      return await this.getSwap(swapId);
    } catch (error) {
      throw error;
    }
  }

  async getProposalsForSwap(swapId: string): Promise<SwapProposal[]> {
    try {
      if (!swapId || swapId.trim().length === 0) {
        throw new ValidationError('Swap ID is required', {
          field: 'swapId',
        });
      }

      // This is an alias for getProposals method for consistency
      return await this.getProposals(swapId);
    } catch (error) {
      throw error;
    }
  }

  async createBookingProposal(
    swapId: string,
    data: {
      bookingId: string;
      message?: string;
      additionalPayment?: number;
      conditions?: string[];
    }
  ): Promise<SwapProposal> {
    try {
      if (!swapId || swapId.trim().length === 0) {
        throw new ValidationError('Swap ID is required', {
          field: 'swapId',
        });
      }

      const proposalData: ProposalData = {
        bookingId: data.bookingId,
        message: data.message,
        additionalPayment: data.additionalPayment,
        conditions: data.conditions && data.conditions.length > 0 ? data.conditions : ['Standard booking swap'],
      };

      return await this.createProposal(swapId, proposalData);
    } catch (error) {
      throw error;
    }
  }

  async createCashProposal(
    swapId: string,
    data: {
      amount: number;
      currency: string;
      paymentMethod?: string;
      message?: string;
    }
  ): Promise<SwapProposal> {
    try {
      if (!swapId || swapId.trim().length === 0) {
        throw new ValidationError('Swap ID is required', {
          field: 'swapId',
        });
      }

      if (!data.amount || data.amount <= 0) {
        throw new ValidationError('Valid cash amount is required', {
          field: 'amount',
        });
      }

      const response: AxiosResponse<SwapProposal> = await this.axiosInstance.post(
        `/swaps/${swapId}/cash-proposals`,
        data
      );

      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Browse available swaps with enhanced filtering
  async getBrowsableSwaps(
    currentUserId: string,
    filters?: SwapFilters
  ): Promise<SwapWithBookings[]> {
    try {
      // Validate currentUserId
      if (!currentUserId || currentUserId.trim().length === 0) {
        throw new ValidationError('Current user ID is required for browsing swaps', {
          field: 'currentUserId',
        });
      }

      // Validate filters if provided
      if (filters) {
        const validation = swapFilterService.validateFilters(filters);
        if (!validation.isValid) {
          throw new ValidationError('Invalid filter parameters', {
            errors: validation.errors,
          });
        }
      }

      // Check cache first
      const cacheKey = this.generateCacheKey(currentUserId, filters);
      const cachedResults = this.getCachedResults(cacheKey);
      if (cachedResults) {
        return cachedResults;
      }

      // Convert SwapFilters to SwapServiceFilters for API call
      const serviceFilters: SwapServiceFilters = filters ? {
        swapType: filters.swapType,
        dateRange: filters.dateRange,
        priceRange: filters.priceRange,
      } : {};

      const params = {
        currentUserId,
        ...this.buildFilterParams(serviceFilters),
      };

      const response: AxiosResponse<{
        success: boolean;
        data: {
          swaps: SwapWithBookings[];
          pagination?: any;
        };
      }> = await this.axiosInstance.get('/swaps/browse', { params });

      let swaps = response.data.data?.swaps || [];

      // Apply client-side filtering using SwapFilterService
      if (filters) {
        try {
          swaps = swapFilterService.applyAllFilters(swaps, currentUserId, filters);
        } catch (filterError) {
          // Handle filtering edge cases
          console.warn('Error applying client-side filters:', filterError);
          // Fall back to core filtering only
          swaps = swapFilterService.applyCoreBrowsingFilters(swaps, currentUserId);
        }
      } else {
        // Apply core filtering even without user filters
        swaps = swapFilterService.applyCoreBrowsingFilters(swaps, currentUserId);
      }

      // Cache the filtered results
      this.setCachedResults(cacheKey, swaps);

      return swaps;
    } catch (error) {
      // Enhanced error handling for filtering edge cases
      if (error instanceof ValidationError) {
        throw error;
      }

      // Handle API errors
      if (error.response?.status === 400) {
        throw new ValidationError(
          'Invalid browsing parameters',
          { originalError: error.message }
        );
      }

      if (error.response?.status === 403) {
        throw new SwapPlatformError(
          ERROR_CODES.ACCESS_DENIED,
          'Access denied for browsing swaps',
          'authorization'
        );
      }

      // For other errors, wrap in a generic error
      throw new SwapPlatformError(
        ERROR_CODES.INTERNAL_SERVER_ERROR,
        'Failed to fetch browsable swaps',
        'server_error',
        true
      );
    }
  }

  // Get cash swaps specifically with enhanced filtering
  async getCashSwaps(
    currentUserId: string,
    filters?: SwapFilters
  ): Promise<SwapWithBookings[]> {
    try {
      // Validate currentUserId
      if (!currentUserId || currentUserId.trim().length === 0) {
        throw new ValidationError('Current user ID is required for browsing cash swaps', {
          field: 'currentUserId',
        });
      }

      const cashFilters: SwapFilters = {
        ...filters,
        swapType: 'cash' as const,
        // Ensure core filtering rules are applied
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true,
      };

      return await this.getBrowsableSwaps(currentUserId, cashFilters);
    } catch (error) {
      // Add specific error context for cash swaps
      if (error instanceof ValidationError || error instanceof SwapPlatformError) {
        throw error;
      }

      throw new SwapPlatformError(
        ERROR_CODES.INTERNAL_SERVER_ERROR,
        'Failed to fetch cash swaps',
        'server_error',
        true
      );
    }
  }

  // Get booking swaps specifically with enhanced filtering
  async getBookingSwaps(
    currentUserId: string,
    filters?: SwapFilters
  ): Promise<SwapWithBookings[]> {
    try {
      // Validate currentUserId
      if (!currentUserId || currentUserId.trim().length === 0) {
        throw new ValidationError('Current user ID is required for browsing booking swaps', {
          field: 'currentUserId',
        });
      }

      const bookingFilters: SwapFilters = {
        ...filters,
        swapType: 'booking' as const,
        // Ensure core filtering rules are applied
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true,
      };

      return await this.getBrowsableSwaps(currentUserId, bookingFilters);
    } catch (error) {
      // Add specific error context for booking swaps
      if (error instanceof ValidationError || error instanceof SwapPlatformError) {
        throw error;
      }

      throw new SwapPlatformError(
        ERROR_CODES.INTERNAL_SERVER_ERROR,
        'Failed to fetch booking swaps',
        'server_error',
        true
      );
    }
  }

  // Search swaps with enhanced filtering and caching
  async searchSwaps(
    currentUserId: string,
    searchQuery: string,
    filters?: SwapFilters
  ): Promise<SwapWithBookings[]> {
    try {
      // Validate inputs
      if (!currentUserId || currentUserId.trim().length === 0) {
        throw new ValidationError('Current user ID is required for searching swaps', {
          field: 'currentUserId',
        });
      }

      if (!searchQuery || searchQuery.trim().length === 0) {
        throw new ValidationError('Search query is required', {
          field: 'searchQuery',
        });
      }

      // Create cache key that includes search query
      const searchCacheKey = `search-${currentUserId}-${searchQuery}-${JSON.stringify(filters || {})}`;
      const cachedResults = this.getCachedResults(searchCacheKey);
      if (cachedResults) {
        return cachedResults;
      }

      // Convert filters for API call
      const serviceFilters: SwapServiceFilters = filters ? {
        swapType: filters.swapType,
        dateRange: filters.dateRange,
        priceRange: filters.priceRange,
      } : {};

      const params = {
        currentUserId,
        q: searchQuery.trim(),
        ...this.buildFilterParams(serviceFilters),
      };

      const response: AxiosResponse<{
        success: boolean;
        data: {
          swaps: SwapWithBookings[];
          pagination?: any;
        };
      }> = await this.axiosInstance.get('/swaps/search', { params });

      let swaps = response.data.data?.swaps || [];

      // Apply client-side filtering
      if (filters) {
        try {
          swaps = swapFilterService.applyAllFilters(swaps, currentUserId, filters);
        } catch (filterError) {
          console.warn('Error applying search filters:', filterError);
          swaps = swapFilterService.applyCoreBrowsingFilters(swaps, currentUserId);
        }
      } else {
        swaps = swapFilterService.applyCoreBrowsingFilters(swaps, currentUserId);
      }

      // Cache search results with shorter TTL
      this.setCachedResults(searchCacheKey, swaps, 2 * 60 * 1000); // 2 minutes

      return swaps;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof SwapPlatformError) {
        throw error;
      }

      throw new SwapPlatformError(
        ERROR_CODES.INTERNAL_SERVER_ERROR,
        'Failed to search swaps',
        'server_error',
        true
      );
    }
  }

  // Utility Methods
  async canCreateSwap(
    sourceBookingId: string,
    targetBookingId: string
  ): Promise<{
    canCreate: boolean;
    reason?: string;
  }> {
    try {
      const response: AxiosResponse<any> = await this.axiosInstance.get(
        `/swaps/can-create?source=${sourceBookingId}&target=${targetBookingId}`
      );
      return response.data;
    } catch (error) {
      return { canCreate: false, reason: 'Unable to verify swap eligibility' };
    }
  }

  /**
   * Get user's swaps with filtered proposals (excluding self-proposals)
   * Returns clean SwapCardData structure for frontend display
   */
  async getUserSwapCards(
    userId?: string,
    filters?: SwapServiceFilters
  ): Promise<SwapCardData[]> {
    try {
      const params = this.buildFilterParams(filters);
      if (userId) {
        params.userId = userId;
      }

      const response: AxiosResponse<{
        success: boolean;
        data: {
          swapCards: SwapCardData[];
        };
      }> = await this.axiosInstance.get('/swaps', { params });

      return response.data.data.swapCards;
    } catch (error) {
      // If the new endpoint doesn't exist yet, fall back to transforming existing data
      if (error.response?.status === 404) {
        console.warn('SwapCardData endpoint not available, falling back to legacy transformation');
        return this.transformLegacySwapsToCardData(userId, filters);
      }
      throw error;
    }
  }

  /**
   * Fallback method to transform legacy swap data to SwapCardData format
   * This provides client-side filtering until the backend is updated
   */
  private async transformLegacySwapsToCardData(
    userId?: string,
    filters?: SwapServiceFilters
  ): Promise<SwapCardData[]> {
    try {
      // Get swaps using existing method
      const swaps = await this.getSwaps(userId, filters);

      // Transform to SwapCardData format with client-side filtering
      const cardDataPromises = swaps.map(async (swap) => {
        // Get proposals for this swap
        const proposals = await this.getProposals(swap.id);

        // Filter out self-proposals (where proposer_id equals current user)
        const filteredProposals = proposals.filter(proposal =>
          proposal.proposerId !== userId
        );

        // Transform to SwapCardData format
        const swapCardData: SwapCardData = {
          userSwap: {
            id: swap.id,
            bookingDetails: swap.sourceBooking ? {
              id: swap.sourceBooking.id,
              title: swap.sourceBooking.title,
              location: {
                city: swap.sourceBooking.location?.city || 'Unknown',
                country: swap.sourceBooking.location?.country || 'Unknown'
              },
              dateRange: {
                checkIn: swap.sourceBooking.dateRange?.checkIn || new Date(),
                checkOut: swap.sourceBooking.dateRange?.checkOut || new Date()
              },
              originalPrice: swap.sourceBooking.originalPrice || 0,
              swapValue: swap.sourceBooking.swapValue || 0
            } : {
              id: 'unknown',
              title: 'Unknown Booking',
              location: { city: 'Unknown', country: 'Unknown' },
              dateRange: { checkIn: new Date(), checkOut: new Date() },
              originalPrice: 0,
              swapValue: 0
            },
            status: swap.status,
            createdAt: swap.createdAt,
            expiresAt: swap.terms?.expiresAt
          },
          proposalsFromOthers: filteredProposals.map(proposal => ({
            id: proposal.id,
            proposerId: proposal.proposerId,
            proposerName: `User ${proposal.proposerId}`, // TODO: Get actual user name
            targetBookingDetails: {
              id: proposal.bookingId,
              title: 'Proposed Booking', // TODO: Get actual booking details
              location: { city: 'Unknown', country: 'Unknown' },
              dateRange: { checkIn: new Date(), checkOut: new Date() },
              originalPrice: 0,
              swapValue: 0
            },
            status: proposal.status as SwapStatus,
            createdAt: proposal.createdAt,
            additionalPayment: proposal.additionalPayment,
            conditions: proposal.conditions,
            expiresAt: undefined
          })),
          proposalCount: filteredProposals.length
        };

        return swapCardData;
      });

      return Promise.all(cardDataPromises);
    } catch (error) {
      throw new SwapPlatformError(
        ERROR_CODES.INTERNAL_SERVER_ERROR,
        'Failed to transform swap data to card format',
        'server_error',
        true
      );
    }
  }

  async getSwapRecommendations(
    bookingId: string,
    currentUserId: string
  ): Promise<Booking[]> {
    try {
      // Validate inputs
      if (!bookingId || bookingId.trim().length === 0) {
        throw new ValidationError('Booking ID is required for recommendations', {
          field: 'bookingId',
        });
      }

      if (!currentUserId || currentUserId.trim().length === 0) {
        throw new ValidationError('Current user ID is required for recommendations', {
          field: 'currentUserId',
        });
      }

      const response: AxiosResponse<Booking[]> = await this.axiosInstance.get(
        `/swaps/recommendations/${bookingId}`,
        {
          params: { currentUserId },
        }
      );

      // Apply basic filtering to recommendations to exclude user's own bookings
      const recommendations = response.data || [];
      return recommendations.filter(booking => booking.userId !== currentUserId);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }

      throw new SwapPlatformError(
        ERROR_CODES.INTERNAL_SERVER_ERROR,
        'Failed to fetch swap recommendations',
        'server_error',
        true
      );
    }
  }

  async estimateSwapFees(
    sourceBookingId: string,
    targetBookingId: string
  ): Promise<{
    platformFee: number;
    blockchainFee: number;
    totalFee: number;
  }> {
    try {
      const response: AxiosResponse<any> = await this.axiosInstance.get(
        `/swaps/estimate-fees?source=${sourceBookingId}&target=${targetBookingId}`
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Real-time status checking
  async checkSwapStatus(swapId: string): Promise<{
    status: SwapStatus;
    lastUpdated: Date;
    blockchainStatus?: string;
  }> {
    try {
      const response: AxiosResponse<any> = await this.axiosInstance.get(
        `/swaps/${swapId}/status`
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Batch operations for efficiency
  async getMultipleSwaps(swapIds: string[]): Promise<SwapWithBookings[]> {
    try {
      const response: AxiosResponse<SwapWithBookings[]> =
        await this.axiosInstance.post('/swaps/batch', {
          swapIds,
        });
      return response.data;
    } catch (error) {
      throw error;
    }
  }
}

export const swapService = new SwapService();
