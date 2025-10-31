import { 
  SwapPlatformError, 
  ValidationError, 
  BusinessLogicError,
  ERROR_CODES 
} from '@booking-swap/shared';
import { Request } from 'express';
import { logger } from './logger';

// Specific error codes for proposal validation
export const PROPOSAL_ERROR_CODES = {
  // Eligibility errors
  INVALID_SOURCE_SWAP: 'INVALID_SOURCE_SWAP',
  INVALID_TARGET_SWAP: 'INVALID_TARGET_SWAP',
  EXISTING_PROPOSAL: 'EXISTING_PROPOSAL',
  SWAP_NOT_AVAILABLE: 'SWAP_NOT_AVAILABLE',
  USER_NOT_AUTHORIZED: 'USER_NOT_AUTHORIZED',
  INSUFFICIENT_ELIGIBLE_SWAPS: 'INSUFFICIENT_ELIGIBLE_SWAPS',
  
  // Validation errors
  PROPOSAL_MESSAGE_TOO_LONG: 'PROPOSAL_MESSAGE_TOO_LONG',
  PROPOSAL_MESSAGE_INAPPROPRIATE: 'PROPOSAL_MESSAGE_INAPPROPRIATE',
  INVALID_CONDITIONS: 'INVALID_CONDITIONS',
  TOO_MANY_CONDITIONS: 'TOO_MANY_CONDITIONS',
  TERMS_NOT_AGREED: 'TERMS_NOT_AGREED',
  
  // Compatibility errors
  LOW_COMPATIBILITY_SCORE: 'LOW_COMPATIBILITY_SCORE',
  INCOMPATIBLE_SWAPS: 'INCOMPATIBLE_SWAPS',
  VALUE_MISMATCH_WARNING: 'VALUE_MISMATCH_WARNING',
  
  // Rate limiting errors
  PROPOSAL_RATE_LIMIT_EXCEEDED: 'PROPOSAL_RATE_LIMIT_EXCEEDED',
  DAILY_PROPOSAL_LIMIT_EXCEEDED: 'DAILY_PROPOSAL_LIMIT_EXCEEDED',
  
  // Business logic errors
  PROPOSAL_CREATION_BLOCKED: 'PROPOSAL_CREATION_BLOCKED',
  SWAP_OWNER_CANNOT_PROPOSE: 'SWAP_OWNER_CANNOT_PROPOSE',
  DUPLICATE_PROPOSAL_ATTEMPT: 'DUPLICATE_PROPOSAL_ATTEMPT',
} as const;

// Proposal validation error class
export class ProposalValidationError extends ValidationError {
  constructor(
    code: string,
    message: string,
    details?: Record<string, any>,
    context?: Record<string, any>
  ) {
    super(message, details, context);
    this.code = code;
    this.name = 'ProposalValidationError';
  }
}

// Proposal business logic error class
export class ProposalBusinessError extends BusinessLogicError {
  constructor(
    code: string,
    message: string,
    context?: Record<string, any>
  ) {
    super(code, message, context);
    this.name = 'ProposalBusinessError';
  }
}

// Rate limiting error class
export class ProposalRateLimitError extends SwapPlatformError {
  constructor(
    code: string,
    message: string,
    retryAfter: number,
    context?: Record<string, any>
  ) {
    super(code, message, 'rate_limiting', true, { ...context, retryAfter });
    this.name = 'ProposalRateLimitError';
  }
}

