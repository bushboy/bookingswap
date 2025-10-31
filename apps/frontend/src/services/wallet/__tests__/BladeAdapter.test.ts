import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { BladeAdapter } from '../BladeAdapter';
import { WalletErrorType } from '../../../types/wallet';

// Mock Blade wallet interface
const mockBlade = {
  isAvailable: true,
  createAccount: vi.fn(),
  getAccountInfo: vi.fn(),
  getBalance: vi.fn(),
  associateToken: vi.fn(),
  transferHbars: vi.fn(),
  transferTokens: vi.fn(),
  contractCallFunction: vi.fn(),
  sign: vi.fn(),
  signTransaction: vi.fn(),
  getC14url: vi.fn(),
  exchangeGetQuotes: vi.fn(),
  swapTokens: vi.fn(),
};

// Mock window.bladeWallet
const mockWindow = {
  bladeWallet: mockBlade,
};

describe('BladeAdapter', () => {
  let adapter: BladeAdapter;
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
    adapter = new BladeAdapter();
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
      expect(adapter.id).toBe('blade');
      expect(adapter.name).toBe('Blade');
      expect(adapter.icon).toBe('/icons/blade.svg');
    });
  });

  describe('isAvailable', () => {
    it('should return true when Blade is available', async () => {
      const result = await adapter.isAvailable();
      expect(result).toBe(true);
    });

    it('should return false when Blade is not available', async () => {
      Object.defineProperty(global, 'window', {
        value: { bladeWallet: undefined },
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

    it('should return false when Blade isAvailable is false', async () => {
      Object.defineProperty(global, 'window', {
        value: { bladeWallet: { isAvailable: false } },
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
      const mockAccountInfo = {
        accountId: '0.0.54321',
        evmAddress: '0x1234567890abcdef',
      };

      mockBlade.getAccountInfo.mockResolvedValue(mockAccountInfo);

      const connection = await adapter.connect();

      expect(mockBlade.getAccountInfo).toHaveBeenCalledOnce();
      expect(connection).toEqual({
        accountId: '0.0.54321',
        network: 'testnet',
        isConnected: true,
      });
      expect(adapter.isConnected()).toBe(true);
    });

    it('should throw error when Blade is not available', async () => {
      Object.defineProperty(global, 'window', {
        value: { bladeWallet: undefined },
        writable: true,
        configurable: true,
      });

      await expect(adapter.connect()).rejects.toMatchObject({
        type: WalletErrorType.PROVIDER_NOT_FOUND,
        message:
          'Blade wallet is not installed. Please install the Blade browser extension.',
      });
    });

    it('should throw error when no account found', async () => {
      const error = new Error('No account found');
      mockBlade.getAccountInfo.mockRejectedValue(error);

      await expect(adapter.connect()).rejects.toMatchObject({
        type: WalletErrorType.CONNECTION_REJECTED,
        message:
          'No account found in Blade wallet. Please set up your Blade wallet first.',
      });
    });

    it('should throw error when account ID is empty', async () => {
      const mockAccountInfo = {
        accountId: '',
        evmAddress: '0x1234567890abcdef',
      };

      mockBlade.getAccountInfo.mockResolvedValue(mockAccountInfo);

      await expect(adapter.connect()).rejects.toMatchObject({
        type: WalletErrorType.CONNECTION_REJECTED,
        message: 'No valid account found in Blade wallet',
      });
    });

    it('should handle user rejection error', async () => {
      const error = new Error('User rejected the connection request');
      mockBlade.getAccountInfo.mockRejectedValue(error);

      await expect(adapter.connect()).rejects.toMatchObject({
        type: WalletErrorType.CONNECTION_REJECTED,
        message: 'Connection request was rejected by user',
      });
    });

    it('should handle user cancelled error', async () => {
      const error = new Error('User cancelled the operation');
      mockBlade.getAccountInfo.mockRejectedValue(error);

      await expect(adapter.connect()).rejects.toMatchObject({
        type: WalletErrorType.CONNECTION_REJECTED,
        message: 'Connection request was rejected by user',
      });
    });

    it('should handle wallet locked error', async () => {
      const error = new Error('Wallet is locked, please unlock');
      mockBlade.getAccountInfo.mockRejectedValue(error);

      await expect(adapter.connect()).rejects.toMatchObject({
        type: WalletErrorType.WALLET_LOCKED,
        message:
          'Blade wallet is locked. Please unlock your wallet and try again.',
      });
    });

    it('should handle password error', async () => {
      const error = new Error('Invalid password provided');
      mockBlade.getAccountInfo.mockRejectedValue(error);

      await expect(adapter.connect()).rejects.toMatchObject({
        type: WalletErrorType.WALLET_LOCKED,
        message:
          'Blade wallet is locked. Please unlock your wallet and try again.',
      });
    });

    it('should handle network error', async () => {
      const error = new Error('Wrong network selected');
      mockBlade.getAccountInfo.mockRejectedValue(error);

      await expect(adapter.connect()).rejects.toMatchObject({
        type: WalletErrorType.WRONG_NETWORK,
        message:
          'Blade is connected to the wrong network. Please switch to the correct network.',
      });
    });

    it('should handle not installed error', async () => {
      const error = new Error('Blade wallet not installed');
      mockBlade.getAccountInfo.mockRejectedValue(error);

      await expect(adapter.connect()).rejects.toMatchObject({
        type: WalletErrorType.PROVIDER_NOT_FOUND,
        message: 'Blade wallet extension is not installed or available',
      });
    });

    it('should emit connect event on successful connection', async () => {
      const mockAccountInfo = {
        accountId: '0.0.54321',
        evmAddress: '0x1234567890abcdef',
      };

      mockBlade.getAccountInfo.mockResolvedValue(mockAccountInfo);

      const connectSpy = vi.fn();
      adapter.addEventListener('connect', connectSpy);

      await adapter.connect();

      expect(connectSpy).toHaveBeenCalledWith({
        accountId: '0.0.54321',
        network: 'testnet',
        isConnected: true,
      });
    });

    it('should emit error event on connection failure', async () => {
      const error = new Error('Connection failed');
      mockBlade.getAccountInfo.mockRejectedValue(error);

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
      const mockAccountInfo = {
        accountId: '0.0.54321',
        evmAddress: '0x1234567890abcdef',
      };
      mockBlade.getAccountInfo.mockResolvedValue(mockAccountInfo);
      await adapter.connect();
      vi.clearAllMocks();
    });

    it('should disconnect successfully', async () => {
      await adapter.disconnect();

      expect(adapter.isConnected()).toBe(false);
      expect(adapter.getConnection()).toBeNull();
    });

    it('should emit disconnect event', async () => {
      const disconnectSpy = vi.fn();
      adapter.addEventListener('disconnect', disconnectSpy);

      await adapter.disconnect();

      expect(disconnectSpy).toHaveBeenCalledOnce();
    });

    it('should clean up even when not connected', async () => {
      // Create a fresh adapter that's not connected
      const freshAdapter = new BladeAdapter();

      await expect(freshAdapter.disconnect()).resolves.not.toThrow();
      expect(freshAdapter.isConnected()).toBe(false);
    });
  });

  describe('getAccountInfo', () => {
    beforeEach(async () => {
      // Set up a connected state
      const mockAccountInfo = {
        accountId: '0.0.54321',
        evmAddress: '0x1234567890abcdef',
      };
      mockBlade.getAccountInfo.mockResolvedValue(mockAccountInfo);
      await adapter.connect();
      vi.clearAllMocks();
    });

    it('should return account info successfully', async () => {
      const mockAccountInfo = {
        accountId: '0.0.54321',
        evmAddress: '0x1234567890abcdef',
      };
      const mockBalance = { hbars: 150.25 };

      mockBlade.getAccountInfo.mockResolvedValue(mockAccountInfo);
      mockBlade.getBalance.mockResolvedValue(mockBalance);

      const accountInfo = await adapter.getAccountInfo();

      expect(mockBlade.getAccountInfo).toHaveBeenCalledOnce();
      expect(mockBlade.getBalance).toHaveBeenCalledOnce();
      expect(accountInfo).toEqual({
        accountId: '0.0.54321',
        balance: '150.25',
        network: 'testnet',
      });
    });

    it('should throw error when not connected', async () => {
      const freshAdapter = new BladeAdapter();

      await expect(freshAdapter.getAccountInfo()).rejects.toMatchObject({
        type: WalletErrorType.UNKNOWN_ERROR,
        message: 'Blade wallet is not connected',
      });
    });

    it('should handle getAccountInfo errors', async () => {
      const error = new Error('Failed to get account info');
      mockBlade.getAccountInfo.mockRejectedValue(error);

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
      const mockAccountInfo = {
        accountId: '0.0.54321',
        evmAddress: '0x1234567890abcdef',
      };
      mockBlade.getAccountInfo.mockResolvedValue(mockAccountInfo);
      await adapter.connect();
      vi.clearAllMocks();
    });

    it('should return balance successfully', async () => {
      const mockBalance = { hbars: 300.5 };
      mockBlade.getBalance.mockResolvedValue(mockBalance);

      const balance = await adapter.getBalance();

      expect(mockBlade.getBalance).toHaveBeenCalledOnce();
      expect(balance).toBe('300.5');
    });

    it('should handle integer balance', async () => {
      const mockBalance = { hbars: 200 };
      mockBlade.getBalance.mockResolvedValue(mockBalance);

      const balance = await adapter.getBalance();

      expect(balance).toBe('200');
    });

    it('should throw error when not connected', async () => {
      const freshAdapter = new BladeAdapter();

      await expect(freshAdapter.getBalance()).rejects.toMatchObject({
        type: WalletErrorType.UNKNOWN_ERROR,
        message: 'Blade wallet is not connected',
      });
    });

    it('should handle getBalance errors', async () => {
      const error = new Error('Failed to get balance');
      mockBlade.getBalance.mockRejectedValue(error);

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
      const error = new Error('Blade not found');
      mockBlade.getAccountInfo.mockRejectedValue(error);

      await expect(adapter.connect()).rejects.toMatchObject({
        type: WalletErrorType.PROVIDER_NOT_FOUND,
        message: 'Blade wallet extension is not installed or available',
      });
    });

    it('should handle not available errors', async () => {
      const error = new Error('Blade not available');
      mockBlade.getAccountInfo.mockRejectedValue(error);

      await expect(adapter.connect()).rejects.toMatchObject({
        type: WalletErrorType.PROVIDER_NOT_FOUND,
        message: 'Blade wallet extension is not installed or available',
      });
    });

    it('should handle account not found errors', async () => {
      const error = new Error('no account found in wallet');
      mockBlade.getAccountInfo.mockRejectedValue(error);

      await expect(adapter.connect()).rejects.toMatchObject({
        type: WalletErrorType.CONNECTION_REJECTED,
        message:
          'No account found in Blade wallet. Please set up your Blade wallet first.',
      });
    });

    it('should handle unknown errors', async () => {
      const error = 'Unknown error type';
      mockBlade.getAccountInfo.mockRejectedValue(error);

      await expect(adapter.connect()).rejects.toMatchObject({
        type: WalletErrorType.UNKNOWN_ERROR,
        message: 'An unknown Blade error occurred',
      });
    });

    it('should pass through existing WalletError objects', async () => {
      const walletError = {
        type: WalletErrorType.NETWORK_ERROR,
        message: 'Custom network error',
        details: { custom: 'data' },
      };
      mockBlade.getAccountInfo.mockRejectedValue(walletError);

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

      const mockAccountInfo = {
        accountId: '0.0.54321',
        evmAddress: '0x1234567890abcdef',
      };
      mockBlade.getAccountInfo.mockResolvedValue(mockAccountInfo);

      await adapter.connect();

      expect(adapter.isConnected()).toBe(true);
      expect(adapter.getConnection()).toEqual({
        accountId: '0.0.54321',
        network: 'testnet',
        isConnected: true,
      });

      await adapter.disconnect();

      expect(adapter.isConnected()).toBe(false);
      expect(adapter.getConnection()).toBeNull();
    });
  });

  describe('Cleanup', () => {
    it('should clean up Blade-specific resources on disconnect', async () => {
      const mockAccountInfo = {
        accountId: '0.0.54321',
        evmAddress: '0x1234567890abcdef',
      };
      mockBlade.getAccountInfo.mockResolvedValue(mockAccountInfo);

      await adapter.connect();
      expect((adapter as any).blade).toBeTruthy();
      expect((adapter as any).currentAccountId).toBe('0.0.54321');

      await adapter.disconnect();
      expect((adapter as any).blade).toBeNull();
      expect((adapter as any).currentAccountId).toBeNull();
    });
  });
});
