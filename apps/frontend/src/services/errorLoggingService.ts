import { ErrorInfo } from 'react';
import { logger } from '@/utils/logger';

/**
 * Detailed error information for logging and metrics
 */
export interface ErrorDetails {
    errorId: string;
    timestamp: Date;
    componentName: string;
    errorMessage: string;
    errorStack?: string;
    componentStack?: string;
    userAgent: string;
    url: string;
    userId?: string | null;
    sessionId?: string;
    buildVersion?: string;
    errorType: ErrorType;
    severity: ErrorSeverity;
    context?: Record<string, any>;
    recoveryAttempts?: number;
    userActions?: UserAction[];
}

/**
 * Types of errors for categorization
 */
export enum ErrorType {
    COMPONENT_RENDER = 'component_render',
    DESIGN_TOKEN = 'design_token',
    PROP_VALIDATION = 'prop_validation',
    STATE_MANAGEMENT = 'state_management',
    NETWORK = 'network',
    PERMISSION = 'permission',
    UNKNOWN = 'unknown',
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical',
}

/**
 * User actions leading up to the error
 */
export interface UserAction {
    type: string;
    timestamp: Date;
    details?: Record<string, any>;
}

/**
 * Error metrics for monitoring and analysis
 */
export interface ErrorMetrics {
    totalErrors: number;
    errorsByComponent: Record<string, number>;
    errorsByType: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    errorsByTimeframe: Record<string, number>;
    recoverySuccessRate: number;
    averageRecoveryTime: number;
    topErrorMessages: Array<{ message: string; count: number }>;
    lastError?: ErrorDetails;
    sessionErrors: ErrorDetails[];
}

/**
 * Error categorization rules
 */
class ErrorCategorizer {
    static categorizeError(error: Error, componentName: string): { type: ErrorType; severity: ErrorSeverity } {
        const message = error.message.toLowerCase();
        const stack = error.stack?.toLowerCase() || '';

        // Categorize by error type
        let type = ErrorType.UNKNOWN;
        if (message.includes('token') || message.includes('design-system')) {
            type = ErrorType.DESIGN_TOKEN;
        } else if (message.includes('prop') || message.includes('invalid')) {
            type = ErrorType.PROP_VALIDATION;
        } else if (message.includes('state') || message.includes('dispatch')) {
            type = ErrorType.STATE_MANAGEMENT;
        } else if (message.includes('network') || message.includes('fetch')) {
            type = ErrorType.NETWORK;
        } else if (message.includes('permission') || message.includes('unauthorized')) {
            type = ErrorType.PERMISSION;
        } else if (stack.includes('render') || message.includes('render')) {
            type = ErrorType.COMPONENT_RENDER;
        }

        // Determine severity
        let severity = ErrorSeverity.MEDIUM;
        if (message.includes('critical') || componentName.toLowerCase().includes('auth')) {
            severity = ErrorSeverity.CRITICAL;
        } else if (message.includes('warning') || type === ErrorType.DESIGN_TOKEN) {
            severity = ErrorSeverity.LOW;
        } else if (type === ErrorType.NETWORK || type === ErrorType.STATE_MANAGEMENT) {
            severity = ErrorSeverity.HIGH;
        }

        return { type, severity };
    }
}

/**
 * User action tracker for error context
 */
class UserActionTracker {
    private actions: UserAction[] = [];
    private maxActions = 10;

    trackAction(type: string, details?: Record<string, any>): void {
        const action: UserAction = {
            type,
            timestamp: new Date(),
            details,
        };

        this.actions.push(action);

        // Keep only the most recent actions
        if (this.actions.length > this.maxActions) {
            this.actions = this.actions.slice(-this.maxActions);
        }
    }

    getRecentActions(): UserAction[] {
        return [...this.actions];
    }

    clearActions(): void {
        this.actions = [];
    }
}

/**
 * Comprehensive error logging and metrics service
 */
