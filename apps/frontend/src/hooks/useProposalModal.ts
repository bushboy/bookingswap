import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { swapApiService } from '../services/swapApiService';
import { useAuthenticationGuard } from './useAuthenticationGuard';
import { useErrorRecovery } from './useErrorRecovery';
import {
  EligibleSwap,
  CreateProposalRequest,
  ProposalResponse,
  EligibleSwapsRequestOptions,
  ApiRequestConfig,
  CompatibilityAnalysis,
  createCompatibilityScore,
  CompatibilityScore,
} from '../types/api';
import { SwapPlatformError, ERROR_CODES } from '@booking-swap/shared';
import { debounceAsync, DebouncedMap } from '../utils/debounce';
import { performanceMonitor } from '../services/performanceMonitor';
// Removed CircuitBreakerState import as it doesn't exist

/**
 * State interface for the proposal modal
 * Manages eligible swaps, loading states, and error handling
 */
interface ProposalModalState {
  eligibleSwaps: EligibleSwap[];
  loading: boolean;
  error: string | null;
  submitting: boolean;
  submitError: string | null;
  retryCount: number;
  canRetry: boolean;
  compatibilityAnalyses: Map<string, CompatibilityAnalysis>;
  loadingCompatibility: Set<string>;
  errorThresholdReached: boolean;
  serviceHealthy: boolean;
}

/**
 * Configuration options for the proposal modal hook
 */
interface UseProposalModalOptions {
  userId: string;
  targetSwapId: string | null;
  maxRetries?: number;
  retryDelay?: number;
  autoFetch?: boolean;
}

/**
 * Return type for the useProposalModal hook
 */
interface UseProposalModalReturn {
  // State
  eligibleSwaps: EligibleSwap[];
  loading: boolean;
  error: string | null;
  submitting: boolean;
  submitError: string | null;
  canRetry: boolean;
  retryCount: number;
  errorThresholdReached: boolean;
  serviceHealthy: boolean;

  // Compatibility scoring
  getCompatibilityScore: (swapId: string) => CompatibilityScore | null;
  getCompatibilityAnalysis: (swapId: string) => CompatibilityAnalysis | null;
  isLoadingCompatibility: (swapId: string) => boolean;
  refreshCompatibilityScore: (swapId: string) => Promise<void>;

  // Actions
  fetchEligibleSwaps: () => Promise<void>;
  submitProposal: (proposalData: CreateProposalRequest) => Promise<ProposalResponse | null>;
  retry: () => Promise<void>;
  manualRetry: () => Promise<void>;
  clearError: () => void;
  clearSubmitError: () => void;
  reset: () => void;
  resetCircuitBreaker: () => void;

  // Request management
  cancelRequests: () => void;
}

/**
 * Custom hook for managing proposal modal state and API interactions
 * 
 * Handles:
 * - Fetching eligible swaps with compatibility filtering
 * - Proposal submission with validation
 * - Error handling and retry logic
 * - Request cancellation and cleanup
 * 
 * Requirements satisfied:
 * - 1.2: API call orchestration with proper error handling
 * - 1.3: Loading states with accessibility announcements
 * - 1.4: Error handling with retry options
 * - 5.3: Request cancellation and cleanup
 */
