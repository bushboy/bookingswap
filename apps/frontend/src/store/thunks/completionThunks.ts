import { createAsyncThunk } from '@reduxjs/toolkit';
import { CompletionAPI } from '../../services/completionAPI';
import {
    CompletionStatus,
    CompletionAuditRecord,
    CompletionValidationResult,
    OptimisticCompletionUpdate,
    setCompletionStatus,
    updateCompletionStatus,
    setValidationResult,
    addOptimisticUpdate,
    removeOptimisticUpdate,
    rollbackOptimisticUpdate,
    setLoading,
    setError,
} from '../slices/completionSlice';
import { RootState } from '../index';

// Fetch completion status for a proposal
export const fetchCompletionStatus = createAsyncThunk<
    CompletionStatus | null,
    string,
    { state: RootState }
>(
    'completion/fetchStatus',
    async (proposalId, { rejectWithValue }) => {
        try {
            const response = await CompletionAPI.getCompletionStatus(proposalId);
            if (!response) {
                return null;
            }

            // Convert API response to slice CompletionStatus format
            return {
                completionId: response.id,
                proposalId,
                status: response.status,
                completionType: response.completionType,
                initiatedBy: 'system', // Default value since API doesn't provide this
                completedAt: response.completedAt,
                affectedSwaps: response.completedSwaps?.map(s => s.swapId) || [],
                affectedBookings: response.updatedBookings?.map(b => b.bookingId) || [],
                blockchainTransactionId: response.blockchainTransactionId,
                errorDetails: response.errorDetails,
            };
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch completion status');
        }
    }
);

// Fetch completion audit trail
export const fetchCompletionAudit = createAsyncThunk<
    CompletionAuditRecord,
    string,
    { state: RootState }
>(
    'completion/fetchAudit',
    async (completionId, { rejectWithValue }) => {
        try {
            const auditData = await CompletionAPI.getCompletionAudit(completionId);

            // Convert SwapCompletionAudit to CompletionAuditRecord format
            return {
                completionId: auditData.id,
                proposalId: auditData.proposalId || '',
                completionType: auditData.completionType,
                initiatedBy: auditData.initiatedBy,
                completedAt: auditData.completedAt,
                affectedSwaps: auditData.affectedSwaps || [],
                affectedBookings: auditData.affectedBookings || [],
                databaseTransactionId: auditData.databaseTransactionId || '',
                blockchainTransactionId: auditData.blockchainTransactionId,
                status: auditData.status,
                errorDetails: auditData.errorDetails,
            };
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch completion audit');
        }
    }
);

// Validate completion consistency
export const validateCompletion = createAsyncThunk<
    CompletionValidationResult,
    {
        proposalId: string;
        swapIds?: string[];
        bookingIds?: string[];
    },
    { state: RootState }
>(
    'completion/validate',
    async ({ proposalId, swapIds, bookingIds }, { dispatch, rejectWithValue }) => {
        try {
            dispatch(setLoading(true));

            const validationResult = await CompletionAPI.validateCompletion({
                swapIds: swapIds || [],
                bookingIds: bookingIds || [],
                proposalIds: [proposalId],
            });

            // Store validation result
            dispatch(setValidationResult({ proposalId, result: validationResult }));

            return validationResult;
        } catch (error: any) {
            const errorMessage = error.response?.data?.message || 'Failed to validate completion';
            dispatch(setError(errorMessage));
            return rejectWithValue(errorMessage);
        } finally {
            dispatch(setLoading(false));
        }
    }
);

// Start optimistic completion update
export const startOptimisticCompletion = createAsyncThunk<
    void,
    {
        proposalId: string;
        completionType: 'booking_exchange' | 'cash_payment';
        expectedSwapUpdates: Array<{ swapId: string; expectedStatus: string }>;
        expectedBookingUpdates: Array<{ bookingId: string; expectedStatus: string }>;
    },
    { state: RootState }
>(
    'completion/startOptimistic',
    async (params, { dispatch }) => {
        const optimisticUpdate: OptimisticCompletionUpdate = {
            ...params,
            timestamp: new Date(),
        };

        dispatch(addOptimisticUpdate(optimisticUpdate));

        // Create initial completion status
        const completionStatus: CompletionStatus = {
            completionId: `temp-${Date.now()}`,
            proposalId: params.proposalId,
            status: 'initiated',
            completionType: params.completionType,
            initiatedBy: 'current-user', // This would come from auth state
            affectedSwaps: params.expectedSwapUpdates.map(u => u.swapId),
            affectedBookings: params.expectedBookingUpdates.map(u => u.bookingId),
        };

        dispatch(setCompletionStatus({
            proposalId: params.proposalId,
            status: completionStatus
        }));
    }
);

