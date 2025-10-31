/**
 * Feature Flag Service - Centralized service for feature flag management
 * 
 * This service provides a centralized way to manage feature flags, handle
 * feature flag related errors, and ensure backend compatibility. It integrates
 * error boundaries with API compatibility safeguards.
 * 
 * Requirements satisfied:
 * - 4.5: Feature flag error boundaries handle mismatches gracefully
 * - 3.1, 3.2, 3.4: Backend compatibility safeguards maintain API contracts
 */

import { FEATURE_FLAGS, type FeatureFlags } from '@/config/featureFlags';
import {
    compatibleFetch,
    interceptCreateSwapRequest,
    interceptCreateProposalRequest,
    interceptApiResponse,
    validateBackendCompatibility,
    handleFeatureFlagApiError,
    createCompatibilityLayer,
    type ApiRequestConfig,
    type ApiResponseConfig
} from '@/utils/backendCompatibility';
import {
    sanitizeApiResponseData,
    safeSanitize,
    createSanitizationErrorBoundary
} from '@/utils/dataSanitization';

// ============================================================================
// Service Configuration
// ============================================================================

/**
 * Feature flag service configuration
 */
export interface FeatureFlagServiceConfig {
    /** Whether to enable automatic request/response sanitization */
    autoSanitize: boolean;
    /** Whether to validate API compatibility on startup */
    validateCompatibility: boolean;
    /** Whether to log feature flag actions */
    enableLogging: boolean;
    /** API base URL for compatibility validation */
    apiBaseUrl?: string;
    /** Custom error handler for feature flag errors */
    onFeatureFlagError?: (error: Error, context: string) => void;
    /** Custom handler for compatibility warnings */
    onCompatibilityWarning?: (warning: string) => void;
}

/**
 * Default service configuration
 */
const DEFAULT_CONFIG: FeatureFlagServiceConfig = {
    autoSanitize: true,
    validateCompatibility: process.env.NODE_ENV === 'development',
    enableLogging: process.env.NODE_ENV === 'development',
    apiBaseUrl: process.env.VITE_API_BASE_URL || '/api',
    onFeatureFlagError: (error, context) => {
        console.error(`Feature flag error in ${context}:`, error);
    },
    onCompatibilityWarning: (warning) => {
        console.warn('Feature flag compatibility warning:', warning);
    },
};

// ============================================================================
// Feature Flag Service Class
// ============================================================================

/**
 * Centralized service for managing feature flags and ensuring compatibility
 */
export class FeatureFlagService {
    private config: FeatureFlagServiceConfig;
    private compatibilityValidated: boolean = false;
    private sanitizationErrorBoundary: ReturnType<typeof createSanitizationErrorBoundary>;

    constructor(config: Partial<FeatureFlagServiceConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.sanitizationErrorBoundary = createSanitizationErrorBoundary('FeatureFlagService');
    }

    /**
     * Get current feature flags
     */
    getFeatureFlags(): FeatureFlags {
        return { ...FEATURE_FLAGS };
    }

    /**
     * Check if a specific feature is enabled
     */
    isFeatureEnabled(feature: keyof FeatureFlags): boolean {
        return FEATURE_FLAGS[feature];
    }

    /**
     * Get features that are currently disabled
     */
    getDisabledFeatures(): (keyof FeatureFlags)[] {
        return Object.entries(FEATURE_FLAGS)
            .filter(([, enabled]) => !enabled)
            .map(([feature]) => feature as keyof FeatureFlags);
    }

    /**
     * Validate backend compatibility (call once during app startup)
     */
    async validateCompatibility(): Promise<void> {
        if (!this.config.validateCompatibility || this.compatibilityValidated) {
            return;
        }

        try {
            const result = await validateBackendCompatibility(this.config.apiBaseUrl!);

            if (!result.compatible) {
                const errorMessage = `Backend compatibility validation failed: ${result.errors.join(', ')}`;
                this.handleError(new Error(errorMessage), 'compatibility-validation');
            }

            // Log warnings
            result.warnings.forEach(warning => {
                if (this.config.onCompatibilityWarning) {
                    this.config.onCompatibilityWarning(warning);
                }
            });

            this.compatibilityValidated = true;

            if (this.config.enableLogging) {
                console.log('✅ Backend compatibility validated', {
                    compatible: result.compatible,
                    warnings: result.warnings.length,
                    errors: result.errors.length,
                });
            }
        } catch (error) {
            this.handleError(error as Error, 'compatibility-validation');
        }
    }

