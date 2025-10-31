/**
 * Backend compatibility safeguards for feature flag compliance
 * 
 * This module provides utilities to ensure API calls work with both enabled
 * and disabled features, handle server responses that include hidden feature data,
 * and maintain backward compatibility with existing API contracts.
 * 
 * Requirements satisfied:
 * - 3.1: System preserves all existing API endpoints
 * - 3.2: System maintains all database schemas and models
 * - 3.4: System keeps all backend validation and business logic
 */

import { FEATURE_FLAGS } from '@/config/featureFlags';
import {
    sanitizeCreateSwapRequest,
    sanitizeCreateProposalRequest,
    sanitizeApiResponseData,
    validateCreateSwapRequestCompliance,
    validateCreateProposalRequestCompliance,
    type EnhancedCreateSwapRequest,
    type CreateProposalRequest
} from './dataSanitization';

// ============================================================================
// API Request Interceptors
// ============================================================================

/**
 * API request configuration for feature flag compliance
 */
export interface ApiRequestConfig {
    /** Whether to sanitize request data automatically */
    autoSanitize: boolean;
    /** Whether to validate feature flag compliance */
    validateCompliance: boolean;
    /** Whether to log sanitization actions */
    logActions: boolean;
    /** Custom error handler for compliance violations */
    onComplianceError?: (errors: string[]) => void;
}

/**
 * Default API request configuration
 */
const DEFAULT_API_CONFIG: ApiRequestConfig = {
    autoSanitize: true,
    validateCompliance: true,
    logActions: import.meta.env.DEV,
    onComplianceError: (errors) => {
        console.warn('API request compliance violations:', errors);
    },
};

/**
 * Intercepts and sanitizes create swap API requests
 * Ensures requests comply with feature flag settings
 * 
 * @param request - The original create swap request
 * @param config - Configuration for request handling
 * @returns Sanitized request or throws error if validation fails
 */
export function interceptCreateSwapRequest(
    request: EnhancedCreateSwapRequest,
    config: Partial<ApiRequestConfig> = {}
): EnhancedCreateSwapRequest {
    const finalConfig = { ...DEFAULT_API_CONFIG, ...config };

    // Validate compliance if enabled
    if (finalConfig.validateCompliance) {
        const errors = validateCreateSwapRequestCompliance(request);
        if (errors.length > 0) {
            if (finalConfig.onComplianceError) {
                finalConfig.onComplianceError(errors);
            }

            if (!finalConfig.autoSanitize) {
                throw new Error(`Create swap request compliance violations: ${errors.join(', ')}`);
            }
        }
    }

    // Sanitize request if enabled
    if (finalConfig.autoSanitize) {
        const sanitized = sanitizeCreateSwapRequest(request);

        if (finalConfig.logActions) {
            console.log('🔄 API Request Intercepted: Create Swap', {
                original: request,
                sanitized,
                featureFlags: FEATURE_FLAGS,
            });
        }

        return sanitized;
    }

    return request;
}

/**
 * Intercepts and sanitizes create proposal API requests
 * Ensures requests comply with feature flag settings
 * 
 * @param request - The original create proposal request
 * @param config - Configuration for request handling
 * @returns Sanitized request or throws error if validation fails
 */
export function interceptCreateProposalRequest(
    request: CreateProposalRequest,
    config: Partial<ApiRequestConfig> = {}
): CreateProposalRequest {
    const finalConfig = { ...DEFAULT_API_CONFIG, ...config };

    // Validate compliance if enabled
    if (finalConfig.validateCompliance) {
        const errors = validateCreateProposalRequestCompliance(request);
        if (errors.length > 0) {
            if (finalConfig.onComplianceError) {
                finalConfig.onComplianceError(errors);
            }

            if (!finalConfig.autoSanitize) {
                throw new Error(`Create proposal request compliance violations: ${errors.join(', ')}`);
            }
        }
    }

    // Sanitize request if enabled
    if (finalConfig.autoSanitize) {
        const sanitized = sanitizeCreateProposalRequest(request);

        if (finalConfig.logActions) {
            console.log('🔄 API Request Intercepted: Create Proposal', {
                original: request,
                sanitized,
                featureFlags: FEATURE_FLAGS,
            });
        }

        return sanitized;
    }

    return request;
}

// ============================================================================
// API Response Interceptors
// ============================================================================

/**
 * API response configuration for feature flag compliance
 */
