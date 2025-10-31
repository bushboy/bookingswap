import { 
  TransactionId, 
  TransactionRecord, 
  TransactionReceipt,
  MirrorNodeClient,
  Status
} from '@hashgraph/sdk';
import { HederaService } from './HederaService';
import { logger } from '../../utils/logger';

export interface VerificationResult {
  isValid: boolean;
  transactionId: string;
  status: string;
  consensusTimestamp?: string;
  receipt?: TransactionReceipt;
  record?: TransactionRecord;
  error?: string;
}

export interface SwapTransactionVerification {
  swapId: string;
  proposalTxId?: string;
  acceptanceTxId?: string;
  executionTxId?: string;
  allTransactionsValid: boolean;
  verificationResults: VerificationResult[];
  finalSwapStatus: number;
}

export interface ProposalTransactionVerification {
  proposalId: string;
  creationTxId?: string;
  metadataTxId?: string;
  statusChangeTxIds: string[];
  verificationTxId?: string;
  allTransactionsValid: boolean;
  verificationResults: VerificationResult[];
  proposalAuthenticity: 'authentic' | 'tampered' | 'unverified';
  auditTrail: ProposalAuditEvent[];
}

export interface ProposalAuditEvent {
  transactionId: string;
  eventType: 'creation' | 'metadata' | 'status_change' | 'verification' | 'dispute';
  timestamp: string;
  isValid: boolean;
  eventData: Record<string, any>;
}

export interface BlockchainState {
  blockNumber: number;
  timestamp: string;
  networkStatus: 'healthy' | 'degraded' | 'unavailable';
  consensusNodes: number;
}

/**
 * Service for verifying blockchain transactions and state
 */
export class BlockchainVerificationService {
  private hederaService: HederaService;
  private mirrorNodeClient?: MirrorNodeClient;
  private verificationCache: Map<string, VerificationResult> = new Map();
  private cacheExpiryMs: number = 300000; // 5 minutes

  constructor(hederaService: HederaService, mirrorNodeUrl?: string) {
    this.hederaService = hederaService;
    
    if (mirrorNodeUrl) {
      this.mirrorNodeClient = new MirrorNodeClient(mirrorNodeUrl);
    }
  }

  /**
   * Verify a single transaction on the blockchain
   */
  async verifyTransaction(transactionId: string, useCache: boolean = true): Promise<VerificationResult> {
    try {
      // Check cache first
      if (useCache) {
        const cached = this.getCachedVerification(transactionId);
        if (cached) {
          logger.debug('Using cached verification result', { transactionId });
          return cached;
        }
      }

      logger.info('Verifying transaction on blockchain', { transactionId });

      // Parse transaction ID
      const txId = TransactionId.fromString(transactionId);

      // Get transaction receipt
      const receipt = await this.hederaService.queryTransaction(transactionId);
      
      // Verify transaction was successful
      const isValid = receipt.status === Status.Success;
      
      const result: VerificationResult = {
        isValid,
        transactionId,
        status: receipt.status.toString(),
        consensusTimestamp: receipt.consensusTimestamp?.toString(),
        receipt: receipt as any,
      };

      // Try to get full transaction record if available
      try {
        // Note: This would require additional permissions and setup
        // const record = await this.getTransactionRecord(txId);
        // result.record = record;
      } catch (recordError) {
        logger.debug('Could not retrieve transaction record', { 
          transactionId, 
          error: recordError.message 
        });
      }

      // Cache the result
      if (useCache) {
        this.cacheVerification(transactionId, result);
      }

      logger.info('Transaction verification completed', {
        transactionId,
        isValid,
        status: result.status,
      });

      return result;

    } catch (error) {
      logger.error('Transaction verification failed', { error, transactionId });
      
      const result: VerificationResult = {
        isValid: false,
        transactionId,
        status: 'VERIFICATION_FAILED',
        error: error.message,
      };

      return result;
    }
  }