    /**
     * Create a feature-flag aware API client wrapper
     */
    createApiClient<T extends Record<string, any>>(originalClient: T): T {
        return createCompatibilityLayer(originalClient);
    }

    /**
     * Make a feature-flag aware API request
     */
    async makeApiRequest(
        url: string,
        options: RequestInit & {
            requestConfig?: Partial<ApiRequestConfig>;
            responseConfig?: Partial<ApiResponseConfig>;
        } = {}
    ): Promise<Response> {
        try {
            return await compatibleFetch(url, {
                ...options,
                requestConfig: {
                    autoSanitize: this.config.autoSanitize,
                    logActions: this.config.enableLogging,
                    onComplianceError: (errors) => {
                        const error = new Error(`API request compliance violations: ${errors.join(', ')}`);
                        this.handleError(error, 'api-request');
                    },
                    ...options.requestConfig,
                },
                responseConfig: {
                    autoSanitize: this.config.autoSanitize,
                    logActions: this.config.enableLogging,
                    onUnexpectedFeatureData: (data) => {
                        if (this.config.onCompatibilityWarning) {
                            this.config.onCompatibilityWarning('Received unexpected feature data from backend');
                        }
                    },
                    ...options.responseConfig,
                },
            });
        } catch (error) {
            const enhancedError = handleFeatureFlagApiError(error as Error, {
                endpoint: url,
                method: options.method || 'GET',
            });
            this.handleError(enhancedError, 'api-request');
            throw enhancedError;
        }
    }

    /**
     * Safely sanitize data with error boundary protection
     */
    sanitizeData<T>(data: T, sanitizeFn: (data: T) => T): T {
        return this.sanitizationErrorBoundary(data, sanitizeFn);
    }

    /**
     * Sanitize API response data
     */
    sanitizeResponse(responseData: any): any {
        return this.sanitizeData(responseData, sanitizeApiResponseData);
    }

    /**
     * Check if current feature flags are compatible with given data
     */
    isDataCompatible(data: any): { compatible: boolean; issues: string[] } {
        const issues: string[] = [];

        if (!data || typeof data !== 'object') {
            return { compatible: true, issues };
        }

        // Check for auction data when auction is disabled
        if (!FEATURE_FLAGS.ENABLE_AUCTION_MODE) {
            if (this.hasAuctionData(data)) {
                issues.push('Data contains auction information but auction mode is disabled');
            }
        }

        // Check for cash data when cash features are disabled
        if (!FEATURE_FLAGS.ENABLE_CASH_SWAPS) {
            if (this.hasCashSwapData(data)) {
                issues.push('Data contains cash swap information but cash swaps are disabled');
            }
        }

        if (!FEATURE_FLAGS.ENABLE_CASH_PROPOSALS) {
            if (this.hasCashProposalData(data)) {
                issues.push('Data contains cash proposal information but cash proposals are disabled');
            }
        }

        return {
            compatible: issues.length === 0,
            issues,
        };
    }

    /**
     * Get a summary of current feature flag status
     */
    getFeatureFlagSummary(): {
        enabled: string[];
        disabled: string[];
        total: number;
        compatibilityValidated: boolean;
    } {
        const enabled: string[] = [];
        const disabled: string[] = [];

        Object.entries(FEATURE_FLAGS).forEach(([feature, isEnabled]) => {
            if (isEnabled) {
                enabled.push(feature);
            } else {
                disabled.push(feature);
            }
        });

        return {
            enabled,
            disabled,
            total: enabled.length + disabled.length,
            compatibilityValidated: this.compatibilityValidated,
        };
    }

    /**
     * Handle feature flag related errors
     */
    private handleError(error: Error, context: string): void {
        if (this.config.onFeatureFlagError) {
            this.config.onFeatureFlagError(error, context);
        }

        if (this.config.enableLogging) {
            console.error(`🚨 Feature Flag Service Error [${context}]:`, {
                error: error.message,
                featureFlags: FEATURE_FLAGS,
                context,
            });
        }
    }

