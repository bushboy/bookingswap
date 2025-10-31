import Joi from '@hapi/joi';

// Enhanced Swap Validation Schemas

const paymentTypePreferenceSchema = Joi.object({
  bookingExchange: Joi.boolean().required(),
  cashPayment: Joi.boolean().required(),
  minimumCashAmount: Joi.when('cashPayment', {
    is: true,
    then: Joi.number().min(1).required(),
    otherwise: Joi.number().optional()
  }),
  preferredCashAmount: Joi.when('cashPayment', {
    is: true,
    then: Joi.number().min(Joi.ref('minimumCashAmount')).optional(),
    otherwise: Joi.number().optional()
  })
}).custom((value, helpers) => {
  // At least one payment type must be enabled
  if (!value.bookingExchange && !value.cashPayment) {
    return helpers.error('paymentTypes.atLeastOne');
  }
  return value;
});

const acceptanceStrategySchema = Joi.object({
  type: Joi.string().valid('first_match', 'auction').required(),
  auctionEndDate: Joi.when('type', {
    is: 'auction',
    then: Joi.date().greater('now').required(),
    otherwise: Joi.date().optional()
  }),
  autoSelectHighest: Joi.boolean().optional()
});

const auctionSettingsSchema = Joi.object({
  endDate: Joi.date().greater('now').required(),
  allowBookingProposals: Joi.boolean().required(),
  allowCashProposals: Joi.boolean().required(),
  minimumCashOffer: Joi.when('allowCashProposals', {
    is: true,
    then: Joi.number().min(1).optional(),
    otherwise: Joi.number().optional()
  }),
  autoSelectAfterHours: Joi.number().min(1).max(168).optional() // Max 1 week
});

const swapPreferencesSchema = Joi.object({
  preferredLocations: Joi.array().items(Joi.string().min(1).max(100)).optional(),
  preferredDates: Joi.array().items(Joi.date()).optional(),
  additionalRequirements: Joi.array().items(Joi.string().min(1).max(500)).optional()
});

export const enhancedCreateSwapSchema = Joi.object({
  sourceBookingId: Joi.string().required(),
  title: Joi.string().min(5).max(200).required(),
  description: Joi.string().min(20).max(2000).required(),
  paymentTypes: paymentTypePreferenceSchema.required(),
  acceptanceStrategy: acceptanceStrategySchema.required(),
  auctionSettings: Joi.when('acceptanceStrategy.type', {
    is: 'auction',
    then: auctionSettingsSchema.required(),
    otherwise: auctionSettingsSchema.optional()
  }),
  swapPreferences: swapPreferencesSchema.required(),
  expirationDate: Joi.date().greater('now').required()
}).custom((value, helpers) => {
  // Custom validation for auction timing
  if (value.acceptanceStrategy.type === 'auction' && value.auctionSettings) {
    const auctionEndDate = new Date(value.auctionSettings.endDate);
    const expirationDate = new Date(value.expirationDate);
    
    if (auctionEndDate >= expirationDate) {
      return helpers.error('auction.endDateBeforeExpiration');
    }
  }
  
  return value;
});

// Auction Timing Validation Schema
export const auctionTimingValidationSchema = Joi.object({
  eventDate: Joi.date().required(),
  auctionEndDate: Joi.date().required(),
  currentDate: Joi.date().default(() => new Date())
}).custom((value, helpers) => {
  const { eventDate, auctionEndDate, currentDate } = value;
  const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;
  const oneWeekBeforeEvent = new Date(eventDate.getTime() - oneWeekInMs);
  
  // Check if event is less than one week away (last-minute booking)
  if (eventDate.getTime() - currentDate.getTime() < oneWeekInMs) {
    return helpers.error('auction.lastMinuteBooking');
  }
  
  // Check if auction end date is at least one week before event
  if (auctionEndDate >= oneWeekBeforeEvent) {
    return helpers.error('auction.tooCloseToEvent', { 
      minimumEndDate: oneWeekBeforeEvent.toISOString() 
    });
  }
  
  // Check if auction end date is in the future
  if (auctionEndDate <= currentDate) {
    return helpers.error('auction.endDateInPast');
  }
  
  return value;
});

