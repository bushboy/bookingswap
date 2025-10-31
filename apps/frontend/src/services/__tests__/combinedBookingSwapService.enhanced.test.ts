import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { combinedBookingSwapService } from '../combinedBookingSwapService';
import { bookingEditService } from '../bookingEditService';
import { swapSpecificationService } from '../swapSpecificationService';
import { ValidationError } from '@booking-swap/shared';
import axios from 'axios';

// Mock the services
vi.mock('../bookingEditService');
vi.mock('../swapSpecificationService');
vi.mock('axios');

const mockedAxios = vi.mocked(axios);

describe('CombinedBookingSwapService - Enhanced Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock axios.create
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
    
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('updateBookingWithSwapRecovery', () => {
    it('should successfully update both booking and swap data', async () => {
      const mockBookingResult = {
        success: true,
        booking: {
          id: 'booking-123',
          title: 'Updated Booking',
          type: 'hotel',
        },
      };

      const mockSwapResult = {
        success: true,
        swapSpecification: {
          id: 'swap-123',
          bookingId: 'booking-123',
          paymentTypes: ['booking', 'cash'],
        },
      };

      const mockSwapSpec = {
        id: 'swap-123',
        bookingId: 'booking-123',
      };

      vi.mocked(bookingEditService.updateBookingWithRecovery).mockResolvedValue(mockBookingResult as any);
      vi.mocked(swapSpecificationService.getSwapSpecificationByBooking).mockResolvedValue(mockSwapSpec as any);
      vi.mocked(swapSpecificationService.updateSwapSpecificationWithRecovery).mockResolvedValue(mockSwapResult as any);

      const updateData = {
        bookingData: {
          title: 'Updated Booking',
          description: 'Updated description',
        },
        swapData: {
          paymentTypes: ['booking', 'cash'] as const,
          minCashAmount: 100,
        },
        swapEnabled: true,
      };

      const result = await combinedBookingSwapService.updateBookingWithSwapRecovery('booking-123', updateData);

      expect(result.success).toBe(true);
      expect(result.booking).toEqual(mockBookingResult.booking);
      expect(result.swap).toEqual(mockSwapResult.swapSpecification);
      expect(result.partialFailures).toBeUndefined();
    });

    it('should handle booking update failure with swap success', async () => {
      const mockBookingResult = {
        success: false,
        partialFailures: [
          {
            field: 'title',
            error: 'Title validation failed',
            originalValue: 'Invalid Title',
          },
        ],
      };

      const mockSwapResult = {
        success: true,
        swapSpecification: {
          id: 'swap-123',
          paymentTypes: ['booking'],
        },
      };

      const mockSwapSpec = { id: 'swap-123', bookingId: 'booking-123' };

      vi.mocked(bookingEditService.updateBookingWithRecovery).mockResolvedValue(mockBookingResult as any);
      vi.mocked(swapSpecificationService.getSwapSpecificationByBooking).mockResolvedValue(mockSwapSpec as any);
      vi.mocked(swapSpecificationService.updateSwapSpecificationWithRecovery).mockResolvedValue(mockSwapResult as any);

      const updateData = {
        bookingData: {
          title: 'Invalid Title',
        },
        swapData: {
          paymentTypes: ['booking'] as const,
        },
        swapEnabled: true,
      };

      const result = await combinedBookingSwapService.updateBookingWithSwapRecovery('booking-123', updateData);

      expect(result.success).toBe(false);
      expect(result.swap).toEqual(mockSwapResult.swapSpecification);
      expect(result.partialFailures).toHaveLength(1);
      expect(result.partialFailures?.[0].operation).toBe('booking');
      expect(result.partialFailures?.[0].field).toBe('title');
    });

    it('should handle swap update failure with booking success', async () => {
      const mockBookingResult = {
        success: true,
        booking: {
          id: 'booking-123',
          title: 'Updated Booking',
        },
      };

      const mockSwapResult = {
        success: false,
        partialFailures: [
          {
            field: 'paymentTypes',
            error: 'Invalid payment types',
            originalValue: ['invalid'],
          },
        ],
      };

      const mockSwapSpec = { id: 'swap-123', bookingId: 'booking-123' };

      vi.mocked(bookingEditService.updateBookingWithRecovery).mockResolvedValue(mockBookingResult as any);
      vi.mocked(swapSpecificationService.getSwapSpecificationByBooking).mockResolvedValue(mockSwapSpec as any);
      vi.mocked(swapSpecificationService.updateSwapSpecificationWithRecovery).mockResolvedValue(mockSwapResult as any);

      const updateData = {
        bookingData: {
          title: 'Updated Booking',
        },
        swapData: {
          paymentTypes: ['invalid'] as any,
        },
        swapEnabled: true,
      };

      const result = await combinedBookingSwapService.updateBookingWithSwapRecovery('booking-123', updateData);

      expect(result.success).toBe(false);
      expect(result.booking).toEqual(mockBookingResult.booking);
      expect(result.partialFailures).toHaveLength(1);
      expect(result.partialFailures?.[0].operation).toBe('swap');
      expect(result.partialFailures?.[0].field).toBe('paymentTypes');
    });

    it('should handle both booking and swap failures', async () => {
      const mockBookingResult = {
        success: false,
        partialFailures: [
          {
            field: 'title',
            error: 'Title too short',
            originalValue: 'Hi',
          },
        ],
      };

      const mockSwapResult = {
        success: false,
        partialFailures: [
          {
            field: 'minCashAmount',
            error: 'Amount too low',
            originalValue: 1,
          },
        ],
      };

      const mockSwapSpec = { id: 'swap-123', bookingId: 'booking-123' };

      vi.mocked(bookingEditService.updateBookingWithRecovery).mockResolvedValue(mockBookingResult as any);
      vi.mocked(swapSpecificationService.getSwapSpecificationByBooking).mockResolvedValue(mockSwapSpec as any);
      vi.mocked(swapSpecificationService.updateSwapSpecificationWithRecovery).mockResolvedValue(mockSwapResult as any);

      const updateData = {
        bookingData: {
          title: 'Hi',
        },
        swapData: {
          minCashAmount: 1,
        },
        swapEnabled: true,
      };

      const result = await combinedBookingSwapService.updateBookingWithSwapRecovery('booking-123', updateData);

      expect(result.success).toBe(false);
      expect(result.partialFailures).toHaveLength(2);
      expect(result.partialFailures?.some(f => f.operation === 'booking')).toBe(true);
      expect(result.partialFailures?.some(f => f.operation === 'swap')).toBe(true);
    });

    it('should handle booking-only updates', async () => {
      const mockBookingResult = {
        success: true,
        booking: {
          id: 'booking-123',
          title: 'Updated Booking',
        },
      };

      vi.mocked(bookingEditService.updateBookingWithRecovery).mockResolvedValue(mockBookingResult as any);

      const updateData = {
        bookingData: {
          title: 'Updated Booking',
        },
        swapEnabled: false,
      };

      const result = await combinedBookingSwapService.updateBookingWithSwapRecovery('booking-123', updateData);

      expect(result.success).toBe(true);
      expect(result.booking).toEqual(mockBookingResult.booking);
      expect(result.swap).toBeUndefined();
      expect(result.partialFailures).toBeUndefined();
    });

    it('should handle booking service errors', async () => {
      vi.mocked(bookingEditService.updateBookingWithRecovery).mockRejectedValue(new Error('Booking service error'));

      const updateData = {
        bookingData: {
          title: 'Updated Booking',
        },
        swapEnabled: true,
      };

      const result = await combinedBookingSwapService.updateBookingWithSwapRecovery('booking-123', updateData);

      expect(result.success).toBe(false);
      expect(result.partialFailures).toHaveLength(1);
      expect(result.partialFailures?.[0].operation).toBe('booking');
      expect(result.partialFailures?.[0].error).toBe('Booking service error');
    });

    it('should skip swap update when booking fails and no booking result', async () => {
      const mockBookingResult = {
        success: false,
        booking: undefined, // No booking result
        partialFailures: [
          {
            field: 'title',
            error: 'Complete failure',
            originalValue: 'Bad Title',
          },
        ],
      };

      vi.mocked(bookingEditService.updateBookingWithRecovery).mockResolvedValue(mockBookingResult as any);

      const updateData = {
        bookingData: {
          title: 'Bad Title',
        },
        swapData: {
          paymentTypes: ['booking'] as const,
        },
        swapEnabled: true,
      };

      const result = await combinedBookingSwapService.updateBookingWithSwapRecovery('booking-123', updateData);

      expect(result.success).toBe(false);
      expect(result.swap).toBeUndefined();
      expect(result.partialFailures).toHaveLength(1);
      expect(result.partialFailures?.[0].operation).toBe('booking');

      // Verify swap service was not called
      expect(swapSpecificationService.getSwapSpecificationByBooking).not.toHaveBeenCalled();
    });
  });

  describe('performSafeCombinedOperation', () => {
    it('should perform safe combined operation successfully', async () => {
      const mockBookingResult = {
        success: true,
        booking: { id: 'booking-123', title: 'Updated' },
      };

      const mockSwapResult = {
        success: true,
        swapSpecification: { id: 'swap-123', paymentTypes: ['booking'] },
      };

      vi.mocked(bookingEditService.updateBookingWithRecovery).mockResolvedValue(mockBookingResult as any);
      vi.mocked(swapSpecificationService.updateSwapSpecificationWithRecovery).mockResolvedValue(mockSwapResult as any);

      const operation = {
        operation: 'update' as const,
        bookingChanges: { title: 'Updated' },
        swapChanges: { paymentTypes: ['booking'] as const },
        rollbackStrategy: 'booking_first' as const,
        bookingId: 'booking-123',
        swapId: 'swap-123',
      };

      const result = await combinedBookingSwapService.performSafeCombinedOperation(operation);

      expect(result.success).toBe(true);
      expect(result.booking).toEqual(mockBookingResult.booking);
      expect(result.swap).toEqual(mockSwapResult.swapSpecification);
      expect(result.errors).toBeUndefined();
    });

    it('should handle data model separation violations', async () => {
      const operation = {
        operation: 'update' as const,
        bookingChanges: { 
          title: 'Updated',
          paymentTypes: ['booking'] // This violates separation - swap field in booking data
        },
        swapChanges: { 
          paymentTypes: ['booking'] as const,
          title: 'Invalid' // This violates separation - booking field in swap data
        },
        rollbackStrategy: 'booking_first' as const,
        bookingId: 'booking-123',
        swapId: 'swap-123',
      };

      const result = await combinedBookingSwapService.performSafeCombinedOperation(operation);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0].error).toContain('Data model separation violation');
    });

    it('should handle booking operation failures with recovery', async () => {
      const mockBookingResult = {
        success: false,
        partialFailures: [
          { field: 'title', error: 'Title invalid', originalValue: 'Bad' },
        ],
      };

      const mockSwapResult = {
        success: true,
        swapSpecification: { id: 'swap-123', paymentTypes: ['booking'] },
      };

      vi.mocked(bookingEditService.updateBookingWithRecovery).mockResolvedValue(mockBookingResult as any);
      vi.mocked(swapSpecificationService.updateSwapSpecificationWithRecovery).mockResolvedValue(mockSwapResult as any);

      const operation = {
        operation: 'update' as const,
        bookingChanges: { title: 'Bad' },
        swapChanges: { paymentTypes: ['booking'] as const },
        rollbackStrategy: 'booking_first' as const,
        bookingId: 'booking-123',
        swapId: 'swap-123',
      };

      const result = await combinedBookingSwapService.performSafeCombinedOperation(operation);

      expect(result.success).toBe(false);
      expect(result.swap).toEqual(mockSwapResult.swapSpecification);
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0].operation).toBe('booking');
      expect(result.errors?.[0].error).toContain('title: Title invalid');
    });

    it('should handle swap operation failures with recovery', async () => {
      const mockBookingResult = {
        success: true,
        booking: { id: 'booking-123', title: 'Updated' },
      };

      const mockSwapResult = {
        success: false,
        partialFailures: [
          { field: 'paymentTypes', error: 'Invalid types', originalValue: ['invalid'] },
        ],
      };

      vi.mocked(bookingEditService.updateBookingWithRecovery).mockResolvedValue(mockBookingResult as any);
      vi.mocked(swapSpecificationService.updateSwapSpecificationWithRecovery).mockResolvedValue(mockSwapResult as any);

      const operation = {
        operation: 'update' as const,
        bookingChanges: { title: 'Updated' },
        swapChanges: { paymentTypes: ['invalid'] as any },
        rollbackStrategy: 'booking_first' as const,
        bookingId: 'booking-123',
        swapId: 'swap-123',
      };

      const result = await combinedBookingSwapService.performSafeCombinedOperation(operation);

      expect(result.success).toBe(false);
      expect(result.booking).toEqual(mockBookingResult.booking);
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0].operation).toBe('swap');
      expect(result.errors?.[0].error).toContain('paymentTypes: Invalid types');
    });

    it('should handle service exceptions', async () => {
      vi.mocked(bookingEditService.updateBookingWithRecovery).mockRejectedValue(new Error('Service unavailable'));

      const operation = {
        operation: 'update' as const,
        bookingChanges: { title: 'Updated' },
        rollbackStrategy: 'booking_first' as const,
        bookingId: 'booking-123',
      };

      const result = await combinedBookingSwapService.performSafeCombinedOperation(operation);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0].operation).toBe('booking');
      expect(result.errors?.[0].error).toBe('Service unavailable');
    });

    it('should handle booking-only operations', async () => {
      const mockBookingResult = {
        success: true,
        booking: { id: 'booking-123', title: 'Updated' },
      };

      vi.mocked(bookingEditService.updateBookingWithRecovery).mockResolvedValue(mockBookingResult as any);

      const operation = {
        operation: 'update' as const,
        bookingChanges: { title: 'Updated' },
        rollbackStrategy: 'booking_first' as const,
        bookingId: 'booking-123',
      };

      const result = await combinedBookingSwapService.performSafeCombinedOperation(operation);

      expect(result.success).toBe(true);
      expect(result.booking).toEqual(mockBookingResult.booking);
      expect(result.swap).toBeUndefined();
      expect(result.errors).toBeUndefined();
    });

    it('should handle swap-only operations', async () => {
      const mockSwapResult = {
        success: true,
        swapSpecification: { id: 'swap-123', paymentTypes: ['booking'] },
      };

      vi.mocked(swapSpecificationService.updateSwapSpecificationWithRecovery).mockResolvedValue(mockSwapResult as any);

      const operation = {
        operation: 'update' as const,
        swapChanges: { paymentTypes: ['booking'] as const },
        rollbackStrategy: 'swap_first' as const,
        swapId: 'swap-123',
      };

      const result = await combinedBookingSwapService.performSafeCombinedOperation(operation);

      expect(result.success).toBe(true);
      expect(result.booking).toBeUndefined();
      expect(result.swap).toEqual(mockSwapResult.swapSpecification);
      expect(result.errors).toBeUndefined();
    });
  });

  describe('getCombinedData', () => {
    it('should return combined booking and swap data with permissions', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            booking: {
              id: 'booking-123',
              title: 'Test Booking',
              dateRange: {
                checkIn: '2024-06-01T00:00:00.000Z',
                checkOut: '2024-06-05T00:00:00.000Z',
              },
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-02T00:00:00.000Z',
            },
            swap: {
              id: 'swap-123',
              paymentTypes: ['booking', 'cash'],
            },
            permissions: {
              canEdit: true,
              canModifySwap: true,
            },
          },
        },
      };

      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.get).mockResolvedValue(mockResponse);

      const result = await combinedBookingSwapService.getCombinedData('booking-123');

      expect(result.booking).toBeDefined();
      expect(result.booking.dateRange.checkIn).toBeInstanceOf(Date);
      expect(result.swap).toBeDefined();
      expect(result.canEdit).toBe(true);
      expect(result.canModifySwap).toBe(true);
    });

    it('should handle booking without swap', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            booking: {
              id: 'booking-123',
              title: 'Test Booking',
              dateRange: {
                checkIn: '2024-06-01T00:00:00.000Z',
                checkOut: '2024-06-05T00:00:00.000Z',
              },
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-02T00:00:00.000Z',
            },
            swap: null,
            permissions: {
              canEdit: true,
              canModifySwap: false,
            },
          },
        },
      };

      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.get).mockResolvedValue(mockResponse);

      const result = await combinedBookingSwapService.getCombinedData('booking-123');

      expect(result.booking).toBeDefined();
      expect(result.swap).toBeUndefined();
      expect(result.canEdit).toBe(true);
      expect(result.canModifySwap).toBe(false);
    });
  });

  describe('validation methods', () => {
    it('should validate combined data', () => {
      const validCombinedData = {
        bookingData: {
          type: 'hotel' as const,
          title: 'Valid Booking',
          description: 'A valid booking',
          location: {
            city: 'Paris',
            country: 'France',
            address: '123 Main St',
            coordinates: { lat: 48.8566, lng: 2.3522 },
          },
          dateRange: {
            checkIn: new Date('2024-06-01'),
            checkOut: new Date('2024-06-05'),
          },
          originalPrice: 500,
          swapValue: 450,
          providerDetails: {
            provider: 'Booking.com',
            confirmationNumber: 'ABC123',
            bookingReference: 'REF456',
          },
        },
        swapData: {
          bookingId: 'booking-123',
          paymentTypes: ['booking', 'cash'] as const,
          minCashAmount: 100,
          maxCashAmount: 500,
          acceptanceStrategy: 'first_come_first_served' as const,
          swapConditions: ['No pets'],
          swapEnabled: true,
        },
      };

      const errors = combinedBookingSwapService.validateCombinedData(validCombinedData);

      expect(errors.bookingErrors).toBeUndefined();
      expect(errors.swapErrors).toBeUndefined();
      expect(errors.generalErrors).toBeUndefined();
    });

    it('should validate data model separation', () => {
      const bookingData = {
        title: 'Valid Booking',
        type: 'hotel',
        // No swap fields - this is correct
      };

      const swapData = {
        bookingId: 'booking-123',
        paymentTypes: ['booking'],
        // No booking fields - this is correct
      };

      const separationErrors = combinedBookingSwapService.validateSeparation(bookingData, swapData);

      expect(separationErrors).toHaveLength(0);
    });

    it('should detect data model separation violations', () => {
      const bookingData = {
        title: 'Valid Booking',
        type: 'hotel',
        paymentTypes: ['booking'], // This is a swap field - violation!
      };

      const swapData = {
        bookingId: 'booking-123',
        paymentTypes: ['booking'],
        title: 'Invalid', // This is a booking field - violation!
      };

      const separationErrors = combinedBookingSwapService.validateSeparation(bookingData, swapData);

      expect(separationErrors.length).toBeGreaterThan(0);
    });
  });
});