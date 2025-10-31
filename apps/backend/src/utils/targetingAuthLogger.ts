/**
 * Targeting-Specific Authentication Logger
 * 
 * This utility provides comprehensive logging for targeting-related authentication
 * attempts, failures, and token validation processes to help identify false positive
 * authentication failures and debug targeting-specific issues.
 * 
 * Requirements satisfied:
 * - 4.1: Log all targeting-related authentication attempts and failures
 * - 4.2: Add detailed logging for token validation in targeting operations
 * - 4.3: Implement logging that helps identify false positive authentication failures
 * - 4.4: Provide detailed error information for authentication failures
 */

import { Request } from 'express';
import { enhancedLogger } from './logger';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface TargetingAuthLogContext {
    requestId: string;
    userId?: string;
    endpoint: string;
    method: string;
    operation: string;
    sourceSwapId?: string;
    targetSwapId?: string;
    userAgent?: string;
    ipAddress?: string;
    timestamp: Date;
}

export interface TargetingAuthAttempt {
    context: TargetingAuthLogContext;
    tokenPresent: boolean;
    tokenFormat?: 'valid_jwt' | 'invalid_format' | 'missing';
    tokenExpiry?: Date;
    tokenUserId?: string;
    tokenScopes?: string[];
    step: 'token_extraction' | 'token_verification' | 'user_lookup' | 'authorization' | 'success' | 'request_attachment';
    duration?: number;
}

export interface TargetingAuthFailure extends TargetingAuthAttempt {
    errorCode: string;
    errorMessage: string;
    errorCategory: 'authentication' | 'authorization' | 'validation' | 'system';
    isFalsePositive: boolean;
    preservesMainAuth: boolean;
    retryRecommended: boolean;
    debugInfo?: Record<string, any>;
}

export interface TargetingAuthSuccess extends TargetingAuthAttempt {
    finalUserId: string;
    authorizationChecks: string[];
    performanceMetrics: {
        tokenValidationTime: number;
        userLookupTime: number;
        authorizationTime: number;
        totalTime: number;
    };
}

export interface TargetingAuthStats {
    totalAttempts: number;
    successfulAttempts: number;
    failedAttempts: number;
    falsePositiveAttempts: number;
    averageResponseTime: number;
    errorBreakdown: Record<string, number>;
    operationBreakdown: Record<string, number>;
    timeRange: {
        start: Date;
        end: Date;
    };
}

// ============================================================================
// Targeting Authentication Logger Class
// ============================================================================

export class TargetingAuthLogger {
    private static instance: TargetingAuthLogger;
    private authAttempts: Map<string, TargetingAuthAttempt> = new Map();
    private authStats: TargetingAuthStats = this.initializeStats();
    private readonly MAX_STORED_ATTEMPTS = 1000;

    private constructor() { }

    /**
     * Get singleton instance
     */
    static getInstance(): TargetingAuthLogger {
        if (!TargetingAuthLogger.instance) {
            TargetingAuthLogger.instance = new TargetingAuthLogger();
        }
        return TargetingAuthLogger.instance;
    }

    /**
     * Log targeting authentication attempt start
     */
    logAuthAttemptStart(
        req: Request,
        operation: string,
        sourceSwapId?: string,
        targetSwapId?: string
    ): string {
        const requestId = this.generateRequestId();
        const context: TargetingAuthLogContext = {
            requestId,
            endpoint: req.path,
            method: req.method,
            operation,
            sourceSwapId,
            targetSwapId,
            userAgent: req.headers['user-agent'],
            ipAddress: req.ip,
            timestamp: new Date()
        };

        const attempt: TargetingAuthAttempt = {
            context,
            tokenPresent: !!req.headers.authorization,
            step: 'token_extraction'
        };

        this.authAttempts.set(requestId, attempt);
        this.authStats.totalAttempts++;

        enhancedLogger.info('Targeting authentication attempt started', {
            category: 'targeting_authentication',
            requestId,
            endpoint: req.path,
            method: req.method,
            operation,
            sourceSwapId,
            targetSwapId,
            tokenPresent: attempt.tokenPresent,
            userAgent: context.userAgent,
            ipAddress: context.ipAddress
        });

        return requestId;
    }