// Error factory for creating specific proposal errors
export class ProposalErrorFactory {
  static createEligibilityError(
    code: string,
    sourceSwapId?: string,
    targetSwapId?: string,
    userId?: string,
    reason?: string
  ): ProposalValidationError {
    const messages = {
      [PROPOSAL_ERROR_CODES.INVALID_SOURCE_SWAP]: 'The selected swap is not valid or no longer available for proposing',
      [PROPOSAL_ERROR_CODES.INVALID_TARGET_SWAP]: 'The target swap is not available for proposals',
      [PROPOSAL_ERROR_CODES.EXISTING_PROPOSAL]: 'You have already made a proposal for this swap',
      [PROPOSAL_ERROR_CODES.SWAP_NOT_AVAILABLE]: 'One or both swaps are no longer available',
      [PROPOSAL_ERROR_CODES.USER_NOT_AUTHORIZED]: 'You are not authorized to make this proposal',
      [PROPOSAL_ERROR_CODES.INSUFFICIENT_ELIGIBLE_SWAPS]: 'You don\'t have any eligible swaps to propose',
    };

    const message = messages[code as keyof typeof messages] || 'Proposal eligibility check failed';
    
    return new ProposalValidationError(code, message, {
      sourceSwapId,
      targetSwapId,
      userId,
      reason,
      suggestedActions: this.getSuggestedActions(code)
    });
  }

  static createValidationError(
    code: string,
    fieldName?: string,
    value?: any,
    constraint?: any
  ): ProposalValidationError {
    const messages = {
      [PROPOSAL_ERROR_CODES.PROPOSAL_MESSAGE_TOO_LONG]: `Proposal message exceeds maximum length of ${constraint} characters`,
      [PROPOSAL_ERROR_CODES.PROPOSAL_MESSAGE_INAPPROPRIATE]: 'Proposal message contains inappropriate content',
      [PROPOSAL_ERROR_CODES.INVALID_CONDITIONS]: 'One or more proposal conditions are invalid',
      [PROPOSAL_ERROR_CODES.TOO_MANY_CONDITIONS]: `Too many conditions specified (maximum ${constraint})`,
      [PROPOSAL_ERROR_CODES.TERMS_NOT_AGREED]: 'You must agree to the terms and conditions',
    };

    const message = messages[code as keyof typeof messages] || 'Proposal validation failed';
    
    return new ProposalValidationError(code, message, {
      fieldName,
      value,
      constraint,
      suggestedActions: this.getSuggestedActions(code)
    });
  }

  static createCompatibilityError(
    code: string,
    compatibilityScore?: number,
    threshold?: number,
    factors?: Record<string, any>
  ): ProposalValidationError {
    const messages = {
      [PROPOSAL_ERROR_CODES.LOW_COMPATIBILITY_SCORE]: `Compatibility score (${compatibilityScore}%) is below recommended threshold (${threshold}%)`,
      [PROPOSAL_ERROR_CODES.INCOMPATIBLE_SWAPS]: 'The selected swaps are not compatible for exchange',
      [PROPOSAL_ERROR_CODES.VALUE_MISMATCH_WARNING]: 'Significant value difference detected between swaps',
    };

    const message = messages[code as keyof typeof messages] || 'Compatibility check failed';
    
    return new ProposalValidationError(code, message, {
      compatibilityScore,
      threshold,
      factors,
      suggestedActions: this.getSuggestedActions(code)
    });
  }

  static createRateLimitError(
    code: string,
    userId: string,
    limit: number,
    timeWindow: string,
    retryAfter: number
  ): ProposalRateLimitError {
    const messages = {
      [PROPOSAL_ERROR_CODES.PROPOSAL_RATE_LIMIT_EXCEEDED]: `Too many proposal attempts. Limit: ${limit} per ${timeWindow}`,
      [PROPOSAL_ERROR_CODES.DAILY_PROPOSAL_LIMIT_EXCEEDED]: `Daily proposal limit of ${limit} exceeded`,
    };

    const message = messages[code as keyof typeof messages] || 'Rate limit exceeded';
    
    return new ProposalRateLimitError(code, message, retryAfter, {
      userId,
      limit,
      timeWindow,
      suggestedActions: this.getSuggestedActions(code)
    });
  }

