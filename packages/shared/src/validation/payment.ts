import Joi from '@hapi/joi';

// Payment Method Validation
export const paymentMethodSchema = Joi.object({
  userId: Joi.string().required(),
  type: Joi.string().valid('credit_card', 'bank_transfer', 'digital_wallet').required(),
  displayName: Joi.string().min(1).max(100).required(),
  metadata: Joi.object().required()
});

// Payment Request Validation
export const paymentRequestSchema = Joi.object({
  amount: Joi.number().min(0.01).max(50000).required(),
  currency: Joi.string().valid('USD', 'EUR', 'GBP', 'CAD').required(),
  payerId: Joi.string().required(),
  recipientId: Joi.string().required(),
  paymentMethodId: Joi.string().required(),
  swapId: Joi.string().required(),
  proposalId: Joi.string().required(),
  escrowRequired: Joi.boolean().required()
});

// Escrow Request Validation
export const escrowRequestSchema = Joi.object({
  amount: Joi.number().min(0.01).max(50000).required(),
  currency: Joi.string().valid('USD', 'EUR', 'GBP', 'CAD').required(),
  payerId: Joi.string().required(),
  recipientId: Joi.string().required(),
  swapId: Joi.string().required(),
  proposalId: Joi.string().required()
});

// Escrow Release Validation
export const escrowReleaseSchema = Joi.object({
  escrowId: Joi.string().required(),
  recipientId: Joi.string().required(),
  releaseAmount: Joi.number().min(0.01).optional(),
  reason: Joi.string().min(1).max(500).required()
});