    /**
     * Log token validation details
     */
    logTokenValidation(
        requestId: string,
        tokenFormat: TargetingAuthAttempt['tokenFormat'],
        tokenExpiry?: Date,
        tokenUserId?: string,
        tokenScopes?: string[]
    ): void {
        const attempt = this.authAttempts.get(requestId);
        if (!attempt) {
            enhancedLogger.warn('Token validation logged for unknown request', { requestId });
            return;
        }

        attempt.tokenFormat = tokenFormat;
        attempt.tokenExpiry = tokenExpiry;
        attempt.tokenUserId = tokenUserId;
        attempt.tokenScopes = tokenScopes;
        attempt.step = 'token_verification';

        enhancedLogger.debug('Targeting token validation details', {
            category: 'targeting_authentication',
            requestId,
            tokenFormat,
            tokenExpiry: tokenExpiry?.toISOString(),
            tokenUserId,
            tokenScopes,
            operation: attempt.context.operation,
            endpoint: attempt.context.endpoint
        });
    }

    /**
     * Log user lookup details
     */
    logUserLookup(
        requestId: string,
        userId: string,
        userFound: boolean,
        lookupTime: number
    ): void {
        const attempt = this.authAttempts.get(requestId);
        if (!attempt) {
            enhancedLogger.warn('User lookup logged for unknown request', { requestId });
            return;
        }

        attempt.context.userId = userId;
        attempt.step = 'user_lookup';

        enhancedLogger.debug('Targeting user lookup completed', {
            category: 'targeting_authentication',
            requestId,
            userId,
            userFound,
            lookupTime,
            operation: attempt.context.operation,
            endpoint: attempt.context.endpoint
        });
    }

    /**
     * Log authorization checks
     */
    logAuthorizationCheck(
        requestId: string,
        checkType: string,
        checkResult: boolean,
        checkDetails?: Record<string, any>
    ): void {
        const attempt = this.authAttempts.get(requestId);
        if (!attempt) {
            enhancedLogger.warn('Authorization check logged for unknown request', { requestId });
            return;
        }

        attempt.step = 'authorization';

        enhancedLogger.debug('Targeting authorization check', {
            category: 'targeting_authentication',
            requestId,
            checkType,
            checkResult,
            checkDetails,
            operation: attempt.context.operation,
            endpoint: attempt.context.endpoint,
            userId: attempt.context.userId
        });
    }

    /**
     * Log successful targeting authentication
     */
    logAuthSuccess(
        requestId: string,
        finalUserId: string,
        authorizationChecks: string[],
        performanceMetrics: TargetingAuthSuccess['performanceMetrics']
    ): void {
        const attempt = this.authAttempts.get(requestId);
        if (!attempt) {
            enhancedLogger.warn('Auth success logged for unknown request', { requestId });
            return;
        }

        const success: TargetingAuthSuccess = {
            ...attempt,
            step: 'success',
            finalUserId,
            authorizationChecks,
            performanceMetrics,
            duration: performanceMetrics.totalTime
        };

        this.authAttempts.set(requestId, success);
        this.authStats.successfulAttempts++;
        this.updateAverageResponseTime(performanceMetrics.totalTime);

        enhancedLogger.info('Targeting authentication successful', {
            category: 'targeting_authentication',
            requestId,
            userId: finalUserId,
            operation: attempt.context.operation,
            endpoint: attempt.context.endpoint,
            sourceSwapId: attempt.context.sourceSwapId,
            targetSwapId: attempt.context.targetSwapId,
            authorizationChecks,
            performanceMetrics,
            tokenFormat: attempt.tokenFormat,
            tokenScopes: attempt.tokenScopes
        });

        // Log performance metrics separately for monitoring
        enhancedLogger.logPerformanceMetric(
            'targeting_authentication_success',
            performanceMetrics.totalTime,
            true,
            {
                requestId,
                operation: attempt.context.operation,
                endpoint: attempt.context.endpoint,
                tokenValidationTime: performanceMetrics.tokenValidationTime,
                userLookupTime: performanceMetrics.userLookupTime,
                authorizationTime: performanceMetrics.authorizationTime
            }
        );
    }

