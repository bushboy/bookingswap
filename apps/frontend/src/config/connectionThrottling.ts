/**
 * Connection Throttling Configuration
 * 
 * Provides environment-specific throttling configuration for WebSocket connections.
 * Implements requirement 2.2 from the WebSocket Connection Throttling Fix specification.
 */

import { ConnectionThrottleConfig } from '../utils/connectionThrottling';

/**
 * Environment-specific throttling configurations
 */
export const THROTTLING_CONFIGS = {
    /**
     * Development configuration - More aggressive retry settings for faster feedback
     */
    development: {
        debounceDelay: 200,         // 0.2 second delay for faster development
        maxRetries: 8,              // More retries for development
        retryDelay: 500,            // 0.5 second retry delay (shorter for dev)
        connectionTimeout: 5000,    // 5 second timeout
        maxAttemptsPerWindow: 25,   // More attempts allowed in development
        rateLimitWindow: 30000,     // 30 second window
    } as ConnectionThrottleConfig,

    /**
     * Production configuration - Conservative settings for stability
     */
    production: {
        debounceDelay: 1000,        // 1 second delay for stability
        maxRetries: 3,              // Conservative retry count
        retryDelay: 2000,           // 2 second retry delay
        connectionTimeout: 10000,   // 10 second timeout
        maxAttemptsPerWindow: 10,   // Limited attempts for stability
        rateLimitWindow: 60000,     // 1 minute window
    } as ConnectionThrottleConfig,

    /**
     * Testing configuration - Minimal delays for faster test execution
     */
    test: {
        debounceDelay: 100,         // 0.1 second delay for fast tests
        maxRetries: 2,              // Minimal retries for tests
        retryDelay: 200,            // 0.2 second retry delay
        connectionTimeout: 2000,    // 2 second timeout
        maxAttemptsPerWindow: 20,   // More attempts for test scenarios
        rateLimitWindow: 10000,     // 10 second window
    } as ConnectionThrottleConfig,
};

/**
 * Service-specific throttling overrides
 * Allows fine-tuning throttling behavior for specific WebSocket services
 */
export const SERVICE_SPECIFIC_CONFIGS = {
    /**
     * Proposal WebSocket Service configuration
     */
    proposalWebSocketService: {
        // More lenient for proposal updates in development
        debounceDelay: 100,         // Very short delay for proposals
        maxRetries: 6,              // More retries for proposals
        retryDelay: 300,            // Short retry delay
    } as Partial<ConnectionThrottleConfig>,

    /**
     * Completion WebSocket Service configuration
     */
    completionWebSocketService: {
        // More conservative for completion operations
        debounceDelay: 1200,
        retryDelay: 2500,
    } as Partial<ConnectionThrottleConfig>,

    /**
     * Targeting WebSocket Service configuration
     */
    targetingWebSocketService: {
        // Balanced configuration for targeting
        debounceDelay: 1000,
        maxRetries: 3,
    } as Partial<ConnectionThrottleConfig>,

    /**
     * Main useWebSocket Hook configuration
     */
    useWebSocket: {
        // Very lenient for main WebSocket hook
        debounceDelay: 50,          // Very short delay
        maxRetries: 10,             // Many retries
        retryDelay: 200,            // Short retry delay
    } as Partial<ConnectionThrottleConfig>,
};

/**
 * Get the appropriate throttling configuration based on environment
 * 
 * @param environment - Current environment (development, production, test)
 * @returns Throttling configuration for the environment
 */
export function getEnvironmentConfig(
    environment: string = import.meta.env.MODE || 'development'
): ConnectionThrottleConfig {
    const envConfig = THROTTLING_CONFIGS[environment as keyof typeof THROTTLING_CONFIGS];

    if (!envConfig) {
        console.warn(`Unknown environment: ${environment}, falling back to development config`);
        return THROTTLING_CONFIGS.development;
    }

    return envConfig;
}

/**
 * Get throttling configuration for a specific service
 * Merges environment config with service-specific overrides
 * 
 * @param serviceId - Unique identifier for the WebSocket service
 * @param environment - Current environment (optional, defaults to current env)
 * @returns Merged throttling configuration
 */
export function getServiceConfig(
    serviceId: string,
    environment?: string
): ConnectionThrottleConfig {
    const baseConfig = getEnvironmentConfig(environment);
    const serviceOverrides = SERVICE_SPECIFIC_CONFIGS[serviceId as keyof typeof SERVICE_SPECIFIC_CONFIGS];

    if (!serviceOverrides) {
        return baseConfig;
    }

    return { ...baseConfig, ...serviceOverrides };
}

/**
 * Default throttling configuration
 * Uses environment-based configuration with reasonable defaults
 */
export const DEFAULT_THROTTLING_CONFIG = getEnvironmentConfig();

/**
 * Feature flags for throttling behavior
 */
export const THROTTLING_FEATURE_FLAGS = {
    /** Enable connection throttling globally */
    ENABLE_CONNECTION_THROTTLING: true,

    /** Enable rate limiting */
    ENABLE_RATE_LIMITING: true,

    /** Enable exponential backoff for retries */
    ENABLE_EXPONENTIAL_BACKOFF: false, // Disable exponential backoff in development

    /** Enable connection state checking */
    ENABLE_CONNECTION_STATE_CHECKING: true,

    /** Enable debug logging for throttling */
    ENABLE_THROTTLING_DEBUG_LOGS: import.meta.env.MODE === 'development',

    /** Enable throttling for useWebSocket hook specifically */
    ENABLE_USE_WEBSOCKET_THROTTLING: false, // Temporarily disable for main hook
};

/**
 * Check if a throttling feature is enabled
 * 
 * @param feature - Feature flag name
 * @returns True if feature is enabled
 */
export function isThrottlingFeatureEnabled(
    feature: keyof typeof THROTTLING_FEATURE_FLAGS
): boolean {
    return THROTTLING_FEATURE_FLAGS[feature] === true;
}

export default {
    THROTTLING_CONFIGS,
    SERVICE_SPECIFIC_CONFIGS,
    getEnvironmentConfig,
    getServiceConfig,
    DEFAULT_THROTTLING_CONFIG,
    THROTTLING_FEATURE_FLAGS,
    isThrottlingFeatureEnabled,
};