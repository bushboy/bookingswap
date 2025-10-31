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

// API Request/Response Types
export interface CreateBookingRequest {
  type: BookingType;
  title: string;
  description: string;
  location: BookingLocation;
  dateRange: BookingDateRange;
  originalPrice: number;
  swapValue: number;
  providerDetails: BookingProviderDetails;
  documents?: File[];
}

export interface UpdateBookingRequest {
  title?: string;
  description?: string;
  swapValue?: number;
  status?: BookingStatus;
}

export interface BookingFilters {
  type?: BookingType[];
  location?: {
    city?: string;
    country?: string;
    radius?: number; // km from coordinates
  };
  dateRange?: {
    start: Date;
    end: Date;
    flexible?: boolean;
  };
  priceRange?: {
    min: number;
    max: number;
  };
  status?: BookingStatus[];
  verificationStatus?: ('pending' | 'verified' | 'failed')[];
}

export interface SearchQuery {
  query?: string;
  filters?: BookingFilters;
  sortBy?: 'price' | 'date' | 'location' | 'created';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface BookingSearchResult {
  bookings: Booking[];
  total: number;
  page: number;
  totalPages: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Array<{
    field: string;
    message: string;
  }>;
}

// Extended types for swap management
export interface SwapWithBookings {
  id: string;
  sourceBooking: Booking;
  targetBooking?: Booking; // Optional for cash swaps
  owner: UserProfile;
  proposer: UserProfile;
  swapType: 'booking' | 'cash';
  cashDetails?: CashSwapDetails;
  hasActiveProposals: boolean;
  activeProposalCount: number;
  status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt?: string;
}

export interface UserProfile {
  id: string;
  name?: string;
  walletAddress?: string;
  verificationLevel?: 'basic' | 'verified' | 'premium';
  reputation?: number;
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

class BookingService {
  private baseURL: string;
  private axiosInstance;

