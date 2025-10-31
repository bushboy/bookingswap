import Joi from '@hapi/joi';

// Auction Creation Validation
export const createAuctionSchema = Joi.object({
  swapId: Joi.string().required(),
  settings: Joi.object({
    endDate: Joi.date().greater('now').required(),
    allowBookingProposals: Joi.boolean().required(),
    allowCashProposals: Joi.boolean().required(),
    minimumCashOffer: Joi.when('allowCashProposals', {
      is: true,
      then: Joi.number().min(1).optional(),
      otherwise: Joi.number().optional()
    }),
    autoSelectAfterHours: Joi.number().min(1).max(168).optional()
  }).required()
}).custom((value, helpers) => {
  const { settings } = value;
  
  // At least one proposal type must be allowed
  if (!settings.allowBookingProposals && !settings.allowCashProposals) {
    return helpers.error('auction.noProposalTypesAllowed');
  }
  
  return value;
});

// Auction Proposal Validation
export const auctionProposalSchema = Joi.object({
  auctionId: Joi.string().required(),
  proposerId: Joi.string().required(),
  proposalType: Joi.string().valid('booking', 'cash').required(),
  bookingId: Joi.when('proposalType', {
    is: 'booking',
    then: Joi.string().required(),
    otherwise: Joi.string().optional()
  }),
  cashOffer: Joi.when('proposalType', {
    is: 'cash',
    then: Joi.object({
      amount: Joi.number().min(0.01).required(),
      currency: Joi.string().valid('USD', 'EUR', 'GBP', 'CAD').required(),
      paymentMethodId: Joi.string().required(),
      escrowRequired: Joi.boolean().required()
    }).required(),
    otherwise: Joi.object().optional()
  }),
  message: Joi.string().max(1000).optional(),
  conditions: Joi.array().items(Joi.string().min(1).max(500)).required()
});

// Winner Selection Validation
export const selectWinnerSchema = Joi.object({
  auctionId: Joi.string().required(),
  proposalId: Joi.string().required(),
  userId: Joi.string().required()
});

// Auction Status Update Validation
export const updateAuctionStatusSchema = Joi.object({
  auctionId: Joi.string().required(),
  status: Joi.string().valid('ended', 'cancelled').required(),
  reason: Joi.string().max(500).optional()
});

// Real-time Auction Validation Functions
export const validateAuctionAccess = (
  userId: string,
  auction: { ownerId: string; status: string }
): {
  canView: boolean;
  canParticipate: boolean;
  canManage: boolean;
  errors: string[];
} => {
  const errors: string[] = [];
  const isOwner = userId === auction.ownerId;
  const isActive = auction.status === 'active';
  
  let canView = true; // Most auctions are publicly viewable
  let canParticipate = isActive && !isOwner;
  let canManage = isOwner && isActive;
  
  if (auction.status === 'ended') {
    canParticipate = false;
    canManage = false;
  }
  
  if (auction.status === 'cancelled') {
    canParticipate = false;
    canManage = false;
  }
  
  return {
    canView,
    canParticipate,
    canManage,
    errors
  };
};