export class ErrorLoggingService {
    private static instance: ErrorLoggingService;
    private metrics: ErrorMetrics;
    private userActionTracker: UserActionTracker;
    private sessionId: string;

    private constructor() {
        this.sessionId = this.generateSessionId();
        this.userActionTracker = new UserActionTracker();
        this.metrics = {
            totalErrors: 0,
            errorsByComponent: {},
            errorsByType: {},
            errorsBySeverity: {},
            errorsByTimeframe: {},
            recoverySuccessRate: 0,
            averageRecoveryTime: 0,
            topErrorMessages: [],
            sessionErrors: [],
        };

        // Track user actions for context
        this.setupUserActionTracking();
    }

    static getInstance(): ErrorLoggingService {
        if (!ErrorLoggingService.instance) {
            ErrorLoggingService.instance = new ErrorLoggingService();
        }
        return ErrorLoggingService.instance;
    }

    /**
     * Log a component error with full context
     */
    logError(
        error: Error,
        errorInfo: ErrorInfo,
        componentName: string,
        context?: Record<string, any>
    ): string {
        const errorId = this.generateErrorId();
        const { type, severity } = ErrorCategorizer.categorizeError(error, componentName);

        const errorDetails: ErrorDetails = {
            errorId,
            timestamp: new Date(),
            componentName,
            errorMessage: error.message,
            errorStack: error.stack || undefined,
            componentStack: errorInfo.componentStack || undefined,
            userAgent: navigator.userAgent,
            url: window.location.href,
            userId: this.getUserId(),
            sessionId: this.sessionId,
            buildVersion: this.getBuildVersion(),
            errorType: type,
            severity,
            context,
            recoveryAttempts: 0,
            userActions: this.userActionTracker.getRecentActions(),
        };

        // Update metrics
        this.updateMetrics(errorDetails);

        // Log to console and external services
        this.logToConsole(errorDetails);
        this.logToExternalService(errorDetails);

        // Store in session for analysis
        this.metrics.sessionErrors.push(errorDetails);

        return errorId;
    }

    /**
     * Record error recovery attempt
     */
    recordRecoveryAttempt(errorId: string, success: boolean, recoveryTime?: number): void {
        const errorDetails = this.metrics.sessionErrors.find(e => e.errorId === errorId);
        if (errorDetails) {
            errorDetails.recoveryAttempts = (errorDetails.recoveryAttempts || 0) + 1;
        }

        // Update recovery metrics
        const currentRate = this.metrics.recoverySuccessRate;
        const totalRecoveries = this.metrics.totalErrors;

        if (success) {
            this.metrics.recoverySuccessRate = totalRecoveries > 0
                ? (currentRate * (totalRecoveries - 1) + 1) / totalRecoveries
                : 1;

            if (recoveryTime) {
                this.metrics.averageRecoveryTime =
                    (this.metrics.averageRecoveryTime + recoveryTime) / 2;
            }
        }

        logger.info('Error recovery attempt', {
            errorId,
            success,
            recoveryTime,
            attempts: errorDetails?.recoveryAttempts,
        });
    }

    /**
     * Get current error metrics
     */
    getMetrics(): ErrorMetrics {
        return { ...this.metrics };
    }

    /**
     * Get errors by component
     */
    getErrorsByComponent(componentName: string): ErrorDetails[] {
        return this.metrics.sessionErrors.filter(e => e.componentName === componentName);
    }

    /**
     * Get errors by type
     */
    getErrorsByType(type: ErrorType): ErrorDetails[] {
        return this.metrics.sessionErrors.filter(e => e.errorType === type);
    }

    /**
     * Clear session errors (useful for testing)
     */
    clearSessionErrors(): void {
        this.metrics.sessionErrors = [];
        this.userActionTracker.clearActions();
    }

    /**
     * Track user action for error context
     */
    trackUserAction(type: string, details?: Record<string, any>): void {
        this.userActionTracker.trackAction(type, details);
    }

