import { EventEmitter } from 'events';
import { WebSocketError, WebSocketErrorCategory } from './websocketErrorHandler';
import { websocketLogger } from './websocketLogger';

/**
 * Permanent failure reasons
 */
export enum PermanentFailureReason {
    MAX_RECONNECTION_ATTEMPTS = 'max_reconnection_attempts',
    AUTHENTICATION_FAILED = 'authentication_failed',
    SERVER_PERMANENTLY_UNAVAILABLE = 'server_permanently_unavailable',
    NETWORK_PERMANENTLY_UNAVAILABLE = 'network_permanently_unavailable',
    CONFIGURATION_ERROR = 'configuration_error',
    USER_REQUESTED = 'user_requested'
}

/**
 * User notification types for permanent failures
 */
export enum NotificationType {
    TOAST = 'toast',
    MODAL = 'modal',
    BANNER = 'banner',
    CONSOLE = 'console'
}

/**
 * Permanent failure information
 */
export interface PermanentFailure {
    reason: PermanentFailureReason;
    timestamp: Date;
    errorHistory: WebSocketError[];
    attemptCount: number;
    lastError?: WebSocketError;
    userMessage: string;
    technicalDetails: string;
    recoveryOptions: RecoveryOption[];
}

/**
 * Recovery options for permanent failures
 */
export interface RecoveryOption {
    id: string;
    label: string;
    description: string;
    action: () => Promise<void>;
    primary?: boolean;
}

/**
 * Permanent Failure Handler for managing connection failures that cannot be automatically recovered
 */
export class PermanentFailureHandler extends EventEmitter {
    private maxReconnectionAttempts: number;
    private currentAttemptCount: number = 0;
    private errorHistory: WebSocketError[] = [];
    private permanentFailureState: PermanentFailure | null = null;
    private notificationCallbacks: Map<NotificationType, (failure: PermanentFailure) => void> = new Map();

    constructor(maxReconnectionAttempts: number = 10) {
        super();
        this.maxReconnectionAttempts = maxReconnectionAttempts;
    }

    /**
     * Track a reconnection attempt
     */
    trackReconnectionAttempt(error?: WebSocketError): void {
        this.currentAttemptCount++;

        if (error) {
            this.errorHistory.push(error);
        }

        websocketLogger.info('PermanentFailure', `Reconnection attempt ${this.currentAttemptCount}/${this.maxReconnectionAttempts}`, {
            attemptCount: this.currentAttemptCount,
            maxAttempts: this.maxReconnectionAttempts,
            errorCode: error?.code
        });

        // Check if we've reached the maximum attempts
        if (this.currentAttemptCount >= this.maxReconnectionAttempts) {
            this.handlePermanentFailure(
                PermanentFailureReason.MAX_RECONNECTION_ATTEMPTS,
                error
            );
        }
    }

    /**
     * Handle authentication failure that cannot be recovered
     */
    handleAuthenticationFailure(error: WebSocketError): void {
        websocketLogger.error('PermanentFailure', 'Authentication failure cannot be recovered', {
            errorCode: error.code,
            attemptCount: this.currentAttemptCount
        }, error.originalError);

        this.handlePermanentFailure(
            PermanentFailureReason.AUTHENTICATION_FAILED,
            error
        );
    }

    /**
     * Handle server permanently unavailable
     */
    handleServerUnavailable(error: WebSocketError): void {
        websocketLogger.error('PermanentFailure', 'Server appears to be permanently unavailable', {
            errorCode: error.code,
            attemptCount: this.currentAttemptCount
        }, error.originalError);

        this.handlePermanentFailure(
            PermanentFailureReason.SERVER_PERMANENTLY_UNAVAILABLE,
            error
        );
    }

    /**
     * Handle network permanently unavailable
     */
    handleNetworkUnavailable(error: WebSocketError): void {
        websocketLogger.error('PermanentFailure', 'Network appears to be permanently unavailable', {
            errorCode: error.code,
            attemptCount: this.currentAttemptCount
        }, error.originalError);

        this.handlePermanentFailure(
            PermanentFailureReason.NETWORK_PERMANENTLY_UNAVAILABLE,
            error
        );
    }

    /**
     * Handle configuration error
     */
    handleConfigurationError(error: WebSocketError): void {
        websocketLogger.error('PermanentFailure', 'Configuration error prevents connection', {
            errorCode: error.code,
            attemptCount: this.currentAttemptCount
        }, error.originalError);

        this.handlePermanentFailure(
            PermanentFailureReason.CONFIGURATION_ERROR,
            error
        );
    }

    /**
     * Handle user-requested permanent disconnection
     */
    handleUserRequested(): void {
        websocketLogger.info('PermanentFailure', 'User requested permanent disconnection');

        this.handlePermanentFailure(
            PermanentFailureReason.USER_REQUESTED
        );
    }

