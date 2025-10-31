import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHederaService, getHederaService, closeHederaService, createTestHederaService } from '../factory';

// Mock logger
vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock config
vi.mock('../config', () => ({
  getHederaConfig: vi.fn(),
  validateHederaConfig: vi.fn(),
}));

// Mock HederaService
vi.mock('../HederaService', () => ({
  HederaService: vi.fn().mockImplementation(() => ({
    close: vi.fn(),
    getOperatorAccountId: () => '0.0.123456',
    getTopicId: () => '0.0.789012',
  })),
}));

describe('Hedera Factory', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    
    // Reset singleton
    closeHederaService();
  });

  afterEach(() => {
    process.env = originalEnv;
    closeHederaService();
  });

  describe('createHederaService', () => {
    it('should create HederaService with valid configuration', async () => {
      const mockConfig = {
        network: 'testnet' as const,
        accountId: '0.0.123456',
        privateKey: 'test-private-key',
        topicId: '0.0.789012',
        mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com',
      };

      const { getHederaConfig, validateHederaConfig } = await import('../config');
      (getHederaConfig as any).mockReturnValue(mockConfig);
      (validateHederaConfig as any).mockImplementation(() => {});

      const service = createHederaService();

      expect(service).toBeDefined();
      expect(getHederaConfig).toHaveBeenCalled();
      expect(validateHederaConfig).toHaveBeenCalledWith(mockConfig);
    });

    it('should throw error when configuration is invalid', async () => {
      const { getHederaConfig, validateHederaConfig } = await import('../config');
      (getHederaConfig as any).mockReturnValue({});
      (validateHederaConfig as any).mockImplementation(() => {
        throw new Error('Invalid configuration');
      });

      expect(() => createHederaService())
        .toThrow('HederaService initialization failed: Invalid configuration');
    });

    it('should throw error when getHederaConfig fails', async () => {
      const { getHederaConfig } = await import('../config');
      (getHederaConfig as any).mockImplementation(() => {
        throw new Error('Missing environment variables');
      });

      expect(() => createHederaService())
        .toThrow('HederaService initialization failed: Missing environment variables');
    });
  });

  describe('getHederaService', () => {
    it('should return singleton instance', async () => {
      const mockConfig = {
        network: 'testnet' as const,
        accountId: '0.0.123456',
        privateKey: 'test-private-key',
        topicId: '0.0.789012',
        mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com',
      };

      const { getHederaConfig, validateHederaConfig } = await import('../config');
      (getHederaConfig as any).mockReturnValue(mockConfig);
      (validateHederaConfig as any).mockImplementation(() => {});

      const service1 = getHederaService();
      const service2 = getHederaService();

      expect(service1).toBe(service2);
    });

    it('should create new instance after close', async () => {
      const mockConfig = {
        network: 'testnet' as const,
        accountId: '0.0.123456',
        privateKey: 'test-private-key',
        topicId: '0.0.789012',
        mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com',
      };

      const { getHederaConfig, validateHederaConfig } = await import('../config');
      (getHederaConfig as any).mockReturnValue(mockConfig);
      (validateHederaConfig as any).mockImplementation(() => {});

      const service1 = getHederaService();
      closeHederaService();
      const service2 = getHederaService();

      expect(service1).not.toBe(service2);
    });
  });

  describe('closeHederaService', () => {
    it('should close and reset singleton instance', async () => {
      const mockConfig = {
        network: 'testnet' as const,
        accountId: '0.0.123456',
        privateKey: 'test-private-key',
        topicId: '0.0.789012',
        mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com',
      };

      const { getHederaConfig, validateHederaConfig } = await import('../config');
      (getHederaConfig as any).mockReturnValue(mockConfig);
      (validateHederaConfig as any).mockImplementation(() => {});

      const service = getHederaService();
      const closeSpy = vi.spyOn(service, 'close');

      closeHederaService();

      expect(closeSpy).toHaveBeenCalled();
    });

    it('should handle closing when no instance exists', () => {
      expect(() => closeHederaService()).not.toThrow();
    });
  });

  describe('createTestHederaService', () => {
    it('should create test service with default parameters', () => {
      const service = createTestHederaService();

      expect(service).toBeDefined();
    });

    it('should create test service with custom parameters', () => {
      const service = createTestHederaService(
        'mainnet',
        '0.0.654321',
        'custom-private-key',
        '0.0.999999'
      );

      expect(service).toBeDefined();
    });
  });
});