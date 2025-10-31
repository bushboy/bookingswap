/**
 * Booking Edit Service - Handles pure booking operations without swap functionality
 * This service is separated from swap operations to provide focused booking management
 */

import axios, { AxiosResponse } from 'axios';
import {
  BookingEditData,
  BookingEditUpdateData,
  BookingEditErrors,
  CreateBookingEditRequest,
  UpdateBookingEditRequest,
  BookingEditResponse,
  SwapPlatformError,
  ValidationError,
  BusinessLogicError,
  ERROR_CODES,
} from '@booking-swap/shared';
import {
  validateBookingEditData,
  validateBookingEditUpdateData,
  validateCreateBookingEditRequest,
  hasBookingEditErrors,
  sanitizeBookingEditData,
} from '@booking-swap/shared';

export interface BookingEditServiceFilters {
  type?: string[];
  location?: {
    city?: string;
    country?: string;
    radius?: number;
  };
  dateRange?: {
    start: Date;
    end: Date;
  };
  priceRange?: {
    min: number;
    max: number;
  };
  status?: string[];
}

class BookingEditService {
  private baseURL: string;
  private axiosInstance;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
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
            data.error?.message || 'Invalid booking data',
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
            'Booking cannot be modified - it has active swap proposals'
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
   * Creates a new booking with only booking data (no swap functionality)
   */
  async createBooking(data: CreateBookingEditRequest): Promise<BookingEditResponse> {
    try {
      // Validate booking data
      const validationErrors = validateCreateBookingEditRequest(data);
      if (hasBookingEditErrors(validationErrors)) {
        throw new ValidationError('Invalid booking data', { errors: validationErrors });
      }

      // Sanitize data
      const sanitizedData = sanitizeBookingEditData(data);

      // Handle file uploads if documents are provided
      let formData: FormData | CreateBookingEditRequest = sanitizedData;
      if (data.documents && data.documents.length > 0) {
        formData = new FormData();

        // Append booking data
        Object.entries(sanitizedData).forEach(([key, value]) => {
          (formData as FormData).append(
            key,
            typeof value === 'object' ? JSON.stringify(value) : value
          );
        });

        // Append files
        data.documents.forEach((file, index) => {
          (formData as FormData).append(`documents[${index}]`, file);
        });
      }

      const response: AxiosResponse<{
        success: boolean;
        data: {
          booking: any;
          blockchain?: any;
        };
      }> = await this.axiosInstance.post('/bookings/edit-only', formData, {
        headers:
          formData instanceof FormData
            ? { 'Content-Type': 'multipart/form-data' }
            : undefined,
      });

      return {
        booking: this.parseBookingDates(response.data.data.booking),
        validationWarnings: response.data.data.validationWarnings,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Updates an existing booking with only booking data (no swap changes)
   */
  async updateBooking(bookingId: string, data: UpdateBookingEditRequest): Promise<BookingEditResponse> {
    try {
      // Validate update data
      const validationErrors = validateBookingEditUpdateData(data);
      if (hasBookingEditErrors(validationErrors)) {
        throw new ValidationError('Invalid booking update data', { errors: validationErrors });
      }

      const response: AxiosResponse<{
        success: boolean;
        data: {
          booking: any;
          validationWarnings?: string[];
        };
      }> = await this.axiosInstance.put(`/bookings/${bookingId}/edit-only`, data);

      return {
        booking: this.parseBookingDates(response.data.data.booking),
        validationWarnings: response.data.data.validationWarnings,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Updates booking data with partial failure recovery
   * Handles scenarios where some fields update successfully but others fail
   */
  async updateBookingWithRecovery(
    bookingId: string, 
    data: UpdateBookingEditRequest
  ): Promise<{
    success: boolean;
    booking?: BookingEditResponse['booking'];
    partialFailures?: Array<{
      field: string;
      error: string;
      originalValue?: any;
    }>;
    validationWarnings?: string[];
  }> {
    try {
      // First attempt normal update
      const result = await this.updateBooking(bookingId, data);
      return {
        success: true,
        booking: result.booking,
        validationWarnings: result.validationWarnings,
      };
    } catch (error) {
      // If update fails, attempt field-by-field recovery
      if (error instanceof ValidationError) {
        return await this.attemptPartialUpdate(bookingId, data, error);
      }
      throw error;
    }
  }

  /**
   * Attempts to update booking fields individually to identify which ones fail
   */
  private async attemptPartialUpdate(
    bookingId: string,
    data: UpdateBookingEditRequest,
    originalError: ValidationError
  ): Promise<{
    success: boolean;
    booking?: BookingEditResponse['booking'];
    partialFailures: Array<{
      field: string;
      error: string;
      originalValue?: any;
    }>;
  }> {
    const partialFailures: Array<{
      field: string;
      error: string;
      originalValue?: any;
    }> = [];

    let lastSuccessfulBooking: BookingEditResponse['booking'] | undefined;

    // Try updating each field individually
    const fields = Object.keys(data) as Array<keyof UpdateBookingEditRequest>;
    
    for (const field of fields) {
      if (data[field] !== undefined) {
        try {
          const singleFieldUpdate = { [field]: data[field] } as UpdateBookingEditRequest;
          const result = await this.updateBooking(bookingId, singleFieldUpdate);
          lastSuccessfulBooking = result.booking;
        } catch (fieldError) {
          partialFailures.push({
            field: field as string,
            error: fieldError instanceof Error ? fieldError.message : 'Unknown error',
            originalValue: data[field],
          });
        }
      }
    }

    return {
      success: partialFailures.length === 0,
      booking: lastSuccessfulBooking,
      partialFailures,
    };
  }

  /**
   * Gets a booking by ID with only booking data (no swap info)
   */
  async getBooking(bookingId: string): Promise<BookingEditData & { id: string; userId: string; status: string; createdAt: Date; updatedAt: Date }> {
    try {
      const response: AxiosResponse<{
        success: boolean;
        data: {
          booking: any;
        };
      }> = await this.axiosInstance.get(`/bookings/${bookingId}/edit-only`);

      return this.parseBookingDates(response.data.data.booking);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gets user's bookings with only booking data (no swap info)
   */
  async getUserBookings(userId: string, filters?: BookingEditServiceFilters): Promise<(BookingEditData & { id: string; userId: string; status: string; createdAt: Date; updatedAt: Date })[]> {
    try {
      const params = this.buildFilterParams(filters);
      params.userId = userId;

      const response: AxiosResponse<{
        success: boolean;
        data: {
          bookings: any[];
        };
      }> = await this.axiosInstance.get('/bookings/edit-only', { params });

      const bookings = response.data.data?.bookings || [];
      return bookings.map(booking => this.parseBookingDates(booking));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Deletes a booking (only if it has no active swap proposals)
   */
  async deleteBooking(bookingId: string): Promise<void> {
    try {
      await this.axiosInstance.delete(`/bookings/${bookingId}/edit-only`);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Validates booking data without making API calls
   */
  validateBookingData(data: BookingEditData): BookingEditErrors {
    return validateBookingEditData(data);
  }

  /**
   * Validates booking update data without making API calls
   */
  validateBookingUpdateData(data: BookingEditUpdateData): BookingEditErrors {
    return validateBookingEditUpdateData(data);
  }

  /**
   * Checks if a booking can be edited (no active swap proposals)
   */
  async canEditBooking(bookingId: string): Promise<{ canEdit: boolean; reason?: string }> {
    try {
      const response: AxiosResponse<{
        success: boolean;
        data: {
          canEdit: boolean;
          reason?: string;
        };
      }> = await this.axiosInstance.get(`/bookings/${bookingId}/can-edit`);

      return response.data.data;
    } catch (error) {
      return { canEdit: false, reason: 'Unable to verify edit permissions' };
    }
  }

  /**
   * Gets booking edit history
   */
  async getBookingEditHistory(bookingId: string): Promise<Array<{
    id: string;
    changes: Record<string, { from: any; to: any }>;
    editedAt: Date;
    editedBy: string;
  }>> {
    try {
      const response: AxiosResponse<{
        success: boolean;
        data: {
          history: any[];
        };
      }> = await this.axiosInstance.get(`/bookings/${bookingId}/edit-history`);

      return response.data.data.history.map(entry => ({
        ...entry,
        editedAt: new Date(entry.editedAt),
      }));
    } catch (error) {
      throw error;
    }
  }

  // Helper Methods
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

  private buildFilterParams(filters?: BookingEditServiceFilters): Record<string, any> {
    if (!filters) return {};

    const params: Record<string, any> = {};

    if (filters.type && filters.type.length > 0) {
      params.type = filters.type.join(',');
    }

    if (filters.status && filters.status.length > 0) {
      params.status = filters.status.join(',');
    }

    if (filters.location) {
      if (filters.location.city) params.city = filters.location.city;
      if (filters.location.country) params.country = filters.location.country;
      if (filters.location.radius) params.radius = filters.location.radius;
    }

    if (filters.dateRange) {
      params.startDate = filters.dateRange.start.toISOString();
      params.endDate = filters.dateRange.end.toISOString();
    }

    if (filters.priceRange) {
      if (filters.priceRange.min) params.minPrice = filters.priceRange.min;
      if (filters.priceRange.max) params.maxPrice = filters.priceRange.max;
    }

    return params;
  }
}

export const bookingEditService = new BookingEditService();