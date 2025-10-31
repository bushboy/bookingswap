/**
 * Unit tests for wallet storage utilities
 */

import { WalletStorage } from '../walletStorage';
import {
  WalletPreferences,
  WalletConnection,
  AccountInfo,
} from '../../types/wallet';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index: number) => Object.keys(store)[index] || null),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('WalletStorage', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    jest.clearAllMocks();
  });

  describe('Preferences Management', () => {
    const mockPreferences: WalletPreferences = {
      lastUsedProvider: 'hashpack',
      autoConnect: true,
      connectionTimestamp: Date.now(),
    };

    it('should save preferences to localStorage', () => {
      WalletStorage.savePreferences(mockPreferences);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'wallet-preferences',
        JSON.stringify(mockPreferences)
      );
    });

    it('should load preferences from localStorage', () => {
      mockLocalStorage.setItem(
        'wallet-preferences',
        JSON.stringify(mockPreferences)
      );

      const loaded = WalletStorage.loadPreferences();

      expect(loaded).toEqual(mockPreferences);
    });

    it('should return default preferences when none stored', () => {
      const loaded = WalletStorage.loadPreferences();

      expect(loaded).toEqual({
        lastUsedProvider: null,
        autoConnect: false,
        connectionTimestamp: 0,
      });
    });

    it('should return default preferences when stored data is invalid', () => {
      mockLocalStorage.setItem('wallet-preferences', 'invalid-json');

      const loaded = WalletStorage.loadPreferences();

      expect(loaded).toEqual({
        lastUsedProvider: null,
        autoConnect: false,
        connectionTimestamp: 0,
      });
    });

    it('should return default preferences when stored data has wrong structure', () => {
      const invalidPreferences = {
        lastUsedProvider: 123, // should be string or null
        autoConnect: 'yes', // should be boolean
      };
      mockLocalStorage.setItem(
        'wallet-preferences',
        JSON.stringify(invalidPreferences)
      );

      const loaded = WalletStorage.loadPreferences();

      expect(loaded).toEqual({
        lastUsedProvider: null,
        autoConnect: false,
        connectionTimestamp: 0,
      });
    });

    it('should clear preferences from localStorage', () => {
      mockLocalStorage.setItem(
        'wallet-preferences',
        JSON.stringify(mockPreferences)
      );

      WalletStorage.clearPreferences();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        'wallet-preferences'
      );
    });

    it('should handle localStorage errors gracefully when saving', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      expect(() =>
        WalletStorage.savePreferences(mockPreferences)
      ).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to save wallet preferences:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Connection Management', () => {
    const mockConnection: WalletConnection = {
      accountId: '0.0.123456',
      network: 'testnet',
      isConnected: true,
    };
    const providerId = 'hashpack';

    it('should save connection to localStorage', () => {
      const beforeSave = Date.now();
      WalletStorage.saveConnection(mockConnection, providerId);
      const afterSave = Date.now();

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'wallet-connection',
        expect.stringContaining(mockConnection.accountId)
      );

      // Verify the stored data structure
      const storedData = JSON.parse(mockLocalStorage.setItem.mock.calls[0][1]);
      expect(storedData).toMatchObject({
        ...mockConnection,
        providerId,
      });
      expect(storedData.timestamp).toBeGreaterThanOrEqual(beforeSave);
      expect(storedData.timestamp).toBeLessThanOrEqual(afterSave);
    });

    it('should load valid connection from localStorage', () => {
      const connectionData = {
        ...mockConnection,
        providerId,
        timestamp: Date.now(),
      };
      mockLocalStorage.setItem(
        'wallet-connection',
        JSON.stringify(connectionData)
      );

      const loaded = WalletStorage.loadConnection();

      expect(loaded).toEqual({
        connection: mockConnection,
        providerId,
      });
    });

    it('should return null when no connection stored', () => {
      const loaded = WalletStorage.loadConnection();

      expect(loaded).toBeNull();
    });

    it('should return null and clear expired connection', () => {
      const expiredConnectionData = {
        ...mockConnection,
        providerId,
        timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
      };
      mockLocalStorage.setItem(
        'wallet-connection',
        JSON.stringify(expiredConnectionData)
      );

      const loaded = WalletStorage.loadConnection();

      expect(loaded).toBeNull();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        'wallet-connection'
      );
    });

    it('should return null when stored connection data is invalid', () => {
      mockLocalStorage.setItem('wallet-connection', 'invalid-json');

      const loaded = WalletStorage.loadConnection();

      expect(loaded).toBeNull();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        'wallet-connection'
      );
    });

    it('should clear connection from localStorage', () => {
      mockLocalStorage.setItem(
        'wallet-connection',
        JSON.stringify(mockConnection)
      );

      WalletStorage.clearConnection();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        'wallet-connection'
      );
    });
  });

  describe('Account Info Management', () => {
    const mockAccountInfo: AccountInfo = {
      accountId: '0.0.123456',
      balance: '100.5',
      network: 'testnet',
    };

    it('should save account info to localStorage', () => {
      const beforeSave = Date.now();
      WalletStorage.saveAccountInfo(mockAccountInfo);
      const afterSave = Date.now();

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'wallet-account-info',
        expect.stringContaining(mockAccountInfo.accountId)
      );

      // Verify the stored data structure
      const storedData = JSON.parse(mockLocalStorage.setItem.mock.calls[0][1]);
      expect(storedData).toMatchObject(mockAccountInfo);
      expect(storedData.timestamp).toBeGreaterThanOrEqual(beforeSave);
      expect(storedData.timestamp).toBeLessThanOrEqual(afterSave);
    });

    it('should load valid account info from localStorage', () => {
      const accountData = {
        ...mockAccountInfo,
        timestamp: Date.now(),
      };
      mockLocalStorage.setItem(
        'wallet-account-info',
        JSON.stringify(accountData)
      );

      const loaded = WalletStorage.loadAccountInfo();

      expect(loaded).toEqual(mockAccountInfo);
    });

    it('should return null when no account info stored', () => {
      const loaded = WalletStorage.loadAccountInfo();

      expect(loaded).toBeNull();
    });

    it('should return null and clear expired account info', () => {
      const expiredAccountData = {
        ...mockAccountInfo,
        timestamp: Date.now() - 6 * 60 * 1000, // 6 minutes ago (expired)
      };
      mockLocalStorage.setItem(
        'wallet-account-info',
        JSON.stringify(expiredAccountData)
      );

      const loaded = WalletStorage.loadAccountInfo();

      expect(loaded).toBeNull();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        'wallet-account-info'
      );
    });

    it('should clear account info from localStorage', () => {
      mockLocalStorage.setItem(
        'wallet-account-info',
        JSON.stringify(mockAccountInfo)
      );

      WalletStorage.clearAccountInfo();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        'wallet-account-info'
      );
    });
  });

  describe('Storage Management', () => {
    it('should clear all wallet data', () => {
      // Set up some data
      mockLocalStorage.setItem('wallet-preferences', '{}');
      mockLocalStorage.setItem('wallet-connection', '{}');
      mockLocalStorage.setItem('wallet-account-info', '{}');

      WalletStorage.clearAll();

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

    it('should detect localStorage availability', () => {
      const isAvailable = WalletStorage.isStorageAvailable();

      expect(isAvailable).toBe(true);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        '__wallet_storage_test__',
        '__wallet_storage_test__'
      );
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        '__wallet_storage_test__'
      );
    });

    it('should detect localStorage unavailability', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage not available');
      });

      const isAvailable = WalletStorage.isStorageAvailable();

      expect(isAvailable).toBe(false);
    });

    it('should calculate storage usage', () => {
      mockLocalStorage.setItem('wallet-preferences', '{"test": "data"}');
      mockLocalStorage.setItem('wallet-connection', '{"more": "data"}');

      const info = WalletStorage.getStorageInfo();

      expect(info.available).toBe(true);
      expect(info.used).toBeGreaterThan(0);
    });

    it('should handle storage calculation errors', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const info = WalletStorage.getStorageInfo();

      expect(info.available).toBe(true);
      expect(info.used).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to calculate storage usage:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Data Validation', () => {
    it('should validate connection data structure', () => {
      const invalidConnectionData = {
        accountId: 123, // should be string
        network: 'testnet',
        isConnected: true,
        providerId: 'hashpack',
        timestamp: Date.now(),
      };
      mockLocalStorage.setItem(
        'wallet-connection',
        JSON.stringify(invalidConnectionData)
      );

      const loaded = WalletStorage.loadConnection();

      expect(loaded).toBeNull();
    });

    it('should validate account info data structure', () => {
      const invalidAccountData = {
        accountId: '0.0.123456',
        balance: 100, // should be string
        network: 'testnet',
        timestamp: Date.now(),
      };
      mockLocalStorage.setItem(
        'wallet-account-info',
        JSON.stringify(invalidAccountData)
      );

      const loaded = WalletStorage.loadAccountInfo();

      expect(loaded).toBeNull();
    });

    it('should validate preferences data structure', () => {
      const invalidPreferences = {
        lastUsedProvider: ['hashpack'], // should be string or null
        autoConnect: true,
        connectionTimestamp: Date.now(),
      };
      mockLocalStorage.setItem(
        'wallet-preferences',
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

  describe('Error Handling', () => {
    it('should handle localStorage errors when loading preferences', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const loaded = WalletStorage.loadPreferences();

      expect(loaded).toEqual({
        lastUsedProvider: null,
        autoConnect: false,
        connectionTimestamp: 0,
      });
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load wallet preferences:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle localStorage errors when loading connection', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const loaded = WalletStorage.loadConnection();

      expect(loaded).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load wallet connection:',
        expect.any(Error)
      );
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        'wallet-connection'
      );

      consoleSpy.mockRestore();
    });

    it('should handle localStorage errors when clearing data', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockLocalStorage.removeItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      expect(() => WalletStorage.clearPreferences()).not.toThrow();
      expect(() => WalletStorage.clearConnection()).not.toThrow();
      expect(() => WalletStorage.clearAccountInfo()).not.toThrow();

      consoleSpy.mockRestore();
    });
  });
});
