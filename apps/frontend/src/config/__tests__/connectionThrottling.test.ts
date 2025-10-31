/**
 * Connection Throttling Configuration Tests
 * 
 * Tests for the throttling configuration functionality.
 * Focuses on core configuration logic only.
 */

import { describe, it, expect, vi } from 'vitest';
import {
    THROTTLING_CONFIGS,
    SERVICE_SPECIFIC_CONFIGS,
    getEnvironmentConfig,
    getServiceConfig,
    DEFAULT_THROTTLING_CONFIG,
    THROTTLING_FEATURE_FLAGS,
    isThrottlingFeatureEnabled,
} from '../connectionThrottling';

describe('Connection Throttling Configuration', () => {
    describe('THROTTLING_CONFIGS', () => {
        it('should have configurations for all environments', () => {
            expect(THROTTLING_CONFIGS).toHaveProperty('development');
            expect(THROTTLING_CONFIGS).toHaveProperty('production');
            expect(THROTTLING_CONFIGS).toHaveProperty('test');
        });

        it('should have valid development configuration', () => {
            const config = THROTTLING_CONFIGS.development;

            expect(config.debounceDelay).toBe(500);
            expect(config.maxRetries).toBe(5);
            expect(config.retryDelay).toBe(1000);
            expect(config.connectionTimeout).toBe(5000);
            expect(config.maxAttemptsPerWindow).toBe(15);
            expect(config.rateLimitWindow).toBe(30000);
        });

        it('should have valid production configuration', () => {
            const config = THROTTLING_CONFIGS.production;

            expect(config.debounceDelay).toBe(1000);
            expect(config.maxRetries).toBe(3);
            expect(config.retryDelay).toBe(2000);
            expect(config.connectionTimeout).toBe(10000);
            expect(config.maxAttemptsPerWindow).toBe(10);
            expect(config.rateLimitWindow).toBe(60000);
        });

        it('should have valid test configuration', () => {
            const config = THROTTLING_CONFIGS.test;

            expect(config.debounceDelay).toBe(100);
            expect(config.maxRetries).toBe(2);
            expect(config.retryDelay).toBe(200);
            expect(config.connectionTimeout).toBe(2000);
            expect(config.maxAttemptsPerWindow).toBe(20);
            expect(config.rateLimitWindow).toBe(10000);
        });

        it('should have production config more conservative than development', () => {
            const dev = THROTTLING_CONFIGS.development;
            const prod = THROTTLING_CONFIGS.production;

            expect(prod.debounceDelay).toBeGreaterThan(dev.debounceDelay);
            expect(prod.retryDelay).toBeGreaterThan(dev.retryDelay);
            expect(prod.connectionTimeout).toBeGreaterThan(dev.connectionTimeout);
            expect(prod.maxAttemptsPerWindow).toBeLessThan(dev.maxAttemptsPerWindow);
            expect(prod.rateLimitWindow).toBeGreaterThan(dev.rateLimitWindow);
        });

        it('should have test config with minimal delays', () => {
            const test = THROTTLING_CONFIGS.test;
            const dev = THROTTLING_CONFIGS.development;
            const prod = THROTTLING_CONFIGS.production;

            expect(test.debounceDelay).toBeLessThan(dev.debounceDelay);
            expect(test.debounceDelay).toBeLessThan(prod.debounceDelay);
            expect(test.retryDelay).toBeLessThan(dev.retryDelay);
            expect(test.retryDelay).toBeLessThan(prod.retryDelay);
        });
    });

    describe('SERVICE_SPECIFIC_CONFIGS', () => {
        it('should have configurations for all WebSocket services', () => {
            expect(SERVICE_SPECIFIC_CONFIGS).toHaveProperty('proposalWebSocketService');
            expect(SERVICE_SPECIFIC_CONFIGS).toHaveProperty('completionWebSocketService');
            expect(SERVICE_SPECIFIC_CONFIGS).toHaveProperty('targetingWebSocketService');
        });

        it('should have valid proposal service configuration', () => {
            const config = SERVICE_SPECIFIC_CONFIGS.proposalWebSocketService;

            expect(config.debounceDelay).toBe(800);
            expect(config.maxRetries).toBe(4);
        });

        it('should have valid completion service configuration', () => {
            const config = SERVICE_SPECIFIC_CONFIGS.completionWebSocketService;

            expect(config.debounceDelay).toBe(1200);
            expect(config.retryDelay).toBe(2500);
        });

        it('should have valid targeting service configuration', () => {
            const config = SERVICE_SPECIFIC_CONFIGS.targetingWebSocketService;

            expect(config.debounceDelay).toBe(1000);
            expect(config.maxRetries).toBe(3);
        });
    });

    describe('getEnvironmentConfig', () => {
        it('should return development config when explicitly requested', () => {
            const config = getEnvironmentConfig('development');
            expect(config).toEqual(THROTTLING_CONFIGS.development);
        });

        it('should return correct config for valid environment', () => {
            const prodConfig = getEnvironmentConfig('production');
            expect(prodConfig).toEqual(THROTTLING_CONFIGS.production);

            const testConfig = getEnvironmentConfig('test');
            expect(testConfig).toEqual(THROTTLING_CONFIGS.test);
        });

        it('should fallback to development config for unknown environment', () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

            const config = getEnvironmentConfig('unknown');
            expect(config).toEqual(THROTTLING_CONFIGS.development);
            expect(consoleSpy).toHaveBeenCalledWith(
                'Unknown environment: unknown, falling back to development config'
            );

            consoleSpy.mockRestore();
        });
    });

    describe('getServiceConfig', () => {
        it('should return base config for unknown service', () => {
            const config = getServiceConfig('unknown-service', 'production');
            expect(config).toEqual(THROTTLING_CONFIGS.production);
        });

        it('should merge environment config with service overrides', () => {
            const config = getServiceConfig('proposalWebSocketService', 'production');
            const baseConfig = THROTTLING_CONFIGS.production;
            const serviceOverrides = SERVICE_SPECIFIC_CONFIGS.proposalWebSocketService;

            expect(config.debounceDelay).toBe(serviceOverrides.debounceDelay);
            expect(config.maxRetries).toBe(serviceOverrides.maxRetries);
            expect(config.retryDelay).toBe(baseConfig.retryDelay);
            expect(config.connectionTimeout).toBe(baseConfig.connectionTimeout);
        });

        it('should use specified environment config', () => {
            const config = getServiceConfig('completionWebSocketService', 'development');
            const expectedConfig = {
                ...THROTTLING_CONFIGS.development,
                ...SERVICE_SPECIFIC_CONFIGS.completionWebSocketService,
            };

            expect(config).toEqual(expectedConfig);
        });

        it('should prioritize service overrides over environment config', () => {
            const config = getServiceConfig('targetingWebSocketService', 'test');
            const serviceOverrides = SERVICE_SPECIFIC_CONFIGS.targetingWebSocketService;

            expect(config.debounceDelay).toBe(serviceOverrides.debounceDelay);
            expect(config.maxRetries).toBe(serviceOverrides.maxRetries);
        });
    });

    describe('DEFAULT_THROTTLING_CONFIG', () => {
        it('should be a valid throttling configuration', () => {
            expect(DEFAULT_THROTTLING_CONFIG).toHaveProperty('debounceDelay');
            expect(DEFAULT_THROTTLING_CONFIG).toHaveProperty('maxRetries');
            expect(DEFAULT_THROTTLING_CONFIG).toHaveProperty('retryDelay');
            expect(DEFAULT_THROTTLING_CONFIG).toHaveProperty('connectionTimeout');
            expect(DEFAULT_THROTTLING_CONFIG).toHaveProperty('maxAttemptsPerWindow');
            expect(DEFAULT_THROTTLING_CONFIG).toHaveProperty('rateLimitWindow');
        });
    });

    describe('THROTTLING_FEATURE_FLAGS', () => {
        it('should have all required feature flags', () => {
            expect(THROTTLING_FEATURE_FLAGS).toHaveProperty('ENABLE_CONNECTION_THROTTLING');
            expect(THROTTLING_FEATURE_FLAGS).toHaveProperty('ENABLE_RATE_LIMITING');
            expect(THROTTLING_FEATURE_FLAGS).toHaveProperty('ENABLE_EXPONENTIAL_BACKOFF');
            expect(THROTTLING_FEATURE_FLAGS).toHaveProperty('ENABLE_CONNECTION_STATE_CHECKING');
            expect(THROTTLING_FEATURE_FLAGS).toHaveProperty('ENABLE_THROTTLING_DEBUG_LOGS');
        });

        it('should have throttling enabled by default', () => {
            expect(THROTTLING_FEATURE_FLAGS.ENABLE_CONNECTION_THROTTLING).toBe(true);
            expect(THROTTLING_FEATURE_FLAGS.ENABLE_RATE_LIMITING).toBe(true);
            expect(THROTTLING_FEATURE_FLAGS.ENABLE_EXPONENTIAL_BACKOFF).toBe(true);
            expect(THROTTLING_FEATURE_FLAGS.ENABLE_CONNECTION_STATE_CHECKING).toBe(true);
        });
    });

    describe('isThrottlingFeatureEnabled', () => {
        it('should return correct status for enabled features', () => {
            expect(isThrottlingFeatureEnabled('ENABLE_CONNECTION_THROTTLING')).toBe(true);
            expect(isThrottlingFeatureEnabled('ENABLE_RATE_LIMITING')).toBe(true);
        });

        it('should handle all feature flags', () => {
            const flags = Object.keys(THROTTLING_FEATURE_FLAGS) as Array<keyof typeof THROTTLING_FEATURE_FLAGS>;

            flags.forEach(flag => {
                const result = isThrottlingFeatureEnabled(flag);
                expect(typeof result).toBe('boolean');
            });
        });
    });

    describe('Configuration Validation', () => {
        it('should have reasonable default values', () => {
            const config = THROTTLING_CONFIGS.production;

            // Debounce delay should be reasonable (not too short or too long)
            expect(config.debounceDelay).toBeGreaterThan(100);
            expect(config.debounceDelay).toBeLessThan(5000);

            // Max retries should be reasonable
            expect(config.maxRetries).toBeGreaterThan(0);
            expect(config.maxRetries).toBeLessThan(10);

            // Retry delay should be reasonable
            expect(config.retryDelay).toBeGreaterThan(config.debounceDelay);
            expect(config.retryDelay).toBeLessThan(30000);

            // Connection timeout should be reasonable
            expect(config.connectionTimeout).toBeGreaterThan(config.retryDelay);
            expect(config.connectionTimeout).toBeLessThan(60000);
        });

        it('should have consistent rate limiting configuration', () => {
            Object.values(THROTTLING_CONFIGS).forEach(config => {
                expect(config.maxAttemptsPerWindow).toBeGreaterThan(0);
                expect(config.rateLimitWindow).toBeGreaterThan(config.connectionTimeout);
            });
        });

        it('should have service-specific overrides that make sense', () => {
            const proposalConfig = SERVICE_SPECIFIC_CONFIGS.proposalWebSocketService;
            const completionConfig = SERVICE_SPECIFIC_CONFIGS.completionWebSocketService;

            // Proposal service should be more aggressive (lower debounce delay)
            expect(proposalConfig.debounceDelay).toBeLessThan(completionConfig.debounceDelay!);

            // Completion service should be more conservative (higher retry delay)
            expect(completionConfig.retryDelay).toBeGreaterThan(2000);
        });
    });
});