/**
 * Proposal Data Caching Service
 * 
 * Implements caching and performance optimization for proposal data
 * Requirements: 3.1, 3.4, 4.5
 */

import { SwapProposal, ProposalUpdate } from './proposalDataService';
import { ComponentCache } from '@/utils/performanceOptimizations';
import { logger } from '@/utils/logger';

/**
 * Cache configuration for different types of proposal data
 */
const PROPOSAL_CACHE_CONFIG = {
    maxAge: 30 * 1000, // 30 seconds for proposal data (short due to real-time nature)
    maxSize: 200, // Support many proposals
    strategy: 'lru' as const,
};

const USER_PROPOSALS_CACHE_CONFIG = {
    maxAge: 15 * 1000, // 15 seconds for user proposal lists
    maxSize: 50, // Support many users
    strategy: 'lru' as const,
};

const PROPOSAL_DETAILS_CACHE_CONFIG = {
    maxAge: 60 * 1000, // 1 minute for individual proposal details
    maxSize: 100,
    strategy: 'lru' as const,
};

/**
 * Cache entry metadata for tracking and optimization
 */
interface CacheEntry<T> {
    data: T;
    timestamp: number;
    lastAccessed: number;
    accessCount: number;
    userId?: string;
    proposalId?: string;
}

/**
 * Cache invalidation reasons for debugging and analytics
 */
type InvalidationReason =
    | 'proposal_accepted'
    | 'proposal_rejected'
    | 'proposal_expired'
    | 'user_action'
    | 'real_time_update'
    | 'manual_refresh'
    | 'cache_timeout';

/**
 * Enhanced cache with proposal-specific features
 */
class ProposalCache<T> extends ComponentCache<T> {
    private metadata: Map<string, CacheEntry<T>> = new Map();
    private invalidationLog: Array<{
        key: string;
        reason: InvalidationReason;
        timestamp: number;
    }> = [];

    constructor(config: any) {
        super(config);
    }

    set(key: string, data: T, metadata?: Partial<CacheEntry<T>>): void {
        super.set(key, data);

        this.metadata.set(key, {
            data,
            timestamp: Date.now(),
            lastAccessed: Date.now(),
            accessCount: 0,
            ...metadata,
        });

        logger.debug('Proposal cache entry set', { key, hasMetadata: !!metadata });
    }

    get(key: string): T | null {
        const data = super.get(key);

        if (data && this.metadata.has(key)) {
            const entry = this.metadata.get(key)!;
            entry.lastAccessed = Date.now();
            entry.accessCount++;
        }

        return data;
    }

    invalidate(key: string, reason: InvalidationReason): boolean {
        const deleted = this.delete(key);
        this.metadata.delete(key);

        if (deleted) {
            this.invalidationLog.push({
                key,
                reason,
                timestamp: Date.now(),
            });

            // Keep only last 100 invalidation logs
            if (this.invalidationLog.length > 100) {
                this.invalidationLog = this.invalidationLog.slice(-100);
            }

            logger.debug('Cache entry invalidated', { key, reason });
        }

        return deleted;
    }

    invalidateByUserId(userId: string, reason: InvalidationReason): number {
        let invalidatedCount = 0;

        for (const [key, entry] of this.metadata.entries()) {
            if (entry.userId === userId) {
                if (this.invalidate(key, reason)) {
                    invalidatedCount++;
                }
            }
        }

        logger.debug('Cache entries invalidated by user', { userId, count: invalidatedCount, reason });
        return invalidatedCount;
    }

    invalidateByProposalId(proposalId: string, reason: InvalidationReason): number {
        let invalidatedCount = 0;

        for (const [key, entry] of this.metadata.entries()) {
            if (entry.proposalId === proposalId || key.includes(proposalId)) {
                if (this.invalidate(key, reason)) {
                    invalidatedCount++;
                }
            }
        }

        logger.debug('Cache entries invalidated by proposal', { proposalId, count: invalidatedCount, reason });
        return invalidatedCount;
    }

    getStats() {
        const entries = Array.from(this.metadata.values());
        const now = Date.now();

        return {
            totalEntries: entries.length,
            averageAge: entries.length > 0
                ? entries.reduce((sum, entry) => sum + (now - entry.timestamp), 0) / entries.length
                : 0,
            totalAccesses: entries.reduce((sum, entry) => sum + entry.accessCount, 0),
            recentInvalidations: this.invalidationLog.filter(log => now - log.timestamp < 60000).length,
            invalidationReasons: this.invalidationLog.reduce((acc, log) => {
                acc[log.reason] = (acc[log.reason] || 0) + 1;
                return acc;
            }, {} as Record<InvalidationReason, number>),
        };
    }

