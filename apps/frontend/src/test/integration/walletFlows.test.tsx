import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { walletSlice } from '../../store/slices/walletSlice';
import { WalletService } from '../../services/wallet/WalletService';
import { WalletStorage } from '../../utils/walletStorage';
import {
  WalletConnection,
  AccountInfo,
  WalletErrorType,
  NetworkType,
} from '../../types/wallet';

// Mock dependencies
vi.mock('../../utils/walletStorage');
vi.mock('../../utils/walletErrorHandling', () => ({
  WalletErrorHandler: {
    handleProviderError: vi.fn(error => error),
    handleConnectionError: vi.fn(error => error),
    handleAccountError: vi.fn(error => error),
  },
  createWalletRetryHandler: vi.fn(() => (fn: () => Promise<any>) => fn()),
  createWalletError: vi.fn((type, message, details) => ({
    type,
    message,
    details,
  })),
  isWalletError: vi.fn(
    error => error && typeof error === 'object' && 'type' in error
  ),
}));

describe('Wallet Integration Tests - Complete Connection Workflow', () => {
  let store: ReturnType<typeof configureStore>;
  let walletService: WalletService;
  let mockHashPackAdapter: any;
  let mockBladeAdapter: any;

  const mockConnection: WalletConnection = {
    accountId: '0.0.123456',
    network: 'testnet',
    isConnected: true,
  };

  const mockAccountInfo: AccountInfo = {
    accountId: '0.0.123456',
    balance: '100.5',
    network: 'testnet',
  };

  beforeEach(() => {
    // Setup store
    store = configureStore({
      reducer: {
        wallet: walletSlice.reducer,
      },
      preloadedState: {
        wallet: {
          isConnected: false,
          currentProvider: null,
          accountInfo: null,
          connectionStatus: 'idle',
          error: null,
          availableProviders: [],
          preferences: {
            lastUsedProvider: null,
            autoConnect: false,
            connectionTimestamp: 0,
          },
        },
      },
    });

    // Setup wallet service
    walletService = new WalletService();

    // Setup mock adapters
    mockHashPackAdapter = {
      id: 'hashpack',
      name: 'HashPack',
      icon: '/icons/hashpack.svg',
      isAvailable: vi.fn().mockResolvedValue(true),
      connect: vi.fn().mockResolvedValue(mockConnection),
      disconnect: vi.fn().mockResolvedValue(undefined),
      getAccountInfo: vi.fn().mockResolvedValue(mockAccountInfo),
      getBalance: vi.fn().mockResolvedValue('100.5'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    mockBladeAdapter = {
      id: 'blade',
      name: 'Blade',
      icon: '/icons/blade.svg',
      isAvailable: vi.fn().mockResolvedValue(true),
      connect: vi.fn().mockResolvedValue({
        ...mockConnection,
        accountId: '0.0.789012',
      }),
      disconnect: vi.fn().mockResolvedValue(undefined),
      getAccountInfo: vi.fn().mockResolvedValue({
        ...mockAccountInfo,
        accountId: '0.0.789012',
        balance: '200.0',
      }),
      getBalance: vi.fn().mockResolvedValue('200.0'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    // Mock storage
    (WalletStorage.isStorageAvailable as any).mockReturnValue(true);
    (WalletStorage.loadPreferences as any).mockReturnValue({
      lastUsedProvider: null,
      autoConnect: false,
      connectionTimestamp: 0,
    });
    (WalletStorage.loadConnection as any).mockReturnValue(null);
    (WalletStorage.loadAccountInfo as any).mockReturnValue(null);
    (WalletStorage.savePreferences as any).mockImplementation(() => {});
    (WalletStorage.saveConnection as any).mockImplementation(() => {});
    (WalletStorage.saveAccountInfo as any).mockImplementation(() => {});

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Requirements 1.1-1.5 - Complete Connection Workflow', () => {
    it('should complete full wallet connection flow from start to finish', async () => {
      // Register providers
      walletService.registerProvider(mockHashPackAdapter);
      walletService.registerProvider(mockBladeAdapter);

      // Step 1: Check available providers (Requirement 1.2)
      const availableProviders = await walletService.getAvailableProviders();
      expect(availableProviders).toHaveLength(2);
      expect(availableProviders.map(p => p.id)).toEqual(['hashpack', 'blade']);

      // Step 2: Initiate connection process (Requirement 1.3)
      const connection = await walletService.connect('hashpack');

      // Step 3: Verify connection success (Requirement 1.4)
      expect(mockHashPackAdapter.connect).toHaveBeenCalled();
      expect(connection.accountId).toBe('0.0.123456');
      expect(connection.isConnected).toBe(true);

      // Step 4: Verify connection was saved to storage
      expect(WalletStorage.saveConnection).toHaveBeenCalledWith(
        mockConnection,
        'hashpack'
      );
      expect(WalletStorage.saveAccountInfo).toHaveBeenCalledWith(
        mockAccountInfo
      );

      // Step 5: Verify Redux state is updated
      store.dispatch(
        walletSlice.actions.connectWalletSuccess({
          connection: mockConnection,
          accountInfo: mockAccountInfo,
          provider: 'hashpack',
        })
      );

      const state = store.getState();
      expect(state.wallet.isConnected).toBe(true);
      expect(state.wallet.currentProvider).toBe('hashpack');
      expect(state.wallet.accountInfo).toEqual(mockAccountInfo);
    });

    it('should handle connection failure gracefully (Requirement 1.5)', async () => {
      const connectionError = new Error('User rejected connection');
      mockHashPackAdapter.connect.mockRejectedValue(connectionError);

      walletService.registerProvider(mockHashPackAdapter);

      // Try to connect and expect failure
      await expect(walletService.connect('hashpack')).rejects.toThrow(
        'User rejected connection'
      );

      // Verify error handling
      expect(mockHashPackAdapter.connect).toHaveBeenCalled();
      expect(WalletStorage.saveConnection).not.toHaveBeenCalled();
    });
  });

  describe('Requirements 3.1-3.4 - Disconnection Functionality', () => {
    it('should handle wallet disconnection completely', async () => {
      // Setup connected state
      walletService.registerProvider(mockHashPackAdapter);
      await walletService.connect('hashpack');

      // Disconnect (Requirement 3.1, 3.2)
      await walletService.disconnect();

      // Verify disconnection (Requirement 3.2)
      expect(mockHashPackAdapter.disconnect).toHaveBeenCalled();

      // Verify storage cleanup (Requirement 3.4)
      expect(WalletStorage.clearConnection).toHaveBeenCalled();
      expect(WalletStorage.clearAccountInfo).toHaveBeenCalled();

      // Verify Redux state is cleared (Requirement 3.3)
      store.dispatch(walletSlice.actions.disconnectWallet());
      const state = store.getState();
      expect(state.wallet.isConnected).toBe(false);
      expect(state.wallet.currentProvider).toBeNull();
      expect(state.wallet.accountInfo).toBeNull();
    });
  });

  describe('Requirements 5.1-5.5 - Session Persistence and Restoration', () => {
    it('should restore connection on application startup', async () => {
      // Mock stored connection (Requirement 5.1)
      (WalletStorage.loadConnection as any).mockReturnValue({
        connection: mockConnection,
        providerId: 'hashpack',
      });
      (WalletStorage.loadAccountInfo as any).mockReturnValue(mockAccountInfo);
      (WalletStorage.loadPreferences as any).mockReturnValue({
        lastUsedProvider: 'hashpack',
        autoConnect: true,
        connectionTimestamp: Date.now(),
      });

      walletService.registerProvider(mockHashPackAdapter);

      // Attempt restoration (Requirement 5.2)
      const restored = await walletService.restoreConnection();

      // Verify restoration success
      expect(WalletStorage.loadConnection).toHaveBeenCalled();
      expect(restored).toBe(true);
    });

    it('should handle invalid stored connection gracefully (Requirement 5.3)', async () => {
      // Mock invalid stored connection
      (WalletStorage.loadConnection as any).mockReturnValue({
        connection: { ...mockConnection, isConnected: false },
        providerId: 'hashpack',
      });

      // Make provider connection fail
      mockHashPackAdapter.connect.mockRejectedValue(
        new Error('Connection invalid')
      );

      walletService.registerProvider(mockHashPackAdapter);

      // Attempt restoration should fail gracefully
      const restored = await walletService.restoreConnection();

      // Should fallback to disconnected state (Requirement 5.3)
      expect(restored).toBe(false);
      expect(WalletStorage.clearConnection).toHaveBeenCalled();
    });

    it('should handle cleared browser data scenario (Requirement 5.4)', async () => {
      // Mock no stored data
      (WalletStorage.loadConnection as any).mockReturnValue(null);
      (WalletStorage.loadPreferences as any).mockReturnValue({
        lastUsedProvider: null,
        autoConnect: false,
        connectionTimestamp: 0,
      });

      // Attempt restoration
      const restored = await walletService.restoreConnection();

      // Should require fresh connection (Requirement 5.4)
      expect(restored).toBe(false);
      expect(mockHashPackAdapter.connect).not.toHaveBeenCalled();
    });

    it('should log errors and show connect interface on restoration failure (Requirement 5.5)', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Mock storage error
      (WalletStorage.loadConnection as any).mockImplementation(() => {
        throw new Error('Storage error');
      });

      // Attempt restoration should handle error gracefully
      const restored = await walletService.restoreConnection();

      expect(restored).toBe(false);
      consoleSpy.mockRestore();
    });
  });
});

describe('Wallet Integration Tests - Provider Switching and Multi-Wallet Scenarios', () => {
  let walletService: WalletService;
  let mockHashPackAdapter: any;
  let mockBladeAdapter: any;

  beforeEach(() => {
    walletService = new WalletService();

    mockHashPackAdapter = {
      id: 'hashpack',
      name: 'HashPack',
      icon: '/icons/hashpack.svg',
      isAvailable: vi.fn().mockResolvedValue(true),
      connect: vi.fn().mockResolvedValue({
        accountId: '0.0.123456',
        network: 'testnet',
        isConnected: true,
      }),
      disconnect: vi.fn().mockResolvedValue(undefined),
      getAccountInfo: vi.fn().mockResolvedValue({
        accountId: '0.0.123456',
        balance: '100.5',
        network: 'testnet',
      }),
      getBalance: vi.fn().mockResolvedValue('100.5'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    mockBladeAdapter = {
      id: 'blade',
      name: 'Blade',
      icon: '/icons/blade.svg',
      isAvailable: vi.fn().mockResolvedValue(true),
      connect: vi.fn().mockResolvedValue({
        accountId: '0.0.789012',
        network: 'testnet',
        isConnected: true,
      }),
      disconnect: vi.fn().mockResolvedValue(undefined),
      getAccountInfo: vi.fn().mockResolvedValue({
        accountId: '0.0.789012',
        balance: '200.0',
        network: 'testnet',
      }),
      getBalance: vi.fn().mockResolvedValue('200.0'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    vi.clearAllMocks();
  });

  describe('Requirements 6.3, 6.4, 6.5 - Multi-Provider Architecture', () => {
    it('should provide extensible architecture for adding new wallet providers (Requirement 6.3)', () => {
      // Register providers
      walletService.registerProvider(mockHashPackAdapter);
      walletService.registerProvider(mockBladeAdapter);

      // Verify providers are registered
      expect(walletService.getProviderCount()).toBe(2);
      expect(walletService.isProviderRegistered('hashpack')).toBe(true);
      expect(walletService.isProviderRegistered('blade')).toBe(true);

      // Verify providers can be retrieved
      const providers = walletService.getProviders();
      expect(providers).toHaveLength(2);
      expect(providers.map(p => p.id)).toEqual(['hashpack', 'blade']);
    });

    it('should automatically include new providers in wallet selection interface (Requirement 6.4)', async () => {
      // Register providers
      walletService.registerProvider(mockHashPackAdapter);
      walletService.registerProvider(mockBladeAdapter);

      // Get available providers (simulates what the UI would do)
      const availableProviders = await walletService.getAvailableProviders();

      // Both providers should be available for selection
      expect(availableProviders).toHaveLength(2);
      expect(availableProviders.map(p => p.id)).toEqual(['hashpack', 'blade']);
    });

    it('should hide unavailable providers from selection interface (Requirement 6.5)', async () => {
      // Make blade unavailable
      mockBladeAdapter.isAvailable = vi.fn().mockResolvedValue(false);

      // Register providers
      walletService.registerProvider(mockHashPackAdapter);
      walletService.registerProvider(mockBladeAdapter);

      // Get available providers
      const availableProviders = await walletService.getAvailableProviders();

      // Only HashPack should be available
      expect(availableProviders).toHaveLength(1);
      expect(availableProviders[0].id).toBe('hashpack');

      // Verify availability status
      const availabilityStatus =
        await walletService.getProviderAvailabilityStatus();
      expect(availabilityStatus.get('hashpack')).toBe(true);
      expect(availabilityStatus.get('blade')).toBe(false);
    });

    it('should support provider switching functionality', async () => {
      // Register providers
      walletService.registerProvider(mockHashPackAdapter);
      walletService.registerProvider(mockBladeAdapter);

      // Connect to HashPack first
      const hashPackConnection = await walletService.connect('hashpack');
      expect(hashPackConnection.accountId).toBe('0.0.123456');
      expect(walletService.getCurrentProvider()?.id).toBe('hashpack');

      // Switch to Blade
      const bladeConnection = await walletService.switchProvider('blade');
      expect(bladeConnection.accountId).toBe('0.0.789012');
      expect(walletService.getCurrentProvider()?.id).toBe('blade');

      // Verify HashPack was disconnected
      expect(mockHashPackAdapter.disconnect).toHaveBeenCalled();
    });
  });
});

describe('Wallet Integration Tests - Error Recovery and Retry Mechanisms', () => {
  let walletService: WalletService;
  let mockHashPackAdapter: any;

  beforeEach(() => {
    walletService = new WalletService();

    mockHashPackAdapter = {
      id: 'hashpack',
      name: 'HashPack',
      icon: '/icons/hashpack.svg',
      isAvailable: vi.fn().mockResolvedValue(true),
      connect: vi.fn(),
      disconnect: vi.fn().mockResolvedValue(undefined),
      getAccountInfo: vi.fn(),
      getBalance: vi.fn().mockResolvedValue('100.5'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    vi.clearAllMocks();
  });

  describe('Error Recovery Scenarios', () => {
    it('should handle wallet locked error with retry mechanism', async () => {
      // First attempt fails with wallet locked
      mockHashPackAdapter.connect
        .mockRejectedValueOnce({
          type: WalletErrorType.WALLET_LOCKED,
          message: 'Wallet is locked',
        })
        .mockResolvedValueOnce({
          accountId: '0.0.123456',
          network: 'testnet',
          isConnected: true,
        });

      walletService.registerProvider(mockHashPackAdapter);

      // First attempt should fail
      await expect(walletService.connect('hashpack')).rejects.toMatchObject({
        type: WalletErrorType.WALLET_LOCKED,
      });

      // Retry should succeed
      const connection = await walletService.connect('hashpack');
      expect(connection.accountId).toBe('0.0.123456');
      expect(mockHashPackAdapter.connect).toHaveBeenCalledTimes(2);
    });

    it('should handle network connectivity errors with automatic retry', async () => {
      let attemptCount = 0;
      mockHashPackAdapter.connect.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.reject({
            type: WalletErrorType.NETWORK_ERROR,
            message: 'Network error',
          });
        }
        return Promise.resolve({
          accountId: '0.0.123456',
          network: 'testnet',
          isConnected: true,
        });
      });

      walletService.registerProvider(mockHashPackAdapter);

      // Should eventually succeed after retries
      const connection = await walletService.connectWithRetry('hashpack', 3);
      expect(connection.accountId).toBe('0.0.123456');
      expect(mockHashPackAdapter.connect).toHaveBeenCalledTimes(3);
    });

    it('should handle connection rejection with clear messaging', async () => {
      mockHashPackAdapter.connect.mockRejectedValue({
        type: WalletErrorType.CONNECTION_REJECTED,
        message: 'User rejected connection',
      });

      walletService.registerProvider(mockHashPackAdapter);

      // Should throw with clear error
      await expect(walletService.connect('hashpack')).rejects.toMatchObject({
        type: WalletErrorType.CONNECTION_REJECTED,
        message: 'User rejected connection',
      });
    });
  });

  describe('Graceful Error State Management', () => {
    it('should clear error state on successful operations', async () => {
      // First attempt fails
      mockHashPackAdapter.connect
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValueOnce({
          accountId: '0.0.123456',
          network: 'testnet',
          isConnected: true,
        });

      walletService.registerProvider(mockHashPackAdapter);

      // First attempt should fail
      await expect(walletService.connect('hashpack')).rejects.toThrow(
        'Connection failed'
      );

      // Retry should succeed and clear error state
      const connection = await walletService.connect('hashpack');
      expect(connection.accountId).toBe('0.0.123456');
      expect(walletService.getLastError()).toBeNull();
    });

    it('should provide fallback to disconnected state on unrecoverable errors', async () => {
      mockHashPackAdapter.connect.mockRejectedValue({
        type: WalletErrorType.UNKNOWN_ERROR,
        message: 'Unrecoverable error',
      });

      walletService.registerProvider(mockHashPackAdapter);

      // Should fail with unrecoverable error
      await expect(walletService.connect('hashpack')).rejects.toMatchObject({
        type: WalletErrorType.UNKNOWN_ERROR,
      });

      // Service should remain in disconnected state
      expect(walletService.getCurrentProvider()).toBeNull();
      expect(walletService.isConnected()).toBe(false);
    });
  });
});

describe('Wallet Integration Tests - Session Persistence and Restoration Flows', () => {
  let walletService: WalletService;
  let mockHashPackAdapter: any;

  const mockConnection: WalletConnection = {
    accountId: '0.0.123456',
    network: 'testnet',
    isConnected: true,
  };

  const mockAccountInfo: AccountInfo = {
    accountId: '0.0.123456',
    balance: '100.5',
    network: 'testnet',
  };

  beforeEach(() => {
    walletService = new WalletService();

    mockHashPackAdapter = {
      id: 'hashpack',
      name: 'HashPack',
      icon: '/icons/hashpack.svg',
      isAvailable: vi.fn().mockResolvedValue(true),
      connect: vi.fn().mockResolvedValue(mockConnection),
      disconnect: vi.fn().mockResolvedValue(undefined),
      getAccountInfo: vi.fn().mockResolvedValue(mockAccountInfo),
      getBalance: vi.fn().mockResolvedValue('100.5'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    vi.clearAllMocks();
  });

  describe('Session Persistence Scenarios', () => {
    it('should persist wallet connection across browser sessions', async () => {
      walletService.registerProvider(mockHashPackAdapter);

      // Initial connection
      await walletService.connect('hashpack');

      // Verify persistence calls
      expect(WalletStorage.saveConnection).toHaveBeenCalledWith(
        mockConnection,
        'hashpack'
      );
      expect(WalletStorage.savePreferences).toHaveBeenCalledWith(
        expect.objectContaining({
          lastUsedProvider: 'hashpack',
          autoConnect: true,
        })
      );
    });

    it('should restore connection with auto-connect enabled', async () => {
      // Mock stored connection and preferences
      (WalletStorage.loadConnection as any).mockReturnValue({
        connection: mockConnection,
        providerId: 'hashpack',
      });
      (WalletStorage.loadAccountInfo as any).mockReturnValue(mockAccountInfo);
      (WalletStorage.loadPreferences as any).mockReturnValue({
        lastUsedProvider: 'hashpack',
        autoConnect: true,
        connectionTimestamp: Date.now(),
      });

      walletService.registerProvider(mockHashPackAdapter);

      // Should automatically restore connection
      const restored = await walletService.restoreConnection();
      expect(restored).toBe(true);
      expect(WalletStorage.loadConnection).toHaveBeenCalled();
    });

    it('should handle expired connection data gracefully', async () => {
      // Mock expired connection (older than 24 hours)
      const expiredTimestamp = Date.now() - 25 * 60 * 60 * 1000;
      (WalletStorage.loadConnection as any).mockReturnValue({
        connection: { ...mockConnection, timestamp: expiredTimestamp },
        providerId: 'hashpack',
      });

      // Should clear expired connection and return false
      const restored = await walletService.restoreConnection();
      expect(restored).toBe(false);
    });

    it('should handle corrupted storage data', async () => {
      // Mock corrupted storage data
      (WalletStorage.loadConnection as any).mockImplementation(() => {
        throw new Error('Corrupted storage data');
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Should handle error gracefully
      const restored = await walletService.restoreConnection();
      expect(restored).toBe(false);

      consoleSpy.mockRestore();
    });
  });

  describe('Storage Management and Cleanup', () => {
    it('should clean up storage on explicit disconnect', async () => {
      walletService.registerProvider(mockHashPackAdapter);
      await walletService.connect('hashpack');

      // Disconnect
      await walletService.disconnect();

      expect(WalletStorage.clearConnection).toHaveBeenCalled();
      expect(WalletStorage.clearAccountInfo).toHaveBeenCalled();
    });

    it('should handle storage quota exceeded gracefully', async () => {
      // Mock storage quota exceeded
      (WalletStorage.saveConnection as any).mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      walletService.registerProvider(mockHashPackAdapter);

      // Connection should still work even if storage fails
      const connection = await walletService.connect('hashpack');
      expect(connection.accountId).toBe('0.0.123456');

      consoleSpy.mockRestore();
    });
  });
});

describe('Wallet Integration Tests - Network Validation and Switching', () => {
  let walletService: WalletService;
  let mockHashPackAdapter: any;

  beforeEach(() => {
    walletService = new WalletService();

    mockHashPackAdapter = {
      id: 'hashpack',
      name: 'HashPack',
      icon: '/icons/hashpack.svg',
      isAvailable: vi.fn().mockResolvedValue(true),
      connect: vi.fn(),
      disconnect: vi.fn().mockResolvedValue(undefined),
      getAccountInfo: vi.fn(),
      getBalance: vi.fn().mockResolvedValue('100.5'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    vi.clearAllMocks();
  });

  describe('Network Validation Scenarios', () => {
    it('should validate network on connection', async () => {
      // Set expected network to testnet
      walletService.setExpectedNetwork('testnet');

      // Mock connection with correct network
      mockHashPackAdapter.connect.mockResolvedValue({
        accountId: '0.0.123456',
        network: 'testnet',
        isConnected: true,
      });

      walletService.registerProvider(mockHashPackAdapter);

      // Should connect successfully with correct network
      const connection = await walletService.connect('hashpack');
      expect(connection.accountId).toBe('0.0.123456');
      expect(connection.network).toBe('testnet');
    });

    it('should reject connection with wrong network', async () => {
      // Set expected network to testnet
      walletService.setExpectedNetwork('testnet');

      // Mock connection with wrong network
      mockHashPackAdapter.connect.mockResolvedValue({
        accountId: '0.0.123456',
        network: 'mainnet', // Wrong network
        isConnected: true,
      });

      walletService.registerProvider(mockHashPackAdapter);

      // Should reject connection due to network mismatch
      await expect(walletService.connect('hashpack')).rejects.toMatchObject({
        type: WalletErrorType.WRONG_NETWORK,
      });
    });

    it('should handle network changes during active session', async () => {
      // Setup connected state with testnet
      walletService.setExpectedNetwork('testnet');
      walletService.registerProvider(mockHashPackAdapter);

      mockHashPackAdapter.connect.mockResolvedValue({
        accountId: '0.0.123456',
        network: 'testnet',
        isConnected: true,
      });

      await walletService.connect('hashpack');

      // Simulate network change to mainnet
      const networkValidation = walletService.validateCurrentNetwork();
      expect(networkValidation?.isValid).toBe(true);

      // Change expected network
      walletService.setExpectedNetwork('mainnet');
      const newValidation = walletService.validateCurrentNetwork();
      expect(newValidation?.isValid).toBe(false);
    });
  });

  describe('Network Switching Guidance', () => {
    it('should provide network switching instructions', async () => {
      walletService.setExpectedNetwork('testnet');
      walletService.registerProvider(mockHashPackAdapter);

      // Mock connection with wrong network
      mockHashPackAdapter.connect.mockResolvedValue({
        accountId: '0.0.123456',
        network: 'mainnet',
        isConnected: true,
      });

      // Should fail with network switching guidance
      await expect(walletService.connect('hashpack')).rejects.toMatchObject({
        type: WalletErrorType.WRONG_NETWORK,
      });
    });

    it('should retry connection after network switch', async () => {
      walletService.setExpectedNetwork('testnet');
      walletService.registerProvider(mockHashPackAdapter);

      // First attempt: wrong network, second attempt: correct network
      mockHashPackAdapter.connect
        .mockResolvedValueOnce({
          accountId: '0.0.123456',
          network: 'mainnet',
          isConnected: true,
        })
        .mockResolvedValueOnce({
          accountId: '0.0.123456',
          network: 'testnet',
          isConnected: true,
        });

      // First attempt should fail
      await expect(walletService.connect('hashpack')).rejects.toMatchObject({
        type: WalletErrorType.WRONG_NETWORK,
      });

      // Second attempt should succeed
      const connection = await walletService.connect('hashpack');
      expect(connection.network).toBe('testnet');
    });
  });

  describe('Dynamic Network Configuration', () => {
    it('should update expected network dynamically', () => {
      walletService.registerProvider(mockHashPackAdapter);

      // Initially set to testnet
      walletService.setExpectedNetwork('testnet');
      expect(walletService.getExpectedNetwork()).toBe('testnet');

      // Change expected network to mainnet
      walletService.setExpectedNetwork('mainnet');
      expect(walletService.getExpectedNetwork()).toBe('mainnet');
    });

    it('should handle auto-switch when enabled', async () => {
      walletService.setExpectedNetwork('testnet');
      walletService.setAutoSwitchEnabled(true);
      walletService.registerProvider(mockHashPackAdapter);

      // Mock successful network switch
      mockHashPackAdapter.connect
        .mockResolvedValueOnce({
          accountId: '0.0.123456',
          network: 'mainnet',
          isConnected: true,
        })
        .mockResolvedValueOnce({
          accountId: '0.0.123456',
          network: 'testnet',
          isConnected: true,
        });

      // Should automatically attempt network switch and succeed
      const connection = await walletService.connectWithAutoSwitch('hashpack');
      expect(connection.network).toBe('testnet');
    });
  });
});
