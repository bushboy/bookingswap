import axios, { AxiosResponse } from 'axios';
import {
  Booking,
  BookingType,
  BookingStatus,
  BookingLocation,
  BookingDateRange,
  BookingProviderDetails,
  SwapPlatformError,
  ValidationError,
  BusinessLogicError,
  ERROR_CODES,
} from '@booking-swap/shared';
import {
  UnifiedBookingData,
  BookingWithSwapInfo,
  SwapInfo,
  InlineProposalData,
  EnhancedBookingFilters,
  UnifiedFormValidationErrors,
  UnifiedBookingResponse,
  UpdateBookingWithSwapRequest,
  BookingUserRole,
} from '@booking-swap/shared';
import { bookingService, BookingFilters } from './bookingService';
import { swapService, SwapWithBookings, SwapProposal } from './swapService';
import { CacheService } from './cacheService';
import { realtimeService } from './realtimeService';

// Real-time update configuration
interface RealtimeConfig {
  enabled: boolean;
  reconnectInterval: number;
  maxReconnectAttempts: number;
}

/**
 * UnifiedBookingService extends the existing BookingService with integrated swap operations
 * This service provides a unified interface for booking and swap management with enhanced
 * API integration, caching, and real-time updates
 */
export class UnifiedBookingService {
  private baseURL: string;
  private axiosInstance;
  private realtimeConfig: RealtimeConfig;
  private cacheService: CacheService;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

    // Initialize cache service
    this.cacheService = new CacheService({
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      maxSize: 100,
      cleanupInterval: 60 * 1000, // 1 minute
    });

    // Initialize real-time configuration
    this.realtimeConfig = {
      enabled: import.meta.env.VITE_REALTIME_ENABLED !== 'false',
      reconnectInterval: 5000, // 5 seconds
      maxReconnectAttempts: 10,
    };

    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token and cache headers
    this.axiosInstance.interceptors.request.use(
      config => {
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add cache control headers for GET requests
        if (config.method === 'get') {
          config.headers['Cache-Control'] = 'max-age=300'; // 5 minutes
          const cacheKey = this.createCacheKey('etag', config.url || '');
          const etag = this.cacheService.get<string>(cacheKey);
          if (etag) {
            config.headers['If-None-Match'] = etag;
          }
        }

        return config;
      },
      error => Promise.reject(error)
    );

    // Response interceptor for error handling and caching
    this.axiosInstance.interceptors.response.use(
      response => {
        // Cache successful GET responses and ETags
        if (response.config.method === 'get' && response.status === 200) {
          const url = response.config.url || '';
          try {
            this.cacheService.set(url, response.data, 5 * 60 * 1000); // 5 minutes

            // Store ETag for future requests
            if (response.headers.etag) {
              const etagKey = this.createCacheKey('etag', url);
              this.cacheService.set(etagKey, response.headers.etag, 24 * 60 * 60 * 1000); // 24 hours
            }
          } catch (cacheError) {
            console.warn('Failed to cache response:', cacheError);
          }
        }
        return response;
      },
      error => {
        // Handle 304 Not Modified responses
        if (error.response?.status === 304) {
          const cachedData = this.cacheService.get(error.config.url || '');
          if (cachedData) {
            return { data: cachedData, status: 200, statusText: 'OK (Cached)' };
          }
        }
        return Promise.reject(this.handleApiError(error));
      }
    );