export const useProposalModal = (options: UseProposalModalOptions): UseProposalModalReturn => {
  const {
    userId,
    targetSwapId,
    maxRetries = 3,
    retryDelay = 1000,
    autoFetch = true,
  } = options;

  // Authentication guard for handling auth errors
  const {
    requireAuthentication,
    handleAuthError,
    isAuthError,
    isAuthorizationError,
    getAuthErrorMessage,
  } = useAuthenticationGuard({
    autoRedirect: true,
    preserveLocation: true,
  });

  // State management
  const [state, setState] = useState<ProposalModalState>({
    eligibleSwaps: [],
    loading: false,
    error: null,
    submitting: false,
    submitError: null,
    retryCount: 0,
    canRetry: false,
    compatibilityAnalyses: new Map(),
    loadingCompatibility: new Set(),
    errorThresholdReached: false,
    serviceHealthy: true,
  });

  // Memoize error recovery configs to prevent infinite re-renders
  const eligibleSwapsRecoveryConfig = useMemo(() => ({
    operationName: 'fetch_eligible_swaps',
    config: {
      maxAttempts: maxRetries,
      baseDelay: retryDelay,
      maxDelay: 10000,
      backoffMultiplier: 2,
      jitter: true,
      failureThreshold: 3,
      recoveryTimeout: 30000,
    },
    onSuccess: (response) => {
      console.log('useProposalModal - onSuccess called with response:', response);

      // Validate response structure
      if (!response || typeof response !== 'object') {
        console.error('Invalid API response structure:', response);
        setState(prev => ({
          ...prev,
          loading: false,
          error: 'Invalid response from server',
          eligibleSwaps: [],
        }));
        return;
      }

      // The API service now returns a normalized structure with eligibleSwaps property
      const eligibleSwaps = response.eligibleSwaps || [];
      console.log('useProposalModal - extracted eligibleSwaps:', eligibleSwaps);

      // Debug logging to see what we're getting
      console.log('useProposalModal - API Response:', response);
      console.log('useProposalModal - Extracted eligibleSwaps:', eligibleSwaps);
      console.log('useProposalModal - eligibleSwaps length:', eligibleSwaps.length);
      console.log('useProposalModal - eligibleSwaps is array:', Array.isArray(eligibleSwaps));

      console.log('✅ useProposalModal - Setting eligible swaps in state:', {
        swapsCount: Array.isArray(eligibleSwaps) ? eligibleSwaps.length : 0,
        isArray: Array.isArray(eligibleSwaps)
      });

      setState(prev => ({
        ...prev,
        eligibleSwaps: Array.isArray(eligibleSwaps) ? eligibleSwaps : [],
        loading: false,
        error: null,
        retryCount: 0,
        canRetry: false,
        errorThresholdReached: false,
        serviceHealthy: true,
      }));

      console.log('✅ State updated successfully with eligible swaps');

      // Note: Compatibility analysis is already included in the eligible swaps response
      // from the /api/swaps/user/eligible endpoint, so we don't need to fetch it separately.
      // The compatibility data includes score, factors, recommendations, and potential issues.
      // Keeping this code commented for reference:
      // const safeSwaps = Array.isArray(eligibleSwaps) ? eligibleSwaps : [];
      // safeSwaps.forEach((swap, index) => {
      //   setTimeout(() => {
      //     fetchCompatibilityAnalysisDebounced(swap.id);
      //   }, index * 100);
      // });
    },
    onError: (error) => {
      console.log('❌ useProposalModal - onError callback:', {
        error: error.message,
        errorName: error.name,
        isAbortError: error.name === 'AbortError',
        isCancelError: error.message?.includes('cancel'),
        currentAttempt: eligibleSwapsRecovery.currentAttempt
      });

      const canRetry = eligibleSwapsRecovery.canRetry && !isAuthError(error);
      const errorMessage = formatErrorMessage(error);

      console.log('❌ Setting error state:', { errorMessage, canRetry });
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
        retryCount: eligibleSwapsRecovery.currentAttempt,
        canRetry,
        errorThresholdReached: eligibleSwapsRecovery.currentAttempt >= maxRetries,
        serviceHealthy: eligibleSwapsRecovery.currentAttempt === 0,
      }));

      // Handle authentication/authorization errors
      if (isAuthError(error) || isAuthorizationError(error)) {
        console.log('❌ Auth error detected, handling');
        handleAuthError(error);
      }
    },
    onRetryCountChange: (count) => {
      setState(prev => ({
        ...prev,
        errorThresholdReached: count >= maxRetries,
        serviceHealthy: count === 0,
      }));
    },
    announceErrors: true,
  }), [maxRetries, retryDelay]);

  // Error recovery for eligible swaps fetching
  const eligibleSwapsRecovery = useErrorRecovery(eligibleSwapsRecoveryConfig);

  // Memoize proposal submission recovery config
  const proposalSubmissionRecoveryConfig = useMemo(() => ({
    operationName: 'submit_proposal',
    config: {
      maxAttempts: 2, // Fewer retries for submissions to avoid duplicates
      baseDelay: 2000,
      maxDelay: 5000,
      backoffMultiplier: 2,
      jitter: false, // No jitter for submissions
      failureThreshold: 3,
      recoveryTimeout: 30000,
    },
    onSuccess: (response) => {
      setState(prev => ({
        ...prev,
        submitting: false,
        submitError: null,
      }));
    },
    onError: (error) => {
      const errorMessage = formatErrorMessage(error);
      setState(prev => ({
        ...prev,
        submitting: false,
        submitError: errorMessage,
      }));

      // Handle authentication/authorization errors
      if (isAuthError(error) || isAuthorizationError(error)) {
        handleAuthError(error);
      }
    },
    announceErrors: true,
  }), []);

  // Error recovery for proposal submission
  const proposalSubmissionRecovery = useErrorRecovery(proposalSubmissionRecoveryConfig);

  // Request management
  const abortControllerRef = useRef<AbortController | null>(null);
  const submitAbortControllerRef = useRef<AbortController | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const compatibilityAbortControllersRef = useRef<Map<string, AbortController>>(new Map());

  // Debounced compatibility fetching
  const debouncedCompatibilityFetch = useRef<DebouncedMap<(sourceSwapId: string) => Promise<void>> | null>(null);

  /**
   * Create a new AbortController for request cancellation
   */
  const createAbortController = useCallback(() => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    return controller;
  }, []);

  /**
   * Create a new AbortController for proposal submission
   */
  const createSubmitAbortController = useCallback(() => {
    const controller = new AbortController();
    submitAbortControllerRef.current = controller;
    return controller;
  }, []);

  /**
   * Cancel all in-flight requests
   */
  const cancelRequests = useCallback(() => {
    console.log('🔴 useProposalModal - cancelRequests() called from:', new Error().stack);

    if (abortControllerRef.current) {
      console.log('🔴 Aborting main abortController');
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (submitAbortControllerRef.current) {
      console.log('🔴 Aborting submitAbortController');
      submitAbortControllerRef.current.abort();
      submitAbortControllerRef.current = null;
    }

    if (retryTimeoutRef.current) {
      console.log('🔴 Clearing retry timeout');
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    // Cancel all compatibility requests
    console.log('🔴 Cancelling compatibility requests, count:', compatibilityAbortControllersRef.current.size);
    compatibilityAbortControllersRef.current.forEach((controller, key) => {
      console.log('🔴 Aborting compatibility controller for:', key);
      controller.abort();
    });
    compatibilityAbortControllersRef.current.clear();

    // Cancel all debounced compatibility requests
    if (debouncedCompatibilityFetch.current) {
      console.log('🔴 Cancelling all debounced compatibility requests');
      debouncedCompatibilityFetch.current.cancelAll();
    }

    console.log('🔴 cancelRequests() completed');
  }, []);

  /**
   * Get compatibility score for a specific swap
   */
  const getCompatibilityScore = useCallback((swapId: string): CompatibilityScore | null => {
    const analysis = state.compatibilityAnalyses.get(swapId);
    if (!analysis) {
      // Fall back to the score from the eligible swap if available
      const swap = state.eligibleSwaps.find(s => s.id === swapId);
      if (swap && swap.compatibilityScore !== undefined) {
        return createCompatibilityScore(swap.compatibilityScore);
      }
      return null;
    }
    return createCompatibilityScore(analysis.score);
  }, [state.compatibilityAnalyses, state.eligibleSwaps]);

  /**
   * Get full compatibility analysis for a specific swap
   */
  const getCompatibilityAnalysis = useCallback((swapId: string): CompatibilityAnalysis | null => {
    return state.compatibilityAnalyses.get(swapId) || null;
  }, [state.compatibilityAnalyses]);

  /**
   * Check if compatibility is currently being loaded for a swap
   */
  const isLoadingCompatibility = useCallback((swapId: string): boolean => {
    return state.loadingCompatibility.has(swapId);
  }, [state.loadingCompatibility]);

  /**
   * Fetch real-time compatibility analysis for a specific swap
   */
  const fetchCompatibilityAnalysis = useCallback(async (sourceSwapId: string): Promise<void> => {
    if (!targetSwapId || !sourceSwapId) {
      return;
    }

    // Don't fetch if already loading
    if (state.loadingCompatibility.has(sourceSwapId)) {
      return;
    }

    // Cancel any existing request for this swap
    const existingController = compatibilityAbortControllersRef.current.get(sourceSwapId);
    if (existingController) {
      existingController.abort();
    }

    const abortController = new AbortController();
    compatibilityAbortControllersRef.current.set(sourceSwapId, abortController);

    // Set loading state
    setState(prev => {
      const newLoadingSet = new Set(prev.loadingCompatibility);
      newLoadingSet.add(sourceSwapId);
      return {
        ...prev,
        loadingCompatibility: newLoadingSet,
      };
    });

    try {
      const requestConfig: ApiRequestConfig = {
        abortController,
        timeout: 10000, // 10 second timeout for compatibility checks
      };

      // Use performance monitoring for compatibility checks
      const analysis = await performanceMonitor.measureAsync(
        `compatibility_check_${sourceSwapId}_${targetSwapId}`,
        () => swapApiService.getSwapCompatibility(sourceSwapId, targetSwapId, requestConfig),
        { sourceSwapId, targetSwapId }
      );

      // Check if request was cancelled
      if (abortController.signal.aborted) {
        return;
      }

      // Update state with the analysis
      setState(prev => {
        const newAnalyses = new Map(prev.compatibilityAnalyses);
        newAnalyses.set(sourceSwapId, analysis);

        const newLoadingSet = new Set(prev.loadingCompatibility);
        newLoadingSet.delete(sourceSwapId);

        return {
          ...prev,
          compatibilityAnalyses: newAnalyses,
          loadingCompatibility: newLoadingSet,
        };
      });

    } catch (error) {
      const err = error as Error;

      // Don't update state if request was cancelled
      if (err.name === 'AbortError') {
        return;
      }

      // Remove loading state on error
      setState(prev => {
        const newLoadingSet = new Set(prev.loadingCompatibility);
        newLoadingSet.delete(sourceSwapId);
        return {
          ...prev,
          loadingCompatibility: newLoadingSet,
        };
      });

      // Log error but don't show it to user (compatibility is supplementary)
      console.warn(`Failed to fetch compatibility for swap ${sourceSwapId}:`, err);
    } finally {
      // Clean up abort controller
      compatibilityAbortControllersRef.current.delete(sourceSwapId);
    }
  }, [targetSwapId, state.loadingCompatibility]);

  /**
   * Initialize debounced compatibility fetching
   */
  const initializeDebouncedCompatibility = useCallback(() => {
    if (!debouncedCompatibilityFetch.current) {
      debouncedCompatibilityFetch.current = new DebouncedMap(
        fetchCompatibilityAnalysis,
        500, // 500ms debounce delay
        false
      );
    }
  }, [fetchCompatibilityAnalysis]);

  /**
   * Debounced compatibility analysis fetching
   */
  const fetchCompatibilityAnalysisDebounced = useCallback(async (sourceSwapId: string): Promise<void> => {
    initializeDebouncedCompatibility();
    const debouncedFunc = debouncedCompatibilityFetch.current!.get(sourceSwapId);
    return debouncedFunc(sourceSwapId);
  }, [initializeDebouncedCompatibility]);

  /**
   * Refresh compatibility score for a specific swap
   */
  const refreshCompatibilityScore = useCallback(async (swapId: string): Promise<void> => {
    // Clear existing analysis to force refresh
    setState(prev => {
      const newAnalyses = new Map(prev.compatibilityAnalyses);
      newAnalyses.delete(swapId);
      return {
        ...prev,
        compatibilityAnalyses: newAnalyses,
      };
    });

    // Cancel any pending debounced request for this swap
    if (debouncedCompatibilityFetch.current) {
      debouncedCompatibilityFetch.current.cancel(swapId);
    }

    // Fetch fresh analysis immediately (bypass debouncing for manual refresh)
    await fetchCompatibilityAnalysis(swapId);
  }, [fetchCompatibilityAnalysis]);

  /**
   * Determine if an error is retryable
   */
  const isRetryableError = useCallback((error: Error): boolean => {
    if (error instanceof SwapPlatformError) {
      return error.retryable;
    }

    // Network errors and timeouts are generally retryable
    if (error.name === 'AbortError') {
      return false; // Don't retry cancelled requests
    }

    if (error.message.includes('timeout') || error.message.includes('network')) {
      return true;
    }

    return false;
  }, []);

  /**
   * Format error message for user display
   */
  const formatErrorMessage = useCallback((error: Error): string => {
    // Use authentication guard for auth-related errors
    if (isAuthError(error) || isAuthorizationError(error)) {
      return getAuthErrorMessage(error);
    }

    if (error instanceof SwapPlatformError) {
      switch (error.code) {
        case ERROR_CODES.NETWORK_ERROR:
          return 'Unable to connect. Please check your internet connection.';
        case ERROR_CODES.SWAP_NOT_FOUND:
          return 'The requested swap was not found.';
        case ERROR_CODES.RATE_LIMIT_EXCEEDED:
          return 'Too many requests. Please try again in a moment.';
        default:
          return error.message || 'An unexpected error occurred.';
      }
    }

    if (error.name === 'AbortError') {
      return 'Request was cancelled.';
    }

    return error.message || 'Something went wrong. Please try again.';
  }, [isAuthError, isAuthorizationError, getAuthErrorMessage]);

  /**
   * Fetch eligible swaps from the API with comprehensive error recovery
   */
  const fetchEligibleSwaps = useCallback(async (): Promise<void> => {
    console.log('🟢 ================== fetchEligibleSwaps CALLED ==================');
    console.log('🟢 Call stack:', new Error().stack);

    // Check authentication before making API calls
    if (!requireAuthentication()) {
      console.log('❌ Authentication required');
      setState(prev => ({
        ...prev,
        error: 'Authentication required. Please log in to continue.',
        canRetry: false,
      }));
      return;
    }

    console.log('🟢 Parameters:', { targetSwapId, userId });
    if (!targetSwapId || !userId) {
      console.log('❌ Missing required parameters');
      setState(prev => ({
        ...prev,
        error: 'Missing required parameters for fetching eligible swaps.',
        canRetry: false,
      }));
      return;
    }

    // Cancel any existing request
    if (abortControllerRef.current) {
      console.log('⚠️ fetchEligibleSwaps - Aborting existing request before creating new one');
      abortControllerRef.current.abort();
    }

    console.log('🟢 fetchEligibleSwaps - Creating new AbortController');
    const abortController = createAbortController();
    console.log('🟢 AbortController created, signal.aborted:', abortController.signal.aborted);

    // Add listener to track when signal is aborted
    abortController.signal.addEventListener('abort', () => {
      console.log('🔴🔴🔴 ABORT EVENT FIRED ON SIGNAL!', new Error().stack);
    });

    console.log('🟢 fetchEligibleSwaps - Setting loading state, clearing error');
    setState(prev => ({
      ...prev,
      loading: true,
      error: null,
      canRetry: false,
    }));

    // Use error recovery service for robust API calls
    await eligibleSwapsRecovery.executeWithRecovery(async () => {
      const requestOptions: EligibleSwapsRequestOptions = {
        targetSwapId,
        limit: 50, // Reasonable limit for modal display
        includeIneligible: false, // Only show eligible swaps
        minCompatibilityScore: 0, // Include all compatibility scores
      };

      const requestConfig: ApiRequestConfig = {
        abortController,
        timeout: 15000, // 15 second timeout
      };

      console.log('🟢 useProposalModal - BEFORE API CALL - signal.aborted:', abortController.signal.aborted);
      console.log('🟢 useProposalModal - Making API call with:', {
        userId,
        requestOptions,
        targetSwapId,
        hasAbortSignal: !!requestConfig.abortController?.signal,
        signalAborted: requestConfig.abortController?.signal?.aborted
      });

      const response = await swapApiService.getEligibleSwaps(
        userId,
        requestOptions,
        requestConfig
      );

      console.log('🟢 useProposalModal - IMMEDIATELY AFTER API CALL - signal.aborted:', abortController.signal.aborted);
      console.log('🟢 useProposalModal - API call completed successfully, response:', {
        eligibleSwapsCount: response.eligibleSwaps?.length || 0,
        hasCompatibilityAnalysis: !!response.compatibilityAnalysis
      });

      console.log('useProposalModal - API response:', response);

      // NOTE: We used to check if the signal was aborted here and throw an error,
      // but that's incorrect! If the API call succeeded and returned data, we should
      // use it, regardless of whether the signal was aborted afterward.
      // The abort signal's purpose is to cancel in-flight requests, not reject
      // successful responses.
      console.log('🔍 Signal state after API (for debugging):', {
        signalAborted: abortController.signal.aborted,
        signalReason: abortController.signal.reason,
        controllerRef: abortControllerRef.current === abortController ? 'SAME' : 'DIFFERENT'
      });

      console.log('✅ API call succeeded, returning response (ignoring post-success abort signal)');
      return response;
    });
  }, [
    userId,
    targetSwapId
  ]);

  /**
   * Submit a proposal to the API with comprehensive error recovery
   */
  const submitProposal = useCallback(async (proposalData: CreateProposalRequest): Promise<ProposalResponse | null> => {
    // Check authentication before making API calls
    if (!requireAuthentication()) {
      setState(prev => ({
        ...prev,
        submitError: 'Authentication required. Please log in to continue.',
      }));
      return null;
    }

    if (!targetSwapId) {
      setState(prev => ({
        ...prev,
        submitError: 'Missing target swap ID for proposal submission.',
      }));
      return null;
    }

    // Cancel any existing submit request
    if (submitAbortControllerRef.current) {
      submitAbortControllerRef.current.abort();
    }

    const abortController = createSubmitAbortController();

    setState(prev => ({
      ...prev,
      submitting: true,
      submitError: null,
    }));

    // Use error recovery service for robust proposal submission
    const result = await proposalSubmissionRecovery.executeWithRecovery(async () => {
      const requestConfig: ApiRequestConfig = {
        abortController,
        timeout: 30000, // 30 second timeout for submission
      };

      console.log('🟢 submitProposal - Making API call');
      const response = await swapApiService.createProposal(
        targetSwapId,
        proposalData,
        undefined, // No additional validation context
        requestConfig
      );

      console.log('🟢 submitProposal - API call completed');

      // NOTE: Similar to fetchEligibleSwaps, if the API succeeded, we should use the response
      // regardless of whether the signal was aborted afterward.
      console.log('🔍 submitProposal - Signal state (for debugging):', {
        signalAborted: abortController.signal.aborted,
        signalReason: abortController.signal.reason
      });

      console.log('✅ submitProposal - API succeeded, returning response');
      return response;
    });

    return result.success ? result.data || null : null;
  }, [
    targetSwapId,
    createSubmitAbortController,
    requireAuthentication,
    proposalSubmissionRecovery
  ]);

  /**
   * Retry the last failed operation with exponential backoff
   */
  const retry = useCallback(async (): Promise<void> => {
    if (!state.canRetry) {
      return;
    }

    await eligibleSwapsRecovery.retry();
  }, [state.canRetry, eligibleSwapsRecovery]);

  /**
   * Manual retry (immediate retry without waiting)
   */
  const manualRetry = useCallback(async (): Promise<void> => {
    await eligibleSwapsRecovery.manualRetry();
  }, [eligibleSwapsRecovery]);

  /**
   * Reset retry attempts for the service
   */
  const resetRetries = useCallback(() => {
    eligibleSwapsRecovery.resetRetries();
    proposalSubmissionRecovery.resetRetries();
  }, [eligibleSwapsRecovery, proposalSubmissionRecovery]);

  /**
   * Clear the current error state
   */
  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null,
      canRetry: false,
      retryCount: 0,
    }));
    eligibleSwapsRecovery.clearError();
  }, [eligibleSwapsRecovery]);

  /**
   * Clear the current submit error state
   */
  const clearSubmitError = useCallback(() => {
    setState(prev => ({
      ...prev,
      submitError: null,
    }));
    proposalSubmissionRecovery.clearError();
  }, [proposalSubmissionRecovery]);

  /**
   * Reset all state to initial values
   */
  const reset = useCallback(() => {
    console.log('🔵 useProposalModal - reset() called from:', new Error().stack);

    cancelRequests();

    // Clear debounced functions
    if (debouncedCompatibilityFetch.current) {
      console.log('🔵 Clearing debounced functions');
      debouncedCompatibilityFetch.current.clear();
      debouncedCompatibilityFetch.current = null;
    }

    // Clear error recovery state
    console.log('🔵 Clearing error recovery state');
    eligibleSwapsRecovery.clearError();
    proposalSubmissionRecovery.clearError();

    console.log('🔵 Setting state - CLEARING ELIGIBLE SWAPS TO []');
    setState({
      eligibleSwaps: [],
      loading: false,
      error: null,
      submitting: false,
      submitError: null,
      retryCount: 0,
      canRetry: false,
      compatibilityAnalyses: new Map(),
      loadingCompatibility: new Set(),
      errorThresholdReached: false,
      serviceHealthy: true,
    });

    console.log('🔵 reset() completed, eligibleSwaps cleared');
  }, [cancelRequests]);

  // Auto-fetch eligible swaps when targetSwapId changes
  useEffect(() => {
    console.log('🟡 useEffect - Auto-fetch triggered:', {
      autoFetch,
      targetSwapId,
      userId,
      willFetch: autoFetch && targetSwapId && userId
    });

    if (autoFetch && targetSwapId && userId) {
      console.log('🟡 Calling fetchEligibleSwaps()');
      fetchEligibleSwaps();
    }

    // Don't cancel requests in cleanup here - let the component unmount effect handle it
    // Otherwise, any dependency change (like autoFetch toggling) will cancel ongoing requests
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetSwapId, userId, autoFetch]);

  // Cleanup on unmount
  useEffect(() => {
    console.log('🟡 useEffect - Unmount cleanup effect registered');
    return () => {
      console.log('🟡 useEffect - Component UNMOUNTING, calling cancelRequests()');
      cancelRequests();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Memoize the eligible swaps to prevent infinite re-renders
  const memoizedEligibleSwaps = useMemo(() => {
    return Array.isArray(state.eligibleSwaps) ? state.eligibleSwaps : [];
  }, [state.eligibleSwaps]);

  return {
    // State
    eligibleSwaps: memoizedEligibleSwaps,
    loading: state.loading,
    error: state.error,
    submitting: state.submitting,
    submitError: state.submitError,
    canRetry: state.canRetry,
    retryCount: state.retryCount,
    errorThresholdReached: state.errorThresholdReached,
    serviceHealthy: state.serviceHealthy,

    // Compatibility scoring
    getCompatibilityScore,
    getCompatibilityAnalysis,
    isLoadingCompatibility,
    refreshCompatibilityScore,

    // Actions
    fetchEligibleSwaps,
    submitProposal,
    retry,
    manualRetry,
    clearError,
    clearSubmitError,
    reset,
    resetRetries,

    // Request management
    cancelRequests,
  };
};