import { WalletService } from '../WalletService';
import { NetworkValidator } from '../NetworkValidator';
import { NetworkType, WalletErrorType } from '../../../types/wallet';
import { WalletStorage } from '../../../utils/walletStorage';

// Mock dependencies
jest.mock('../../../utils/walletStorage');
jest.mock('../../../utils/walletErrorHandling');

describe('WalletService - Network Validation', () => {
  let walletService: WalletService;
  let mockProvider: any;

  beforeEach(() => {
    walletService = new WalletService();

    // Mock provider
    mockProvider = {
      id: 'test-provider',
      name: 'Test Provider',
      icon: 'test-icon',
      isAvailable: jest.fn().mockResolvedValue(true),
      connect: jest.fn().mockResolvedValue({
        accountId: '0.0.123456',
        network: 'testnet',
        isConnected: true,
      }),
      disconnect: jest.fn().mockResolvedValue(undefined),
      getAccountInfo: jest.fn().mockResolvedValue({
        accountId: '0.0.123456',
        balance: '100',
        network: 'testnet',
      }),
      getBalance: jest.fn().mockResolvedValue('100'),
    };

    // Mock storage
    (WalletStorage.isStorageAvailable as jest.Mock).mockReturnValue(true);
    (WalletStorage.saveConnection as jest.Mock).mockImplementation(() => {});
    (WalletStorage.savePreferences as jest.Mock).mockImplementation(() => {});
    (WalletStorage.loadPreferences as jest.Mock).mockReturnValue({
      lastUsedProvider: null,
      autoConnect: false,
      connectionTimestamp: Date.now(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getNetworkValidator', () => {
    it('should return network validator instance', () => {
      const validator = walletService.getNetworkValidator();
      expect(validator).toBeInstanceOf(NetworkValidator);
    });
  });

  describe('validateCurrentNetwork', () => {
    it('should return null when no wallet is connected', () => {
      const result = walletService.validateCurrentNetwork();
      expect(result).toBeNull();
    });

    it('should validate network when wallet is connected', async () => {
      // Register and connect provider
      walletService.registerProvider(mockProvider);
      await walletService.connect('test-provider');

      const result = walletService.validateCurrentNetwork();
      expect(result).toBeDefined();
      expect(result?.currentNetwork).toBe('testnet');
      expect(result?.expectedNetwork).toBe('testnet'); // Default expected network
      expect(result?.isValid).toBe(true);
    });

    it('should detect network mismatch', async () => {
      // Set expected network to mainnet
      walletService.setExpectedNetwork('mainnet');

      // Register and connect provider (returns testnet)
      walletService.registerProvider(mockProvider);
      await walletService.connect('test-provider');

      const result = walletService.validateCurrentNetwork();
      expect(result).toBeDefined();
      expect(result?.currentNetwork).toBe('testnet');
      expect(result?.expectedNetwork).toBe('mainnet');
      expect(result?.isValid).toBe(false);
      expect(result?.error?.type).toBe(WalletErrorType.WRONG_NETWORK);
    });
  });

  describe('isCurrentNetworkValid', () => {
    it('should return false when no wallet is connected', () => {
      expect(walletService.isCurrentNetworkValid()).toBe(false);
    });

    it('should return true when network is valid', async () => {
      walletService.registerProvider(mockProvider);
      await walletService.connect('test-provider');

      expect(walletService.isCurrentNetworkValid()).toBe(true);
    });

    it('should return false when network is invalid', async () => {
      walletService.setExpectedNetwork('mainnet');
      walletService.registerProvider(mockProvider);
      await walletService.connect('test-provider');

      expect(walletService.isCurrentNetworkValid()).toBe(false);
    });
  });

  describe('requestNetworkSwitch', () => {
    it('should throw error when no wallet is connected', async () => {
      await expect(
        walletService.requestNetworkSwitch('mainnet')
      ).rejects.toThrow('No wallet connected');
    });

    it('should emit network switch request event', async () => {
      const eventListener = jest.fn();
      walletService.addEventListener('networkSwitchRequested', eventListener);

      walletService.registerProvider(mockProvider);
      await walletService.connect('test-provider');

      try {
        await walletService.requestNetworkSwitch('mainnet');
      } catch (error) {
        // Expected to throw for manual switching
      }

      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          targetNetwork: 'mainnet',
          providerId: 'test-provider',
          isAutomatic: false,
        })
      );
    });

    it('should throw error with switching instructions', async () => {
      walletService.registerProvider(mockProvider);
      await walletService.connect('test-provider');

      await expect(
        walletService.requestNetworkSwitch('mainnet')
      ).rejects.toThrow('Please manually switch your Test Provider wallet');
    });
  });

  describe('handleNetworkChange', () => {
    it('should update connection and emit events', async () => {
      const networkChangeListener = jest.fn();
      walletService.addEventListener('networkChanged', networkChangeListener);

      walletService.registerProvider(mockProvider);
      await walletService.connect('test-provider');

      await walletService.handleNetworkChange('mainnet');

      expect(networkChangeListener).toHaveBeenCalledWith(
        expect.objectContaining({
          oldNetwork: 'testnet',
          newNetwork: 'mainnet',
          validation: expect.any(Object),
        })
      );
    });

    it('should emit error for invalid network', async () => {
      const errorListener = jest.fn();
      walletService.addEventListener('error', errorListener);

      // Set expected network to testnet
      walletService.setExpectedNetwork('testnet');

      walletService.registerProvider(mockProvider);
      await walletService.connect('test-provider');

      // Change to mainnet (invalid)
      await walletService.handleNetworkChange('mainnet');

      expect(errorListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WalletErrorType.WRONG_NETWORK,
        })
      );
    });

    it('should do nothing when no wallet is connected', async () => {
      const networkChangeListener = jest.fn();
      walletService.addEventListener('networkChanged', networkChangeListener);

      await walletService.handleNetworkChange('mainnet');

      expect(networkChangeListener).not.toHaveBeenCalled();
    });
  });

  describe('setExpectedNetwork and getExpectedNetwork', () => {
    it('should set and get expected network', () => {
      walletService.setExpectedNetwork('mainnet');
      expect(walletService.getExpectedNetwork()).toBe('mainnet');
    });

    it('should update network validator config', () => {
      const validator = walletService.getNetworkValidator();
      const configSpy = jest.spyOn(validator, 'updateConfig');

      walletService.setExpectedNetwork('mainnet');

      expect(configSpy).toHaveBeenCalledWith({ expectedNetwork: 'mainnet' });
    });
  });

  describe('setAutoSwitchEnabled and isAutoSwitchEnabled', () => {
    it('should set and get auto switch setting', () => {
      walletService.setAutoSwitchEnabled(true);
      expect(walletService.isAutoSwitchEnabled()).toBe(true);

      walletService.setAutoSwitchEnabled(false);
      expect(walletService.isAutoSwitchEnabled()).toBe(false);
    });

    it('should update network validator config', () => {
      const validator = walletService.getNetworkValidator();
      const configSpy = jest.spyOn(validator, 'updateConfig');

      walletService.setAutoSwitchEnabled(true);

      expect(configSpy).toHaveBeenCalledWith({ allowAutoSwitch: true });
    });
  });

  describe('connect with network validation', () => {
    it('should emit network validation failed event for wrong network', async () => {
      const validationFailedListener = jest.fn();
      walletService.addEventListener(
        'networkValidationFailed',
        validationFailedListener
      );

      // Set expected network to mainnet
      walletService.setExpectedNetwork('mainnet');

      walletService.registerProvider(mockProvider);

      // Should throw due to network mismatch
      await expect(walletService.connect('test-provider')).rejects.toThrow();

      expect(validationFailedListener).toHaveBeenCalledWith(
        expect.objectContaining({
          validation: expect.objectContaining({
            isValid: false,
            currentNetwork: 'testnet',
            expectedNetwork: 'mainnet',
          }),
          providerId: 'test-provider',
        })
      );
    });

    it('should complete connection for valid network', async () => {
      const connectListener = jest.fn();
      walletService.addEventListener('connect', connectListener);

      walletService.registerProvider(mockProvider);
      const connection = await walletService.connect('test-provider');

      expect(connection.network).toBe('testnet');
      expect(connectListener).toHaveBeenCalledWith(connection);
    });
  });

  describe('network validator event forwarding', () => {
    it('should forward networkValidated events', () => {
      const listener = jest.fn();
      walletService.addEventListener('networkValidated', listener);

      const validator = walletService.getNetworkValidator();
      const mockResult = {
        isValid: true,
        currentNetwork: 'testnet' as NetworkType,
        expectedNetwork: 'testnet' as NetworkType,
        canSwitch: false,
      };

      // Trigger network validation
      (validator as any).emit('networkValidated', mockResult);

      expect(listener).toHaveBeenCalledWith(mockResult);
    });
  });
});
