import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { HashPackAdapter } from '../HashPackAdapter';
import { WalletErrorType } from '../../../types/wallet';

// Mock HashPack wallet interface
const mockHashPack = {
  isAvailable: true,
  connectToLocalWallet: vi.fn(),
  disconnect: vi.fn(),
  getAccountBalance: vi.fn(),
  isConnected: vi.fn(),
  getAccountInfo: vi.fn(),
};

// Mock window.hashpack
const mockWindow = {
  hashpack: mockHashPack,
};

describe('HashPackAdapter', () => {
  let adapter: HashPackAdapter;
  let originalWindow: any;

  beforeEach(() => {
    // Store original window
    originalWindow = global.window;

    // Mock window object using Object.defineProperty
    Object.defineProperty(global, 'window', {
      value: mockWindow,
      writable: true,
      configurable: true,
    });

    // Reset all mocks
    vi.clearAllMocks();

    // Create fresh adapter instance
    adapter = new HashPackAdapter();
  });

  afterEach(() => {
    // Restore original window
    Object.defineProperty(global, 'window', {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
  });

  describe('Basic Properties', () => {
    it('should have correct id, name, and icon', () => {
      expect(adapter.id).toBe('hashpack');
      expect(adapter.name).toBe('HashPack');
      expect(adapter.icon).toBe('/icons/hashpack.svg');
    });
  });

  describe('isAvailable', () => {
    it('should return true when HashPack is available', async () => {
      const result = await adapter.isAvailable();
      expect(result).toBe(true);
    });

    it('should return false when HashPack is not available', async () => {
      Object.defineProperty(global, 'window', {
        value: { hashpack: undefined },
        writable: true,
        configurable: true,
      });
      const result = await adapter.isAvailable();
      expect(result).toBe(false);
    });

    it('should return false when window is undefined', async () => {
      Object.defineProperty(global, 'window', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      const result = await adapter.isAvailable();
      expect(result).toBe(false);
    });

    it('should return false when HashPack isAvailable is false', async () => {
      Object.defineProperty(global, 'window', {
        value: { hashpack: { isAvailable: false } },
        writable: true,
        configurable: true,
      });
      const result = await adapter.isAvailable();
      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      // Mock window to throw error
      Object.defineProperty(global, 'window', {
        get: () => {
          throw new Error('Window access error');
        },
        configurable: true,
      });

      const result = await adapter.isAvailable();
      expect(result).toBe(false);
    });
  });

  describe('connect', () => {
    it('should connect successfully with valid account', async () => {
      const mockConnectionResult = {
        accountIds: ['0.0.12345'],
        network: 'testnet',
      };

      mockHashPack.connectToLocalWallet.mockResolvedValue(mockConnectionResult);

      const connection = await adapter.connect();

      expect(mockHashPack.connectToLocalWallet).toHaveBeenCalledOnce();
      expect(connection).toEqual({
        accountId: '0.0.12345',
        network: 'testnet',
        isConnected: true,
      });
      expect(adapter.isConnected()).toBe(true);
    });

    it('should handle mainnet network correctly', async () => {
      const mockConnectionResult = {
        accountIds: ['0.0.12345'],
        network: 'mainnet',
      };

      mockHashPack.connectToLocalWallet.mockResolvedValue(mockConnectionResult);

      const connection = await adapter.connect();

      expect(connection.network).toBe('mainnet');
    });

    it('should default to testnet for unknown networks', async () => {
      const mockConnectionResult = {
        accountIds: ['0.0.12345'],
        network: 'unknown-network',
      };

      mockHashPack.connectToLocalWallet.mockResolvedValue(mockConnectionResult);

      const connection = await adapter.connect();

      expect(connection.network).toBe('testnet');
    });

    it('should throw error when HashPack is not available', async () => {
      Object.defineProperty(global, 'window', {
        value: { hashpack: undefined },
        writable: true,
        configurable: true,
      });

      await expect(adapter.connect()).rejects.toMatchObject({
        type: WalletErrorType.PROVIDER_NOT_FOUND,
        message:
          'HashPack wallet is not installed. Please install the HashPack browser extension.',
      });
    });

    it('should throw error when no accounts found', async () => {
      const mockConnectionResult = {
        accountIds: [],
        network: 'testnet',
      };

      mockHashPack.connectToLocalWallet.mockResolvedValue(mockConnectionResult);

      await expect(adapter.connect()).rejects.toMatchObject({
        type: WalletErrorType.CONNECTION_REJECTED,
        message: 'No accounts found in HashPack wallet',
      });
    });

    it('should handle user rejection error', async () => {
      const error = new Error('User rejected the connection request');
      mockHashPack.connectToLocalWallet.mockRejectedValue(error);

      await expect(adapter.connect()).rejects.toMatchObject({
        type: WalletErrorType.CONNECTION_REJECTED,
        message: 'Connection request was rejected by user',
      });
    });

    it('should handle wallet locked error', async () => {
      const error = new Error('Wallet is locked, please unlock');
      mockHashPack.connectToLocalWallet.mockRejectedValue(error);

      await expect(adapter.connect()).rejects.toMatchObject({
        type: WalletErrorType.WALLET_LOCKED,
        message:
          'HashPack wallet is locked. Please unlock your wallet and try again.',
      });
    });

    it('should handle network error', async () => {
      const error = new Error('Wrong network selected');
      mockHashPack.connectToLocalWallet.mockRejectedValue(error);

      await expect(adapter.connect()).rejects.toMatchObject({
        type: WalletErrorType.WRONG_NETWORK,
        message:
          'HashPack is connected to the wrong network. Please switch to the correct network.',
      });
    });

    it('should emit connect event on successful connection', async () => {
      const mockConnectionResult = {
        accountIds: ['0.0.12345'],
        network: 'testnet',
      };

      mockHashPack.connectToLocalWallet.mockResolvedValue(mockConnectionResult);

      const connectSpy = vi.fn();
      adapter.addEventListener('connect', connectSpy);

      await adapter.connect();

      expect(connectSpy).toHaveBeenCalledWith({
        accountId: '0.0.12345',
        network: 'testnet',
        isConnected: true,
      });
    });

    it('should emit error event on connection failure', async () => {
      const error = new Error('Connection failed');
      mockHashPack.connectToLocalWallet.mockRejectedValue(error);

      const errorSpy = vi.fn();
      adapter.addEventListener('error', errorSpy);

      await expect(adapter.connect()).rejects.toThrow();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WalletErrorType.UNKNOWN_ERROR,
          message: 'Connection failed',
        })
      );
    });
  });

  describe('disconnect', () => {
    beforeEach(async () => {
      // Set up a connected state
      const mockConnectionResult = {
        accountIds: ['0.0.12345'],
        network: 'testnet',
      };
      mockHashPack.connectToLocalWallet.mockResolvedValue(mockConnectionResult);
      await adapter.connect();
      vi.clearAllMocks();
    });

    it('should disconnect successfully', async () => {
      mockHashPack.disconnect.mockResolvedValue(undefined);

      await adapter.disconnect();

      expect(mockHashPack.disconnect).toHaveBeenCalledOnce();
      expect(adapter.isConnected()).toBe(false);
      expect(adapter.getConnection()).toBeNull();
    });

    it('should emit disconnect event', async () => {
      const disconnectSpy = vi.fn();
      adapter.addEventListener('disconnect', disconnectSpy);

      mockHashPack.disconnect.mockResolvedValue(undefined);

      await adapter.disconnect();

      expect(disconnectSpy).toHaveBeenCalledOnce();
    });

    it('should handle disconnect errors', async () => {
      const error = new Error('Disconnect failed');
      mockHashPack.disconnect.mockRejectedValue(error);

      const errorSpy = vi.fn();
      adapter.addEventListener('error', errorSpy);

      await expect(adapter.disconnect()).rejects.toThrow();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WalletErrorType.UNKNOWN_ERROR,
          message: 'Disconnect failed',
        })
      );
    });

    it('should clean up even when not connected', async () => {
      // Create a fresh adapter that's not connected
      const freshAdapter = new HashPackAdapter();

      await expect(freshAdapter.disconnect()).resolves.not.toThrow();
      expect(freshAdapter.isConnected()).toBe(false);
    });
  });

  describe('getAccountInfo', () => {
    beforeEach(async () => {
      // Set up a connected state
      const mockConnectionResult = {
        accountIds: ['0.0.12345'],
        network: 'testnet',
      };
      mockHashPack.connectToLocalWallet.mockResolvedValue(mockConnectionResult);
      await adapter.connect();
      vi.clearAllMocks();
    });

    it('should return account info successfully', async () => {
      const mockAccountInfo = {
        accountId: '0.0.12345',
        network: 'testnet',
      };
      const mockBalance = { hbars: 100.5 };

      mockHashPack.getAccountInfo.mockResolvedValue(mockAccountInfo);
      mockHashPack.getAccountBalance.mockResolvedValue(mockBalance);

      const accountInfo = await adapter.getAccountInfo();

      expect(mockHashPack.getAccountInfo).toHaveBeenCalledOnce();
      expect(mockHashPack.getAccountBalance).toHaveBeenCalledWith('0.0.12345');
      expect(accountInfo).toEqual({
        accountId: '0.0.12345',
        balance: '100.5',
        network: 'testnet',
      });
    });

    it('should throw error when not connected', async () => {
      const freshAdapter = new HashPackAdapter();

      await expect(freshAdapter.getAccountInfo()).rejects.toMatchObject({
        type: WalletErrorType.UNKNOWN_ERROR,
        message: 'HashPack wallet is not connected',
      });
    });

    it('should handle getAccountInfo errors', async () => {
      const error = new Error('Failed to get account info');
      mockHashPack.getAccountInfo.mockRejectedValue(error);

      const errorSpy = vi.fn();
      adapter.addEventListener('error', errorSpy);

      await expect(adapter.getAccountInfo()).rejects.toThrow();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WalletErrorType.UNKNOWN_ERROR,
          message: 'Failed to get account info',
        })
      );
    });
  });

  describe('getBalance', () => {
    beforeEach(async () => {
      // Set up a connected state
      const mockConnectionResult = {
        accountIds: ['0.0.12345'],
        network: 'testnet',
      };
      mockHashPack.connectToLocalWallet.mockResolvedValue(mockConnectionResult);
      await adapter.connect();
      vi.clearAllMocks();
    });

    it('should return balance successfully', async () => {
      const mockBalance = { hbars: 250.75 };
      mockHashPack.getAccountBalance.mockResolvedValue(mockBalance);

      const balance = await adapter.getBalance();

      expect(mockHashPack.getAccountBalance).toHaveBeenCalledWith('0.0.12345');
      expect(balance).toBe('250.75');
    });

    it('should handle integer balance', async () => {
      const mockBalance = { hbars: 100 };
      mockHashPack.getAccountBalance.mockResolvedValue(mockBalance);

      const balance = await adapter.getBalance();

      expect(balance).toBe('100');
    });

    it('should throw error when not connected', async () => {
      const freshAdapter = new HashPackAdapter();

      await expect(freshAdapter.getBalance()).rejects.toMatchObject({
        type: WalletErrorType.UNKNOWN_ERROR,
        message: 'HashPack wallet is not connected',
      });
    });

    it('should handle getBalance errors', async () => {
      const error = new Error('Failed to get balance');
      mockHashPack.getAccountBalance.mockRejectedValue(error);

      const errorSpy = vi.fn();
      adapter.addEventListener('error', errorSpy);

      await expect(adapter.getBalance()).rejects.toThrow();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WalletErrorType.UNKNOWN_ERROR,
          message: 'Failed to get balance',
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle provider not found errors', async () => {
      const error = new Error('HashPack not installed');
      mockHashPack.connectToLocalWallet.mockRejectedValue(error);

      await expect(adapter.connect()).rejects.toMatchObject({
        type: WalletErrorType.PROVIDER_NOT_FOUND,
        message: 'HashPack wallet extension is not installed or available',
      });
    });

    it('should handle unknown errors', async () => {
      const error = 'Unknown error type';
      mockHashPack.connectToLocalWallet.mockRejectedValue(error);

      await expect(adapter.connect()).rejects.toMatchObject({
        type: WalletErrorType.UNKNOWN_ERROR,
        message: 'An unknown HashPack error occurred',
      });
    });

    it('should pass through existing WalletError objects', async () => {
      const walletError = {
        type: WalletErrorType.NETWORK_ERROR,
        message: 'Custom network error',
        details: { custom: 'data' },
      };
      mockHashPack.connectToLocalWallet.mockRejectedValue(walletError);

      await expect(adapter.connect()).rejects.toEqual(walletError);
    });
  });

  describe('Event Handling', () => {
    it('should support adding and removing event listeners', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      adapter.addEventListener('test', callback1);
      adapter.addEventListener('test', callback2);

      // Emit event using protected method (accessing via any for testing)
      (adapter as any).emit('test', 'data');

      expect(callback1).toHaveBeenCalledWith('data');
      expect(callback2).toHaveBeenCalledWith('data');

      // Remove one listener
      adapter.removeEventListener('test', callback1);
      (adapter as any).emit('test', 'data2');

      expect(callback1).toHaveBeenCalledTimes(1); // Still only called once
      expect(callback2).toHaveBeenCalledWith('data2');
    });

    it('should handle errors in event listeners gracefully', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Listener error');
      });
      const normalCallback = vi.fn();

      adapter.addEventListener('test', errorCallback);
      adapter.addEventListener('test', normalCallback);

      // Should not throw despite error in first listener
      expect(() => {
        (adapter as any).emit('test', 'data');
      }).not.toThrow();

      expect(errorCallback).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled();
    });
  });

  describe('Connection State Management', () => {
    it('should properly track connection state', async () => {
      expect(adapter.isConnected()).toBe(false);
      expect(adapter.getConnection()).toBeNull();

      const mockConnectionResult = {
        accountIds: ['0.0.12345'],
        network: 'testnet',
      };
      mockHashPack.connectToLocalWallet.mockResolvedValue(mockConnectionResult);

      await adapter.connect();

      expect(adapter.isConnected()).toBe(true);
      expect(adapter.getConnection()).toEqual({
        accountId: '0.0.12345',
        network: 'testnet',
        isConnected: true,
      });

      mockHashPack.disconnect.mockResolvedValue(undefined);
      await adapter.disconnect();

      expect(adapter.isConnected()).toBe(false);
      expect(adapter.getConnection()).toBeNull();
    });
  });
});
