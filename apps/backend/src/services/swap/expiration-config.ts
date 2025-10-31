import { logger } from '../../utils/logger';

/**
 * Configuration interface for SwapExpirationService
 */
export interface SwapExpirationConfig {
    /** Whether the service is enabled */
    enabled: boolean;

    /** Check interval in minutes */
    checkIntervalMinutes: number;

    /** Startup delay in milliseconds to ensure dependencies are ready */
    startupDelayMs: number;

    /** Shutdown timeout in milliseconds for graceful shutdown */
    shutdownTimeoutMs: number;

    /** Enable detailed logging for service operations */
    enableDetailedLogging: boolean;

    /** Enable performance metrics collection */
    enableMetrics: boolean;
}

/**
 * Default configuration for SwapExpirationService
 */
export const DEFAULT_SWAP_EXPIRATION_CONFIG: SwapExpirationConfig = {
    // Service enabled by default
    enabled: true,

    // Check every 5 minutes
    checkIntervalMinutes: 5,

    // Wait 10 seconds after startup for dependencies to stabilize
    startupDelayMs: 10000,

    // Allow 30 seconds for graceful shutdown
    shutdownTimeoutMs: 30000,

    // Enable detailed logging in development
    enableDetailedLogging: false,

    // Enable metrics collection
    enableMetrics: true,
};

/**
 * Get SwapExpirationService configuration from environment variables with fallbacks
 */
export function getSwapExpirationConfig(): SwapExpirationConfig {
    return {
        enabled: process.env.SWAP_EXPIRATION_ENABLED !== 'false',
        checkIntervalMinutes: parseInt(process.env.SWAP_EXPIRATION_CHECK_INTERVAL_MINUTES || '5'),
        startupDelayMs: parseInt(process.env.SWAP_EXPIRATION_STARTUP_DELAY_MS || '10000'),
        shutdownTimeoutMs: parseInt(process.env.SWAP_EXPIRATION_SHUTDOWN_TIMEOUT_MS || '30000'),
        enableDetailedLogging: process.env.SWAP_EXPIRATION_ENABLE_DETAILED_LOGGING === 'true',
        enableMetrics: process.env.SWAP_EXPIRATION_ENABLE_METRICS !== 'false',
    };
}

/**
 * Configuration validation errors
 */
export class SwapExpirationConfigValidationError extends Error {
    constructor(message: string, public field: string) {
        super(message);
        this.name = 'SwapExpirationConfigValidationError';
    }
}

/**
 * Validate SwapExpirationService configuration
 */
export function validateSwapExpirationConfig(config: SwapExpirationConfig): void {
    // Validate check interval
    if (config.checkIntervalMinutes < 1) {
        throw new SwapExpirationConfigValidationError(
            'Check interval must be at least 1 minute',
            'SWAP_EXPIRATION_CHECK_INTERVAL_MINUTES'
        );
    }

    if (config.checkIntervalMinutes > 1440) { // 24 hours
        throw new SwapExpirationConfigValidationError(
            'Check interval cannot exceed 24 hours (1440 minutes)',
            'SWAP_EXPIRATION_CHECK_INTERVAL_MINUTES'
        );
    }

    // Validate startup delay
    if (config.startupDelayMs < 0) {
        throw new SwapExpirationConfigValidationError(
            'Startup delay cannot be negative',
            'SWAP_EXPIRATION_STARTUP_DELAY_MS'
        );
    }

    if (config.startupDelayMs > 300000) { // 5 minutes
        throw new SwapExpirationConfigValidationError(
            'Startup delay cannot exceed 5 minutes (300000ms)',
            'SWAP_EXPIRATION_STARTUP_DELAY_MS'
        );
    }

    // Validate shutdown timeout
    if (config.shutdownTimeoutMs < 1000) { // 1 second minimum
        throw new SwapExpirationConfigValidationError(
            'Shutdown timeout must be at least 1 second (1000ms)',
            'SWAP_EXPIRATION_SHUTDOWN_TIMEOUT_MS'
        );
    }

    if (config.shutdownTimeoutMs > 300000) { // 5 minutes maximum
        throw new SwapExpirationConfigValidationError(
            'Shutdown timeout cannot exceed 5 minutes (300000ms)',
            'SWAP_EXPIRATION_SHUTDOWN_TIMEOUT_MS'
        );
    }

    // Warn about potentially problematic configurations
    if (config.checkIntervalMinutes < 2) {
        logger.warn('SwapExpirationService check interval is very frequent', {
            checkIntervalMinutes: config.checkIntervalMinutes,
            recommendation: 'Consider using at least 2 minutes to avoid excessive database load'
        });
    }

    if (config.startupDelayMs > 60000) { // 1 minute
        logger.warn('SwapExpirationService startup delay is quite long', {
            startupDelayMs: config.startupDelayMs,
            recommendation: 'Consider reducing startup delay for faster service availability'
        });
    }
}

