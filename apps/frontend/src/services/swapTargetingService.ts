import axios, { AxiosResponse } from 'axios';
import {
    SwapTarget,
    TargetingHistory,
    TargetingResult,
    TargetingValidation,
    AuctionEligibilityResult,
    OneForOneValidationResult,
    SwapPlatformError,
    ValidationError,
    BusinessLogicError,
    ERROR_CODES,
} from '@booking-swap/shared';
import { executeTargetingOperation } from '@/services/authErrorHandler';
import { createTargetingErrorContext } from '@/types/authError';
import { validateAndExecuteTargetingCall, TargetingOperationContext } from '@/services/targetingAuthValidator';

// Cache interface for targeting data
interface TargetingCache {
    key: string;
    data: any;
    timestamp: number;
    ttl: number;
}

// Retry configuration
interface RetryConfig {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
}

class SwapTargetingService {
    private baseURL: string;
    private axiosInstance;
    private cache: Map<string, TargetingCache> = new Map();
    private readonly CACHE_TTL = 2 * 60 * 1000; // 2 minutes for targeting data
    private readonly retryConfig: RetryConfig = {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 5000,
    };

    constructor() {
        this.baseURL =
            import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
        this.axiosInstance = axios.create({
            baseURL: this.baseURL,
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Enhanced request interceptor with targeting operation identification
        this.axiosInstance.interceptors.request.use(
            config => {
                const token = localStorage.getItem('auth_token');
                console.log('SwapTargetingService: Request interceptor - URL:', config.url, 'Token exists:', !!token);
                if (token) {
                    config.headers.Authorization = `Bearer ${token}`;
                } else {
                    console.warn('SwapTargetingService: No auth token found for request to:', config.url);
                }

                // Add targeting-specific headers for all requests
                const url = config.url || '';
                const method = config.method || 'GET';
                const operation = this.getTargetingOperationFromUrl(url, method);

                config.headers['X-Targeting-Operation'] = operation;
                config.headers['X-Targeting-Request'] = 'true';
                config.headers['X-Service'] = 'SwapTargetingService';

                // Add swap IDs from URL or request data
                const swapIdMatch = url.match(/\/swaps\/([^\/]+)/);
                if (swapIdMatch) {
                    config.headers['X-Source-Swap-Id'] = swapIdMatch[1];
                }

                if (config.data?.targetSwapId) {
                    config.headers['X-Target-Swap-Id'] = config.data.targetSwapId;
                } else if (config.params?.targetSwapId) {
                    config.headers['X-Target-Swap-Id'] = config.params.targetSwapId;
                }

                return config;
            },
            error => Promise.reject(error)
        );

        // Enhanced response interceptor for targeting-aware error handling
        this.axiosInstance.interceptors.response.use(
            response => response,
            async error => {
                const url = error.config?.url || '';
                const method = error.config?.method || 'GET';
                const isTargetingEndpoint = this.isTargetingEndpoint(url);

                if (isTargetingEndpoint) {
                    const operation = this.getTargetingOperationFromUrl(url, method);

                    // Check if this is a targeting-specific authentication error
                    const errorData = error.response?.data?.error;
                    const preservesMainAuth = errorData?.preservesMainAuth ??
                        error.response?.headers?.['x-preserves-main-auth'] === 'true';

                    if (error.response?.status === 401 && preservesMainAuth) {
                        console.log('Targeting authentication error - preserving main session:', {
                            url,
                            operation,
                            errorCode: errorData?.code,
                            preservesMainAuth
                        });

                        // Add targeting-specific error metadata
                        error.isTargetingAuthError = true;
                        error.preservesMainAuth = true;
                        error.targetingOperation = operation;
                    } else if (error.response?.status === 403) {
                        console.log('Targeting authorization error:', {
                            url,
                            operation,
                            errorCode: errorData?.code,
                            message: errorData?.message
                        });

                        error.isTargetingAuthorizationError = true;
                        error.targetingOperation = operation;
                    }

                    console.log('Targeting endpoint error detected, preserving auth state:', url);
                }

                return Promise.reject(this.handleApiError(error));
            }
        );
    }

    private handleApiError(error: any): SwapPlatformError {
        if (error.response) {
            const { status, data } = error.response;

            switch (status) {
                case 400:
                    return new ValidationError(
                        data.error?.message || 'Invalid targeting request',
                        data.error?.details
                    );
                case 401:
                    // Enhanced handling for targeting authentication errors
                    const errorData = data.error;
                    const preservesMainAuth = errorData?.preservesMainAuth ?? true;
                    const isTargetingRelated = errorData?.isTargetingRelated ?? true;

                    const authError = new SwapPlatformError(
                        ERROR_CODES.INVALID_TOKEN,
                        preservesMainAuth
                            ? 'Authentication issue with targeting operation - your main session is preserved'
                            : 'Authentication failed',
                        'targeting_authentication'
                    );

                    // Add enhanced targeting error metadata
                    (authError as any).isTargetingAuth = isTargetingRelated;
                    (authError as any).preservesMainAuth = preservesMainAuth;
                    (authError as any).targetingErrorCode = errorData?.code;
                    (authError as any).targetingContext = errorData?.targetingContext;

                    return authError;
                case 403:
                    // Enhanced handling for targeting authorization errors
                    const authzErrorData = data.error;
                    const authzError = new SwapPlatformError(
                        ERROR_CODES.ACCESS_DENIED,
                        authzErrorData?.message || 'Access denied for targeting operation',
                        'authorization'
                    );

                    // Add targeting authorization error metadata
                    (authzError as any).isTargetingAuthorizationError = true;
                    (authzError as any).targetingErrorCode = authzErrorData?.code;
                    (authzError as any).preservesMainAuth = authzErrorData?.preservesMainAuth ?? true;

                    return authzError;
                case 404:
                    return new BusinessLogicError(
                        ERROR_CODES.SWAP_NOT_FOUND,
                        'Target swap not found'
                    );
                case 409:
                    return new BusinessLogicError(
                        ERROR_CODES.INVALID_SWAP_STATE,
                        data.error?.message || 'Invalid targeting state'
                    );
                case 429:
                    return new SwapPlatformError(
                        ERROR_CODES.RATE_LIMIT_EXCEEDED,
                        'Too many targeting requests',
                        'rate_limiting',
                        true
                    );
                default:
                    return new SwapPlatformError(
                        ERROR_CODES.INTERNAL_SERVER_ERROR,
                        'Targeting operation failed',
                        'server_error',
                        true
                    );
            }
        } else if (error.request) {
            return new SwapPlatformError(
                ERROR_CODES.NETWORK_ERROR,
                'Network error during targeting operation',
                'integration',
                true
            );
        } else {
            return new SwapPlatformError(
                ERROR_CODES.INTERNAL_SERVER_ERROR,
                error.message || 'Targeting operation failed',
                'server_error'
            );
        }
    }

    /**
     * Check if a URL is a targeting-related endpoint
     */
    private isTargetingEndpoint(url: string): boolean {
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
     * Get targeting operation type from URL and method
     */
    private getTargetingOperationFromUrl(url: string, method: string): string {
        if (url.includes('/targeting-status')) return 'get_status';
        if (url.includes('/targeting-history')) return 'get_history';
        if (url.includes('/targeting-activity')) return 'get_history';
        if (url.includes('/targeted-by')) return 'get_history';
        if (url.includes('/can-target')) return 'validate';
        if (url.includes('/validate-targeting')) return 'validate';
        if (url.includes('/auction-eligibility')) return 'validate';
        if (url.includes('/one-for-one-eligibility')) return 'validate';

        if (url.includes('/target')) {
            if (method.toUpperCase() === 'POST') return 'target';
            if (method.toUpperCase() === 'DELETE') return 'remove_target';
        }
        if (url.includes('/retarget')) return 'retarget';

        return 'unknown';
    }

    // Core targeting operations
    async targetSwap(
        sourceSwapId: string,
        targetSwapId: string,
        message?: string,
        conditions?: string[]
    ): Promise<TargetingResult> {
        this.validateTargetingParams(sourceSwapId, targetSwapId);

        const userId = this.getCurrentUserId();
        const context: TargetingOperationContext = {
            operation: 'target',
            sourceSwapId,
            targetSwapId,
            userId,
            endpoint: `/swaps/${sourceSwapId}/target`
        };

        // Use enhanced validation and error handling for targeting operations
        const result = await validateAndExecuteTargetingCall(
            () => this.executeWithRetry(
                () => this.axiosInstance.post(`/swaps/${sourceSwapId}/target`, {
                    targetSwapId,
                    message,
                    conditions,
                })
            ),
            context,
            {
                requireTargetingScope: true,
                requireSwapAccess: true,
                allowCrossUserAccess: true
            }
        );

        if (!result.success) {
            throw new Error(result.error || 'Targeting operation failed');
        }

        // Clear related cache entries
        this.invalidateTargetingCache(sourceSwapId);
        this.invalidateTargetingCache(targetSwapId);

        return result.data!.data;
    }

    async retargetSwap(
        sourceSwapId: string,
        newTargetSwapId: string,
        message?: string,
        conditions?: string[]
    ): Promise<TargetingResult> {
        this.validateTargetingParams(sourceSwapId, newTargetSwapId);

        const userId = this.getCurrentUserId();
        const context: TargetingOperationContext = {
            operation: 'retarget',
            sourceSwapId,
            targetSwapId: newTargetSwapId,
            userId,
            endpoint: `/swaps/${sourceSwapId}/retarget`
        };

        const result = await validateAndExecuteTargetingCall(
            () => this.executeWithRetry(
                () => this.axiosInstance.put(`/swaps/${sourceSwapId}/retarget`, {
                    targetSwapId: newTargetSwapId,
                    message,
                    conditions,
                })
            ),
            context,
            {
                requireTargetingScope: true,
                requireSwapAccess: true,
                allowCrossUserAccess: true
            }
        );

        if (!result.success) {
            throw new Error(result.error || 'Retargeting operation failed');
        }

        // Clear related cache entries
        this.invalidateTargetingCache(sourceSwapId);
        this.invalidateTargetingCache(newTargetSwapId);

        return result.data!;
    }

    async removeTarget(sourceSwapId: string): Promise<void> {
        if (!sourceSwapId || sourceSwapId.trim().length === 0) {
            throw new ValidationError('Source swap ID is required', {
                field: 'sourceSwapId',
            });
        }

        const userId = this.getCurrentUserId();
        const context: TargetingOperationContext = {
            operation: 'remove_target',
            sourceSwapId,
            userId,
            endpoint: `/swaps/${sourceSwapId}/target`
        };

        const result = await validateAndExecuteTargetingCall(
            () => this.executeWithRetry(
                () => this.axiosInstance.delete(`/swaps/${sourceSwapId}/target`)
            ),
            context,
            {
                requireTargetingScope: true,
                requireSwapAccess: true,
                allowCrossUserAccess: false
            }
        );

        if (!result.success) {
            throw new Error(result.error || 'Remove target operation failed');
        }

        // Clear related cache entries
        this.invalidateTargetingCache(sourceSwapId);
    }

    // Validation and eligibility checks
    async validateTargeting(
        sourceSwapId: string,
        targetSwapId: string
    ): Promise<TargetingValidation> {
        this.validateTargetingParams(sourceSwapId, targetSwapId);

        // Check cache first
        const cacheKey = `validation-${sourceSwapId}-${targetSwapId}`;
        const cached = this.getCachedData(cacheKey);
        if (cached) {
            return cached;
        }

        const userId = this.getCurrentUserId();
        const context: TargetingOperationContext = {
            operation: 'validate',
            sourceSwapId,
            targetSwapId,
            userId,
            endpoint: `/swaps/${sourceSwapId}/validate-targeting`
        };

        const result = await validateAndExecuteTargetingCall(
            () => this.axiosInstance.get(
                `/swaps/${sourceSwapId}/validate-targeting`,
                {
                    params: { targetSwapId },
                }
            ),
            context,
            {
                requireTargetingScope: false, // Validation doesn't require special scope
                requireSwapAccess: true,      // Need access to source swap
                allowCrossUserAccess: true    // Allow validating targeting other users' swaps
            }
        );

        if (!result.success) {
            throw new Error(result.error || 'Targeting validation failed');
        }

        // Cache validation result with shorter TTL
        this.setCachedData(cacheKey, result.data!, 30 * 1000); // 30 seconds

        return result.data!;
    }

    async canTargetSwap(targetSwapId: string): Promise<boolean> {
        try {
            if (!targetSwapId || targetSwapId.trim().length === 0) {
                throw new ValidationError('Target swap ID is required', {
                    field: 'targetSwapId',
                });
            }

            // Check cache first
            const cacheKey = `can-target-${targetSwapId}`;
            const cached = this.getCachedData(cacheKey);
            if (cached !== null) {
                return cached;
            }

            const response: AxiosResponse<{ canTarget: boolean }> = await this.axiosInstance.get(
                `/swaps/${targetSwapId}/can-target`
            );

            const result = response.data.canTarget;

            // Cache result with shorter TTL
            this.setCachedData(cacheKey, result, 30 * 1000); // 30 seconds

            return result;
        } catch (error) {
            throw error;
        }
    }

    async checkAuctionEligibility(targetSwapId: string): Promise<AuctionEligibilityResult> {
        try {
            if (!targetSwapId || targetSwapId.trim().length === 0) {
                throw new ValidationError('Target swap ID is required', {
                    field: 'targetSwapId',
                });
            }

            // Check cache first
            const cacheKey = `auction-eligibility-${targetSwapId}`;
            const cached = this.getCachedData(cacheKey);
            if (cached) {
                return cached;
            }

            const response: AxiosResponse<AuctionEligibilityResult> = await this.axiosInstance.get(
                `/swaps/${targetSwapId}/auction-eligibility`
            );

            // Cache result with shorter TTL
            this.setCachedData(cacheKey, response.data, 60 * 1000); // 1 minute

            return response.data;
        } catch (error) {
            throw error;
        }
    }

    async checkOneForOneEligibility(targetSwapId: string): Promise<OneForOneValidationResult> {
        try {
            if (!targetSwapId || targetSwapId.trim().length === 0) {
                throw new ValidationError('Target swap ID is required', {
                    field: 'targetSwapId',
                });
            }

            // Check cache first
            const cacheKey = `one-for-one-eligibility-${targetSwapId}`;
            const cached = this.getCachedData(cacheKey);
            if (cached) {
                return cached;
            }

            const response: AxiosResponse<OneForOneValidationResult> = await this.axiosInstance.get(
                `/swaps/${targetSwapId}/one-for-one-eligibility`
            );

            // Cache result with shorter TTL
            this.setCachedData(cacheKey, response.data, 30 * 1000); // 30 seconds

            return response.data;
        } catch (error) {
            throw error;
        }
    }

    // Query operations
    async getSwapTarget(swapId: string): Promise<SwapTarget | null> {
        if (!swapId || swapId.trim().length === 0) {
            throw new ValidationError('Swap ID is required', {
                field: 'swapId',
            });
        }

        // Check if we have an auth token before making the request
        const token = localStorage.getItem('auth_token');
        if (!token) {
            console.warn('SwapTargetingService: No auth token available for getSwapTarget');
            throw new SwapPlatformError(
                ERROR_CODES.INVALID_TOKEN,
                'Authentication required for targeting operations',
                'authentication'
            );
        }

        // Check cache first
        const cacheKey = `swap-target-${swapId}`;
        const cached = this.getCachedData(cacheKey);
        if (cached) {
            return cached;
        }

        const userId = this.getCurrentUserId();
        const context: TargetingOperationContext = {
            operation: 'get_status',
            sourceSwapId: swapId,
            userId,
            endpoint: `/swaps/${swapId}/targeting-status`
        };

        // Use enhanced validation and error handling for targeting operations
        const result = await validateAndExecuteTargetingCall(
            () => this.axiosInstance.get(`/swaps/${swapId}/targeting-status`),
            context,
            {
                requireTargetingScope: false, // Read operations don't require special scope
                requireSwapAccess: false,     // Allow reading targeting status
                allowCrossUserAccess: true    // Allow reading other users' targeting status
            }
        );

        if (!result.success) {
            // For 404 errors, return null instead of throwing
            if (result.error?.includes('not found') || result.error?.includes('404')) {
                return null;
            }

            // For other targeting errors, log but don't throw to preserve auth state
            console.warn('Failed to get swap target:', result.error);
            return null;
        }

        const targetData = result.data!.data.target;

        // Cache result
        this.setCachedData(cacheKey, targetData, this.CACHE_TTL);

        return targetData;
    }

    async getTargetingHistory(swapId: string): Promise<TargetingHistory[]> {
        try {
            if (!swapId || swapId.trim().length === 0) {
                throw new ValidationError('Swap ID is required', {
                    field: 'swapId',
                });
            }

            // Check if we have an auth token before making the request
            const token = localStorage.getItem('auth_token');
            if (!token) {
                console.warn('SwapTargetingService: No auth token available for getTargetingHistory');
                throw new SwapPlatformError(
                    ERROR_CODES.INVALID_TOKEN,
                    'Authentication required for targeting operations',
                    'authentication'
                );
            }

            // Check cache first
            const cacheKey = `targeting-history-${swapId}`;
            const cached = this.getCachedData(cacheKey);
            if (cached) {
                return cached;
            }

            const response: AxiosResponse<{ history: TargetingHistory[] }> = await this.axiosInstance.get(
                `/swaps/${swapId}/targeting-history`
            );

            const result = response.data.history;

            // Cache result
            this.setCachedData(cacheKey, result, this.CACHE_TTL);

            return result;
        } catch (error) {
            throw error;
        }
    }

    async getSwapsTargetingMe(userId?: string): Promise<SwapTarget[]> {
        try {
            const targetUserId = userId || this.getCurrentUserId();

            // Check cache first
            const cacheKey = `swaps-targeting-me-${targetUserId}`;
            const cached = this.getCachedData(cacheKey);
            if (cached) {
                return cached;
            }

            const response: AxiosResponse<{ targets: SwapTarget[] }> = await this.axiosInstance.get(
                `/users/${targetUserId}/targeting-activity`
            );

            const result = response.data.targets;

            // Cache result with shorter TTL
            this.setCachedData(cacheKey, result, 60 * 1000); // 1 minute

            return result;
        } catch (error) {
            throw error;
        }
    }

    async getSwapsTargetedBy(swapId: string): Promise<SwapTarget[]> {
        try {
            if (!swapId || swapId.trim().length === 0) {
                throw new ValidationError('Swap ID is required', {
                    field: 'swapId',
                });
            }

            // Check if we have an auth token before making the request
            const token = localStorage.getItem('auth_token');
            if (!token) {
                console.warn('SwapTargetingService: No auth token available for getSwapsTargetedBy');
                throw new SwapPlatformError(
                    ERROR_CODES.INVALID_TOKEN,
                    'Authentication required for targeting operations',
                    'authentication'
                );
            }

            // Check cache first
            const cacheKey = `swaps-targeted-by-${swapId}`;
            const cached = this.getCachedData(cacheKey);
            if (cached) {
                return cached;
            }

            const response: AxiosResponse<{ targets: SwapTarget[] }> = await this.axiosInstance.get(
                `/swaps/${swapId}/targeted-by`
            );

            const result = response.data.targets;

            // Cache result
            this.setCachedData(cacheKey, result, this.CACHE_TTL);

            return result;
        } catch (error) {
            throw error;
        }
    }

    // Utility methods
    private validateTargetingParams(sourceSwapId: string, targetSwapId: string): void {
        const errors: string[] = [];

        if (!sourceSwapId || sourceSwapId.trim().length === 0) {
            errors.push('Source swap ID is required');
        }

        if (!targetSwapId || targetSwapId.trim().length === 0) {
            errors.push('Target swap ID is required');
        }

        if (sourceSwapId === targetSwapId) {
            errors.push('Source and target swaps cannot be the same');
        }

        if (errors.length > 0) {
            throw new ValidationError('Invalid targeting parameters', { errors });
        }
    }

    private getCurrentUserId(): string {
        // This should be replaced with actual user ID retrieval logic
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                return user.id;
            } catch (error) {
                throw new ValidationError('Invalid user data', { field: 'userId' });
            }
        }
        throw new ValidationError('User not authenticated', { field: 'userId' });
    }

    // Cache management
    private getCachedData(key: string): any | null {
        const cached = this.cache.get(key);
        if (!cached) {
            return null;
        }

        const now = Date.now();
        if (now - cached.timestamp > cached.ttl) {
            this.cache.delete(key);
            return null;
        }

        return cached.data;
    }

    private setCachedData(key: string, data: any, ttl: number = this.CACHE_TTL): void {
        this.cache.set(key, {
            key,
            data,
            timestamp: Date.now(),
            ttl,
        });

        // Clean up expired entries periodically
        this.cleanupExpiredCache();
    }

    private cleanupExpiredCache(): void {
        const now = Date.now();
        for (const [key, cached] of this.cache.entries()) {
            if (now - cached.timestamp > cached.ttl) {
                this.cache.delete(key);
            }
        }
    }

    private invalidateTargetingCache(swapId: string): void {
        const keysToDelete: string[] = [];
        for (const key of this.cache.keys()) {
            if (key.includes(swapId)) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.cache.delete(key));
    }

    public clearCache(): void {
        this.cache.clear();
    }

    public getCacheStats(): {
        size: number;
        keys: string[];
        oldestEntry?: number;
        newestEntry?: number;
    } {
        const entries = Array.from(this.cache.values());
        const timestamps = entries.map(entry => entry.timestamp);

        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys()),
            oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : undefined,
            newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : undefined,
        };
    }

    // Retry logic with exponential backoff
    private async executeWithRetry<T>(
        operation: () => Promise<AxiosResponse<T>>,
        retryCount: number = 0
    ): Promise<AxiosResponse<T>> {
        try {
            return await operation();
        } catch (error: any) {
            if (retryCount >= this.retryConfig.maxRetries) {
                throw error;
            }

            // Only retry on network errors or 5xx server errors
            if (
                error.code === 'NETWORK_ERROR' ||
                (error.response && error.response.status >= 500)
            ) {
                const delay = Math.min(
                    this.retryConfig.baseDelay * Math.pow(2, retryCount),
                    this.retryConfig.maxDelay
                );

                await new Promise(resolve => setTimeout(resolve, delay));
                return this.executeWithRetry(operation, retryCount + 1);
            }

            throw error;
        }
    }

    /**
     * Accept a targeting proposal
     * Requirements: 5.1, 5.5
     */
    async acceptTargetingProposal(
        swapId: string,
        targetId: string,
        proposalId: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            this.validateTargetingParams(swapId, targetId);

            if (!proposalId || proposalId.trim().length === 0) {
                throw new ValidationError('Proposal ID is required', { field: 'proposalId' });
            }

            await this.axiosInstance.put(
                `/swaps/${proposalId}/accept`,
                {
                    targetId,
                    swapId
                }
            );

            // Clear relevant cache entries
            this.clearTargetingCache(swapId);

            return {
                success: true
            };
        } catch (error: unknown) {
            console.error('Failed to accept targeting proposal:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to accept targeting proposal'
            };
        }
    }

    /**
     * Reject a targeting proposal
     * Requirements: 5.1, 5.5
     */
    async rejectTargetingProposal(
        swapId: string,
        targetId: string,
        proposalId: string,
        reason?: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            this.validateTargetingParams(swapId, targetId);

            if (!proposalId || proposalId.trim().length === 0) {
                throw new ValidationError('Proposal ID is required', { field: 'proposalId' });
            }

            await this.axiosInstance.put(
                `/swaps/${proposalId}/reject`,
                {
                    targetId,
                    swapId,
                    reason: reason || 'Targeting proposal rejected'
                }
            );

            // Clear relevant cache entries
            this.clearTargetingCache(swapId);

            return {
                success: true
            };
        } catch (error: unknown) {
            console.error('Failed to reject targeting proposal:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to reject targeting proposal'
            };
        }
    }

    /**
     * Clear targeting-related cache entries for a swap
     */
    private clearTargetingCache(swapId: string): void {
        const keysToDelete: string[] = [];

        for (const key of this.cache.keys()) {
            if (key.includes(swapId) || key.includes('targeting') || key.includes('proposals')) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this.cache.delete(key));
    }
}

// Create and export a singleton instance
export const swapTargetingService = new SwapTargetingService();
export default swapTargetingService;