// Cash Offer Validation Schema
export const cashOfferSchema = Joi.object({
  amount: Joi.number().min(0.01).required(),
  currency: Joi.string().valid('USD', 'EUR', 'GBP', 'CAD').required(),
  paymentMethodId: Joi.string().required(),
  escrowAgreement: Joi.boolean().required()
});

// Enhanced Proposal Creation Schema
export const enhancedProposalSchema = Joi.object({
  swapId: Joi.string().required(),
  proposalType: Joi.string().valid('booking', 'cash').required(),
  bookingId: Joi.when('proposalType', {
    is: 'booking',
    then: Joi.string().required(),
    otherwise: Joi.string().optional()
  }),
  cashOffer: Joi.when('proposalType', {
    is: 'cash',
    then: cashOfferSchema.required(),
    otherwise: cashOfferSchema.optional()
  }),
  message: Joi.string().min(1).max(1000).optional(),
  conditions: Joi.array().items(Joi.string().min(1).max(500)).required()
});

// Payment Method Validation Schema
export const paymentMethodValidationSchema = Joi.object({
  userId: Joi.string().required(),
  paymentMethodId: Joi.string().required(),
  amount: Joi.number().min(0.01).required(),
  currency: Joi.string().valid('USD', 'EUR', 'GBP', 'CAD').required()
});

// Custom error messages
export const validationMessages = {
  'paymentTypes.atLeastOne': 'At least one payment type (booking exchange or cash payment) must be enabled',
  'auction.endDateBeforeExpiration': 'Auction end date must be before swap expiration date',
  'auction.lastMinuteBooking': 'Auctions are not allowed for events less than one week away',
  'auction.tooCloseToEvent': 'Auction must end at least one week before the event date',
  'auction.endDateInPast': 'Auction end date must be in the future',
  'cash.belowMinimum': 'Cash offer amount is below the minimum required amount',
  'payment.methodNotVerified': 'Payment method must be verified before use',
  'payment.insufficientFunds': 'Insufficient funds available for this payment method'
};

// Validation helper functions
export const validateAuctionTiming = (eventDate: Date, auctionEndDate: Date): {
  isValid: boolean;
  errors: string[];
  isLastMinute: boolean;
  minimumEndDate: Date;
} => {
  const currentDate = new Date();
  const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;
  const oneWeekBeforeEvent = new Date(eventDate.getTime() - oneWeekInMs);
  const isLastMinute = eventDate.getTime() - currentDate.getTime() < oneWeekInMs;
  
  const errors: string[] = [];
  
  if (isLastMinute) {
    errors.push('Auctions are not allowed for events less than one week away');
  }
  
  if (auctionEndDate >= oneWeekBeforeEvent) {
    errors.push('Auction must end at least one week before the event date');
  }
  
  if (auctionEndDate <= currentDate) {
    errors.push('Auction end date must be in the future');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    isLastMinute,
    minimumEndDate: oneWeekBeforeEvent
  };
};

export const validateCashOffer = (
  offer: { amount: number; currency: string; paymentMethodId: string },
  minimumAmount?: number
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (offer.amount <= 0) {
    errors.push('Cash offer amount must be greater than 0');
  }
  
  if (minimumAmount && offer.amount < minimumAmount) {
    errors.push(`Cash offer amount must be at least $${minimumAmount}`);
  }
  
  if (!offer.paymentMethodId) {
    errors.push('Payment method is required for cash offers');
  }
  
  if (!['USD', 'EUR', 'GBP', 'CAD'].includes(offer.currency)) {
    errors.push('Unsupported currency');
  }
  
  // Add warnings for potentially low offers
  if (minimumAmount && offer.amount < minimumAmount * 1.1) {
    warnings.push('Your offer is close to the minimum amount and may not be competitive');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

export const validatePaymentMethod = async (
  paymentMethodId: string,
  userId: string,
  amount: number
): Promise<{
  isValid: boolean;
  errors: string[];
  warnings: string[];
  requiresVerification: boolean;
}> => {
  // This would typically make API calls to validate the payment method
  // For now, we'll return a mock validation result
  const errors: string[] = [];
  const warnings: string[] = [];
  let requiresVerification = false;
  
  // Mock validation logic
  if (!paymentMethodId) {
    errors.push('Payment method ID is required');
  }
  
  if (amount > 1000) {
    warnings.push('Large payment amounts may require additional verification');
    requiresVerification = true;
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    requiresVerification
  };
};