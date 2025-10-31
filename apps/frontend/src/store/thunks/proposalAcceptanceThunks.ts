import { createAsyncThunk } from '@reduxjs/toolkit';
import {
    CreateProposalResponseRequest,
    ProposalResponseResult,
} from '@booking-swap/shared';
import { RootState } from '../index';
import {
    startProposalOperation,
    completeProposalOperation,
    failProposalOperation,
    addOptimisticAcceptance,
    addOptimisticRejection,
    removeOptimisticUpdate,
    setGlobalError,
    startBatchOperation,
    completeBatchOperation,
    removeCompletedOperation,
    removeOldSuccessOperations,
    clearRollbackData,
} from '../slices/proposalAcceptanceSlice';
import {
    updateProposal,
    invalidateProposalCache,
} from '../slices/proposalSlice';
import { addNotification } from '../slices/notificationSlice';
import { proposalAcceptanceAPI } from '../../services/proposalAcceptanceAPI';
import type { ProposalActionResponse } from '../../services/proposalAcceptanceAPI';
import { ProposalErrorHandler } from '../../services/proposalErrorHandler';
import { ProposalNotificationService } from '../../services/proposalNotificationService';
import { logger } from '@/utils/logger';

/**
 * Helper function to create notification with userId
 */
const createNotificationWithUserId = (notification: any, userId: string) => ({
    ...notification,
    userId
});

/**
 * Helper function to dispatch auth redirect with logging
 */
const dispatchAuthRedirectWithLogging = (context: string, additionalInfo?: any) => {
    console.log('🔒 LOGIN REDIRECT TRIGGERED by ProposalAcceptanceThunk:', {
        component: 'ProposalAcceptanceThunk',
        context: context,
        reason: 'Authentication error during proposal operation',
        conditions: {
            shouldRedirectToLogin: true,
            errorType: 'authentication_error',
            ...additionalInfo
        },
        action: 'Dispatching auth:redirect-to-login event',
        timestamp: new Date().toISOString()
    });
    window.dispatchEvent(new CustomEvent('auth:redirect-to-login'));
};

/**
 * Adapter to convert between API service response and expected Redux thunk result format
 */
