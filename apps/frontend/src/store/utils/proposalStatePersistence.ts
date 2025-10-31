import { ProposalSummary } from '@booking-swap/shared';

/**
 * Interface for persisted proposal state
 */
interface PersistedProposalState {
    proposals: ProposalSummary[];
    receivedProposals: ProposalSummary[];
    sentProposals: ProposalSummary[];
    lastUpdateTime: number;
    optimisticUpdates: {
        acceptedProposals: string[];
        rejectedProposals: string[];
    };
    version: string;
}

/**
 * Storage keys for different types of proposal data
 */
const STORAGE_KEYS = {
    PROPOSAL_STATE: 'proposalState',
    PROPOSAL_CACHE: 'proposalCache',
    USER_PREFERENCES: 'proposalUserPreferences',
} as const;

/**
 * Current version for state migration
 */
const CURRENT_VERSION = '1.0.0';

/**
 * Maximum age for cached data (1 hour)
 */
const MAX_CACHE_AGE = 60 * 60 * 1000;

/**
 * Maximum number of proposals to persist
 */
const MAX_PROPOSALS_TO_PERSIST = 100;

/**
 * Utility class for persisting proposal state to localStorage
 * Implements requirements 1.5, 2.5, 7.5 for offline support
 */
export class ProposalStatePersistence {
    /**
     * Save proposal state to localStorage
     */
    static saveProposalState(state: {
        proposals: ProposalSummary[];
        receivedProposals: ProposalSummary[];
        sentProposals: ProposalSummary[];
        lastUpdateTime: number | null;
        optimisticUpdates: {
            acceptedProposals: string[];
            rejectedProposals: string[];
        };
    }): void {
        try {
            const persistedState: PersistedProposalState = {
                proposals: state.proposals.slice(0, MAX_PROPOSALS_TO_PERSIST),
                receivedProposals: state.receivedProposals.slice(0, MAX_PROPOSALS_TO_PERSIST),
                sentProposals: state.sentProposals.slice(0, MAX_PROPOSALS_TO_PERSIST),
                lastUpdateTime: state.lastUpdateTime || Date.now(),
                optimisticUpdates: state.optimisticUpdates,
                version: CURRENT_VERSION,
            };

            localStorage.setItem(
                STORAGE_KEYS.PROPOSAL_STATE,
                JSON.stringify(persistedState)
            );
        } catch (error) {
            console.warn('Failed to save proposal state to localStorage:', error);
        }
    }

    /**
     * Load proposal state from localStorage
     */
    static loadProposalState(): PersistedProposalState | null {
        try {
            const storedData = localStorage.getItem(STORAGE_KEYS.PROPOSAL_STATE);
            if (!storedData) return null;

            const parsedState: PersistedProposalState = JSON.parse(storedData);

            // Check version compatibility
            if (parsedState.version !== CURRENT_VERSION) {
                console.warn('Proposal state version mismatch, clearing cache');
                this.clearProposalState();
                return null;
            }

            // Check if data is too old
            if (Date.now() - parsedState.lastUpdateTime > MAX_CACHE_AGE) {
                console.info('Proposal state cache expired, clearing');
                this.clearProposalState();
                return null;
            }

            return parsedState;
        } catch (error) {
            console.warn('Failed to load proposal state from localStorage:', error);
            this.clearProposalState();
            return null;
        }
    }

    /**
     * Clear proposal state from localStorage
     */
    static clearProposalState(): void {
        try {
            localStorage.removeItem(STORAGE_KEYS.PROPOSAL_STATE);
        } catch (error) {
            console.warn('Failed to clear proposal state from localStorage:', error);
        }
    }

    /**
     * Save proposal cache data
     */
    static saveProposalCache(cacheData: {
        proposalId: string;
        data: any;
        timestamp: number;
    }[]): void {
        try {
            const cacheWithExpiry = {
                data: cacheData,
                timestamp: Date.now(),
                version: CURRENT_VERSION,
            };

            localStorage.setItem(
                STORAGE_KEYS.PROPOSAL_CACHE,
                JSON.stringify(cacheWithExpiry)
            );
        } catch (error) {
            console.warn('Failed to save proposal cache:', error);
        }
    }

    /**
     * Load proposal cache data
     */
    static loadProposalCache(): any[] {
        try {
            const storedCache = localStorage.getItem(STORAGE_KEYS.PROPOSAL_CACHE);
            if (!storedCache) return [];

            const parsedCache = JSON.parse(storedCache);

            // Check version and age
            if (
                parsedCache.version !== CURRENT_VERSION ||
                Date.now() - parsedCache.timestamp > MAX_CACHE_AGE
            ) {
                this.clearProposalCache();
                return [];
            }

            return parsedCache.data || [];
        } catch (error) {
            console.warn('Failed to load proposal cache:', error);
            this.clearProposalCache();
            return [];
        }
    }