  constructor() {
    this.baseURL =
      import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.axiosInstance.interceptors.request.use(
      config => {
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      error => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      response => response,
      error => {
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

  // CRUD Operations
  async getBookings(filters?: BookingFilters): Promise<Booking[]> {
    try {
      const params = this.buildFilterParams(filters);
      const response: AxiosResponse<{
        success: boolean;
        data: {
          bookings: Booking[];
          pagination?: any;
          searchCriteria?: any;
          filters?: any;
        };
      }> = await this.axiosInstance.get(
        '/bookings',
        { params }
      );

      // Extract bookings from the nested response structure and parse dates
      const bookings = response.data.data?.bookings || [];
      return bookings.map(booking => this.parseBookingDates(booking));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all available bookings without any user-based filtering
   * Maintains backward compatibility with existing code
   */
  async getAllBookings(): Promise<Booking[]> {
    try {
      return await this.getBookings();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get bookings excluding those owned by a specific user
   * Used for browse page filtering to hide user's own bookings
   * @param userId - The user ID to exclude from results
   * @returns Promise<Booking[]> - Array of bookings not owned by the specified user
   * @throws ValidationError if userId is not provided
   * @throws SwapPlatformError for network or server errors
   */
  async getBookingsExcludingUser(userId: string): Promise<Booking[]> {
    try {
      if (!userId || userId.trim() === '') {
        throw new ValidationError('User ID is required for filtering', {
          field: 'userId',
          message: 'User ID cannot be empty'
        });
      }

      const response: AxiosResponse<{
        success: boolean;
        data: {
          bookings: Booking[];
          pagination?: any;
          filters?: any;
        };
      }> = await this.axiosInstance.get('/bookings', {
        params: { excludeUserId: userId }
      });

      // Validate response structure
      if (!response.data || !response.data.success) {
        throw new SwapPlatformError(
          ERROR_CODES.INTERNAL_SERVER_ERROR,
          'Invalid response format from server',
          'server_error'
        );
      }

      // Extract bookings from the nested response structure and parse dates
      const bookings = response.data.data?.bookings || [];

      // Validate that we received an array
      if (!Array.isArray(bookings)) {
        throw new SwapPlatformError(
          ERROR_CODES.INTERNAL_SERVER_ERROR,
          'Invalid bookings data format',
          'server_error'
        );
      }

      return bookings.map(booking => this.parseBookingDates(booking));
    } catch (error) {
      // Re-throw known errors
      if (error instanceof SwapPlatformError || error instanceof ValidationError) {
        throw error;
      }

      // Handle and wrap unknown errors
      throw this.handleApiError(error);
    }
  }

  /**
   * Get bookings for browse page with conditional user filtering
   * If userId is provided, excludes user's own bookings
   * If userId is not provided, returns all bookings (for unauthenticated users)
   * @param userId - Optional user ID to exclude from results
   * @returns Promise<Booking[]> - Array of bookings appropriate for browsing
   * @throws SwapPlatformError for network or server errors
   */
  async getBrowseBookings(userId?: string): Promise<Booking[]> {
    try {
      if (userId && userId.trim() !== '') {
        return await this.getBookingsExcludingUser(userId);
      }
      return await this.getAllBookings();
    } catch (error) {
      // Re-throw known errors
      if (error instanceof SwapPlatformError || error instanceof ValidationError) {
        throw error;
      }

      // Handle and wrap unknown errors
      throw this.handleApiError(error);
    }
  }

  async getBooking(id: string): Promise<Booking> {
    try {
      const response: AxiosResponse<{
        success: boolean;
        data: {
          booking: Booking;
        };
      }> = await this.axiosInstance.get(
        `/bookings/${id}`
      );
      return this.parseBookingDates(response.data.data.booking);
    } catch (error) {
      throw error;
    }
  }

  async createBooking(data: CreateBookingRequest): Promise<Booking> {
    try {
      // Validate booking data before sending
      const validationResult = await this.validateBooking(data);
      if (!validationResult.isValid) {
        throw new ValidationError('Invalid booking data', {
          errors: validationResult.errors,
        });
      }

      // Handle file uploads if documents are provided
      let formData: FormData | CreateBookingRequest = data;
      if (data.documents && data.documents.length > 0) {
        formData = new FormData();

        // Append booking data
        Object.entries(data).forEach(([key, value]) => {
          if (key !== 'documents') {
            (formData as FormData).append(
              key,
              typeof value === 'object' ? JSON.stringify(value) : value
            );
          }
        });

        // Append files
        data.documents.forEach((file, index) => {
          (formData as FormData).append(`documents[${index}]`, file);
        });
      }

      const response: AxiosResponse<{
        success: boolean;
        data: {
          booking: Booking;
          blockchain?: any;
        };
      }> = await this.axiosInstance.post(
        '/bookings',
        formData,
        {
          headers:
            formData instanceof FormData
              ? { 'Content-Type': 'multipart/form-data' }
              : undefined,
        }
      );

      return this.parseBookingDates(response.data.data.booking);
    } catch (error) {
      throw error;
    }
  }

  async updateBooking(
    id: string,
    data: UpdateBookingRequest
  ): Promise<Booking> {
    try {
      const response: AxiosResponse<{
        success: boolean;
        data: {
          booking: Booking;
        };
      }> = await this.axiosInstance.put(
        `/bookings/${id}`,
        data
      );
      return this.parseBookingDates(response.data.data.booking);
    } catch (error) {
      throw error;
    }
  }

  async deleteBooking(id: string): Promise<void> {
    try {
      await this.axiosInstance.delete(`/bookings/${id}`);
    } catch (error) {
      throw error;
    }
  }

  // Search and Discovery
  async searchBookings(query: SearchQuery): Promise<BookingSearchResult> {
    try {
      const params = {
        ...this.buildFilterParams(query.filters),
        q: query.query,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
        page: query.page || 1,
        limit: query.limit || 20,
      };

      const response: AxiosResponse<BookingSearchResult> =
        await this.axiosInstance.get('/bookings/search', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getAvailableBookings(filters: BookingFilters): Promise<Booking[]> {
    try {
      const availableFilters = {
        ...filters,
        status: ['available'],
      };

      return await this.getBookings(availableFilters);
    } catch (error) {
      throw error;
    }
  }

  // Validation
  async validateBooking(data: CreateBookingRequest): Promise<ValidationResult> {
    const errors: Array<{ field: string; message: string }> = [];

    // Basic validation
    if (!data.title || data.title.trim().length === 0) {
      errors.push({ field: 'title', message: 'Title is required' });
    } else if (data.title.length > 200) {
      errors.push({
        field: 'title',
        message: 'Title must be less than 200 characters',
      });
    }

    if (!data.description || data.description.trim().length === 0) {
      errors.push({ field: 'description', message: 'Description is required' });
    } else if (data.description.length > 1000) {
      errors.push({
        field: 'description',
        message: 'Description must be less than 1000 characters',
      });
    }

    if (
      !data.type ||
      !['hotel', 'event', 'flight', 'rental', 'vacation_rental', 'resort', 'hostel', 'bnb'].includes(data.type)
    ) {
      errors.push({ field: 'type', message: 'Valid booking type is required' });
    }

    // Location validation
    if (!data.location?.city || data.location.city.trim().length === 0) {
      errors.push({ field: 'location.city', message: 'City is required' });
    }

    if (!data.location?.country || data.location.country.trim().length === 0) {
      errors.push({
        field: 'location.country',
        message: 'Country is required',
      });
    }

    // Date validation
    if (!data.dateRange?.checkIn) {
      errors.push({
        field: 'dateRange.checkIn',
        message: 'Check-in date is required',
      });
    } else if (new Date(data.dateRange.checkIn) <= new Date()) {
      errors.push({
        field: 'dateRange.checkIn',
        message: 'Check-in date must be in the future',
      });
    }

    if (!data.dateRange?.checkOut) {
      errors.push({
        field: 'dateRange.checkOut',
        message: 'Check-out date is required',
      });
    } else if (
      data.dateRange.checkIn &&
      new Date(data.dateRange.checkOut) <= new Date(data.dateRange.checkIn)
    ) {
      errors.push({
        field: 'dateRange.checkOut',
        message: 'Check-out date must be after check-in date',
      });
    }

    // Price validation
    if (!data.originalPrice || data.originalPrice <= 0) {
      errors.push({
        field: 'originalPrice',
        message: 'Original price must be greater than 0',
      });
    }

    if (!data.swapValue || data.swapValue <= 0) {
      errors.push({
        field: 'swapValue',
        message: 'Swap value must be greater than 0',
      });
    }

    // Provider details validation
    if (
      !data.providerDetails?.provider ||
      data.providerDetails.provider.trim().length === 0
    ) {
      errors.push({
        field: 'providerDetails.provider',
        message: 'Provider name is required',
      });
    }

    if (
      !data.providerDetails?.confirmationNumber ||
      data.providerDetails.confirmationNumber.trim().length === 0
    ) {
      errors.push({
        field: 'providerDetails.confirmationNumber',
        message: 'Confirmation number is required',
      });
    }

    // bookingReference is optional - no validation needed

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Helper Methods
  private parseBookingDates(booking: any): Booking {
    // Debug logging to see the actual data structure
    console.log('parseBookingDates - input booking:', {
      id: booking.id,
      location: booking.location,
      dateRange: booking.dateRange,
      locationType: typeof booking.location,
      dateRangeType: typeof booking.dateRange,
    });

    // Handle cases where dates might already be Date objects (e.g., in tests)
    const parsedBooking = {
      ...booking,
      dateRange: {
        checkIn: booking.dateRange?.checkIn instanceof Date
          ? booking.dateRange.checkIn
          : new Date(booking.dateRange?.checkIn),
        checkOut: booking.dateRange?.checkOut instanceof Date
          ? booking.dateRange.checkOut
          : new Date(booking.dateRange?.checkOut),
      },
      createdAt: booking.createdAt instanceof Date
        ? booking.createdAt
        : new Date(booking.createdAt),
      updatedAt: booking.updatedAt instanceof Date
        ? booking.updatedAt
        : new Date(booking.updatedAt),
    };

    console.log('parseBookingDates - parsed booking:', {
      id: parsedBooking.id,
      location: parsedBooking.location,
      dateRange: parsedBooking.dateRange,
    });

    return parsedBooking;
  }

  private buildFilterParams(filters?: BookingFilters): Record<string, any> {
    if (!filters) return {};

    const params: Record<string, any> = {};

    if (filters.type && filters.type.length > 0) {
      params.type = filters.type.join(',');
    }

    if (filters.status && filters.status.length > 0) {
      params.status = filters.status.join(',');
    }

    if (filters.verificationStatus && filters.verificationStatus.length > 0) {
      params.verificationStatus = filters.verificationStatus.join(',');
    }

    if (filters.location) {
      if (filters.location.city) {
        params.city = filters.location.city;
      }
      if (filters.location.country) {
        params.country = filters.location.country;
      }
      if (filters.location.radius) {
        params.radius = filters.location.radius;
      }
    }

    if (filters.dateRange) {
      params.startDate = filters.dateRange.start.toISOString();
      params.endDate = filters.dateRange.end.toISOString();
      if (filters.dateRange.flexible) {
        params.flexible = 'true';
      }
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

  // Utility method to check if booking can be modified
  async canModifyBooking(bookingId: string): Promise<boolean> {
    try {
      const booking = await this.getBooking(bookingId);
      return booking.status === 'available';
    } catch (error) {
      return false;
    }
  }

  // Utility method to check if booking can be swapped
  async canSwapBooking(bookingId: string): Promise<boolean> {
    try {
      const booking = await this.getBooking(bookingId);
      return (
        booking.status === 'available' &&
        booking.verification.status === 'verified'
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Enable swapping for a booking and mint NFT
   */
  async enableSwapping(bookingId: string, walletAddress?: string): Promise<{ booking: Booking; nft?: any }> {
    try {
      const response: AxiosResponse<{
        success: boolean;
        data: {
          booking: Booking;
          nft?: {
            tokenId: string;
            serialNumber: number;
            transactionId: string;
          };
        };
      }> = await this.axiosInstance.post(`/bookings/${bookingId}/enable-swapping`, {
        walletAddress,
      });

      return {
        booking: this.parseBookingDates(response.data.data.booking),
        nft: response.data.data.nft,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Disable swapping for a booking and burn NFT
   */
  async disableSwapping(bookingId: string): Promise<Booking> {
    try {
      const response: AxiosResponse<{
        success: boolean;
        data: {
          booking: Booking;
        };
      }> = await this.axiosInstance.post(`/bookings/${bookingId}/disable-swapping`);

      return this.parseBookingDates(response.data.data.booking);
    } catch (error) {
      throw error;
    }
  }
}

export const bookingService = new BookingService();
