import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WalletService } from '../WalletService';
import { BaseWalletAdapter } from '../BaseWalletAdapter';
import {
  WalletConnection,
  AccountInfo,
  WalletErrorType,
} from '../../../types/wallet';
import { localStorageMock } from './setup';
import { WalletStorage } from '../../../utils/walletStorage';

// Mock WalletStorage
vi.mock('../../../utils/walletStorage', () => ({
  WalletStorage: {
    isStorageAvailable: vi.fn(() => true),
    savePreferences: vi.fn(),
    loadPreferences: vi.fn(() => ({
      lastUsedProvider: null,
      autoConnect: false,
      connectionTimestamp: 0,
    })),
    clearPreferences: vi.fn(),
    saveConnection: vi.fn(),
    loadConnection: vi.fn(() => null),
    clearConnection: vi.fn(),
    saveAccountInfo: vi.fn(),
    loadAccountInfo: vi.fn(() => null),
    clearAccountInfo: vi.fn(),
    clearAll: vi.fn(),
  },
}));

// Mock wallet adapter for testing
class MockWalletAdapter extends BaseWalletAdapter {
  public readonly id: string;
  public readonly name: string;
  public readonly icon = 'mock-icon.svg';

  private mockAvailable = true;
  private mockConnection: WalletConnection;

  constructor(id: string, name: string) {
    super();
    this.id = id;
    this.name = name;
    this.mockConnection = {
      accountId: `0.0.${id}`,
      network: 'testnet',
      isConnected: true,
    };
  }

  async isAvailable(): Promise<boolean> {
    return this.mockAvailable;
  }

  async connect(): Promise<WalletConnection> {
    this.connection = this.mockConnection;
    return this.connection;
  }

  async disconnect(): Promise<void> {
    this.connection = null;
  }

  async getAccountInfo(): Promise<AccountInfo> {
    if (!this.connection) {
      throw new Error('Not connected');
    }
    return {
      accountId: this.connection.accountId,
      balance: '1000.00 HBAR',
      network: this.connection.network,
    };
  }

  async getBalance(): Promise<string> {
    if (!this.connection) {
      throw new Error('Not connected');
    }
    return '1000.00 HBAR';
  }

  setAvailable(available: boolean) {
    this.mockAvailable = available;
  }
}