    /**
     * Log targeting authentication failure
     */
    logAuthFailure(
        requestId: string,
        errorCode: string,
        errorMessage: string,
        errorCategory: TargetingAuthFailure['errorCategory'],
        step: TargetingAuthAttempt['step'],
        duration: number,
        debugInfo?: Record<string, any>
    ): void {
        const attempt = this.authAttempts.get(requestId);
        if (!attempt) {
            enhancedLogger.warn('Auth failure logged for unknown request', { requestId });
            return;
        }

        // Determine if this is likely a false positive
        const isFalsePositive = this.isFalsePositiveFailure(
            errorCode,
            errorMessage,
            attempt,
            debugInfo
        );

        const failure: TargetingAuthFailure = {
            ...attempt,
            step,
            errorCode,
            errorMessage,
            errorCategory,
            isFalsePositive,
            preservesMainAuth: true, // Targeting failures always preserve main auth
            retryRecommended: this.shouldRecommendRetry(errorCode, errorCategory, isFalsePositive),
            duration,
            debugInfo
        };

        this.authAttempts.set(requestId, failure);
        this.authStats.failedAttempts++;
        if (isFalsePositive) {
            this.authStats.falsePositiveAttempts++;
        }
        this.updateErrorStats(errorCode);
        this.updateOperationStats(attempt.context.operation);
        this.updateAverageResponseTime(duration);

        // Log with appropriate severity
        const logLevel = isFalsePositive ? 'warn' : 'error';
        const logMethod = logLevel === 'warn' ? enhancedLogger.warn : enhancedLogger.error;

        logMethod('Targeting authentication failed', {
            category: 'targeting_authentication',
            requestId,
            errorCode,
            errorMessage,
            errorCategory,
            step,
            operation: attempt.context.operation,
            endpoint: attempt.context.endpoint,
            sourceSwapId: attempt.context.sourceSwapId,
            targetSwapId: attempt.context.targetSwapId,
            userId: attempt.context.userId,
            tokenFormat: attempt.tokenFormat,
            tokenScopes: attempt.tokenScopes,
            isFalsePositive,
            preservesMainAuth: failure.preservesMainAuth,
            retryRecommended: failure.retryRecommended,
            duration,
            debugInfo
        });

        // Log security event for genuine authentication failures
        if (!isFalsePositive && errorCategory === 'authentication') {
            enhancedLogger.logSecurityEvent(
                'targeting_authentication_failure',
                'medium', // Lower severity for targeting operations
                attempt.context.userId,
                attempt.context.ipAddress,
                {
                    requestId,
                    errorCode,
                    errorMessage,
                    operation: attempt.context.operation,
                    endpoint: attempt.context.endpoint,
                    preservesMainAuth: true
                }
            );
        }
    }

    /**
     * Log false positive authentication failure
     */
    logFalsePositiveFailure(
        requestId: string,
        originalError: string,
        detectionReason: string,
        correctionAction: string
    ): void {
        const attempt = this.authAttempts.get(requestId);
        if (!attempt) {
            enhancedLogger.warn('False positive logged for unknown request', { requestId });
            return;
        }

        enhancedLogger.warn('False positive targeting authentication failure detected', {
            category: 'targeting_authentication_false_positive',
            requestId,
            originalError,
            detectionReason,
            correctionAction,
            operation: attempt.context.operation,
            endpoint: attempt.context.endpoint,
            sourceSwapId: attempt.context.sourceSwapId,
            targetSwapId: attempt.context.targetSwapId,
            userId: attempt.context.userId,
            preservesMainAuth: true
        });

        this.authStats.falsePositiveAttempts++;
    }

