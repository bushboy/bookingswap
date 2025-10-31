import { HederaService, ContractService, TransactionResult } from '../hedera';
import { logger } from '../../utils/logger';

export interface SwapExecutionRequest {
  swapId: string;
  sourceBookingId: string;
  targetBookingId: string;
  proposerAccountId: string;
  acceptorAccountId: string;
  additionalPayment?: number;
  expirationTime: number;
}

export interface SwapExecutionResult {
  success: boolean;
  swapId: string;
  transactionId?: string;
  consensusTimestamp?: string;
  error?: string;
  rollbackTransactionId?: string;
}

export interface SwapVerification {
  isValid: boolean;
  sourceBookingOwner: string;
  targetBookingOwner: string;
  swapStatus: number;
  errors: string[];
}

export enum SwapStatus {
  PENDING = 0,
  LOCKED = 1,
  COMPLETED = 2,
  CANCELLED = 3,
  DISPUTED = 4
}

export enum SwapExecutionStep {
  VALIDATION = 'validation',
  PROPOSAL = 'proposal',
  ACCEPTANCE = 'acceptance',
  EXECUTION = 'execution',
  VERIFICATION = 'verification',
  ROLLBACK = 'rollback'
}

export interface SwapExecutionContext {
  swapId: string;
  currentStep: SwapExecutionStep;
  transactionIds: string[];
  startTime: Date;
  error?: Error;
  rollbackRequired: boolean;
}

/**
 * AtomicSwapService orchestrates the complete swap transaction flow
 * with comprehensive error handling and rollback mechanisms
 */
export class AtomicSwapService {
  private hederaService: HederaService;
  private contractService: ContractService;
  private activeSwaps: Map<string, SwapExecutionContext> = new Map();

  constructor(hederaService: HederaService, contractService: ContractService) {
    this.hederaService = hederaService;
    this.contractService = contractService;
  }

  /**
   * Execute a complete atomic swap with rollback protection
   */
  async executeAtomicSwap(request: SwapExecutionRequest): Promise<SwapExecutionResult> {
    const context: SwapExecutionContext = {
      swapId: request.swapId,
      currentStep: SwapExecutionStep.VALIDATION,
      transactionIds: [],
      startTime: new Date(),
      rollbackRequired: false,
    };

    this.activeSwaps.set(request.swapId, context);

    try {
      logger.info('Starting atomic swap execution', {
        swapId: request.swapId,
        sourceBooking: request.sourceBookingId,
        targetBooking: request.targetBookingId,
      });

      // Step 1: Validate swap preconditions
      context.currentStep = SwapExecutionStep.VALIDATION;
      const validation = await this.validateSwapPreconditions(request);
      if (!validation.isValid) {
        throw new Error(`Swap validation failed: ${validation.errors.join(', ')}`);
      }

      // Step 2: Create swap proposal if not exists
      context.currentStep = SwapExecutionStep.PROPOSAL;
      const proposalResult = await this.ensureSwapProposal(request);
      context.transactionIds.push(proposalResult.transactionId!);
      context.rollbackRequired = true;

      // Step 3: Accept the swap proposal
      context.currentStep = SwapExecutionStep.ACCEPTANCE;
      const acceptanceResult = await this.acceptSwapProposal(request.swapId);
      context.transactionIds.push(acceptanceResult.transactionId!);

      // Step 4: Execute the atomic swap
      context.currentStep = SwapExecutionStep.EXECUTION;
      const executionResult = await this.executeSwapTransaction(request.swapId);
      context.transactionIds.push(executionResult.transactionId!);

      // Step 5: Verify swap completion
      context.currentStep = SwapExecutionStep.VERIFICATION;
      const verificationResult = await this.verifySwapCompletion(request.swapId);
      if (!verificationResult.isValid) {
        throw new Error('Swap verification failed after execution');
      }

      // Success - clean up context
      this.activeSwaps.delete(request.swapId);

      logger.info('Atomic swap completed successfully', {
        swapId: request.swapId,
        transactionId: executionResult.transactionId,
        duration: Date.now() - context.startTime.getTime(),
      });

      return {
        success: true,
        swapId: request.swapId,
        transactionId: executionResult.transactionId,
        consensusTimestamp: executionResult.consensusTimestamp,
      };

    } catch (error) {
      logger.error('Atomic swap execution failed', {
        swapId: request.swapId,
        step: context.currentStep,
        error: error.message,
      });

      context.error = error as Error;

      // Attempt rollback if necessary
      let rollbackTransactionId: string | undefined;
      if (context.rollbackRequired) {
        try {
          rollbackTransactionId = await this.rollbackSwap(context);
        } catch (rollbackError) {
          logger.error('Swap rollback failed', {
            swapId: request.swapId,
            rollbackError: rollbackError.message,
          });
        }
      }

      this.activeSwaps.delete(request.swapId);

      return {
        success: false,
        swapId: request.swapId,
        error: error.message,
        rollbackTransactionId,
      };
    }
  }

