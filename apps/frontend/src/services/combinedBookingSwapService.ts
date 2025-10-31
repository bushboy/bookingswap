/**
 * Combined Booking Swap Service - Handles operations that require both booking and swap data
 * This service coordinates between booking and swap operations for atomic updates
 */

import axios, { AxiosResponse } from 'axios';
import {
  BookingWithSwapUpdate,
  BookingWithSwapPartialUpdate,
  CreateBookingWithSwapRequest,
  UpdateBookingWithSwapRequest,
  BookingWithSwapResponse,
  CombinedValidationErrors,
  AtomicBookingSwapOperation,
  SwapPlatformError,
  ValidationError,
  BusinessLogicError,
  ERROR_CODES,
} from '@booking-swap/shared';
import {
  validateBookingWithSwapUpdate,
  validateBookingWithSwapPartialUpdate,
  validateCreateBookingWithSwapRequest,
  hasCombinedValidationErrors,
  validateDataModelSeparation,
} from '@booking-swap/shared';
import { bookingEditService } from './bookingEditService';
import { swapSpecificationService } from './swapSpecificationService';

export interface CombinedOperationResult {
  success: boolean;
  booking?: any;
  swap?: any;
  errors?: CombinedValidationErrors;
  rollbackPerformed?: boolean;
}

