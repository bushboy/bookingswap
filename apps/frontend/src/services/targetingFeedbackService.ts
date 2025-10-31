/**
 * Targeting Authentication Feedback Service
 * 
 * This service provides clear error messages and user feedback for targeting-specific
 * authentication problems, with retry options that don't affect the main session.
 * 
 * Requirements satisfied:
 * - 4.1: Clear error messages for targeting-specific authentication problems
 * - 4.2: User feedback that explains targeting issues without suggesting logout
 * - 4.3: Retry options for targeting operations that don't affect main session
 * - 4.4: Detailed error information for authentication failures
 */

import { AuthErrorType } from '@/types/authError';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface TargetingFeedbackMessage {
    title: string;
    message: string;
    type: 'info' | 'warning' | 'error' | 'success';
    icon: string;
    showRetryOption: boolean;
    retryButtonText?: string;
    dismissible: boolean;
    preservesMainAuth: boolean;
    technicalDetails?: string;
    actionRecommendations?: string[];
}

export interface TargetingFeedbackContext {
    operation?: string;
    swapId?: string;
    targetSwapId?: string;
    endpoint?: string;
    errorCode?: string;
    isRetry?: boolean;
    retryCount?: number;
}

export interface TargetingFeedbackOptions {
    showTechnicalDetails?: boolean;
    includeRetryOption?: boolean;
    customRetryText?: string;
    autoHideAfter?: number; // milliseconds
}

// ============================================================================
// Targeting Feedback Service Class
// ============================================================================

export class TargetingFeedbackService {
    private static instance: TargetingFeedbackService;
    private feedbackHistory: Array<{
        timestamp: Date;
        message: TargetingFeedbackMessage;
        context: TargetingFeedbackContext;
    }> = [];

    private constructor() { }

    /**
     * Get singleton instance
     */
    static getInstance(): TargetingFeedbackService {
        if (!TargetingFeedbackService.instance) {
            TargetingFeedbackService.instance = new TargetingFeedbackService();
        }
        return TargetingFeedbackService.instance;
    }

    /**
     * Generate user feedback for targeting authentication errors
     */
    generateTargetingAuthFeedback(
        errorType: AuthErrorType,
        context: TargetingFeedbackContext = {},
        options: TargetingFeedbackOptions = {}
    ): TargetingFeedbackMessage {
        const feedback = this.createFeedbackForErrorType(errorType, context, options);

        // Store in history for analytics
        this.feedbackHistory.push({
            timestamp: new Date(),
            message: feedback,
            context
        });

        // Keep only last 100 feedback messages
        if (this.feedbackHistory.length > 100) {
            this.feedbackHistory = this.feedbackHistory.slice(-100);
        }

        return feedback;
    }

    /**
     * Generate feedback for successful targeting operations
     */
    generateTargetingSuccessFeedback(
        operation: string,
        context: TargetingFeedbackContext = {},
        options: TargetingFeedbackOptions = {}
    ): TargetingFeedbackMessage {
        const operationMessages = {
            'target': 'Swap targeting completed successfully',
            'retarget': 'Swap retargeting completed successfully',
            'remove_target': 'Target removed successfully',
            'get_status': 'Targeting status loaded successfully',
            'get_history': 'Targeting history loaded successfully',
            'validate': 'Targeting validation completed successfully'
        };

        const message = operationMessages[operation as keyof typeof operationMessages] ||
            'Targeting operation completed successfully';

        const feedback: TargetingFeedbackMessage = {
            title: 'Targeting Success',
            message,
            type: 'success',
            icon: '✅',
            showRetryOption: false,
            dismissible: true,
            preservesMainAuth: true,
            actionRecommendations: [
                'Your targeting information has been updated',
                'Changes will be reflected in your swap listings'
            ]
        };

        if (options.showTechnicalDetails) {
            feedback.technicalDetails = `Operation: ${operation}, Swap: ${context.swapId || 'N/A'}`;
        }

        return feedback;
    }

    /**
     * Generate feedback for targeting operation retries
     */
    generateRetryFeedback(
        operation: string,
        retryCount: number,
        maxRetries: number,
        context: TargetingFeedbackContext = {}
    ): TargetingFeedbackMessage {
        const isLastRetry = retryCount >= maxRetries;

        return {
            title: isLastRetry ? 'Targeting Retry Failed' : 'Retrying Targeting Operation',
            message: isLastRetry
                ? `Unable to complete targeting operation after ${maxRetries} attempts. Your main session remains active.`
                : `Retrying targeting operation (attempt ${retryCount + 1}/${maxRetries})...`,
            type: isLastRetry ? 'warning' : 'info',
            icon: isLastRetry ? '⚠️' : '🔄',
            showRetryOption: isLastRetry,
            retryButtonText: 'Try Again',
            dismissible: true,
            preservesMainAuth: true,
            actionRecommendations: isLastRetry ? [
                'Check your internet connection',
                'Try refreshing the page',
                'Contact support if the issue persists'
            ] : [
                'Please wait while we retry the operation',
                'Your main session is not affected'
            ]
        };
    }