  /**
   * Validate all preconditions for swap execution
   */
  private async validateSwapPreconditions(request: SwapExecutionRequest): Promise<SwapVerification> {
    const errors: string[] = [];

    try {
      // Check if swap already exists and its status
      let swapExists = false;
      let swapStatus = SwapStatus.PENDING;
      
      try {
        const existingSwap = await this.contractService.getSwap(request.swapId);
        swapExists = true;
        swapStatus = existingSwap.status;
      } catch (error) {
        // Swap doesn't exist yet, which is fine for new proposals
        swapExists = false;
      }

      // If swap exists, validate its current state
      if (swapExists) {
        if (swapStatus === SwapStatus.COMPLETED) {
          errors.push('Swap already completed');
        } else if (swapStatus === SwapStatus.CANCELLED) {
          errors.push('Swap was cancelled');
        } else if (swapStatus === SwapStatus.DISPUTED) {
          errors.push('Swap is in disputed state');
        }
      }

      // Validate source booking
      const sourceBooking = await this.contractService.getBooking(request.sourceBookingId);
      if (!sourceBooking.bookingId) {
        errors.push('Source booking does not exist');
      } else if (sourceBooking.owner !== request.proposerAccountId) {
        errors.push('Proposer is not owner of source booking');
      } else if (sourceBooking.isLocked && !swapExists) {
        errors.push('Source booking is locked by another swap');
      }

      // Validate target booking
      const targetBooking = await this.contractService.getBooking(request.targetBookingId);
      if (!targetBooking.bookingId) {
        errors.push('Target booking does not exist');
      } else if (targetBooking.owner !== request.acceptorAccountId) {
        errors.push('Acceptor is not owner of target booking');
      } else if (targetBooking.isLocked && !swapExists) {
        errors.push('Target booking is locked by another swap');
      }

      // Validate expiration time
      const currentTime = Math.floor(Date.now() / 1000);
      if (request.expirationTime <= currentTime) {
        errors.push('Swap proposal has expired');
      }

      // Validate account balances if additional payment required
      if (request.additionalPayment && request.additionalPayment > 0) {
        const proposerBalance = await this.contractService.getUserBalance(request.proposerAccountId);
        if (proposerBalance < request.additionalPayment) {
          errors.push('Insufficient balance for additional payment');
        }
      }

      return {
        isValid: errors.length === 0,
        sourceBookingOwner: sourceBooking?.owner || '',
        targetBookingOwner: targetBooking?.owner || '',
        swapStatus,
        errors,
      };

    } catch (error) {
      logger.error('Swap validation error', { error, swapId: request.swapId });
      errors.push(`Validation error: ${error.message}`);
      
      return {
        isValid: false,
        sourceBookingOwner: '',
        targetBookingOwner: '',
        swapStatus: SwapStatus.PENDING,
        errors,
      };
    }
  }

  /**
   * Ensure swap proposal exists, create if necessary
   */
  private async ensureSwapProposal(request: SwapExecutionRequest): Promise<TransactionResult> {
    try {
      // Check if proposal already exists
      const existingSwap = await this.contractService.getSwap(request.swapId);
      
      logger.info('Swap proposal already exists', {
        swapId: request.swapId,
        status: existingSwap.status,
      });

      // Return a mock result for existing proposals
      return {
        transactionId: 'existing_proposal',
        status: 'SUCCESS',
        consensusTimestamp: new Date().toISOString(),
      };

    } catch (error) {
      // Proposal doesn't exist, create it
      logger.info('Creating new swap proposal', { swapId: request.swapId });

      const swapProposal = {
        swapId: request.swapId,
        sourceBookingId: request.sourceBookingId,
        targetBookingId: request.targetBookingId,
        additionalPayment: request.additionalPayment || 0,
        expirationTime: request.expirationTime,
      };

      return await this.contractService.proposeSwap(
        swapProposal,
        request.additionalPayment || 0
      );
    }
  }

  /**
   * Accept the swap proposal
   */
  private async acceptSwapProposal(swapId: string): Promise<TransactionResult> {
    try {
      // Check current swap status
      const swapDetails = await this.contractService.getSwap(swapId);
      
      if (swapDetails.status === SwapStatus.LOCKED) {
        logger.info('Swap already accepted', { swapId });
        return {
          transactionId: 'already_accepted',
          status: 'SUCCESS',
          consensusTimestamp: new Date().toISOString(),
        };
      }

      if (swapDetails.status !== SwapStatus.PENDING) {
        throw new Error(`Cannot accept swap in status: ${swapDetails.status}`);
      }

      logger.info('Accepting swap proposal', { swapId });
      return await this.contractService.acceptSwap(swapId);

    } catch (error) {
      logger.error('Failed to accept swap proposal', { error, swapId });
      throw new Error(`Swap acceptance failed: ${error.message}`);
    }
  }