export const validateProposalSubmission = (
  proposal: {
    proposalType: 'booking' | 'cash';
    bookingId?: string;
    cashOffer?: { amount: number; paymentMethodId: string };
  },
  auction: {
    status: string;
    settings: {
      endDate: Date;
      allowBookingProposals: boolean;
      allowCashProposals: boolean;
      minimumCashOffer?: number;
    };
  },
  userId: string,
  ownerId: string
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check if user is the auction owner
  if (userId === ownerId) {
    errors.push('Auction owners cannot submit proposals to their own auctions');
  }
  
  // Check auction status
  if (auction.status !== 'active') {
    errors.push('Cannot submit proposals to inactive auctions');
  }
  
  // Check if auction has ended
  if (new Date() >= auction.settings.endDate) {
    errors.push('Auction has already ended');
  }
  
  // Check proposal type permissions
  if (proposal.proposalType === 'booking' && !auction.settings.allowBookingProposals) {
    errors.push('Booking proposals are not allowed for this auction');
  }
  
  if (proposal.proposalType === 'cash' && !auction.settings.allowCashProposals) {
    errors.push('Cash proposals are not allowed for this auction');
  }
  
  // Validate booking proposal
  if (proposal.proposalType === 'booking') {
    if (!proposal.bookingId) {
      errors.push('Booking ID is required for booking proposals');
    }
  }
  
  // Validate cash proposal
  if (proposal.proposalType === 'cash') {
    if (!proposal.cashOffer) {
      errors.push('Cash offer details are required for cash proposals');
    } else {
      if (proposal.cashOffer.amount <= 0) {
        errors.push('Cash offer amount must be greater than 0');
      }
      
      if (auction.settings.minimumCashOffer && 
          proposal.cashOffer.amount < auction.settings.minimumCashOffer) {
        errors.push(`Cash offer must be at least $${auction.settings.minimumCashOffer}`);
      }
      
      if (!proposal.cashOffer.paymentMethodId) {
        errors.push('Payment method is required for cash offers');
      }
      
      // Warning for low offers
      if (auction.settings.minimumCashOffer && 
          proposal.cashOffer.amount < auction.settings.minimumCashOffer * 1.1) {
        warnings.push('Your offer is close to the minimum and may not be competitive');
      }
    }
  }
  
  // Check time remaining
  const timeRemaining = auction.settings.endDate.getTime() - new Date().getTime();
  const oneHourInMs = 60 * 60 * 1000;
  
  if (timeRemaining < oneHourInMs) {
    warnings.push('Auction ends in less than one hour');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

export const validateWinnerSelection = (
  proposalId: string,
  auction: {
    status: string;
    proposals: Array<{ id: string; status: string }>;
    winningProposalId?: string;
  },
  userId: string,
  ownerId: string
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check if user is the auction owner
  if (userId !== ownerId) {
    errors.push('Only auction owners can select winners');
  }
  
  // Check auction status
  if (auction.status !== 'ended') {
    errors.push('Can only select winners from ended auctions');
  }
  
  // Check if winner already selected
  if (auction.winningProposalId) {
    errors.push('Winner has already been selected for this auction');
  }
  
  // Check if proposal exists and is valid
  const proposal = auction.proposals.find(p => p.id === proposalId);
  if (!proposal) {
    errors.push('Selected proposal does not exist');
  } else if (proposal.status !== 'pending') {
    errors.push('Can only select pending proposals as winners');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

export const validateAuctionTimeout = (
  auction: {
    status: string;
    settings: {
      endDate: Date;
      autoSelectAfterHours?: number;
    };
    proposals: Array<{ id: string; proposalType: string; cashOffer?: { amount: number } }>;
    winningProposalId?: string;
  }
): {
  shouldAutoSelect: boolean;
  recommendedProposalId?: string;
  errors: string[];
} => {
  const errors: string[] = [];
  
  // Check if auction is in correct state for auto-selection
  if (auction.status !== 'ended') {
    errors.push('Auto-selection only applies to ended auctions');
    return { shouldAutoSelect: false, errors };
  }
  
  if (auction.winningProposalId) {
    errors.push('Winner has already been selected');
    return { shouldAutoSelect: false, errors };
  }
  
  if (!auction.settings.autoSelectAfterHours) {
    return { shouldAutoSelect: false, errors };
  }
  
  // Check if enough time has passed since auction ended
  const timeSinceEnd = new Date().getTime() - auction.settings.endDate.getTime();
  const autoSelectThreshold = auction.settings.autoSelectAfterHours * 60 * 60 * 1000;
  
  if (timeSinceEnd < autoSelectThreshold) {
    return { shouldAutoSelect: false, errors };
  }
  
  // Find the best proposal (highest cash offer or first booking proposal)
  const cashProposals = auction.proposals
    .filter(p => p.proposalType === 'cash' && p.cashOffer)
    .sort((a, b) => (b.cashOffer?.amount || 0) - (a.cashOffer?.amount || 0));
  
  const bookingProposals = auction.proposals
    .filter(p => p.proposalType === 'booking');
  
  let recommendedProposalId: string | undefined;
  
  if (cashProposals.length > 0) {
    recommendedProposalId = cashProposals[0]?.id;
  } else if (bookingProposals.length > 0) {
    recommendedProposalId = bookingProposals[0]?.id;
  }
  
  return {
    shouldAutoSelect: true,
    recommendedProposalId,
    errors
  };
};

// Custom error messages for auction validation
export const auctionValidationMessages = {
  'auction.noProposalTypesAllowed': 'At least one proposal type (booking or cash) must be allowed',
  'auction.ownerCannotPropose': 'Auction owners cannot submit proposals to their own auctions',
  'auction.auctionEnded': 'This auction has already ended',
  'auction.auctionInactive': 'This auction is not currently active',
  'auction.proposalTypeNotAllowed': 'This type of proposal is not allowed for this auction',
  'auction.cashOfferTooLow': 'Cash offer is below the minimum required amount',
  'auction.winnerAlreadySelected': 'A winner has already been selected for this auction',
  'auction.invalidProposal': 'The selected proposal is not valid or does not exist'
};