    /**
     * Generate feedback for network-related targeting issues
     */
    generateNetworkFeedback(
        context: TargetingFeedbackContext = {},
        options: TargetingFeedbackOptions = {}
    ): TargetingFeedbackMessage {
        return {
            title: 'Targeting Connection Issue',
            message: 'Unable to connect to targeting services. Your swaps and main session are not affected.',
            type: 'warning',
            icon: '🌐',
            showRetryOption: options.includeRetryOption !== false,
            retryButtonText: options.customRetryText || 'Retry Connection',
            dismissible: true,
            preservesMainAuth: true,
            technicalDetails: options.showTechnicalDetails ?
                `Endpoint: ${context.endpoint || 'Unknown'}, Operation: ${context.operation || 'Unknown'}` :
                undefined,
            actionRecommendations: [
                'Check your internet connection',
                'Targeting features will be restored when connection is available',
                'Your swaps remain accessible'
            ]
        };
    }

    /**
     * Generate feedback for permission-related targeting issues
     */
    generatePermissionFeedback(
        context: TargetingFeedbackContext = {},
        options: TargetingFeedbackOptions = {}
    ): TargetingFeedbackMessage {
        const isSwapSpecific = !!context.swapId;

        return {
            title: 'Targeting Access Limited',
            message: isSwapSpecific
                ? 'You don\'t have permission to access targeting information for this swap.'
                : 'Some targeting features are not available with your current permissions.',
            type: 'info',
            icon: '🔒',
            showRetryOption: false,
            dismissible: true,
            preservesMainAuth: true,
            actionRecommendations: [
                'This is normal for swaps you don\'t own',
                'Your main swap functionality is not affected',
                'Contact the swap owner if you need access'
            ]
        };
    }

    /**
     * Generate feedback for false positive authentication failures
     */
    generateFalsePositiveFeedback(
        context: TargetingFeedbackContext = {},
        options: TargetingFeedbackOptions = {}
    ): TargetingFeedbackMessage {
        return {
            title: 'Temporary Targeting Issue',
            message: 'Temporary authentication issue with targeting services. Your main session is secure and unaffected.',
            type: 'warning',
            icon: '🎯',
            showRetryOption: options.includeRetryOption !== false,
            retryButtonText: options.customRetryText || 'Retry Targeting',
            dismissible: true,
            preservesMainAuth: true,
            technicalDetails: options.showTechnicalDetails ?
                `This appears to be a temporary validation issue. Error: ${context.errorCode || 'Unknown'}` :
                undefined,
            actionRecommendations: [
                'This is likely a temporary issue',
                'Your authentication is valid and secure',
                'Targeting features should work normally after retry'
            ]
        };
    }