    /**
     * Core permanent failure handler
     */
    private handlePermanentFailure(reason: PermanentFailureReason, lastError?: WebSocketError): void {
        const failure: PermanentFailure = {
            reason,
            timestamp: new Date(),
            errorHistory: [...this.errorHistory],
            attemptCount: this.currentAttemptCount,
            lastError,
            userMessage: this.getUserMessage(reason, lastError),
            technicalDetails: this.getTechnicalDetails(reason, lastError),
            recoveryOptions: this.getRecoveryOptions(reason)
        };

        this.permanentFailureState = failure;

        websocketLogger.error('PermanentFailure', `Permanent failure: ${reason}`, {
            reason,
            attemptCount: this.currentAttemptCount,
            errorHistoryCount: this.errorHistory.length,
            lastErrorCode: lastError?.code
        });

        // Emit permanent failure event
        this.emit('permanentFailure', failure);

        // Notify user
        this.notifyUser(failure);

        // Stop any further reconnection attempts
        this.emit('stopReconnection');
    }

    /**
     * Get user-friendly message for permanent failure
     */
    private getUserMessage(reason: PermanentFailureReason, lastError?: WebSocketError): string {
        switch (reason) {
            case PermanentFailureReason.MAX_RECONNECTION_ATTEMPTS:
                return 'Unable to establish a stable connection after multiple attempts. The service may be temporarily unavailable.';

            case PermanentFailureReason.AUTHENTICATION_FAILED:
                return 'Authentication failed. Please check your login credentials and try signing in again.';

            case PermanentFailureReason.SERVER_PERMANENTLY_UNAVAILABLE:
                return 'The service is currently unavailable. Please try again later or contact support if the issue persists.';

            case PermanentFailureReason.NETWORK_PERMANENTLY_UNAVAILABLE:
                return 'Network connection is unavailable. Please check your internet connection and try again.';

            case PermanentFailureReason.CONFIGURATION_ERROR:
                return 'There is a configuration issue preventing connection. Please contact support for assistance.';

            case PermanentFailureReason.USER_REQUESTED:
                return 'Real-time updates have been disabled as requested.';

            default:
                return 'An unexpected issue has occurred with real-time updates. Please try refreshing the page.';
        }
    }

