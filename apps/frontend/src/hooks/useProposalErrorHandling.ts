import { useState, useCallback, useEffect } from 'react';
import { useAnnouncements } from './useAccessibility';
import { formatErrorForUser } from '../utils/errorHandling';

export interface ProposalError {
  type: 'api' | 'validation' | 'network' | 'authentication' | 'authorization' | 'server' | 'timeout' | 'unknown';
  message: string;
  originalError?: Error;
  field?: string;
  retryable?: boolean;
  timestamp: number;
}

export interface ValidationErrors {
  [fieldName: string]: string | string[];
}

export interface ProposalErrorState {
  // General errors
  generalError: ProposalError | null;
  
  // API-specific errors
  loadingError: ProposalError | null;
  submissionError: ProposalError | null;
  
  // Validation errors
  validationErrors: ValidationErrors;
  validationWarnings: ValidationErrors;
  
  // Error counts and state
  errorCount: number;
  hasErrors: boolean;
  hasWarnings: boolean;
  
  // Retry state
  retryCount: number;
  isRetrying: boolean;
}

export interface ProposalErrorActions {
  // Error setters
  setGeneralError: (error: string | Error | null, type?: ProposalError['type']) => void;
  setLoadingError: (error: string | Error | null) => void;
  setSubmissionError: (error: string | Error | null) => void;
  
  // Validation error setters
  setValidationError: (field: string, error: string | string[] | null) => void;
  setValidationErrors: (errors: ValidationErrors) => void;
  setValidationWarning: (field: string, warning: string | string[] | null) => void;
  setValidationWarnings: (warnings: ValidationErrors) => void;
  
  // Error clearers
  clearError: (errorType?: 'general' | 'loading' | 'submission' | 'validation' | 'all') => void;
  clearFieldError: (field: string) => void;
  clearAllErrors: () => void;
  
  // Retry handling
  retry: (operation: () => Promise<void> | void) => Promise<void>;
  canRetry: (errorType?: 'general' | 'loading' | 'submission') => boolean;
  
  // Error type detection
  getErrorType: (error: Error | string) => ProposalError['type'];
  
  // User-friendly error formatting
  formatError: (error: Error | string) => {
    title: string;
    message: string;
    suggestion?: string;
    actions: Array<{ label: string; action: string }>;
  };
}

const MAX_RETRY_COUNT = 3;

