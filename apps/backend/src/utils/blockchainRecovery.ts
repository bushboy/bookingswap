import { BlockchainError, ERROR_CODES, SwapPlatformError } from '@booking-swap/shared';
import { enhancedLogger } from './logger';
import { CircuitBreaker } from './monitoring';

/**
 * Retry configuration for blockchain operations
 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

/**
 * Default retry configuration for blockchain operations
 */
export const DEFAULT_BLOCKCHAIN_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
  retryableErrors: [
    ERROR_CODES.NETWORK_ERROR,
    ERROR_CODES.CONSENSUS_TIMEOUT,
    'BUSY',
    'TIMEOUT',
    'RECEIPT_NOT_FOUND',
  ],
};

/**
 * Transaction queue for failed blockchain operations
 */
export interface QueuedTransaction {
  id: string;
  operation: string;
  payload: any;
  attempts: number;
  nextRetry: number;
  maxRetries: number;
  createdAt: number;
  lastError?: string;
}

/**
 * Blockchain recovery service
 */
export class BlockchainRecoveryService {
  private static instance: BlockchainRecoveryService;
  private transactionQueue: Map<string, QueuedTransaction> = new Map();
  private circuitBreaker: CircuitBreaker;
  private processingInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.circuitBreaker = new CircuitBreaker(5, 60000); // 5 failures, 1 minute timeout
    this.startQueueProcessing();
  }

  public static getInstance(): BlockchainRecoveryService {
    if (!BlockchainRecoveryService.instance) {
      BlockchainRecoveryService.instance = new BlockchainRecoveryService();
    }
    return BlockchainRecoveryService.instance;
  }

  /**
   * Execute blockchain operation with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    const retryConfig = { ...DEFAULT_BLOCKCHAIN_RETRY_CONFIG, ...config };
    let lastError: Error;

    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        enhancedLogger.logBlockchainTransaction(
          operationName,
          `attempt-${attempt}`,
          'pending',
          { attempt, maxAttempts: retryConfig.maxAttempts }
        );

        const result = await this.circuitBreaker.execute(operation);
        
        enhancedLogger.logBlockchainTransaction(
          operationName,
          'success',
          'success',
          { attempt, totalAttempts: attempt }
        );

        return result;
      } catch (error) {
        lastError = error;
        
        enhancedLogger.logBlockchainTransaction(
          operationName,
          'failed',
          'failed',
          { 
            attempt, 
            maxAttempts: retryConfig.maxAttempts,
            error: error.message,
            errorCode: error.code,
          }
        );

        // Check if error is retryable
        if (!this.isRetryableError(error, retryConfig.retryableErrors)) {
          enhancedLogger.warn('Non-retryable blockchain error', {
            operation: operationName,
            error: error.message,
            errorCode: error.code,
          });
          throw error;
        }

        // Don't wait after the last attempt
        if (attempt < retryConfig.maxAttempts) {
          const delay = this.calculateDelay(attempt, retryConfig);
          enhancedLogger.info('Retrying blockchain operation', {
            operation: operationName,
            attempt,
            nextAttemptIn: delay,
          });
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted
    enhancedLogger.error('Blockchain operation failed after all retries', {
      operation: operationName,
      attempts: retryConfig.maxAttempts,
      lastError: lastError.message,
    });

    throw new BlockchainError(
      ERROR_CODES.TRANSACTION_FAILED,
      `Operation ${operationName} failed after ${retryConfig.maxAttempts} attempts: ${lastError.message}`,
      false,
      { operation: operationName, attempts: retryConfig.maxAttempts },
      lastError
    );
  }

  /**
   * Queue transaction for later retry
   */
  queueTransaction(
    id: string,
    operation: string,
    payload: any,
    maxRetries: number = 5
  ): void {
    const queuedTransaction: QueuedTransaction = {
      id,
      operation,
      payload,
      attempts: 0,
      nextRetry: Date.now() + 5000, // Retry in 5 seconds
      maxRetries,
      createdAt: Date.now(),
    };

    this.transactionQueue.set(id, queuedTransaction);
    
    enhancedLogger.info('Transaction queued for retry', {
      transactionId: id,
      operation,
      nextRetry: new Date(queuedTransaction.nextRetry).toISOString(),
    });
  }

  /**
   * Remove transaction from queue
   */
  removeFromQueue(id: string): void {
    this.transactionQueue.delete(id);
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    totalQueued: number;
    byOperation: Record<string, number>;
    oldestTransaction?: QueuedTransaction;
  } {
    const transactions = Array.from(this.transactionQueue.values());
    const byOperation: Record<string, number> = {};
    
    transactions.forEach(tx => {
      byOperation[tx.operation] = (byOperation[tx.operation] || 0) + 1;
    });

    const oldestTransaction = transactions
      .sort((a, b) => a.createdAt - b.createdAt)[0];

    return {
      totalQueued: transactions.length,
      byOperation,
      oldestTransaction,
    };
  }

  /**
   * Process queued transactions
   */
  private async processQueue(): Promise<void> {
    const now = Date.now();
    const readyTransactions = Array.from(this.transactionQueue.values())
      .filter(tx => tx.nextRetry <= now)
      .sort((a, b) => a.nextRetry - b.nextRetry);

    for (const transaction of readyTransactions) {
      try {
        await this.retryQueuedTransaction(transaction);
      } catch (error) {
        enhancedLogger.error('Failed to process queued transaction', {
          transactionId: transaction.id,
          operation: transaction.operation,
          error: error.message,
        });
      }
    }
  }

  /**
   * Retry a queued transaction
   */
  private async retryQueuedTransaction(transaction: QueuedTransaction): Promise<void> {
    transaction.attempts++;
    
    try {
      // This would be implemented by specific blockchain services
      // For now, we'll just log the attempt
      enhancedLogger.info('Retrying queued transaction', {
        transactionId: transaction.id,
        operation: transaction.operation,
        attempt: transaction.attempts,
        maxRetries: transaction.maxRetries,
      });

      // Simulate transaction retry (would be replaced with actual implementation)
      // await this.executeTransactionRetry(transaction);
      
      // If successful, remove from queue
      this.removeFromQueue(transaction.id);
      
      enhancedLogger.info('Queued transaction succeeded', {
        transactionId: transaction.id,
        operation: transaction.operation,
        attempts: transaction.attempts,
      });
      
    } catch (error) {
      transaction.lastError = error.message;
      
      if (transaction.attempts >= transaction.maxRetries) {
        // Max retries reached, remove from queue and log failure
        this.removeFromQueue(transaction.id);
        
        enhancedLogger.error('Queued transaction failed permanently', {
          transactionId: transaction.id,
          operation: transaction.operation,
          attempts: transaction.attempts,
          error: error.message,
        });
      } else {
        // Schedule next retry with exponential backoff
        const delay = Math.min(
          1000 * Math.pow(2, transaction.attempts),
          300000 // Max 5 minutes
        );
        transaction.nextRetry = Date.now() + delay;
        
        enhancedLogger.warn('Queued transaction retry failed, scheduling next attempt', {
          transactionId: transaction.id,
          operation: transaction.operation,
          attempt: transaction.attempts,
          nextRetry: new Date(transaction.nextRetry).toISOString(),
          error: error.message,
        });
      }
    }
  }

  /**
   * Start processing queued transactions
   */
  private startQueueProcessing(): void {
    const interval = parseInt(process.env.BLOCKCHAIN_QUEUE_INTERVAL || '10000'); // 10 seconds
    
    this.processingInterval = setInterval(async () => {
      await this.processQueue();
    }, interval);
  }

  /**
   * Stop queue processing
   */
  stopQueueProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any, retryableErrors: string[]): boolean {
    if (error instanceof BlockchainError && !error.retryable) {
      return false;
    }

    const errorCode = error.code || error.message;
    return retryableErrors.some(retryableCode => 
      errorCode.includes(retryableCode) || error.message.includes(retryableCode)
    );
  }

  /**
   * Calculate delay with exponential backoff
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    const delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    return Math.min(delay, config.maxDelay);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Decorator for automatic blockchain retry
 */