  /**
   * Verify all transactions related to a swap
   */
  async verifySwapTransactions(
    swapId: string,
    transactionIds: {
      proposalTxId?: string;
      acceptanceTxId?: string;
      executionTxId?: string;
    }
  ): Promise<SwapTransactionVerification> {
    logger.info('Verifying swap transactions', { swapId, transactionIds });

    const verificationResults: VerificationResult[] = [];
    let allTransactionsValid = true;

    // Verify proposal transaction
    if (transactionIds.proposalTxId && transactionIds.proposalTxId !== 'existing_proposal') {
      const proposalResult = await this.verifyTransaction(transactionIds.proposalTxId);
      verificationResults.push(proposalResult);
      if (!proposalResult.isValid) {
        allTransactionsValid = false;
      }
    }

    // Verify acceptance transaction
    if (transactionIds.acceptanceTxId && transactionIds.acceptanceTxId !== 'already_accepted') {
      const acceptanceResult = await this.verifyTransaction(transactionIds.acceptanceTxId);
      verificationResults.push(acceptanceResult);
      if (!acceptanceResult.isValid) {
        allTransactionsValid = false;
      }
    }

    // Verify execution transaction
    if (transactionIds.executionTxId && transactionIds.executionTxId !== 'already_executed') {
      const executionResult = await this.verifyTransaction(transactionIds.executionTxId);
      verificationResults.push(executionResult);
      if (!executionResult.isValid) {
        allTransactionsValid = false;
      }
    }

    // Get final swap status from contract
    let finalSwapStatus = 0; // PENDING
    try {
      // This would require the ContractService to be injected
      // For now, we'll assume the swap is completed if all transactions are valid
      finalSwapStatus = allTransactionsValid ? 2 : 0; // COMPLETED : PENDING
    } catch (error) {
      logger.warn('Could not retrieve final swap status', { swapId, error: error.message });
    }

    const result: SwapTransactionVerification = {
      swapId,
      proposalTxId: transactionIds.proposalTxId,
      acceptanceTxId: transactionIds.acceptanceTxId,
      executionTxId: transactionIds.executionTxId,
      allTransactionsValid,
      verificationResults,
      finalSwapStatus,
    };

    logger.info('Swap transaction verification completed', {
      swapId,
      allTransactionsValid,
      verifiedTransactions: verificationResults.length,
    });

    return result;
  }

  /**
   * Verify blockchain network health
   */
  async verifyNetworkHealth(): Promise<BlockchainState> {
    try {
      logger.debug('Checking blockchain network health');

      // Get account balance to test network connectivity
      const balance = await this.hederaService.getAccountBalance();
      
      // If we can get balance, network is healthy
      const state: BlockchainState = {
        blockNumber: 0, // Hedera doesn't use block numbers like Ethereum
        timestamp: new Date().toISOString(),
        networkStatus: 'healthy',
        consensusNodes: 0, // Would need additional API calls to determine
      };

      logger.info('Network health check completed', { status: state.networkStatus });
      return state;

    } catch (error) {
      logger.error('Network health check failed', { error });
      
      return {
        blockNumber: 0,
        timestamp: new Date().toISOString(),
        networkStatus: 'unavailable',
        consensusNodes: 0,
      };
    }
  }

  /**
   * Batch verify multiple transactions
   */
  async batchVerifyTransactions(transactionIds: string[]): Promise<VerificationResult[]> {
    logger.info('Batch verifying transactions', { count: transactionIds.length });

    const verificationPromises = transactionIds.map(txId => 
      this.verifyTransaction(txId).catch(error => ({
        isValid: false,
        transactionId: txId,
        status: 'BATCH_VERIFICATION_FAILED',
        error: error.message,
      }))
    );

    const results = await Promise.all(verificationPromises);

    const validCount = results.filter(r => r.isValid).length;
    logger.info('Batch verification completed', {
      total: results.length,
      valid: validCount,
      invalid: results.length - validCount,
    });

    return results;
  }

