/**
 * ExponentialBackoff utility class for implementing exponential backoff strategy
 * Used for reconnection attempts with jitter to prevent thundering herd problem
 */
export class ExponentialBackoff {
    private attempt: number = 0;
    private readonly baseDelay: number;
    private readonly maxDelay: number;
    private readonly jitter: boolean;

    constructor(
        baseDelay: number = 1000,
        maxDelay: number = 30000,
        jitter: boolean = true
    ) {
        this.baseDelay = baseDelay;
        this.maxDelay = maxDelay;
        this.jitter = jitter;
    }

    /**
     * Calculate the next delay based on current attempt count
     * Uses exponential backoff with optional jitter
     */
    getNextDelay(): number {
        const exponentialDelay = this.baseDelay * Math.pow(2, this.attempt);
        const cappedDelay = Math.min(exponentialDelay, this.maxDelay);

        if (this.jitter) {
            // Add random jitter up to 1000ms to prevent thundering herd
            const jitterAmount = Math.random() * 1000;
            return cappedDelay + jitterAmount;
        }

        return cappedDelay;
    }

    /**
     * Reset the attempt counter to 0
     */
    reset(): void {
        this.attempt = 0;
    }

    /**
     * Increment the attempt counter
     */
    increment(): void {
        this.attempt++;
    }

    /**
     * Get the current attempt count
     */
    getCurrentAttempt(): number {
        return this.attempt;
    }

    /**
     * Check if we've reached the maximum delay
     */
    isAtMaxDelay(): boolean {
        const exponentialDelay = this.baseDelay * Math.pow(2, this.attempt);
        return exponentialDelay >= this.maxDelay;
    }
}