/**
 * Tests for UI Simplification Error Handling
 * 
 * Comprehensive test suite for error classes, recovery mechanisms,
 * and error handling utilities.
 */

import {
  UISimplificationError,
  FormValidationError,
  InlineProposalError,
  FilterApplicationError,
  OptimisticUpdateError,
  UIErrorRecoveryManager,
  UIErrorUtils,
  uiErrorRecoveryManager
} from '../uiSimplificationErrors';

describe('UISimplificationError Classes', () => {
  describe('FormValidationError', () => {
    it('should create field-specific validation error', () => {
      const error = FormValidationError.forField(
        'email',
        'Invalid email format',
        { rule: 'format', format: 'user@domain.com' }
      );

      expect(error.field).toBe('email');
      expect(error.message).toBe('Invalid email format');
      expect(error.validationRule).toBe('format');
      expect(error.expectedFormat).toBe('user@domain.com');
    });

    it('should create cross-field validation error', () => {
      const error = FormValidationError.crossField(
        ['startDate', 'endDate'],
        'End date must be after start date'
      );

      expect(error.field).toBe('startDate,endDate');
      expect(error.validationRule).toBe('cross_field_validation');
    });

    it('should generate appropriate display messages', () => {
      const requiredError = new FormValidationError(
        'title',
        'Title is required',
        'required'
      );
      expect(requiredError.getDisplayMessage()).toBe('title is required');

      const formatError = new FormValidationError(
        'phone',
        'Invalid phone format',
        'format',
        '+1-XXX-XXX-XXXX'
      );
      expect(formatError.getDisplayMessage()).toBe('phone must be in format: +1-XXX-XXX-XXXX');

      const minValueError = new FormValidationError(
        'price',
        'Price too low',
        'min_value',
        undefined,
        50
      );
      expect(minValueError.getDisplayMessage()).toBe('price must be greater than 50');
    });
  });

  describe('InlineProposalError', () => {
    it('should create network error with retry capability', () => {
      const error = InlineProposalError.networkError('booking-123', 'cash', 1);

      expect(error.bookingId).toBe('booking-123');
      expect(error.proposalType).toBe('cash');
      expect(error.retryable).toBe(true);
      expect(error.retryCount).toBe(1);
      expect(error.canRetry()).toBe(true);
    });

    it('should create validation error without retry capability', () => {
      const error = InlineProposalError.validationError(
        'booking-123',
        'booking',
        'Selected booking is not available'
      );

      expect(error.retryable).toBe(false);
      expect(error.canRetry()).toBe(false);
    });

    it('should create business logic error', () => {
      const error = InlineProposalError.businessLogicError(
        'booking-123',
        'cash',
        'Auction has ended'
      );

      expect(error.retryable).toBe(false);
      expect(error.message).toBe('Auction has ended');
    });

    it('should handle retry attempts correctly', () => {
      const error = InlineProposalError.networkError('booking-123', 'cash', 2);
      
      expect(error.canRetry()).toBe(true);
      
      const nextError = error.forRetry();
      expect(nextError.retryCount).toBe(3);
      expect(nextError.canRetry()).toBe(false); // Max retries reached
    });

    it('should throw error when trying to retry non-retryable error', () => {
      const error = InlineProposalError.validationError(
        'booking-123',
        'cash',
        'Invalid amount'
      );

      expect(() => error.forRetry()).toThrow('Cannot retry: maximum retries exceeded or error is not retryable');
    });
  });

  describe('FilterApplicationError', () => {
    it('should create network error with fallback', () => {
      const error = FilterApplicationError.networkError('location', 'New York');

      expect(error.filterType).toBe('location');
      expect(error.filterValue).toBe('New York');
      expect(error.fallbackAvailable).toBe(true);
      expect(error.partialResults).toBe(true);
    });

    it('should create invalid value error', () => {
      const error = FilterApplicationError.invalidValue(
        'dateRange',
        'invalid-date',
        'YYYY-MM-DD'
      );

      expect(error.fallbackAvailable).toBe(false);
      expect(error.partialResults).toBe(false);
    });

    it('should provide appropriate fallback strategies', () => {
      const networkError = FilterApplicationError.networkError('location', 'NYC');
      const networkStrategy = networkError.getFallbackStrategy();
      
      expect(networkStrategy.type).toBe('cached_results');
      expect(networkStrategy.action).toBe('retry_filter');

      const invalidError = FilterApplicationError.invalidValue('date', 'bad-date', 'YYYY-MM-DD');
      const invalidStrategy = invalidError.getFallbackStrategy();
      
      expect(invalidStrategy.type).toBe('no_filter');
      expect(invalidStrategy.action).toBe('clear_filter');
    });
  });

  describe('OptimisticUpdateError', () => {
    it('should create booking creation error', () => {
      const originalBookings = [{ id: '1', title: 'Booking 1' }];
      const optimisticBooking = { id: '2', title: 'New Booking' };
      const networkError = new Error('Network failed');

      const error = OptimisticUpdateError.bookingCreation(
        originalBookings,
        optimisticBooking,
        networkError
      );

      expect(error.operation).toBe('create_booking');
      expect(error.originalState).toEqual(originalBookings);
      expect(error.rollbackData.bookingId).toBe('2');
      expect(error.rollbackData.action).toBe('remove');
    });

    it('should create proposal submission error', () => {
      const originalProposals = [{ id: '1', amount: 100 }];
      const optimisticProposal = { id: '2', amount: 150 };
      const networkError = new Error('Submission failed');

      const error = OptimisticUpdateError.proposalSubmission(
        originalProposals,
        optimisticProposal,
        networkError
      );

      expect(error.operation).toBe('submit_proposal');
      expect(error.rollbackData.proposalId).toBe('2');
    });

    it('should provide rollback instructions', () => {
      const error = OptimisticUpdateError.swapStatusUpdate(
        { id: 'swap-1', status: 'active' },
        { id: 'swap-1', status: 'completed' },
        new Error('Update failed')
      );

      const instructions = error.getRollbackInstructions();
      expect(instructions.action).toBe('restore');
      expect(instructions.target).toBe('swap-1');
      expect(instructions.data.status).toBe('active');
    });
  });
});