  /**
   * Execute the atomic swap transaction
   */
  private async executeSwapTransaction(swapId: string): Promise<TransactionResult> {
    try {
      // Verify swap is in correct state for execution
      const swapDetails = await this.contractService.getSwap(swapId);
      
      if (swapDetails.status === SwapStatus.COMPLETED) {
        logger.info('Swap already executed', { swapId });
        return {
          transactionId: 'already_executed',
          status: 'SUCCESS',
          consensusTimestamp: new Date().toISOString(),
        };
      }

      if (swapDetails.status !== SwapStatus.LOCKED) {
        throw new Error(`Cannot execute swap in status: ${swapDetails.status}`);
      }

      logger.info('Executing atomic swap transaction', { swapId });
      return await this.contractService.executeSwap(swapId);

    } catch (error) {
      logger.error('Failed to execute swap transaction', { error, swapId });
      throw new Error(`Swap execution failed: ${error.message}`);
    }
  }

  /**
   * Verify swap completion on blockchain
   */
  private async verifySwapCompletion(swapId: string): Promise<SwapVerification> {
    try {
      // Get final swap state
      const swapDetails = await this.contractService.getSwap(swapId);
      
      if (swapDetails.status !== SwapStatus.COMPLETED) {
        return {
          isValid: false,
          sourceBookingOwner: '',
          targetBookingOwner: '',
          swapStatus: swapDetails.status,
          errors: [`Swap not completed, status: ${swapDetails.status}`],
        };
      }

      // Verify booking ownership has been swapped
      const sourceBooking = await this.contractService.getBooking(swapDetails.sourceBookingId);
      const targetBooking = await this.contractService.getBooking(swapDetails.targetBookingId);

      const errors: string[] = [];

      // Check that bookings are unlocked
      if (sourceBooking.isLocked) {
        errors.push('Source booking still locked after swap');
      }
      if (targetBooking.isLocked) {
        errors.push('Target booking still locked after swap');
      }

      // Verify ownership swap occurred
      if (sourceBooking.owner === swapDetails.proposer) {
        errors.push('Source booking ownership not transferred');
      }
      if (targetBooking.owner === swapDetails.acceptor) {
        errors.push('Target booking ownership not transferred');
      }

      logger.info('Swap verification completed', {
        swapId,
        isValid: errors.length === 0,
        sourceOwner: sourceBooking.owner,
        targetOwner: targetBooking.owner,
      });

      return {
        isValid: errors.length === 0,
        sourceBookingOwner: sourceBooking.owner,
        targetBookingOwner: targetBooking.owner,
        swapStatus: swapDetails.status,
        errors,
      };

    } catch (error) {
      logger.error('Swap verification failed', { error, swapId });
      return {
        isValid: false,
        sourceBookingOwner: '',
        targetBookingOwner: '',
        swapStatus: SwapStatus.PENDING,
        errors: [`Verification error: ${error.message}`],
      };
    }
  }

  /**
   * Rollback a failed swap transaction
   */
  private async rollbackSwap(context: SwapExecutionContext): Promise<string> {
    logger.info('Starting swap rollback', {
      swapId: context.swapId,
      failedStep: context.currentStep,
    });

    try {
      // Cancel the swap to unlock bookings and refund payments
      const rollbackResult = await this.contractService.cancelSwap(context.swapId);
      
      logger.info('Swap rollback completed', {
        swapId: context.swapId,
        rollbackTransactionId: rollbackResult.transactionId,
      });

      return rollbackResult.transactionId!;

    } catch (error) {
      logger.error('Swap rollback failed', {
        swapId: context.swapId,
        error: error.message,
      });
      throw new Error(`Rollback failed: ${error.message}`);
    }
  }

  /**
   * Get the status of an active swap execution
   */
  getSwapExecutionStatus(swapId: string): SwapExecutionContext | undefined {
    return this.activeSwaps.get(swapId);
  }

  /**
   * Get all active swap executions
   */
  getActiveSwaps(): SwapExecutionContext[] {
    return Array.from(this.activeSwaps.values());
  }

  /**
   * Cancel an active swap execution
   */
  async cancelSwapExecution(swapId: string): Promise<boolean> {
    const context = this.activeSwaps.get(swapId);
    if (!context) {
      return false;
    }

    try {
      if (context.rollbackRequired) {
        await this.rollbackSwap(context);
      }
      
      this.activeSwaps.delete(swapId);
      
      logger.info('Swap execution cancelled', { swapId });
      return true;

    } catch (error) {
      logger.error('Failed to cancel swap execution', { error, swapId });
      return false;
    }
  }

  /**
   * Cleanup expired swap executions
   */
  cleanupExpiredExecutions(maxAgeMs: number = 3600000): number { // 1 hour default
    const now = Date.now();
    let cleanedCount = 0;

    for (const [swapId, context] of this.activeSwaps.entries()) {
      const age = now - context.startTime.getTime();
      if (age > maxAgeMs) {
        this.activeSwaps.delete(swapId);
        cleanedCount++;
        
        logger.info('Cleaned up expired swap execution', {
          swapId,
          age: Math.round(age / 1000),
        });
      }
    }

    return cleanedCount;
  }
}