export interface ApiResponseConfig {
    /** Whether to sanitize response data automatically */
    autoSanitize: boolean;
    /** Whether to filter out disabled feature data */
    filterDisabledFeatures: boolean;
    /** Whether to log sanitization actions */
    logActions: boolean;
    /** Custom handler for unexpected feature data */
    onUnexpectedFeatureData?: (data: any) => void;
}

/**
 * Default API response configuration
 */
const DEFAULT_RESPONSE_CONFIG: ApiResponseConfig = {
    autoSanitize: true,
    filterDisabledFeatures: true,
    logActions: import.meta.env.DEV,
    onUnexpectedFeatureData: (data) => {
        console.warn('Received unexpected feature data from backend:', data);
    },
};

/**
 * Intercepts and sanitizes API responses
 * Handles server responses that include hidden feature data
 * Maintains backward compatibility with existing API contracts
 * 
 * @param response - The original API response
 * @param config - Configuration for response handling
 * @returns Sanitized response data
 */
export function interceptApiResponse(
    response: any,
    config: Partial<ApiResponseConfig> = {}
): any {
    const finalConfig = { ...DEFAULT_RESPONSE_CONFIG, ...config };

    if (!response || typeof response !== 'object') {
        return response;
    }

    // Check for unexpected feature data
    if (finalConfig.onUnexpectedFeatureData) {
        const hasUnexpectedData = checkForUnexpectedFeatureData(response);
        if (hasUnexpectedData) {
            finalConfig.onUnexpectedFeatureData(response);
        }
    }

    // Sanitize response if enabled
    if (finalConfig.autoSanitize) {
        const sanitized = sanitizeApiResponseData(response);

        if (finalConfig.logActions) {
            console.log('🔄 API Response Intercepted', {
                original: response,
                sanitized,
                featureFlags: FEATURE_FLAGS,
            });
        }

        return sanitized;
    }

    return response;
}

/**
 * Checks if response data contains unexpected feature data
 * Helps identify when backend is returning data for disabled features
 * 
 * @param data - The response data to check
 * @returns True if unexpected feature data is found
 */
function checkForUnexpectedFeatureData(data: any): boolean {
    if (!data || typeof data !== 'object') {
        return false;
    }

    // Check for auction data when auction is disabled
    if (!FEATURE_FLAGS.ENABLE_AUCTION_MODE) {
        if (hasAuctionDataInResponse(data)) {
            return true;
        }
    }

    // Check for cash data when cash features are disabled
    if (!FEATURE_FLAGS.ENABLE_CASH_SWAPS || !FEATURE_FLAGS.ENABLE_CASH_PROPOSALS) {
        if (hasCashDataInResponse(data)) {
            return true;
        }
    }

    return false;
}

/**
 * Recursively checks for auction-related data in response
 */
