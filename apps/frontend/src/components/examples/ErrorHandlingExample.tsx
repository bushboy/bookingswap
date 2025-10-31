/**
 * Example component demonstrating UI Simplification Error Handling
 * 
 * Shows how to use the error handling components and hooks
 * in real booking swap UI scenarios.
 */

import React, { useState } from 'react';
import {
  FormValidationError,
  InlineProposalError,
  FilterApplicationError,
  OptimisticUpdateError
} from '../../utils/uiSimplificationErrors';
import {
  ErrorDisplay,
  FieldErrorDisplay,
  ErrorSummary,
  InlineErrorRecovery,
  FilterErrorFallback,
  OptimisticUpdateRollback
} from '../common/ErrorDisplay';
import {
  useFormValidation,
  useInlineProposalError,
  useFilterErrorHandling,
  useOptimisticUpdate
} from '../../hooks/useErrorRecovery';

export const ErrorHandlingExample: React.FC = () => {
  const [currentError, setCurrentError] = useState<any>(null);
  
  // Form validation example
  const {
    errors: formErrors,
    addError: addFormError,
    clearErrors: clearFormErrors,
    hasErrors: hasFormErrors,
    getFieldErrors
  } = useFormValidation();

  // Inline proposal error example
  const {
    error: proposalError,
    handleError: handleProposalError,
    retry: retryProposal,
    clearError: clearProposalError,
    canRetry: canRetryProposal
  } = useInlineProposalError();

  // Filter error example
  const {
    error: filterError,
    handleFilterError,
    retryFilter,
    useFallback: useFilterFallback,
    clearFilter
  } = useFilterErrorHandling();

  // Optimistic update example
  const {
    error: optimisticError,
    rollback,
    retry: retryOptimistic
  } = useOptimisticUpdate();

  // Example error generators
  const generateFormValidationError = () => {
    const error = FormValidationError.forField(
      'email',
      'Invalid email format',
      { rule: 'format', format: 'user@domain.com' }
    );
    addFormError(error);
    setCurrentError(error);
  };

  const generateInlineProposalError = () => {
    const error = InlineProposalError.networkError('booking-123', 'cash', 0);
    handleProposalError(error);
    setCurrentError(error);
  };

  const generateFilterError = () => {
    const error = FilterApplicationError.networkError('location', 'New York');
    handleFilterError(error);
    setCurrentError(error);
  };

  const generateOptimisticError = () => {
    const error = OptimisticUpdateError.bookingCreation(
      [],
      { id: '1', title: 'Test Booking' },
      new Error('Network failed')
    );
    setCurrentError(error);
  };

  // Mock retry functions
  const mockRetry = async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    // Simulate success
    setCurrentError(null);
  };

  const mockProposalRetry = async () => {
    await retryProposal(mockRetry);
  };

  const mockFilterRetry = async () => {
    await retryFilter(mockRetry);
  };

  const mockRollback = async () => {
    await rollback(async () => {
      console.log('Rolling back optimistic update');
    });
    setCurrentError(null);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px' }}>
      <h2>Error Handling Examples</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>Generate Test Errors</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={generateFormValidationError}>
            Form Validation Error
          </button>
          <button onClick={generateInlineProposalError}>
            Inline Proposal Error
          </button>
          <button onClick={generateFilterError}>
            Filter Application Error
          </button>
          <button onClick={generateOptimisticError}>
            Optimistic Update Error
          </button>
        </div>
      </div>

      {/* Current Error Display */}
      {currentError && (
        <div style={{ marginBottom: '20px' }}>
          <h3>Current Error</h3>
          <ErrorDisplay
            error={currentError}
            onRetry={mockRetry}
            onDismiss={() => setCurrentError(null)}
          />
        </div>
      )}

      {/* Form Validation Errors */}
      {hasFormErrors() && (
        <div style={{ marginBottom: '20px' }}>
          <h3>Form Validation Errors</h3>
          <ErrorSummary
            errors={Object.values(formErrors).flat()}
            onDismissAll={clearFormErrors}
          />
          
          {/* Field-specific errors */}
          {getFieldErrors('email').length > 0 && (
            <div style={{ marginTop: '10px' }}>
              <label>Email Field:</label>
              <FieldErrorDisplay
                errors={getFieldErrors('email').map(e => e.getDisplayMessage())}
              />
            </div>
          )}
        </div>
      )}

      {/* Inline Proposal Error Recovery */}
      {proposalError && (
        <div style={{ marginBottom: '20px' }}>
          <h3>Inline Proposal Error Recovery</h3>
          <InlineErrorRecovery
            error={proposalError}
            onRetry={mockProposalRetry}
            onFallback={() => {
              console.log('Using fallback proposal method');
              clearProposalError();
            }}
            onDismiss={clearProposalError}
          />
        </div>
      )}

      {/* Filter Error Fallback */}
      {filterError && (
        <div style={{ marginBottom: '20px' }}>
          <h3>Filter Error Fallback</h3>
          <FilterErrorFallback
            error={filterError}
            onRetry={mockFilterRetry}
            onUseFallback={() => {
              useFilterFallback();
              console.log('Using filter fallback');
            }}
            onClearFilter={() => {
              clearFilter();
              console.log('Filter cleared');
            }}
          />
        </div>
      )}

      {/* Optimistic Update Rollback */}
      {optimisticError && (
        <div style={{ marginBottom: '20px' }}>
          <h3>Optimistic Update Rollback</h3>
          <OptimisticUpdateRollback
            error={optimisticError}
            onRollback={mockRollback}
            onRetry={async () => {
              await retryOptimistic(mockRetry);
              setCurrentError(null);
            }}
          />
        </div>
      )}

      {/* Status Information */}
      <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '5px' }}>
        <h3>Current Status</h3>
        <ul>
          <li>Form Errors: {hasFormErrors() ? 'Yes' : 'No'}</li>
          <li>Proposal Error: {proposalError ? 'Yes' : 'No'}</li>
          <li>Filter Error: {filterError ? 'Yes' : 'No'}</li>
          <li>Optimistic Error: {optimisticError ? 'Yes' : 'No'}</li>
          <li>Can Retry Proposal: {canRetryProposal() ? 'Yes' : 'No'}</li>
        </ul>
      </div>
    </div>
  );
};