    clear(): void {
        super.clear();
        this.metadata.clear();
        this.invalidationLog = [];
        logger.debug('Proposal cache cleared');
    }
}

/**
 * Cache keys for different types of proposal data
 */
export const ProposalCacheKeys = {
    userProposals: (userId: string) => `user-proposals-${userId}`,
    proposalDetails: (proposalId: string) => `proposal-details-${proposalId}`,
    proposalStatus: (proposalId: string) => `proposal-status-${proposalId}`,
    proposalsByStatus: (userId: string, status: string) => `user-proposals-${userId}-${status}`,
};

/**
 * Proposal Cache Service
 * 
 * Manages caching for proposal data with intelligent invalidation
 * and performance optimization features
 */
export class ProposalCacheService {
    private static instance: ProposalCacheService;

    private userProposalsCache = new ProposalCache<SwapProposal[]>(USER_PROPOSALS_CACHE_CONFIG);
    private proposalDetailsCache = new ProposalCache<SwapProposal>(PROPOSAL_DETAILS_CACHE_CONFIG);
    private proposalStatusCache = new ProposalCache<{ status: string; updatedAt: Date }>(PROPOSAL_CACHE_CONFIG);

    // Debouncing for rapid operations
    private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
    private pendingInvalidations: Set<string> = new Set();

    static getInstance(): ProposalCacheService {
        if (!ProposalCacheService.instance) {
            ProposalCacheService.instance = new ProposalCacheService();
        }
        return ProposalCacheService.instance;
    }

    /**
     * Cache user proposals with metadata
     */
    cacheUserProposals(userId: string, proposals: SwapProposal[]): void {
        const key = ProposalCacheKeys.userProposals(userId);

        this.userProposalsCache.set(key, proposals, {
            userId,
            timestamp: Date.now(),
            lastAccessed: Date.now(),
            accessCount: 0,
        });

        // Also cache individual proposal details
        proposals.forEach(proposal => {
            this.cacheProposalDetails(proposal);
        });

        logger.debug('User proposals cached', { userId, count: proposals.length });
    }

    /**
     * Get cached user proposals
     */
    getCachedUserProposals(userId: string): SwapProposal[] | null {
        const key = ProposalCacheKeys.userProposals(userId);
        return this.userProposalsCache.get(key);
    }

    /**
     * Cache individual proposal details
     */
    cacheProposalDetails(proposal: SwapProposal): void {
        const key = ProposalCacheKeys.proposalDetails(proposal.id);

        this.proposalDetailsCache.set(key, proposal, {
            proposalId: proposal.id,
            userId: proposal.targetUserId,
            timestamp: Date.now(),
            lastAccessed: Date.now(),
            accessCount: 0,
        });

        // Cache status separately for quick access
        this.proposalStatusCache.set(
            ProposalCacheKeys.proposalStatus(proposal.id),
            {
                status: proposal.status,
                updatedAt: proposal.updatedAt,
            },
            {
                proposalId: proposal.id,
                timestamp: Date.now(),
                lastAccessed: Date.now(),
                accessCount: 0,
            }
        );
    }

    /**
     * Get cached proposal details
     */
    getCachedProposalDetails(proposalId: string): SwapProposal | null {
        const key = ProposalCacheKeys.proposalDetails(proposalId);
        return this.proposalDetailsCache.get(key);
    }

    /**
     * Get cached proposal status
     */
    getCachedProposalStatus(proposalId: string): { status: string; updatedAt: Date } | null {
        const key = ProposalCacheKeys.proposalStatus(proposalId);
        return this.proposalStatusCache.get(key);
    }

    /**
     * Invalidate cache when proposals are accepted or rejected
     * Implements requirement 3.4
     */
    invalidateOnProposalAction(proposalId: string, userId: string, action: 'accept' | 'reject'): void {
        const reason: InvalidationReason = action === 'accept' ? 'proposal_accepted' : 'proposal_rejected';

        // Invalidate specific proposal
        this.proposalDetailsCache.invalidateByProposalId(proposalId, reason);
        this.proposalStatusCache.invalidateByProposalId(proposalId, reason);

        // Invalidate user's proposal list
        this.userProposalsCache.invalidateByUserId(userId, reason);

        logger.info('Cache invalidated for proposal action', { proposalId, userId, action });
    }

