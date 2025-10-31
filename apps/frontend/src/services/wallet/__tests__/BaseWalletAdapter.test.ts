import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseWalletAdapter } from '../BaseWalletAdapter';
import {
  WalletConnection,
  AccountInfo,
  WalletErrorType,
} from '../../../types/wallet';

// Mock implementation for testing
class MockWalletAdapter extends BaseWalletAdapter {
  public readonly id = 'mock-wallet';
  public readonly name = 'Mock Wallet';
  public readonly icon = 'mock-icon.svg';

  private mockAvailable = true;
  private mockConnection: WalletConnection = {
    accountId: '0.0.123456',
    network: 'testnet',
    isConnected: true,
  };

  async isAvailable(): Promise<boolean> {
    return this.mockAvailable;
  }

  async connect(): Promise<WalletConnection> {
    this.connection = this.mockConnection;
    this.emit('connect', this.connection);
    return this.connection;
  }

  async disconnect(): Promise<void> {
    this.connection = null;
    this.emit('disconnect');
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

  // Test helpers
  setAvailable(available: boolean) {
    this.mockAvailable = available;
  }

  setConnection(connection: WalletConnection | null) {
    this.mockConnection = connection!;
  }
}

describe('BaseWalletAdapter', () => {
  let adapter: MockWalletAdapter;

  beforeEach(() => {
    adapter = new MockWalletAdapter();
  });

  describe('Basic Properties', () => {
    it('should have required properties', () => {
      expect(adapter.id).toBe('mock-wallet');
      expect(adapter.name).toBe('Mock Wallet');
      expect(adapter.icon).toBe('mock-icon.svg');
    });
  });

  describe('Connection Management', () => {
    it('should start disconnected', () => {
      expect(adapter.isConnected()).toBe(false);
      expect(adapter.getConnection()).toBeNull();
    });

    it('should connect successfully', async () => {
      const connection = await adapter.connect();

      expect(connection.accountId).toBe('0.0.123456');
      expect(connection.network).toBe('testnet');
      expect(connection.isConnected).toBe(true);
      expect(adapter.isConnected()).toBe(true);
    });

    it('should disconnect successfully', async () => {
      await adapter.connect();
      expect(adapter.isConnected()).toBe(true);

      await adapter.disconnect();
      expect(adapter.isConnected()).toBe(false);
      expect(adapter.getConnection()).toBeNull();
    });
  });

  describe('Event Handling', () => {
    it('should add and remove event listeners', () => {
      const callback = vi.fn();

      adapter.addEventListener('test', callback);
      adapter.emit('test', 'data');

      expect(callback).toHaveBeenCalledWith('data');

      adapter.removeEventListener('test', callback);
      adapter.emit('test', 'data2');

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should emit connect event on connection', async () => {
      const callback = vi.fn();
      adapter.addEventListener('connect', callback);

      const connection = await adapter.connect();

      expect(callback).toHaveBeenCalledWith(connection);
    });

    it('should emit disconnect event on disconnection', async () => {
      const callback = vi.fn();
      adapter.addEventListener('disconnect', callback);

      await adapter.connect();
      await adapter.disconnect();

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should create wallet errors correctly', () => {
      const error = adapter['createError'](
        WalletErrorType.CONNECTION_REJECTED,
        'Test error',
        { detail: 'test' }
      );

      expect(error.type).toBe(WalletErrorType.CONNECTION_REJECTED);
      expect(error.message).toBe('Test error');
      expect(error.details).toEqual({ detail: 'test' });
    });

    it('should handle common error patterns', () => {
      const rejectionError = new Error('User rejected the request');
      const walletError = adapter['handleError'](rejectionError);

      expect(walletError.type).toBe(WalletErrorType.CONNECTION_REJECTED);
      expect(walletError.message).toBe('Connection was rejected by user');
    });

    it('should handle locked wallet errors', () => {
      const lockedError = new Error('Wallet is locked');
      const walletError = adapter['handleError'](lockedError);

      expect(walletError.type).toBe(WalletErrorType.WALLET_LOCKED);
      expect(walletError.message).toBe(
        'Wallet is locked. Please unlock your wallet and try again.'
      );
    });

    it('should handle network errors', () => {
      const networkError = new Error('Network connection failed');
      const walletError = adapter['handleError'](networkError);

      expect(walletError.type).toBe(WalletErrorType.NETWORK_ERROR);
      expect(walletError.message).toBe(
        'Network connection error. Please check your connection and try again.'
      );
    });

    it('should handle unknown errors', () => {
      const unknownError = new Error('Something went wrong');
      const walletError = adapter['handleError'](unknownError);

      expect(walletError.type).toBe(WalletErrorType.UNKNOWN_ERROR);
      expect(walletError.message).toBe('Something went wrong');
    });
  });

  describe('Network Validation', () => {
    it('should validate networks correctly', () => {
      expect(adapter['validateNetwork']('testnet', 'testnet')).toBe(true);
      expect(adapter['validateNetwork']('mainnet', 'testnet')).toBe(false);
      expect(adapter['validateNetwork']('testnet')).toBe(true); // No expected network
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources', async () => {
      const callback = vi.fn();
      adapter.addEventListener('test', callback);
      await adapter.connect();

      adapter['cleanup']();

      expect(adapter.getConnection()).toBeNull();
      adapter.emit('test', 'data');
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
