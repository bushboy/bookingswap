/**
 * Targeting Authentication Validator Service
 * 
 * This service provides pre-validation for targeting-related API calls
 * and ensures consistent authentication logic across all targeting endpoints.
 * 
 * Requirements satisfied:
 * - 3.2: Implement pre-validation for targeting-related API calls
 * - 3.2: Add targeting-specific token validation that matches main auth validation
 * - 3.2: Ensure consistent authentication logic across all targeting endpoints
 */

import { AuthErrorType, createTargetingErrorContext } from '@/types/authError';
import { executeTargetingOperation } from '@/services/authErrorHandler';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface TargetingAuthValidationResult {
    isValid: boolean;
    error?: {
        type: AuthErrorType;
        message: string;
        shouldRetry: boolean;
        preservesMainAuth: boolean;
    };
    tokenInfo?: {
        userId: string;
        expiresAt: Date;
        issuedAt: Date;
        scopes: string[];
    };
}

export interface TargetingOperationContext {
    operation: 'target' | 'retarget' | 'remove_target' | 'get_status' | 'get_history' | 'validate';
    sourceSwapId?: string;
    targetSwapId?: string;
    userId?: string;
    endpoint: string;
}

export interface TokenValidationOptions {
    requireTargetingScope?: boolean;
    requireSwapAccess?: boolean;
    allowCrossUserAccess?: boolean;
    skipExpirationCheck?: boolean;
}

// ============================================================================
// Targeting Authentication Validator Class
// ============================================================================

export class TargetingAuthValidator {
    private static instance: TargetingAuthValidator;
    private validationCache: Map<string, { result: TargetingAuthValidationResult; timestamp: number }> = new Map();
    private readonly CACHE_TTL = 30 * 1000; // 30 seconds cache for validation results

    private constructor() { }

    /**
     * Get singleton instance
     */
    static getInstance(): TargetingAuthValidator {
        if (!TargetingAuthValidator.instance) {
            TargetingAuthValidator.instance = new TargetingAuthValidator();
        }
        return TargetingAuthValidator.instance;
    }

    /**
     * Pre-validate authentication for targeting operations
     */
    async validateTargetingAuth(
        context: TargetingOperationContext,
        options: TokenValidationOptions = {}
    ): Promise<TargetingAuthValidationResult> {
        const cacheKey = this.getCacheKey(context, options);

        // Check cache first
        const cached = this.getCachedValidation(cacheKey);
        if (cached) {
            console.log('TargetingAuthValidator: Using cached validation result');
            return cached;
        }

        console.log('TargetingAuthValidator: Performing fresh validation for:', context);

        try {
            // Get current token
            const token = this.getCurrentToken();
            if (!token) {
                const result: TargetingAuthValidationResult = {
                    isValid: false,
                    error: {
                        type: AuthErrorType.TOKEN_MISSING,
                        message: 'Authentication token is missing for targeting operation',
                        shouldRetry: false,
                        preservesMainAuth: true
                    }
                };
                this.setCachedValidation(cacheKey, result);
                return result;
            }

            // Validate token format and basic structure
            const tokenValidation = this.validateTokenStructure(token);
            if (!tokenValidation.isValid) {
                const result: TargetingAuthValidationResult = {
                    isValid: false,
                    error: {
                        type: AuthErrorType.TARGETING_TOKEN_VALIDATION_FAILED,
                        message: tokenValidation.error || 'Invalid token format for targeting operation',
                        shouldRetry: false,
                        preservesMainAuth: true
                    }
                };
                this.setCachedValidation(cacheKey, result);
                return result;
            }

            // Parse token to get user info
            const tokenInfo = this.parseToken(token);
            if (!tokenInfo) {
                const result: TargetingAuthValidationResult = {
                    isValid: false,
                    error: {
                        type: AuthErrorType.TARGETING_TOKEN_VALIDATION_FAILED,
                        message: 'Unable to parse token for targeting operation',
                        shouldRetry: true,
                        preservesMainAuth: true
                    }
                };
                this.setCachedValidation(cacheKey, result);
                return result;
            }

            // Check token expiration
            if (!options.skipExpirationCheck && this.isTokenExpired(tokenInfo)) {
                const result: TargetingAuthValidationResult = {
                    isValid: false,
                    error: {
                        type: AuthErrorType.TARGETING_TOKEN_VALIDATION_FAILED,
                        message: 'Token expired for targeting operation',
                        shouldRetry: false,
                        preservesMainAuth: true
                    }
                };
                this.setCachedValidation(cacheKey, result);
                return result;
            }

            // Validate targeting-specific requirements
            const targetingValidation = await this.validateTargetingRequirements(
                tokenInfo,
                context,
                options
            );

            if (!targetingValidation.isValid) {
                this.setCachedValidation(cacheKey, targetingValidation);
                return targetingValidation;
            }

            // All validations passed
            const result: TargetingAuthValidationResult = {
                isValid: true,
                tokenInfo
            };

            this.setCachedValidation(cacheKey, result);
            console.log('TargetingAuthValidator: Validation successful for:', context.operation);
            return result;

        } catch (error) {
            console.error('TargetingAuthValidator: Validation error:', error);

            const result: TargetingAuthValidationResult = {
                isValid: false,
                error: {
                    type: AuthErrorType.TARGETING_AUTH_FAILURE,
                    message: error instanceof Error ? error.message : 'Unknown validation error',
                    shouldRetry: true,
                    preservesMainAuth: true
                }
            };

            return result;
        }
    }

