import { 
  BlockchainRecoveryService, 
  withBlockchainRetry, 
  TransactionRollback,
  DEFAULT_BLOCKCHAIN_RETRY_CONFIG 
} from '../blockchainRecovery';
import { BlockchainError, ERROR_CODES, SwapPlatformError } from '@booking-swap/shared';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock logger
vi.mock('../logger', () => ({
  enhancedLogger: {
    logBlockchainTransaction: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Blockchain Recovery Service', () => {
  let recoveryService: BlockchainRecoveryService;

  beforeEach(() => {
    recoveryService = BlockchainRecoveryService.getInstance();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    recoveryService.stopQueueProcessing();
    vi.useRealTimers();
  });

  describe('executeWithRetry', () => {
    it('should execute operation successfully on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      
      const result = await recoveryService.executeWithRetry(
        operation,
        'test-operation'
      );
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(enhancedLogger.logBlockchainTransaction).toHaveBeenCalledWith(
        'test-operation',
        'success',
        'success',
        expect.any(Object)
      );
    });

    it('should retry retryable errors', async () => {
      const retryableError = new BlockchainError(
        ERROR_CODES.NETWORK_ERROR,
        'Network error',
        true
      );
      
      const operation = vi.fn()
        .mockRejectedValueOnce(retryableError)
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce('success');
      
      const result = await recoveryService.executeWithRetry(
        operation,
        'test-operation'
      );
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-retryable errors', async () => {
      const nonRetryableError = new BlockchainError(
        ERROR_CODES.INVALID_INPUT,
        'Invalid input',
        false
      );
      
      const operation = vi.fn().mockRejectedValue(nonRetryableError);
      
      await expect(
        recoveryService.executeWithRetry(operation, 'test-operation')
      ).rejects.toThrow(nonRetryableError);
      
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should fail after max retries', async () => {
      const retryableError = new BlockchainError(
        ERROR_CODES.NETWORK_ERROR,
        'Network error',
        true
      );
      
      const operation = vi.fn().mockRejectedValue(retryableError);
      
      await expect(
        recoveryService.executeWithRetry(operation, 'test-operation')
      ).rejects.toThrow('Operation test-operation failed after 3 attempts');
      
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should use custom retry configuration', async () => {
      const retryableError = new BlockchainError(
        ERROR_CODES.NETWORK_ERROR,
        'Network error',
        true
      );
      
      const operation = vi.fn().mockRejectedValue(retryableError);
      const customConfig = { maxAttempts: 5 };
      
      await expect(
        recoveryService.executeWithRetry(operation, 'test-operation', customConfig)
      ).rejects.toThrow('Operation test-operation failed after 5 attempts');
      
      expect(operation).toHaveBeenCalledTimes(5);
    });

    it('should wait between retries with exponential backoff', async () => {
      const retryableError = new BlockchainError(
        ERROR_CODES.NETWORK_ERROR,
        'Network error',
        true
      );
      
      const operation = vi.fn().mockRejectedValue(retryableError);
      
      const promise = recoveryService.executeWithRetry(operation, 'test-operation');
      
      // Fast-forward through delays
      vi.advanceTimersByTime(1000); // First retry delay
      vi.advanceTimersByTime(2000); // Second retry delay
      
      await expect(promise).rejects.toThrow();
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe('transaction queue', () => {
    it('should queue transactions for retry', () => {
      const transactionId = 'tx-123';
      const operation = 'swap-execution';
      const payload = { swapId: 'swap-123' };
      
      recoveryService.queueTransaction(transactionId, operation, payload);
      
      const queueStatus = recoveryService.getQueueStatus();
      expect(queueStatus.totalQueued).toBe(1);
      expect(queueStatus.byOperation[operation]).toBe(1);
    });

    it('should remove transactions from queue', () => {
      const transactionId = 'tx-123';
      
      recoveryService.queueTransaction(transactionId, 'test-op', {});
      expect(recoveryService.getQueueStatus().totalQueued).toBe(1);
      
      recoveryService.removeFromQueue(transactionId);
      expect(recoveryService.getQueueStatus().totalQueued).toBe(0);
    });

    it('should provide queue status', () => {
      recoveryService.queueTransaction('tx-1', 'swap-execution', {});
      recoveryService.queueTransaction('tx-2', 'swap-execution', {});
      recoveryService.queueTransaction('tx-3', 'booking-creation', {});
      
      const status = recoveryService.getQueueStatus();
      
      expect(status.totalQueued).toBe(3);
      expect(status.byOperation['swap-execution']).toBe(2);
      expect(status.byOperation['booking-creation']).toBe(1);
      expect(status.oldestTransaction).toBeDefined();
    });
  });

  describe('withBlockchainRetry decorator', () => {
    it('should retry decorated methods', async () => {
      class TestService {
        @withBlockchainRetry()
        async testMethod() {
          throw new BlockchainError(ERROR_CODES.NETWORK_ERROR, 'Network error', true);
        }
      }
      
      const service = new TestService();
      
      await expect(service.testMethod()).rejects.toThrow();
      
      // Verify retry attempts were made
      expect(enhancedLogger.logBlockchainTransaction).toHaveBeenCalledTimes(3);
    });

    it('should use custom retry config in decorator', async () => {
      class TestService {
        @withBlockchainRetry({ maxAttempts: 2 })
        async testMethod() {
          throw new BlockchainError(ERROR_CODES.NETWORK_ERROR, 'Network error', true);
        }
      }
      
      const service = new TestService();
      
      await expect(service.testMethod()).rejects.toThrow();
      
      // Should only attempt twice
      expect(enhancedLogger.logBlockchainTransaction).toHaveBeenCalledTimes(2);
    });
  });

  describe('TransactionRollback', () => {
    it('should execute rollback actions in reverse order', async () => {
      const rollback = new TransactionRollback();
      const actions: string[] = [];
      
      rollback.addRollbackAction(async () => {
        actions.push('action1');
      });
      
      rollback.addRollbackAction(async () => {
        actions.push('action2');
      });
      
      rollback.addRollbackAction(async () => {
        actions.push('action3');
      });
      
      await rollback.executeRollback();
      
      expect(actions).toEqual(['action3', 'action2', 'action1']);
    });

    it('should handle rollback action failures', async () => {
      const rollback = new TransactionRollback();
      
      rollback.addRollbackAction(async () => {
        // Success
      });
      
      rollback.addRollbackAction(async () => {
        throw new Error('Rollback failed');
      });
      
      rollback.addRollbackAction(async () => {
        // Success
      });
      
      await expect(rollback.executeRollback()).rejects.toThrow('1 rollback actions failed');
      
      expect(enhancedLogger.error).toHaveBeenCalledWith(
        'Rollback action failed',
        expect.objectContaining({
          actionIndex: 1,
          error: 'Rollback failed',
        })
      );
    });

    it('should clear rollback actions', () => {
      const rollback = new TransactionRollback();
      
      rollback.addRollbackAction(async () => {});
      rollback.addRollbackAction(async () => {});
      
      rollback.clear();
      
      // Should not execute any actions after clear
      expect(async () => {
        await rollback.executeRollback();
      }).not.toThrow();
    });
  });

  describe('error classification', () => {
    it('should identify retryable errors correctly', async () => {
      const retryableErrors = [
        new BlockchainError(ERROR_CODES.NETWORK_ERROR, 'Network error', true),
        new BlockchainError(ERROR_CODES.CONSENSUS_TIMEOUT, 'Timeout', true),
        { code: 'BUSY', message: 'Service busy' },
        { message: 'TIMEOUT occurred' },
      ];
      
      for (const error of retryableErrors) {
        const operation = vi.fn().mockRejectedValue(error);
        
        await expect(
          recoveryService.executeWithRetry(operation, 'test-operation')
        ).rejects.toThrow();
        
        // Should have attempted retries
        expect(operation).toHaveBeenCalledTimes(3);
        
        // Reset for next test
        operation.mockClear();
      }
    });

    it('should identify non-retryable errors correctly', async () => {
      const nonRetryableErrors = [
        new BlockchainError(ERROR_CODES.INVALID_INPUT, 'Invalid input', false),
        new SwapPlatformError(ERROR_CODES.VALIDATION_ERROR, 'Validation error', 'validation'),
        { code: 'INVALID_SIGNATURE', message: 'Invalid signature' },
      ];
      
      for (const error of nonRetryableErrors) {
        const operation = vi.fn().mockRejectedValue(error);
        
        await expect(
          recoveryService.executeWithRetry(operation, 'test-operation')
        ).rejects.toThrow();
        
        // Should not have retried
        expect(operation).toHaveBeenCalledTimes(1);
        
        // Reset for next test
        operation.mockClear();
      }
    });
  });
});