import {
    CompletionStatus,
    CompletionAuditRecord,
    CompletionValidationResult,
    OptimisticCompletionUpdate,
} from '../slices/completionSlice';

interface PersistedCompletionState {
    completionStatuses: Record<string, CompletionStatus>;
    auditRecords: CompletionAuditRecord[];
    validationResults: Record<string, CompletionValidationResult>;
    optimisticUpdates: Record<string, OptimisticCompletionUpdate>;
    lastUpdateTime: number | null;
    version: number;
    timestamp: number;
}

const STORAGE_KEY = 'completion_state';
const STORAGE_VERSION = 1;
const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
const MAX_AUDIT_RECORDS = 100; // Limit stored audit records
const MAX_COMPLETION_STATUSES = 200; // Limit stored completion statuses

export class CompletionStatePersistence {
    /**
     * Save completion state to localStorage
     */
    static saveCompletionState(state: Partial<PersistedCompletionState>): void {
        try {
            const persistedState: PersistedCompletionState = {
                completionStatuses: state.completionStatuses || {},
                auditRecords: state.auditRecords || [],
                validationResults: state.validationResults || {},
                optimisticUpdates: state.optimisticUpdates || {},
                lastUpdateTime: state.lastUpdateTime || Date.now(),
                version: STORAGE_VERSION,
                timestamp: Date.now(),
            };

            // Limit the size of stored data
            persistedState.auditRecords = persistedState.auditRecords
                .slice(0, MAX_AUDIT_RECORDS);

            // Keep only recent completion statuses
            const completionEntries = Object.entries(persistedState.completionStatuses);
            if (completionEntries.length > MAX_COMPLETION_STATUSES) {
                const sortedEntries = completionEntries
                    .sort(([, a], [, b]) => {
                        const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
                        const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
                        return bTime - aTime; // Most recent first
                    })
                    .slice(0, MAX_COMPLETION_STATUSES);

                persistedState.completionStatuses = Object.fromEntries(sortedEntries);
            }

            localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));
        } catch (error) {
            console.warn('Failed to save completion state to localStorage:', error);
        }
    }

    /**
     * Load completion state from localStorage
     */
    static loadCompletionState(): PersistedCompletionState | null {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) return null;

            const parsed: PersistedCompletionState = JSON.parse(stored);

            // Check version compatibility
            if (parsed.version !== STORAGE_VERSION) {
                console.warn('Completion state version mismatch, clearing stored data');
                this.clearCompletionState();
                return null;
            }

            // Check if data is too old
            if (Date.now() - parsed.timestamp > MAX_AGE) {
                console.warn('Completion state is too old, clearing stored data');
                this.clearCompletionState();
                return null;
            }

            // Validate data structure
            if (!this.validateStoredData(parsed)) {
                console.warn('Invalid completion state data, clearing stored data');
                this.clearCompletionState();
                return null;
            }

            return parsed;
        } catch (error) {
            console.warn('Failed to load completion state from localStorage:', error);
            this.clearCompletionState();
            return null;
        }
    }

    /**
     * Clear completion state from localStorage
     */
    static clearCompletionState(): void {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (error) {
            console.warn('Failed to clear completion state from localStorage:', error);
        }
    }

    /**
     * Validate stored data structure
     */
    private static validateStoredData(data: any): data is PersistedCompletionState {
        if (!data || typeof data !== 'object') return false;

        // Check required fields
        if (
            !data.hasOwnProperty('completionStatuses') ||
            !data.hasOwnProperty('auditRecords') ||
            !data.hasOwnProperty('validationResults') ||
            !data.hasOwnProperty('optimisticUpdates') ||
            !data.hasOwnProperty('version') ||
            !data.hasOwnProperty('timestamp')
        ) {
            return false;
        }

        // Check data types
        if (
            typeof data.completionStatuses !== 'object' ||
            !Array.isArray(data.auditRecords) ||
            typeof data.validationResults !== 'object' ||
            typeof data.optimisticUpdates !== 'object' ||
            typeof data.version !== 'number' ||
            typeof data.timestamp !== 'number'
        ) {
            return false;
        }

        return true;
    }

    /**
     * Repair corrupted data
     */
    static repairData(): void {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) return;

            const parsed = JSON.parse(stored);

            let needsRepair = false;

            // Repair completion statuses
            if (parsed.completionStatuses && typeof parsed.completionStatuses === 'object') {
                Object.entries(parsed.completionStatuses).forEach(([proposalId, status]: [string, any]) => {
                    if (!status || typeof status !== 'object') {
                        delete parsed.completionStatuses[proposalId];
                        needsRepair = true;
                    } else {
                        // Ensure required fields exist
                        if (!status.completionId || !status.proposalId || !status.status) {
                            delete parsed.completionStatuses[proposalId];
                            needsRepair = true;
                        }
                    }
                });
            } else {
                parsed.completionStatuses = {};
                needsRepair = true;
            }

            // Repair audit records
            if (!Array.isArray(parsed.auditRecords)) {
                parsed.auditRecords = [];
                needsRepair = true;
            } else {
                parsed.auditRecords = parsed.auditRecords.filter((record: any) => {
                    return record &&
                        typeof record === 'object' &&
                        record.completionId &&
                        record.proposalId;
                });
            }

            // Repair validation results
            if (!parsed.validationResults || typeof parsed.validationResults !== 'object') {
                parsed.validationResults = {};
                needsRepair = true;
            }

            // Repair optimistic updates
            if (!parsed.optimisticUpdates || typeof parsed.optimisticUpdates !== 'object') {
                parsed.optimisticUpdates = {};
                needsRepair = true;
            }

            // Remove stale optimistic updates (older than 10 minutes)
            const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
            Object.entries(parsed.optimisticUpdates).forEach(([proposalId, update]: [string, any]) => {
                if (!update || !update.timestamp || new Date(update.timestamp).getTime() < tenMinutesAgo) {
                    delete parsed.optimisticUpdates[proposalId];
                    needsRepair = true;
                }
            });

            // Save repaired data if needed
            if (needsRepair) {
                parsed.version = STORAGE_VERSION;
                parsed.timestamp = Date.now();
                localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
                console.log('Repaired completion state data');
            }
        } catch (error) {
            console.warn('Failed to repair completion state data:', error);
            this.clearCompletionState();
        }
    }

    /**
     * Get storage usage information
     */
    static getStorageInfo(): {
        size: number;
        completionCount: number;
        auditRecordCount: number;
        validationResultCount: number;
        optimisticUpdateCount: number;
        lastUpdate: Date | null;
    } {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) {
                return {
                    size: 0,
                    completionCount: 0,
                    auditRecordCount: 0,
                    validationResultCount: 0,
                    optimisticUpdateCount: 0,
                    lastUpdate: null,
                };
            }

            const parsed = JSON.parse(stored);

            return {
                size: new Blob([stored]).size,
                completionCount: Object.keys(parsed.completionStatuses || {}).length,
                auditRecordCount: (parsed.auditRecords || []).length,
                validationResultCount: Object.keys(parsed.validationResults || {}).length,
                optimisticUpdateCount: Object.keys(parsed.optimisticUpdates || {}).length,
                lastUpdate: parsed.lastUpdateTime ? new Date(parsed.lastUpdateTime) : null,
            };
        } catch (error) {
            console.warn('Failed to get completion storage info:', error);
            return {
                size: 0,
                completionCount: 0,
                auditRecordCount: 0,
                validationResultCount: 0,
                optimisticUpdateCount: 0,
                lastUpdate: null,
            };
        }
    }

    /**
     * Clean up old data
     */
    static cleanup(): void {
        try {
            const state = this.loadCompletionState();
            if (!state) return;

            let needsUpdate = false;

            // Remove completed optimistic updates older than 1 hour
            const oneHourAgo = Date.now() - 60 * 60 * 1000;
            Object.entries(state.optimisticUpdates).forEach(([proposalId, update]) => {
                if (new Date(update.timestamp).getTime() < oneHourAgo) {
                    delete state.optimisticUpdates[proposalId];
                    needsUpdate = true;
                }
            });

            // Remove old audit records (keep only last 50)
            if (state.auditRecords.length > 50) {
                state.auditRecords = state.auditRecords
                    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
                    .slice(0, 50);
                needsUpdate = true;
            }

            // Remove old completed completion statuses (keep only last 100)
            const completedStatuses = Object.entries(state.completionStatuses)
                .filter(([, status]) => status.status === 'completed')
                .sort(([, a], [, b]) => {
                    const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
                    const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
                    return bTime - aTime;
                });

            if (completedStatuses.length > 100) {
                const toRemove = completedStatuses.slice(100);
                toRemove.forEach(([proposalId]) => {
                    delete state.completionStatuses[proposalId];
                    delete state.validationResults[proposalId];
                });
                needsUpdate = true;
            }

            if (needsUpdate) {
                this.saveCompletionState(state);
                console.log('Cleaned up old completion state data');
            }
        } catch (error) {
            console.warn('Failed to cleanup completion state data:', error);
        }
    }
}