const adaptApiResponseToResult = (
    apiResponse: ProposalActionResponse,
    request: CreateProposalResponseRequest
): ProposalResponseResult => {
    return {
        response: {
            id: `response-${Date.now()}`, // Generated ID for response
            proposalId: request.proposalId,
            responderId: request.responderId,
            action: request.action,
            reason: request.reason,
            swapId: apiResponse.swap?.id,
            paymentTransactionId: apiResponse.paymentTransaction?.id,
            blockchainTransactionId: apiResponse.blockchainTransaction.transactionId,
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        proposal: {
            id: apiResponse.proposal.id,
            status: apiResponse.proposal.status,
            respondedAt: new Date(apiResponse.proposal.respondedAt),
            respondedBy: apiResponse.proposal.respondedBy,
            rejectionReason: apiResponse.proposal.rejectionReason,
            updatedAt: new Date(),
        },
        swap: apiResponse.swap ? {
            id: apiResponse.swap.id,
            status: apiResponse.swap.status,
            createdAt: new Date(),
        } : undefined,
        paymentTransaction: apiResponse.paymentTransaction ? {
            id: apiResponse.paymentTransaction.id,
            status: apiResponse.paymentTransaction.status,
            amount: apiResponse.paymentTransaction.amount,
            currency: apiResponse.paymentTransaction.currency,
        } : undefined,
        blockchainTransaction: {
            transactionId: apiResponse.blockchainTransaction.transactionId,
            consensusTimestamp: apiResponse.blockchainTransaction.consensusTimestamp,
        },
    };
};

/**
 * Real API service integration - replaces mock implementation
 */
const proposalAcceptanceAPIAdapter = {
    async acceptProposal(request: CreateProposalResponseRequest): Promise<ProposalResponseResult> {
        const apiResponse = await proposalAcceptanceAPI.acceptProposal({
            proposalId: request.proposalId,
            userId: request.responderId,
            autoProcessPayment: true,
            swapTargetId: (request as any).swapTargetId, // Pass through swapTargetId if provided
        });

        return adaptApiResponseToResult(apiResponse, request);
    },

    async rejectProposal(request: CreateProposalResponseRequest): Promise<ProposalResponseResult> {
        const apiResponse = await proposalAcceptanceAPI.rejectProposal({
            proposalId: request.proposalId,
            userId: request.responderId,
            reason: request.reason,
            swapTargetId: (request as any).swapTargetId, // Pass through swapTargetId if provided
        });

        return adaptApiResponseToResult(apiResponse, request);
    },

    async getProposalStatus(proposalId: string): Promise<{ status: string; updatedAt: Date }> {
        const statusResponse = await proposalAcceptanceAPI.getProposalStatus(proposalId);

        return {
            status: statusResponse.status,
            updatedAt: statusResponse.respondedAt ? new Date(statusResponse.respondedAt) : new Date(),
        };
    },
};

/**
 * Accept a proposal with enhanced error handling and notifications
 * Implements requirements 6.1, 6.2, 6.3, 6.4, 6.5
 */
export const acceptProposal = createAsyncThunk(
    'proposalAcceptance/acceptProposal',
    async (
        {
            proposalId,
            userId,
            enableOptimisticUpdate = true,
            proposerName,
            maxRetries = 3,
            swapTargetId,
        }: {
            proposalId: string;
            userId: string;
            enableOptimisticUpdate?: boolean;
            proposerName?: string;
            maxRetries?: number;
            swapTargetId?: string;
        },
        { dispatch, getState }
    ) => {
        const state = getState() as RootState;

        // Check if operation is already in progress
        const existingOperation = state.proposalAcceptance.activeOperations[proposalId];
        if (existingOperation?.loading) {
            const error = new Error('Operation already in progress for this proposal');
            logger.warn('Duplicate proposal acceptance attempt', { proposalId, userId });
            throw error;
        }

        const request: CreateProposalResponseRequest = {
            proposalId,
            responderId: userId,
            action: 'accept',
            ...(swapTargetId && { swapTargetId }), // Include swapTargetId if provided
        } as any;

        let lastError: any;
        let attempt = 0;

        while (attempt <= maxRetries) {
            try {
                // Start operation with optimistic update (only on first attempt)
                if (attempt === 0) {
                    dispatch(startProposalOperation({
                        proposalId,
                        action: 'accept',
                        optimisticStatus: enableOptimisticUpdate ? 'accepted' : undefined,
                    }));

                    // Add optimistic update if enabled
                    if (enableOptimisticUpdate) {
                        dispatch(addOptimisticAcceptance(proposalId));
                    }
                }

                logger.info('Attempting to accept proposal', {
                    proposalId,
                    userId,
                    attempt: attempt + 1,
                    maxRetries: maxRetries + 1
                });

                // Make API call
                const result = await proposalAcceptanceAPIAdapter.acceptProposal(request);

                logger.info('Proposal accepted successfully', {
                    proposalId,
                    userId,
                    attempt: attempt + 1,
                    hasPayment: !!result.paymentTransaction
                });

                // Complete operation
                dispatch(completeProposalOperation({ proposalId, result }));

                // Update proposal in main proposal state
                if (result.proposal) {
                    dispatch(updateProposal(result.proposal));
                }

                // Remove optimistic update
                if (enableOptimisticUpdate) {
                    dispatch(removeOptimisticUpdate(proposalId));
                }

                // Invalidate proposal cache to refresh data
                dispatch(invalidateProposalCache());

                // Create success notification
                const successNotification = createNotificationWithUserId(
                    ProposalNotificationService.createAcceptanceSuccessNotification(
                        proposalId,
                        proposerName,
                        result.paymentTransaction?.amount,
                        result.paymentTransaction?.currency
                    ),
                    userId
                );
                dispatch(addNotification(successNotification));
                ProposalNotificationService.logNotificationCreated(successNotification);

                // Create payment completion notification if payment was processed
                if (result.paymentTransaction) {
                    const paymentNotification = createNotificationWithUserId(
                        ProposalNotificationService.createPaymentCompletedNotification(
                            proposalId,
                            result.paymentTransaction.id,
                            result.paymentTransaction.amount,
                            result.paymentTransaction.currency,
                            proposerName
                        ),
                        userId
                    );
                    dispatch(addNotification(paymentNotification));
                    ProposalNotificationService.logNotificationCreated(paymentNotification);
                }

                // Create blockchain notification if transaction was recorded
                if (result.blockchainTransaction) {
                    const blockchainNotification = createNotificationWithUserId(
                        ProposalNotificationService.createBlockchainTransactionNotification(
                            proposalId,
                            result.blockchainTransaction.transactionId,
                            'accept',
                            result.blockchainTransaction.consensusTimestamp
                        ),
                        userId
                    );
                    dispatch(addNotification(blockchainNotification));
                    ProposalNotificationService.logNotificationCreated(blockchainNotification);
                }

                // If this was a retry, create retry success notification
                if (attempt > 0) {
                    const retryNotification = createNotificationWithUserId(
                        ProposalNotificationService.createRetrySuccessNotification(
                            proposalId,
                            'accept',
                            proposerName
                        ),
                        userId
                    );
                    dispatch(addNotification(retryNotification));
                    ProposalNotificationService.logNotificationCreated(retryNotification);
                }

                return result;
            } catch (error: any) {
                lastError = error;
                attempt++;

                logger.error('Proposal acceptance attempt failed', {
                    proposalId,
                    userId,
                    attempt,
                    maxRetries: maxRetries + 1,
                    error: error.message,
                    status: error.response?.status,
                    errorCode: error.response?.data?.error?.code
                });

                // Handle authentication errors immediately (don't retry)
                if (ProposalErrorHandler.shouldRedirectToLogin(error)) {
                    const authNotification = ProposalNotificationService.createAuthenticationErrorNotification();
                    dispatch(addNotification(authNotification));
                    ProposalNotificationService.logNotificationCreated(authNotification);

                    // Trigger login redirect
                    window.dispatchEvent(new CustomEvent('auth:redirect-to-login'));
                    break;
                }

                // Check if error is retryable and we haven't exceeded max retries
                const isRetryable = ProposalErrorHandler.isRetryableError(error);
                if (!isRetryable || attempt > maxRetries) {
                    break;
                }

                // Wait before retrying with exponential backoff
                const retryDelay = ProposalErrorHandler.getRetryDelay(error, attempt);
                logger.info('Retrying proposal acceptance', {
                    proposalId,
                    attempt: attempt + 1,
                    retryDelay
                });

                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }

        // All attempts failed, handle the error
        const enhancedError = ProposalErrorHandler.handleApiError(lastError, proposalId);
        const errorMessage = enhancedError.message;

        logger.error('All proposal acceptance attempts failed', {
            proposalId,
            userId,
            totalAttempts: attempt,
            finalError: errorMessage,
            errorCode: enhancedError.code
        });

        // Get original status for rollback
        const originalProposal = state.proposals.proposalHistory.find((p: any) => p.id === proposalId);
        const originalStatus = originalProposal?.status;

        // Fail operation
        dispatch(failProposalOperation({
            proposalId,
            error: errorMessage,
            originalStatus,
        }));

        // Remove optimistic update on failure
        if (enableOptimisticUpdate) {
            dispatch(removeOptimisticUpdate(proposalId));
        }

        // Create error notification
        let errorNotification;
        if (lastError && !lastError.response) {
            // Network error
            errorNotification = ProposalNotificationService.createNetworkErrorNotification(
                proposalId,
                'accept',
                enhancedError.shouldRetry
            );
        } else if (enhancedError.code === 'PAYMENT_PROCESSING_FAILED' && lastError.response?.data?.paymentTransaction) {
            // Payment-specific error
            errorNotification = ProposalNotificationService.createPaymentFailedNotification(
                proposalId,
                lastError.response.data.paymentTransaction.amount,
                lastError.response.data.paymentTransaction.currency,
                errorMessage,
                proposerName
            );
        } else {
            // General operation error
            errorNotification = ProposalNotificationService.createOperationErrorNotification(
                proposalId,
                'accept',
                errorMessage,
                enhancedError.shouldRetry,
                proposerName
            );
        }

        dispatch(addNotification(errorNotification));
        ProposalNotificationService.logNotificationCreated(errorNotification);

        // Throw the enhanced error
        const finalError = new Error(errorMessage);
        (finalError as any).code = enhancedError.code;
        (finalError as any).shouldRetry = enhancedError.shouldRetry;
        (finalError as any).userAction = enhancedError.userAction;
        throw finalError;
    }
);

/**
 * Reject a proposal with enhanced error handling and notifications
 * Implements requirements 6.1, 6.2, 6.3, 6.4, 6.5
 */
export const rejectProposal = createAsyncThunk(
    'proposalAcceptance/rejectProposal',
    async (
        {
            proposalId,
            userId,
            reason,
            enableOptimisticUpdate = true,
            proposerName,
            maxRetries = 3,
            swapTargetId,
        }: {
            proposalId: string;
            userId: string;
            reason?: string;
            enableOptimisticUpdate?: boolean;
            proposerName?: string;
            maxRetries?: number;
            swapTargetId?: string;
        },
        { dispatch, getState }
    ) => {
        const state = getState() as RootState;

        // Check if operation is already in progress
        const existingOperation = state.proposalAcceptance.activeOperations[proposalId];
        if (existingOperation?.loading) {
            const error = new Error('Operation already in progress for this proposal');
            logger.warn('Duplicate proposal rejection attempt', { proposalId, userId });
            throw error;
        }

        const request: CreateProposalResponseRequest = {
            proposalId,
            responderId: userId,
            action: 'reject',
            reason,
            ...(swapTargetId && { swapTargetId }), // Include swapTargetId if provided
        } as any;

        let lastError: any;
        let attempt = 0;

        while (attempt <= maxRetries) {
            try {
                // Start operation with optimistic update (only on first attempt)
                if (attempt === 0) {
                    dispatch(startProposalOperation({
                        proposalId,
                        action: 'reject',
                        optimisticStatus: enableOptimisticUpdate ? 'rejected' : undefined,
                    }));

                    // Add optimistic update if enabled
                    if (enableOptimisticUpdate) {
                        dispatch(addOptimisticRejection(proposalId));
                    }
                }

                logger.info('Attempting to reject proposal', {
                    proposalId,
                    userId,
                    reason,
                    attempt: attempt + 1,
                    maxRetries: maxRetries + 1
                });

                // Make API call
                const result = await proposalAcceptanceAPIAdapter.rejectProposal(request);

                logger.info('Proposal rejected successfully', {
                    proposalId,
                    userId,
                    reason,
                    attempt: attempt + 1
                });

                // Complete operation
                dispatch(completeProposalOperation({ proposalId, result }));

                // Update proposal in main proposal state
                if (result.proposal) {
                    dispatch(updateProposal(result.proposal));
                }

                // Remove optimistic update
                if (enableOptimisticUpdate) {
                    dispatch(removeOptimisticUpdate(proposalId));
                }

                // Invalidate proposal cache to refresh data
                dispatch(invalidateProposalCache());

                // Create success notification
                const successNotification = ProposalNotificationService.createRejectionSuccessNotification(
                    proposalId,
                    proposerName,
                    reason
                );
                dispatch(addNotification(successNotification));
                ProposalNotificationService.logNotificationCreated(successNotification);

                // Create blockchain notification if transaction was recorded
                if (result.blockchainTransaction) {
                    const blockchainNotification = ProposalNotificationService.createBlockchainTransactionNotification(
                        proposalId,
                        result.blockchainTransaction.transactionId,
                        'reject',
                        result.blockchainTransaction.consensusTimestamp
                    );
                    dispatch(addNotification(blockchainNotification));
                    ProposalNotificationService.logNotificationCreated(blockchainNotification);
                }

                // If this was a retry, create retry success notification
                if (attempt > 0) {
                    const retryNotification = ProposalNotificationService.createRetrySuccessNotification(
                        proposalId,
                        'reject',
                        proposerName
                    );
                    dispatch(addNotification(retryNotification));
                    ProposalNotificationService.logNotificationCreated(retryNotification);
                }

                return result;
            } catch (error: any) {
                lastError = error;
                attempt++;

                logger.error('Proposal rejection attempt failed', {
                    proposalId,
                    userId,
                    reason,
                    attempt,
                    maxRetries: maxRetries + 1,
                    error: error.message,
                    status: error.response?.status,
                    errorCode: error.response?.data?.error?.code
                });

                // Handle authentication errors immediately (don't retry)
                if (ProposalErrorHandler.shouldRedirectToLogin(error)) {
                    const authNotification = ProposalNotificationService.createAuthenticationErrorNotification();
                    dispatch(addNotification(authNotification));
                    ProposalNotificationService.logNotificationCreated(authNotification);

                    // Trigger login redirect
                    window.dispatchEvent(new CustomEvent('auth:redirect-to-login'));
                    break;
                }

                // Check if error is retryable and we haven't exceeded max retries
                const isRetryable = ProposalErrorHandler.isRetryableError(error);
                if (!isRetryable || attempt > maxRetries) {
                    break;
                }

                // Wait before retrying with exponential backoff
                const retryDelay = ProposalErrorHandler.getRetryDelay(error, attempt);
                logger.info('Retrying proposal rejection', {
                    proposalId,
                    attempt: attempt + 1,
                    retryDelay
                });

                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }

        // All attempts failed, handle the error
        const enhancedError = ProposalErrorHandler.handleApiError(lastError, proposalId);
        const errorMessage = enhancedError.message;

        logger.error('All proposal rejection attempts failed', {
            proposalId,
            userId,
            reason,
            totalAttempts: attempt,
            finalError: errorMessage,
            errorCode: enhancedError.code
        });

        // Get original status for rollback
        const originalProposal = state.proposals.proposalHistory.find((p: any) => p.id === proposalId);
        const originalStatus = originalProposal?.status;

        // Fail operation
        dispatch(failProposalOperation({
            proposalId,
            error: errorMessage,
            originalStatus,
        }));

        // Remove optimistic update on failure
        if (enableOptimisticUpdate) {
            dispatch(removeOptimisticUpdate(proposalId));
        }

        // Create error notification
        let errorNotification;
        if (lastError && !lastError.response) {
            // Network error
            errorNotification = ProposalNotificationService.createNetworkErrorNotification(
                proposalId,
                'reject',
                enhancedError.shouldRetry
            );
        } else {
            // General operation error
            errorNotification = ProposalNotificationService.createOperationErrorNotification(
                proposalId,
                'reject',
                errorMessage,
                enhancedError.shouldRetry,
                proposerName
            );
        }

        dispatch(addNotification(errorNotification));
        ProposalNotificationService.logNotificationCreated(errorNotification);

        // Throw the enhanced error
        const finalError = new Error(errorMessage);
        (finalError as any).code = enhancedError.code;
        (finalError as any).shouldRetry = enhancedError.shouldRetry;
        (finalError as any).userAction = enhancedError.userAction;
        throw finalError;
    }
);

/**
 * Batch accept multiple proposals
 */
export const batchAcceptProposals = createAsyncThunk(
    'proposalAcceptance/batchAcceptProposals',
    async (
        {
            proposalIds,
            userId,
        }: {
            proposalIds: string[];
            userId: string;
        },
        { dispatch }
    ) => {
        try {
            dispatch(startBatchOperation({
                proposalIds,
                action: 'accept',
            }));

            const results: Array<{
                proposalId: string;
                result?: ProposalResponseResult;
                error?: string;
            }> = [];

            // Process each proposal
            for (const proposalId of proposalIds) {
                try {
                    const result = await dispatch(acceptProposal({
                        proposalId,
                        userId,
                        enableOptimisticUpdate: false, // Disable for batch operations
                    })).unwrap();

                    results.push({ proposalId, result });
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Failed to accept proposal';
                    results.push({ proposalId, error: errorMessage });
                }
            }

            dispatch(completeBatchOperation({ results }));

            return results;
        } catch (error) {
            dispatch(setGlobalError('Batch acceptance operation failed'));
            throw error;
        }
    }
);

/**
 * Batch reject multiple proposals
 */
export const batchRejectProposals = createAsyncThunk(
    'proposalAcceptance/batchRejectProposals',
    async (
        {
            proposalIds,
            userId,
            reason,
        }: {
            proposalIds: string[];
            userId: string;
            reason?: string;
        },
        { dispatch }
    ) => {
        try {
            dispatch(startBatchOperation({
                proposalIds,
                action: 'reject',
            }));

            const results: Array<{
                proposalId: string;
                result?: ProposalResponseResult;
                error?: string;
            }> = [];

            // Process each proposal
            for (const proposalId of proposalIds) {
                try {
                    const result = await dispatch(rejectProposal({
                        proposalId,
                        userId,
                        reason,
                        enableOptimisticUpdate: false, // Disable for batch operations
                    })).unwrap();

                    results.push({ proposalId, result });
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Failed to reject proposal';
                    results.push({ proposalId, error: errorMessage });
                }
            }

            dispatch(completeBatchOperation({ results }));

            return results;
        } catch (error) {
            dispatch(setGlobalError('Batch rejection operation failed'));
            throw error;
        }
    }
);

/**
 * Retry failed proposal operation with enhanced error handling
 * Implements requirement 6.4
 */
export const retryProposalOperation = createAsyncThunk(
    'proposalAcceptance/retryProposalOperation',
    async (
        {
            proposalId,
            userId,
            proposerName,
            reason,
        }: {
            proposalId: string;
            userId: string;
            proposerName?: string;
            reason?: string;
        },
        { dispatch, getState }
    ) => {
        const state = getState() as RootState;
        const operation = state.proposalAcceptance.activeOperations[proposalId];

        if (!operation) {
            const error = new Error('No operation found to retry');
            logger.warn('Retry attempted for non-existent operation', { proposalId, userId });
            throw error;
        }

        logger.info('Retrying proposal operation', {
            proposalId,
            userId,
            action: operation.action,
            originalError: operation.error
        });

        try {
            // Clear the existing error before retrying
            dispatch(failProposalOperation({
                proposalId,
                error: 'Retrying operation...',
                originalStatus: undefined,
            }));

            if (operation.action === 'accept') {
                return await dispatch(acceptProposal({
                    proposalId,
                    userId,
                    proposerName,
                    maxRetries: 2 // Reduced retries for manual retry
                })).unwrap();
            } else {
                return await dispatch(rejectProposal({
                    proposalId,
                    userId,
                    reason,
                    proposerName,
                    maxRetries: 2 // Reduced retries for manual retry
                })).unwrap();
            }
        } catch (error: any) {
            logger.error('Manual retry failed', {
                proposalId,
                userId,
                action: operation.action,
                error: error.message
            });

            // Create retry failure notification
            const retryFailureNotification = ProposalNotificationService.createOperationErrorNotification(
                proposalId,
                operation.action,
                `Retry failed: ${error.message}`,
                false, // Don't allow further retries from notification
                proposerName
            );
            dispatch(addNotification(retryFailureNotification));
            ProposalNotificationService.logNotificationCreated(retryFailureNotification);

            throw error;
        }
    }
);

/**
 * Check proposal status (for real-time updates)
 */
export const checkProposalStatus = createAsyncThunk(
    'proposalAcceptance/checkProposalStatus',
    async (
        proposalId: string,
        { dispatch, getState }
    ) => {
        try {
            const status = await proposalAcceptanceAPIAdapter.getProposalStatus(proposalId);

            // Update proposal if status changed
            const state = getState() as RootState;
            const currentProposal = state.proposals.proposalHistory.find((p: any) => p.id === proposalId);

            if (currentProposal && currentProposal.status !== status.status) {
                dispatch(updateProposal({
                    ...currentProposal,
                    status: status.status as any,
                    updatedAt: status.updatedAt,
                }));
            }

            return status;
        } catch (error) {
            console.error('Failed to check proposal status:', error);
            throw error;
        }
    }
);

/**
 * Monitor multiple proposals for status changes
 */
export const monitorProposalStatuses = createAsyncThunk(
    'proposalAcceptance/monitorProposalStatuses',
    async (
        proposalIds: string[],
        { dispatch }
    ) => {
        const checkInterval = 30000; // 30 seconds

        const checkStatuses = async () => {
            try {
                const statusPromises = proposalIds.map(id =>
                    dispatch(checkProposalStatus(id))
                );

                await Promise.allSettled(statusPromises);
            } catch (error) {
                console.error('Error monitoring proposal statuses:', error);
            }
        };

        // Initial check
        await checkStatuses();

        // Set up interval
        const intervalId = setInterval(checkStatuses, checkInterval);

        return intervalId;
    }
);

/**
 * Cleanup completed operations
 */
export const cleanupCompletedOperations = createAsyncThunk(
    'proposalAcceptance/cleanupCompletedOperations',
    async (_, { dispatch, getState }) => {
        const state = getState() as RootState;
        const operations = state.proposalAcceptance.activeOperations;

        // Remove operations that are completed (no loading, no error)
        Object.entries(operations).forEach(([proposalId, operation]) => {
            if (!operation.loading && !operation.error) {
                dispatch(removeCompletedOperation(proposalId));
            }
        });

        // Clean up old success operations (older than 5 minutes)
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        dispatch(removeOldSuccessOperations(fiveMinutesAgo));

        return true;
    }
);

/**
 * Rollback failed operation
 */
export const rollbackFailedOperation = createAsyncThunk(
    'proposalAcceptance/rollbackFailedOperation',
    async (
        proposalId: string,
        { dispatch, getState }
    ) => {
        const state = getState() as RootState;
        const rollbackData = state.proposalAcceptance.rollbackData[proposalId];

        if (!rollbackData) {
            throw new Error('No rollback data found for this proposal');
        }

        try {
            // Find the proposal and restore original status
            const proposal = state.proposals.proposalHistory.find((p: any) => p.id === proposalId);
            if (proposal) {
                dispatch(updateProposal({
                    ...proposal,
                    status: rollbackData.originalStatus as any,
                    updatedAt: new Date(),
                }));
            }

            // Clear rollback data
            dispatch(clearRollbackData(proposalId));

            // Remove the failed operation
            dispatch(removeCompletedOperation(proposalId));

            return true;
        } catch (error) {
            console.error('Failed to rollback operation:', error);
            throw error;
        }
    }
);

// Export additional action creators for direct use
export {
    startProposalOperation,
    completeProposalOperation,
    failProposalOperation,
    addOptimisticAcceptance,
    addOptimisticRejection,
    removeOptimisticUpdate,
    setGlobalLoading,
    setGlobalError,
} from '../slices/proposalAcceptanceSlice';