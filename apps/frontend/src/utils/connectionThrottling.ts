/**
 * Connection Throttling Utility
 * 
 * Provides shared connection debouncing and throttling functionality for WebSocket services.
 * Implements requirements 1.1, 1.3, 2.1 from the WebSocket Connection Throttling Fix specification.
 */

/**
 * Configuration for connection throttling behavior
 */
export interface ConnectionThrottleConfig {
    /** Delay between connection attempts in milliseconds (default: 1000ms) */
    debounceDelay: number;
    /** Maximum retry attempts (default: 3) */
    maxRetries: number;
    /** Delay between retries in milliseconds (default: 2000ms) */
    retryDelay: number;
    /** Connection timeout in milliseconds (default: 10000ms) */
    connectionTimeout: number;
    /** Maximum connection attempts per time window */
    maxAttemptsPerWindow: number;
    /** Time window for rate limiting in milliseconds (default: 60000ms - 1 minute) */
    rateLimitWindow: number;
}

/**
 * Tracks connection attempts for a specific service
 */
interface ConnectionAttemptTracker {
    /** Unique identifier for the service */
    serviceId: string;
    /** Timestamp of the last connection attempt */
    lastAttempt: number;
    /** Number of connection attempts made */
    attemptCount: number;
    /** Whether a connection is currently in progress */
    isConnecting: boolean;
    /** Timer for debounced connection attempts */
    debounceTimer?: NodeJS.Timeout;
    /** Array of attempt timestamps for rate limiting */
    attemptTimestamps: number[];
    /** Pending promise resolvers for debounced connections */
    pendingResolvers: Array<{
        resolve: (value: void | PromiseLike<void>) => void;
        reject: (reason?: any) => void;
    }>;
}

/**
 * Default throttling configuration
 */
const DEFAULT_CONFIG: ConnectionThrottleConfig = {
    debounceDelay: 1000,        // 1 second delay between connection attempts
    maxRetries: 3,              // Maximum 3 retry attempts
    retryDelay: 2000,           // 2 second delay between retries
    connectionTimeout: 10000,   // 10 second connection timeout
    maxAttemptsPerWindow: 10,   // Maximum 10 attempts per window
    rateLimitWindow: 60000,     // 1 minute rate limit window
};

/**
 * Connection Throttling Manager
 * 
 * Manages connection throttling, debouncing, and rate limiting for WebSocket services.
 * Prevents rapid successive connection attempts and implements configurable delays.
 */
export class ConnectionThrottlingManager {
    private config: ConnectionThrottleConfig;
    private trackers: Map<string, ConnectionAttemptTracker> = new Map();