    /**
     * Handle real-time proposal updates
     * Implements requirement 3.1
     */
    handleRealTimeUpdate(update: ProposalUpdate): void {
        const { proposalId } = update;

        // Update cached proposal details if they exist
        const cachedProposal = this.getCachedProposalDetails(proposalId);
        if (cachedProposal) {
            const updatedProposal: SwapProposal = {
                ...cachedProposal,
                status: update.status,
                updatedAt: update.updatedAt,
                respondedBy: update.respondedBy,
                rejectionReason: update.rejectionReason,
            };

            this.cacheProposalDetails(updatedProposal);
        }

        // Update cached status
        this.proposalStatusCache.set(
            ProposalCacheKeys.proposalStatus(proposalId),
            {
                status: update.status,
                updatedAt: update.updatedAt,
            }
        );

        // Invalidate user proposal lists that might contain this proposal
        // We don't know the exact user, so we invalidate all user caches
        // In a real implementation, we might track which users have which proposals
        this.debounceInvalidation('all-user-proposals', () => {
            this.userProposalsCache.clear();
        }, 1000); // Debounce for 1 second

        logger.debug('Cache updated for real-time proposal update', { proposalId, status: update.status });
    }

    /**
     * Debounced invalidation to prevent excessive cache clearing
     * Implements performance optimization for rapid user actions
     */
    private debounceInvalidation(key: string, invalidationFn: () => void, delay: number): void {
        // Clear existing timer
        if (this.debounceTimers.has(key)) {
            clearTimeout(this.debounceTimers.get(key)!);
        }

        // Set new timer
        const timer = setTimeout(() => {
            invalidationFn();
            this.debounceTimers.delete(key);
            this.pendingInvalidations.delete(key);
        }, delay);

        this.debounceTimers.set(key, timer);
        this.pendingInvalidations.add(key);
    }

    /**
     * Invalidate cache for manual refresh
     */
    invalidateForRefresh(userId?: string): void {
        if (userId) {
            this.userProposalsCache.invalidateByUserId(userId, 'manual_refresh');
        } else {
            this.userProposalsCache.clear();
            this.proposalDetailsCache.clear();
            this.proposalStatusCache.clear();
        }

        logger.info('Cache invalidated for manual refresh', { userId });
    }

    /**
     * Preload proposal data for better performance
     */
    async preloadProposalData(userId: string, proposalDataService: any): Promise<void> {
        try {
            // Check if data is already cached
            if (this.getCachedUserProposals(userId)) {
                logger.debug('Proposal data already cached, skipping preload', { userId });
                return;
            }

            logger.debug('Preloading proposal data', { userId });
            const proposals = await proposalDataService.getUserProposals(userId);
            this.cacheUserProposals(userId, proposals);

            logger.info('Proposal data preloaded successfully', { userId, count: proposals.length });
        } catch (error) {
            logger.error('Failed to preload proposal data', { userId, error });
        }
    }

    /**
     * Get comprehensive cache statistics
     */
    getCacheStats() {
        return {
            userProposals: this.userProposalsCache.getStats(),
            proposalDetails: this.proposalDetailsCache.getStats(),
            proposalStatus: this.proposalStatusCache.getStats(),
            pendingInvalidations: this.pendingInvalidations.size,
            activeDebounceTimers: this.debounceTimers.size,
        };
    }

    /**
     * Clear all caches
     */
    clearAllCaches(): void {
        this.userProposalsCache.clear();
        this.proposalDetailsCache.clear();
        this.proposalStatusCache.clear();

        // Clear debounce timers
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
        this.pendingInvalidations.clear();

        logger.info('All proposal caches cleared');
    }

    /**
     * Cleanup expired entries and optimize cache performance
     */
    performMaintenance(): void {
        const stats = this.getCacheStats();

        logger.debug('Performing cache maintenance', {
            userProposalsEntries: stats.userProposals.totalEntries,
            proposalDetailsEntries: stats.proposalDetails.totalEntries,
            proposalStatusEntries: stats.proposalStatus.totalEntries,
        });

        // The ComponentCache base class handles TTL cleanup automatically
        // This method can be extended for additional maintenance tasks
    }
}

// Export singleton instance
export const proposalCacheService = ProposalCacheService.getInstance();
export default proposalCacheService;