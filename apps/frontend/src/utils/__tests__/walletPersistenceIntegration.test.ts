/**
 * Integration tests for wallet persistence functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WalletStorage } from '../walletStorage';
import { WalletService } from '../../services/wallet/WalletService';
import { BaseWalletAdapter } from '../../services/wallet/BaseWalletAdapter';
import { WalletConnection, AccountInfo } from '../../types/wallet';

// Mock localStorage for testing
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock wallet adapter for testing
class MockWalletAdapter extends BaseWalletAdapter {
  public readonly id: string;
  public readonly name: string;
  public readonly icon = 'mock-icon.svg';

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
    return true;
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
      balance: '1000.00',
      network: this.connection.network,
    };
  }

  async getBalance(): Promise<string> {
    if (!this.connection) {
      throw new Error('Not connected');
    }
    return '1000.00';
  }
}

describe('Wallet Persistence Integration', () => {
  let walletService: WalletService;
  let mockProvider: MockWalletAdapter;

  beforeEach(() => {
    walletService = new WalletService();
    mockProvider = new MockWalletAdapter('hashpack', 'HashPack');
    walletService.registerProvider(mockProvider);

    // Clear localStorage and mocks
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  describe('Connection Persistence Flow', () => {
    it('should save and restore connection data', async () => {
      // Connect to wallet
      const connection = await walletService.connect('hashpack');

      expect(connection.accountId).toBe('0.0.hashpack');
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(2); // connection + preferences

      // Verify connection data was saved
      const savedConnectionCall = mockLocalStorage.setItem.mock.calls.find(
        call => call[0] === 'wallet-connection'
      );
      expect(savedConnectionCall).toBeTruthy();

      const savedConnection = JSON.parse(savedConnectionCall![1]);
      expect(savedConnection.accountId).toBe('0.0.hashpack');
      expect(savedConnection.providerId).toBe('hashpack');

      // Verify preferences were saved
      const savedPreferencesCall = mockLocalStorage.setItem.mock.calls.find(
        call => call[0] === 'wallet-preferences'
      );
      expect(savedPreferencesCall).toBeTruthy();

      const savedPreferences = JSON.parse(savedPreferencesCall![1]);
      expect(savedPreferences.lastUsedProvider).toBe('hashpack');
      expect(savedPreferences.autoConnect).toBe(true);
    });

    it('should restore connection from storage', async () => {
      // Set up stored connection data
      const storedConnection = {
        accountId: '0.0.hashpack',
        network: 'testnet',
        isConnected: true,
        providerId: 'hashpack',
        timestamp: Date.now(),
      };

      const storedPreferences = {
        lastUsedProvider: 'hashpack',
        autoConnect: true,
        connectionTimestamp: Date.now(),
      };

      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'wallet-connection') {
          return JSON.stringify(storedConnection);
        }
        if (key === 'wallet-preferences') {
          return JSON.stringify(storedPreferences);
        }
        return null;
      });

      // Attempt to restore connection
      const restoredConnection = await walletService.restoreConnection();

      expect(restoredConnection).toBeTruthy();
      expect(restoredConnection?.accountId).toBe('0.0.hashpack');
      expect(walletService.getCurrentProvider()).toBe(mockProvider);
    });

    it('should clear all data on disconnect', async () => {
      // Connect first
      await walletService.connect('hashpack');

      // Disconnect
      await walletService.disconnect();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        'wallet-preferences'
      );
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        'wallet-connection'
      );
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        'wallet-account-info'
      );
    });
  });

  describe('Account Info Persistence', () => {
    it('should save and load account info', () => {
      const accountInfo: AccountInfo = {
        accountId: '0.0.123456',
        balance: '100.5',
        network: 'testnet',
      };

      // Save account info
      walletService.saveAccountInfo(accountInfo);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'wallet-account-info',
        expect.stringContaining(accountInfo.accountId)
      );

      // Mock the stored data for loading
      const storedData = {
        ...accountInfo,
        timestamp: Date.now(),
      };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(storedData));

      // Load account info
      const loaded = walletService.loadAccountInfo();

      expect(loaded).toEqual(accountInfo);
    });
  });

  describe('Preferences Management', () => {
    it('should update preferences correctly', () => {
      const initialPreferences = {
        lastUsedProvider: 'hashpack',
        autoConnect: false,
        connectionTimestamp: Date.now(),
      };

      // Mock loading initial preferences
      mockLocalStorage.getItem.mockReturnValue(
        JSON.stringify(initialPreferences)
      );

      // Update preferences
      walletService.updatePreferences({ autoConnect: true });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'wallet-preferences',
        expect.stringContaining('"autoConnect":true')
      );
    });

    it('should get current preferences', () => {
      const preferences = {
        lastUsedProvider: 'hashpack',
        autoConnect: true,
        connectionTimestamp: Date.now(),
      };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(preferences));

      const loaded = walletService.getConnectionPreferences();

      expect(loaded).toEqual(preferences);
    });
  });

  describe('Error Handling', () => {
    it('should handle storage unavailability gracefully', async () => {
      // Mock storage as unavailable
      vi.spyOn(WalletStorage, 'isStorageAvailable').mockReturnValue(false);

      const connection = await walletService.restoreConnection();

      expect(connection).toBeNull();
    });

    it('should handle corrupted storage data', async () => {
      // Set up corrupted data
      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'wallet-connection') {
          return 'invalid-json';
        }
        return null;
      });

      const connection = await walletService.restoreConnection();

      expect(connection).toBeNull();
    });

    it('should handle expired connection data', async () => {
      // Set up expired connection data (25 hours old)
      const expiredConnection = {
        accountId: '0.0.hashpack',
        network: 'testnet',
        isConnected: true,
        providerId: 'hashpack',
        timestamp: Date.now() - 25 * 60 * 60 * 1000,
      };

      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'wallet-connection') {
          return JSON.stringify(expiredConnection);
        }
        return null;
      });

      const connection = await walletService.restoreConnection();

      expect(connection).toBeNull();
    });
  });

  describe('Storage Validation', () => {
    it('should validate connection data structure', () => {
      const invalidConnection = {
        accountId: 123, // should be string
        network: 'testnet',
        isConnected: true,
        providerId: 'hashpack',
        timestamp: Date.now(),
      };

      mockLocalStorage.getItem.mockReturnValue(
        JSON.stringify(invalidConnection)
      );

      const loaded = WalletStorage.loadConnection();

      expect(loaded).toBeNull();
    });

    it('should validate preferences data structure', () => {
      const invalidPreferences = {
        lastUsedProvider: ['hashpack'], // should be string or null
        autoConnect: 'yes', // should be boolean
        connectionTimestamp: 'now', // should be number
      };

      mockLocalStorage.getItem.mockReturnValue(
        JSON.stringify(invalidPreferences)
      );

      const loaded = WalletStorage.loadPreferences();

      expect(loaded).toEqual({
        lastUsedProvider: null,
        autoConnect: false,
        connectionTimestamp: 0,
      });
    });
  });
});