    /**
     * Get targeting authentication statistics
     */
    getAuthStats(): TargetingAuthStats {
        return { ...this.authStats };
    }

    /**
     * Get recent authentication attempts
     */
    getRecentAttempts(limit: number = 50): TargetingAuthAttempt[] {
        const attempts = Array.from(this.authAttempts.values())
            .sort((a, b) => b.context.timestamp.getTime() - a.context.timestamp.getTime())
            .slice(0, limit);

        return attempts;
    }

    /**
     * Get failed attempts for analysis
     */
    getFailedAttempts(limit: number = 50): TargetingAuthFailure[] {
        const attempts = Array.from(this.authAttempts.values())
            .filter((attempt): attempt is TargetingAuthFailure =>
                'errorCode' in attempt
            )
            .sort((a, b) => b.context.timestamp.getTime() - a.context.timestamp.getTime())
            .slice(0, limit);

        return attempts;
    }

    /**
     * Get false positive attempts for analysis
     */
    getFalsePositiveAttempts(limit: number = 50): TargetingAuthFailure[] {
        return this.getFailedAttempts(limit * 2)
            .filter(attempt => attempt.isFalsePositive)
            .slice(0, limit);
    }

    /**
     * Clear old authentication attempts to prevent memory leaks
     */
    clearOldAttempts(): void {
        if (this.authAttempts.size <= this.MAX_STORED_ATTEMPTS) {
            return;
        }

        const attempts = Array.from(this.authAttempts.entries())
            .sort(([, a], [, b]) => a.context.timestamp.getTime() - b.context.timestamp.getTime());

        const toDelete = attempts.slice(0, attempts.length - this.MAX_STORED_ATTEMPTS);
        toDelete.forEach(([requestId]) => {
            this.authAttempts.delete(requestId);
        });

        enhancedLogger.debug('Cleared old targeting auth attempts', {
            category: 'targeting_authentication',
            deletedCount: toDelete.length,
            remainingCount: this.authAttempts.size
        });
    }

    /**
     * Reset authentication statistics
     */
    resetStats(): void {
        this.authStats = this.initializeStats();
        enhancedLogger.info('Targeting authentication statistics reset', {
            category: 'targeting_authentication'
        });
    }

    // ============================================================================
    // Private Helper Methods
    // ============================================================================

