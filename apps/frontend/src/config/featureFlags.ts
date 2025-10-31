/**
 * Feature flags configuration for controlling UI visibility
 * Handles environment variables and provides typed configuration for feature toggles
 */

export interface FeatureFlags {
    // Auction Mode Features
    ENABLE_AUCTION_MODE: boolean;

    // Cash Swap Features
    ENABLE_CASH_SWAPS: boolean;

    // Cash Proposal Features
    ENABLE_CASH_PROPOSALS: boolean;
}

/**
 * Parse environment variable as boolean with fallback
 */
const parseEnvBoolean = (value: string | undefined, fallback: boolean): boolean => {
    if (!value) return fallback;
    return value.toLowerCase() === 'true';
};

/**
 * Get feature flags configuration from environment variables
 */
export const getFeatureFlags = (): FeatureFlags => {
    const config: FeatureFlags = {
        // Auction Mode - Controls auction acceptance strategy and related UI
        ENABLE_AUCTION_MODE: parseEnvBoolean(import.meta.env.VITE_ENABLE_AUCTION_MODE, false),

        // Cash Swaps - Controls cash payment options in swap creation
        ENABLE_CASH_SWAPS: parseEnvBoolean(import.meta.env.VITE_ENABLE_CASH_SWAPS, false),

        // Cash Proposals - Controls cash offer functionality in proposal modal
        ENABLE_CASH_PROPOSALS: parseEnvBoolean(import.meta.env.VITE_ENABLE_CASH_PROPOSALS, false),
    };

    return config;
};

/**
 * Default feature flags configuration for testing and fallback
 */
export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
    ENABLE_AUCTION_MODE: false,
    ENABLE_CASH_SWAPS: false,
    ENABLE_CASH_PROPOSALS: false,
};

/**
 * Centralized feature flags instance - initialized once and reused
 */
export const FEATURE_FLAGS = getFeatureFlags();