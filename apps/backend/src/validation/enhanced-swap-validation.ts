import { 
  EnhancedCreateSwapRequest,
  PaymentTypePreference,
  AcceptanceStrategy,
  AuctionTimingValidation
} from '@booking-swap/shared';

// Platform constants
const PLATFORM_MIN_CASH_AMOUNT = 100;
const PLATFORM_MAX_CASH_AMOUNT = 10000;
const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP'];
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export function validateAuctionTiming(
  eventDate: Date,
  auctionEndDate: Date
): AuctionTimingValidation {
  const errors: string[] = [];
  const now = new Date();
  
  // Calculate if event is less than one week away
  const timeToEvent = eventDate.getTime() - now.getTime();
  const isLastMinute = timeToEvent < ONE_WEEK_MS;
  
  // Calculate minimum auction end date (one week before event)
  const minimumEndDate = new Date(eventDate.getTime() - ONE_WEEK_MS);
  
  // Validate auction end date is in the future
  if (auctionEndDate.getTime() <= now.getTime()) {
    errors.push('Auction end date must be in the future');
  }
  
  // Validate event is not last minute
  if (isLastMinute) {
    errors.push('Auctions are not allowed for events less than one week away');
  }
  
  // Validate auction ends at least one week before event
  if (auctionEndDate.getTime() > minimumEndDate.getTime()) {
    errors.push('Auction must end at least one week before the event');
  }
  
  return {
    eventDate,
    auctionEndDate,
    isValid: errors.length === 0,
    minimumEndDate,
    isLastMinute,
    errors
  };
}

