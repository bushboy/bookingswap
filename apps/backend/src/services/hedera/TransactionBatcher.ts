import { HederaService, TransactionData, TransactionResult } from './HederaService';
import { logger } from '../../utils/logger';

export interface BatchConfig {
  maxBatchSize: number;
  batchTimeout: number; // milliseconds
  retryAttempts: number;
  retryDelay: number; // milliseconds
}

export interface BatchedTransaction {
  id: string;
  data: TransactionData;
  resolve: (result: TransactionResult) => void;
  reject: (error: Error) => void;
  timestamp: number;
  retryCount: number;
}

export interface BatchResult {
  successful: TransactionResult[];
  failed: Array<{ transaction: BatchedTransaction; error: Error }>;
  batchId: string;
  processingTime: number;
}

export class TransactionBatcher {
  private hederaService: HederaService;
  private config: BatchConfig;
  private pendingTransactions: BatchedTransaction[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private batchCounter = 0;

  constructor(hederaService: HederaService, config: BatchConfig) {
    this.hederaService = hederaService;
    this.config = config;
  }

  /**
   * Add transaction to batch queue
   */
  async submitTransaction(data: TransactionData): Promise<TransactionResult> {
    return new Promise((resolve, reject) => {
      const transaction: BatchedTransaction = {
        id: this.generateTransactionId(),
        data,
        resolve,
        reject,
        timestamp: Date.now(),
        retryCount: 0,
      };

      this.pendingTransactions.push(transaction);
      
      logger.debug('Transaction added to batch', {
        transactionId: transaction.id,
        queueSize: this.pendingTransactions.length,
      });

      // Start batch timer if not already running
      this.scheduleBatchProcessing();

      // Process immediately if batch is full
      if (this.pendingTransactions.length >= this.config.maxBatchSize) {
        this.processBatch();
      }
    });
  }

  /**
   * Schedule batch processing
   */
  private scheduleBatchProcessing(): void {
    if (this.batchTimer || this.isProcessing) {
      return;
    }

    this.batchTimer = setTimeout(() => {
      this.processBatch();
    }, this.config.batchTimeout);
  }

  /**
   * Process current batch of transactions
   */
  private async processBatch(): Promise<void> {
    if (this.isProcessing || this.pendingTransactions.length === 0) {
      return;
    }

    this.isProcessing = true;
    
    // Clear the timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    const batchId = `batch_${++this.batchCounter}_${Date.now()}`;
    const batch = this.pendingTransactions.splice(0, this.config.maxBatchSize);
    const startTime = Date.now();

    logger.info('Processing transaction batch', {
      batchId,
      batchSize: batch.length,
    });

    try {
      const result = await this.executeBatch(batch, batchId);
      
      const processingTime = Date.now() - startTime;
      
      logger.info('Batch processing completed', {
        batchId,
        successful: result.successful.length,
        failed: result.failed.length,
        processingTime,
      });

      // Handle successful transactions
      result.successful.forEach((txResult, index) => {
        const transaction = batch[index];
        if (transaction) {
          transaction.resolve(txResult);
        }
      });

      // Handle failed transactions
      for (const { transaction, error } of result.failed) {
        await this.handleFailedTransaction(transaction, error);
      }

    } catch (error) {
      logger.error('Batch processing failed', { error, batchId });
      
      // Reject all transactions in the batch
      batch.forEach(transaction => {
        transaction.reject(new Error(`Batch processing failed: ${error.message}`));
      });
    } finally {
      this.isProcessing = false;
      
      // Schedule next batch if there are pending transactions
      if (this.pendingTransactions.length > 0) {
        this.scheduleBatchProcessing();
      }
    }
  }

  /**
   * Execute a batch of transactions
   */
  private async executeBatch(batch: BatchedTransaction[], batchId: string): Promise<BatchResult> {
    const successful: TransactionResult[] = [];
    const failed: Array<{ transaction: BatchedTransaction; error: Error }> = [];
    const startTime = Date.now();

    // Group transactions by type for optimal processing
    const groupedTransactions = this.groupTransactionsByType(batch);

    for (const [type, transactions] of Object.entries(groupedTransactions)) {
      logger.debug('Processing transaction group', {
        batchId,
        type,
        count: transactions.length,
      });

      // Process transactions of the same type together
      const groupResults = await this.processTransactionGroup(transactions, type);
      
      successful.push(...groupResults.successful);
      failed.push(...groupResults.failed);
    }

    const processingTime = Date.now() - startTime;

    return {
      successful,
      failed,
      batchId,
      processingTime,
    };
  }

  /**
   * Group transactions by type for optimized processing
   */
  private groupTransactionsByType(batch: BatchedTransaction[]): Record<string, BatchedTransaction[]> {
    const groups: Record<string, BatchedTransaction[]> = {};

    batch.forEach(transaction => {
      const type = transaction.data.type;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(transaction);
    });

    return groups;
  }

  /**
   * Process a group of transactions of the same type
   */
  private async processTransactionGroup(
    transactions: BatchedTransaction[],
    type: string
  ): Promise<{
    successful: TransactionResult[];
    failed: Array<{ transaction: BatchedTransaction; error: Error }>;
  }> {
    const successful: TransactionResult[] = [];
    const failed: Array<{ transaction: BatchedTransaction; error: Error }> = [];

    // Use different strategies based on transaction type
    switch (type) {
      case 'booking_listing':
      case 'swap_proposal':
        // These can be processed in parallel
        await this.processTransactionsInParallel(transactions, successful, failed);
        break;
      
      case 'swap_execution':
        // These need sequential processing to avoid conflicts
        await this.processTransactionsSequentially(transactions, successful, failed);
        break;
      
      default:
        // Default to parallel processing
        await this.processTransactionsInParallel(transactions, successful, failed);
        break;
    }

    return { successful, failed };
  }

  /**
   * Process transactions in parallel
   */
  private async processTransactionsInParallel(
    transactions: BatchedTransaction[],
    successful: TransactionResult[],
    failed: Array<{ transaction: BatchedTransaction; error: Error }>
  ): Promise<void> {
    const promises = transactions.map(async (transaction) => {
      try {
        const result = await this.hederaService.submitTransaction(transaction.data);
        successful.push(result);
        return { transaction, result };
      } catch (error) {
        failed.push({ transaction, error: error as Error });
        return { transaction, error };
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Process transactions sequentially
   */
  private async processTransactionsSequentially(
    transactions: BatchedTransaction[],
    successful: TransactionResult[],
    failed: Array<{ transaction: BatchedTransaction; error: Error }>
  ): Promise<void> {
    for (const transaction of transactions) {
      try {
        const result = await this.hederaService.submitTransaction(transaction.data);
        successful.push(result);
      } catch (error) {
        failed.push({ transaction, error: error as Error });
      }
    }
  }

  /**
   * Handle failed transaction with retry logic
   */
  private async handleFailedTransaction(
    transaction: BatchedTransaction,
    error: Error
  ): Promise<void> {
    transaction.retryCount++;

    if (transaction.retryCount <= this.config.retryAttempts) {
      logger.warn('Retrying failed transaction', {
        transactionId: transaction.id,
        retryCount: transaction.retryCount,
        error: error.message,
      });

      // Add delay before retry
      setTimeout(() => {
        this.pendingTransactions.unshift(transaction); // Add to front of queue
        this.scheduleBatchProcessing();
      }, this.config.retryDelay * transaction.retryCount);
    } else {
      logger.error('Transaction failed after max retries', {
        transactionId: transaction.id,
        retryCount: transaction.retryCount,
        error: error.message,
      });
      
      transaction.reject(new Error(`Transaction failed after ${this.config.retryAttempts} retries: ${error.message}`));
    }
  }

  /**
   * Generate unique transaction ID
   */
  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current queue status
   */
  getQueueStatus(): {
    pendingCount: number;
    isProcessing: boolean;
    nextBatchIn: number | null;
  } {
    const nextBatchIn = this.batchTimer 
      ? this.config.batchTimeout - (Date.now() - (this.batchTimer as any)._idleStart)
      : null;

    return {
      pendingCount: this.pendingTransactions.length,
      isProcessing: this.isProcessing,
      nextBatchIn,
    };
  }

  /**
   * Force process current batch
   */
  async flushBatch(): Promise<void> {
    if (this.pendingTransactions.length > 0) {
      await this.processBatch();
    }
  }

  /**
   * Clear all pending transactions
   */
  clearQueue(): void {
    const clearedTransactions = this.pendingTransactions.splice(0);
    
    clearedTransactions.forEach(transaction => {
      transaction.reject(new Error('Transaction queue cleared'));
    });

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    logger.info('Transaction queue cleared', {
      clearedCount: clearedTransactions.length,
    });
  }

  /**
   * Get batch statistics
   */
  getStatistics(): {
    totalBatches: number;
    averageBatchSize: number;
    currentQueueSize: number;
  } {
    return {
      totalBatches: this.batchCounter,
      averageBatchSize: 0, // Would need to track this over time
      currentQueueSize: this.pendingTransactions.length,
    };
  }

  /**
   * Shutdown the batcher gracefully
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down transaction batcher');
    
    // Process remaining transactions
    await this.flushBatch();
    
    // Clear any remaining timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    logger.info('Transaction batcher shutdown complete');
  }
}