    /**
     * Get technical details for permanent failure
     */
    private getTechnicalDetails(reason: PermanentFailureReason, lastError?: WebSocketError): string {
        const details = [`Reason: ${reason}`];

        if (this.currentAttemptCount > 0) {
            details.push(`Attempts: ${this.currentAttemptCount}/${this.maxReconnectionAttempts}`);
        }

        if (lastError) {
            details.push(`Last Error: ${lastError.code} - ${lastError.message}`);
            details.push(`Error Category: ${lastError.category}`);
        }

        if (this.errorHistory.length > 0) {
            const errorCounts = this.errorHistory.reduce((acc, error) => {
                acc[error.category] = (acc[error.category] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            details.push(`Error History: ${Object.entries(errorCounts).map(([cat, count]) => `${cat}:${count}`).join(', ')}`);
        }

        return details.join(' | ');
    }

    /**
     * Get recovery options for permanent failure
     */
    private getRecoveryOptions(reason: PermanentFailureReason): RecoveryOption[] {
        const options: RecoveryOption[] = [];

        switch (reason) {
            case PermanentFailureReason.MAX_RECONNECTION_ATTEMPTS:
                options.push({
                    id: 'retry_connection',
                    label: 'Try Again',
                    description: 'Attempt to reconnect to the service',
                    action: async () => {
                        this.reset();
                        this.emit('retryConnection');
                    },
                    primary: true
                });

                options.push({
                    id: 'enable_fallback',
                    label: 'Use Offline Mode',
                    description: 'Continue with limited functionality',
                    action: async () => {
                        this.emit('enableFallbackMode');
                    }
                });
                break;

            case PermanentFailureReason.AUTHENTICATION_FAILED:
                options.push({
                    id: 'sign_in_again',
                    label: 'Sign In Again',
                    description: 'Refresh your authentication',
                    action: async () => {
                        this.emit('requestReauthentication');
                    },
                    primary: true
                });
                break;

            case PermanentFailureReason.SERVER_PERMANENTLY_UNAVAILABLE:
                options.push({
                    id: 'check_status',
                    label: 'Check Service Status',
                    description: 'View current service status',
                    action: async () => {
                        this.emit('checkServiceStatus');
                    }
                });

                options.push({
                    id: 'enable_fallback',
                    label: 'Continue Offline',
                    description: 'Use the app with limited functionality',
                    action: async () => {
                        this.emit('enableFallbackMode');
                    },
                    primary: true
                });
                break;

            case PermanentFailureReason.NETWORK_PERMANENTLY_UNAVAILABLE:
                options.push({
                    id: 'check_network',
                    label: 'Check Network',
                    description: 'Verify your internet connection',
                    action: async () => {
                        this.emit('checkNetworkConnection');
                    },
                    primary: true
                });

                options.push({
                    id: 'work_offline',
                    label: 'Work Offline',
                    description: 'Continue with cached data',
                    action: async () => {
                        this.emit('enableOfflineMode');
                    }
                });
                break;

            case PermanentFailureReason.CONFIGURATION_ERROR:
                options.push({
                    id: 'contact_support',
                    label: 'Contact Support',
                    description: 'Get help resolving this issue',
                    action: async () => {
                        this.emit('contactSupport');
                    },
                    primary: true
                });
                break;

            case PermanentFailureReason.USER_REQUESTED:
                options.push({
                    id: 'enable_realtime',
                    label: 'Enable Real-time Updates',
                    description: 'Re-enable live updates',
                    action: async () => {
                        this.reset();
                        this.emit('enableRealtime');
                    },
                    primary: true
                });
                break;
        }

        // Always add refresh option
        options.push({
            id: 'refresh_page',
            label: 'Refresh Page',
            description: 'Reload the application',
            action: async () => {
                window.location.reload();
            }
        });

        return options;
    }

    /**
     * Notify user about permanent failure
     */
    private notifyUser(failure: PermanentFailure): void {
        // Try different notification methods in order of preference
        const notificationTypes = [NotificationType.MODAL, NotificationType.BANNER, NotificationType.TOAST, NotificationType.CONSOLE];

        for (const type of notificationTypes) {
            const callback = this.notificationCallbacks.get(type);
            if (callback) {
                try {
                    callback(failure);
                    break; // Successfully notified, stop trying other methods
                } catch (error) {
                    websocketLogger.warn('PermanentFailure', `Failed to notify via ${type}`, { error: (error as Error).message });
                }
            }
        }

        // Fallback to console if no other method worked
        console.error('🔴 PERMANENT CONNECTION FAILURE:', failure.userMessage);
        console.error('Technical details:', failure.technicalDetails);
    }

    /**
     * Register notification callback for a specific type
     */
    registerNotificationCallback(type: NotificationType, callback: (failure: PermanentFailure) => void): void {
        this.notificationCallbacks.set(type, callback);
    }

    /**
     * Unregister notification callback
     */
    unregisterNotificationCallback(type: NotificationType): void {
        this.notificationCallbacks.delete(type);
    }

    /**
     * Reset the permanent failure handler
     */
    reset(): void {
        this.currentAttemptCount = 0;
        this.errorHistory = [];
        this.permanentFailureState = null;

        websocketLogger.info('PermanentFailure', 'Permanent failure handler reset');
    }

    /**
     * Get current permanent failure state
     */
    getPermanentFailureState(): PermanentFailure | null {
        return this.permanentFailureState;
    }

    /**
     * Check if in permanent failure state
     */
    isInPermanentFailure(): boolean {
        return this.permanentFailureState !== null;
    }

    /**
     * Get current attempt count
     */
    getCurrentAttemptCount(): number {
        return this.currentAttemptCount;
    }

    /**
     * Get maximum reconnection attempts
     */
    getMaxReconnectionAttempts(): number {
        return this.maxReconnectionAttempts;
    }

    /**
     * Set maximum reconnection attempts
     */
    setMaxReconnectionAttempts(maxAttempts: number): void {
        this.maxReconnectionAttempts = maxAttempts;
        websocketLogger.info('PermanentFailure', `Max reconnection attempts set to ${maxAttempts}`);
    }

    /**
     * Get error history
     */
    getErrorHistory(): WebSocketError[] {
        return [...this.errorHistory];
    }

    /**
     * Check if error pattern suggests permanent failure
     */
    shouldTriggerPermanentFailure(error: WebSocketError): boolean {
        // Add error to history
        this.errorHistory.push(error);

        // Check for specific error patterns that suggest permanent failure
        switch (error.category) {
            case WebSocketErrorCategory.AUTHENTICATION:
                // Multiple authentication failures in short time suggest permanent auth issue
                const recentAuthErrors = this.getRecentErrorsByCategory(WebSocketErrorCategory.AUTHENTICATION, 60000); // 1 minute
                return recentAuthErrors.length >= 3;

            case WebSocketErrorCategory.SERVER:
                // Multiple server errors suggest server is down
                const recentServerErrors = this.getRecentErrorsByCategory(WebSocketErrorCategory.SERVER, 300000); // 5 minutes
                return recentServerErrors.length >= 5;

            case WebSocketErrorCategory.NETWORK:
                // Persistent network errors suggest network issues
                const recentNetworkErrors = this.getRecentErrorsByCategory(WebSocketErrorCategory.NETWORK, 180000); // 3 minutes
                return recentNetworkErrors.length >= 4;

            default:
                return false;
        }
    }

    /**
     * Get recent errors by category within time window
     */
    private getRecentErrorsByCategory(category: WebSocketErrorCategory, timeWindowMs: number): WebSocketError[] {
        const now = Date.now();
        const windowStart = now - timeWindowMs;

        return this.errorHistory.filter(error =>
            error.category === category &&
            error.timestamp.getTime() > windowStart
        );
    }

    /**
     * Emit permanent failure event when max attempts reached
     */
    emitPermanentFailure(reason: PermanentFailureReason, lastError?: WebSocketError): void {
        this.handlePermanentFailure(reason, lastError);
    }
}