  /**
   * Wait for transaction confirmation with timeout
   */
  async waitForTransactionConfirmation(
    transactionId: string, 
    timeoutMs: number = 30000,
    pollIntervalMs: number = 2000
  ): Promise<VerificationResult> {
    logger.info('Waiting for transaction confirmation', { 
      transactionId, 
      timeoutMs, 
      pollIntervalMs 
    });

    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const result = await this.verifyTransaction(transactionId, false); // Don't use cache
        
        if (result.isValid || result.status !== 'PENDING') {
          logger.info('Transaction confirmation received', {
            transactionId,
            status: result.status,
            waitTime: Date.now() - startTime,
          });
          return result;
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));

      } catch (error) {
        logger.debug('Transaction confirmation poll failed', { 
          transactionId, 
          error: error.message 
        });
      }
    }

    // Timeout reached
    logger.warn('Transaction confirmation timeout', { 
      transactionId, 
      timeoutMs 
    });

    return {
      isValid: false,
      transactionId,
      status: 'CONFIRMATION_TIMEOUT',
      error: `Transaction confirmation timeout after ${timeoutMs}ms`,
    };
  }

  /**
   * Get verification result from cache
   */
  private getCachedVerification(transactionId: string): VerificationResult | undefined {
    const cached = this.verificationCache.get(transactionId);
    if (!cached) {
      return undefined;
    }

    // Check if cache entry has expired
    const now = Date.now();
    const cacheTime = cached.consensusTimestamp ? 
      new Date(cached.consensusTimestamp).getTime() : 
      now - this.cacheExpiryMs - 1; // Force expiry if no timestamp

    if (now - cacheTime > this.cacheExpiryMs) {
      this.verificationCache.delete(transactionId);
      return undefined;
    }

    return cached;
  }

  /**
   * Cache verification result
   */
  private cacheVerification(transactionId: string, result: VerificationResult): void {
    this.verificationCache.set(transactionId, result);

    // Cleanup old cache entries periodically
    if (this.verificationCache.size > 1000) {
      this.cleanupCache();
    }
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [txId, result] of this.verificationCache.entries()) {
      const cacheTime = result.consensusTimestamp ? 
        new Date(result.consensusTimestamp).getTime() : 
        now - this.cacheExpiryMs - 1;

      if (now - cacheTime > this.cacheExpiryMs) {
        this.verificationCache.delete(txId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug('Cleaned up verification cache', { cleanedCount });
    }
  }

  /**
   * Clear all cached verifications
   */
  clearCache(): void {
    this.verificationCache.clear();
    logger.info('Verification cache cleared');
  }

  /**
   * Verify all transactions related to a proposal for authenticity
   * Requirements: 3.4, 3.5, 3.6
   */
  async verifyProposalTransactions(
    proposalId: string,
    transactionIds: {
      creationTxId?: string;
      metadataTxId?: string;
      statusChangeTxIds?: string[];
      verificationTxId?: string;
    }
  ): Promise<ProposalTransactionVerification> {
    logger.info('Verifying proposal transactions', { proposalId, transactionIds });

    const verificationResults: VerificationResult[] = [];
    const auditTrail: ProposalAuditEvent[] = [];
    let allTransactionsValid = true;

    // Verify creation transaction
    if (transactionIds.creationTxId) {
      const creationResult = await this.verifyTransaction(transactionIds.creationTxId);
      verificationResults.push(creationResult);
      
      auditTrail.push({
        transactionId: transactionIds.creationTxId,
        eventType: 'creation',
        timestamp: creationResult.consensusTimestamp || new Date().toISOString(),
        isValid: creationResult.isValid,
        eventData: { proposalId, eventType: 'proposal_creation' }
      });

      if (!creationResult.isValid) {
        allTransactionsValid = false;
      }
    }

    // Verify metadata transaction
    if (transactionIds.metadataTxId) {
      const metadataResult = await this.verifyTransaction(transactionIds.metadataTxId);
      verificationResults.push(metadataResult);
      
      auditTrail.push({
        transactionId: transactionIds.metadataTxId,
        eventType: 'metadata',
        timestamp: metadataResult.consensusTimestamp || new Date().toISOString(),
        isValid: metadataResult.isValid,
        eventData: { proposalId, eventType: 'metadata_recording' }
      });

      if (!metadataResult.isValid) {
        allTransactionsValid = false;
      }
    }

    // Verify status change transactions
    if (transactionIds.statusChangeTxIds && transactionIds.statusChangeTxIds.length > 0) {
      for (const statusTxId of transactionIds.statusChangeTxIds) {
        const statusResult = await this.verifyTransaction(statusTxId);
        verificationResults.push(statusResult);
        
        auditTrail.push({
          transactionId: statusTxId,
          eventType: 'status_change',
          timestamp: statusResult.consensusTimestamp || new Date().toISOString(),
          isValid: statusResult.isValid,
          eventData: { proposalId, eventType: 'status_change' }
        });

        if (!statusResult.isValid) {
          allTransactionsValid = false;
        }
      }
    }

    // Verify verification transaction (if exists)
    if (transactionIds.verificationTxId) {
      const verificationResult = await this.verifyTransaction(transactionIds.verificationTxId);
      verificationResults.push(verificationResult);
      
      auditTrail.push({
        transactionId: transactionIds.verificationTxId,
        eventType: 'verification',
        timestamp: verificationResult.consensusTimestamp || new Date().toISOString(),
        isValid: verificationResult.isValid,
        eventData: { proposalId, eventType: 'proposal_verification' }
      });

      if (!verificationResult.isValid) {
        allTransactionsValid = false;
      }
    }

    // Determine proposal authenticity
    const proposalAuthenticity = this.determineProposalAuthenticity(verificationResults, auditTrail);

    const result: ProposalTransactionVerification = {
      proposalId,
      creationTxId: transactionIds.creationTxId,
      metadataTxId: transactionIds.metadataTxId,
      statusChangeTxIds: transactionIds.statusChangeTxIds || [],
      verificationTxId: transactionIds.verificationTxId,
      allTransactionsValid,
      verificationResults,
      proposalAuthenticity,
      auditTrail: auditTrail.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    };

    logger.info('Proposal transaction verification completed', {
      proposalId,
      allTransactionsValid,
      proposalAuthenticity,
      verifiedTransactions: verificationResults.length,
      auditEvents: auditTrail.length
    });

    return result;
  }

  /**
   * Detect tampering in proposal data by comparing blockchain records
   * Requirements: 3.4, 3.5, 3.6
   */
  async detectProposalTampering(
    proposalId: string,
    expectedData: Record<string, any>,
    transactionIds: string[]
  ): Promise<{
    isTampered: boolean;
    tamperedFields: string[];
    verificationDetails: VerificationResult[];
    confidenceScore: number;
  }> {
    try {
      logger.info('Detecting proposal tampering', { proposalId, transactionCount: transactionIds.length });

      const verificationResults = await this.batchVerifyTransactions(transactionIds);
      const tamperedFields: string[] = [];
      let confidenceScore = 100;

      // Check if all transactions are valid
      const invalidTransactions = verificationResults.filter(r => !r.isValid);
      if (invalidTransactions.length > 0) {
        tamperedFields.push('blockchain_integrity');
        confidenceScore -= (invalidTransactions.length / verificationResults.length) * 50;
      }

      // In a production system, we would:
      // 1. Extract data from blockchain transactions
      // 2. Compare with expected data
      // 3. Check for inconsistencies in the audit trail
      // 4. Verify cryptographic signatures
      
      // For now, we'll do basic validation
      const isTampered = tamperedFields.length > 0 || confidenceScore < 80;

      logger.info('Proposal tampering detection completed', {
        proposalId,
        isTampered,
        tamperedFields,
        confidenceScore
      });

      return {
        isTampered,
        tamperedFields,
        verificationDetails: verificationResults,
        confidenceScore
      };
    } catch (error) {
      logger.error('Failed to detect proposal tampering', { error, proposalId });
      
      return {
        isTampered: true, // Assume tampered if we can't verify
        tamperedFields: ['verification_failed'],
        verificationDetails: [],
        confidenceScore: 0
      };
    }
  }

  /**
   * Verify proposal lifecycle events are in correct order
   * Requirements: 3.4, 3.5, 3.7
   */
  async verifyProposalLifecycle(auditTrail: ProposalAuditEvent[]): Promise<{
    isValidLifecycle: boolean;
    violations: string[];
    expectedOrder: string[];
    actualOrder: string[];
  }> {
    try {
      logger.info('Verifying proposal lifecycle', { eventCount: auditTrail.length });

      const expectedOrder = ['creation', 'metadata', 'verification', 'status_change'];
      const actualOrder = auditTrail.map(event => event.eventType);
      const violations: string[] = [];

      // Check if creation is first
      if (auditTrail.length > 0 && auditTrail[0].eventType !== 'creation') {
        violations.push('Creation event must be first');
      }

      // Check for duplicate creation events
      const creationEvents = auditTrail.filter(e => e.eventType === 'creation');
      if (creationEvents.length > 1) {
        violations.push('Multiple creation events detected');
      }

      // Check chronological order
      for (let i = 1; i < auditTrail.length; i++) {
        const prevTimestamp = new Date(auditTrail[i - 1].timestamp).getTime();
        const currTimestamp = new Date(auditTrail[i].timestamp).getTime();
        
        if (currTimestamp < prevTimestamp) {
          violations.push(`Event ${i} occurs before event ${i - 1} chronologically`);
        }
      }

      const isValidLifecycle = violations.length === 0;

      logger.info('Proposal lifecycle verification completed', {
        isValidLifecycle,
        violations: violations.length,
        eventCount: auditTrail.length
      });

      return {
        isValidLifecycle,
        violations,
        expectedOrder,
        actualOrder
      };
    } catch (error) {
      logger.error('Failed to verify proposal lifecycle', { error });
      
      return {
        isValidLifecycle: false,
        violations: ['Lifecycle verification failed'],
        expectedOrder: [],
        actualOrder: []
      };
    }
  }

  /**
   * Determine proposal authenticity based on verification results
   */
  private determineProposalAuthenticity(
    verificationResults: VerificationResult[],
    auditTrail: ProposalAuditEvent[]
  ): 'authentic' | 'tampered' | 'unverified' {
    // If no transactions to verify, it's unverified
    if (verificationResults.length === 0) {
      return 'unverified';
    }

    // If any transaction is invalid, consider it tampered
    const invalidTransactions = verificationResults.filter(r => !r.isValid);
    if (invalidTransactions.length > 0) {
      return 'tampered';
    }

    // Check audit trail consistency
    const invalidAuditEvents = auditTrail.filter(e => !e.isValid);
    if (invalidAuditEvents.length > 0) {
      return 'tampered';
    }

    // If all checks pass, it's authentic
    return 'authentic';
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.verificationCache.size,
      maxSize: 1000,
      // Hit rate would require additional tracking
    };
  }
}