/**
 * Centralized wallet configuration for test environments
 * This file provides consistent wallet addresses and helper functions for all tests
 */

// Wallet address format validation regex
const WALLET_ADDRESS_REGEX = /^0\.0\.\d+$/;

/**
 * Centralized wallet configuration constants
 */
export const WALLET_CONFIG = {
    PRIMARY_TESTNET_ACCOUNT: '0.0.6199687',
    PRIMARY_TESTNET_PRIVATE_KEY: '302e020100300506032b6570042204200d011c720c7f83813569957825c8da8ce95bc4e8f17fc4a44d4614d7b7e60c70',
    SECONDARY_TESTNET_ACCOUNT: '0.0.6199688', // For multi-wallet scenarios
    NETWORK: 'testnet',
    DEFAULT_BALANCE: 100.5,
    TRANSACTION_ID_PREFIX: '0.0.6199687@'
} as const;

/**
 * Validates wallet address format (0.0.XXXXXX)
 * @param address - The wallet address to validate
 * @returns true if the address format is valid
 */
export function validateWalletAddress(address: string): boolean {
    return WALLET_ADDRESS_REGEX.test(address);
}

/**
 * Creates a mock wallet response object for testing
 * @param accountId - Optional account ID, defaults to primary testnet account
 * @returns Mock wallet response object
 */
export const createMockWalletResponse = (accountId: string = WALLET_CONFIG.PRIMARY_TESTNET_ACCOUNT) => {
    if (!validateWalletAddress(accountId)) {
        throw new Error(`Invalid wallet address format: ${accountId}`);
    }

    return {
        accountIds: [accountId],
        network: WALLET_CONFIG.NETWORK,
    };
};

/**
 * Creates mock account info for testing
 * @param accountId - Optional account ID, defaults to primary testnet account
 * @returns Mock account info object
 */
export const createMockAccountInfo = (accountId: string = WALLET_CONFIG.PRIMARY_TESTNET_ACCOUNT) => {
    if (!validateWalletAddress(accountId)) {
        throw new Error(`Invalid wallet address format: ${accountId}`);
    }

    return {
        accountId,
        balance: { hbars: WALLET_CONFIG.DEFAULT_BALANCE },
    };
};

/**
 * Creates a mock wallet with private key for testing
 * @returns Mock wallet object with private key
 */
export const createMockWalletWithPrivateKey = () => ({
    accountId: WALLET_CONFIG.PRIMARY_TESTNET_ACCOUNT,
    privateKey: WALLET_CONFIG.PRIMARY_TESTNET_PRIVATE_KEY,
    network: WALLET_CONFIG.NETWORK,
});

/**
 * Creates a mock transaction ID using the configured wallet address
 * @param timestamp - Optional timestamp, defaults to current time
 * @returns Mock transaction ID string
 */
export const createMockTransactionId = (timestamp?: number) => {
    const ts = timestamp || Math.floor(Date.now() / 1000);
    return `${WALLET_CONFIG.TRANSACTION_ID_PREFIX}${ts}.123456789`;
};

/**
 * Validates the wallet configuration on module load
 */
function validateConfiguration() {
    if (!validateWalletAddress(WALLET_CONFIG.PRIMARY_TESTNET_ACCOUNT)) {
        throw new Error(`Invalid primary wallet address format: ${WALLET_CONFIG.PRIMARY_TESTNET_ACCOUNT}`);
    }

    if (!validateWalletAddress(WALLET_CONFIG.SECONDARY_TESTNET_ACCOUNT)) {
        throw new Error(`Invalid secondary wallet address format: ${WALLET_CONFIG.SECONDARY_TESTNET_ACCOUNT}`);
    }

    if (!WALLET_CONFIG.PRIMARY_TESTNET_PRIVATE_KEY) {
        throw new Error('Primary testnet private key is required');
    }
}

// Validate configuration on module load
validateConfiguration();