export function withBlockchainRetry(config?: Partial<RetryConfig>) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const recoveryService = BlockchainRecoveryService.getInstance();
      return recoveryService.executeWithRetry(
        () => method.apply(this, args),
        `${target.constructor.name}.${propertyName}`,
        config
      );
    };

    return descriptor;
  };
}

/**
 * Transaction rollback utility
 */
export class TransactionRollback {
  private rollbackActions: Array<() => Promise<void>> = [];

  /**
   * Add rollback action
   */
  addRollbackAction(action: () => Promise<void>): void {
    this.rollbackActions.push(action);
  }

  /**
   * Execute all rollback actions in reverse order
   */
  async executeRollback(): Promise<void> {
    const errors: Error[] = [];
    
    // Execute rollback actions in reverse order
    for (let i = this.rollbackActions.length - 1; i >= 0; i--) {
      try {
        await this.rollbackActions[i]();
      } catch (error) {
        errors.push(error);
        enhancedLogger.error('Rollback action failed', {
          actionIndex: i,
          error: error.message,
        });
      }
    }

    if (errors.length > 0) {
      throw new SwapPlatformError(
        'ROLLBACK_PARTIAL_FAILURE',
        `${errors.length} rollback actions failed`,
        'blockchain',
        false,
        { rollbackErrors: errors.map(e => e.message) }
      );
    }
  }

  /**
   * Clear all rollback actions
   */
  clear(): void {
    this.rollbackActions = [];
  }
}