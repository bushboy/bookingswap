import { useState, useCallback, useEffect } from 'react';
import {
  SwapSpecificationErrors,
  createSwapSpecificationRecoveryPlan,
  ErrorRecoveryPlan,
  isAutoRecoverableError,
} from '@booking-swap/shared';

/**
 * Error recovery state for swap specification operations
 */
interface SwapSpecificationErrorRecoveryState {
  error: Error | null;
  validationErrors: SwapSpecificationErrors | null;
  recoveryPlan: ErrorRecoveryPlan | null;
  isRecovering: boolean;
  attemptNumber: number;
  canAutoRecover: boolean;
  lastRecoveryAttempt: Date | null;
}

/**
 * Options for swap specification error recovery
 */
interface UseSwapSpecificationErrorRecoveryOptions {
  maxAutoRetries?: number;
  onRecoverySuccess?: () => void;
  onRecoveryFailure?: (error: Error) => void;
  onNavigateBack?: () => void;
  onNavigateToBookingEdit?: () => void;
  onReloadPage?: () => void;
  onReconnectWallet?: () => Promise<void>;
}

/**
 * Hook for managing error recovery in swap specification interfaces
 */
export function useSwapSpecificationErrorRecovery(
  options: UseSwapSpecificationErrorRecoveryOptions = {}
) {
  const {
    maxAutoRetries = 3,
    onRecoverySuccess,
    onRecoveryFailure,
    onNavigateBack,
    onNavigateToBookingEdit,
    onReloadPage,
    onReconnectWallet,
  } = options;

  const [state, setState] = useState<SwapSpecificationErrorRecoveryState>({
    error: null,
    validationErrors: null,
    recoveryPlan: null,
    isRecovering: false,
    attemptNumber: 0,
    canAutoRecover: false,
    lastRecoveryAttempt: null,
  });

  /**
   * Captures an error and creates a recovery plan
   */
  const captureError = useCallback((
    error: Error,
    validationErrors?: SwapSpecificationErrors
  ) => {
    const recoveryPlan = createSwapSpecificationRecoveryPlan(error, validationErrors, 1);
    const canAutoRecover = isAutoRecoverableError(error) &&
      !validationErrors &&
      state.attemptNumber < maxAutoRetries;

    setState({
      error,
      validationErrors: validationErrors || null,
      recoveryPlan,
      isRecovering: false,
      attemptNumber: 1,
      canAutoRecover,
      lastRecoveryAttempt: null,
    });
  }, [maxAutoRetries, state.attemptNumber]);

  /**
   * Executes the primary recovery strategy
   */
  const executeRecovery = useCallback(async (
    recoveryAction?: () => Promise<void>
  ) => {
    if (!state.recoveryPlan || state.isRecovering) {
      return;
    }

    setState(prev => ({
      ...prev,
      isRecovering: true,
      lastRecoveryAttempt: new Date(),
    }));

    try {
      const { strategy } = state.recoveryPlan;

      switch (strategy) {
        case 'retry':
        case 'fix_and_retry':
          if (recoveryAction) {
            await recoveryAction();
          }
          break;

        case 'navigate_back':
          if (onNavigateBack) {
            onNavigateBack();
          } else {
            window.history.back();
          }
          break;

        case 'reload_page':
          if (onReloadPage) {
            onReloadPage();
          } else {
            window.location.reload();
          }
          break;

        case 'login_required':
          console.log('🔒 LOGIN REDIRECT TRIGGERED by useSwapSpecificationErrorRecovery:', {
            component: 'useSwapSpecificationErrorRecovery',
            reason: 'login_required error recovery action',
            conditions: {
              errorType: 'login_required',
              recoveryAction: 'redirect_to_login'
            },
            redirectTo: '/login',
            timestamp: new Date().toISOString()
          });
          // Redirect to login - this would typically be handled by the auth system
          window.location.href = '/login';
          break;

        case 'check_connection':
          // For connection issues, we can retry after a delay
          if (recoveryAction) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            await recoveryAction();
          }
          break;

        case 'reconnect_wallet':
          if (onReconnectWallet) {
            await onReconnectWallet();
          } else {
            // Default wallet reconnection logic
            console.log('Attempting to reconnect wallet...');
          }
          break;

        case 'contact_support':
          // Open support contact - this would be app-specific
          console.log('Contact support for swap specification error:', state.error);
          break;

        default:
          throw new Error(`Unknown recovery strategy: ${strategy}`);
      }

      // If we get here, recovery was successful
      setState(prev => ({
        ...prev,
        error: null,
        validationErrors: null,
        recoveryPlan: null,
        isRecovering: false,
        attemptNumber: 0,
        canAutoRecover: false,
        lastRecoveryAttempt: null,
      }));

      if (onRecoverySuccess) {
        onRecoverySuccess();
      }

    } catch (recoveryError) {
      // Recovery failed, update attempt number and create new plan
      const newAttemptNumber = state.attemptNumber + 1;
      const newRecoveryPlan = createSwapSpecificationRecoveryPlan(
        state.error!,
        state.validationErrors || undefined,
        newAttemptNumber
      );

      const canStillAutoRecover = isAutoRecoverableError(state.error!) &&
        !state.validationErrors &&
        newAttemptNumber < maxAutoRetries;

      setState(prev => ({
        ...prev,
        recoveryPlan: newRecoveryPlan,
        isRecovering: false,
        attemptNumber: newAttemptNumber,
        canAutoRecover: canStillAutoRecover,
      }));

      if (onRecoveryFailure) {
        onRecoveryFailure(recoveryError as Error);
      }
    }
  }, [
    state.recoveryPlan,
    state.isRecovering,
    state.error,
    state.validationErrors,
    state.attemptNumber,
    maxAutoRetries,
    onNavigateBack,
    onNavigateToBookingEdit,
    onReloadPage,
    onReconnectWallet,
    onRecoverySuccess,
    onRecoveryFailure,
  ]);

  /**
   * Resets the error state
   */
  const resetError = useCallback(() => {
    setState({
      error: null,
      validationErrors: null,
      recoveryPlan: null,
      isRecovering: false,
      attemptNumber: 0,
      canAutoRecover: false,
      lastRecoveryAttempt: null,
    });
  }, []);

  /**
   * Auto-recovery effect
   */
  useEffect(() => {
    if (state.canAutoRecover && state.recoveryPlan && !state.isRecovering) {
      const delay = state.recoveryPlan.retryDelay || 1000;

      const timeoutId = setTimeout(() => {
        executeRecovery();
      }, delay);

      return () => clearTimeout(timeoutId);
    }
  }, [state.canAutoRecover, state.recoveryPlan, state.isRecovering, executeRecovery]);

  /**
   * Gets user-friendly error information
   */
  const getErrorInfo = useCallback(() => {
    if (!state.error || !state.recoveryPlan) {
      return null;
    }

    return {
      title: state.recoveryPlan.primaryStrategy.title,
      message: state.recoveryPlan.primaryStrategy.message,
      actionText: state.recoveryPlan.primaryStrategy.actionText,
      canRetry: state.recoveryPlan.primaryStrategy.strategy === 'retry' ||
        state.recoveryPlan.primaryStrategy.strategy === 'fix_and_retry',
      canNavigateToBookingEdit: !!onNavigateToBookingEdit,
      guidance: state.recoveryPlan.userGuidance,
      isValidationError: !!state.validationErrors,
      isWalletError: state.recoveryPlan.primaryStrategy.strategy === 'reconnect_wallet',
      validationErrors: state.validationErrors,
      attemptNumber: state.attemptNumber,
      maxAttempts: maxAutoRetries,
    };
  }, [state.error, state.recoveryPlan, state.validationErrors, state.attemptNumber, maxAutoRetries, onNavigateToBookingEdit]);

  /**
   * Navigates to booking edit as an alternative recovery option
   */
  const navigateToBookingEdit = useCallback(() => {
    if (onNavigateToBookingEdit) {
      onNavigateToBookingEdit();
      resetError();
    }
  }, [onNavigateToBookingEdit, resetError]);

  return {
    // State
    hasError: !!state.error,
    isRecovering: state.isRecovering,
    canAutoRecover: state.canAutoRecover,
    attemptNumber: state.attemptNumber,

    // Error information
    error: state.error,
    validationErrors: state.validationErrors,
    recoveryPlan: state.recoveryPlan,
    errorInfo: getErrorInfo(),

    // Actions
    captureError,
    executeRecovery,
    resetError,
    navigateToBookingEdit,
  };
}