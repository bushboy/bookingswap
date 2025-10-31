import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getHederaConfig, validateHederaConfig, getTestnetConfig, getMainnetConfig } from '../config';

// Mock logger
vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('Hedera Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getHederaConfig', () => {
    it('should return testnet configuration with all required variables', () => {
      process.env.HEDERA_NETWORK = 'testnet';
      process.env.HEDERA_ACCOUNT_ID = '0.0.123456';
      process.env.HEDERA_PRIVATE_KEY = 'test-private-key';
      process.env.HEDERA_TOPIC_ID = '0.0.789012';

      const config = getHederaConfig();

      expect(config).toEqual({
        network: 'testnet',
        accountId: '0.0.123456',
        privateKey: 'test-private-key',
        topicId: '0.0.789012',
        mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com',
      });
    });

    it('should return mainnet configuration', () => {
      process.env.HEDERA_NETWORK = 'mainnet';
      process.env.HEDERA_ACCOUNT_ID = '0.0.123456';
      process.env.HEDERA_PRIVATE_KEY = 'test-private-key';

      const config = getHederaConfig();

      expect(config).toEqual({
        network: 'mainnet',
        accountId: '0.0.123456',
        privateKey: 'test-private-key',
        topicId: undefined,
        mirrorNodeUrl: 'https://mainnet-public.mirrornode.hedera.com',
      });
    });

    it('should default to testnet when network is not specified', () => {
      process.env.HEDERA_ACCOUNT_ID = '0.0.123456';
      process.env.HEDERA_PRIVATE_KEY = 'test-private-key';
      delete process.env.HEDERA_NETWORK;

      const config = getHederaConfig();

      expect(config.network).toBe('testnet');
      expect(config.mirrorNodeUrl).toBe('https://testnet.mirrornode.hedera.com');
    });

    it('should throw error when account ID is missing', () => {
      process.env.HEDERA_PRIVATE_KEY = 'test-private-key';
      delete process.env.HEDERA_ACCOUNT_ID;

      expect(() => getHederaConfig())
        .toThrow('HEDERA_ACCOUNT_ID environment variable is required');
    });

    it('should throw error when private key is missing', () => {
      process.env.HEDERA_ACCOUNT_ID = '0.0.123456';
      delete process.env.HEDERA_PRIVATE_KEY;

      expect(() => getHederaConfig())
        .toThrow('HEDERA_PRIVATE_KEY environment variable is required');
    });

    it('should work without topic ID', () => {
      process.env.HEDERA_ACCOUNT_ID = '0.0.123456';
      process.env.HEDERA_PRIVATE_KEY = 'test-private-key';
      delete process.env.HEDERA_TOPIC_ID;

      const config = getHederaConfig();

      expect(config.topicId).toBeUndefined();
    });
  });

  describe('validateHederaConfig', () => {
    it('should validate correct configuration', () => {
      const config = {
        network: 'testnet' as const,
        accountId: '0.0.123456',
        privateKey: 'test-private-key',
        topicId: '0.0.789012',
        mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com',
      };

      expect(() => validateHederaConfig(config)).not.toThrow();
    });

    it('should throw error for invalid account ID format', () => {
      const config = {
        network: 'testnet' as const,
        accountId: 'invalid-account-id',
        privateKey: 'test-private-key',
        mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com',
      };

      expect(() => validateHederaConfig(config))
        .toThrow('Invalid Hedera account ID format. Expected format: 0.0.123456');
    });

    it('should throw error for missing private key', () => {
      const config = {
        network: 'testnet' as const,
        accountId: '0.0.123456',
        privateKey: '',
        mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com',
      };

      expect(() => validateHederaConfig(config))
        .toThrow('Hedera private key is required');
    });

    it('should throw error for invalid topic ID format', () => {
      const config = {
        network: 'testnet' as const,
        accountId: '0.0.123456',
        privateKey: 'test-private-key',
        topicId: 'invalid-topic-id',
        mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com',
      };

      expect(() => validateHederaConfig(config))
        .toThrow('Invalid Hedera topic ID format. Expected format: 0.0.789012');
    });

    it('should throw error for invalid network', () => {
      const config = {
        network: 'invalid-network' as any,
        accountId: '0.0.123456',
        privateKey: 'test-private-key',
        mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com',
      };

      expect(() => validateHederaConfig(config))
        .toThrow('Hedera network must be either "testnet" or "mainnet"');
    });

    it('should validate configuration without topic ID', () => {
      const config = {
        network: 'testnet' as const,
        accountId: '0.0.123456',
        privateKey: 'test-private-key',
        mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com',
      };

      expect(() => validateHederaConfig(config)).not.toThrow();
    });

    it('should accept various valid account ID formats', () => {
      const validAccountIds = ['0.0.123456', '1.2.3456789', '999.999.999999'];

      validAccountIds.forEach(accountId => {
        const config = {
          network: 'testnet' as const,
          accountId,
          privateKey: 'test-private-key',
          mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com',
        };

        expect(() => validateHederaConfig(config)).not.toThrow();
      });
    });

    it('should reject invalid account ID formats', () => {
      const invalidAccountIds = ['0.0', '123456', 'abc.def.ghi', '0.0.123456.789'];

      invalidAccountIds.forEach(accountId => {
        const config = {
          network: 'testnet' as const,
          accountId,
          privateKey: 'test-private-key',
          mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com',
        };

        expect(() => validateHederaConfig(config))
          .toThrow('Invalid Hedera account ID format. Expected format: 0.0.123456');
      });
    });
  });

  describe('getTestnetConfig', () => {
    it('should return testnet configuration', () => {
      const config = getTestnetConfig();

      expect(config).toEqual({
        network: 'testnet',
        mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com',
      });
    });
  });

  describe('getMainnetConfig', () => {
    it('should return mainnet configuration', () => {
      const config = getMainnetConfig();

      expect(config).toEqual({
        network: 'mainnet',
        mirrorNodeUrl: 'https://mainnet-public.mirrornode.hedera.com',
      });
    });
  });
});