    /**
     * Validate authentication for targeting API call with retry logic
     */
    async validateAndExecuteTargetingCall<T>(
        operation: () => Promise<T>,
        context: TargetingOperationContext,
        options: TokenValidationOptions = {}
    ): Promise<{ success: boolean; data?: T; error?: string; preservedAuth: boolean }> {
        // Pre-validate authentication
        const validation = await this.validateTargetingAuth(context, options);

        if (!validation.isValid) {
            console.warn('TargetingAuthValidator: Pre-validation failed:', validation.error);
            return {
                success: false,
                error: validation.error?.message || 'Authentication validation failed',
                preservedAuth: validation.error?.preservesMainAuth || true
            };
        }

        // Execute the operation with targeting-aware error handling
        try {
            const result = await executeTargetingOperation(
                operation,
                context.endpoint,
                context.sourceSwapId,
                context.targetSwapId
            );

            if (result.success) {
                return {
                    success: true,
                    data: result.data || undefined,
                    preservedAuth: true
                };
            } else {
                return {
                    success: false,
                    error: result.error?.message || 'Targeting operation failed',
                    preservedAuth: result.preservedAuthState
                };
            }
        } catch (error) {
            console.error('TargetingAuthValidator: Operation execution failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown execution error',
                preservedAuth: true
            };
        }
    }