    /**
     * Get feedback history for analytics
     */
    getFeedbackHistory(limit: number = 50): Array<{
        timestamp: Date;
        message: TargetingFeedbackMessage;
        context: TargetingFeedbackContext;
    }> {
        return this.feedbackHistory
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, limit);
    }

    /**
     * Get feedback statistics
     */
    getFeedbackStats(): {
        totalFeedback: number;
        errorCount: number;
        warningCount: number;
        successCount: number;
        retryCount: number;
        mostCommonErrors: Array<{ errorType: string; count: number }>;
    } {
        const stats = {
            totalFeedback: this.feedbackHistory.length,
            errorCount: 0,
            warningCount: 0,
            successCount: 0,
            retryCount: 0,
            mostCommonErrors: [] as Array<{ errorType: string; count: number }>
        };

        const errorCounts: Record<string, number> = {};

        for (const entry of this.feedbackHistory) {
            switch (entry.message.type) {
                case 'error':
                    stats.errorCount++;
                    break;
                case 'warning':
                    stats.warningCount++;
                    break;
                case 'success':
                    stats.successCount++;
                    break;
            }

            if (entry.context.isRetry) {
                stats.retryCount++;
            }

            if (entry.context.errorCode) {
                errorCounts[entry.context.errorCode] = (errorCounts[entry.context.errorCode] || 0) + 1;
            }
        }

        stats.mostCommonErrors = Object.entries(errorCounts)
            .map(([errorType, count]) => ({ errorType, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        return stats;
    }

    /**
     * Clear feedback history
     */
    clearHistory(): void {
        this.feedbackHistory = [];
    }

    // ============================================================================
    // Private Helper Methods
    // ============================================================================

    /**
     * Create feedback message for specific error type
     */
    private createFeedbackForErrorType(
        errorType: AuthErrorType,
        context: TargetingFeedbackContext,
        options: TargetingFeedbackOptions
    ): TargetingFeedbackMessage {
        switch (errorType) {
            case AuthErrorType.TARGETING_AUTH_FAILURE:
                return {
                    title: 'Targeting Authentication Issue',
                    message: 'Temporary issue accessing targeting information. Your main session remains secure.',
                    type: 'warning',
                    icon: '🎯',
                    showRetryOption: options.includeRetryOption !== false,
                    retryButtonText: options.customRetryText || 'Retry Targeting',
                    dismissible: true,
                    preservesMainAuth: true,
                    technicalDetails: options.showTechnicalDetails ?
                        `Error: ${context.errorCode || 'TARGETING_AUTH_FAILURE'}` : undefined,
                    actionRecommendations: [
                        'This is a temporary targeting service issue',
                        'Your main authentication is not affected',
                        'Retry should resolve the issue'
                    ]
                };

            case AuthErrorType.TARGETING_TOKEN_VALIDATION_FAILED:
                return this.generateFalsePositiveFeedback(context, options);

            case AuthErrorType.TARGETING_PERMISSION_DENIED:
                return this.generatePermissionFeedback(context, options);

            case AuthErrorType.CROSS_USER_ACCESS_DENIED:
                return {
                    title: 'Cross-User Access Restricted',
                    message: 'Cannot access targeting information for swaps owned by other users.',
                    type: 'info',
                    icon: '👥',
                    showRetryOption: false,
                    dismissible: true,
                    preservesMainAuth: true,
                    actionRecommendations: [
                        'This is normal security behavior',
                        'You can only target swaps you have permission to access',
                        'Your own swaps are not affected'
                    ]
                };

            case AuthErrorType.FALSE_POSITIVE_AUTH_FAILURE:
                return this.generateFalsePositiveFeedback(context, options);

            case AuthErrorType.NETWORK_ERROR:
                return this.generateNetworkFeedback(context, options);

            case AuthErrorType.SERVER_ERROR:
                return {
                    title: 'Targeting Service Unavailable',
                    message: 'Targeting services are temporarily unavailable. Your swaps and main session are not affected.',
                    type: 'warning',
                    icon: '🔧',
                    showRetryOption: options.includeRetryOption !== false,
                    retryButtonText: options.customRetryText || 'Retry Service',
                    dismissible: true,
                    preservesMainAuth: true,
                    actionRecommendations: [
                        'This is a temporary service issue',
                        'Your swaps remain fully accessible',
                        'Targeting features will be restored shortly'
                    ]
                };

            case AuthErrorType.RATE_LIMIT_EXCEEDED:
                return {
                    title: 'Targeting Rate Limit',
                    message: 'Too many targeting requests. Please wait a moment before trying again.',
                    type: 'info',
                    icon: '⏱️',
                    showRetryOption: options.includeRetryOption !== false,
                    retryButtonText: options.customRetryText || 'Try Again',
                    dismissible: true,
                    preservesMainAuth: true,
                    actionRecommendations: [
                        'Wait 30 seconds before retrying',
                        'Your main session is not affected',
                        'This helps maintain service quality for all users'
                    ]
                };

            // Standard auth errors that shouldn't happen in targeting context
            case AuthErrorType.TOKEN_EXPIRED:
            case AuthErrorType.TOKEN_INVALID:
            case AuthErrorType.TOKEN_MISSING:
                return {
                    title: 'Authentication Required',
                    message: 'Your session has expired. Please log in again to access targeting features.',
                    type: 'error',
                    icon: '🔐',
                    showRetryOption: false,
                    dismissible: true,
                    preservesMainAuth: false, // These are genuine auth failures
                    actionRecommendations: [
                        'Please log in again',
                        'Your data has been saved',
                        'You will be redirected to the login page'
                    ]
                };

            default:
                return {
                    title: 'Targeting Issue',
                    message: 'An unexpected issue occurred with targeting services. Your main session is preserved.',
                    type: 'warning',
                    icon: '❓',
                    showRetryOption: options.includeRetryOption !== false,
                    retryButtonText: options.customRetryText || 'Retry',
                    dismissible: true,
                    preservesMainAuth: true,
                    technicalDetails: options.showTechnicalDetails ?
                        `Error Type: ${errorType}, Code: ${context.errorCode || 'Unknown'}` : undefined,
                    actionRecommendations: [
                        'This is an unexpected targeting issue',
                        'Your main session and swaps are not affected',
                        'Try refreshing the page if the issue persists'
                    ]
                };
        }
    }
}

// ============================================================================
// Singleton Instance and Convenience Functions
// ============================================================================

/**
 * Singleton instance of the targeting feedback service
 */
export const targetingFeedbackService = TargetingFeedbackService.getInstance();

/**
 * Convenience function for generating targeting auth feedback
 */
export const generateTargetingAuthFeedback = (
    errorType: AuthErrorType,
    context?: TargetingFeedbackContext,
    options?: TargetingFeedbackOptions
) => {
    return targetingFeedbackService.generateTargetingAuthFeedback(errorType, context, options);
};

/**
 * Convenience function for generating targeting success feedback
 */
export const generateTargetingSuccessFeedback = (
    operation: string,
    context?: TargetingFeedbackContext,
    options?: TargetingFeedbackOptions
) => {
    return targetingFeedbackService.generateTargetingSuccessFeedback(operation, context, options);
};

/**
 * Convenience function for generating retry feedback
 */
export const generateRetryFeedback = (
    operation: string,
    retryCount: number,
    maxRetries: number,
    context?: TargetingFeedbackContext
) => {
    return targetingFeedbackService.generateRetryFeedback(operation, retryCount, maxRetries, context);
};

export default targetingFeedbackService;