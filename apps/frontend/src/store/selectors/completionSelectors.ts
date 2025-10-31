import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../index';
import {
    CompletionStatus,
    CompletionAuditRecord,
    CompletionValidationResult,
    OptimisticCompletionUpdate,
} from '../slices/completionSlice';

// Base selectors
const selectCompletionState = (state: RootState) => state.completion;

// Memoized selectors for completion status and audit information
export const selectCompletionStatuses = createSelector(
    [selectCompletionState],
    (completion) => completion.completionStatuses
);

export const selectAuditRecords = createSelector(
    [selectCompletionState],
    (completion) => completion.auditRecords
);

export const selectValidationResults = createSelector(
    [selectCompletionState],
    (completion) => completion.validationResults
);

export const selectOptimisticUpdates = createSelector(
    [selectCompletionState],
    (completion) => completion.optimisticUpdates
);

// Completion status selectors
export const selectCompletionStatusByProposal = createSelector(
    [selectCompletionStatuses, (_: RootState, proposalId: string) => proposalId],
    (statuses, proposalId) => statuses[proposalId]
);

export const selectActiveCompletions = createSelector(
    [selectCompletionStatuses],
    (statuses) => Object.values(statuses).filter(
        status => status.status === 'initiated'
    )
);

export const selectCompletedCompletions = createSelector(
    [selectCompletionStatuses],
    (statuses) => Object.values(statuses).filter(
        status => status.status === 'completed'
    )
);

export const selectFailedCompletions = createSelector(
    [selectCompletionStatuses],
    (statuses) => Object.values(statuses).filter(
        status => status.status === 'failed'
    )
);

export const selectRolledBackCompletions = createSelector(
    [selectCompletionStatuses],
    (statuses) => Object.values(statuses).filter(
        status => status.status === 'rolled_back'
    )
);

// Completion type selectors
export const selectBookingExchangeCompletions = createSelector(
    [selectCompletionStatuses],
    (statuses) => Object.values(statuses).filter(
        status => status.completionType === 'booking_exchange'
    )
);

export const selectCashPaymentCompletions = createSelector(
    [selectCompletionStatuses],
    (statuses) => Object.values(statuses).filter(
        status => status.completionType === 'cash_payment'
    )
);

// Audit trail selectors
export const selectAuditRecordsByProposal = createSelector(
    [selectAuditRecords, (_: RootState, proposalId: string) => proposalId],
    (records, proposalId) => records.filter(record => record.proposalId === proposalId)
);

export const selectAuditRecordByCompletion = createSelector(
    [selectAuditRecords, (_: RootState, completionId: string) => completionId],
    (records, completionId) => records.find(record => record.completionId === completionId)
);

export const selectRecentAuditRecords = createSelector(
    [selectAuditRecords],
    (records) => records
        .slice()
        .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
        .slice(0, 10)
);

// Validation selectors
export const selectValidationResultByProposal = createSelector(
    [selectValidationResults, (_: RootState, proposalId: string) => proposalId],
    (results, proposalId) => results[proposalId]
);

export const selectCompletionsWithValidationErrors = createSelector(
    [selectCompletionStatuses, selectValidationResults],
    (statuses, validationResults) => {
        return Object.entries(statuses)
            .filter(([proposalId, status]) => {
                const validation = validationResults[proposalId];
                return validation && (
                    validation.errors.length > 0 ||
                    validation.inconsistentEntities.length > 0
                );
            })
            .map(([proposalId, status]) => ({
                proposalId,
                status,
                validation: validationResults[proposalId],
            }));
    }
);

export const selectCompletionsWithValidationWarnings = createSelector(
    [selectCompletionStatuses, selectValidationResults],
    (statuses, validationResults) => {
        return Object.entries(statuses)
            .filter(([proposalId, status]) => {
                const validation = validationResults[proposalId];
                return validation && validation.warnings.length > 0;
            })
            .map(([proposalId, status]) => ({
                proposalId,
                status,
                validation: validationResults[proposalId],
            }));
    }
);