    constructor(config: Partial<ConnectionThrottleConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Debounce connection attempts for a specific service
     * Requirements: 1.1, 1.3
     * 
     * @param serviceId - Unique identifier for the WebSocket service
     * @param connectFn - Function to execute the connection
     * @param delay - Optional custom delay (uses config default if not provided)
     * @returns Promise that resolves when connection is attempted
     */
    public debounceConnection(
        serviceId: string,
        connectFn: () => Promise<void>,
        delay?: number
    ): Promise<void> {
        const tracker = this.getOrCreateTracker(serviceId);
        const debounceDelay = delay ?? this.config.debounceDelay;

        // Check rate limiting before setting up debounce
        this.cleanupOldAttempts(tracker);
        if (tracker.attemptTimestamps.length >= this.config.maxAttemptsPerWindow) {
            return Promise.reject(new Error(`Connection rate limit exceeded for service: ${serviceId}`));
        }

        return new Promise((resolve, reject) => {
            // Add this promise to pending resolvers
            tracker.pendingResolvers.push({ resolve, reject });

            // Clear any existing debounce timer and reject previous promises
            if (tracker.debounceTimer) {
                clearTimeout(tracker.debounceTimer);
                // Reject all but the current promise (last one added)
                const currentResolver = tracker.pendingResolvers.pop()!;
                tracker.pendingResolvers.forEach(resolver => {
                    resolver.reject(new Error('Connection attempt superseded by newer request'));
                });
                tracker.pendingResolvers = [currentResolver];
            }

            // Set up debounced connection
            tracker.debounceTimer = setTimeout(async () => {
                const resolvers = [...tracker.pendingResolvers];
                tracker.pendingResolvers = [];

                try {
                    tracker.isConnecting = true;
                    tracker.lastAttempt = Date.now();
                    tracker.attemptCount++;

                    // Add timestamp for rate limiting
                    tracker.attemptTimestamps.push(tracker.lastAttempt);
                    this.cleanupOldAttempts(tracker);

                    await connectFn();

                    // Reset attempt count on successful connection
                    tracker.attemptCount = 0;
                    tracker.isConnecting = false;

                    // Resolve all pending promises
                    resolvers.forEach(resolver => resolver.resolve());
                } catch (error) {
                    tracker.isConnecting = false;
                    // Reject all pending promises
                    resolvers.forEach(resolver => resolver.reject(error));
                } finally {
                    tracker.debounceTimer = undefined;
                }
            }, debounceDelay);
        });
    }

    /**
     * Clear debounced connection for a specific service
     * Requirements: 1.1
     * 
     * @param serviceId - Unique identifier for the WebSocket service
     */
    public clearDebounce(serviceId: string): void {
        const tracker = this.trackers.get(serviceId);
        if (tracker?.debounceTimer) {
            clearTimeout(tracker.debounceTimer);
            tracker.debounceTimer = undefined;
            tracker.isConnecting = false;
            // Reject any pending promises
            tracker.pendingResolvers.forEach(resolver => {
                resolver.reject(new Error('Connection attempt cancelled'));
            });
            tracker.pendingResolvers = [];
        }
    }

    /**
     * Check if a connection is currently pending for a service
     * Requirements: 1.1
     * 
     * @param serviceId - Unique identifier for the WebSocket service
     * @returns True if connection is pending
     */
    public isConnectionPending(serviceId: string): boolean {
        const tracker = this.trackers.get(serviceId);
        return tracker?.debounceTimer !== undefined || tracker?.isConnecting === true;
    }

    /**
     * Check if a service can make a connection attempt
     * Requirements: 1.3, 2.1
     * 
     * @param serviceId - Unique identifier for the WebSocket service
     * @returns True if connection attempt is allowed
     */
    public canConnect(serviceId: string): boolean {
        const tracker = this.getOrCreateTracker(serviceId);

        // Check if already connecting or has pending debounce timer
        if (tracker.isConnecting || tracker.debounceTimer !== undefined) {
            return false;
        }

        // Check rate limiting
        this.cleanupOldAttempts(tracker);
        if (tracker.attemptTimestamps.length >= this.config.maxAttemptsPerWindow) {
            return false;
        }

        // Check retry delay
        if (tracker.attemptCount > 0) {
            const timeSinceLastAttempt = Date.now() - tracker.lastAttempt;
            const requiredDelay = this.config.retryDelay * Math.pow(2, tracker.attemptCount - 1);

            if (timeSinceLastAttempt < requiredDelay) {
                return false;
            }
        }

        // Check max retries
        if (tracker.attemptCount >= this.config.maxRetries) {
            return false;
        }

        return true;
    }

    /**
     * Get connection status for a specific service
     * Requirements: 2.1
     * 
     * @param serviceId - Unique identifier for the WebSocket service
     * @returns Connection status information
     */
    public getConnectionStatus(serviceId: string): {
        canConnect: boolean;
        isConnecting: boolean;
        isPending: boolean;
        attemptCount: number;
        lastAttempt: number | null;
        nextAllowedAttempt: number | null;
        attemptsInWindow: number;
    } {
        const tracker = this.trackers.get(serviceId);

        if (!tracker) {
            return {
                canConnect: true,
                isConnecting: false,
                isPending: false,
                attemptCount: 0,
                lastAttempt: null,
                nextAllowedAttempt: null,
                attemptsInWindow: 0,
            };
        }

        this.cleanupOldAttempts(tracker);

        let nextAllowedAttempt: number | null = null;
        if (tracker.attemptCount > 0) {
            const requiredDelay = this.config.retryDelay * Math.pow(2, tracker.attemptCount - 1);
            nextAllowedAttempt = tracker.lastAttempt + requiredDelay;
        }

        return {
            canConnect: this.canConnect(serviceId),
            isConnecting: tracker.isConnecting,
            isPending: this.isConnectionPending(serviceId),
            attemptCount: tracker.attemptCount,
            lastAttempt: tracker.lastAttempt || null,
            nextAllowedAttempt,
            attemptsInWindow: tracker.attemptTimestamps.length,
        };
    }

    /**
     * Reset connection tracking for a specific service
     * Useful when a service successfully connects or needs to be reset
     * 
     * @param serviceId - Unique identifier for the WebSocket service
     */
    public resetConnectionTracking(serviceId: string): void {
        const tracker = this.trackers.get(serviceId);
        if (tracker) {
            this.clearDebounce(serviceId);
            tracker.attemptCount = 0;
            tracker.lastAttempt = 0;
            tracker.isConnecting = false;
            tracker.attemptTimestamps = [];
            tracker.pendingResolvers = [];
        }
    }

    /**
     * Update configuration for the throttling manager
     * 
     * @param newConfig - Partial configuration to update
     */
    public updateConfig(newConfig: Partial<ConnectionThrottleConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Get current configuration
     * 
     * @returns Current throttling configuration
     */
    public getConfig(): ConnectionThrottleConfig {
        return { ...this.config };
    }

    /**
     * Get or create a tracker for a service
     * 
     * @param serviceId - Unique identifier for the WebSocket service
     * @returns Connection attempt tracker
     */
    private getOrCreateTracker(serviceId: string): ConnectionAttemptTracker {
        if (!this.trackers.has(serviceId)) {
            this.trackers.set(serviceId, {
                serviceId,
                lastAttempt: 0,
                attemptCount: 0,
                isConnecting: false,
                attemptTimestamps: [],
                pendingResolvers: [],
            });
        }
        return this.trackers.get(serviceId)!;
    }

    /**
     * Clean up old attempt timestamps outside the rate limit window
     * 
     * @param tracker - Connection attempt tracker to clean up
     */
    private cleanupOldAttempts(tracker: ConnectionAttemptTracker): void {
        const cutoffTime = Date.now() - this.config.rateLimitWindow;
        tracker.attemptTimestamps = tracker.attemptTimestamps.filter(
            timestamp => timestamp > cutoffTime
        );
    }
}

/**
 * Singleton instance of the connection throttling manager
 * Provides a shared instance for all WebSocket services
 */
export const connectionThrottlingManager = new ConnectionThrottlingManager();

/**
 * Convenience function to create a throttled connection function
 * 
 * @param serviceId - Unique identifier for the WebSocket service
 * @param connectFn - Original connection function
 * @param config - Optional custom configuration
 * @returns Throttled connection function
 */
export function createThrottledConnection(
    serviceId: string,
    connectFn: () => Promise<void>,
    config?: Partial<ConnectionThrottleConfig>
): () => Promise<void> {
    const manager = config
        ? new ConnectionThrottlingManager(config)
        : connectionThrottlingManager;

    return () => manager.debounceConnection(serviceId, connectFn);
}

/**
 * Connection state checker utility
 * Provides methods to verify connection status before attempting new connections
 * Requirements: 2.1
 */
export class ConnectionStateChecker {
    private connectionStates: Map<string, boolean> = new Map();

    /**
     * Check if a service is currently connected
     * 
     * @param serviceId - Unique identifier for the WebSocket service
     * @returns True if service is connected
     */
    public isConnected(serviceId: string): boolean {
        return this.connectionStates.get(serviceId) === true;
    }

    /**
     * Set connection state for a service
     * 
     * @param serviceId - Unique identifier for the WebSocket service
     * @param connected - Connection state
     */
    public setConnectionState(serviceId: string, connected: boolean): void {
        this.connectionStates.set(serviceId, connected);
    }

    /**
     * Check if a service can connect (not already connected and throttling allows it)
     * 
     * @param serviceId - Unique identifier for the WebSocket service
     * @returns True if connection attempt is allowed
     */
    public canConnect(serviceId: string): boolean {
        // Don't connect if already connected
        if (this.isConnected(serviceId)) {
            return false;
        }

        // Check throttling constraints
        return connectionThrottlingManager.canConnect(serviceId);
    }

    /**
     * Get detailed connection status for a service
     * 
     * @param serviceId - Unique identifier for the WebSocket service
     * @returns Detailed connection status
     */
    public getConnectionStatus(serviceId: string): {
        isConnected: boolean;
        canConnect: boolean;
        throttlingStatus: ReturnType<ConnectionThrottlingManager['getConnectionStatus']>;
    } {
        return {
            isConnected: this.isConnected(serviceId),
            canConnect: this.canConnect(serviceId),
            throttlingStatus: connectionThrottlingManager.getConnectionStatus(serviceId),
        };
    }

    /**
     * Reset connection state for a service
     * 
     * @param serviceId - Unique identifier for the WebSocket service
     */
    public resetConnectionState(serviceId: string): void {
        this.connectionStates.delete(serviceId);
        connectionThrottlingManager.resetConnectionTracking(serviceId);
    }
}

/**
 * Singleton instance of the connection state checker
 */
export const connectionStateChecker = new ConnectionStateChecker();

export default {
    ConnectionThrottlingManager,
    connectionThrottlingManager,
    ConnectionStateChecker,
    connectionStateChecker,
    createThrottledConnection,
};