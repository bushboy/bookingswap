import { AccountId, AccountBalanceQuery, Hbar } from '@hashgraph/sdk';
import { logger } from '../../utils/logger';
import { HederaService } from './HederaService';
import { WalletBalanceRequirement, WalletBalanceValidation } from '@booking-swap/shared';

/**
 * Cache entry for account balance
 */
interface BalanceCacheEntry {
    balance: number;
    timestamp: number;
    ttl: number;
}

/**
 * Service for validating wallet balances on Hedera blockchain
 */
export class HederaBalanceService {
    private balanceCache = new Map<string, BalanceCacheEntry>();
    private readonly DEFAULT_TTL = 30000; // 30 seconds cache TTL

    constructor(private hederaService: HederaService) { }

    /**
     * Get account balance from Hedera blockchain with caching
     */
    async getAccountBalance(accountId: string): Promise<number> {
        try {
            // Check cache first
            const cached = this.getCachedBalance(accountId);
            if (cached !== null) {
                logger.debug('Using cached balance', { accountId, balance: cached });
                return cached;
            }

            // Validate account ID format
            if (!this.isValidAccountId(accountId)) {
                throw new Error(`Invalid account ID format: ${accountId}`);
            }

            // Query balance from Hedera
            const balance = await this.hederaService.getAccountBalance(accountId);
            const balanceInHbar = balance.toTinybars().toNumber() / 100000000; // Convert from tinybars to HBAR

            // Cache the result
            this.cacheBalance(accountId, balanceInHbar, this.DEFAULT_TTL);

            logger.info('Retrieved account balance from Hedera', {
                accountId,
                balance: balanceInHbar,
                currency: 'HBAR'
            });

            return balanceInHbar;
        } catch (error: any) {
            logger.error('Failed to get account balance', {
                error: error.message,
                accountId,
                errorStack: error.stack
            });
            throw new Error(`Failed to retrieve balance for account ${accountId}: ${error.message}`);
        }
    }

    /**
     * Validate if wallet has sufficient balance for requirements
     */
    async validateSufficientBalance(
        accountId: string,
        required: WalletBalanceRequirement
    ): Promise<WalletBalanceValidation> {
        try {
            const currentBalance = await this.getAccountBalance(accountId);
            const isSufficient = currentBalance >= required.totalRequired;
            const shortfall = isSufficient ? undefined : required.totalRequired - currentBalance;

            const validation: WalletBalanceValidation = {
                isSufficient,
                currentBalance,
                requirement: required,
                shortfall,
                errorMessage: isSufficient ? undefined : this.generateInsufficientBalanceMessage(required, currentBalance, shortfall!)
            };

            logger.info('Balance validation completed', {
                accountId,
                isSufficient,
                currentBalance,
                requiredBalance: required.totalRequired,
                shortfall,
                currency: required.currency
            });

            return validation;
        } catch (error: any) {
            logger.error('Balance validation failed', {
                error: error.message,
                accountId,
                required,
                errorStack: error.stack
            });

            return {
                isSufficient: false,
                currentBalance: 0,
                requirement: required,
                errorMessage: `Unable to validate balance: ${error.message}`
            };
        }
    }

    /**
     * Cache balance with TTL
     */
    cacheBalance(accountId: string, balance: number, ttl: number): void {
        const entry: BalanceCacheEntry = {
            balance,
            timestamp: Date.now(),
            ttl
        };

        this.balanceCache.set(accountId, entry);

        logger.debug('Balance cached', {
            accountId,
            balance,
            ttl,
            cacheSize: this.balanceCache.size
        });

        // Clean up expired entries periodically
        this.cleanupExpiredCache();
    }

    /**
     * Get cached balance if valid
     */
    private getCachedBalance(accountId: string): number | null {
        const entry = this.balanceCache.get(accountId);
        if (!entry) {
            return null;
        }

        const now = Date.now();
        const isExpired = (now - entry.timestamp) > entry.ttl;

        if (isExpired) {
            this.balanceCache.delete(accountId);
            logger.debug('Cache entry expired and removed', { accountId });
            return null;
        }

        return entry.balance;
    }

    /**
     * Clean up expired cache entries
     */
    private cleanupExpiredCache(): void {
        const now = Date.now();
        let removedCount = 0;

        this.balanceCache.forEach((entry, accountId) => {
            const isExpired = (now - entry.timestamp) > entry.ttl;
            if (isExpired) {
                this.balanceCache.delete(accountId);
                removedCount++;
            }
        });

        if (removedCount > 0) {
            logger.debug('Cleaned up expired cache entries', {
                removedCount,
                remainingEntries: this.balanceCache.size
            });
        }
    }

    /**
     * Validate Hedera account ID format
     */
    private isValidAccountId(accountId: string): boolean {
        // Hedera account ID format: shard.realm.account (e.g., 0.0.123456)
        const hederaAccountPattern = /^\d+\.\d+\.\d+$/;
        return hederaAccountPattern.test(accountId);
    }

    /**
     * Generate user-friendly insufficient balance message
     */
    private generateInsufficientBalanceMessage(
        required: WalletBalanceRequirement,
        currentBalance: number,
        shortfall: number
    ): string {
        const breakdown = [];

        if (required.transactionFee > 0) {
            breakdown.push(`Transaction Fee: ${required.transactionFee} ${required.currency}`);
        }

        if (required.escrowAmount > 0) {
            breakdown.push(`Escrow Amount: ${required.escrowAmount} ${required.currency}`);
        }

        if (required.platformFee > 0) {
            breakdown.push(`Platform Fee: ${required.platformFee} ${required.currency}`);
        }

        return `Insufficient wallet balance. Current: ${currentBalance} ${required.currency}, ` +
            `Required: ${required.totalRequired} ${required.currency}, ` +
            `Shortfall: ${shortfall} ${required.currency}. ` +
            `Breakdown: ${breakdown.join(', ')}`;
    }

    /**
     * Clear all cached balances
     */
    clearCache(): void {
        const cacheSize = this.balanceCache.size;
        this.balanceCache.clear();

        logger.info('Balance cache cleared', { clearedEntries: cacheSize });
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): { size: number; entries: Array<{ accountId: string; age: number; ttl: number }> } {
        const now = Date.now();
        const entries = Array.from(this.balanceCache.entries()).map(([accountId, entry]) => ({
            accountId,
            age: now - entry.timestamp,
            ttl: entry.ttl
        }));

        return {
            size: this.balanceCache.size,
            entries
        };
    }
}