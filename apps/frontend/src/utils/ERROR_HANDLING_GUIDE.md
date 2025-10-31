# UI Simplification Error Handling Guide

This guide explains how to use the comprehensive error handling system implemented for the booking swap UI simplification feature.

## Overview

The error handling system provides:
- **Specialized error classes** for different types of UI errors
- **Recovery mechanisms** with retry logic and fallback strategies
- **React components** for displaying errors with recovery actions
- **React hooks** for managing error state and recovery workflows
- **Graceful degradation** for network and service failures

## Error Classes

### 1. FormValidationError

Used for form validation errors with field-level display support.

```typescript
import { FormValidationError } from '../utils/uiSimplificationErrors';

// Create field-specific error
const emailError = FormValidationError.forField(
  'email',
  'Invalid email format',
  { rule: 'format', format: 'user@domain.com' }
);

// Create cross-field validation error
const dateError = FormValidationError.crossField(
  ['startDate', 'endDate'],
  'End date must be after start date'
);

// Get user-friendly display message
console.log(emailError.getDisplayMessage()); // "email must be in format: user@domain.com"
```

### 2. InlineProposalError

Used for errors during inline proposal submission with retry mechanisms.

```typescript
import { InlineProposalError } from '../utils/uiSimplificationErrors';

// Network error (retryable)
const networkError = InlineProposalError.networkError('booking-123', 'cash', 0);
console.log(networkError.canRetry()); // true

// Validation error (not retryable)
const validationError = InlineProposalError.validationError(
  'booking-123',
  'booking',
  'Selected booking is not available'
);
console.log(validationError.canRetry()); // false

// Business logic error (not retryable)
const businessError = InlineProposalError.businessLogicError(
  'booking-123',
  'cash',
  'Auction has ended'
);

// Retry mechanism
if (networkError.canRetry()) {
  const nextAttempt = networkError.forRetry();
  console.log(nextAttempt.retryCount); // 1
}
```

### 3. FilterApplicationError

Used for filter application failures with graceful degradation.

```typescript
import { FilterApplicationError } from '../utils/uiSimplificationErrors';

// Network error with fallback
const networkError = FilterApplicationError.networkError('location', 'New York');
const strategy = networkError.getFallbackStrategy();
console.log(strategy.type); // 'cached_results'

// Invalid value error
const invalidError = FilterApplicationError.invalidValue(
  'dateRange',
  'invalid-date',
  'YYYY-MM-DD'
);

// Service unavailable with fallback
const serviceError = FilterApplicationError.serviceUnavailable('swapType', 'cash');
```

### 4. OptimisticUpdateError

Used for optimistic update failures with rollback support.

```typescript
import { OptimisticUpdateError } from '../utils/uiSimplificationErrors';

// Booking creation error
const bookingError = OptimisticUpdateError.bookingCreation(
  originalBookings,
  optimisticBooking,
  new Error('Network failed')
);

// Get rollback instructions
const instructions = bookingError.getRollbackInstructions();
console.log(instructions.action); // 'remove'
console.log(instructions.target); // booking ID
```

## React Components

### 1. ErrorDisplay

Main error display component with recovery actions.

```tsx
import { ErrorDisplay } from '../components/common/ErrorDisplay';

<ErrorDisplay
  error={currentError}
  onRetry={handleRetry}
  onDismiss={handleDismiss}
  className="custom-error-style"
/>
```

### 2. FieldErrorDisplay

Field-level error display for form validation.

```tsx
import { FieldErrorDisplay } from '../components/common/ErrorDisplay';

<FieldErrorDisplay
  errors={['Email is required', 'Invalid email format']}
  className="field-error"
/>
```

### 3. ErrorSummary

Summary component for multiple errors.

```tsx
import { ErrorSummary } from '../components/common/ErrorDisplay';

<ErrorSummary
  errors={allErrors}
  onRetryAll={handleRetryAll}
  onDismissAll={handleDismissAll}
/>
```

### 4. InlineErrorRecovery

Specialized component for proposal errors with retry.

```tsx
import { InlineErrorRecovery } from '../components/common/ErrorDisplay';

<InlineErrorRecovery
  error={proposalError}
  onRetry={handleRetry}
  onFallback={handleFallback}
  onDismiss={handleDismiss}
/>
```

### 5. FilterErrorFallback

Component for filter errors with fallback options.

```tsx
import { FilterErrorFallback } from '../components/common/ErrorDisplay';

<FilterErrorFallback
  error={filterError}
  onRetry={handleRetry}
  onUseFallback={handleUseFallback}
  onClearFilter={handleClearFilter}
/>
```