export function useProposalErrorHandling(): ProposalErrorState & ProposalErrorActions {
  const { announce } = useAnnouncements();
  
  const [state, setState] = useState<ProposalErrorState>({
    generalError: null,
    loadingError: null,
    submissionError: null,
    validationErrors: {},
    validationWarnings: {},
    errorCount: 0,
    hasErrors: false,
    hasWarnings: false,
    retryCount: 0,
    isRetrying: false,
  });

  // Update computed properties when state changes
  useEffect(() => {
    const errorCount = [
      state.generalError,
      state.loadingError,
      state.submissionError,
    ].filter(Boolean).length + Object.keys(state.validationErrors).length;

    const hasErrors = errorCount > 0;
    const hasWarnings = Object.keys(state.validationWarnings).length > 0;

    setState(prev => ({
      ...prev,
      errorCount,
      hasErrors,
      hasWarnings,
    }));
  }, [state.generalError, state.loadingError, state.submissionError, state.validationErrors, state.validationWarnings]);

  const createError = useCallback((
    error: string | Error,
    type: ProposalError['type'] = 'unknown',
    field?: string
  ): ProposalError => {
    const message = typeof error === 'string' ? error : error.message;
    return {
      type,
      message,
      originalError: typeof error === 'string' ? undefined : error,
      field,
      retryable: ['api', 'network', 'server', 'timeout'].includes(type),
      timestamp: Date.now(),
    };
  }, []);

  const getErrorType = useCallback((error: Error | string): ProposalError['type'] => {
    const message = typeof error === 'string' ? error : error.message;
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
      return 'network';
    }
    if (lowerMessage.includes('unauthorized') || lowerMessage.includes('authentication')) {
      return 'authentication';
    }
    if (lowerMessage.includes('forbidden') || lowerMessage.includes('permission')) {
      return 'authorization';
    }
    if (lowerMessage.includes('validation') || lowerMessage.includes('invalid')) {
      return 'validation';
    }
    if (lowerMessage.includes('timeout')) {
      return 'timeout';
    }
    if (lowerMessage.includes('server') || lowerMessage.includes('500')) {
      return 'server';
    }
    if (lowerMessage.includes('api') || lowerMessage.includes('request')) {
      return 'api';
    }

    return 'unknown';
  }, []);

  const setGeneralError = useCallback((
    error: string | Error | null,
    type?: ProposalError['type']
  ) => {
    setState(prev => ({
      ...prev,
      generalError: error ? createError(error, type || getErrorType(error)) : null,
    }));

    if (error) {
      const errorMessage = typeof error === 'string' ? error : error.message;
      announce(`Error: ${errorMessage}`, 'assertive');
    }
  }, [createError, getErrorType, announce]);

  const setLoadingError = useCallback((error: string | Error | null) => {
    setState(prev => ({
      ...prev,
      loadingError: error ? createError(error, 'api') : null,
    }));

    if (error) {
      const errorMessage = typeof error === 'string' ? error : error.message;
      announce(`Loading error: ${errorMessage}`, 'assertive');
    }
  }, [createError, announce]);

  const setSubmissionError = useCallback((error: string | Error | null) => {
    setState(prev => ({
      ...prev,
      submissionError: error ? createError(error, 'api') : null,
    }));

    if (error) {
      const errorMessage = typeof error === 'string' ? error : error.message;
      announce(`Submission error: ${errorMessage}`, 'assertive');
    }
  }, [createError, announce]);

  const setValidationError = useCallback((
    field: string,
    error: string | string[] | null
  ) => {
    setState(prev => ({
      ...prev,
      validationErrors: error
        ? { ...prev.validationErrors, [field]: error }
        : Object.fromEntries(
            Object.entries(prev.validationErrors).filter(([key]) => key !== field)
          ),
    }));
  }, []);

  const setValidationErrors = useCallback((errors: ValidationErrors) => {
    setState(prev => ({
      ...prev,
      validationErrors: errors,
    }));

    const errorCount = Object.keys(errors).length;
    if (errorCount > 0) {
      announce(`${errorCount} validation error${errorCount !== 1 ? 's' : ''} found`, 'polite');
    }
  }, [announce]);

  const setValidationWarning = useCallback((
    field: string,
    warning: string | string[] | null
  ) => {
    setState(prev => ({
      ...prev,
      validationWarnings: warning
        ? { ...prev.validationWarnings, [field]: warning }
        : Object.fromEntries(
            Object.entries(prev.validationWarnings).filter(([key]) => key !== field)
          ),
    }));
  }, []);

  const setValidationWarnings = useCallback((warnings: ValidationErrors) => {
    setState(prev => ({
      ...prev,
      validationWarnings: warnings,
    }));
  }, []);

  const clearError = useCallback((
    errorType: 'general' | 'loading' | 'submission' | 'validation' | 'all' = 'all'
  ) => {
    setState(prev => {
      const newState = { ...prev };

      switch (errorType) {
        case 'general':
          newState.generalError = null;
          break;
        case 'loading':
          newState.loadingError = null;
          break;
        case 'submission':
          newState.submissionError = null;
          break;
        case 'validation':
          newState.validationErrors = {};
          newState.validationWarnings = {};
          break;
        case 'all':
          newState.generalError = null;
          newState.loadingError = null;
          newState.submissionError = null;
          newState.validationErrors = {};
          newState.validationWarnings = {};
          break;
      }

      return newState;
    });
  }, []);

  const clearFieldError = useCallback((field: string) => {
    setState(prev => ({
      ...prev,
      validationErrors: Object.fromEntries(
        Object.entries(prev.validationErrors).filter(([key]) => key !== field)
      ),
      validationWarnings: Object.fromEntries(
        Object.entries(prev.validationWarnings).filter(([key]) => key !== field)
      ),
    }));
  }, []);

  const clearAllErrors = useCallback(() => {
    setState(prev => ({
      ...prev,
      generalError: null,
      loadingError: null,
      submissionError: null,
      validationErrors: {},
      validationWarnings: {},
      retryCount: 0,
      isRetrying: false,
    }));
  }, []);

  const canRetry = useCallback((
    errorType: 'general' | 'loading' | 'submission' = 'general'
  ): boolean => {
    if (state.retryCount >= MAX_RETRY_COUNT) {
      return false;
    }

    const error = errorType === 'loading' 
      ? state.loadingError 
      : errorType === 'submission'
        ? state.submissionError
        : state.generalError;

    return error?.retryable ?? false;
  }, [state.retryCount, state.loadingError, state.submissionError, state.generalError]);

  const retry = useCallback(async (operation: () => Promise<void> | void) => {
    if (!canRetry()) {
      return;
    }

    setState(prev => ({
      ...prev,
      isRetrying: true,
      retryCount: prev.retryCount + 1,
    }));

    try {
      await operation();
      announce('Operation completed successfully', 'polite');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Retry failed';
      announce(`Retry failed: ${errorMessage}`, 'assertive');
      
      // Set the error based on the operation type
      setGeneralError(error instanceof Error ? error : errorMessage);
    } finally {
      setState(prev => ({
        ...prev,
        isRetrying: false,
      }));
    }
  }, [canRetry, announce, setGeneralError]);

  const formatError = useCallback((error: Error | string) => {
    return formatErrorForUser(typeof error === 'string' ? new Error(error) : error);
  }, []);

  return {
    // State
    ...state,
    
    // Actions
    setGeneralError,
    setLoadingError,
    setSubmissionError,
    setValidationError,
    setValidationErrors,
    setValidationWarning,
    setValidationWarnings,
    clearError,
    clearFieldError,
    clearAllErrors,
    retry,
    canRetry,
    getErrorType,
    formatError,
  };
}