class CombinedBookingSwapService {
  private baseURL: string;
  private axiosInstance;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: 20000, // Longer timeout for combined operations
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
            data.error?.message || 'Invalid combined operation data',
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
            'Booking or swap not found'
          );
        case 409:
          return new BusinessLogicError(
            ERROR_CODES.INVALID_SWAP_STATE,
            'Combined operation failed due to conflicting state'
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
   * Creates a booking with immediate swap specification in a single atomic operation
   */
  async createBookingWithSwap(data: CreateBookingWithSwapRequest): Promise<BookingWithSwapResponse> {
    try {
      // Validate combined data
      const validationErrors = validateCreateBookingWithSwapRequest(data);
      if (hasCombinedValidationErrors(validationErrors)) {
        throw new ValidationError('Invalid combined booking and swap data', { errors: validationErrors });
      }

      // Validate data model separation
      const separationErrors = validateDataModelSeparation(data.bookingData, data.swapData);
      if (separationErrors.length > 0) {
        throw new ValidationError('Data model separation violation', { errors: separationErrors });
      }

      // Use atomic endpoint for combined operation
      const response: AxiosResponse<{
        success: boolean;
        data: {
          booking: any;
          swap?: any;
          nftInfo?: any;
          validationWarnings?: string[];
        };
      }> = await this.axiosInstance.post('/bookings/with-swap/atomic', data);

      return {
        booking: this.parseBookingDates(response.data.data.booking),
        swap: response.data.data.swap,
        nftInfo: response.data.data.nftInfo,
        validationWarnings: response.data.data.validationWarnings,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Updates both booking and swap data in a single atomic operation
   */
  async updateBookingWithSwap(
    bookingId: string,
    data: UpdateBookingWithSwapRequest
  ): Promise<BookingWithSwapResponse> {
    try {
      // Validate update data
      const validationErrors = validateBookingWithSwapPartialUpdate(data);
      if (hasCombinedValidationErrors(validationErrors)) {
        throw new ValidationError('Invalid combined update data', { errors: validationErrors });
      }

      // Validate data model separation if both data types are present
      if (data.bookingData && data.swapData) {
        const separationErrors = validateDataModelSeparation(data.bookingData, data.swapData);
        if (separationErrors.length > 0) {
          throw new ValidationError('Data model separation violation', { errors: separationErrors });
        }
      }

      const response: AxiosResponse<{
        success: boolean;
        data: {
          booking: any;
          swap?: any;
          validationWarnings?: string[];
        };
      }> = await this.axiosInstance.put(`/bookings/${bookingId}/with-swap/atomic`, data);

      return {
        booking: this.parseBookingDates(response.data.data.booking),
        swap: response.data.data.swap,
        validationWarnings: response.data.data.validationWarnings,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Performs atomic operation with manual rollback strategy
   */
  async performAtomicOperation(operation: AtomicBookingSwapOperation): Promise<CombinedOperationResult> {
    let bookingResult: any = null;
    let swapResult: any = null;
    let rollbackPerformed = false;

    try {
      // Validate the operation
      if (operation.bookingChanges && operation.swapChanges) {
        const separationErrors = validateDataModelSeparation(operation.bookingChanges, operation.swapChanges);
        if (separationErrors.length > 0) {
          throw new ValidationError('Data model separation violation', { errors: separationErrors });
        }
      }

      // Execute operations based on rollback strategy
      switch (operation.rollbackStrategy) {
        case 'booking_first':
          bookingResult = await this.executeBookingOperation(operation);
          try {
            swapResult = await this.executeSwapOperation(operation);
          } catch (swapError) {
            // Rollback booking changes
            await this.rollbackBookingOperation(operation, bookingResult);
            rollbackPerformed = true;
            throw swapError;
          }
          break;

        case 'swap_first':
          swapResult = await this.executeSwapOperation(operation);
          try {
            bookingResult = await this.executeBookingOperation(operation);
          } catch (bookingError) {
            // Rollback swap changes
            await this.rollbackSwapOperation(operation, swapResult);
            rollbackPerformed = true;
            throw bookingError;
          }
          break;

        case 'transaction':
          // Use database transaction endpoint
          const response: AxiosResponse<{
            success: boolean;
            data: {
              booking?: any;
              swap?: any;
            };
          }> = await this.axiosInstance.post('/operations/atomic-transaction', operation);
          
          bookingResult = response.data.data.booking;
          swapResult = response.data.data.swap;
          break;

        default:
          throw new ValidationError('Invalid rollback strategy', { field: 'rollbackStrategy' });
      }

      return {
        success: true,
        booking: bookingResult,
        swap: swapResult,
        rollbackPerformed,
      };
    } catch (error) {
      return {
        success: false,
        errors: error instanceof ValidationError ? error.details : undefined,
        rollbackPerformed,
      };
    }
  }

  /**
   * Updates both booking and swap data with partial failure recovery
   * Handles scenarios where one operation succeeds but the other fails
   */
  async updateBookingWithSwapRecovery(
    bookingId: string,
    data: UpdateBookingWithSwapRequest
  ): Promise<{
    success: boolean;
    booking?: any;
    swap?: any;
    partialFailures?: Array<{
      operation: 'booking' | 'swap';
      field?: string;
      error: string;
      recovered: boolean;
    }>;
    validationWarnings?: string[];
  }> {
    const partialFailures: Array<{
      operation: 'booking' | 'swap';
      field?: string;
      error: string;
      recovered: boolean;
    }> = [];

    let bookingResult: any = null;
    let swapResult: any = null;
    let overallSuccess = true;

    // Handle booking updates with recovery
    if (data.bookingData) {
      try {
        const bookingResponse = await bookingEditService.updateBookingWithRecovery(bookingId, data.bookingData);
        if (bookingResponse.success) {
          bookingResult = bookingResponse.booking;
        } else {
          overallSuccess = false;
          bookingResponse.partialFailures?.forEach(failure => {
            partialFailures.push({
              operation: 'booking',
              field: failure.field,
              error: failure.error,
              recovered: false,
            });
          });
        }
      } catch (error) {
        overallSuccess = false;
        partialFailures.push({
          operation: 'booking',
          error: error instanceof Error ? error.message : 'Unknown booking error',
          recovered: false,
        });
      }
    }

    // Handle swap updates with recovery (only if booking succeeded or no booking changes)
    if (data.swapData && (bookingResult || !data.bookingData)) {
      try {
        // First get the swap ID from the booking
        const swapSpec = await swapSpecificationService.getSwapSpecificationByBooking(bookingId);
        if (swapSpec) {
          const swapResponse = await swapSpecificationService.updateSwapSpecificationWithRecovery(
            swapSpec.id,
            data.swapData
          );
          if (swapResponse.success) {
            swapResult = swapResponse.swapSpecification;
          } else {
            overallSuccess = false;
            swapResponse.partialFailures?.forEach(failure => {
              partialFailures.push({
                operation: 'swap',
                field: failure.field,
                error: failure.error,
                recovered: false,
              });
            });
          }
        }
      } catch (error) {
        overallSuccess = false;
        partialFailures.push({
          operation: 'swap',
          error: error instanceof Error ? error.message : 'Unknown swap error',
          recovered: false,
        });
      }
    }

    return {
      success: overallSuccess,
      booking: bookingResult,
      swap: swapResult,
      partialFailures: partialFailures.length > 0 ? partialFailures : undefined,
    };
  }

  /**
   * Performs a safe combined operation with comprehensive error handling
   * Attempts to maintain data consistency even when partial failures occur
   */
  async performSafeCombinedOperation(
    operation: AtomicBookingSwapOperation & { bookingId?: string; swapId?: string }
  ): Promise<{
    success: boolean;
    booking?: any;
    swap?: any;
    errors?: Array<{
      operation: 'booking' | 'swap';
      error: string;
      recovered: boolean;
    }>;
    rollbackPerformed?: boolean;
  }> {
    const errors: Array<{
      operation: 'booking' | 'swap';
      error: string;
      recovered: boolean;
    }> = [];

    let bookingResult: any = null;
    let swapResult: any = null;
    let rollbackPerformed = false;

    try {
      // Validate data model separation
      if (operation.bookingChanges && operation.swapChanges) {
        const separationErrors = validateDataModelSeparation(operation.bookingChanges, operation.swapChanges);
        if (separationErrors.length > 0) {
          throw new ValidationError('Data model separation violation', { errors: separationErrors });
        }
      }

      // Execute booking operation with recovery
      if (operation.bookingChanges && operation.bookingId) {
        try {
          const bookingResponse = await bookingEditService.updateBookingWithRecovery(
            operation.bookingId,
            operation.bookingChanges
          );
          if (bookingResponse.success) {
            bookingResult = bookingResponse.booking;
          } else {
            bookingResponse.partialFailures?.forEach(failure => {
              errors.push({
                operation: 'booking',
                error: `${failure.field}: ${failure.error}`,
                recovered: false,
              });
            });
          }
        } catch (bookingError) {
          errors.push({
            operation: 'booking',
            error: bookingError instanceof Error ? bookingError.message : 'Unknown booking error',
            recovered: false,
          });
        }
      }

      // Execute swap operation with recovery
      if (operation.swapChanges && operation.swapId) {
        try {
          const swapResponse = await swapSpecificationService.updateSwapSpecificationWithRecovery(
            operation.swapId,
            operation.swapChanges
          );
          if (swapResponse.success) {
            swapResult = swapResponse.swapSpecification;
          } else {
            swapResponse.partialFailures?.forEach(failure => {
              errors.push({
                operation: 'swap',
                error: `${failure.field}: ${failure.error}`,
                recovered: false,
              });
            });
          }
        } catch (swapError) {
          errors.push({
            operation: 'swap',
            error: swapError instanceof Error ? swapError.message : 'Unknown swap error',
            recovered: false,
          });
        }
      }

      return {
        success: errors.length === 0,
        booking: bookingResult,
        swap: swapResult,
        errors: errors.length > 0 ? errors : undefined,
        rollbackPerformed,
      };
    } catch (error) {
      return {
        success: false,
        errors: [{
          operation: 'booking',
          error: error instanceof Error ? error.message : 'Unknown error',
          recovered: false,
        }],
        rollbackPerformed,
      };
    }
  }

  /**
   * Validates combined data without making API calls
   */
  validateCombinedData(data: BookingWithSwapUpdate): CombinedValidationErrors {
    return validateBookingWithSwapUpdate(data);
  }

  /**
   * Validates partial combined data without making API calls
   */
  validatePartialCombinedData(data: BookingWithSwapPartialUpdate): CombinedValidationErrors {
    return validateBookingWithSwapPartialUpdate(data);
  }

  /**
   * Checks data model separation compliance
   */
  validateSeparation(bookingData: any, swapData: any): string[] {
    return validateDataModelSeparation(bookingData, swapData);
  }

  /**
   * Gets combined booking and swap data for editing
   */
  async getCombinedData(bookingId: string): Promise<{
    booking: any;
    swap?: any;
    canEdit: boolean;
    canModifySwap: boolean;
  }> {
    try {
      const response: AxiosResponse<{
        success: boolean;
        data: {
          booking: any;
          swap?: any;
          permissions: {
            canEdit: boolean;
            canModifySwap: boolean;
          };
        };
      }> = await this.axiosInstance.get(`/bookings/${bookingId}/combined-data`);

      return {
        booking: this.parseBookingDates(response.data.data.booking),
        swap: response.data.data.swap,
        canEdit: response.data.data.permissions.canEdit,
        canModifySwap: response.data.data.permissions.canModifySwap,
      };
    } catch (error) {
      throw error;
    }
  }

  // Private helper methods for atomic operations
  private async executeBookingOperation(operation: AtomicBookingSwapOperation): Promise<any> {
    if (!operation.bookingChanges) return null;

    switch (operation.operation) {
      case 'create':
        return await bookingEditService.createBooking(operation.bookingChanges as any);
      case 'update':
        // Need booking ID for update - this would be passed in the operation
        throw new Error('Update operation requires booking ID');
      case 'delete':
        // Need booking ID for delete - this would be passed in the operation
        throw new Error('Delete operation requires booking ID');
      default:
        throw new Error('Invalid booking operation');
    }
  }

  private async executeSwapOperation(operation: AtomicBookingSwapOperation): Promise<any> {
    if (!operation.swapChanges) return null;

    switch (operation.operation) {
      case 'create':
        return await swapSpecificationService.createSwapSpecification(operation.swapChanges as any);
      case 'update':
        // Need swap ID for update - this would be passed in the operation
        throw new Error('Update operation requires swap ID');
      case 'delete':
        // Need booking ID for delete - this would be passed in the operation
        throw new Error('Delete operation requires booking ID');
      default:
        throw new Error('Invalid swap operation');
    }
  }

  private async rollbackBookingOperation(operation: AtomicBookingSwapOperation, bookingResult: any): Promise<void> {
    // Implementation would depend on the specific rollback strategy
    // For now, we'll log the rollback attempt
    console.warn('Booking operation rollback attempted', { operation, bookingResult });
  }

  private async rollbackSwapOperation(operation: AtomicBookingSwapOperation, swapResult: any): Promise<void> {
    // Implementation would depend on the specific rollback strategy
    // For now, we'll log the rollback attempt
    console.warn('Swap operation rollback attempted', { operation, swapResult });
  }

  // Helper Methods
  private parseBookingDates(booking: any): any {
    if (!booking) return booking;
    
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
}

export const combinedBookingSwapService = new CombinedBookingSwapService();