// Complete optimistic update (success)
export const completeOptimisticUpdate = createAsyncThunk<
    void,
    {
        proposalId: string;
        completionResult: {
            completionId: string;
            blockchainTransactionId?: string;
            completedAt: Date;
        };
    },
    { state: RootState }
>(
    'completion/completeOptimistic',
    async ({ proposalId, completionResult }, { dispatch }) => {
        // Remove optimistic update
        dispatch(removeOptimisticUpdate(proposalId));

        // Update completion status to completed
        dispatch(updateCompletionStatus({
            proposalId,
            updates: {
                completionId: completionResult.completionId,
                status: 'completed',
                completedAt: completionResult.completedAt,
                blockchainTransactionId: completionResult.blockchainTransactionId,
            },
        }));
    }
);

// Rollback optimistic update (failure)
export const rollbackOptimisticCompletion = createAsyncThunk<
    void,
    {
        proposalId: string;
        error: string;
    },
    { state: RootState }
>(
    'completion/rollbackOptimistic',
    async ({ proposalId, error }, { dispatch }) => {
        dispatch(rollbackOptimisticUpdate({ proposalId, error }));
    }
);

// Fetch multiple completion statuses
export const fetchMultipleCompletionStatuses = createAsyncThunk<
    Array<{ proposalId: string; status: CompletionStatus | null }>,
    string[],
    { state: RootState }
>(
    'completion/fetchMultipleStatuses',
    async (proposalIds, { rejectWithValue }) => {
        try {
            const promises = proposalIds.map(async (proposalId) => {
                const apiStatus = await CompletionAPI.getCompletionStatus(proposalId);

                if (!apiStatus) {
                    return { proposalId, status: null };
                }

                // Convert API response to slice CompletionStatus format
                const status: CompletionStatus = {
                    completionId: apiStatus.id,
                    proposalId,
                    status: apiStatus.status,
                    completionType: apiStatus.completionType,
                    initiatedBy: 'system',
                    completedAt: apiStatus.completedAt,
                    affectedSwaps: apiStatus.completedSwaps?.map(s => s.swapId) || [],
                    affectedBookings: apiStatus.updatedBookings?.map(b => b.bookingId) || [],
                    blockchainTransactionId: apiStatus.blockchainTransactionId,
                    errorDetails: apiStatus.errorDetails,
                };

                return { proposalId, status };
            });

            const results = await Promise.allSettled(promises);

            return results
                .filter((result): result is PromiseFulfilledResult<{ proposalId: string; status: CompletionStatus | null }> =>
                    result.status === 'fulfilled'
                )
                .map(result => result.value);
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch completion statuses');
        }
    }
);

// Fetch completion audit records with pagination
export const fetchCompletionAuditRecords = createAsyncThunk<
    {
        records: CompletionAuditRecord[];
        pagination: {
            page: number;
            totalPages: number;
            totalCount: number;
        };
    },
    {
        page?: number;
        limit?: number;
        proposalId?: string;
        status?: CompletionStatus['status'];
        completionType?: CompletionStatus['completionType'];
    },
    { state: RootState }
>(
    'completion/fetchAuditRecords',
    async (params, { rejectWithValue }) => {
        try {
            // This would be implemented when the audit endpoint is available
            // For now, returning mock data structure
            const mockRecords: CompletionAuditRecord[] = [];

            return {
                records: mockRecords,
                pagination: {
                    page: params.page || 1,
                    totalPages: 1,
                    totalCount: 0,
                },
            };
        } catch (error: any) {
            return rejectWithValue(error.response?.data?.message || 'Failed to fetch audit records');
        }
    }
);

// Monitor completion progress
export const monitorCompletionProgress = createAsyncThunk<
    void,
    string,
    { state: RootState }
