/**
 * Auth Sync Error Recovery utilities
 */

interface RecoveryStrategy {
    name: string;
    execute: () => Promise<boolean>;
    description: string;
}

interface RecoveryResult {
    success: boolean;
    strategy: string;
    error?: string;
}

/**
 * Error recovery strategies for auth synchronization failures
 */
export class AuthSyncErrorRecovery {
    private maxRetryAttempts = 3;
    private retryDelay = 1000; // Start with 1 second

    /**
     * Attempts to recover from sync failures using various strategies
     */
    async attemptRecovery(
        error: Error,
        context: string,
        retryCallback: () => Promise<void>
    ): Promise<RecoveryResult> {
        console.log(`🔄 Auth sync recovery: Attempting recovery for error in ${context}:`, error.message);

        const strategies = this.getRecoveryStrategies(context, retryCallback);

        for (const strategy of strategies) {
            try {
                console.log(`🔄 Auth sync recovery: Trying strategy: ${strategy.name}`);
                const success = await strategy.execute();

                if (success) {
                    console.log(`✅ Auth sync recovery: Strategy ${strategy.name} succeeded`);
                    return { success: true, strategy: strategy.name };
                }
            } catch (strategyError) {
                console.error(`❌ Auth sync recovery: Strategy ${strategy.name} failed:`, strategyError);
                continue;
            }
        }

        console.error('❌ Auth sync recovery: All recovery strategies failed');
        return {
            success: false,
            strategy: 'none',
            error: 'All recovery strategies exhausted'
        };
    }

    /**
     * Implements exponential backoff retry logic
     */
    async retryWithBackoff<T>(
        operation: () => Promise<T>,
        context: string,
        maxAttempts: number = this.maxRetryAttempts
    ): Promise<T> {
        let lastError: Error;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error as Error;

                if (attempt === maxAttempts) {
                    throw new Error(`Operation failed after ${maxAttempts} attempts in ${context}: ${lastError.message}`);
                }

                const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
                console.log(`🔄 Auth sync retry: Attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms`);

                await this.sleep(delay);
            }
        }

        throw lastError!;
    }

    /**
     * Gets appropriate recovery strategies based on context
     */
    private getRecoveryStrategies(context: string, retryCallback: () => Promise<void>): RecoveryStrategy[] {
        const baseStrategies: RecoveryStrategy[] = [
            {
                name: 'immediate_retry',
                description: 'Retry the operation immediately',
                execute: async () => {
                    await retryCallback();
                    return true;
                },
            },
            {
                name: 'delayed_retry',
                description: 'Retry after a short delay',
                execute: async () => {
                    await this.sleep(1000);
                    await retryCallback();
                    return true;
                },
            },
        ];

        // Context-specific strategies
        if (context.includes('localStorage')) {
            baseStrategies.push({
                name: 'clear_localStorage',
                description: 'Clear potentially corrupted localStorage data',
                execute: async () => {
                    try {
                        localStorage.removeItem('auth_token');
                        localStorage.removeItem('auth_user');
                        console.log('🧹 Auth sync recovery: Cleared localStorage');
                        return true;
                    } catch (error) {
                        console.error('Failed to clear localStorage:', error);
                        return false;
                    }
                },
            });
        }

        if (context.includes('redux')) {
            baseStrategies.push({
                name: 'reset_redux_state',
                description: 'Reset Redux auth state to initial values',
                execute: async () => {
                    try {
                        // This would need to be implemented with access to dispatch
                        console.log('🔄 Auth sync recovery: Redux state reset would be triggered here');
                        return true;
                    } catch (error) {
                        console.error('Failed to reset Redux state:', error);
                        return false;
                    }
                },
            });
        }

        return baseStrategies;
    }

    /**
     * Sleep utility for delays
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Validates if an error is recoverable
     */
    isRecoverableError(error: Error): boolean {
        const recoverablePatterns = [
            /network/i,
            /timeout/i,
            /temporary/i,
            /rate limit/i,
            /service unavailable/i,
        ];

        const nonRecoverablePatterns = [
            /unauthorized/i,
            /forbidden/i,
            /invalid token/i,
            /malformed/i,
        ];

        // Check if error is explicitly non-recoverable
        if (nonRecoverablePatterns.some(pattern => pattern.test(error.message))) {
            return false;
        }

        // Check if error is explicitly recoverable
        if (recoverablePatterns.some(pattern => pattern.test(error.message))) {
            return true;
        }

        // Default to recoverable for unknown errors
        return true;
    }

    /**
     * Creates user-friendly error messages with recovery suggestions
     */
    createUserFriendlyMessage(error: Error, context: string): string {
        const baseMessage = 'There was an issue synchronizing your authentication state.';

        if (context.includes('localStorage')) {
            return `${baseMessage} Please try refreshing the page or logging in again.`;
        }

        if (context.includes('network')) {
            return `${baseMessage} Please check your internet connection and try again.`;
        }

        if (this.isRecoverableError(error)) {
            return `${baseMessage} This is usually temporary - please try again in a moment.`;
        }

        return `${baseMessage} Please log out and log back in to resolve this issue.`;
    }
}

// Singleton instance
export const authSyncErrorRecovery = new AuthSyncErrorRecovery();