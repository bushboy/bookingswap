import { config } from 'dotenv';
import { logger } from '../../utils/logger';

// Load environment variables
config();

export interface HederaConfig {
  network: 'testnet' | 'mainnet';
  accountId: string;
  privateKey: string;
  topicId?: string;
  mirrorNodeUrl: string;
}

/**
 * Get Hedera configuration from environment variables
 */
export function getHederaConfig(): HederaConfig {
  const network = (process.env.HEDERA_NETWORK as 'testnet' | 'mainnet') || 'testnet';
  const accountId = process.env.HEDERA_ACCOUNT_ID;
  const privateKey = process.env.HEDERA_PRIVATE_KEY;
  const topicId = process.env.HEDERA_TOPIC_ID;

  if (!accountId) {
    throw new Error('HEDERA_ACCOUNT_ID environment variable is required');
  }

  if (!privateKey) {
    throw new Error('HEDERA_PRIVATE_KEY environment variable is required');
  }

  // Set mirror node URL based on network
  const mirrorNodeUrl = network === 'testnet' 
    ? 'https://testnet.mirrornode.hedera.com'
    : 'https://mainnet-public.mirrornode.hedera.com';

  const hederaConfig: HederaConfig = {
    network,
    accountId,
    privateKey,
    topicId,
    mirrorNodeUrl,
  };

  logger.info('Hedera configuration loaded', {
    network,
    accountId,
    topicId,
    mirrorNodeUrl,
    hasPrivateKey: !!privateKey,
  });

  return hederaConfig;
}

/**
 * Validate Hedera configuration
 */
export function validateHederaConfig(config: HederaConfig): void {
  if (!config.accountId || !config.accountId.match(/^\d+\.\d+\.\d+$/)) {
    throw new Error('Invalid Hedera account ID format. Expected format: 0.0.123456');
  }

  if (!config.privateKey) {
    throw new Error('Hedera private key is required');
  }

  if (config.topicId && !config.topicId.match(/^\d+\.\d+\.\d+$/)) {
    throw new Error('Invalid Hedera topic ID format. Expected format: 0.0.789012');
  }

  if (!['testnet', 'mainnet'].includes(config.network)) {
    throw new Error('Hedera network must be either "testnet" or "mainnet"');
  }

  logger.info('Hedera configuration validated successfully');
}

/**
 * Get testnet configuration for development
 */
export function getTestnetConfig(): Partial<HederaConfig> {
  return {
    network: 'testnet',
    mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com',
  };
}

/**
 * Get mainnet configuration for production
 */
export function getMainnetConfig(): Partial<HederaConfig> {
  return {
    network: 'mainnet',
    mirrorNodeUrl: 'https://mainnet-public.mirrornode.hedera.com',
  };
}