    /**
     * Generate unique request ID
     */
    private generateRequestId(): string {
        return `targeting-auth-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    }

    /**
     * Initialize authentication statistics
     */
    private initializeStats(): TargetingAuthStats {
        return {
            totalAttempts: 0,
            successfulAttempts: 0,
            failedAttempts: 0,
            falsePositiveAttempts: 0,
            averageResponseTime: 0,
            errorBreakdown: {},
            operationBreakdown: {},
            timeRange: {
                start: new Date(),
                end: new Date()
            }
        };
    }

    /**
     * Determine if an authentication failure is likely a false positive
     */
    private isFalsePositiveFailure(
        errorCode: string,
        errorMessage: string,
        attempt: TargetingAuthAttempt,
        debugInfo?: Record<string, any>
    ): boolean {
        // Check for known false positive patterns
        const falsePositivePatterns = [
            'cross-user',
            'targeting scope',
            'swap access',
            'targeting permission',
            'targeting validation failed'
        ];

        const messageContainsFalsePositive = falsePositivePatterns.some(pattern =>
            errorMessage.toLowerCase().includes(pattern)
        );

        // Check for targeting-specific error codes that are likely false positives
        const falsePositiveErrorCodes = [
            'TARGETING_TOKEN_VALIDATION_FAILED',
            'TARGETING_PERMISSION_DENIED',
            'CROSS_USER_ACCESS_DENIED',
            'TARGETING_SCOPE_REQUIRED'
        ];

        const isTargetingSpecificError = falsePositiveErrorCodes.includes(errorCode);

        // Check if token format was valid but validation failed
        const validTokenButFailed = attempt.tokenFormat === 'valid_jwt' &&
            errorCode.includes('TOKEN_VALIDATION_FAILED');

        // Check debug info for additional false positive indicators
        const debugIndicatesFalsePositive = debugInfo && (
            debugInfo.preservesMainAuth === true ||
            debugInfo.isTargetingRelated === true ||
            debugInfo.tokenValidationInconsistent === true
        );

        return messageContainsFalsePositive ||
            isTargetingSpecificError ||
            validTokenButFailed ||
            !!debugIndicatesFalsePositive;
    }

    /**
     * Determine if retry should be recommended
     */
    private shouldRecommendRetry(
        errorCode: string,
        errorCategory: TargetingAuthFailure['errorCategory'],
        isFalsePositive: boolean
    ): boolean {
        // Always recommend retry for false positives
        if (isFalsePositive) {
            return true;
        }

        // Recommend retry for system errors
        if (errorCategory === 'system') {
            return true;
        }

        // Recommend retry for specific targeting errors
        const retryableErrorCodes = [
            'TARGETING_TOKEN_VALIDATION_FAILED',
            'NETWORK_ERROR',
            'DATABASE_ERROR',
            'RATE_LIMIT_EXCEEDED'
        ];

        return retryableErrorCodes.includes(errorCode);
    }

    /**
     * Update error statistics
     */
    private updateErrorStats(errorCode: string): void {
        this.authStats.errorBreakdown[errorCode] =
            (this.authStats.errorBreakdown[errorCode] || 0) + 1;
    }

    /**
     * Update operation statistics
     */
    private updateOperationStats(operation: string): void {
        this.authStats.operationBreakdown[operation] =
            (this.authStats.operationBreakdown[operation] || 0) + 1;
    }

    /**
     * Update average response time
     */
    private updateAverageResponseTime(duration: number): void {
        const totalAttempts = this.authStats.totalAttempts;
        const currentAverage = this.authStats.averageResponseTime;

        this.authStats.averageResponseTime =
            ((currentAverage * (totalAttempts - 1)) + duration) / totalAttempts;
    }
}

// ============================================================================
// Singleton Instance and Convenience Functions
// ============================================================================

/**
 * Singleton instance of the targeting authentication logger
 */
export const targetingAuthLogger = TargetingAuthLogger.getInstance();

/**
 * Convenience function for logging authentication attempt start
 */
export const logTargetingAuthAttempt = (
    req: Request,
    operation: string,
    sourceSwapId?: string,
    targetSwapId?: string
) => {
    return targetingAuthLogger.logAuthAttemptStart(req, operation, sourceSwapId, targetSwapId);
};

/**
 * Convenience function for logging authentication success
 */
export const logTargetingAuthSuccess = (
    requestId: string,
    userId: string,
    authorizationChecks: string[],
    performanceMetrics: TargetingAuthSuccess['performanceMetrics']
) => {
    return targetingAuthLogger.logAuthSuccess(requestId, userId, authorizationChecks, performanceMetrics);
};

/**
 * Convenience function for logging authentication failure
 */
export const logTargetingAuthFailure = (
    requestId: string,
    errorCode: string,
    errorMessage: string,
    errorCategory: TargetingAuthFailure['errorCategory'],
    step: TargetingAuthAttempt['step'],
    duration: number,
    debugInfo?: Record<string, any>
) => {
    return targetingAuthLogger.logAuthFailure(
        requestId,
        errorCode,
        errorMessage,
        errorCategory,
        step,
        duration,
        debugInfo
    );
};

export default targetingAuthLogger; 