function hasAuctionDataInResponse(data: any): boolean {
    if (!data || typeof data !== 'object') {
        return false;
    }

    // Check current level
    if (data.auctionId ||
        data.auctionSettings ||
        (data.acceptanceStrategy?.type === 'auction')) {
        return true;
    }

    // Check nested objects and arrays
    for (const value of Object.values(data)) {
        if (Array.isArray(value)) {
            if (value.some(item => hasAuctionDataInResponse(item))) {
                return true;
            }
        } else if (value && typeof value === 'object') {
            if (hasAuctionDataInResponse(value)) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Recursively checks for cash-related data in response
 */
function hasCashDataInResponse(data: any): boolean {
    if (!data || typeof data !== 'object') {
        return false;
    }

    // Check current level
    if (data.cashOffer ||
        data.cashDetails ||
        (data.proposalType === 'cash') ||
        (data.paymentTypes?.cashPayment)) {
        return true;
    }

    // Check nested objects and arrays
    for (const value of Object.values(data)) {
        if (Array.isArray(value)) {
            if (value.some(item => hasCashDataInResponse(item))) {
                return true;
            }
        } else if (value && typeof value === 'object') {
            if (hasCashDataInResponse(value)) {
                return true;
            }
        }
    }

    return false;
}

// ============================================================================
// API Client Wrappers
// ============================================================================

/**
 * Enhanced fetch wrapper that applies feature flag compatibility
 * Automatically sanitizes requests and responses based on feature flags
 * 
 * @param url - The API endpoint URL
 * @param options - Fetch options with optional compatibility config
 * @returns Promise with sanitized response
 */
export async function compatibleFetch(
    url: string,
    options: RequestInit & {
        requestConfig?: Partial<ApiRequestConfig>;
        responseConfig?: Partial<ApiResponseConfig>;
    } = {}
): Promise<Response> {
    const { requestConfig, responseConfig, ...fetchOptions } = options;

    // Sanitize request body if it's JSON
    if (fetchOptions.body && typeof fetchOptions.body === 'string') {
        try {
            const bodyData = JSON.parse(fetchOptions.body);
            const sanitizedBody = sanitizeRequestBody(bodyData, requestConfig);
            fetchOptions.body = JSON.stringify(sanitizedBody);
        } catch (error) {
            // If body is not JSON, leave it as is
            console.warn('Could not parse request body as JSON:', error);
        }
    }

    // Make the API call
    const response = await fetch(url, fetchOptions);

    // Create a new response with sanitized data
    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
        const originalData = await response.json();
        const sanitizedData = interceptApiResponse(originalData, responseConfig);

        // Create new response with sanitized data
        return new Response(JSON.stringify(sanitizedData), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
        });
    }

    return response;
}

/**
 * Sanitizes request body based on the endpoint and data structure
 * 
 * @param bodyData - The request body data
 * @param config - Request configuration
 * @returns Sanitized request body
 */
function sanitizeRequestBody(bodyData: any, config?: Partial<ApiRequestConfig>): any {
    if (!bodyData || typeof bodyData !== 'object') {
        return bodyData;
    }

    // Detect request type and apply appropriate sanitization
    if (isCreateSwapRequest(bodyData)) {
        return interceptCreateSwapRequest(bodyData, config);
    }

    if (isCreateProposalRequest(bodyData)) {
        return interceptCreateProposalRequest(bodyData, config);
    }

    // For other request types, return as is
    return bodyData;
}

/**
 * Type guard to check if data is a create swap request
 */
function isCreateSwapRequest(data: any): data is EnhancedCreateSwapRequest {
    return data &&
        typeof data === 'object' &&
        typeof data.sourceBookingId === 'string' &&
        data.paymentTypes &&
        data.acceptanceStrategy;
}

/**
 * Type guard to check if data is a create proposal request
 */
function isCreateProposalRequest(data: any): data is CreateProposalRequest {
    return data &&
        typeof data === 'object' &&
        Array.isArray(data.conditions) &&
        typeof data.agreedToTerms === 'boolean';
}

// ============================================================================
// Backward Compatibility Utilities
// ============================================================================

/**
 * Ensures API endpoints work with both enabled and disabled features
 * Provides fallback behavior for when features are disabled
 * 
 * @param endpoint - The API endpoint being called
 * @param method - The HTTP method
 * @param data - The request data
 * @returns Modified endpoint or data for compatibility
 */
export function ensureBackwardCompatibility(
    endpoint: string,
    method: string,
    data?: any
): { endpoint: string; data?: any } {
    // Handle auction-specific endpoints
    if (!FEATURE_FLAGS.ENABLE_AUCTION_MODE) {
        if (endpoint.includes('/auction') || endpoint.includes('/auctions')) {
            console.warn(`Auction endpoint called while auction mode is disabled: ${endpoint}`);

            // For GET requests, we might want to redirect to regular swap endpoints
            if (method.toLowerCase() === 'get') {
                const modifiedEndpoint = endpoint.replace('/auction', '').replace('/auctions', '/swaps');
                return { endpoint: modifiedEndpoint, data };
            }

            // For POST/PUT/DELETE, we might want to block or modify the request
            if (data) {
                data = sanitizeCreateSwapRequest(data);
            }
        }
    }

    // Handle cash-specific endpoints
    if (!FEATURE_FLAGS.ENABLE_CASH_SWAPS && !FEATURE_FLAGS.ENABLE_CASH_PROPOSALS) {
        if (endpoint.includes('/cash') || endpoint.includes('/payment')) {
            console.warn(`Cash endpoint called while cash features are disabled: ${endpoint}`);

            // For cash proposal endpoints, we might want to redirect or block
            if (endpoint.includes('/cash-offer') || endpoint.includes('/cash-proposal')) {
                throw new Error('Cash proposals are currently disabled');
            }

            if (data) {
                data = sanitizeCreateProposalRequest(data);
            }
        }
    }

    return { endpoint, data };
}

/**
 * Creates a compatibility layer for existing API clients
 * Wraps existing API methods with feature flag awareness
 * 
 * @param apiClient - The original API client object
 * @returns Enhanced API client with compatibility layer
 */
export function createCompatibilityLayer<T extends Record<string, any>>(apiClient: T): T {
    const compatibleClient = { ...apiClient };

    // Wrap all methods that might be API calls
    for (const [key, value] of Object.entries(apiClient)) {
        if (typeof value === 'function') {
            (compatibleClient as any)[key] = async (...args: any[]) => {
                try {
                    // Apply compatibility checks before calling original method
                    const modifiedArgs = args.map(arg => {
                        if (arg && typeof arg === 'object') {
                            // Try to sanitize if it looks like request data
                            if (isCreateSwapRequest(arg)) {
                                return interceptCreateSwapRequest(arg);
                            }
                            if (isCreateProposalRequest(arg)) {
                                return interceptCreateProposalRequest(arg);
                            }
                        }
                        return arg;
                    });

                    // Call original method with modified args
                    const result = await value.apply(apiClient, modifiedArgs);

                    // Sanitize response if it's an object
                    if (result && typeof result === 'object') {
                        return interceptApiResponse(result);
                    }

                    return result;
                } catch (error) {
                    // Log compatibility errors but don't break the flow
                    console.error(`Compatibility layer error in ${key}:`, error);
                    throw error;
                }
            };
        }
    }

    return compatibleClient;
}

/**
 * Validates that the backend API is compatible with current feature flag settings
 * Can be used during application startup to check compatibility
 * 
 * @param apiBaseUrl - The base URL of the API
 * @returns Promise with compatibility check results
 */
export async function validateBackendCompatibility(apiBaseUrl: string): Promise<{
    compatible: boolean;
    warnings: string[];
    errors: string[];
}> {
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
        // Check if backend supports feature flag headers
        const healthResponse = await fetch(`${apiBaseUrl}/health`, {
            headers: {
                'X-Feature-Flags': JSON.stringify(FEATURE_FLAGS),
            },
        });

        if (!healthResponse.ok) {
            warnings.push('Backend does not respond to health check with feature flags');
        }

        // Test auction endpoints if auction is disabled
        if (!FEATURE_FLAGS.ENABLE_AUCTION_MODE) {
            try {
                const auctionResponse = await fetch(`${apiBaseUrl}/auctions`, {
                    method: 'HEAD', // Use HEAD to avoid side effects
                });

                if (auctionResponse.ok) {
                    warnings.push('Auction endpoints are accessible but auction mode is disabled');
                }
            } catch (error) {
                // This is expected if auction endpoints are properly disabled
            }
        }

        // Test cash endpoints if cash features are disabled
        if (!FEATURE_FLAGS.ENABLE_CASH_SWAPS || !FEATURE_FLAGS.ENABLE_CASH_PROPOSALS) {
            try {
                const cashResponse = await fetch(`${apiBaseUrl}/cash-offers`, {
                    method: 'HEAD', // Use HEAD to avoid side effects
                });

                if (cashResponse.ok) {
                    warnings.push('Cash endpoints are accessible but cash features are disabled');
                }
            } catch (error) {
                // This is expected if cash endpoints are properly disabled
            }
        }

    } catch (error) {
        errors.push(`Failed to validate backend compatibility: ${error}`);
    }

    return {
        compatible: errors.length === 0,
        warnings,
        errors,
    };
}

