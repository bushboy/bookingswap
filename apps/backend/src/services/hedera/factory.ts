import { HederaService } from './HederaService';
import { getHederaConfig, validateHederaConfig } from './config';
import { logger } from '../../utils/logger';

let hederaServiceInstance: HederaService | null = null;

/**
 * Create and configure a HederaService instance using environment variables
 */
export function createHederaService(): HederaService {
  try {
    const config = getHederaConfig();
    validateHederaConfig(config);

    const service = new HederaService(
      config.network,
      config.accountId,
      config.privateKey,
      config.topicId
    );

    logger.info('HederaService created successfully', {
      network: config.network,
      accountId: config.accountId,
      topicId: config.topicId,
    });

    return service;
  } catch (error) {
    logger.error('Failed to create HederaService', { error });
    throw new Error(`HederaService initialization failed: ${error.message}`);
  }
}

/**
 * Get a singleton instance of HederaService
 */
export function getHederaService(): HederaService {
  if (!hederaServiceInstance) {
    hederaServiceInstance = createHederaService();
  }
  return hederaServiceInstance;
}

/**
 * Close and reset the singleton HederaService instance
 */
export function closeHederaService(): void {
  if (hederaServiceInstance) {
    hederaServiceInstance.close();
    hederaServiceInstance = null;
    logger.info('HederaService instance closed and reset');
  }
}

/**
 * Create a HederaService instance for testing with custom configuration
 */
export function createTestHederaService(
  network: 'testnet' | 'mainnet' = 'testnet',
  accountId: string = '0.0.123456',
  privateKey: string = 'test-private-key',
  topicId?: string
): HederaService {
  logger.info('Creating test HederaService instance', {
    network,
    accountId,
    topicId,
  });

  return new HederaService(network, accountId, privateKey, topicId);
}