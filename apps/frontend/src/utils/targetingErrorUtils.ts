/**
 * Targeting Error Utilities
 * 
 * Utilities for identifying and handling targeting-related errors
 * across different API services and interceptors.
 * 
 * Requirements satisfied:
 * - 2.2: Distinguish auth failures from authorization issues
 * - 2.3: Prevent false positive authentication failures
 * - 2.4: Maintain authentication state consistency
 */

export interface TargetingErrorInfo {
    isTargetingError: boolean;
    preservesMainAuth: boolean;
    operation?: string;
    errorCode?: string;
    errorCategory?: 'authentication' | 'authorization' | 'validation' | 'business' | 'system';
    shouldRetry?: boolean;
    retryDelay?: number;
}

/**
 * Check if an error is targeting-related
 */
export function isTargetingError(error: any): boolean {
    // Check error object properties
    if (error.isTargetingAuthError || error.isTargetingAuthorizationError) {
        return true;
    }

    // Check response data
    const errorData = error.response?.data?.error;
    if (errorData?.isTargetingRelated) {
        return true;
    }

    // Check response headers
    const headers = error.response?.headers;
    if (headers?.['x-targeting-auth-error'] || headers?.['x-targeting-operation']) {
        return true;
    }

    // Check request headers
    const requestHeaders = error.config?.headers;
    if (requestHeaders?.['X-Targeting-Request'] === 'true') {
        return true;
    }

    // Check URL patterns
    const url = error.config?.url || '';
    const targetingPatterns = [
        '/targeting-status',
        '/target',
        '/retarget',
        '/validate-targeting',
        '/can-target',
        '/auction-eligibility',
        '/one-for-one-eligibility',
        '/targeting-history',
        '/targeting-activity',
        '/targeted-by'
    ];

    return targetingPatterns.some(pattern => url.includes(pattern));
}

/**
 * Extract targeting error information from an error object
 */
export function getTargetingErrorInfo(error: any): TargetingErrorInfo {
    const isTargeting = isTargetingError(error);

    if (!isTargeting) {
        return {
            isTargetingError: false,
            preservesMainAuth: false
        };
    }

    // Extract information from various sources
    const errorData = error.response?.data?.error;
    const headers = error.response?.headers;
    const requestHeaders = error.config?.headers;

    const preservesMainAuth =
        error.preservesMainAuth ??
        errorData?.preservesMainAuth ??
        (headers?.['x-preserves-main-auth'] === 'true' || true); // Default to true for targeting errors

    const operation =
        error.targetingOperation ??
        errorData?.targetingContext?.operation ??
        requestHeaders?.['X-Targeting-Operation'] ??
        headers?.['x-targeting-operation'];

    const errorCode =
        error.targetingErrorCode ??
        errorData?.code ??
        headers?.['x-targeting-auth-error'];

    const errorCategory = errorData?.category ||
        (error.response?.status === 401 ? 'authentication' :
            error.response?.status === 403 ? 'authorization' : 'system');

    // Determine retry behavior
    const shouldRetry =
        errorCategory === 'authentication' && preservesMainAuth ||
        errorCategory === 'system' ||
        error.response?.status >= 500;

    const retryDelay = shouldRetry ?
        (errorCategory === 'authentication' ? 1000 : 2000) : undefined;

    return {
        isTargetingError: true,
        preservesMainAuth,
        operation,
        errorCode,
        errorCategory: errorCategory as any,
        shouldRetry,
        retryDelay
    };
}

/**
 * Check if a targeting error should trigger logout
 */
export function shouldTargetingErrorTriggerLogout(error: any): boolean {
    const errorInfo = getTargetingErrorInfo(error);

    if (!errorInfo.isTargetingError) {
        // Non-targeting errors follow normal logout logic
        return error.response?.status === 401;
    }

    // Targeting errors should only trigger logout if they don't preserve main auth
    return !errorInfo.preservesMainAuth && error.response?.status === 401;
}

/**
 * Get user-friendly error message for targeting errors
 */
export function getTargetingErrorMessage(error: any): string {
    const errorInfo = getTargetingErrorInfo(error);

    if (!errorInfo.isTargetingError) {
        return error.message || 'An error occurred';
    }

    const errorData = error.response?.data?.error;
    const baseMessage = errorData?.message || error.message || 'Targeting operation failed';

    // Add context for targeting-specific errors
    if (errorInfo.errorCategory === 'authentication' && errorInfo.preservesMainAuth) {
        return `${baseMessage}. Your main session is preserved.`;
    }

    if (errorInfo.errorCategory === 'authorization') {
        return `${baseMessage}. You may not have permission for this targeting operation.`;
    }

    return baseMessage;
}