### 6. OptimisticUpdateRollback

Component for optimistic update errors with rollback.

```tsx
import { OptimisticUpdateRollback } from '../components/common/ErrorDisplay';

<OptimisticUpdateRollback
  error={optimisticError}
  onRollback={handleRollback}
  onRetry={handleRetry}
/>
```

## React Hooks

### 1. useFormValidation

Hook for managing form validation errors.

```tsx
import { useFormValidation } from '../hooks/useErrorRecovery';

const MyForm = () => {
  const {
    errors,
    addError,
    removeError,
    clearErrors,
    validateField,
    hasErrors,
    getFieldErrors,
    getAllErrors
  } = useFormValidation();

  const handleSubmit = async () => {
    const isValid = await validateField('email', email, validateEmail);
    if (!isValid) return;
    
    // Submit form
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {hasErrors('email') && (
        <FieldErrorDisplay
          errors={getFieldErrors('email').map(e => e.getDisplayMessage())}
        />
      )}
    </form>
  );
};
```

### 2. useInlineProposalError

Hook for handling inline proposal errors with retry.

```tsx
import { useInlineProposalError } from '../hooks/useErrorRecovery';

const ProposalForm = () => {
  const {
    error,
    isRetrying,
    handleError,
    retry,
    clearError,
    canRetry
  } = useInlineProposalError();

  const submitProposal = async () => {
    try {
      await proposalService.submit(proposalData);
    } catch (err) {
      const proposalError = InlineProposalError.networkError(
        bookingId,
        proposalType,
        0
      );
      handleError(proposalError);
    }
  };

  const handleRetry = async () => {
    const success = await retry(submitProposal);
    if (success) {
      console.log('Proposal submitted successfully');
    }
  };

  return (
    <div>
      {error && (
        <InlineErrorRecovery
          error={error}
          onRetry={handleRetry}
          onDismiss={clearError}
        />
      )}
    </div>
  );
};
```

### 3. useFilterErrorHandling

Hook for filter errors with graceful degradation.

```tsx
import { useFilterErrorHandling } from '../hooks/useErrorRecovery';

const FilterPanel = () => {
  const {
    error,
    fallbackActive,
    partialResults,
    handleFilterError,
    retryFilter,
    useFallback,
    clearFilter
  } = useFilterErrorHandling();

  const applyFilter = async (filterValue) => {
    try {
      await filterService.apply(filterValue);
    } catch (err) {
      const filterError = FilterApplicationError.networkError('location', filterValue);
      handleFilterError(filterError);
    }
  };

  return (
    <div>
      {fallbackActive && (
        <div className="fallback-notice">
          Using cached results. Some filters may not be applied.
        </div>
      )}
      
      {error && (
        <FilterErrorFallback
          error={error}
          onRetry={() => retryFilter(applyFilter)}
          onUseFallback={useFallback}
          onClearFilter={clearFilter}
        />
      )}
    </div>
  );
};
```

### 4. useOptimisticUpdate

Hook for optimistic updates with rollback.

```tsx
import { useOptimisticUpdate } from '../hooks/useErrorRecovery';

const BookingList = () => {
  const {
    optimisticState,
    error,
    startOptimisticUpdate,
    commitUpdate,
    rollback,
    handleUpdateError,
    retry
  } = useOptimisticUpdate();

  const createBooking = async (bookingData) => {
    const optimisticBooking = { ...bookingData, id: 'temp-id' };
    
    // Start optimistic update
    startOptimisticUpdate(bookings, [...bookings, optimisticBooking], 'create_booking');
    
    try {
      const result = await bookingService.create(bookingData);
      commitUpdate([...bookings, result]);
    } catch (err) {
      handleUpdateError(err, 'create_booking');
    }
  };

  return (
    <div>
      {error && (
        <OptimisticUpdateRollback
          error={error}
          onRollback={() => rollback()}
          onRetry={() => retry(createBooking)}
        />
      )}
    </div>
  );
};
```

## Error Recovery Manager

The `UIErrorRecoveryManager` provides centralized recovery strategies.

```typescript
import { uiErrorRecoveryManager } from '../utils/uiSimplificationErrors';

// Get recovery strategy for any error
const strategy = uiErrorRecoveryManager.getRecoveryStrategy(error);

switch (strategy.type) {
  case 'retry':
    // Implement retry with delay
    setTimeout(() => retryOperation(), strategy.delay);
    break;
  case 'fallback':
    // Use fallback mechanism
    useFallbackMethod();
    break;
  case 'rollback':
    // Execute rollback
    await strategy.action();
    break;
  case 'ignore':
    // Display message and continue
    showMessage(strategy.message);
    break;
}
```