    /**
     * Clear proposal cache
     */
    static clearProposalCache(): void {
        try {
            localStorage.removeItem(STORAGE_KEYS.PROPOSAL_CACHE);
        } catch (error) {
            console.warn('Failed to clear proposal cache:', error);
        }
    }

    /**
     * Save user preferences for proposals
     */
    static saveUserPreferences(preferences: {
        notificationSettings: {
            emailNotifications: boolean;
            pushNotifications: boolean;
            inAppNotifications: boolean;
        };
        displaySettings: {
            defaultView: 'received' | 'sent' | 'all';
            sortBy: 'date' | 'status' | 'title';
            sortOrder: 'asc' | 'desc';
        };
        filterSettings: {
            defaultStatus?: string;
            autoRefresh: boolean;
            refreshInterval: number;
        };
    }): void {
        try {
            const preferencesWithMeta = {
                ...preferences,
                timestamp: Date.now(),
                version: CURRENT_VERSION,
            };

            localStorage.setItem(
                STORAGE_KEYS.USER_PREFERENCES,
                JSON.stringify(preferencesWithMeta)
            );
        } catch (error) {
            console.warn('Failed to save user preferences:', error);
        }
    }

    /**
     * Load user preferences
     */
    static loadUserPreferences(): any | null {
        try {
            const storedPreferences = localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
            if (!storedPreferences) return null;

            const parsedPreferences = JSON.parse(storedPreferences);

            // Check version compatibility
            if (parsedPreferences.version !== CURRENT_VERSION) {
                this.clearUserPreferences();
                return null;
            }

            return parsedPreferences;
        } catch (error) {
            console.warn('Failed to load user preferences:', error);
            this.clearUserPreferences();
            return null;
        }
    }

    /**
     * Clear user preferences
     */
    static clearUserPreferences(): void {
        try {
            localStorage.removeItem(STORAGE_KEYS.USER_PREFERENCES);
        } catch (error) {
            console.warn('Failed to clear user preferences:', error);
        }
    }

    /**
     * Clear all proposal-related data from localStorage
     */
    static clearAllData(): void {
        this.clearProposalState();
        this.clearProposalCache();
        this.clearUserPreferences();
    }

    /**
     * Get storage usage information
     */
    static getStorageInfo(): {
        proposalStateSize: number;
        proposalCacheSize: number;
        userPreferencesSize: number;
        totalSize: number;
    } {
        const getItemSize = (key: string): number => {
            try {
                const item = localStorage.getItem(key);
                return item ? new Blob([item]).size : 0;
            } catch {
                return 0;
            }
        };

        const proposalStateSize = getItemSize(STORAGE_KEYS.PROPOSAL_STATE);
        const proposalCacheSize = getItemSize(STORAGE_KEYS.PROPOSAL_CACHE);
        const userPreferencesSize = getItemSize(STORAGE_KEYS.USER_PREFERENCES);

        return {
            proposalStateSize,
            proposalCacheSize,
            userPreferencesSize,
            totalSize: proposalStateSize + proposalCacheSize + userPreferencesSize,
        };
    }

    /**
     * Migrate data from older versions
     */
    static migrateData(): void {
        try {
            // Check for old version data and migrate if necessary
            const oldData = localStorage.getItem('oldProposalState');
            if (oldData) {
                console.info('Migrating proposal state from older version');
                // Perform migration logic here
                localStorage.removeItem('oldProposalState');
            }
        } catch (error) {
            console.warn('Failed to migrate proposal data:', error);
        }
    }

    /**
     * Validate stored data integrity
     */
    static validateStoredData(): boolean {
        try {
            const state = this.loadProposalState();
            if (!state) return true; // No data to validate

            // Basic validation checks
            const isValidArray = (arr: any): boolean => Array.isArray(arr);
            const isValidTimestamp = (ts: any): boolean =>
                typeof ts === 'number' && ts > 0 && ts <= Date.now();

            return (
                isValidArray(state.proposals) &&
                isValidArray(state.receivedProposals) &&
                isValidArray(state.sentProposals) &&
                isValidTimestamp(state.lastUpdateTime) &&
                typeof state.optimisticUpdates === 'object' &&
                isValidArray(state.optimisticUpdates.acceptedProposals) &&
                isValidArray(state.optimisticUpdates.rejectedProposals)
            );
        } catch (error) {
            console.warn('Data validation failed:', error);
            return false;
        }
    }

    /**
     * Repair corrupted data
     */
    static repairData(): void {
        if (!this.validateStoredData()) {
            console.warn('Corrupted proposal data detected, clearing storage');
            this.clearAllData();
        }
    }
}

export default ProposalStatePersistence;