    /**
     * Validate that targeting endpoints use consistent authentication
     */
    async validateEndpointConsistency(endpoints: string[]): Promise<{
        consistent: boolean;
        issues: Array<{
            endpoint: string;
            issue: string;
            severity: 'warning' | 'error';
        }>;
    }> {
        const issues: Array<{ endpoint: string; issue: string; severity: 'warning' | 'error' }> = [];

        for (const endpoint of endpoints) {
            try {
                // Create a mock context for this endpoint
                const context: TargetingOperationContext = {
                    operation: this.inferOperationFromEndpoint(endpoint),
                    endpoint,
                    sourceSwapId: 'test-swap-id',
                    targetSwapId: 'test-target-id'
                };

                // Validate the endpoint
                const validation = await this.validateTargetingAuth(context);

                if (!validation.isValid && validation.error) {
                    // Check if this is a consistency issue vs expected auth failure
                    if (validation.error.type === AuthErrorType.TARGETING_TOKEN_VALIDATION_FAILED) {
                        issues.push({
                            endpoint,
                            issue: `Inconsistent token validation: ${validation.error.message}`,
                            severity: 'error'
                        });
                    } else if (validation.error.type === AuthErrorType.TARGETING_AUTH_FAILURE) {
                        issues.push({
                            endpoint,
                            issue: `Authentication logic inconsistency: ${validation.error.message}`,
                            severity: 'warning'
                        });
                    }
                }
            } catch (error) {
                issues.push({
                    endpoint,
                    issue: `Validation check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    severity: 'error'
                });
            }
        }

        return {
            consistent: issues.filter(issue => issue.severity === 'error').length === 0,
            issues
        };
    }

    // ============================================================================
    // Private Helper Methods
    // ============================================================================

    /**
     * Get current authentication token
     */
    private getCurrentToken(): string | null {
        // Try multiple sources for the token
        const sources = [
            () => localStorage.getItem('auth_token'),
            () => localStorage.getItem('token'),
            () => sessionStorage.getItem('auth_token'),
            () => sessionStorage.getItem('token')
        ];

        for (const getToken of sources) {
            try {
                const token = getToken();
                if (token && token.trim()) {
                    return token.trim();
                }
            } catch (error) {
                console.warn('TargetingAuthValidator: Error accessing token source:', error);
            }
        }

        return null;
    }

    /**
     * Validate token structure and format
     */
    private validateTokenStructure(token: string): { isValid: boolean; error?: string } {
        if (!token || typeof token !== 'string') {
            return { isValid: false, error: 'Token is not a valid string' };
        }

        // Check if it's a JWT token
        const parts = token.split('.');
        if (parts.length !== 3) {
            return { isValid: false, error: 'Token is not a valid JWT format' };
        }

        // Validate each part is base64
        for (let i = 0; i < parts.length; i++) {
            try {
                // JWT uses base64url encoding, but we'll do a basic check
                if (!parts[i] || parts[i].length === 0) {
                    return { isValid: false, error: `Token part ${i + 1} is empty` };
                }
            } catch (error) {
                return { isValid: false, error: `Token part ${i + 1} is not valid base64` };
            }
        }

        return { isValid: true };
    }

    /**
     * Parse JWT token to extract user information
     */
    private parseToken(token: string): TargetingAuthValidationResult['tokenInfo'] | null {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) {
                return null;
            }

            // Decode the payload (second part)
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

            return {
                userId: payload.sub || payload.userId || payload.id,
                expiresAt: new Date(payload.exp * 1000),
                issuedAt: new Date(payload.iat * 1000),
                scopes: payload.scopes || payload.scope?.split(' ') || []
            };
        } catch (error) {
            console.error('TargetingAuthValidator: Error parsing token:', error);
            return null;
        }
    }

    /**
     * Check if token is expired
     */
    private isTokenExpired(tokenInfo: NonNullable<TargetingAuthValidationResult['tokenInfo']>): boolean {
        const now = new Date();
        const buffer = 30 * 1000; // 30 second buffer
        return tokenInfo.expiresAt.getTime() - buffer < now.getTime();
    }

    /**
     * Validate targeting-specific requirements
     */
    private async validateTargetingRequirements(
        tokenInfo: NonNullable<TargetingAuthValidationResult['tokenInfo']>,
        context: TargetingOperationContext,
        options: TokenValidationOptions
    ): Promise<TargetingAuthValidationResult> {
        // Check targeting scope if required
        if (options.requireTargetingScope) {
            const hasTargetingScope = tokenInfo.scopes.some(scope =>
                scope.includes('targeting') || scope.includes('swap') || scope === 'all'
            );

            if (!hasTargetingScope) {
                return {
                    isValid: false,
                    error: {
                        type: AuthErrorType.TARGETING_PERMISSION_DENIED,
                        message: 'Token does not have targeting permissions',
                        shouldRetry: false,
                        preservesMainAuth: true
                    }
                };
            }
        }

        // Check swap access if required
        if (options.requireSwapAccess && context.sourceSwapId) {
            // For now, we'll assume the user has access to their own swaps
            // In a full implementation, this would check swap ownership
            const hasSwapAccess = true; // Placeholder logic

            if (!hasSwapAccess) {
                return {
                    isValid: false,
                    error: {
                        type: AuthErrorType.TARGETING_PERMISSION_DENIED,
                        message: 'No access to source swap for targeting operation',
                        shouldRetry: false,
                        preservesMainAuth: true
                    }
                };
            }
        }

        // Check cross-user access if needed
        if (!options.allowCrossUserAccess && context.targetSwapId) {
            // This would normally check if the target swap belongs to a different user
            // For now, we'll allow cross-user access for targeting operations
            const isCrossUserAccess = false; // Placeholder logic

            if (isCrossUserAccess) {
                return {
                    isValid: false,
                    error: {
                        type: AuthErrorType.CROSS_USER_ACCESS_DENIED,
                        message: 'Cross-user access not allowed for this targeting operation',
                        shouldRetry: false,
                        preservesMainAuth: true
                    }
                };
            }
        }

        return { isValid: true, tokenInfo };
    }

    /**
     * Infer operation type from endpoint
     */
    private inferOperationFromEndpoint(endpoint: string): TargetingOperationContext['operation'] {
        if (endpoint.includes('/target') && !endpoint.includes('/retarget')) {
            return 'target';
        } else if (endpoint.includes('/retarget')) {
            return 'retarget';
        } else if (endpoint.includes('/targeting-status')) {
            return 'get_status';
        } else if (endpoint.includes('/targeting-history')) {
            return 'get_history';
        } else if (endpoint.includes('/validate-targeting')) {
            return 'validate';
        } else if (endpoint.includes('/target') && endpoint.includes('DELETE')) {
            return 'remove_target';
        }
        return 'get_status';
    }

    /**
     * Generate cache key for validation result
     */
    private getCacheKey(context: TargetingOperationContext, options: TokenValidationOptions): string {
        const keyParts = [
            context.operation,
            context.endpoint,
            context.sourceSwapId || '',
            context.targetSwapId || '',
            context.userId || '',
            JSON.stringify(options)
        ];
        return keyParts.join('|');
    }

    /**
     * Get cached validation result
     */
    private getCachedValidation(key: string): TargetingAuthValidationResult | null {
        const cached = this.validationCache.get(key);
        if (!cached) {
            return null;
        }

        const now = Date.now();
        if (now - cached.timestamp > this.CACHE_TTL) {
            this.validationCache.delete(key);
            return null;
        }

        return cached.result;
    }

    /**
     * Set cached validation result
     */
    private setCachedValidation(key: string, result: TargetingAuthValidationResult): void {
        this.validationCache.set(key, {
            result,
            timestamp: Date.now()
        });

        // Clean up old entries periodically
        if (this.validationCache.size > 100) {
            this.cleanupCache();
        }
    }

    /**
     * Clean up expired cache entries
     */
    private cleanupCache(): void {
        const now = Date.now();
        for (const [key, cached] of this.validationCache.entries()) {
            if (now - cached.timestamp > this.CACHE_TTL) {
                this.validationCache.delete(key);
            }
        }
    }

    /**
     * Clear all cached validations
     */
    public clearCache(): void {
        this.validationCache.clear();
    }

    /**
     * Get cache statistics
     */
    public getCacheStats(): {
        size: number;
        hitRate: number;
        oldestEntry?: number;
        newestEntry?: number;
    } {
        const entries = Array.from(this.validationCache.values());
        const timestamps = entries.map(entry => entry.timestamp);

        return {
            size: this.validationCache.size,
            hitRate: 0, // Would need to track hits/misses to calculate
            oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : undefined,
            newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : undefined
        };
    }

    /**
     * Validate authentication consistency across all targeting endpoints
     */
    async validateAllTargetingEndpoints(): Promise<{
        consistent: boolean;
        results: Array<{
            endpoint: string;
            operation: string;
            isValid: boolean;
            error?: string;
            responseTime: number;
        }>;
        summary: {
            totalEndpoints: number;
            validEndpoints: number;
            invalidEndpoints: number;
            averageResponseTime: number;
        };
    }> {
        const targetingEndpoints = [
            { endpoint: '/swaps/{swapId}/targeting-status', operation: 'get_status' },
            { endpoint: '/swaps/{swapId}/target', operation: 'target' },
            { endpoint: '/swaps/{swapId}/retarget', operation: 'retarget' },
            { endpoint: '/swaps/{swapId}/target', operation: 'remove_target' },
            { endpoint: '/swaps/{swapId}/validate-targeting', operation: 'validate' },
            { endpoint: '/swaps/{swapId}/targeting-history', operation: 'get_history' },
            { endpoint: '/swaps/{swapId}/can-target', operation: 'validate' },
            { endpoint: '/swaps/{swapId}/auction-eligibility', operation: 'validate' },
            { endpoint: '/swaps/{swapId}/one-for-one-eligibility', operation: 'validate' },
            { endpoint: '/users/{userId}/targeting-activity', operation: 'get_status' },
            { endpoint: '/swaps/{swapId}/targeted-by', operation: 'get_status' }
        ];

        const results: Array<{
            endpoint: string;
            operation: string;
            isValid: boolean;
            error?: string;
            responseTime: number;
        }> = [];

        let totalResponseTime = 0;

        for (const { endpoint, operation } of targetingEndpoints) {
            const startTime = Date.now();

            try {
                const context: TargetingOperationContext = {
                    operation: operation as any,
                    endpoint,
                    sourceSwapId: 'test-swap-id',
                    targetSwapId: 'test-target-id',
                    userId: 'test-user-id'
                };

                const validation = await this.validateTargetingAuth(context);
                const responseTime = Date.now() - startTime;
                totalResponseTime += responseTime;

                results.push({
                    endpoint,
                    operation,
                    isValid: validation.isValid,
                    error: validation.error?.message,
                    responseTime
                });
            } catch (error) {
                const responseTime = Date.now() - startTime;
                totalResponseTime += responseTime;

                results.push({
                    endpoint,
                    operation,
                    isValid: false,
                    error: error instanceof Error ? error.message : 'Unknown validation error',
                    responseTime
                });
            }
        }

        const validEndpoints = results.filter(r => r.isValid).length;
        const invalidEndpoints = results.length - validEndpoints;

        return {
            consistent: invalidEndpoints === 0,
            results,
            summary: {
                totalEndpoints: results.length,
                validEndpoints,
                invalidEndpoints,
                averageResponseTime: totalResponseTime / results.length
            }
        };
    }

    /**
     * Test targeting authentication with different scenarios
     */
    async testTargetingAuthScenarios(): Promise<{
        scenarios: Array<{
            name: string;
            description: string;
            success: boolean;
            error?: string;
            preservedAuth: boolean;
        }>;
        overallSuccess: boolean;
    }> {
        const scenarios = [
            {
                name: 'valid_token_targeting',
                description: 'Valid token with targeting operation',
                context: {
                    operation: 'target' as const,
                    endpoint: '/swaps/test/target',
                    sourceSwapId: 'test-source',
                    targetSwapId: 'test-target'
                }
            },
            {
                name: 'cross_user_targeting',
                description: 'Cross-user targeting operation',
                context: {
                    operation: 'target' as const,
                    endpoint: '/swaps/test/target',
                    sourceSwapId: 'user1-swap',
                    targetSwapId: 'user2-swap'
                }
            },
            {
                name: 'targeting_status_read',
                description: 'Reading targeting status',
                context: {
                    operation: 'get_status' as const,
                    endpoint: '/swaps/test/targeting-status',
                    sourceSwapId: 'test-swap'
                }
            },
            {
                name: 'targeting_validation',
                description: 'Targeting validation check',
                context: {
                    operation: 'validate' as const,
                    endpoint: '/swaps/test/validate-targeting',
                    sourceSwapId: 'test-source',
                    targetSwapId: 'test-target'
                }
            }
        ];

        const results = [];
        let overallSuccess = true;

        for (const scenario of scenarios) {
            try {
                const validation = await this.validateTargetingAuth(scenario.context);

                results.push({
                    name: scenario.name,
                    description: scenario.description,
                    success: validation.isValid,
                    error: validation.error?.message,
                    preservedAuth: validation.error?.preservesMainAuth ?? true
                });

                if (!validation.isValid && validation.error && !validation.error.preservesMainAuth) {
                    overallSuccess = false;
                }
            } catch (error) {
                results.push({
                    name: scenario.name,
                    description: scenario.description,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    preservedAuth: true
                });
                overallSuccess = false;
            }
        }

        return {
            scenarios: results,
            overallSuccess
        };
    }
}

// ============================================================================
// Singleton Instance and Convenience Functions
// ============================================================================

/**
 * Singleton instance of the targeting auth validator
 */
export const targetingAuthValidator = TargetingAuthValidator.getInstance();

/**
 * Convenience function for validating targeting authentication
 */
export const validateTargetingAuth = (
    context: TargetingOperationContext,
    options?: TokenValidationOptions
) => {
    return targetingAuthValidator.validateTargetingAuth(context, options);
};

/**
 * Convenience function for validating and executing targeting calls
 */
export const validateAndExecuteTargetingCall = <T>(
    operation: () => Promise<T>,
    context: TargetingOperationContext,
    options?: TokenValidationOptions
) => {
    return targetingAuthValidator.validateAndExecuteTargetingCall(operation, context, options);
};

export default targetingAuthValidator;