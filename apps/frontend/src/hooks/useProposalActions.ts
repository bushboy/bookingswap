import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { acceptProposal, rejectProposal, retryProposalOperation } from '@/store/thunks/proposalAcceptanceThunks';
import {
    selectActiveOperations,
    selectGlobalError
} from '@/store/selectors/proposalAcceptanceSelectors';
import { ProposalErrorHandler } from '@/services/proposalErrorHandler';
import { proposalCacheService } from '@/services/proposalCacheService';
import { logger } from '@/utils/logger';

/**
 * Custom hook for managing proposal acceptance/rejection actions
 * Provides loading states and error handling for individual proposals
 */
export const useProposalActions = (userId?: string) => {
    const dispatch = useAppDispatch();
    const activeOperations = useAppSelector(selectActiveOperations);
    const globalError = useAppSelector(selectGlobalError);

    /**
     * Get loading state for a specific proposal
     */
    const getProposalLoadingState = useCallback((proposalId: string) => {
        return activeOperations[proposalId]?.loading || false;
    }, [activeOperations]);

    /**
     * Get error state for a specific proposal
     */
    const getProposalError = useCallback((proposalId: string) => {
        return activeOperations[proposalId]?.error || null;
    }, [activeOperations]);

    /**
     * Check if any proposal action is currently processing
     */
    const isAnyProposalProcessing = useCallback(() => {
        return Object.values(activeOperations).some(op => op.loading);
    }, [activeOperations]);

    /**
     * Accept a proposal with enhanced error handling and caching
     * Implements requirements 6.1, 6.2, 6.4, 6.5, 3.4
     */
    const handleAcceptProposalBase = useCallback(async (
        proposalId: string,
        proposerName?: string,
        swapTargetId?: string
    ) => {
        if (!userId) {
            const error = new Error('User not authenticated');
            logger.error('Accept proposal failed - no user', { proposalId });
            throw error;
        }

        try {
            logger.info('Accepting proposal via hook', { proposalId, userId });

            // Dispatch the acceptance action
            await dispatch(acceptProposal({
                proposalId,
                userId,
                proposerName,
                swapTargetId
            })).unwrap();

            // Invalidate cache after successful acceptance
            proposalCacheService.invalidateOnProposalAction(proposalId, userId, 'accept');

            logger.info('Proposal accepted successfully via hook', { proposalId, userId });
        } catch (error: any) {
            logger.error('Failed to accept proposal via hook', {
                proposalId,
                userId,
                error: error.message,
                code: error.code,
                shouldRetry: error.shouldRetry
            });

            // Enhanced error is already handled by the thunk and notifications are created
            // Just re-throw for any additional caller handling
            throw error;
        }
    }, [dispatch, userId]);

    /**
     * Debounced accept proposal action to prevent duplicate calls
     */
    const {
        debouncedAction: handleAcceptProposal,
        isPending: isAcceptPending
    } = useProposalActionDebounce<typeof handleAcceptProposalBase>(
        handleAcceptProposalBase,
        1000 // 1 second debounce
    );

    /**
     * Reject a proposal with enhanced error handling and caching
     * Implements requirements 6.1, 6.2, 6.4, 6.5, 3.4
     */
    const handleRejectProposalBase = useCallback(async (
        proposalId: string,
        reason?: string,
        proposerName?: string,
        swapTargetId?: string
    ) => {
        if (!userId) {
            const error = new Error('User not authenticated');
            logger.error('Reject proposal failed - no user', { proposalId });
            throw error;
        }

        try {
            logger.info('Rejecting proposal via hook', { proposalId, userId, reason });

            // Dispatch the rejection action
            await dispatch(rejectProposal({
                proposalId,
                userId,
                reason,
                proposerName,
                swapTargetId
            })).unwrap();

            // Invalidate cache after successful rejection
            proposalCacheService.invalidateOnProposalAction(proposalId, userId, 'reject');

            logger.info('Proposal rejected successfully via hook', { proposalId, userId });
        } catch (error: any) {
            logger.error('Failed to reject proposal via hook', {
                proposalId,
                userId,
                reason,
                error: error.message,
                code: error.code,
                shouldRetry: error.shouldRetry
            });

            // Enhanced error is already handled by the thunk and notifications are created
            // Just re-throw for any additional caller handling
            throw error;
        }
    }, [dispatch, userId]);

    /**
     * Debounced reject proposal action to prevent duplicate calls
     */
    const {
        debouncedAction: handleRejectProposal,
        isPending: isRejectPending
    } = useProposalActionDebounce<typeof handleRejectProposalBase>(
        handleRejectProposalBase,
        1000 // 1 second debounce
    );

    /**
     * Retry a failed proposal operation
     * Implements requirement 6.4
     */
    const handleRetryProposal = useCallback(async (
        proposalId: string,
        proposerName?: string,
        reason?: string
    ) => {
        if (!userId) {
            const error = new Error('User not authenticated');
            logger.error('Retry proposal failed - no user', { proposalId });
            throw error;
        }

        try {
            logger.info('Retrying proposal operation via hook', { proposalId, userId });
            await dispatch(retryProposalOperation({
                proposalId,
                userId,
                proposerName,
                reason
            })).unwrap();

            logger.info('Proposal retry successful via hook', { proposalId, userId });
        } catch (error: any) {
            logger.error('Failed to retry proposal via hook', {
                proposalId,
                userId,
                error: error.message,
                code: error.code
            });

            throw error;
        }
    }, [dispatch, userId]);

    /**
     * Check if a proposal error is retryable
     */
    const isProposalRetryable = useCallback((proposalId: string) => {
        const operation = activeOperations[proposalId];
        if (!operation?.error) return false;

        // Create a mock error object to check retryability
        const mockError = {
            response: {
                data: { error: { code: 'UNKNOWN_ERROR' } }
            }
        };

        return ProposalErrorHandler.isRetryableError(mockError);
    }, [activeOperations]);

    /**
     * Get user-friendly error message for a proposal
     */
    const getProposalErrorMessage = useCallback((proposalId: string) => {
        const operation = activeOperations[proposalId];
        if (!operation?.error) return null;

        return operation.error;
    }, [activeOperations]);

    /**
     * Check if a proposal operation should trigger login redirect
     */
    const shouldRedirectToLogin = useCallback((proposalId: string) => {
        const operation = activeOperations[proposalId];
        if (!operation?.error) return false;

        // Create a mock error to check if it should redirect
        const mockError = {
            response: {
                status: 401,
                data: { error: { code: 'TOKEN_EXPIRED' } }
            }
        };

        return ProposalErrorHandler.shouldRedirectToLogin(mockError);
    }, [activeOperations]);

    /**
     * Memoized loading state checker that includes debounce pending state
     */
    const getEnhancedProposalLoadingState = useCallback((proposalId: string) => {
        const reduxLoading = getProposalLoadingState(proposalId);
        const acceptPending = isAcceptPending(proposalId);
        const rejectPending = isRejectPending(proposalId);

        return reduxLoading || acceptPending || rejectPending;
    }, [getProposalLoadingState, isAcceptPending, isRejectPending]);

    /**
     * Check if any proposal action is processing (including debounced actions)
     */
    const isAnyProposalProcessingEnhanced = useCallback(() => {
        const reduxProcessing = isAnyProposalProcessing();
        const anyAcceptPending = isAcceptPending();
        const anyRejectPending = isRejectPending();

        return reduxProcessing || anyAcceptPending || anyRejectPending;
    }, [isAnyProposalProcessing, isAcceptPending, isRejectPending]);

    /**
     * Get cache statistics for debugging
     */
    const getCacheStats = useCallback(() => {
        return proposalCacheService.getCacheStats();
    }, []);

    /**
     * Clear proposal cache manually
     */
    const clearProposalCache = useCallback(() => {
        if (userId) {
            proposalCacheService.invalidateForRefresh(userId);
        }
    }, [userId]);

    return {
        // Original methods
        getProposalLoadingState,
        getProposalError,
        isAnyProposalProcessing,
        handleRetryProposal,
        isProposalRetryable,
        getProposalErrorMessage,
        shouldRedirectToLogin,
        globalError,

        // Enhanced methods with caching and debouncing
        handleAcceptProposal,
        handleRejectProposal,
        getEnhancedProposalLoadingState,
        isAnyProposalProcessingEnhanced,

        // Cache management
        getCacheStats,
        clearProposalCache,

        // Debounce state
        isAcceptPending,
        isRejectPending,
    };
};