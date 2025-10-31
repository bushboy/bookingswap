import {
  validateInlineProposal,
  hasInlineProposalErrors,
  getInlineProposalErrorMessage,
  canMakeProposal,
  getAvailableProposalTypes,
  formatCashAmount,
  parseCashAmount,
  getMinimumCashAmount,
  getMaximumCashAmount,
  isAuctionActive,
  getAuctionTimeRemaining,
  formatTimeRemaining,
} from '../inlineProposalValidation';
import { BookingWithSwapInfo, InlineProposalData } from '@booking-swap/shared';

// Mock booking data
const mockBooking: BookingWithSwapInfo = {
  id: 'booking-1',
  title: 'Test Booking',
  description: 'Test description',
  type: 'hotel',
  location: {
    city: 'Paris',
    country: 'France',
    address: '123 Test St',
    coordinates: { lat: 48.8566, lng: 2.3522 },
  },
  dateRange: {
    checkIn: new Date('2024-06-01'),
    checkOut: new Date('2024-06-05'),
  },
  originalPrice: 500,
  swapValue: 450,
  providerDetails: {
    provider: 'Test Provider',
    confirmationNumber: 'ABC123',
    bookingReference: 'REF456',
  },
  status: 'available',
  verification: {
    status: 'verified',
    verifiedAt: new Date().toISOString(),
  },
  userId: 'user-1',
  createdAt: new Date().toISOString(),
  swapInfo: {
    swapId: 'swap-1',
    paymentTypes: ['booking', 'cash'],
    acceptanceStrategy: 'first-match',
    minCashAmount: 100,
    maxCashAmount: 600,
    hasActiveProposals: true,
    activeProposalCount: 2,
    swapConditions: [],
  },
};

