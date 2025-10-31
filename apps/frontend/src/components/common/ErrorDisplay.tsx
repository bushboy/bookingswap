/**
 * Enhanced Error Display Components for UI Simplification
 * 
 * Provides field-level error display, inline error recovery,
 * and graceful degradation messaging for the booking swap UI.
 */

import React, { useState, useCallback, useEffect } from 'react';
import styles from './ErrorDisplay.module.css';
import {
  UISimplificationError,
  FormValidationError,
  InlineProposalError,
  FilterApplicationError,
  OptimisticUpdateError,
  UIErrorUtils,
  uiErrorRecoveryManager,
  ErrorRecoveryStrategy
} from '../../utils/uiSimplificationErrors';

interface ErrorDisplayProps {
  error: UISimplificationError | null;
  onRetry?: () => Promise<void>;
  onDismiss?: () => void;
  className?: string;
}

interface FieldErrorDisplayProps {
  errors: string[];
  className?: string;
}

interface ErrorSummaryProps {
  errors: UISimplificationError[];
  onRetryAll?: () => Promise<void>;
  onDismissAll?: () => void;
  className?: string;
}

interface InlineErrorRecoveryProps {
  error: InlineProposalError;
  onRetry: () => Promise<void>;
  onFallback?: () => void;
  onDismiss: () => void;
}

interface FilterErrorFallbackProps {
  error: FilterApplicationError;
  onRetry?: () => Promise<void>;
  onUseFallback?: () => void;
  onClearFilter?: () => void;
}

interface OptimisticUpdateRollbackProps {
  error: OptimisticUpdateError;
  onRollback: () => Promise<void>;
  onRetry?: () => Promise<void>;
}

/**
 * Main error display component with recovery actions
 */