    /**
     * Update error metrics
     */
    private updateMetrics(errorDetails: ErrorDetails): void {
        this.metrics.totalErrors++;

        // Update component metrics
        const component = errorDetails.componentName;
        this.metrics.errorsByComponent[component] =
            (this.metrics.errorsByComponent[component] || 0) + 1;

        // Update type metrics
        const type = errorDetails.errorType;
        this.metrics.errorsByType[type] =
            (this.metrics.errorsByType[type] || 0) + 1;

        // Update severity metrics
        const severity = errorDetails.severity;
        this.metrics.errorsBySeverity[severity] =
            (this.metrics.errorsBySeverity[severity] || 0) + 1;

        // Update timeframe metrics (hourly)
        const hour = new Date().toISOString().slice(0, 13);
        this.metrics.errorsByTimeframe[hour] =
            (this.metrics.errorsByTimeframe[hour] || 0) + 1;

        // Update top error messages
        this.updateTopErrorMessages(errorDetails.errorMessage);

        // Update last error
        this.metrics.lastError = errorDetails;
    }

    /**
     * Update top error messages tracking
     */
    private updateTopErrorMessages(message: string): void {
        const existing = this.metrics.topErrorMessages.find(e => e.message === message);
        if (existing) {
            existing.count++;
        } else {
            this.metrics.topErrorMessages.push({ message, count: 1 });
        }

        // Keep only top 10 messages
        this.metrics.topErrorMessages.sort((a, b) => b.count - a.count);
        this.metrics.topErrorMessages = this.metrics.topErrorMessages.slice(0, 10);
    }

    /**
     * Log to console with formatting
     */
    private logToConsole(errorDetails: ErrorDetails): void {
        const { componentName, errorMessage, severity, errorType } = errorDetails;

        logger.error(`Component Error in ${componentName}`, {
            errorId: errorDetails.errorId,
            message: errorMessage,
            type: errorType,
            severity,
            timestamp: errorDetails.timestamp.toISOString(),
            url: errorDetails.url,
            userActions: errorDetails.userActions?.slice(-3), // Last 3 actions
        });
    }

    /**
     * Send error to external logging service
     */
    private logToExternalService(errorDetails: ErrorDetails): void {
        // In production, this would send to services like Sentry, LogRocket, etc.
        if (process.env.NODE_ENV === 'production') {
            // Placeholder for external service integration
            console.log('Would send to external error service:', {
                errorId: errorDetails.errorId,
                component: errorDetails.componentName,
                message: errorDetails.errorMessage,
                severity: errorDetails.severity,
                type: errorDetails.errorType,
            });
        }
    }

    /**
     * Setup user action tracking
     */
    private setupUserActionTracking(): void {
        // Track clicks
        document.addEventListener('click', (event) => {
            const target = event.target as HTMLElement;
            this.trackUserAction('click', {
                tagName: target.tagName,
                className: target.className,
                id: target.id,
            });
        });

        // Track navigation
        window.addEventListener('popstate', () => {
            this.trackUserAction('navigation', {
                url: window.location.href,
            });
        });

        // Track errors
        window.addEventListener('error', (event) => {
            this.trackUserAction('javascript_error', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
            });
        });
    }

    /**
     * Generate unique error ID
     */
    private generateErrorId(): string {
        return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Generate session ID
     */
    private generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get user ID from authentication context
     */
    private getUserId(): string | null {
        try {
            const user = localStorage.getItem('user');
            return user ? JSON.parse(user).id : null;
        } catch {
            return null;
        }
    }

    /**
     * Get build version from environment
     */
    private getBuildVersion(): string {
        return (import.meta.env.VITE_BUILD_VERSION as string) || 'unknown';
    }
}

// Export singleton instance
export const errorLoggingService = ErrorLoggingService.getInstance();
export default errorLoggingService;