describe('UIErrorRecoveryManager', () => {
  let recoveryManager: UIErrorRecoveryManager;

  beforeEach(() => {
    recoveryManager = new UIErrorRecoveryManager();
  });

  it('should provide retry strategy for retryable proposal errors', () => {
    const error = InlineProposalError.networkError('booking-123', 'cash', 0);
    const strategy = recoveryManager.getRecoveryStrategy(error);

    expect(strategy.type).toBe('retry');
    expect(strategy.delay).toBe(1000); // 2^0 * 1000
    expect(strategy.maxAttempts).toBe(3);
  });

  it('should provide fallback strategy when retries exhausted', () => {
    const error = InlineProposalError.networkError('booking-123', 'cash', 3);
    const strategy = recoveryManager.getRecoveryStrategy(error);

    expect(strategy.type).toBe('fallback');
    expect(strategy.message).toContain('try again later');
  });

  it('should provide ignore strategy for form validation errors', () => {
    const error = FormValidationError.forField('email', 'Invalid email');
    const strategy = recoveryManager.getRecoveryStrategy(error);

    expect(strategy.type).toBe('ignore');
  });

  it('should provide rollback strategy for optimistic update errors', () => {
    const error = OptimisticUpdateError.bookingCreation(
      [],
      { id: '1', title: 'Test' },
      new Error('Failed')
    );
    const strategy = recoveryManager.getRecoveryStrategy(error);

    expect(strategy.type).toBe('rollback');
    expect(strategy.action).toBeDefined();
  });

  it('should manage retry attempts correctly', () => {
    const error1 = InlineProposalError.networkError('booking-1', 'cash', 0);
    const error2 = InlineProposalError.networkError('booking-1', 'cash', 1);

    recoveryManager.getRecoveryStrategy(error1);
    const strategy2 = recoveryManager.getRecoveryStrategy(error2);

    expect(strategy2.delay).toBe(2000); // 2^1 * 1000

    recoveryManager.clearRetryAttempts('booking-1-cash');
    const strategy3 = recoveryManager.getRecoveryStrategy(error1);
    expect(strategy3.delay).toBe(1000); // Reset to 2^0 * 1000
  });
});