/**
 * Creates a feature flag aware error handler for API calls
 * Provides specific error messages for feature flag related issues
 * 
 * @param error - The error that occurred
 * @param context - Additional context about the API call
 * @returns Enhanced error with feature flag context
 */
export function handleFeatureFlagApiError(
    error: Error,
    context: {
        endpoint?: string;
        method?: string;
        featureContext?: string;
    } = {}
): Error {
    const { endpoint, method, featureContext } = context;

    // Check if error is related to disabled features
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes('auction') && !FEATURE_FLAGS.ENABLE_AUCTION_MODE) {
        return new Error(
            `Auction feature is disabled. Original error: ${error.message}`,
            { cause: error }
        );
    }

    if ((errorMessage.includes('cash') || errorMessage.includes('payment')) &&
        (!FEATURE_FLAGS.ENABLE_CASH_SWAPS || !FEATURE_FLAGS.ENABLE_CASH_PROPOSALS)) {
        return new Error(
            `Cash features are disabled. Original error: ${error.message}`,
            { cause: error }
        );
    }

    // Add feature flag context to error
    const enhancedError = new Error(
        `API Error${featureContext ? ` in ${featureContext}` : ''}: ${error.message}`,
        { cause: error }
    );

    // Add additional properties for debugging
    Object.assign(enhancedError, {
        featureFlags: FEATURE_FLAGS,
        endpoint,
        method,
    });

    return enhancedError;
}

// ============================================================================
// Export all utilities
// ============================================================================

export {
    DEFAULT_API_CONFIG,
    DEFAULT_RESPONSE_CONFIG,
};