  static createBusinessError(
    code: string,
    userId?: string,
    swapId?: string,
    reason?: string
  ): ProposalBusinessError {
    const messages = {
      [PROPOSAL_ERROR_CODES.PROPOSAL_CREATION_BLOCKED]: 'Proposal creation is currently blocked for this user',
      [PROPOSAL_ERROR_CODES.SWAP_OWNER_CANNOT_PROPOSE]: 'You cannot make a proposal to your own swap',
      [PROPOSAL_ERROR_CODES.DUPLICATE_PROPOSAL_ATTEMPT]: 'A proposal between these swaps already exists',
    };

    const message = messages[code as keyof typeof messages] || 'Business rule violation';
    
    return new ProposalBusinessError(code, message, {
      userId,
      swapId,
      reason,
      suggestedActions: this.getSuggestedActions(code)
    });
  }

  private static getSuggestedActions(code: string): string[] {
    const actionMap = {
      [PROPOSAL_ERROR_CODES.INVALID_SOURCE_SWAP]: [
        'Refresh the page and try again',
        'Select a different swap to propose',
        'Check that your swap is still active'
      ],
      [PROPOSAL_ERROR_CODES.INVALID_TARGET_SWAP]: [
        'Refresh the page to see current availability',
        'Browse other available swaps',
        'Try again later'
      ],
      [PROPOSAL_ERROR_CODES.EXISTING_PROPOSAL]: [
        'Check your proposals page for status',
        'Wait for a response to your existing proposal',
        'Browse other available swaps'
      ],
      [PROPOSAL_ERROR_CODES.INSUFFICIENT_ELIGIBLE_SWAPS]: [
        'Create a new swap listing',
        'Ensure your existing swaps are active',
        'Check swap requirements and compatibility'
      ],
      [PROPOSAL_ERROR_CODES.PROPOSAL_MESSAGE_TOO_LONG]: [
        'Shorten your message',
        'Focus on key points',
        'Remove unnecessary details'
      ],
      [PROPOSAL_ERROR_CODES.PROPOSAL_MESSAGE_INAPPROPRIATE]: [
        'Remove personal contact information',
        'Use appropriate language',
        'Focus on swap-related content'
      ],
      [PROPOSAL_ERROR_CODES.TOO_MANY_CONDITIONS]: [
        'Reduce the number of conditions',
        'Combine similar conditions',
        'Focus on essential requirements'
      ],
      [PROPOSAL_ERROR_CODES.LOW_COMPATIBILITY_SCORE]: [
        'Consider selecting a more compatible swap',
        'Review compatibility factors',
        'Add explanatory message about differences'
      ],
      [PROPOSAL_ERROR_CODES.PROPOSAL_RATE_LIMIT_EXCEEDED]: [
        'Wait before making another proposal',
        'Review and improve proposal quality',
        'Focus on most promising opportunities'
      ],
      [PROPOSAL_ERROR_CODES.SWAP_OWNER_CANNOT_PROPOSE]: [
        'Browse swaps from other users',
        'Share your swap to attract proposals',
        'Wait for others to propose to your swap'
      ]
    };

    return actionMap[code as keyof typeof actionMap] || ['Contact support for assistance'];
  }
}

// Enhanced error response formatter
export interface ProposalErrorResponse {
  error: {
    code: string;
    message: string;
    category: string;
    details?: Record<string, any>;
    suggestedActions: string[];
    retryable: boolean;
    retryAfter?: number;
    timestamp: string;
    requestId?: string;
  };
}