## Utility Functions

### UIErrorUtils

Utility functions for error handling.

```typescript
import { UIErrorUtils } from '../utils/uiSimplificationErrors';

// Check if error is UI simplification error
if (UIErrorUtils.isUISimplificationError(error)) {
  // Handle UI error
}

// Extract field errors for form display
const fieldErrors = UIErrorUtils.extractFieldErrors(validationErrors);

// Group errors by component
const grouped = UIErrorUtils.groupErrorsByComponent(allErrors);

// Create error summary
const summary = UIErrorUtils.createErrorSummary(errors);
```

## Best Practices

### 1. Error Boundaries

Wrap components with error boundaries to catch unexpected errors.

```tsx
import { ErrorBoundary } from 'react-error-boundary';

<ErrorBoundary
  FallbackComponent={ErrorFallback}
  onError={(error, errorInfo) => {
    console.error('Component error:', error, errorInfo);
  }}
>
  <BookingForm />
</ErrorBoundary>
```

### 2. Consistent Error Handling

Use the same error handling patterns across components.

```tsx
// Good: Consistent error handling
const handleError = (error: Error) => {
  if (UIErrorUtils.isUISimplificationError(error)) {
    const strategy = uiErrorRecoveryManager.getRecoveryStrategy(error);
    // Handle based on strategy
  } else {
    // Handle generic error
  }
};
```

### 3. User-Friendly Messages

Always provide clear, actionable error messages.

```tsx
// Good: Clear, actionable message
const error = FormValidationError.forField(
  'email',
  'Please enter a valid email address (e.g., user@example.com)',
  { rule: 'format', format: 'user@example.com' }
);

// Bad: Technical message
const error = new Error('Invalid email regex match failed');
```

### 4. Progressive Enhancement

Implement graceful degradation for non-critical features.

```tsx
// Good: Graceful degradation
const applyAdvancedFilter = async () => {
  try {
    await advancedFilterService.apply(filters);
  } catch (error) {
    // Fall back to basic filtering
    await basicFilterService.apply(filters);
    showNotice('Using simplified filtering due to service issues');
  }
};
```

### 5. Testing Error Scenarios

Test error handling paths thoroughly.

```tsx
// Test error recovery
it('should retry failed proposal submission', async () => {
  const mockSubmit = jest.fn()
    .mockRejectedValueOnce(new Error('Network error'))
    .mockResolvedValueOnce({ success: true });

  const { result } = renderHook(() => useInlineProposalError());
  
  // Simulate error
  const error = InlineProposalError.networkError('booking-1', 'cash', 0);
  act(() => result.current.handleError(error));
  
  // Retry should succeed
  await act(async () => {
    const success = await result.current.retry(mockSubmit);
    expect(success).toBe(true);
  });
});
```

## Integration Examples

### Complete Form with Error Handling

```tsx
import React, { useState } from 'react';
import { useFormValidation } from '../hooks/useErrorRecovery';
import { ErrorSummary, FieldErrorDisplay } from '../components/common/ErrorDisplay';

const UnifiedBookingForm = () => {
  const [formData, setFormData] = useState({});
  const {
    errors,
    validateField,
    hasErrors,
    getFieldErrors,
    getAllErrors,
    clearErrors
  } = useFormValidation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearErrors();

    // Validate all fields
    const validations = await Promise.all([
      validateField('title', formData.title, validateTitle),
      validateField('email', formData.email, validateEmail),
      validateField('dates', formData.dates, validateDates)
    ]);

    if (validations.some(v => !v)) {
      return; // Has validation errors
    }

    // Submit form
    try {
      await submitBooking(formData);
    } catch (error) {
      // Handle submission error
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {hasErrors() && (
        <ErrorSummary
          errors={getAllErrors()}
          onDismissAll={clearErrors}
        />
      )}

      <div>
        <label>Title</label>
        <input
          value={formData.title || ''}
          onChange={(e) => setFormData({...formData, title: e.target.value})}
        />
        {hasErrors('title') && (
          <FieldErrorDisplay
            errors={getFieldErrors('title').map(e => e.getDisplayMessage())}
          />
        )}
      </div>

      <button type="submit" disabled={hasErrors()}>
        Create Booking
      </button>
    </form>
  );
};
```

This comprehensive error handling system provides robust, user-friendly error management for the booking swap UI simplification feature, ensuring a smooth user experience even when things go wrong.