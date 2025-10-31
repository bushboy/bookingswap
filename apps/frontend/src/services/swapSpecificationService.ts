/**
 * Swap Specification Service - Handles pure swap operations without booking functionality
 * This service is separated from booking operations to provide focused swap management
 */

import axios, { AxiosResponse } from 'axios';
import {
  SwapSpecificationData,
  SwapSpecificationUpdateData,
  SwapSpecificationErrors,
  CreateSwapSpecificationRequest,
  UpdateSwapSpecificationRequest,
  SwapSpecificationResponse,
  SwapSpecificationContext,
  SwapPlatformError,
  ValidationError,
  BusinessLogicError,
  ERROR_CODES,
} from '@booking-swap/shared';
import {
  validateSwapSpecificationData,
  validateSwapSpecificationUpdateData,
  validateCreateSwapSpecificationRequest,
  validateWalletRequirements,
  hasSwapSpecificationErrors,
  sanitizeSwapSpecificationData,
} from '@booking-swap/shared';

export interface SwapSpecificationServiceFilters {
  status?: string[];
  paymentTypes?: ('booking' | 'cash')[];
  acceptanceStrategy?: string[];
  auctionStatus?: ('active' | 'ending_soon' | 'ended')[];
}

class SwapSpecificationService {
  private baseURL: string;
  private axiosInstance;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
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
            data.error?.message || 'Invalid swap specification data',
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
            'Swap specification not found'
          );
        case 409:
          return new BusinessLogicError(
            ERROR_CODES.INVALID_SWAP_STATE,
            'Swap specification cannot be modified in current state'
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
   * Creates a new swap specification for a booking
   */
  async createSwapSpecification(data: CreateSwapSpecificationRequest, walletConnected: boolean = false): Promise<SwapSpecificationResponse> {
    try {
      // Validate swap specification data
      const validationErrors = validateCreateSwapSpecificationRequest(data);
      if (hasSwapSpecificationErrors(validationErrors)) {
        throw new ValidationError('Invalid swap specification data', { errors: validationErrors });
      }

      // Validate wallet requirements
      const walletErrors = validateWalletRequirements(
        { ...data, swapEnabled: true },
        walletConnected
      );
      if (hasSwapSpecificationErrors(walletErrors)) {
        throw new ValidationError('Wallet validation failed', { errors: walletErrors });
      }

      // Sanitize data
      const sanitizedData = sanitizeSwapSpecificationData(data);

      const response: AxiosResponse<{
        success: boolean;
        data: {
          swapSpecification: any;
          nftInfo?: any;
          validationWarnings?: string[];
        };
      }> = await this.axiosInstance.post('/swaps/specification', sanitizedData);

      return {
        swapSpecification: response.data.data.swapSpecification,
        nftInfo: response.data.data.nftInfo,
        validationWarnings: response.data.data.validationWarnings,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Updates an existing swap specification
   */
  async updateSwapSpecification(swapId: string, data: UpdateSwapSpecificationRequest): Promise<SwapSpecificationResponse> {
    try {
      // Validate update data
      const validationErrors = validateSwapSpecificationUpdateData(data);
      if (hasSwapSpecificationErrors(validationErrors)) {
        throw new ValidationError('Invalid swap specification update data', { errors: validationErrors });
      }

      const response: AxiosResponse<{
        success: boolean;
        data: {
          swapSpecification: any;
          validationWarnings?: string[];
        };
      }> = await this.axiosInstance.put(`/swaps/specification/${swapId}`, data);

      return {
        swapSpecification: response.data.data.swapSpecification,
        validationWarnings: response.data.data.validationWarnings,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Updates swap specification with partial failure recovery
   * Handles scenarios where some fields update successfully but others fail
   */
  async updateSwapSpecificationWithRecovery(
    swapId: string,
    data: UpdateSwapSpecificationRequest
  ): Promise<{
    success: boolean;
    swapSpecification?: SwapSpecificationResponse['swapSpecification'];
    partialFailures?: Array<{
      field: string;
      error: string;
      originalValue?: any;
    }>;
    validationWarnings?: string[];
  }> {
    try {
      // First attempt normal update
      const result = await this.updateSwapSpecification(swapId, data);
      return {
        success: true,
        swapSpecification: result.swapSpecification,
        validationWarnings: result.validationWarnings,
      };
    } catch (error) {
      // If update fails, attempt field-by-field recovery
      if (error instanceof ValidationError) {
        return await this.attemptPartialSwapUpdate(swapId, data, error);
      }
      throw error;
    }
  }

  /**
   * Attempts to update swap specification fields individually to identify which ones fail
   */
  private async attemptPartialSwapUpdate(
    swapId: string,
    data: UpdateSwapSpecificationRequest,
    originalError: ValidationError
  ): Promise<{
    success: boolean;
    swapSpecification?: SwapSpecificationResponse['swapSpecification'];
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

    let lastSuccessfulSwapSpec: SwapSpecificationResponse['swapSpecification'] | undefined;

    // Try updating each field individually
    const fields = Object.keys(data) as Array<keyof UpdateSwapSpecificationRequest>;
    
    for (const field of fields) {
      if (data[field] !== undefined) {
        try {
          const singleFieldUpdate = { [field]: data[field] } as UpdateSwapSpecificationRequest;
          const result = await this.updateSwapSpecification(swapId, singleFieldUpdate);
          lastSuccessfulSwapSpec = result.swapSpecification;
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
      swapSpecification: lastSuccessfulSwapSpec,
      partialFailures,
    };
  }

  /**
   * Gets swap specification by booking ID
   */
  async getSwapSpecificationByBooking(bookingId: string): Promise<SwapSpecificationData & { id: string; status: string; createdAt: Date; updatedAt: Date } | null> {
    try {
      const response: AxiosResponse<{
        success: boolean;
        data: {
          swapSpecification: any;
        };
      }> = await this.axiosInstance.get(`/swaps/specification/by-booking/${bookingId}`);

      return response.data.data.swapSpecification;
    } catch (error) {
      if (error.response?.status === 404) {
        return null; // No swap specification found
      }
      throw error;
    }
  }

  /**
   * Gets swap specification by swap ID
   */
  async getSwapSpecification(swapId: string): Promise<SwapSpecificationData & { id: string; status: string; createdAt: Date; updatedAt: Date }> {
    try {
      const response: AxiosResponse<{
        success: boolean;
        data: {
          swapSpecification: any;
        };
      }> = await this.axiosInstance.get(`/swaps/specification/${swapId}`);

      return response.data.data.swapSpecification;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gets swap specification context (booking info + existing swap info)
   */
  async getSwapSpecificationContext(bookingId: string): Promise<SwapSpecificationContext> {
    try {
      const response: AxiosResponse<{
        success: boolean;
        data: SwapSpecificationContext;
      }> = await this.axiosInstance.get(`/swaps/specification/context/${bookingId}`);

      // Parse dates in the response
      const context = response.data.data;
      return {
        ...context,
        booking: {
          ...context.booking,
          dateRange: {
            checkIn: new Date(context.booking.dateRange.checkIn),
            checkOut: new Date(context.booking.dateRange.checkOut),
          },
        },
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Enables swapping for a booking (creates swap specification and mints NFT)
   */
  async enableSwapping(bookingId: string, swapData: SwapSpecificationData, walletAddress?: string): Promise<SwapSpecificationResponse> {
    try {
      // Validate swap data
      const validationErrors = validateSwapSpecificationData(swapData);
      if (hasSwapSpecificationErrors(validationErrors)) {
        throw new ValidationError('Invalid swap specification data', { errors: validationErrors });
      }

      const response: AxiosResponse<{
        success: boolean;
        data: {
          swapSpecification: any;
          nftInfo?: any;
          validationWarnings?: string[];
        };
      }> = await this.axiosInstance.post(`/bookings/${bookingId}/enable-swapping`, {
        swapSpecification: swapData,
        walletAddress,
      });

      return {
        swapSpecification: response.data.data.swapSpecification,
        nftInfo: response.data.data.nftInfo,
        validationWarnings: response.data.data.validationWarnings,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Disables swapping for a booking (removes swap specification and burns NFT)
   */
  async disableSwapping(bookingId: string): Promise<void> {
    try {
      await this.axiosInstance.post(`/bookings/${bookingId}/disable-swapping`);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gets user's swap specifications with filtering
   */
  async getUserSwapSpecifications(userId: string, filters?: SwapSpecificationServiceFilters): Promise<(SwapSpecificationData & { id: string; status: string; createdAt: Date; updatedAt: Date })[]> {
    try {
      const params = this.buildFilterParams(filters);
      params.userId = userId;

      const response: AxiosResponse<{
        success: boolean;
        data: {
          swapSpecifications: any[];
        };
      }> = await this.axiosInstance.get('/swaps/specification', { params });

      return response.data.data.swapSpecifications || [];
    } catch (error) {
      throw error;
    }
  }

  /**
   * Validates swap specification data without making API calls
   */
  validateSwapSpecificationData(data: SwapSpecificationData): SwapSpecificationErrors {
    return validateSwapSpecificationData(data);
  }

  /**
   * Validates swap specification update data without making API calls
   */
  validateSwapSpecificationUpdateData(data: SwapSpecificationUpdateData): SwapSpecificationErrors {
    return validateSwapSpecificationUpdateData(data);
  }

  /**
   * Checks if a swap specification can be modified
   */
  async canModifySwapSpecification(swapId: string): Promise<{ canModify: boolean; reason?: string }> {
    try {
      const response: AxiosResponse<{
        success: boolean;
        data: {
          canModify: boolean;
          reason?: string;
        };
      }> = await this.axiosInstance.get(`/swaps/specification/${swapId}/can-modify`);

      return response.data.data;
    } catch (error) {
      return { canModify: false, reason: 'Unable to verify modification permissions' };
    }
  }

  /**
   * Gets swap specification modification history
   */
  async getSwapSpecificationHistory(swapId: string): Promise<Array<{
    id: string;
    changes: Record<string, { from: any; to: any }>;
    modifiedAt: Date;
    modifiedBy: string;
  }>> {
    try {
      const response: AxiosResponse<{
        success: boolean;
        data: {
          history: any[];
        };
      }> = await this.axiosInstance.get(`/swaps/specification/${swapId}/history`);

      return response.data.data.history.map(entry => ({
        ...entry,
        modifiedAt: new Date(entry.modifiedAt),
      }));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gets active auction information for a swap specification
   */
  async getAuctionInfo(swapId: string): Promise<{
    auctionId: string;
    endDate: Date;
    currentHighestBid?: number;
    bidCount: number;
    timeRemaining: number;
  } | null> {
    try {
      const response: AxiosResponse<{
        success: boolean;
        data: {
          auction: any;
        };
      }> = await this.axiosInstance.get(`/swaps/specification/${swapId}/auction`);

      const auction = response.data.data.auction;
      if (!auction) return null;

      return {
        ...auction,
        endDate: new Date(auction.endDate),
      };
    } catch (error) {
      if (error.response?.status === 404) {
        return null; // No active auction
      }
      throw error;
    }
  }

  // Helper Methods
  private buildFilterParams(filters?: SwapSpecificationServiceFilters): Record<string, any> {
    if (!filters) return {};

    const params: Record<string, any> = {};

    if (filters.status && filters.status.length > 0) {
      params.status = filters.status.join(',');
    }

    if (filters.paymentTypes && filters.paymentTypes.length > 0) {
      params.paymentTypes = filters.paymentTypes.join(',');
    }

    if (filters.acceptanceStrategy && filters.acceptanceStrategy.length > 0) {
      params.acceptanceStrategy = filters.acceptanceStrategy.join(',');
    }

    if (filters.auctionStatus && filters.auctionStatus.length > 0) {
      params.auctionStatus = filters.auctionStatus.join(',');
    }

    return params;
  }
}

export const swapSpecificationService = new SwapSpecificationService();