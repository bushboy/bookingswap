import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  WalletErrorHandler,
  createWalletError,
  isWalletError,
  inferWalletErrorType,
  getWalletErrorDisplayInfo,
  formatWalletErrorForUser,
  createWalletRetryHandler,
  isWalletErrorRetryable,
  getProviderErrorHandler,
  WALLET_ERROR_MESSAGES,
  WALLET_RETRY_CONFIG,
} from '../walletErrorHandling';
import { WalletErrorType } from '../../types/wallet';

describe('walletErrorHandling', () => {
  describe('createWalletError', () => {
    it('should create a wallet error with type and message', () => {
      const error = createWalletError(
        WalletErrorType.PROVIDER_NOT_FOUND,
        'Test message'
      );

      expect(error).toEqual({
        type: WalletErrorType.PROVIDER_NOT_FOUND,
        message: 'Test message',
        details: undefined,
      });
    });

    it('should create a wallet error with details', () => {
      const details = { providerId: 'hashpack' };
      const error = createWalletError(
        WalletErrorType.PROVIDER_NOT_FOUND,
        'Test message',
        details
      );

      expect(error).toEqual({
        type: WalletErrorType.PROVIDER_NOT_FOUND,
        message: 'Test message',
        details,
      });
    });
  });

  describe('isWalletError', () => {
    it('should return true for valid wallet errors', () => {
      const error = createWalletError(
        WalletErrorType.PROVIDER_NOT_FOUND,
        'Test'
      );
      expect(isWalletError(error)).toBe(true);
    });

    it('should return false for generic errors', () => {
      const error = new Error('Test error');
      expect(isWalletError(error)).toBe(false);
    });

    it('should return false for invalid objects', () => {
      expect(isWalletError({})).toBe(false);
      expect(isWalletError(null)).toBe(false);
      expect(isWalletError(undefined)).toBe(false);
      expect(isWalletError('string')).toBe(false);
    });
  });

  describe('inferWalletErrorType', () => {
    it('should infer CONNECTION_REJECTED from user rejection messages', () => {
      const error1 = new Error('User rejected the connection');
      const error2 = new Error('User denied access');

      expect(inferWalletErrorType(error1)).toBe(
        WalletErrorType.CONNECTION_REJECTED
      );
      expect(inferWalletErrorType(error2)).toBe(
        WalletErrorType.CONNECTION_REJECTED
      );
    });

    it('should infer WALLET_LOCKED from lock messages', () => {
      const error1 = new Error('Wallet is locked');
      const error2 = new Error('Please unlock your wallet');

      expect(inferWalletErrorType(error1)).toBe(WalletErrorType.WALLET_LOCKED);
      expect(inferWalletErrorType(error2)).toBe(WalletErrorType.WALLET_LOCKED);
    });

    it('should infer WRONG_NETWORK from network messages', () => {
      const error1 = new Error('Wrong network selected');
      const error2 = new Error('Invalid chain ID');

      expect(inferWalletErrorType(error1)).toBe(WalletErrorType.WRONG_NETWORK);
      expect(inferWalletErrorType(error2)).toBe(WalletErrorType.WRONG_NETWORK);
    });

    it('should infer PROVIDER_NOT_FOUND from availability messages', () => {
      const error1 = new Error('Provider not found');
      const error2 = new Error('Extension not installed');
      const error3 = new Error('Wallet not available');

      expect(inferWalletErrorType(error1)).toBe(
        WalletErrorType.PROVIDER_NOT_FOUND
      );
      expect(inferWalletErrorType(error2)).toBe(
        WalletErrorType.PROVIDER_NOT_FOUND
      );
      expect(inferWalletErrorType(error3)).toBe(
        WalletErrorType.PROVIDER_NOT_FOUND
      );
    });

    it('should infer NETWORK_ERROR from connection messages', () => {
      const error1 = new Error('Connection timeout');
      const error2 = new Error('Fetch failed');

      expect(inferWalletErrorType(error1)).toBe(WalletErrorType.NETWORK_ERROR);
      expect(inferWalletErrorType(error2)).toBe(WalletErrorType.NETWORK_ERROR);
    });

    it('should return null for unrecognized error messages', () => {
      const error = new Error('Some random error');
      expect(inferWalletErrorType(error)).toBe(null);
    });
  });

  describe('getWalletErrorDisplayInfo', () => {
    it('should return display info for wallet errors', () => {
      const error = createWalletError(
        WalletErrorType.PROVIDER_NOT_FOUND,
        'Test message'
      );
      const displayInfo = getWalletErrorDisplayInfo(error);

      expect(displayInfo.title).toBe(
        WALLET_ERROR_MESSAGES[WalletErrorType.PROVIDER_NOT_FOUND].title
      );
      expect(displayInfo.message).toBe(
        WALLET_ERROR_MESSAGES[WalletErrorType.PROVIDER_NOT_FOUND].message
      );
      expect(displayInfo.retryable).toBe(false);
      expect(displayInfo.severity).toBe('error');
    });

    it('should infer error type for generic errors', () => {
      const error = new Error('User rejected the connection');
      const displayInfo = getWalletErrorDisplayInfo(error);

      expect(displayInfo.title).toBe(
        WALLET_ERROR_MESSAGES[WalletErrorType.CONNECTION_REJECTED].title
      );
      expect(displayInfo.severity).toBe('warning');
    });

    it('should provide fallback for unknown errors', () => {
      const error = new Error('Unknown error');
      const displayInfo = getWalletErrorDisplayInfo(error);

      expect(displayInfo.title).toBe('Wallet Error');
      expect(displayInfo.retryable).toBe(true);
      expect(displayInfo.severity).toBe('error');
    });
  });

  describe('formatWalletErrorForUser', () => {
    it('should format wallet error with actions', () => {
      const error = createWalletError(
        WalletErrorType.CONNECTION_REJECTED,
        'Test message'
      );
      const formatted = formatWalletErrorForUser(error);

      expect(formatted.title).toBe(
        WALLET_ERROR_MESSAGES[WalletErrorType.CONNECTION_REJECTED].title
      );
      expect(formatted.actions).toHaveLength(1);
      expect(formatted.actions[0].action).toBe('retry_connection');
      expect(formatted.severity).toBe('warning');
    });

    it('should include explanation in formatted error', () => {
      const error = createWalletError(
        WalletErrorType.PROVIDER_NOT_FOUND,
        'Test message'
      );
      const formatted = formatWalletErrorForUser(error);

      expect(formatted.explanation).toBeDefined();
      expect(formatted.explanation).toBe(
        WALLET_ERROR_MESSAGES[WalletErrorType.PROVIDER_NOT_FOUND].explanation
      );
    });
  });

  describe('WalletErrorHandler', () => {
    describe('handleProviderError', () => {
      it('should create provider not found error', () => {
        const originalError = new Error('Provider not available');
        const walletError = WalletErrorHandler.handleProviderError(
          originalError,
          'hashpack'
        );

        expect(walletError.type).toBe(WalletErrorType.PROVIDER_NOT_FOUND);
        expect(walletError.message).toContain('hashpack');
        expect(walletError.details.providerId).toBe('hashpack');
      });
    });

    describe('handleConnectionError', () => {
      it('should infer error type from message', () => {
        const originalError = new Error('User rejected the connection');
        const walletError = WalletErrorHandler.handleConnectionError(
          originalError,
          'hashpack'
        );

        expect(walletError.type).toBe(WalletErrorType.CONNECTION_REJECTED);
        expect(walletError.details.providerId).toBe('hashpack');
      });

      it('should default to unknown error for unrecognized messages', () => {
        const originalError = new Error('Random error');
        const walletError = WalletErrorHandler.handleConnectionError(
          originalError,
          'hashpack'
        );

        expect(walletError.type).toBe(WalletErrorType.UNKNOWN_ERROR);
        expect(walletError.message).toContain('hashpack');
      });
    });

    describe('handleNetworkError', () => {
      it('should create wrong network error with expected network', () => {
        const originalError = new Error('Wrong network');
        const walletError = WalletErrorHandler.handleNetworkError(
          originalError,
          'mainnet'
        );

        expect(walletError.type).toBe(WalletErrorType.WRONG_NETWORK);
        expect(walletError.message).toContain('mainnet');
        expect(walletError.details.expectedNetwork).toBe('mainnet');
      });

      it('should create network error without expected network', () => {
        const originalError = new Error('Network error');
        const walletError =
          WalletErrorHandler.handleNetworkError(originalError);

        expect(walletError.type).toBe(WalletErrorType.NETWORK_ERROR);
      });
    });

    describe('handleAccountError', () => {
      it('should detect locked wallet from message', () => {
        const originalError = new Error('Wallet is locked');
        const walletError =
          WalletErrorHandler.handleAccountError(originalError);

        expect(walletError.type).toBe(WalletErrorType.WALLET_LOCKED);
      });

      it('should default to unknown error for other messages', () => {
        const originalError = new Error('Account error');
        const walletError =
          WalletErrorHandler.handleAccountError(originalError);

        expect(walletError.type).toBe(WalletErrorType.UNKNOWN_ERROR);
      });
    });
  });

  describe('isWalletErrorRetryable', () => {
    it('should return true for retryable errors', () => {
      const error = createWalletError(
        WalletErrorType.NETWORK_ERROR,
        'Network error'
      );
      expect(isWalletErrorRetryable(error, 'connection')).toBe(true);
    });

    it('should return false for non-retryable errors', () => {
      const error = createWalletError(
        WalletErrorType.CONNECTION_REJECTED,
        'User rejected'
      );
      expect(isWalletErrorRetryable(error, 'connection')).toBe(false);
    });
  });

  describe('createWalletRetryHandler', () => {
    beforeEach(() => {
      vi.clearAllTimers();
      vi.useFakeTimers();
    });

    it('should retry retryable errors', async () => {
      const mockOperation = vi
        .fn()
        .mockRejectedValueOnce(
          createWalletError(WalletErrorType.NETWORK_ERROR, 'Network error')
        )
        .mockResolvedValueOnce('success');

      const retryHandler = createWalletRetryHandler('connection');

      const promise = retryHandler(mockOperation);

      // Fast-forward through the retry delay
      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-retryable errors', async () => {
      const mockOperation = vi
        .fn()
        .mockRejectedValue(
          createWalletError(
            WalletErrorType.CONNECTION_REJECTED,
            'User rejected'
          )
        );

      const retryHandler = createWalletRetryHandler('connection');

      await expect(retryHandler(mockOperation)).rejects.toThrow();
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should respect max retry limit', async () => {
      const mockOperation = vi
        .fn()
        .mockRejectedValue(
          createWalletError(WalletErrorType.NETWORK_ERROR, 'Network error')
        );

      const retryHandler = createWalletRetryHandler('connection');

      const promise = retryHandler(mockOperation);

      // Fast-forward through all retry attempts
      await vi.advanceTimersByTimeAsync(10000);

      await expect(promise).rejects.toThrow();
      expect(mockOperation).toHaveBeenCalledTimes(
        WALLET_RETRY_CONFIG.connection.maxRetries
      );
    });

    it('should use custom retry logic when provided', async () => {
      const mockOperation = vi
        .fn()
        .mockRejectedValue(
          createWalletError(
            WalletErrorType.CONNECTION_REJECTED,
            'User rejected'
          )
        );

      const customShouldRetry = vi.fn().mockReturnValue(true);
      const retryHandler = createWalletRetryHandler('connection');

      const promise = retryHandler(mockOperation, customShouldRetry);

      // Fast-forward through retry delay
      await vi.advanceTimersByTimeAsync(2000);

      await expect(promise).rejects.toThrow();
      expect(customShouldRetry).toHaveBeenCalledWith(
        expect.objectContaining({ type: WalletErrorType.CONNECTION_REJECTED }),
        1
      );
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });
  });

  describe('getProviderErrorHandler', () => {
    it('should return hashpack handler for hashpack provider', () => {
      const handler = getProviderErrorHandler('hashpack');

      expect(handler.getInstallUrl()).toContain('hashpack');

      const error = new Error('HashPack not found');
      const walletError = handler.handleSpecificErrors(error);

      expect(walletError).toBeTruthy();
      expect(walletError!.type).toBe(WalletErrorType.PROVIDER_NOT_FOUND);
    });

    it('should return blade handler for blade provider', () => {
      const handler = getProviderErrorHandler('blade');

      expect(handler.getInstallUrl()).toContain('blade');

      const error = new Error('Blade not found');
      const walletError = handler.handleSpecificErrors(error);

      expect(walletError).toBeTruthy();
      expect(walletError!.type).toBe(WalletErrorType.PROVIDER_NOT_FOUND);
    });

    it('should return default handler for unknown provider', () => {
      const handler = getProviderErrorHandler('unknown');

      expect(handler.detectInstallation()).toBe(false);
      expect(handler.getInstallUrl()).toBe('#');
      expect(handler.handleSpecificErrors(new Error('test'))).toBe(null);
    });
  });

  describe('WALLET_ERROR_MESSAGES', () => {
    it('should have messages for all error types', () => {
      const errorTypes = Object.values(WalletErrorType);

      errorTypes.forEach(errorType => {
        expect(WALLET_ERROR_MESSAGES[errorType]).toBeDefined();
        expect(WALLET_ERROR_MESSAGES[errorType].title).toBeTruthy();
        expect(WALLET_ERROR_MESSAGES[errorType].message).toBeTruthy();
        expect(WALLET_ERROR_MESSAGES[errorType].suggestion).toBeTruthy();
        expect(Array.isArray(WALLET_ERROR_MESSAGES[errorType].actions)).toBe(
          true
        );
      });
    });

    it('should have consistent severity levels', () => {
      Object.values(WALLET_ERROR_MESSAGES).forEach(message => {
        expect(['error', 'warning', 'info']).toContain(message.severity);
      });
    });
  });

  describe('WALLET_RETRY_CONFIG', () => {
    it('should have configuration for all operations', () => {
      const operations = ['connection', 'accountInfo', 'balance'] as const;

      operations.forEach(operation => {
        const config = WALLET_RETRY_CONFIG[operation];
        expect(config).toBeDefined();
        expect(typeof config.maxRetries).toBe('number');
        expect(typeof config.baseDelay).toBe('number');
        expect(typeof config.backoffMultiplier).toBe('number');
        expect(Array.isArray(config.retryableErrors)).toBe(true);
      });
    });

    it('should have valid retry configurations', () => {
      Object.values(WALLET_RETRY_CONFIG).forEach(config => {
        expect(config.maxRetries).toBeGreaterThan(0);
        expect(config.baseDelay).toBeGreaterThan(0);
        expect(config.backoffMultiplier).toBeGreaterThan(1);
        expect(config.retryableErrors.length).toBeGreaterThan(0);
      });
    });
  });
});