describe('WalletService', () => {
  let walletService: WalletService;
  let mockProvider1: MockWalletAdapter;
  let mockProvider2: MockWalletAdapter;

  beforeEach(() => {
    walletService = new WalletService();
    mockProvider1 = new MockWalletAdapter('hashpack', 'HashPack');
    mockProvider2 = new MockWalletAdapter('blade', 'Blade');

    // Clear localStorage mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Provider Registration', () => {
    it('should register providers', () => {
      walletService.registerProvider(mockProvider1);
      walletService.registerProvider(mockProvider2);

      const providers = walletService.getProviders();
      expect(providers).toHaveLength(2);
      expect(providers.map(p => p.id)).toContain('hashpack');
      expect(providers.map(p => p.id)).toContain('blade');
    });

    it('should unregister providers', () => {
      walletService.registerProvider(mockProvider1);
      walletService.registerProvider(mockProvider2);

      walletService.unregisterProvider('hashpack');
      const providers = walletService.getProviders();

      expect(providers).toHaveLength(1);
      expect(providers[0].id).toBe('blade');
    });

    it('should get provider by ID', () => {
      walletService.registerProvider(mockProvider1);

      const provider = walletService.getProvider('hashpack');
      expect(provider).toBe(mockProvider1);

      const nonExistent = walletService.getProvider('nonexistent');
      expect(nonExistent).toBeNull();
    });
  });

  describe('Available Providers', () => {
    it('should return only available providers', async () => {
      mockProvider1.setAvailable(true);
      mockProvider2.setAvailable(false);

      walletService.registerProvider(mockProvider1);
      walletService.registerProvider(mockProvider2);

      const availableProviders = await walletService.getAvailableProviders();

      expect(availableProviders).toHaveLength(1);
      expect(availableProviders[0].id).toBe('hashpack');
    });

    it('should handle provider availability check errors', async () => {
      const errorProvider = new MockWalletAdapter('error', 'Error Provider');
      errorProvider.isAvailable = vi
        .fn()
        .mockRejectedValue(new Error('Check failed'));

      walletService.registerProvider(errorProvider);
      walletService.registerProvider(mockProvider1);

      const availableProviders = await walletService.getAvailableProviders();

      expect(availableProviders).toHaveLength(1);
      expect(availableProviders[0].id).toBe('hashpack');
    });
  });

  describe('Connection Management', () => {
    beforeEach(() => {
      walletService.registerProvider(mockProvider1);
      walletService.registerProvider(mockProvider2);
    });

    it('should connect to a provider', async () => {
      const connection = await walletService.connect('hashpack');

      expect(connection.accountId).toBe('0.0.hashpack');
      expect(connection.isConnected).toBe(true);
      expect(walletService.isConnected()).toBe(true);
      expect(walletService.getCurrentProvider()).toBe(mockProvider1);
    });

    it('should throw error for non-existent provider', async () => {
      await expect(walletService.connect('nonexistent')).rejects.toMatchObject({
        type: WalletErrorType.PROVIDER_NOT_FOUND,
        message: 'Provider nonexistent not found',
      });
    });

    it('should throw error for unavailable provider', async () => {
      mockProvider1.setAvailable(false);

      await expect(walletService.connect('hashpack')).rejects.toMatchObject({
        type: WalletErrorType.PROVIDER_NOT_FOUND,
        message: 'HashPack is not installed or available',
      });
    });

    it('should disconnect current provider when connecting to different one', async () => {
      const disconnectSpy = vi.spyOn(mockProvider1, 'disconnect');

      await walletService.connect('hashpack');
      await walletService.connect('blade');

      expect(disconnectSpy).toHaveBeenCalled();
      expect(walletService.getCurrentProvider()).toBe(mockProvider2);
    });

    it('should disconnect successfully', async () => {
      await walletService.connect('hashpack');
      expect(walletService.isConnected()).toBe(true);

      await walletService.disconnect();

      expect(walletService.isConnected()).toBe(false);
      expect(walletService.getCurrentProvider()).toBeNull();
    });

    it('should handle disconnect when no provider connected', async () => {
      await expect(walletService.disconnect()).resolves.toBeUndefined();
    });

    it('should perform complete session cleanup on disconnect', async () => {
      const disconnectSpy = vi.fn();
      walletService.addEventListener('disconnect', disconnectSpy);

      // Connect first
      await walletService.connect('hashpack');
      expect(walletService.isConnected()).toBe(true);
      expect(walletService.getCurrentProvider()).toBe(mockProvider1);

      // Verify connection preference was saved
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'wallet-preferences',
        expect.stringContaining('"lastUsedProvider":"hashpack"')
      );

      // Disconnect
      await walletService.disconnect();

      // Verify complete cleanup
      expect(walletService.isConnected()).toBe(false);
      expect(walletService.getCurrentProvider()).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(
        'wallet-preferences'
      );
      expect(disconnectSpy).toHaveBeenCalled();
    });
  });

  describe('Account Operations', () => {
    beforeEach(async () => {
      walletService.registerProvider(mockProvider1);
      await walletService.connect('hashpack');
    });

    it('should get account info', async () => {
      const accountInfo = await walletService.getAccountInfo();

      expect(accountInfo.accountId).toBe('0.0.hashpack');
      expect(accountInfo.balance).toBe('1000.00 HBAR');
      expect(accountInfo.network).toBe('testnet');
    });

    it('should get balance', async () => {
      const balance = await walletService.getBalance();
      expect(balance).toBe('1000.00 HBAR');
    });

    it('should throw error when getting account info without connection', async () => {
      await walletService.disconnect();

      await expect(walletService.getAccountInfo()).rejects.toMatchObject({
        type: WalletErrorType.UNKNOWN_ERROR,
        message: 'No wallet connected',
      });
    });

    it('should throw error when getting balance without connection', async () => {
      await walletService.disconnect();

      await expect(walletService.getBalance()).rejects.toMatchObject({
        type: WalletErrorType.UNKNOWN_ERROR,
        message: 'No wallet connected',
      });
    });
  });

  describe('Connection Persistence', () => {
    beforeEach(() => {
      walletService.registerProvider(mockProvider1);
      vi.clearAllMocks();
    });

    it('should save connection data on connect', async () => {
      await walletService.connect('hashpack');

      expect(WalletStorage.saveConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: '0.0.hashpack',
          network: 'testnet',
          isConnected: true,
        }),
        'hashpack'
      );

      expect(WalletStorage.savePreferences).toHaveBeenCalledWith(
        expect.objectContaining({
          lastUsedProvider: 'hashpack',
          autoConnect: true,
        })
      );
    });

    it('should clear all connection data on disconnect', async () => {
      await walletService.connect('hashpack');
      await walletService.disconnect();

      expect(WalletStorage.clearAll).toHaveBeenCalled();
    });

    it('should restore connection when storage is available and preferences allow', async () => {
      const mockConnection = {
        accountId: '0.0.hashpack',
        network: 'testnet' as const,
        isConnected: true,
      };

      vi.mocked(WalletStorage.loadConnection).mockReturnValue({
        connection: mockConnection,
        providerId: 'hashpack',
      });

      vi.mocked(WalletStorage.loadPreferences).mockReturnValue({
        lastUsedProvider: 'hashpack',
        autoConnect: true,
        connectionTimestamp: Date.now(),
      });

      const connection = await walletService.restoreConnection();

      expect(connection).toBeTruthy();
      expect(connection?.accountId).toBe('0.0.hashpack');
      expect(walletService.getCurrentProvider()).toBe(mockProvider1);
    });

    it('should return null when storage is not available', async () => {
      vi.mocked(WalletStorage.isStorageAvailable).mockReturnValue(false);

      const connection = await walletService.restoreConnection();
      expect(connection).toBeNull();
    });

    it('should return null when no stored connection exists', async () => {
      vi.mocked(WalletStorage.loadConnection).mockReturnValue(null);

      const connection = await walletService.restoreConnection();
      expect(connection).toBeNull();
    });

    it('should return null when autoConnect is disabled', async () => {
      vi.mocked(WalletStorage.loadConnection).mockReturnValue({
        connection: {
          accountId: '0.0.hashpack',
          network: 'testnet',
          isConnected: true,
        },
        providerId: 'hashpack',
      });

      vi.mocked(WalletStorage.loadPreferences).mockReturnValue({
        lastUsedProvider: 'hashpack',
        autoConnect: false,
        connectionTimestamp: Date.now(),
      });

      const connection = await walletService.restoreConnection();
      expect(connection).toBeNull();
    });

    it('should clear data when provider is no longer available', async () => {
      vi.mocked(WalletStorage.loadConnection).mockReturnValue({
        connection: {
          accountId: '0.0.nonexistent',
          network: 'testnet',
          isConnected: true,
        },
        providerId: 'nonexistent',
      });

      vi.mocked(WalletStorage.loadPreferences).mockReturnValue({
        lastUsedProvider: 'nonexistent',
        autoConnect: true,
        connectionTimestamp: Date.now(),
      });

      const connection = await walletService.restoreConnection();

      expect(connection).toBeNull();
      expect(WalletStorage.clearAll).toHaveBeenCalled();
    });

    it('should clear data when provider is not available', async () => {
      mockProvider1.setAvailable(false);

      vi.mocked(WalletStorage.loadConnection).mockReturnValue({
        connection: {
          accountId: '0.0.hashpack',
          network: 'testnet',
          isConnected: true,
        },
        providerId: 'hashpack',
      });

      vi.mocked(WalletStorage.loadPreferences).mockReturnValue({
        lastUsedProvider: 'hashpack',
        autoConnect: true,
        connectionTimestamp: Date.now(),
      });

      const connection = await walletService.restoreConnection();

      expect(connection).toBeNull();
      expect(WalletStorage.clearAll).toHaveBeenCalled();
    });

    it('should handle account mismatch during restoration', async () => {
      const storedConnection = {
        accountId: '0.0.different',
        network: 'testnet' as const,
        isConnected: true,
      };

      vi.mocked(WalletStorage.loadConnection).mockReturnValue({
        connection: storedConnection,
        providerId: 'hashpack',
      });

      vi.mocked(WalletStorage.loadPreferences).mockReturnValue({
        lastUsedProvider: 'hashpack',
        autoConnect: true,
        connectionTimestamp: Date.now(),
      });

      const connection = await walletService.restoreConnection();

      // Should still return the fresh connection but clear stored data
      expect(connection).toBeTruthy();
      expect(connection?.accountId).toBe('0.0.hashpack'); // Fresh connection
      expect(WalletStorage.clearAll).toHaveBeenCalled();
    });

    it('should handle restoration errors gracefully', async () => {
      vi.mocked(WalletStorage.loadConnection).mockReturnValue({
        connection: {
          accountId: '0.0.hashpack',
          network: 'testnet',
          isConnected: true,
        },
        providerId: 'hashpack',
      });

      vi.mocked(WalletStorage.loadPreferences).mockReturnValue({
        lastUsedProvider: 'hashpack',
        autoConnect: true,
        connectionTimestamp: Date.now(),
      });

      // Mock provider to throw error on connect
      mockProvider1.connect = vi
        .fn()
        .mockRejectedValue(new Error('Connection failed'));

      const connection = await walletService.restoreConnection();

      expect(connection).toBeNull();
      expect(WalletStorage.clearAll).toHaveBeenCalled();
    });
  });

  describe('Preferences Management', () => {
    it('should get connection preferences', () => {
      const mockPreferences = {
        lastUsedProvider: 'hashpack',
        autoConnect: true,
        connectionTimestamp: Date.now(),
      };

      vi.mocked(WalletStorage.loadPreferences).mockReturnValue(mockPreferences);

      const preferences = walletService.getConnectionPreferences();
      expect(preferences).toEqual(mockPreferences);
    });

    it('should update preferences', () => {
      const currentPreferences = {
        lastUsedProvider: 'hashpack',
        autoConnect: false,
        connectionTimestamp: Date.now(),
      };

      vi.mocked(WalletStorage.loadPreferences).mockReturnValue(
        currentPreferences
      );

      walletService.updatePreferences({ autoConnect: true });

      expect(WalletStorage.savePreferences).toHaveBeenCalledWith({
        ...currentPreferences,
        autoConnect: true,
      });
    });
  });

  describe('Account Info Persistence', () => {
    it('should save account info', () => {
      const accountInfo = {
        accountId: '0.0.123456',
        balance: '100.5 HBAR',
        network: 'testnet' as const,
      };

      walletService.saveAccountInfo(accountInfo);

      expect(WalletStorage.saveAccountInfo).toHaveBeenCalledWith(accountInfo);
    });

    it('should load account info', () => {
      const accountInfo = {
        accountId: '0.0.123456',
        balance: '100.5 HBAR',
        network: 'testnet' as const,
      };

      vi.mocked(WalletStorage.loadAccountInfo).mockReturnValue(accountInfo);

      const loaded = walletService.loadAccountInfo();
      expect(loaded).toEqual(accountInfo);
    });

    it('should return null when no account info stored', () => {
      vi.mocked(WalletStorage.loadAccountInfo).mockReturnValue(null);

      const loaded = walletService.loadAccountInfo();
      expect(loaded).toBeNull();
    });
  });

  describe('Event Handling', () => {
    beforeEach(() => {
      walletService.registerProvider(mockProvider1);
    });

    it('should emit connect event', async () => {
      const callback = vi.fn();
      walletService.addEventListener('connect', callback);

      const connection = await walletService.connect('hashpack');

      expect(callback).toHaveBeenCalledWith(connection);
    });

    it('should emit disconnect event', async () => {
      const callback = vi.fn();
      walletService.addEventListener('disconnect', callback);

      await walletService.connect('hashpack');
      await walletService.disconnect();

      expect(callback).toHaveBeenCalled();
    });

    it('should remove event listeners', async () => {
      const callback = vi.fn();
      walletService.addEventListener('connect', callback);
      walletService.removeEventListener('connect', callback);

      await walletService.connect('hashpack');

      expect(callback).not.toHaveBeenCalled();
    });
  });
});