export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss,
  className = ''
}) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [recoveryStrategy, setRecoveryStrategy] = useState<ErrorRecoveryStrategy | null>(null);

  useEffect(() => {
    if (error) {
      const strategy = uiErrorRecoveryManager.getRecoveryStrategy(error);
      setRecoveryStrategy(strategy);
    }
  }, [error]);

  const handleRetry = useCallback(async () => {
    if (!onRetry || !recoveryStrategy) return;

    setIsRetrying(true);
    try {
      if (recoveryStrategy.delay) {
        await new Promise(resolve => setTimeout(resolve, recoveryStrategy.delay));
      }
      await onRetry();
    } catch (retryError) {
      console.error('Retry failed:', retryError);
    } finally {
      setIsRetrying(false);
    }
  }, [onRetry, recoveryStrategy]);

  if (!error) return null;

  return (
    <div className={`${styles.errorDisplay} ${styles[error.name.toLowerCase()]} ${className}`}>
      <div className={styles.errorContent}>
        <div className={styles.errorIcon}>
          {error instanceof FormValidationError && '⚠️'}
          {error instanceof InlineProposalError && '❌'}
          {error instanceof FilterApplicationError && '🔍'}
          {error instanceof OptimisticUpdateError && '↩️'}
        </div>
        
        <div className={styles.errorMessage}>
          <h4 className={styles.errorTitle}>
            {error instanceof FormValidationError && 'Validation Error'}
            {error instanceof InlineProposalError && 'Proposal Error'}
            {error instanceof FilterApplicationError && 'Filter Error'}
            {error instanceof OptimisticUpdateError && 'Update Error'}
          </h4>
          <p className={styles.errorDescription}>{recoveryStrategy?.message || error.message}</p>
          
          {error.field && (
            <p className={styles.errorField}>Field: {error.field}</p>
          )}
        </div>
      </div>

      <div className={styles.errorActions}>
        {recoveryStrategy?.type === 'retry' && onRetry && (
          <button
            className={styles.retryButton}
            onClick={handleRetry}
            disabled={isRetrying}
          >
            {isRetrying ? 'Retrying...' : 'Retry'}
          </button>
        )}
        
        {onDismiss && (
          <button
            className={styles.dismissButton}
            onClick={onDismiss}
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Field-level error display for form validation
 */
export const FieldErrorDisplay: React.FC<FieldErrorDisplayProps> = ({
  errors,
  className = ''
}) => {
  if (!errors || errors.length === 0) return null;

  return (
    <div className={`${styles.fieldErrorDisplay} ${className}`}>
      <div className={styles.fieldErrorIcon}>⚠️</div>
      <div className={styles.fieldErrorMessages}>
        {errors.map((error, index) => (
          <p key={index} className={styles.fieldErrorMessage}>
            {error}
          </p>
        ))}
      </div>
    </div>
  );
};

/**
 * Error summary component for multiple errors
 */
export const ErrorSummary: React.FC<ErrorSummaryProps> = ({
  errors,
  onRetryAll,
  onDismissAll,
  className = ''
}) => {
  const [isRetrying, setIsRetrying] = useState(false);
  
  const summary = UIErrorUtils.createErrorSummary(errors);
  const fieldErrors = UIErrorUtils.extractFieldErrors(
    errors.filter(e => e instanceof FormValidationError) as FormValidationError[]
  );

  const handleRetryAll = useCallback(async () => {
    if (!onRetryAll) return;

    setIsRetrying(true);
    try {
      await onRetryAll();
    } catch (error) {
      console.error('Retry all failed:', error);
    } finally {
      setIsRetrying(false);
    }
  }, [onRetryAll]);

  if (errors.length === 0) return null;

  return (
    <div className={`${styles.errorSummary} ${styles[summary.severity]} ${className}`}>
      <div className={styles.summaryHeader}>
        <h3 className={styles.summaryTitle}>{summary.title}</h3>
        <p className={styles.summaryMessage}>{summary.message}</p>
      </div>

      {Object.keys(fieldErrors).length > 0 && (
        <div className={styles.fieldErrorsSection}>
          <h4>Field Errors:</h4>
          {Object.entries(fieldErrors).map(([field, fieldErrorList]) => (
            <div key={field}>
              <h5 className={styles.fieldName}>{field}:</h5>
              <FieldErrorDisplay
                errors={fieldErrorList}
              />
            </div>
          ))}
        </div>
      )}

      {summary.actionable && (
        <div className={styles.summaryActions}>
          {onRetryAll && (
            <button
              className={styles.retryAllButton}
              onClick={handleRetryAll}
              disabled={isRetrying}
            >
              {isRetrying ? 'Retrying...' : 'Retry All'}
            </button>
          )}
          
          {onDismissAll && (
            <button
              className={styles.dismissAllButton}
              onClick={onDismissAll}
            >
              Dismiss All
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Inline error recovery component for proposal errors
 */
export const InlineErrorRecovery: React.FC<InlineErrorRecoveryProps> = ({
  error,
  onRetry,
  onFallback,
  onDismiss
}) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(error.retryCount);

  const handleRetry = useCallback(async () => {
    if (!error.canRetry()) return;

    setIsRetrying(true);
    try {
      const nextError = error.forRetry();
      setRetryCount(nextError.retryCount);
      await onRetry();
    } catch (retryError) {
      console.error('Inline proposal retry failed:', retryError);
    } finally {
      setIsRetrying(false);
    }
  }, [error, onRetry]);

  return (
    <div className={styles.inlineErrorRecovery}>
      <div className={styles.errorContent}>
        <div className={styles.errorIcon}>❌</div>
        <div className={styles.errorMessage}>
          <p>{error.message}</p>
          {error.canRetry() && (
            <p className={styles.retryInfo}>
              Attempt {retryCount + 1} of {error.maxRetries}
            </p>
          )}
        </div>
      </div>

      <div className={styles.recoveryActions}>
        {error.canRetry() && (
          <button
            className={styles.retryButton}
            onClick={handleRetry}
            disabled={isRetrying}
          >
            {isRetrying ? 'Retrying...' : 'Retry'}
          </button>
        )}
        
        {onFallback && (
          <button
            className={styles.fallbackButton}
            onClick={onFallback}
          >
            Try Different Method
          </button>
        )}
        
        <button
          className={styles.dismissButton}
          onClick={onDismiss}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

/**
 * Filter error fallback component
 */
export const FilterErrorFallback: React.FC<FilterErrorFallbackProps> = ({
  error,
  onRetry,
  onUseFallback,
  onClearFilter
}) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const fallbackStrategy = error.getFallbackStrategy();

  const handleRetry = useCallback(async () => {
    if (!onRetry) return;

    setIsRetrying(true);
    try {
      await onRetry();
    } catch (retryError) {
      console.error('Filter retry failed:', retryError);
    } finally {
      setIsRetrying(false);
    }
  }, [onRetry]);

  return (
    <div className={styles.filterErrorFallback}>
      <div className={styles.errorContent}>
        <div className={styles.errorIcon}>🔍</div>
        <div className={styles.errorMessage}>
          <p>{error.message}</p>
          <p className={styles.fallbackMessage}>{fallbackStrategy.message}</p>
        </div>
      </div>

      <div className={styles.fallbackActions}>
        {fallbackStrategy.action === 'retry_filter' && onRetry && (
          <button
            className={styles.retryButton}
            onClick={handleRetry}
            disabled={isRetrying}
          >
            {isRetrying ? 'Retrying...' : 'Retry Filter'}
          </button>
        )}
        
        {fallbackStrategy.type === 'basic_filter' && onUseFallback && (
          <button
            className={styles.fallbackButton}
            onClick={onUseFallback}
          >
            Use Basic Filter
          </button>
        )}
        
        {onClearFilter && (
          <button
            className={styles.clearButton}
            onClick={onClearFilter}
          >
            Clear Filter
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Optimistic update rollback component
 */
export const OptimisticUpdateRollback: React.FC<OptimisticUpdateRollbackProps> = ({
  error,
  onRollback,
  onRetry
}) => {
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRollback = useCallback(async () => {
    setIsRollingBack(true);
    try {
      await onRollback();
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError);
    } finally {
      setIsRollingBack(false);
    }
  }, [onRollback]);

  const handleRetry = useCallback(async () => {
    if (!onRetry) return;

    setIsRetrying(true);
    try {
      await onRetry();
    } catch (retryError) {
      console.error('Optimistic update retry failed:', retryError);
    } finally {
      setIsRetrying(false);
    }
  }, [onRetry]);

  const rollbackInstructions = error.getRollbackInstructions();

  return (
    <div className={styles.optimisticUpdateRollback}>
      <div className={styles.errorContent}>
        <div className={styles.errorIcon}>↩️</div>
        <div className={styles.errorMessage}>
          <h4>Update Failed</h4>
          <p>{error.message}</p>
          <p className={styles.rollbackInfo}>
            Operation: {error.operation} | Target: {rollbackInstructions.target}
          </p>
        </div>
      </div>

      <div className={styles.rollbackActions}>
        <button
          className={styles.rollbackButton}
          onClick={handleRollback}
          disabled={isRollingBack}
        >
          {isRollingBack ? 'Rolling Back...' : 'Undo Changes'}
        </button>
        
        {onRetry && (
          <button
            className={styles.retryButton}
            onClick={handleRetry}
            disabled={isRetrying}
          >
            {isRetrying ? 'Retrying...' : 'Try Again'}
          </button>
        )}
      </div>
    </div>
  );
};