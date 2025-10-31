/**
 * Utilities for storing and retrieving wallet preferences and connection data
 */

import {
  WalletPreferences,
  WalletConnection,
  AccountInfo,
} from '../types/wallet';

const STORAGE_KEYS = {
  PREFERENCES: 'wallet-preferences',
  CONNECTION: 'wallet-connection',
  ACCOUNT_INFO: 'wallet-account-info',
} as const;

// Connection expiry time (24 hours)
const CONNECTION_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * Storage utility class for wallet data persistence
 */
export class WalletStorage {
  /**
   * Save wallet preferences to local storage
   */
  static savePreferences(preferences: WalletPreferences): void {
    try {
      localStorage.setItem(
        STORAGE_KEYS.PREFERENCES,
        JSON.stringify(preferences)
      );
    } catch (error) {
      console.warn('Failed to save wallet preferences:', error);
    }
  }

  /**
   * Load wallet preferences from local storage
   */
  static loadPreferences(): WalletPreferences {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
      if (stored) {
        const preferences = JSON.parse(stored) as WalletPreferences;

        // Validate the structure
        if (this.isValidPreferences(preferences)) {
          return preferences;
        }
      }
    } catch (error) {
      console.warn('Failed to load wallet preferences:', error);
    }

    return this.getDefaultPreferences();
  }

  /**
   * Clear wallet preferences from local storage
   */
  static clearPreferences(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.PREFERENCES);
    } catch (error) {
      console.warn('Failed to clear wallet preferences:', error);
    }
  }

  /**
   * Save wallet connection data to local storage
   */
  static saveConnection(
    connection: WalletConnection,
    providerId: string
  ): void {
    try {
      const connectionData = {
        ...connection,
        providerId,
        timestamp: Date.now(),
      };
      localStorage.setItem(
        STORAGE_KEYS.CONNECTION,
        JSON.stringify(connectionData)
      );
    } catch (error) {
      console.warn('Failed to save wallet connection:', error);
    }
  }

  /**
   * Load wallet connection data from local storage
   */
  static loadConnection(): {
    connection: WalletConnection;
    providerId: string;
  } | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CONNECTION);
      if (stored) {
        const connectionData = JSON.parse(stored);

        // Check if connection is still valid (not expired)
        if (this.isValidConnection(connectionData)) {
          const { providerId, timestamp, ...connection } = connectionData;
          return { connection, providerId };
        } else {
          // Clear expired connection
          this.clearConnection();
        }
      }
    } catch (error) {
      console.warn('Failed to load wallet connection:', error);
      this.clearConnection();
    }

    return null;
  }

  /**
   * Clear wallet connection data from local storage
   */
  static clearConnection(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.CONNECTION);
    } catch (error) {
      console.warn('Failed to clear wallet connection:', error);
    }
  }

  /**
   * Save account info to local storage
   */
  static saveAccountInfo(accountInfo: AccountInfo): void {
    try {
      const accountData = {
        ...accountInfo,
        timestamp: Date.now(),
      };
      localStorage.setItem(
        STORAGE_KEYS.ACCOUNT_INFO,
        JSON.stringify(accountData)
      );
    } catch (error) {
      console.warn('Failed to save account info:', error);
    }
  }

  /**
   * Load account info from local storage
   */
  static loadAccountInfo(): AccountInfo | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ACCOUNT_INFO);
      if (stored) {
        const accountData = JSON.parse(stored);

        // Check if account info is still valid (not expired)
        if (this.isValidAccountInfo(accountData)) {
          const { timestamp, ...accountInfo } = accountData;
          return accountInfo;
        } else {
          // Clear expired account info
          this.clearAccountInfo();
        }
      }
    } catch (error) {
      console.warn('Failed to load account info:', error);
      this.clearAccountInfo();
    }

    return null;
  }

  /**
   * Clear account info from local storage
   */
  static clearAccountInfo(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.ACCOUNT_INFO);
    } catch (error) {
      console.warn('Failed to clear account info:', error);
    }
  }

  /**
   * Clear all wallet data from local storage
   */
  static clearAll(): void {
    this.clearPreferences();
    this.clearConnection();
    this.clearAccountInfo();
  }

  /**
   * Check if stored preferences are valid
   */
  private static isValidPreferences(
    preferences: any
  ): preferences is WalletPreferences {
    return (
      preferences &&
      typeof preferences === 'object' &&
      (preferences.lastUsedProvider === null ||
        typeof preferences.lastUsedProvider === 'string') &&
      typeof preferences.autoConnect === 'boolean' &&
      typeof preferences.connectionTimestamp === 'number'
    );
  }

  /**
   * Check if stored connection is valid and not expired
   */
  private static isValidConnection(connectionData: any): boolean {
    if (!connectionData || typeof connectionData !== 'object') {
      return false;
    }

    const { timestamp, providerId, accountId, network, isConnected } =
      connectionData;

    // Check structure
    if (
      typeof timestamp !== 'number' ||
      typeof providerId !== 'string' ||
      typeof accountId !== 'string' ||
      typeof network !== 'string' ||
      typeof isConnected !== 'boolean'
    ) {
      return false;
    }

    // Check if not expired
    const now = Date.now();
    return now - timestamp < CONNECTION_EXPIRY_MS;
  }

  /**
   * Check if stored account info is valid and not expired
   */
  private static isValidAccountInfo(accountData: any): boolean {
    if (!accountData || typeof accountData !== 'object') {
      return false;
    }

    const { timestamp, accountId, balance, network } = accountData;

    // Check structure
    if (
      typeof timestamp !== 'number' ||
      typeof accountId !== 'string' ||
      typeof balance !== 'string' ||
      typeof network !== 'string'
    ) {
      return false;
    }

    // Check if not expired (account info expires faster - 5 minutes)
    const now = Date.now();
    return now - timestamp < 5 * 60 * 1000;
  }

  /**
   * Get default preferences
   */
  private static getDefaultPreferences(): WalletPreferences {
    return {
      lastUsedProvider: null,
      autoConnect: false,
      connectionTimestamp: 0,
    };
  }

  /**
   * Check if local storage is available
   */
  static isStorageAvailable(): boolean {
    try {
      const test = '__wallet_storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get storage usage information
   */
  static getStorageInfo(): { used: number; available: boolean } {
    const available = this.isStorageAvailable();
    let used = 0;

    if (available) {
      try {
        const preferences = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
        const connection = localStorage.getItem(STORAGE_KEYS.CONNECTION);
        const accountInfo = localStorage.getItem(STORAGE_KEYS.ACCOUNT_INFO);

        used +=
          (preferences?.length || 0) +
          (connection?.length || 0) +
          (accountInfo?.length || 0);
      } catch (error) {
        console.warn('Failed to calculate storage usage:', error);
      }
    }

    return { used, available };
  }
}