// Optimistic update selectors
export const selectOptimisticUpdateByProposal = createSelector(
    [selectOptimisticUpdates, (_: RootState, proposalId: string) => proposalId],
    (updates, proposalId) => updates[proposalId]
);

export const selectHasOptimisticUpdate = createSelector(
    [selectOptimisticUpdates, (_: RootState, proposalId: string) => proposalId],
    (updates, proposalId) => !!updates[proposalId]
);

export const selectActiveOptimisticUpdates = createSelector(
    [selectOptimisticUpdates],
    (updates) => Object.values(updates)
);

// Statistics selectors
export const selectCompletionStatistics = createSelector(
    [selectCompletionStatuses],
    (statuses) => {
        const completions = Object.values(statuses);
        const total = completions.length;
        const successful = completions.filter(c => c.status === 'completed').length;
        const failed = completions.filter(c => c.status === 'failed').length;
        const rolledBack = completions.filter(c => c.status === 'rolled_back').length;
        const active = completions.filter(c => c.status === 'initiated').length;

        const successRate = total > 0 ? (successful / total) * 100 : 0;
        const failureRate = total > 0 ? (failed / total) * 100 : 0;
        const rollbackRate = total > 0 ? (rolledBack / total) * 100 : 0;

        // Calculate average completion time for successful completions
        const successfulWithTimes = completions.filter(
            c => c.status === 'completed' && c.completedAt
        );

        const averageCompletionTime = successfulWithTimes.length > 0
            ? successfulWithTimes.reduce((sum, completion) => {
                // This would need actual initiation time to calculate properly
                // For now, using a placeholder
                return sum + 2000; // 2 seconds average placeholder
            }, 0) / successfulWithTimes.length
            : 0;

        return {
            totalCompletions: total,
            successfulCompletions: successful,
            failedCompletions: failed,
            rolledBackCompletions: rolledBack,
            activeCompletions: active,
            averageCompletionTime,
            successRate,
            failureRate,
            rollbackRate,
        };
    }
);

export const selectCompletionStatsByType = createSelector(
    [selectCompletionStatuses],
    (statuses) => {
        const completions = Object.values(statuses);

        const bookingExchanges = completions.filter(c => c.completionType === 'booking_exchange');
        const cashPayments = completions.filter(c => c.completionType === 'cash_payment');

        return {
            bookingExchange: {
                total: bookingExchanges.length,
                successful: bookingExchanges.filter(c => c.status === 'completed').length,
                failed: bookingExchanges.filter(c => c.status === 'failed').length,
                successRate: bookingExchanges.length > 0
                    ? (bookingExchanges.filter(c => c.status === 'completed').length / bookingExchanges.length) * 100
                    : 0,
            },
            cashPayment: {
                total: cashPayments.length,
                successful: cashPayments.filter(c => c.status === 'completed').length,
                failed: cashPayments.filter(c => c.status === 'failed').length,
                successRate: cashPayments.length > 0
                    ? (cashPayments.filter(c => c.status === 'completed').length / cashPayments.length) * 100
                    : 0,
            },
        };
    }
);

// Entity-specific selectors
export const selectCompletionsBySwap = createSelector(
    [selectCompletionStatuses, (_: RootState, swapId: string) => swapId],
    (statuses, swapId) => Object.values(statuses).filter(
        status => status.affectedSwaps.includes(swapId)
    )
);

export const selectCompletionsByBooking = createSelector(
    [selectCompletionStatuses, (_: RootState, bookingId: string) => bookingId],
    (statuses, bookingId) => Object.values(statuses).filter(
        status => status.affectedBookings.includes(bookingId)
    )
);

