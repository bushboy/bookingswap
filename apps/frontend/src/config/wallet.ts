/**
 * Wallet configuration for the frontend application
 */

export const WALLET_CONFIG = {
    NETWORK: 'testnet',
    PRIMARY_TESTNET_ACCOUNT: '0.0.6199687',
    DEFAULT_BALANCE: 100.5,
} as const;

export type WalletNetwork = typeof WALLET_CONFIG.NETWORK;