describe('inlineProposalValidation', () => {
  describe('validateInlineProposal', () => {
    it('should validate booking proposal successfully', () => {
      const proposal: InlineProposalData = {
        type: 'booking',
        selectedBookingId: 'user-booking-1',
        message: 'Test message',
      };

      const errors = validateInlineProposal(proposal, mockBooking, ['user-booking-1']);
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it('should validate cash proposal successfully', () => {
      const proposal: InlineProposalData = {
        type: 'cash',
        cashAmount: 200,
        message: 'Test message',
      };

      const errors = validateInlineProposal(proposal, mockBooking);
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it('should return error for unsupported proposal type', () => {
      const bookingWithoutCash = {
        ...mockBooking,
        swapInfo: {
          ...mockBooking.swapInfo!,
          paymentTypes: ['booking'] as ('booking' | 'cash')[],
        },
      };

      const proposal: InlineProposalData = {
        type: 'cash',
        cashAmount: 200,
      };

      const errors = validateInlineProposal(proposal, bookingWithoutCash);
      expect(errors.general).toBe('cash proposals are not accepted for this booking');
    });

    it('should return error for missing booking selection', () => {
      const proposal: InlineProposalData = {
        type: 'booking',
      };

      const errors = validateInlineProposal(proposal, mockBooking, ['user-booking-1']);
      expect(errors.selectedBooking).toBe('Please select a booking to swap');
    });

    it('should return error for unavailable booking selection', () => {
      const proposal: InlineProposalData = {
        type: 'booking',
        selectedBookingId: 'unavailable-booking',
      };

      const errors = validateInlineProposal(proposal, mockBooking, ['user-booking-1']);
      expect(errors.selectedBooking).toBe('Selected booking is not available for swap');
    });

    it('should return error for missing cash amount', () => {
      const proposal: InlineProposalData = {
        type: 'cash',
      };

      const errors = validateInlineProposal(proposal, mockBooking);
      expect(errors.cashAmount).toBe('Cash amount is required');
    });

    it('should return error for cash amount below minimum', () => {
      const proposal: InlineProposalData = {
        type: 'cash',
        cashAmount: 50,
      };

      const errors = validateInlineProposal(proposal, mockBooking);
      expect(errors.cashAmount).toBe('Amount must be at least $100');
    });

    it('should return error for cash amount above maximum', () => {
      const proposal: InlineProposalData = {
        type: 'cash',
        cashAmount: 700,
      };

      const errors = validateInlineProposal(proposal, mockBooking);
      expect(errors.cashAmount).toBe('Amount must not exceed $600');
    });

    it('should return error for message too long', () => {
      const proposal: InlineProposalData = {
        type: 'cash',
        cashAmount: 200,
        message: 'a'.repeat(501),
      };

      const errors = validateInlineProposal(proposal, mockBooking);
      expect(errors.message).toBe('Message must be less than 500 characters');
    });
  });

  describe('hasInlineProposalErrors', () => {
    it('should return true when errors exist', () => {
      const errors = { cashAmount: 'Amount too low' };
      expect(hasInlineProposalErrors(errors)).toBe(true);
    });

    it('should return false when no errors exist', () => {
      const errors = {};
      expect(hasInlineProposalErrors(errors)).toBe(false);
    });
  });

  describe('getInlineProposalErrorMessage', () => {
    it('should return general error first', () => {
      const errors = {
        general: 'General error',
        cashAmount: 'Cash error',
      };
      expect(getInlineProposalErrorMessage(errors)).toBe('General error');
    });

    it('should return specific error when no general error', () => {
      const errors = { cashAmount: 'Cash error' };
      expect(getInlineProposalErrorMessage(errors)).toBe('Cash error');
    });

    it('should return default message when no specific errors', () => {
      const errors = {};
      expect(getInlineProposalErrorMessage(errors)).toBe('Please fix the errors above');
    });
  });

  describe('canMakeProposal', () => {
    it('should return true for valid booking', () => {
      expect(canMakeProposal(mockBooking)).toBe(true);
    });

    it('should return false when no swap info', () => {
      const bookingWithoutSwap = { ...mockBooking, swapInfo: undefined };
      expect(canMakeProposal(bookingWithoutSwap)).toBe(false);
    });

    it('should return false when no active proposals', () => {
      const bookingWithoutActive = {
        ...mockBooking,
        swapInfo: { ...mockBooking.swapInfo!, hasActiveProposals: false },
      };
      expect(canMakeProposal(bookingWithoutActive)).toBe(false);
    });

    it('should return false when booking not available', () => {
      const unavailableBooking = { ...mockBooking, status: 'cancelled' as const };
      expect(canMakeProposal(unavailableBooking)).toBe(false);
    });
  });

  describe('getAvailableProposalTypes', () => {
    it('should return both types when both are supported', () => {
      const types = getAvailableProposalTypes(mockBooking, true);
      expect(types).toHaveLength(2);
      expect(types[0].type).toBe('booking');
      expect(types[0].disabled).toBe(false);
      expect(types[1].type).toBe('cash');
      expect(types[1].disabled).toBe(false);
    });

    it('should disable booking type when no available bookings', () => {
      const types = getAvailableProposalTypes(mockBooking, false);
      expect(types[0].type).toBe('booking');
      expect(types[0].disabled).toBe(true);
      expect(types[0].reason).toBe('No available bookings to swap');
    });

    it('should return only cash type when booking not supported', () => {
      const cashOnlyBooking = {
        ...mockBooking,
        swapInfo: {
          ...mockBooking.swapInfo!,
          paymentTypes: ['cash'] as ('booking' | 'cash')[],
        },
      };

      const types = getAvailableProposalTypes(cashOnlyBooking);
      expect(types).toHaveLength(1);
      expect(types[0].type).toBe('cash');
    });
  });

  describe('formatCashAmount', () => {
    it('should format amount with default currency', () => {
      expect(formatCashAmount(123.45)).toBe('$123.45');
    });

    it('should format amount with custom currency', () => {
      expect(formatCashAmount(123.45, '€')).toBe('€123.45');
    });

    it('should format whole numbers with decimals', () => {
      expect(formatCashAmount(100)).toBe('$100.00');
    });
  });

  describe('parseCashAmount', () => {
    it('should parse valid number string', () => {
      expect(parseCashAmount('123.45')).toBe(123.45);
    });

    it('should parse string with currency symbols', () => {
      expect(parseCashAmount('$123.45')).toBe(123.45);
    });

    it('should return null for invalid input', () => {
      expect(parseCashAmount('abc')).toBeNull();
    });

    it('should handle empty string', () => {
      expect(parseCashAmount('')).toBeNull();
    });
  });

  describe('getMinimumCashAmount', () => {
    it('should return minimum amount from swap info', () => {
      expect(getMinimumCashAmount(mockBooking)).toBe(100);
    });

    it('should return 0 when no swap info', () => {
      const bookingWithoutSwap = { ...mockBooking, swapInfo: undefined };
      expect(getMinimumCashAmount(bookingWithoutSwap)).toBe(0);
    });
  });

  describe('getMaximumCashAmount', () => {
    it('should return maximum amount from swap info', () => {
      expect(getMaximumCashAmount(mockBooking)).toBe(600);
    });

    it('should return undefined when no swap info', () => {
      const bookingWithoutSwap = { ...mockBooking, swapInfo: undefined };
      expect(getMaximumCashAmount(bookingWithoutSwap)).toBeUndefined();
    });
  });

  describe('isAuctionActive', () => {
    it('should return false for first-match strategy', () => {
      expect(isAuctionActive(mockBooking)).toBe(false);
    });

    it('should return true for active auction', () => {
      const auctionBooking = {
        ...mockBooking,
        swapInfo: {
          ...mockBooking.swapInfo!,
          acceptanceStrategy: 'auction' as const,
          auctionEndDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day from now
        },
      };
      expect(isAuctionActive(auctionBooking)).toBe(true);
    });

    it('should return false for expired auction', () => {
      const expiredAuctionBooking = {
        ...mockBooking,
        swapInfo: {
          ...mockBooking.swapInfo!,
          acceptanceStrategy: 'auction' as const,
          auctionEndDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        },
      };
      expect(isAuctionActive(expiredAuctionBooking)).toBe(false);
    });
  });

  describe('getAuctionTimeRemaining', () => {
    it('should return 0 for non-auction booking', () => {
      expect(getAuctionTimeRemaining(mockBooking)).toBe(0);
    });

    it('should return positive time for active auction', () => {
      const auctionBooking = {
        ...mockBooking,
        swapInfo: {
          ...mockBooking.swapInfo!,
          acceptanceStrategy: 'auction' as const,
          auctionEndDate: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        },
      };
      const remaining = getAuctionTimeRemaining(auctionBooking);
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(60 * 60 * 1000);
    });

    it('should return 0 for expired auction', () => {
      const expiredAuctionBooking = {
        ...mockBooking,
        swapInfo: {
          ...mockBooking.swapInfo!,
          acceptanceStrategy: 'auction' as const,
          auctionEndDate: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        },
      };
      expect(getAuctionTimeRemaining(expiredAuctionBooking)).toBe(0);
    });
  });

  describe('formatTimeRemaining', () => {
    it('should return "Ended" for zero or negative time', () => {
      expect(formatTimeRemaining(0)).toBe('Ended');
      expect(formatTimeRemaining(-1000)).toBe('Ended');
    });

    it('should format days and hours', () => {
      const twoDaysOneHour = 2 * 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000;
      expect(formatTimeRemaining(twoDaysOneHour)).toBe('2d 1h');
    });

    it('should format hours and minutes', () => {
      const twoHoursThirtyMinutes = 2 * 60 * 60 * 1000 + 30 * 60 * 1000;
      expect(formatTimeRemaining(twoHoursThirtyMinutes)).toBe('2h 30m');
    });

    it('should format minutes only', () => {
      const thirtyMinutes = 30 * 60 * 1000;
      expect(formatTimeRemaining(thirtyMinutes)).toBe('30m');
    });
  });
});