describe('UIErrorUtils', () => {
  it('should identify UI simplification errors correctly', () => {
    const uiError = new FormValidationError('field', 'message');
    const regularError = new Error('Regular error');

    expect(UIErrorUtils.isUISimplificationError(uiError)).toBe(true);
    expect(UIErrorUtils.isUISimplificationError(regularError)).toBe(false);
  });

  it('should extract field errors correctly', () => {
    const errors = [
      FormValidationError.forField('email', 'Invalid email'),
      FormValidationError.forField('email', 'Email required'),
      FormValidationError.forField('password', 'Password too short')
    ];

    const fieldErrors = UIErrorUtils.extractFieldErrors(errors);

    expect(fieldErrors.email).toHaveLength(2);
    expect(fieldErrors.password).toHaveLength(1);
    expect(fieldErrors.email[0]).toBe('Invalid email');
    expect(fieldErrors.email[1]).toBe('email is required');
  });

  it('should group errors by component', () => {
    const errors = [
      new FormValidationError('field1', 'message1', undefined, undefined, undefined, { operation: 'test' }),
      new InlineProposalError('message2', 'booking-1', 'cash'),
      new FormValidationError('field2', 'message3', undefined, undefined, undefined, { operation: 'test' })
    ];

    const grouped = UIErrorUtils.groupErrorsByComponent(errors);

    expect(grouped.UnifiedBookingForm).toHaveLength(2);
    expect(grouped.InlineProposalForm).toHaveLength(1);
  });

  it('should create appropriate error summaries', () => {
    const formErrors = [
      FormValidationError.forField('email', 'Invalid email'),
      FormValidationError.forField('password', 'Password required')
    ];

    const summary = UIErrorUtils.createErrorSummary(formErrors);

    expect(summary.title).toBe('Form Validation Issues');
    expect(summary.actionable).toBe(true);
    expect(summary.severity).toBe('medium');

    const proposalErrors = [
      InlineProposalError.networkError('booking-1', 'cash')
    ];

    const proposalSummary = UIErrorUtils.createErrorSummary(proposalErrors);

    expect(proposalSummary.title).toBe('Proposal Submission Failed');
    expect(proposalSummary.severity).toBe('high');
  });

  it('should handle empty error arrays', () => {
    const summary = UIErrorUtils.createErrorSummary([]);

    expect(summary.title).toBe('No errors');
    expect(summary.actionable).toBe(false);
    expect(summary.severity).toBe('low');
  });
});

describe('Error Recovery Integration', () => {
  it('should handle complete error recovery workflow', async () => {
    const recoveryManager = new UIErrorRecoveryManager();
    let retryCount = 0;

    const mockRetryFn = jest.fn().mockImplementation(() => {
      retryCount++;
      if (retryCount < 3) {
        throw new Error('Still failing');
      }
      return Promise.resolve();
    });

    const error = InlineProposalError.networkError('booking-123', 'cash', 0);
    
    // First attempt should fail and suggest retry
    let strategy = recoveryManager.getRecoveryStrategy(error);
    expect(strategy.type).toBe('retry');

    // Simulate retry attempts
    for (let i = 0; i < 2; i++) {
      try {
        await mockRetryFn();
      } catch (e) {
        const nextError = error.forRetry();
        strategy = recoveryManager.getRecoveryStrategy(nextError);
      }
    }

    // Final attempt should succeed
    await expect(mockRetryFn()).resolves.toBeUndefined();
    expect(mockRetryFn).toHaveBeenCalledTimes(3);
  });

  it('should provide fallback when max retries exceeded', () => {
    const recoveryManager = new UIErrorRecoveryManager();
    const error = InlineProposalError.networkError('booking-123', 'cash', 3);
    
    const strategy = recoveryManager.getRecoveryStrategy(error);
    expect(strategy.type).toBe('fallback');
    expect(strategy.message).toContain('try again later');
  });
});