// Payment Validation Functions
export const validatePaymentAmount = (
  amount: number,
  currency: string,
  minimumAmount?: number,
  maximumAmount?: number
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (amount <= 0) {
    errors.push('Payment amount must be greater than 0');
  }
  
  if (minimumAmount && amount < minimumAmount) {
    errors.push(`Payment amount must be at least ${minimumAmount} ${currency}`);
  }
  
  if (maximumAmount && amount > maximumAmount) {
    errors.push(`Payment amount cannot exceed ${maximumAmount} ${currency}`);
  }
  
  // Currency-specific validations
  const currencyLimits = {
    USD: { min: 0.01, max: 50000, warningThreshold: 10000 },
    EUR: { min: 0.01, max: 45000, warningThreshold: 9000 },
    GBP: { min: 0.01, max: 40000, warningThreshold: 8000 },
    CAD: { min: 0.01, max: 65000, warningThreshold: 13000 }
  };
  
  const limits = currencyLimits[currency as keyof typeof currencyLimits];
  if (limits) {
    if (amount < limits.min) {
      errors.push(`Minimum payment amount for ${currency} is ${limits.min}`);
    }
    
    if (amount > limits.max) {
      errors.push(`Maximum payment amount for ${currency} is ${limits.max}`);
    }
    
    if (amount > limits.warningThreshold) {
      warnings.push(`Large payment amounts may require additional verification`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

export const validatePaymentMethodForAmount = (
  paymentMethod: {
    type: string;
    isVerified: boolean;
    metadata: Record<string, any>;
  },
  amount: number,
  currency: string
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  requiresVerification: boolean;
} => {
  const errors: string[] = [];
  const warnings: string[] = [];
  let requiresVerification = false;
  
  // Check if payment method is verified
  if (!paymentMethod.isVerified) {
    errors.push('Payment method must be verified before use');
    requiresVerification = true;
  }
  
  // Type-specific validations
  switch (paymentMethod.type) {
    case 'credit_card':
      if (amount > 5000) {
        warnings.push('Large credit card transactions may have additional fees');
      }
      if (amount > 10000) {
        requiresVerification = true;
        warnings.push('Large credit card payments require additional verification');
      }
      break;
      
    case 'bank_transfer':
      if (amount < 10) {
        warnings.push('Bank transfers for small amounts may have high relative fees');
      }
      if (amount > 25000) {
        requiresVerification = true;
        warnings.push('Large bank transfers require additional verification');
      }
      break;
      
    case 'digital_wallet':
      if (amount > 2500) {
        warnings.push('Digital wallet limits may apply for large amounts');
      }
      if (amount > 5000) {
        errors.push('Digital wallet payments are limited to $5,000');
      }
      break;
  }
  
  // Check metadata for additional limits
  if (paymentMethod.metadata.dailyLimit && amount > paymentMethod.metadata.dailyLimit) {
    errors.push(`Payment exceeds daily limit of ${paymentMethod.metadata.dailyLimit} ${currency}`);
  }
  
  if (paymentMethod.metadata.monthlyLimit && amount > paymentMethod.metadata.monthlyLimit) {
    errors.push(`Payment exceeds monthly limit of ${paymentMethod.metadata.monthlyLimit} ${currency}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    requiresVerification
  };
};

export const validateEscrowRequirements = (
  amount: number,
  currency: string,
  payerTrustScore: number,
  recipientTrustScore: number
): {
  escrowRequired: boolean;
  escrowRecommended: boolean;
  reasons: string[];
} => {
  const reasons: string[] = [];
  let escrowRequired = false;
  let escrowRecommended = false;
  
  // Amount-based escrow requirements
  const escrowThresholds = {
    USD: { required: 1000, recommended: 500 },
    EUR: { required: 900, recommended: 450 },
    GBP: { required: 800, recommended: 400 },
    CAD: { required: 1300, recommended: 650 }
  };
  
  const thresholds = escrowThresholds[currency as keyof typeof escrowThresholds];
  if (thresholds) {
    if (amount >= thresholds.required) {
      escrowRequired = true;
      reasons.push(`Escrow required for ${currency} amounts over ${thresholds.required}`);
    } else if (amount >= thresholds.recommended) {
      escrowRecommended = true;
      reasons.push(`Escrow recommended for ${currency} amounts over ${thresholds.recommended}`);
    }
  }
  
  // Trust score-based requirements
  if (payerTrustScore < 50 || recipientTrustScore < 50) {
    escrowRequired = true;
    reasons.push('Escrow required due to low trust scores');
  } else if (payerTrustScore < 75 || recipientTrustScore < 75) {
    escrowRecommended = true;
    reasons.push('Escrow recommended due to moderate trust scores');
  }
  
  return {
    escrowRequired,
    escrowRecommended,
    reasons
  };
};

export const validateFraudRisk = (
  paymentRequest: {
    amount: number;
    currency: string;
    payerId: string;
    paymentMethodId: string;
  },
  payerContext: {
    accountAge: number; // days
    previousTransactions: number;
    recentFailures: number;
    ipAddress: string;
    deviceFingerprint?: string;
  }
): {
  riskLevel: 'low' | 'medium' | 'high';
  riskScore: number; // 0-100
  flags: string[];
  requiresReview: boolean;
  recommendedAction: 'approve' | 'review' | 'reject';
} => {
  const flags: string[] = [];
  let riskScore = 0;
  
  // Account age risk
  if (payerContext.accountAge < 7) {
    riskScore += 30;
    flags.push('New account (less than 7 days old)');
  } else if (payerContext.accountAge < 30) {
    riskScore += 15;
    flags.push('Recent account (less than 30 days old)');
  }
  
  // Transaction history risk
  if (payerContext.previousTransactions === 0) {
    riskScore += 25;
    flags.push('No previous transaction history');
  } else if (payerContext.previousTransactions < 5) {
    riskScore += 10;
    flags.push('Limited transaction history');
  }
  
  // Recent failures risk
  if (payerContext.recentFailures > 2) {
    riskScore += 40;
    flags.push('Multiple recent payment failures');
  } else if (payerContext.recentFailures > 0) {
    riskScore += 15;
    flags.push('Recent payment failures');
  }
  
  // Amount-based risk
  if (paymentRequest.amount > 5000) {
    riskScore += 20;
    flags.push('Large payment amount');
  } else if (paymentRequest.amount > 1000) {
    riskScore += 10;
    flags.push('Moderate payment amount');
  }
  
  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high';
  let recommendedAction: 'approve' | 'review' | 'reject';
  
  if (riskScore >= 70) {
    riskLevel = 'high';
    recommendedAction = 'reject';
  } else if (riskScore >= 40) {
    riskLevel = 'medium';
    recommendedAction = 'review';
  } else {
    riskLevel = 'low';
    recommendedAction = 'approve';
  }
  
  const requiresReview = riskLevel !== 'low';
  
  return {
    riskLevel,
    riskScore,
    flags,
    requiresReview,
    recommendedAction
  };
};

export const calculatePaymentFees = (
  amount: number,
  currency: string,
  paymentMethodType: string,
  escrowRequired: boolean
): {
  platformFee: number;
  processingFee: number;
  escrowFee: number;
  totalFees: number;
  netAmount: number;
} => {
  // Platform fee (percentage-based)
  const platformFeeRate = 0.025; // 2.5%
  const platformFee = Math.round(amount * platformFeeRate * 100) / 100;
  
  // Processing fee (varies by payment method)
  const processingFeeRates = {
    credit_card: 0.029, // 2.9%
    bank_transfer: 0.005, // 0.5%
    digital_wallet: 0.015 // 1.5%
  };
  
  const processingFeeRate = processingFeeRates[paymentMethodType as keyof typeof processingFeeRates] || 0.025;
  const processingFee = Math.round(amount * processingFeeRate * 100) / 100;
  
  // Escrow fee (flat fee if required)
  const escrowFee = escrowRequired ? 5.00 : 0;
  
  const totalFees = platformFee + processingFee + escrowFee;
  const netAmount = amount - totalFees;
  
  return {
    platformFee,
    processingFee,
    escrowFee,
    totalFees,
    netAmount
  };
};

// Custom error messages for payment validation
export const paymentValidationMessages = {
  'payment.amountTooLow': 'Payment amount is below the minimum required',
  'payment.amountTooHigh': 'Payment amount exceeds the maximum allowed',
  'payment.methodNotVerified': 'Payment method must be verified before use',
  'payment.insufficientFunds': 'Insufficient funds available for this payment',
  'payment.dailyLimitExceeded': 'Payment exceeds daily spending limit',
  'payment.monthlyLimitExceeded': 'Payment exceeds monthly spending limit',
  'payment.fraudRiskHigh': 'Payment flagged for high fraud risk',
  'payment.escrowRequired': 'Escrow is required for this payment amount',
  'payment.currencyNotSupported': 'Currency is not supported for payments'
};