export function validatePaymentTypePreference(
  preference: PaymentTypePreference
): ValidationResult {
  const errors: string[] = [];
  
  // At least one payment type must be enabled
  if (!preference.bookingExchange && !preference.cashPayment) {
    errors.push('At least one payment type must be enabled');
  }
  
  // If cash payment is enabled, validate cash amounts
  if (preference.cashPayment) {
    if (preference.minimumCashAmount === undefined) {
      errors.push('Minimum cash amount is required when cash payments are enabled');
    } else {
      // Validate minimum amount is within platform limits
      if (preference.minimumCashAmount < PLATFORM_MIN_CASH_AMOUNT) {
        errors.push(`Minimum cash amount must be at least ${PLATFORM_MIN_CASH_AMOUNT} USD`);
      }
      
      if (preference.minimumCashAmount > PLATFORM_MAX_CASH_AMOUNT) {
        errors.push(`Minimum cash amount cannot exceed ${PLATFORM_MAX_CASH_AMOUNT} USD`);
      }
      
      // Validate preferred amount is not less than minimum
      if (preference.preferredCashAmount !== undefined && 
          preference.preferredCashAmount < preference.minimumCashAmount) {
        errors.push('Preferred cash amount must be greater than or equal to minimum amount');
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

export function validateCashOfferAmount(
  amount: number,
  currency: string,
  swapMinimum: number,
  platformMinimum: number
): ValidationResult {
  const errors: string[] = [];
  
  // Validate currency is supported
  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    errors.push(`Currency ${currency} is not supported`);
    return { isValid: false, errors };
  }
  
  // Validate amount is within platform limits
  if (amount < platformMinimum) {
    errors.push(`Minimum cash amount is ${platformMinimum} ${currency}`);
  }
  
  if (amount > PLATFORM_MAX_CASH_AMOUNT) {
    errors.push(`Maximum cash amount is ${PLATFORM_MAX_CASH_AMOUNT} ${currency}`);
  }
  
  // Validate amount meets swap owner's minimum requirement
  if (amount < swapMinimum) {
    errors.push(`Amount must be at least ${swapMinimum} ${currency} as specified by swap owner`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

export function validateAcceptanceStrategy(
  strategy: AcceptanceStrategy,
  eventDate: Date
): ValidationResult {
  const errors: string[] = [];
  
  if (strategy.type === 'auction') {
    // Auction strategy requires end date
    if (!strategy.auctionEndDate) {
      errors.push('Auction end date is required for auction strategy');
      return { isValid: false, errors };
    }
    
    // Validate auction timing
    const timingValidation = validateAuctionTiming(eventDate, strategy.auctionEndDate);
    if (!timingValidation.isValid) {
      errors.push(...timingValidation.errors);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

export function validateEnhancedSwapRequest(
  request: EnhancedCreateSwapRequest,
  eventDate: Date
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate required fields
  if (!request.title || request.title.trim().length === 0) {
    errors.push('Title is required');
  }
  
  if (!request.description || request.description.trim().length === 0) {
    errors.push('Description is required');
  }
  
  if (!request.sourceBookingId) {
    errors.push('Source booking ID is required');
  }
  
  // Validate expiration date
  if (request.expirationDate.getTime() <= Date.now()) {
    errors.push('Expiration date must be in the future');
  }
  
  // Validate payment type preferences
  const paymentValidation = validatePaymentTypePreference(request.paymentTypes);
  if (!paymentValidation.isValid) {
    errors.push(...paymentValidation.errors);
  }
  
  // Validate acceptance strategy
  const strategyValidation = validateAcceptanceStrategy(request.acceptanceStrategy, eventDate);
  if (!strategyValidation.isValid) {
    errors.push(...strategyValidation.errors);
  }
  
  // If auction strategy, validate auction settings are provided
  if (request.acceptanceStrategy.type === 'auction') {
    if (!request.auctionSettings) {
      errors.push('Auction settings are required for auction strategy');
    } else {
      // Validate auction settings consistency
      if (request.auctionSettings.endDate.getTime() !== request.acceptanceStrategy.auctionEndDate?.getTime()) {
        warnings.push('Auction end date in settings should match acceptance strategy');
      }
      
      // Validate cash offer settings consistency
      if (request.auctionSettings.allowCashProposals && !request.paymentTypes.cashPayment) {
        errors.push('Cannot allow cash proposals when cash payments are disabled');
      }
      
      if (request.auctionSettings.minimumCashOffer && 
          request.paymentTypes.minimumCashAmount &&
          request.auctionSettings.minimumCashOffer !== request.paymentTypes.minimumCashAmount) {
        warnings.push('Auction minimum cash offer should match payment type minimum');
      }
    }
  }
  
  // Validate title and description length
  if (request.title && request.title.length > 100) {
    errors.push('Title must be 100 characters or less');
  }
  
  if (request.description && request.description.length > 1000) {
    errors.push('Description must be 1000 characters or less');
  }
  
  // Validate swap preferences
  if (request.swapPreferences) {
    if (request.swapPreferences.preferredLocations && 
        request.swapPreferences.preferredLocations.length > 10) {
      warnings.push('Consider limiting preferred locations to improve matching');
    }
    
    if (request.swapPreferences.additionalRequirements && 
        request.swapPreferences.additionalRequirements.length > 5) {
      warnings.push('Too many additional requirements may limit potential matches');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

export function validateProposalCompatibility(
  swapPaymentTypes: PaymentTypePreference,
  proposalType: 'booking' | 'cash'
): ValidationResult {
  const errors: string[] = [];
  
  if (proposalType === 'booking' && !swapPaymentTypes.bookingExchange) {
    errors.push('Booking proposals are not accepted for this swap');
  }
  
  if (proposalType === 'cash' && !swapPaymentTypes.cashPayment) {
    errors.push('Cash proposals are not accepted for this swap');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

export function validateAuctionSettings(
  settings: any, // AuctionSettings type
  paymentTypes: PaymentTypePreference,
  eventDate: Date
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate end date timing
  const timingValidation = validateAuctionTiming(eventDate, settings.endDate);
  if (!timingValidation.isValid) {
    errors.push(...timingValidation.errors);
  }
  
  // Validate proposal type settings consistency
  if (!settings.allowBookingProposals && !settings.allowCashProposals) {
    errors.push('At least one proposal type must be allowed');
  }
  
  if (settings.allowCashProposals && !paymentTypes.cashPayment) {
    errors.push('Cannot allow cash proposals when cash payments are disabled in swap');
  }
  
  if (settings.allowBookingProposals && !paymentTypes.bookingExchange) {
    errors.push('Cannot allow booking proposals when booking exchange is disabled in swap');
  }
  
  // Validate minimum cash offer
  if (settings.minimumCashOffer) {
    if (settings.minimumCashOffer < PLATFORM_MIN_CASH_AMOUNT) {
      errors.push(`Minimum cash offer must be at least ${PLATFORM_MIN_CASH_AMOUNT} USD`);
    }
    
    if (paymentTypes.minimumCashAmount && 
        settings.minimumCashOffer < paymentTypes.minimumCashAmount) {
      errors.push('Auction minimum cash offer cannot be less than swap minimum cash amount');
    }
  }
  
  // Validate auto-select timing
  if (settings.autoSelectAfterHours !== undefined) {
    if (settings.autoSelectAfterHours < 1) {
      errors.push('Auto-select timeout must be at least 1 hour');
    }
    
    if (settings.autoSelectAfterHours > 168) { // 7 days
      warnings.push('Auto-select timeout longer than 7 days may delay swap completion');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}