>(
    'completion/monitorProgress',
    async (proposalId, { dispatch }) => {
        const pollInterval = 2000; // 2 seconds
        const maxAttempts = 30; // 1 minute total
        let attempts = 0;

        const poll = async (): Promise<void> => {
            try {
                attempts++;

                const apiStatus = await CompletionAPI.getCompletionStatus(proposalId);

                if (apiStatus) {
                    // Convert API response to slice CompletionStatus format
                    const status: CompletionStatus = {
                        completionId: apiStatus.id,
                        proposalId,
                        status: apiStatus.status,
                        completionType: apiStatus.completionType,
                        initiatedBy: 'system',
                        completedAt: apiStatus.completedAt,
                        affectedSwaps: apiStatus.completedSwaps?.map(s => s.swapId) || [],
                        affectedBookings: apiStatus.updatedBookings?.map(b => b.bookingId) || [],
                        blockchainTransactionId: apiStatus.blockchainTransactionId,
                        errorDetails: apiStatus.errorDetails,
                    };

                    dispatch(setCompletionStatus({ proposalId, status }));

                    // Continue polling if still in progress and haven't exceeded max attempts
                    if (status.status === 'initiated' && attempts < maxAttempts) {
                        setTimeout(poll, pollInterval);
                    } else if (status.status === 'initiated' && attempts >= maxAttempts) {
                        // Timeout - mark as potentially stuck
                        dispatch(updateCompletionStatus({
                            proposalId,
                            updates: {
                                errorDetails: 'Completion monitoring timeout - status may be stale',
                            },
                        }));
                    }
                }
            } catch (error) {
                console.error('Error monitoring completion progress:', error);
                // Stop polling on error
            }
        };

        // Start polling
        poll();
    }
);

// Refresh completion data
export const refreshCompletionData = createAsyncThunk<
    void,
    {
        proposalIds?: string[];
        includeAudit?: boolean;
        includeValidation?: boolean;
    },
    { state: RootState }
>(
    'completion/refreshData',
    async ({ proposalIds, includeAudit, includeValidation }, { dispatch, getState }) => {
        try {
            dispatch(setLoading(true));

            const state = getState();
            const targetProposalIds = proposalIds || Object.keys(state.completion.completionStatuses);

            // Fetch completion statuses
            if (targetProposalIds.length > 0) {
                dispatch(fetchMultipleCompletionStatuses(targetProposalIds));
            }

            // Fetch audit records if requested
            if (includeAudit) {
                for (const proposalId of targetProposalIds) {
                    const status = state.completion.completionStatuses[proposalId];
                    if (status?.completionId) {
                        dispatch(fetchCompletionAudit(status.completionId));
                    }
                }
            }

            // Fetch validation results if requested
            if (includeValidation) {
                for (const proposalId of targetProposalIds) {
                    const status = state.completion.completionStatuses[proposalId];
                    if (status) {
                        dispatch(validateCompletion({
                            proposalId,
                            swapIds: status.affectedSwaps,
                            bookingIds: status.affectedBookings,
                        }));
                    }
                }
            }
        } catch (error: any) {
            dispatch(setError(error.message || 'Failed to refresh completion data'));
        } finally {
            dispatch(setLoading(false));
        }
    }
);

// Cleanup stale optimistic updates
export const cleanupStaleOptimisticUpdates = createAsyncThunk<
    void,
    void,
    { state: RootState }
>(
    'completion/cleanupStaleUpdates',
    async (_, { dispatch, getState }) => {
        const state = getState();
        const staleThreshold = 5 * 60 * 1000; // 5 minutes
        const now = Date.now();

        Object.entries(state.completion.optimisticUpdates).forEach(([proposalId, update]) => {
            const updateAge = now - new Date(update.timestamp).getTime();

            if (updateAge > staleThreshold) {
                dispatch(rollbackOptimisticUpdate({
                    proposalId,
                    error: 'Optimistic update timeout - operation may have failed',
                }));
            }
        });
    }
);

// Batch validation for multiple completions
export const batchValidateCompletions = createAsyncThunk<
    Array<{ proposalId: string; result: CompletionValidationResult }>,
    Array<{
        proposalId: string;
        swapIds: string[];
        bookingIds: string[];
    }>,
    { state: RootState }
>(
    'completion/batchValidate',
    async (validationRequests, { dispatch, rejectWithValue }) => {
        try {
            dispatch(setLoading(true));

            const promises = validationRequests.map(async (request) => {
                const result = await CompletionAPI.validateCompletion({
                    swapIds: request.swapIds,
                    bookingIds: request.bookingIds,
                    proposalIds: [request.proposalId],
                });

                return {
                    proposalId: request.proposalId,
                    result,
                };
            });

            const results = await Promise.allSettled(promises);

            const successfulResults = results
                .filter((result): result is PromiseFulfilledResult<{ proposalId: string; result: CompletionValidationResult }> =>
                    result.status === 'fulfilled'
                )
                .map(result => result.value);

            // Store validation results
            successfulResults.forEach(({ proposalId, result }) => {
                dispatch(setValidationResult({ proposalId, result }));
            });

            return successfulResults;
        } catch (error: any) {
            const errorMessage = error.response?.data?.message || 'Failed to batch validate completions';
            dispatch(setError(errorMessage));
            return rejectWithValue(errorMessage);
        } finally {
            dispatch(setLoading(false));
        }
    }
);