export const formatProposalErrorResponse = (
  error: Error,
  requestId?: string
): ProposalErrorResponse => {
  let code = 'UNKNOWN_ERROR';
  let message = 'An unexpected error occurred';
  let category = 'server_error';
  let details: Record<string, any> = {};
  let suggestedActions: string[] = ['Try again later', 'Contact support if problem persists'];
  let retryable = false;
  let retryAfter: number | undefined;

  if (error instanceof ProposalValidationError) {
    code = error.code;
    message = error.message;
    category = 'validation';
    details = error.details || {};
    suggestedActions = details.suggestedActions || suggestedActions;
    retryable = false;
  } else if (error instanceof ProposalBusinessError) {
    code = error.code;
    message = error.message;
    category = 'business';
    details = error.context || {};
    suggestedActions = details.suggestedActions || suggestedActions;
    retryable = false;
  } else if (error instanceof ProposalRateLimitError) {
    code = error.code;
    message = error.message;
    category = 'rate_limiting';
    details = error.context || {};
    suggestedActions = details.suggestedActions || suggestedActions;
    retryable = true;
    retryAfter = details.retryAfter;
  } else if (error instanceof SwapPlatformError) {
    code = error.code;
    message = error.message;
    category = error.category;
    details = error.context || {};
    retryable = error.retryable;
  }

  return {
    error: {
      code,
      message,
      category,
      details,
      suggestedActions,
      retryable,
      retryAfter,
      timestamp: new Date().toISOString(),
      requestId
    }
  };
};

// Rate limiting service for proposals
export class ProposalRateLimiter {
  private static readonly RATE_LIMITS = {
    PROPOSALS_PER_MINUTE: 5,
    PROPOSALS_PER_HOUR: 20,
    PROPOSALS_PER_DAY: 50,
  };

  private static userAttempts = new Map<string, Array<{ timestamp: number; type: string }>>();

  static async checkRateLimit(userId: string, type: 'proposal' = 'proposal'): Promise<void> {
    const now = Date.now();
    const userKey = `${userId}:${type}`;
    
    if (!this.userAttempts.has(userKey)) {
      this.userAttempts.set(userKey, []);
    }

    const attempts = this.userAttempts.get(userKey)!;
    
    // Clean old attempts
    const oneMinuteAgo = now - 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    
    const recentAttempts = attempts.filter(attempt => attempt.timestamp > oneDayAgo);
    this.userAttempts.set(userKey, recentAttempts);

    // Check limits
    const attemptsLastMinute = recentAttempts.filter(a => a.timestamp > oneMinuteAgo).length;
    const attemptsLastHour = recentAttempts.filter(a => a.timestamp > oneHourAgo).length;
    const attemptsLastDay = recentAttempts.length;

    if (attemptsLastMinute >= this.RATE_LIMITS.PROPOSALS_PER_MINUTE) {
      throw ProposalErrorFactory.createRateLimitError(
        PROPOSAL_ERROR_CODES.PROPOSAL_RATE_LIMIT_EXCEEDED,
        userId,
        this.RATE_LIMITS.PROPOSALS_PER_MINUTE,
        'minute',
        60 - Math.floor((now - oneMinuteAgo) / 1000)
      );
    }

    if (attemptsLastHour >= this.RATE_LIMITS.PROPOSALS_PER_HOUR) {
      throw ProposalErrorFactory.createRateLimitError(
        PROPOSAL_ERROR_CODES.PROPOSAL_RATE_LIMIT_EXCEEDED,
        userId,
        this.RATE_LIMITS.PROPOSALS_PER_HOUR,
        'hour',
        3600 - Math.floor((now - oneHourAgo) / 1000)
      );
    }

    if (attemptsLastDay >= this.RATE_LIMITS.PROPOSALS_PER_DAY) {
      throw ProposalErrorFactory.createRateLimitError(
        PROPOSAL_ERROR_CODES.DAILY_PROPOSAL_LIMIT_EXCEEDED,
        userId,
        this.RATE_LIMITS.PROPOSALS_PER_DAY,
        'day',
        86400 - Math.floor((now - oneDayAgo) / 1000)
      );
    }

    // Record this attempt
    recentAttempts.push({ timestamp: now, type });
  }

  static recordAttempt(userId: string, type: 'proposal' = 'proposal'): void {
    const userKey = `${userId}:${type}`;
    if (!this.userAttempts.has(userKey)) {
      this.userAttempts.set(userKey, []);
    }
    this.userAttempts.get(userKey)!.push({ timestamp: Date.now(), type });
  }
}