// User-specific selectors
export const selectUserCompletions = createSelector(
    [selectCompletionStatuses, (_: RootState, userId: string) => userId],
    (statuses, userId) => Object.values(statuses).filter(
        status => status.initiatedBy === userId
    )
);

export const selectUserCompletionStats = createSelector(
    [selectCompletionStatuses, (_: RootState, userId: string) => userId],
    (statuses, userId) => {
        const userCompletions = Object.values(statuses).filter(
            status => status.initiatedBy === userId
        );

        const total = userCompletions.length;
        const successful = userCompletions.filter(c => c.status === 'completed').length;
        const failed = userCompletions.filter(c => c.status === 'failed').length;
        const active = userCompletions.filter(c => c.status === 'initiated').length;

        return {
            totalCompletions: total,
            successfulCompletions: successful,
            failedCompletions: failed,
            activeCompletions: active,
            successRate: total > 0 ? (successful / total) * 100 : 0,
        };
    }
);

// Time-based selectors
export const selectRecentCompletions = createSelector(
    [selectCompletionStatuses],
    (statuses) => {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        return Object.values(statuses).filter(status => {
            if (!status.completedAt) return false;
            return new Date(status.completedAt) > twentyFourHoursAgo;
        });
    }
);

export const selectCompletionsRequiringAttention = createSelector(
    [selectCompletionStatuses, selectValidationResults],
    (statuses, validationResults) => {
        return Object.entries(statuses)
            .filter(([proposalId, status]) => {
                // Failed completions
                if (status.status === 'failed') return true;

                // Completions with validation errors
                const validation = validationResults[proposalId];
                if (validation && validation.errors.length > 0) return true;

                // Completions with inconsistent entities
                if (validation && validation.inconsistentEntities.length > 0) return true;

                return false;
            })
            .map(([proposalId, status]) => ({
                proposalId,
                status,
                validation: validationResults[proposalId],
                requiresAttention: true,
            }));
    }
);

// Cache and loading selectors
export const selectCompletionLoading = createSelector(
    [selectCompletionState],
    (completion) => completion.loading
);

export const selectCompletionError = createSelector(
    [selectCompletionState],
    (completion) => completion.error
);

export const selectLastUpdateTime = createSelector(
    [selectCompletionState],
    (completion) => completion.lastUpdateTime
);

export const selectIsCacheValid = createSelector(
    [selectCompletionState],
    (completion) => {
        if (!completion.lastFetchTime) return false;
        return Date.now() - completion.lastFetchTime < completion.cacheExpiry;
    }
);

// Complex derived selectors
export const selectCompletionDashboardData = createSelector(
    [
        selectCompletionStatistics,
        selectActiveCompletions,
        selectFailedCompletions,
        selectCompletionsRequiringAttention,
        selectRecentCompletions,
    ],
    (stats, active, failed, requiresAttention, recent) => ({
        statistics: stats,
        activeCompletions: active,
        failedCompletions: failed,
        completionsRequiringAttention: requiresAttention,
        recentActivity: recent,
    })
);

export const selectCompletionHealthStatus = createSelector(
    [selectCompletionStatistics, selectFailedCompletions, selectActiveCompletions],
    (stats, failed, active) => {
        const recentFailures = failed.filter(completion => {
            if (!completion.completedAt) return false;
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            return new Date(completion.completedAt) > oneHourAgo;
        });

        const longRunningActive = active.filter(completion => {
            // Assuming we had initiation time, check for completions running > 5 minutes
            // For now, using a placeholder
            return false;
        });

        let healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy';

        if (recentFailures.length > 5 || longRunningActive.length > 10) {
            healthStatus = 'critical';
        } else if (recentFailures.length > 2 || longRunningActive.length > 5 || stats.successRate < 90) {
            healthStatus = 'warning';
        }

        return {
            status: healthStatus,
            recentFailures: recentFailures.length,
            longRunningActive: longRunningActive.length,
            successRate: stats.successRate,
            totalActive: active.length,
        };
    }
);