/**
 * Tests for feature flags configuration
 */

import { describe, it, expect } from 'vitest';
import { getFeatureFlags, DEFAULT_FEATURE_FLAGS, FEATURE_FLAGS } from '../featureFlags';

describe('FeatureFlags', () => {
    describe('getFeatureFlags', () => {
        it('should return a valid configuration object', () => {
            const config = getFeatureFlags();

            expect(config).toBeDefined();
            expect(typeof config.ENABLE_AUCTION_MODE).toBe('boolean');
            expect(typeof config.ENABLE_CASH_SWAPS).toBe('boolean');
            expect(typeof config.ENABLE_CASH_PROPOSALS).toBe('boolean');
        });

        it('should have all required feature flags', () => {
            const config = getFeatureFlags();

            expect(config).toHaveProperty('ENABLE_AUCTION_MODE');
            expect(config).toHaveProperty('ENABLE_CASH_SWAPS');
            expect(config).toHaveProperty('ENABLE_CASH_PROPOSALS');
        });
    });

    describe('DEFAULT_FEATURE_FLAGS', () => {
        it('should have all features disabled by default', () => {
            expect(DEFAULT_FEATURE_FLAGS).toEqual({
                ENABLE_AUCTION_MODE: false,
                ENABLE_CASH_SWAPS: false,
                ENABLE_CASH_PROPOSALS: false,
            });
        });

        it('should be a valid FeatureFlags object', () => {
            expect(DEFAULT_FEATURE_FLAGS).toBeDefined();
            expect(typeof DEFAULT_FEATURE_FLAGS.ENABLE_AUCTION_MODE).toBe('boolean');
            expect(typeof DEFAULT_FEATURE_FLAGS.ENABLE_CASH_SWAPS).toBe('boolean');
            expect(typeof DEFAULT_FEATURE_FLAGS.ENABLE_CASH_PROPOSALS).toBe('boolean');
        });
    });

    describe('FEATURE_FLAGS constant', () => {
        it('should be initialized with current environment configuration', () => {
            // This test verifies that FEATURE_FLAGS is properly initialized
            expect(FEATURE_FLAGS).toBeDefined();
            expect(typeof FEATURE_FLAGS.ENABLE_AUCTION_MODE).toBe('boolean');
            expect(typeof FEATURE_FLAGS.ENABLE_CASH_SWAPS).toBe('boolean');
            expect(typeof FEATURE_FLAGS.ENABLE_CASH_PROPOSALS).toBe('boolean');
        });

        it('should match the result of getFeatureFlags()', () => {
            const dynamicConfig = getFeatureFlags();
            expect(FEATURE_FLAGS).toEqual(dynamicConfig);
        });
    });

    describe('parseEnvBoolean functionality', () => {
        it('should handle boolean parsing correctly through getFeatureFlags', () => {
            // Test that the function returns boolean values regardless of input
            const config = getFeatureFlags();

            // All values should be booleans
            expect(typeof config.ENABLE_AUCTION_MODE).toBe('boolean');
            expect(typeof config.ENABLE_CASH_SWAPS).toBe('boolean');
            expect(typeof config.ENABLE_CASH_PROPOSALS).toBe('boolean');

            // Values should be either true or false (not undefined or null)
            expect([true, false]).toContain(config.ENABLE_AUCTION_MODE);
            expect([true, false]).toContain(config.ENABLE_CASH_SWAPS);
            expect([true, false]).toContain(config.ENABLE_CASH_PROPOSALS);
        });
    });
});