// Comprehensive logging for proposal errors
export const logProposalError = (
  error: Error,
  context: {
    userId?: string;
    sourceSwapId?: string;
    targetSwapId?: string;
    operation: string;
    requestId?: string;
    userAgent?: string;
    ip?: string;
  }
) => {
  const logData = {
    error: {
      name: error.name,
      message: error.message,
      code: (error as any).code,
      category: (error as any).category,
      stack: error.stack,
    },
    context,
    timestamp: new Date().toISOString(),
  };

  if (error instanceof ProposalValidationError) {
    logger.warn('Proposal validation error', logData);
  } else if (error instanceof ProposalBusinessError) {
    logger.info('Proposal business rule violation', logData);
  } else if (error instanceof ProposalRateLimitError) {
    logger.warn('Proposal rate limit exceeded', logData);
  } else {
    logger.error('Unexpected proposal error', logData);
  }
};

// Middleware for handling proposal-specific errors
export const proposalErrorHandler = (
  error: Error,
  req: Request,
  res: any,
  next: any
) => {
  // Log the error with context
  logProposalError(error, {
    userId: req.user?.id,
    sourceSwapId: req.body?.sourceSwapId,
    targetSwapId: req.body?.targetSwapId || req.params?.targetSwapId,
    operation: `${req.method} ${req.path}`,
    requestId: req.requestId,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
  });

  // Format and send error response
  const errorResponse = formatProposalErrorResponse(error, req.requestId);
  
  // Determine HTTP status code
  let statusCode = 500;
  if (error instanceof ProposalValidationError) {
    statusCode = 400;
  } else if (error instanceof ProposalBusinessError) {
    statusCode = 409;
  } else if (error instanceof ProposalRateLimitError) {
    statusCode = 429;
    res.setHeader('Retry-After', errorResponse.error.retryAfter || 60);
  }

  res.status(statusCode).json(errorResponse);
};

// Validation helpers
export const validateProposalRequest = (requestData: any): void => {
  const { sourceSwapId, targetSwapId, message, conditions, agreedToTerms } = requestData;

  if (!sourceSwapId) {
    throw ProposalErrorFactory.createValidationError(
      PROPOSAL_ERROR_CODES.INVALID_SOURCE_SWAP,
      'sourceSwapId',
      sourceSwapId
    );
  }

  if (!targetSwapId) {
    throw ProposalErrorFactory.createValidationError(
      PROPOSAL_ERROR_CODES.INVALID_TARGET_SWAP,
      'targetSwapId',
      targetSwapId
    );
  }

  if (!agreedToTerms) {
    throw ProposalErrorFactory.createValidationError(
      PROPOSAL_ERROR_CODES.TERMS_NOT_AGREED,
      'agreedToTerms',
      agreedToTerms
    );
  }

  if (message && message.length > 500) {
    throw ProposalErrorFactory.createValidationError(
      PROPOSAL_ERROR_CODES.PROPOSAL_MESSAGE_TOO_LONG,
      'message',
      message,
      500
    );
  }

  if (conditions && conditions.length > 10) {
    throw ProposalErrorFactory.createValidationError(
      PROPOSAL_ERROR_CODES.TOO_MANY_CONDITIONS,
      'conditions',
      conditions,
      10
    );
  }

  // Check for inappropriate content in message
  if (message && containsInappropriateContent(message)) {
    throw ProposalErrorFactory.createValidationError(
      PROPOSAL_ERROR_CODES.PROPOSAL_MESSAGE_INAPPROPRIATE,
      'message',
      message
    );
  }
};

// Helper function to detect inappropriate content
const containsInappropriateContent = (text: string): boolean => {
  const inappropriatePatterns = [
    /\b(contact|email|phone|call|text)\s*(me|us)\b/i,
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/, // Phone numbers
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email addresses
    /\b(whatsapp|telegram|discord|skype)\b/i, // Messaging apps
  ];

  return inappropriatePatterns.some(pattern => pattern.test(text));
};