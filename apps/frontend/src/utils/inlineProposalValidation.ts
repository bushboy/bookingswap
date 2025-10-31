import { InlineProposalData, BookingWithSwapInfo } from '@booking-swap/shared';
import { FinancialDataHandler } from './financialDataHandler';

export interface InlineProposalValidationErrors {
  selectedBooking?: string;
  cashAmount?: string;
  message?: string;
  general?: string;
}

/**
 * Validates an inline proposal before submission
 */
export const validateInlineProposal = (
  proposal: InlineProposalData,
  booking: BookingWithSwapInfo,
  availableBookings: string[] = []
): InlineProposalValidationErrors => {
  const errors: InlineProposalValidationErrors = {};

  // Validate proposal type is supported
  if (!booking.swapInfo?.paymentTypes.includes(proposal.type)) {
    errors.general = `${proposal.type} proposals are not accepted for this booking`;
    return errors;
  }

  // Validate booking proposal
  if (proposal.type === 'booking') {
    if (!proposal.selectedBookingId) {
      errors.selectedBooking = 'Please select a booking to swap';
    } else if (!availableBookings.includes(proposal.selectedBookingId)) {
      errors.selectedBooking = 'Selected booking is not available for swap';
    }
  }

  // Validate cash proposal
  if (proposal.type === 'cash') {
    const minAmount = booking.swapInfo?.minCashAmount || 0;
    const maxAmount = booking.swapInfo?.maxCashAmount;

    if (!proposal.cashAmount || proposal.cashAmount <= 0) {
      errors.cashAmount = 'Cash amount is required';
    } else if (proposal.cashAmount < minAmount) {
      errors.cashAmount = `Amount must be at least $${minAmount}`;
    } else if (maxAmount && proposal.cashAmount > maxAmount) {
      errors.cashAmount = `Amount must not exceed $${maxAmount}`;
    }
  }

  // Validate message length
  if (proposal.message && proposal.message.length > 500) {
    errors.message = 'Message must be less than 500 characters';
  }

  return errors;
};

/**
 * Checks if a proposal has any validation errors
 */
export const hasInlineProposalErrors = (errors: InlineProposalValidationErrors): boolean => {
  return Object.keys(errors).some(key => errors[key as keyof InlineProposalValidationErrors]);
};

/**
 * Gets a user-friendly error message for display
 */
export const getInlineProposalErrorMessage = (errors: InlineProposalValidationErrors): string => {
  if (errors.general) return errors.general;
  if (errors.selectedBooking) return errors.selectedBooking;
  if (errors.cashAmount) return errors.cashAmount;
  if (errors.message) return errors.message;
  return 'Please fix the errors above';
};

/**
 * Validates if a booking can accept proposals
 */
export const canMakeProposal = (booking: BookingWithSwapInfo): boolean => {
  return !!(
    booking.swapInfo &&
    booking.swapInfo.hasActiveProposals &&
    booking.swapInfo.paymentTypes.length > 0 &&
    booking.status === 'available'
  );
};

/**
 * Gets available proposal types for a booking
 */
export const getAvailableProposalTypes = (
  booking: BookingWithSwapInfo,
  hasAvailableBookings: boolean = false
): Array<{ type: 'booking' | 'cash'; label: string; disabled: boolean; reason?: string }> => {
  const types = [];

  if (booking.swapInfo?.paymentTypes.includes('booking')) {
    types.push({
      type: 'booking' as const,
      label: 'Swap with my booking',
      disabled: !hasAvailableBookings,
      reason: !hasAvailableBookings ? 'No available bookings to swap' : undefined,
    });
  }

  if (booking.swapInfo?.paymentTypes.includes('cash')) {
    types.push({
      type: 'cash' as const,
      label: 'Make cash offer',
      disabled: false,
    });
  }

  return types;
};

/**
 * Formats cash amount for display
 */
export const formatCashAmount = (amount: any, currency: string = 'USD'): string => {
  return FinancialDataHandler.formatCurrency(amount, currency);
};

/**
 * Parses cash amount from string input
 */
export const parseCashAmount = (value: string): number | null => {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
};

/**
 * Gets the minimum required cash amount for a booking
 */
export const getMinimumCashAmount = (booking: BookingWithSwapInfo): number => {
  return booking.swapInfo?.minCashAmount || 0;
};

/**
 * Gets the maximum allowed cash amount for a booking
 */
export const getMaximumCashAmount = (booking: BookingWithSwapInfo): number | undefined => {
  return booking.swapInfo?.maxCashAmount;
};

/**
 * Checks if auction is still active for a booking
 */
export const isAuctionActive = (booking: BookingWithSwapInfo): boolean => {
  if (booking.swapInfo?.acceptanceStrategy !== 'auction') return false;
  if (!booking.swapInfo.auctionEndDate) return false;

  return new Date(booking.swapInfo.auctionEndDate) > new Date();
};

/**
 * Gets time remaining in auction (in milliseconds)
 */
export const getAuctionTimeRemaining = (booking: BookingWithSwapInfo): number => {
  if (!isAuctionActive(booking)) return 0;

  const endDate = new Date(booking.swapInfo!.auctionEndDate!);
  const now = new Date();

  return Math.max(0, endDate.getTime() - now.getTime());
};

/**
 * Formats time remaining for display
 */
export const formatTimeRemaining = (milliseconds: number): string => {
  if (milliseconds <= 0) return 'Ended';

  const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));
  const hours = Math.floor((milliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};