/**
 * Log targeting error with appropriate level and context
 */
export function logTargetingError(error: any, context?: { operation?: string; url?: string }): void {
    const errorInfo = getTargetingErrorInfo(error);

    if (!errorInfo.isTargetingError) {
        console.error('Non-targeting error:', error);
        return;
    }

    const logLevel = errorInfo.preservesMainAuth ? 'warn' : 'error';
    const logMessage = `Targeting ${errorInfo.operation || 'operation'} failed`;

    const logData = {
        operation: errorInfo.operation,
        errorCode: errorInfo.errorCode,
        errorCategory: errorInfo.errorCategory,
        preservesMainAuth: errorInfo.preservesMainAuth,
        shouldRetry: errorInfo.shouldRetry,
        url: context?.url || error.config?.url,
        status: error.response?.status,
        message: error.message
    };

    if (logLevel === 'error') {
        console.error(logMessage, logData);
    } else {
        console.warn(logMessage, logData);
    }
}

/**
 * Create a retry function for targeting operations
 */
export function createTargetingRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3
): (error: any) => Promise<T> {
    return async (error: any): Promise<T> => {
        const errorInfo = getTargetingErrorInfo(error);

        if (!errorInfo.shouldRetry || maxRetries <= 0) {
            throw error;
        }

        // Wait before retrying
        if (errorInfo.retryDelay) {
            await new Promise(resolve => setTimeout(resolve, errorInfo.retryDelay));
        }

        try {
            return await operation();
        } catch (retryError) {
            return createTargetingRetry(operation, maxRetries - 1)(retryError);
        }
    };
}

/**
 * Wrap an API call with targeting-aware error handling
 */
export async function withTargetingErrorHandling<T>(
    operation: () => Promise<T>,
    options: {
        maxRetries?: number;
        onError?: (error: any, errorInfo: TargetingErrorInfo) => void;
        preserveAuthOnTargetingError?: boolean;
    } = {}
): Promise<T> {
    const { maxRetries = 3, onError, preserveAuthOnTargetingError = true } = options;

    try {
        return await operation();
    } catch (error) {
        const errorInfo = getTargetingErrorInfo(error);

        // Log the error
        logTargetingError(error);

        // Call custom error handler if provided
        if (onError) {
            onError(error, errorInfo);
        }

        // Handle authentication errors
        if (errorInfo.isTargetingError && errorInfo.errorCategory === 'authentication') {
            if (preserveAuthOnTargetingError && errorInfo.preservesMainAuth) {
                console.warn('Targeting authentication error - preserving main session');
                // Don't trigger logout for targeting auth errors that preserve main auth
            } else if (shouldTargetingErrorTriggerLogout(error)) {
                console.error('Authentication failure - logout required');
                // This would trigger logout in the calling code
            }
        }

        // Retry if appropriate
        if (errorInfo.shouldRetry && maxRetries > 0) {
            const retryFn = createTargetingRetry(operation, maxRetries);
            return retryFn(error);
        }

        throw error;
    }
}

/**
 * Check if current request context is targeting-related
 */
export function isCurrentRequestTargeting(): boolean {
    // Check if we're in a targeting service context
    const currentUrl = window.location.pathname;
    const targetingPages = ['/swaps', '/my-swaps'];

    return targetingPages.some(page => currentUrl.includes(page));
}

/**
 * Get targeting operation context from current environment
 */
export function getCurrentTargetingContext(): {
    isTargetingContext: boolean;
    page?: string;
    swapId?: string;
} {
    const currentUrl = window.location.pathname;
    const isTargetingContext = isCurrentRequestTargeting();

    if (!isTargetingContext) {
        return { isTargetingContext: false };
    }

    // Extract swap ID from URL if present
    const swapIdMatch = currentUrl.match(/\/swaps\/([^\/]+)/);
    const swapId = swapIdMatch ? swapIdMatch[1] : undefined;

    return {
        isTargetingContext: true,
        page: currentUrl.includes('/my-swaps') ? 'my-swaps' : 'swaps',
        swapId
    };
}

export default {
    isTargetingError,
    getTargetingErrorInfo,
    shouldTargetingErrorTriggerLogout,
    getTargetingErrorMessage,
    logTargetingError,
    createTargetingRetry,
    withTargetingErrorHandling,
    isCurrentRequestTargeting,
    getCurrentTargetingContext
};