/**
 * Validate and get SwapExpirationService configuration
 */
export function validateAndGetSwapExpirationConfig(): SwapExpirationConfig {
    try {
        const config = getSwapExpirationConfig();
        validateSwapExpirationConfig(config);

        logger.info('SwapExpirationService configuration validation successful', {
            enabled: config.enabled,
            checkIntervalMinutes: config.checkIntervalMinutes,
            startupDelayMs: config.startupDelayMs,
            shutdownTimeoutMs: config.shutdownTimeoutMs,
            enableDetailedLogging: config.enableDetailedLogging,
            enableMetrics: config.enableMetrics,
        });

        return config;
    } catch (error) {
        if (error instanceof SwapExpirationConfigValidationError) {
            logger.error('SwapExpirationService configuration validation failed', {
                field: error.field,
                message: error.message,
            });
        } else {
            logger.error('Unexpected error during SwapExpirationService configuration validation', {
                error: (error as Error).message,
            });
        }
        throw error;
    }
}

/**
 * Get configuration for production environment with stricter validation
 */
export function getProductionSwapExpirationConfig(): SwapExpirationConfig {
    const config = getSwapExpirationConfig();

    // Apply production-specific overrides and validation
    if (process.env.NODE_ENV === 'production') {
        // Ensure reasonable defaults for production
        if (config.checkIntervalMinutes < 2) {
            logger.warn('Overriding check interval to 2 minutes minimum for production', {
                originalValue: config.checkIntervalMinutes,
                newValue: 2
            });
            config.checkIntervalMinutes = 2;
        }

        // Ensure adequate startup delay for production stability
        if (config.startupDelayMs < 5000) {
            logger.warn('Overriding startup delay to 5 seconds minimum for production', {
                originalValue: config.startupDelayMs,
                newValue: 5000
            });
            config.startupDelayMs = 5000;
        }

        // Disable detailed logging in production unless explicitly enabled
        if (!process.env.SWAP_EXPIRATION_ENABLE_DETAILED_LOGGING) {
            config.enableDetailedLogging = false;
        }
    }

    validateSwapExpirationConfig(config);
    return config;
}

/**
 * Check if SwapExpirationService should be enabled based on configuration and environment
 */
export function shouldEnableSwapExpirationService(): boolean {
    const config = getSwapExpirationConfig();

    // Service can be disabled via environment variable
    if (!config.enabled) {
        logger.info('SwapExpirationService disabled by configuration');
        return false;
    }

    // In test environment, service might be disabled by default
    if (process.env.NODE_ENV === 'test' && process.env.SWAP_EXPIRATION_ENABLED !== 'true') {
        logger.info('SwapExpirationService disabled in test environment (set SWAP_EXPIRATION_ENABLED=true to enable)');
        return false;
    }

    return true;
}

/**
 * Get environment-specific configuration recommendations
 */
export function getConfigurationRecommendations(): {
    environment: string;
    recommendations: Array<{
        setting: string;
        currentValue: any;
        recommendedValue: any;
        reason: string;
    }>;
} {
    const config = getSwapExpirationConfig();
    const environment = process.env.NODE_ENV || 'development';
    const recommendations: Array<{
        setting: string;
        currentValue: any;
        recommendedValue: any;
        reason: string;
    }> = [];

    if (environment === 'production') {
        if (config.checkIntervalMinutes < 5) {
            recommendations.push({
                setting: 'SWAP_EXPIRATION_CHECK_INTERVAL_MINUTES',
                currentValue: config.checkIntervalMinutes,
                recommendedValue: 5,
                reason: 'Reduce database load in production'
            });
        }

        if (config.enableDetailedLogging) {
            recommendations.push({
                setting: 'SWAP_EXPIRATION_ENABLE_DETAILED_LOGGING',
                currentValue: true,
                recommendedValue: false,
                reason: 'Reduce log volume in production'
            });
        }
    } else if (environment === 'development') {
        if (config.checkIntervalMinutes > 2) {
            recommendations.push({
                setting: 'SWAP_EXPIRATION_CHECK_INTERVAL_MINUTES',
                currentValue: config.checkIntervalMinutes,
                recommendedValue: 1,
                reason: 'Faster feedback during development'
            });
        }

        if (!config.enableDetailedLogging) {
            recommendations.push({
                setting: 'SWAP_EXPIRATION_ENABLE_DETAILED_LOGGING',
                currentValue: false,
                recommendedValue: true,
                reason: 'Better debugging information during development'
            });
        }
    }

    return {
        environment,
        recommendations
    };
}