    /**
     * Check if data contains auction-related properties
     */
    private hasAuctionData(data: any): boolean {
        if (!data || typeof data !== 'object') return false;

        const checkObject = (obj: any): boolean => {
            if (!obj || typeof obj !== 'object') return false;

            // Check current level
            if (obj.auctionId ||
                obj.auctionSettings ||
                (obj.acceptanceStrategy?.type === 'auction')) {
                return true;
            }

            // Check nested objects and arrays
            for (const value of Object.values(obj)) {
                if (Array.isArray(value)) {
                    if (value.some(item => checkObject(item))) return true;
                } else if (value && typeof value === 'object') {
                    if (checkObject(value)) return true;
                }
            }

            return false;
        };

        return checkObject(data);
    }

    /**
     * Check if data contains cash swap related properties
     */
    private hasCashSwapData(data: any): boolean {
        if (!data || typeof data !== 'object') return false;

        const checkObject = (obj: any): boolean => {
            if (!obj || typeof obj !== 'object') return false;

            // Check current level
            if (obj.cashDetails ||
                (obj.paymentTypes?.cashPayment) ||
                obj.paymentTypes?.minimumCashAmount ||
                obj.paymentTypes?.preferredCashAmount) {
                return true;
            }

            // Check nested objects and arrays
            for (const value of Object.values(obj)) {
                if (Array.isArray(value)) {
                    if (value.some(item => checkObject(item))) return true;
                } else if (value && typeof value === 'object') {
                    if (checkObject(value)) return true;
                }
            }

            return false;
        };

        return checkObject(data);
    }

    /**
     * Check if data contains cash proposal related properties
     */
    private hasCashProposalData(data: any): boolean {
        if (!data || typeof data !== 'object') return false;

        const checkObject = (obj: any): boolean => {
            if (!obj || typeof obj !== 'object') return false;

            // Check current level
            if (obj.cashOffer || (obj.proposalType === 'cash')) {
                return true;
            }

            // Check nested objects and arrays
            for (const value of Object.values(obj)) {
                if (Array.isArray(value)) {
                    if (value.some(item => checkObject(item))) return true;
                } else if (value && typeof value === 'object') {
                    if (checkObject(value)) return true;
                }
            }

            return false;
        };

        return checkObject(data);
    }
}

// ============================================================================
// Singleton Instance and Hooks
// ============================================================================

/**
 * Global feature flag service instance
 */
let globalFeatureFlagService: FeatureFlagService | null = null;

/**
 * Get or create the global feature flag service instance
 */
export function getFeatureFlagService(config?: Partial<FeatureFlagServiceConfig>): FeatureFlagService {
    if (!globalFeatureFlagService) {
        globalFeatureFlagService = new FeatureFlagService(config);
    }
    return globalFeatureFlagService;
}

/**
 * Initialize the feature flag service (call during app startup)
 */
export async function initializeFeatureFlagService(
    config?: Partial<FeatureFlagServiceConfig>
): Promise<FeatureFlagService> {
    const service = getFeatureFlagService(config);
    await service.validateCompatibility();
    return service;
}

/**
 * React hook for using the feature flag service
 */
export function useFeatureFlagService(): FeatureFlagService {
    return getFeatureFlagService();
}

/**
 * React hook for checking if a feature is enabled
 */
export function useFeatureFlag(feature: keyof FeatureFlags): boolean {
    const service = getFeatureFlagService();
    return service.isFeatureEnabled(feature);
}

/**
 * React hook for getting all feature flags
 */
export function useFeatureFlags(): FeatureFlags {
    const service = getFeatureFlagService();
    return service.getFeatureFlags();
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Higher-order function to wrap API calls with feature flag compatibility
 */
export function withFeatureFlagCompatibility<T extends (...args: any[]) => Promise<any>>(
    apiFunction: T,
    context?: string
): T {
    return (async (...args: any[]) => {
        const service = getFeatureFlagService();

        try {
            // Sanitize input arguments if they contain request data
            const sanitizedArgs = args.map(arg => {
                if (arg && typeof arg === 'object') {
                    return service.sanitizeData(arg, (data) => data);
                }
                return arg;
            });

            // Call original function with sanitized args
            const result = await apiFunction(...sanitizedArgs);

            // Sanitize response
            if (result && typeof result === 'object') {
                return service.sanitizeResponse(result);
            }

            return result;
        } catch (error) {
            const enhancedError = handleFeatureFlagApiError(error as Error, {
                featureContext: context,
            });
            throw enhancedError;
        }
    }) as T;
}

/**
 * Decorator for API service methods to add feature flag compatibility
 */
export function FeatureFlagCompatible(context?: string) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = withFeatureFlagCompatibility(originalMethod, context || propertyKey);

        return descriptor;
    };
}

export default FeatureFlagService;