    // Setup real-time event listeners
    if (this.realtimeConfig.enabled) {
      this.setupRealtimeListeners();
    }
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
            ERROR_CODES.BOOKING_NOT_FOUND,
            'Booking not found'
          );
        case 409:
          return new BusinessLogicError(
            ERROR_CODES.BOOKING_ALREADY_SWAPPED,
            'Booking is already part of an active swap'
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

  /**
   * Creates a booking with optional swap preferences
   * Requirement 1.1: Integrated Booking and Swap Creation
   */
  async createBookingWithSwap(data: UnifiedBookingData): Promise<UnifiedBookingResponse> {
    try {
      // Validate unified booking data
      const validationErrors = this.validateUnifiedBookingData(data);
      if (Object.keys(validationErrors).length > 0) {
        throw new ValidationError('Invalid booking data', { errors: validationErrors });
      }

      // Create booking first using existing service
      const bookingData = this.extractBookingData(data);
      const booking = await bookingService.createBooking(bookingData);

      // Invalidate all booking-related caches immediately after creation
      this.invalidateCache('bookings-with-swap');
      this.invalidateCache();

      let swapInfo: any = undefined;

      // Create swap if preferences are provided
      if (data.swapEnabled && data.swapPreferences) {
        try {
          const swapData = this.mapSwapPreferencesToSwapData(data.swapPreferences, booking.id);
          const response: AxiosResponse<any> = await this.axiosInstance.post('/swaps/enhanced', swapData);
          swapInfo = {
            id: response.data.id,
            status: response.data.status,
            paymentTypes: data.swapPreferences.paymentTypes,
            acceptanceStrategy: data.swapPreferences.acceptanceStrategy,
          };

          // Invalidate cache again after swap creation
          this.invalidateCache('bookings-with-swap');
          this.invalidateCache(`swap-info-${booking.id}`);
        } catch (swapError) {
          // If swap creation fails, we should consider rolling back the booking
          // For now, we'll log the error and continue
          console.error('Failed to create swap for booking:', swapError);
          throw new BusinessLogicError(
            ERROR_CODES.INTERNAL_SERVER_ERROR,
            'Booking created but swap setup failed. Please try adding swap preferences later.'
          );
        }
      }

      return { booking, swap: swapInfo };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Updates booking and associated swap preferences
   * Requirement 1.1: Integrated Booking and Swap Creation
   */
  async updateBookingWithSwap(
    bookingId: string,
    data: UpdateBookingWithSwapRequest
  ): Promise<UnifiedBookingResponse> {
    try {
      // Validate the update data
      if (data.bookingData) {
        const validationErrors = this.validatePartialBookingData(data.bookingData);
        if (Object.keys(validationErrors).length > 0) {
          throw new ValidationError('Invalid booking update data', { errors: validationErrors });
        }
      }

      // Update booking using existing service
      const bookingUpdateData = data.bookingData ? this.extractBookingUpdateData(data.bookingData) : {};
      const booking = await bookingService.updateBooking(bookingId, bookingUpdateData);

      // Handle swap preferences
      let swapInfo: any = undefined;

      try {
        // Check if swap already exists for this booking
        const existingSwapResponse = await this.axiosInstance.get(`/swaps/by-booking/${bookingId}`);
        const existingSwap = existingSwapResponse.data;

        if (data.swapEnabled && data.swapPreferences) {
          if (existingSwap) {
            // Update existing swap
            const swapUpdateData = this.mapSwapPreferencesToSwapData(data.swapPreferences, bookingId);
            const response: AxiosResponse<any> = await this.axiosInstance.put(
              `/swaps/enhanced/${existingSwap.id}`,
              swapUpdateData
            );
            swapInfo = {
              id: response.data.id,
              status: response.data.status,
              paymentTypes: data.swapPreferences.paymentTypes,
              acceptanceStrategy: data.swapPreferences.acceptanceStrategy,
            };
          } else {
            // Create new swap
            const swapData = this.mapSwapPreferencesToSwapData(data.swapPreferences, bookingId);
            const response: AxiosResponse<any> = await this.axiosInstance.post('/swaps/enhanced', swapData);
            swapInfo = {
              id: response.data.id,
              status: response.data.status,
              paymentTypes: data.swapPreferences.paymentTypes,
              acceptanceStrategy: data.swapPreferences.acceptanceStrategy,
            };
          }
        } else if (existingSwap && !data.swapEnabled) {
          // Disable swap if it exists but preferences are disabled
          await this.axiosInstance.post(`/swaps/${existingSwap.id}/cancel`, {
            reason: 'Swap disabled by user'
          });
        }
      } catch (swapError) {
        // If it's a 404, no existing swap exists, which is fine
        if (swapError.response?.status !== 404) {
          console.error('Failed to handle swap preferences:', swapError);
        }
      }

      return { booking, swap: swapInfo };
    } catch (error) {
      throw error;
    }
  }

  // Cache Management Methods
  /**
   * Invalidates cache entries. Can be called externally to force refresh after mutations.
   * @param pattern - Optional pattern to match cache keys (currently clears all cache)
   */
  public invalidateCache(pattern?: string): void {
    if (pattern) {
      // Since CacheService doesn't have invalidate by pattern, we'll clear all
      // In a production environment, you might want to implement pattern-based invalidation
      this.cacheService.clear();
    } else {
      this.cacheService.clear();
    }
  }

  // Real-time update setup
  private setupRealtimeListeners(): void {
    if (!this.realtimeConfig.enabled) return;

    // Setup event listeners for cache invalidation
    realtimeService.on('bookingUpdated', (data: any) => {
      this.invalidateCache(`booking-${data.bookingId}`);
      this.invalidateCache('bookings-with-swap');
      this.invalidateCache(`user-bookings-${data.userId}`);
    });

    realtimeService.on('swapStatusChanged', (data: any) => {
      this.invalidateCache(`swap-info-${data.bookingId}`);
      this.invalidateCache('bookings-with-swap');
    });

    realtimeService.on('proposalUpdated', (data: any) => {
      this.invalidateCache(`swap-info-${data.bookingId}`);
      this.invalidateCache('bookings-with-swap');
    });

    // Auto-connect to real-time service
    realtimeService.connect().catch(error => {
      console.warn('Failed to connect to real-time service:', error);
    });
  }

  // Public methods for event subscription (delegate to realtimeService)
  public addEventListener(event: string, callback: (data: any) => void): () => void {
    realtimeService.on(event, callback);

    // Return unsubscribe function
    return () => {
      realtimeService.off(event, callback);
    };
  }

  /**
   * Gets bookings with integrated swap information using optimized queries and caching
   * Requirements 2.1, 3.1: Enhanced listings with swap information and filtering
   */
  async getBookingsWithSwapInfo(
    filters: EnhancedBookingFilters,
    currentUserId: string
  ): Promise<BookingWithSwapInfo[]> {
    try {
      // Create cache key based on filters and user
      const cacheKey = this.createCacheKey('bookings-with-swap', { filters, currentUserId });

      // Check cache first
      const cachedResult = this.cacheService.get<BookingWithSwapInfo[]>(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      // Use optimized endpoint that returns bookings with swap info in a single request
      const queryParams = this.buildOptimizedQueryParams(filters, currentUserId);

      const response: AxiosResponse<{
        success: boolean;
        data: {
          bookings: BookingWithSwapInfo[];
          pagination: {
            limit: number;
            offset: number;
            total: number;
            hasMore: boolean;
          };
          includeSwapInfo: boolean;
        };
      }> = await this.axiosInstance.get('/bookings/with-swap-info', {
        params: queryParams
      });

      const bookings = response.data.data?.bookings || [];

      // Cache the result with shorter TTL for frequently changing data
      try {
        this.cacheService.set(cacheKey, bookings, 2 * 60 * 1000); // 2 minutes for dynamic data
      } catch (cacheError) {
        console.warn('Failed to cache bookings data:', cacheError);
        // Continue without caching
      }

      // Parse dates and ensure we always return an array
      const parsedBookings = Array.isArray(bookings) ? bookings.map(booking => this.parseBookingDates(booking)) : [];
      return parsedBookings;
    } catch (error) {
      // Fallback to individual requests if optimized endpoint fails
      console.warn('Optimized endpoint failed, falling back to individual requests:', error);
      try {
        const fallbackResult = await this.getBookingsWithSwapInfoFallback(filters, currentUserId);
        return Array.isArray(fallbackResult) ? fallbackResult : [];
      } catch (fallbackError) {
        console.error('Fallback method also failed:', fallbackError);
        return [];
      }
    }
  }

  /**
   * Fallback method using individual API calls (original implementation)
   */
  private async getBookingsWithSwapInfoFallback(
    filters: EnhancedBookingFilters,
    currentUserId: string
  ): Promise<BookingWithSwapInfo[]> {
    try {
      // Extract core booking filters
      const coreFilters = this.extractCoreBookingFilters(filters);

      // Get bookings using existing service
      let bookings = await bookingService.getBookings(coreFilters);

      // Ensure bookings is an array
      if (!Array.isArray(bookings)) {
        console.warn('getBookings returned non-array:', bookings);
        bookings = [];
      }

      // Additional safety check
      if (bookings.length === 0) {
        console.log('No bookings found, returning empty array');
        return [];
      }

      // Batch fetch swap information for better performance
      const swapInfoPromises = bookings.map(async (booking) => {
        const cacheKey = `swap-info-${booking.id}`;
        let swapInfo = this.cacheService.get<SwapInfo>(cacheKey);

        if (!swapInfo) {
          try {
            const swapInfoResponse = await this.axiosInstance.get(`/swaps/info/${booking.id}`);
            swapInfo = swapInfoResponse.data;
            try {
              this.cacheService.set(cacheKey, swapInfo, 3 * 60 * 1000); // 3 minutes for swap info
            } catch (cacheError) {
              console.warn('Failed to cache swap info:', cacheError);
            }
          } catch (error) {
            // No swap info available
            swapInfo = null;
          }
        }

        return { ...booking, swapInfo: swapInfo || undefined };
      });

      const bookingsWithSwapInfo = await Promise.all(swapInfoPromises);

      // Apply client-side filtering for swap-specific criteria
      let filteredBookings = this.applySwapFilters(bookingsWithSwapInfo, filters);

      // Apply browsing restrictions
      filteredBookings = this.applyBrowsingRestrictions(filteredBookings, currentUserId);

      // Apply sorting and pagination
      const result = this.applySortingAndPagination(filteredBookings, filters);
      return Array.isArray(result) ? result.map(booking => this.parseBookingDates(booking)) : [];
    } catch (error) {
      console.error('Fallback method failed:', error);
      return [];
    }
  }

  /**
   * Builds optimized query parameters for the enhanced endpoint
   */
  private buildOptimizedQueryParams(filters: EnhancedBookingFilters, currentUserId: string): Record<string, any> {
    const params: Record<string, any> = {
      userId: currentUserId,
      includeSwapInfo: true,
      limit: filters.limit || 20,
      offset: filters.offset || 0,
    };

    // Core booking filters
    if (filters.type?.length) {
      params.type = filters.type.join(',');
    }

    if (filters.location) {
      if (filters.location.city) params.city = filters.location.city;
      if (filters.location.country) params.country = filters.location.country;
      if (filters.location.radius) params.radius = filters.location.radius;
    }

    if (filters.dateRange) {
      if (filters.dateRange.start) params.startDate = filters.dateRange.start.toISOString();
      if (filters.dateRange.end) params.endDate = filters.dateRange.end.toISOString();
    }

    if (filters.priceRange) {
      if (filters.priceRange.min) params.minPrice = filters.priceRange.min;
      if (filters.priceRange.max) params.maxPrice = filters.priceRange.max;
    }

    // Swap-specific filters
    if (filters.swapAvailable) params.swapAvailable = true;
    if (filters.acceptsCash) params.acceptsCash = true;
    if (filters.auctionMode) params.auctionMode = true;
    if (filters.swapType) params.swapType = filters.swapType;
    if (filters.minCashAmount) params.minCashAmount = filters.minCashAmount;
    if (filters.maxCashAmount) params.maxCashAmount = filters.maxCashAmount;

    // Search and sorting
    if (filters.query) params.q = filters.query;
    if (filters.sortBy) params.sortBy = filters.sortBy;
    if (filters.sortOrder) params.sortOrder = filters.sortOrder;

    return params;
  }

  /**
   * Applies swap-specific filters on the client side
   */
  private applySwapFilters(bookings: BookingWithSwapInfo[], filters: EnhancedBookingFilters): BookingWithSwapInfo[] {
    let filtered = bookings;

    if (filters.swapAvailable) {
      filtered = filtered.filter(b => b.swapInfo?.hasActiveProposals);
    }

    if (filters.acceptsCash) {
      filtered = filtered.filter(b =>
        b.swapInfo?.paymentTypes.includes('cash')
      );
    }

    if (filters.auctionMode) {
      filtered = filtered.filter(b =>
        b.swapInfo?.acceptanceStrategy === 'auction' &&
        b.swapInfo?.auctionEndDate &&
        b.swapInfo.auctionEndDate > new Date()
      );
    }

    if (filters.minCashAmount) {
      filtered = filtered.filter(b =>
        !b.swapInfo?.minCashAmount || b.swapInfo.minCashAmount >= filters.minCashAmount!
      );
    }

    if (filters.maxCashAmount) {
      filtered = filtered.filter(b =>
        !b.swapInfo?.maxCashAmount || b.swapInfo.maxCashAmount <= filters.maxCashAmount!
      );
    }

    return filtered;
  }

  /**
   * Applies sorting and pagination to the filtered results
   */
  private applySortingAndPagination(bookings: BookingWithSwapInfo[], filters: EnhancedBookingFilters): BookingWithSwapInfo[] {
    let sorted = [...bookings];

    // Apply sorting if specified
    if (filters.sortBy) {
      sorted.sort((a, b) => {
        const order = filters.sortOrder === 'desc' ? -1 : 1;

        switch (filters.sortBy) {
          case 'created_date':
            return order * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          case 'event_date':
            return order * (new Date(a.dateRange.checkIn).getTime() - new Date(b.dateRange.checkIn).getTime());
          case 'price':
            return order * (a.originalPrice - b.originalPrice);
          case 'swap_value':
            return order * (a.swapValue - b.swapValue);
          case 'auction_end_date':
            const aEndDate = a.swapInfo?.auctionEndDate?.getTime() || 0;
            const bEndDate = b.swapInfo?.auctionEndDate?.getTime() || 0;
            return order * (aEndDate - bEndDate);
          default:
            return 0;
        }
      });
    }

    // Apply pagination
    const offset = filters.offset || 0;
    const limit = filters.limit || 20;
    return sorted.slice(offset, offset + limit);
  }

  /**
   * Creates a consistent cache key from parameters
   */
  private createCacheKey(prefix: string, params: any): string {
    const sortedParams = JSON.stringify(params, Object.keys(params).sort());
    return `${prefix}:${btoa(sortedParams)}`;
  }

  /**
   * Makes a proposal directly from booking listing with enhanced inline submission
   * Requirement 4.1: Quick proposal management from listings
   */
  async makeInlineProposal(
    bookingId: string,
    proposalData: InlineProposalData
  ): Promise<SwapProposal> {
    try {
      // Validate proposal data
      this.validateInlineProposalData(proposalData);

      // Check cache for swap info first
      const swapInfoCacheKey = `swap-info-${bookingId}`;
      let swapInfo = this.cacheService.get<SwapInfo>(swapInfoCacheKey);

      if (!swapInfo) {
        const swapInfoResponse = await this.axiosInstance.get(`/swaps/info/${bookingId}`);
        swapInfo = swapInfoResponse.data;
        try {
          this.cacheService.set(swapInfoCacheKey, swapInfo, 3 * 60 * 1000);
        } catch (cacheError) {
          console.warn('Failed to cache swap info:', cacheError);
        }
      }

      if (!swapInfo) {
        throw new BusinessLogicError(
          ERROR_CODES.SWAP_NOT_FOUND,
          'No active swap found for this booking'
        );
      }

      // Use enhanced proposal endpoint for better performance and validation
      const proposalPayload = {
        swapId: swapInfo.swapId,
        bookingId: bookingId,
        proposalType: proposalData.type,
        ...(proposalData.type === 'booking' ? {
          targetBookingId: proposalData.selectedBookingId,
        } : {
          cashOffer: {
            amount: proposalData.cashAmount,
            currency: 'USD',
            paymentMethodId: proposalData.paymentMethodId,
          }
        }),
        message: proposalData.message,
        conditions: proposalData.conditions || [],
        metadata: {
          source: 'inline_form',
          timestamp: new Date().toISOString(),
        }
      };

      const response: AxiosResponse<SwapProposal> = await this.axiosInstance.post(
        `/swaps/proposals/inline`,
        proposalPayload
      );

      // Invalidate relevant cache entries
      this.invalidateCache(`swap-info-${bookingId}`);
      this.invalidateCache('bookings-with-swap');

      // Emit real-time event for immediate UI updates
      this.notifyListeners('proposal_created', {
        bookingId,
        proposalId: response.data.id,
        proposalType: proposalData.type,
      });

      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Updates an existing proposal with enhanced validation and caching
   */
  async updateInlineProposal(
    proposalId: string,
    bookingId: string,
    updateData: Partial<InlineProposalData>
  ): Promise<SwapProposal> {
    try {
      const response: AxiosResponse<SwapProposal> = await this.axiosInstance.put(
        `/swaps/proposals/${proposalId}`,
        {
          ...updateData,
          metadata: {
            source: 'inline_form_update',
            timestamp: new Date().toISOString(),
          }
        }
      );

      // Invalidate cache
      this.invalidateCache(`swap-info-${bookingId}`);
      this.invalidateCache('bookings-with-swap');

      // Emit real-time event
      this.notifyListeners('proposal_updated', {
        bookingId,
        proposalId,
        updateType: 'modified',
      });

      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Withdraws a proposal with immediate cache invalidation
   */
  async withdrawInlineProposal(
    proposalId: string,
    bookingId: string,
    reason?: string
  ): Promise<void> {
    try {
      await this.axiosInstance.delete(`/swaps/proposals/${proposalId}`, {
        data: { reason }
      });

      // Invalidate cache
      this.invalidateCache(`swap-info-${bookingId}`);
      this.invalidateCache('bookings-with-swap');

      // Emit real-time event
      this.notifyListeners('proposal_updated', {
        bookingId,
        proposalId,
        updateType: 'withdrawn',
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gets real-time proposal status for a booking
   */
  async getProposalStatus(bookingId: string, proposalId: string): Promise<{
    status: string;
    lastUpdated: Date;
    competitorCount: number;
    userRanking?: number;
  }> {
    try {
      const response: AxiosResponse<any> = await this.axiosInstance.get(
        `/swaps/proposals/${proposalId}/status?bookingId=${bookingId}`
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Applies browsing restrictions to filter user's own bookings
   * Requirement 3.1: Streamlined booking discovery and filtering
   */
  private applyBrowsingRestrictions(
    bookings: BookingWithSwapInfo[],
    currentUserId: string
  ): BookingWithSwapInfo[] {
    return bookings.filter(booking => {
      // Don't show user's own bookings when browsing
      if (booking.userId === currentUserId) {
        return false;
      }

      // Don't show cancelled bookings
      if (booking.status === 'cancelled') {
        return false;
      }

      // Only show bookings with active swap proposals when swap filters are applied
      if (booking.swapInfo && !booking.swapInfo.hasActiveProposals) {
        return false;
      }

      return true;
    });
  }

  /**
   * Determines user role for a booking (owner, browser, proposer)
   */
  async getUserRoleForBooking(bookingId: string, userId: string): Promise<BookingUserRole> {
    try {
      const booking = await bookingService.getBooking(bookingId);

      if (booking.userId === userId) {
        return 'owner';
      }

      // Check if user has made proposals for this booking
      try {
        const swapInfoResponse = await this.axiosInstance.get(`/swaps/info/${bookingId}`);
        const swapInfo: SwapInfo = swapInfoResponse.data;

        if (swapInfo && swapInfo.userProposalStatus && swapInfo.userProposalStatus !== 'none') {
          return 'proposer';
        }
      } catch (error) {
        // No swap info or proposals, continue as browser
      }

      return 'browser';
    } catch (error) {
      return 'browser'; // Default to browser if we can't determine role
    }
  }

  /**
   * Gets user's available bookings for swap proposals with caching
   */
  async getUserAvailableBookings(userId: string, excludeBookingId?: string): Promise<Booking[]> {
    try {
      const cacheKey = `user-bookings-${userId}`;
      let userBookings = this.cacheService.get<Booking[]>(cacheKey);

      if (!userBookings) {
        userBookings = await bookingService.getUserBookings(userId);
        try {
          this.cacheService.set(cacheKey, userBookings, 5 * 60 * 1000); // 5 minutes
        } catch (cacheError) {
          console.warn('Failed to cache user bookings:', cacheError);
        }
      }

      return userBookings.filter(booking =>
        booking.status === 'available' &&
        booking.id !== excludeBookingId &&
        booking.verification.status === 'verified'
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Batch operation to get multiple bookings with swap info efficiently
   */
  async getBatchBookingsWithSwapInfo(bookingIds: string[]): Promise<BookingWithSwapInfo[]> {
    try {
      // Check cache for each booking first
      const cachedBookings: BookingWithSwapInfo[] = [];
      const uncachedIds: string[] = [];

      for (const id of bookingIds) {
        const cacheKey = `booking-with-swap-${id}`;
        const cached = this.cacheService.get<BookingWithSwapInfo>(cacheKey);
        if (cached) {
          cachedBookings.push(cached);
        } else {
          uncachedIds.push(id);
        }
      }

      // Fetch uncached bookings in batch
      let fetchedBookings: BookingWithSwapInfo[] = [];
      if (uncachedIds.length > 0) {
        const response: AxiosResponse<BookingWithSwapInfo[]> = await this.axiosInstance.post(
          '/bookings/batch-with-swap-info',
          { bookingIds: uncachedIds }
        );
        fetchedBookings = response.data;

        // Cache the fetched bookings
        fetchedBookings.forEach(booking => {
          const cacheKey = `booking-with-swap-${booking.id}`;
          try {
            this.cacheService.set(cacheKey, booking, 3 * 60 * 1000);
          } catch (cacheError) {
            console.warn('Failed to cache booking:', cacheError);
          }
        });
      }

      // Combine cached and fetched results, maintaining original order
      const allBookings = [...cachedBookings, ...fetchedBookings];
      return bookingIds.map(id => allBookings.find(b => b.id === id)!).filter(Boolean);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Real-time status monitoring for active swaps and auctions
   */
  async startRealtimeMonitoring(bookingIds: string[]): Promise<void> {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, cannot start real-time monitoring');
      return;
    }

    this.websocket.send(JSON.stringify({
      type: 'monitor_bookings',
      bookingIds: bookingIds
    }));
  }

  /**
   * Stop real-time monitoring for specific bookings
   */
  async stopRealtimeMonitoring(bookingIds: string[]): Promise<void> {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.websocket.send(JSON.stringify({
      type: 'unmonitor_bookings',
      bookingIds: bookingIds
    }));
  }

  /**
   * Get aggregated statistics for bookings with swap info
   */
  async getBookingSwapStatistics(filters?: EnhancedBookingFilters): Promise<{
    totalBookings: number;
    swappableBookings: number;
    activeAuctions: number;
    averageCashOffer: number;
    endingSoonCount: number;
  }> {
    try {
      const cacheKey = this.createCacheKey('booking-swap-stats', filters || {});
      let stats = this.cacheService.get<any>(cacheKey);

      if (!stats) {
        const params = filters ? this.buildOptimizedQueryParams(filters, '') : {};
        const response: AxiosResponse<any> = await this.axiosInstance.get(
          '/bookings/swap-statistics',
          { params }
        );
        stats = response.data;
        try {
          this.cacheService.set(cacheKey, stats, 10 * 60 * 1000); // 10 minutes for stats
        } catch (cacheError) {
          console.warn('Failed to cache stats:', cacheError);
        }
      }

      return stats;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Prefetch data for improved performance
   */
  async prefetchBookingData(bookingIds: string[]): Promise<void> {
    try {
      // Prefetch in background without blocking
      Promise.all([
        this.getBatchBookingsWithSwapInfo(bookingIds),
        ...bookingIds.map(id => this.axiosInstance.get(`/swaps/info/${id}`).catch(() => null))
      ]).catch(error => {
        console.warn('Prefetch failed:', error);
      });
    } catch (error) {
      // Prefetch failures should not affect main functionality
      console.warn('Prefetch error:', error);
    }
  }

  /**
   * Clear all cached data (useful for logout or data refresh)
   */
  public clearCache(): void {
    this.cacheService.clear();
  }

  /**
   * Get cache statistics for debugging
   */
  public getCacheStats() {
    return this.cacheService.getStats();
  }

  /**
   * Cleanup method to close connections and clear cache
   */
  public cleanup(): void {
    realtimeService.disconnect();
    this.cacheService.clear();
  }

  // Private helper methods

  private parseBookingDates(booking: any): any {
    return {
      ...booking,
      dateRange: {
        checkIn: new Date(booking.dateRange.checkIn),
        checkOut: new Date(booking.dateRange.checkOut),
      },
      createdAt: new Date(booking.createdAt),
      updatedAt: new Date(booking.updatedAt),
    };
  }

  private validateUnifiedBookingData(data: UnifiedBookingData): UnifiedFormValidationErrors {
    const errors: UnifiedFormValidationErrors = {};

    // Validate booking fields
    if (!data.title?.trim()) {
      errors.title = 'Title is required';
    }

    if (!data.description?.trim()) {
      errors.description = 'Description is required';
    }

    if (!data.location?.city || !data.location?.country) {
      errors.location = 'Location is required';
    }

    if (!data.dateRange?.checkIn || !data.dateRange?.checkOut) {
      errors.dateRange = 'Date range is required';
    } else if (data.dateRange.checkIn >= data.dateRange.checkOut) {
      errors.dateRange = 'Check-out date must be after check-in date';
    }

    if (!data.originalPrice || data.originalPrice <= 0) {
      errors.originalPrice = 'Original price must be greater than 0';
    }

    // Validate swap preferences if enabled
    if (data.swapEnabled && data.swapPreferences) {
      const prefs = data.swapPreferences;

      if (!prefs.paymentTypes || prefs.paymentTypes.length === 0) {
        errors.paymentTypes = 'At least one payment type must be selected';
      }

      if (prefs.paymentTypes.includes('cash') && (!prefs.minCashAmount || prefs.minCashAmount <= 0)) {
        errors.minCashAmount = 'Minimum cash amount is required for cash swaps';
      }

      if (prefs.acceptanceStrategy === 'auction') {
        if (!prefs.auctionEndDate) {
          errors.auctionEndDate = 'Auction end date is required';
        } else {
          const oneWeekBeforeEvent = new Date(data.dateRange.checkIn);
          oneWeekBeforeEvent.setDate(oneWeekBeforeEvent.getDate() - 7);
          if (prefs.auctionEndDate > oneWeekBeforeEvent) {
            errors.auctionEndDate = 'Auction must end at least one week before the event';
          }
        }
      }
    }

    return errors;
  }

  private validatePartialBookingData(data: Partial<UnifiedBookingData>): UnifiedFormValidationErrors {
    const errors: UnifiedFormValidationErrors = {};

    if (data.title !== undefined && !data.title?.trim()) {
      errors.title = 'Title cannot be empty';
    }

    if (data.description !== undefined && !data.description?.trim()) {
      errors.description = 'Description cannot be empty';
    }

    if (data.originalPrice !== undefined && (!data.originalPrice || data.originalPrice <= 0)) {
      errors.originalPrice = 'Original price must be greater than 0';
    }

    return errors;
  }

  private validateInlineProposalData(data: InlineProposalData): void {
    const errors: string[] = [];

    if (!data.type || !['booking', 'cash'].includes(data.type)) {
      errors.push('Valid proposal type is required');
    }

    if (data.type === 'booking' && !data.selectedBookingId) {
      errors.push('Selected booking is required for booking proposals');
    }

    if (data.type === 'cash') {
      if (!data.cashAmount || data.cashAmount <= 0) {
        errors.push('Cash amount must be greater than 0');
      }
      if (!data.paymentMethodId) {
        errors.push('Payment method is required for cash proposals');
      }
    }

    if (data.message && data.message.length > 500) {
      errors.push('Message must be less than 500 characters');
    }

    if (errors.length > 0) {
      throw new ValidationError('Invalid proposal data', { errors });
    }
  }

  private extractBookingData(data: UnifiedBookingData): any {
    return {
      type: data.type,
      title: data.title,
      description: data.description,
      location: data.location,
      dateRange: data.dateRange,
      originalPrice: data.originalPrice,
      swapValue: data.swapValue || data.originalPrice,
      providerDetails: data.providerDetails,
    };
  }

  private extractBookingUpdateData(data: Partial<UnifiedBookingData>): any {
    const updateData: any = {};

    // Core booking fields
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.originalPrice !== undefined) updateData.originalPrice = data.originalPrice;
    if (data.swapValue !== undefined) updateData.swapValue = data.swapValue;
    if (data.type !== undefined) updateData.type = data.type;

    // Location fields
    if (data.location !== undefined) {
      updateData.location = data.location;
    }

    // Date range fields
    if (data.dateRange !== undefined) {
      updateData.dateRange = data.dateRange;
    }

    // Provider details
    if (data.providerDetails !== undefined) {
      updateData.providerDetails = data.providerDetails;
    }

    return updateData;
  }

  private mapSwapPreferencesToSwapData(preferences: any, bookingId: string): any {
    return {
      sourceBookingId: bookingId,
      paymentTypes: {
        bookingExchange: preferences.paymentTypes.includes('booking'),
        cashPayment: preferences.paymentTypes.includes('cash'),
        minimumCashAmount: preferences.minCashAmount,
        preferredCashAmount: preferences.maxCashAmount,
      },
      acceptanceStrategy: {
        type: preferences.acceptanceStrategy,
        auctionEndDate: preferences.auctionEndDate,
        autoSelectHighest: preferences.acceptanceStrategy === 'auction',
      },
      swapConditions: preferences.swapConditions || [],
      expirationDate: preferences.auctionEndDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
    };
  }

  private extractCoreBookingFilters(filters: EnhancedBookingFilters): BookingFilters {
    const coreFilters: BookingFilters = {};

    if (filters.type) coreFilters.type = filters.type;
    if (filters.location) coreFilters.location = filters.location;
    if (filters.dateRange) {
      coreFilters.dateRange = {
        start: filters.dateRange.start!,
        end: filters.dateRange.end!,
      };
    }
    if (filters.priceRange) coreFilters.priceRange = filters.priceRange;

    return coreFilters;
  }
}

// Export singleton instance
export const unifiedBookingService = new UnifiedBookingService();