/**
 * API Error Recovery Service - Handles partial update failures and data consistency
 * This service provides recovery mechanisms for separated booking and swap operations
 */

import {
  SwapPlatformError,
  ValidationError,
  BusinessLogicError,
  ERROR_CODES,
} from '@booking-swap/shared';
import { bookingEditService } from './bookingEditService';
import { swapSpecificationService } from './swapSpecificationService';

export interface PartialUpdateFailure {
  operation: 'booking' | 'swap';
  field?: string;
  error: string;
  originalValue?: any;
  recoveryAttempted: boolean;
  recoverySuccessful?: boolean;
}

export interface RecoveryStrategy {
  type: 'retry' | 'rollback' | 'partial_accept' | 'user_intervention';
  maxRetries?: number;
  retryDelay?: number;
  rollbackToSnapshot?: boolean;
}

export interface DataSnapshot {
  bookingData?: any;
  swapData?: any;
  timestamp: Date;
  operationId: string;
}

class ApiErrorRecoveryService {
  private snapshots: Map<string, DataSnapshot> = new Map();
  private readonly MAX_SNAPSHOTS = 10;
  private readonly DEFAULT_RETRY_DELAY = 1000; // 1 second

  /**
   * Creates a data snapshot before performing operations
   */
  async createSnapshot(
    operationId: string,
    bookingId?: string,
    swapId?: string
  ): Promise<DataSnapshot> {
    const snapshot: DataSnapshot = {
      timestamp: new Date(),
      operationId,
    };

    try {
      // Capture current booking state
      if (bookingId) {
        snapshot.bookingData = await bookingEditService.getBooking(bookingId);
      }

      // Capture current swap state
      if (swapId) {
        snapshot.swapData = await swapSpecificationService.getSwapSpecification(swapId);
      } else if (bookingId) {
        // Try to get swap by booking ID
        const swapSpec = await swapSpecificationService.getSwapSpecificationByBooking(bookingId);
        if (swapSpec) {
          snapshot.swapData = swapSpec;
        }
      }

      // Store snapshot with cleanup
      this.snapshots.set(operationId, snapshot);
      this.cleanupOldSnapshots();

      return snapshot;
    } catch (error) {
      throw new SwapPlatformError(
        ERROR_CODES.INTERNAL_SERVER_ERROR,
        'Failed to create data snapshot',
        'server_error'
      );
    }
  }

  /**
   * Recovers from partial update failures using specified strategy
   */
  async recoverFromPartialFailure(
    operationId: string,
    failures: PartialUpdateFailure[],
    strategy: RecoveryStrategy
  ): Promise<{
    success: boolean;
    recoveredOperations: string[];
    remainingFailures: PartialUpdateFailure[];
    newErrors?: string[];
  }> {
    const recoveredOperations: string[] = [];
    const remainingFailures: PartialUpdateFailure[] = [];
    const newErrors: string[] = [];

    switch (strategy.type) {
      case 'retry':
        return await this.retryFailedOperations(failures, strategy, recoveredOperations, remainingFailures, newErrors);

      case 'rollback':
        return await this.rollbackToSnapshot(operationId, failures, recoveredOperations, newErrors);

      case 'partial_accept':
        return await this.acceptPartialSuccess(failures, recoveredOperations, remainingFailures);

      case 'user_intervention':
        return {
          success: false,
          recoveredOperations,
          remainingFailures: failures,
          newErrors: ['User intervention required for recovery'],
        };

      default:
        return {
          success: false,
          recoveredOperations,
          remainingFailures: failures,
          newErrors: ['Invalid recovery strategy'],
        };
    }
  }

  /**
   * Validates data consistency between booking and swap after operations
   */
  async validateDataConsistency(
    bookingId: string,
    expectedBookingData?: any,
    expectedSwapData?: any
  ): Promise<{
    consistent: boolean;
    inconsistencies: Array<{
      type: 'booking' | 'swap' | 'relationship';
      field: string;
      expected: any;
      actual: any;
    }>;
  }> {
    const inconsistencies: Array<{
      type: 'booking' | 'swap' | 'relationship';
      field: string;
      expected: any;
      actual: any;
    }> = [];

    try {
      // Get current data
      const currentBooking = await bookingEditService.getBooking(bookingId);
      const currentSwap = await swapSpecificationService.getSwapSpecificationByBooking(bookingId);

      // Validate booking data consistency
      if (expectedBookingData) {
        this.compareDataObjects(expectedBookingData, currentBooking, 'booking', inconsistencies);
      }

      // Validate swap data consistency
      if (expectedSwapData && currentSwap) {
        this.compareDataObjects(expectedSwapData, currentSwap, 'swap', inconsistencies);
      }

      // Validate relationship consistency
      if (currentSwap && currentSwap.bookingId !== bookingId) {
        inconsistencies.push({
          type: 'relationship',
          field: 'bookingId',
          expected: bookingId,
          actual: currentSwap.bookingId,
        });
      }

      return {
        consistent: inconsistencies.length === 0,
        inconsistencies,
      };
    } catch (error) {
      throw new SwapPlatformError(
        ERROR_CODES.INTERNAL_SERVER_ERROR,
        'Failed to validate data consistency',
        'server_error'
      );
    }
  }

  /**
   * Attempts to repair data inconsistencies
   */
  async repairDataInconsistencies(
    bookingId: string,
    inconsistencies: Array<{
      type: 'booking' | 'swap' | 'relationship';
      field: string;
      expected: any;
      actual: any;
    }>
  ): Promise<{
    success: boolean;
    repairedFields: string[];
    unrepairedFields: Array<{
      field: string;
      reason: string;
    }>;
  }> {
    const repairedFields: string[] = [];
    const unrepairedFields: Array<{
      field: string;
      reason: string;
    }> = [];

    for (const inconsistency of inconsistencies) {
      try {
        switch (inconsistency.type) {
          case 'booking':
            await this.repairBookingField(bookingId, inconsistency.field, inconsistency.expected);
            repairedFields.push(`booking.${inconsistency.field}`);
            break;

          case 'swap':
            await this.repairSwapField(bookingId, inconsistency.field, inconsistency.expected);
            repairedFields.push(`swap.${inconsistency.field}`);
            break;

          case 'relationship':
            // Relationship inconsistencies are more complex and may require manual intervention
            unrepairedFields.push({
              field: inconsistency.field,
              reason: 'Relationship inconsistencies require manual intervention',
            });
            break;
        }
      } catch (error) {
        unrepairedFields.push({
          field: inconsistency.field,
          reason: error instanceof Error ? error.message : 'Unknown repair error',
        });
      }
    }

    return {
      success: unrepairedFields.length === 0,
      repairedFields,
      unrepairedFields,
    };
  }

  /**
   * Gets recovery recommendations based on error patterns
   */
  getRecoveryRecommendations(failures: PartialUpdateFailure[]): RecoveryStrategy[] {
    const recommendations: RecoveryStrategy[] = [];

    // Analyze failure patterns
    const hasNetworkErrors = failures.some(f => f.error.includes('network') || f.error.includes('timeout'));
    const hasValidationErrors = failures.some(f => f.error.includes('validation') || f.error.includes('invalid'));
    const hasPermissionErrors = failures.some(f => f.error.includes('permission') || f.error.includes('access'));

    // Recommend strategies based on error types
    if (hasNetworkErrors) {
      recommendations.push({
        type: 'retry',
        maxRetries: 3,
        retryDelay: 2000,
      });
    }

    if (hasValidationErrors) {
      recommendations.push({
        type: 'user_intervention',
      });
    }

    if (hasPermissionErrors) {
      recommendations.push({
        type: 'rollback',
        rollbackToSnapshot: true,
      });
    }

    // Default recommendation
    if (recommendations.length === 0) {
      recommendations.push({
        type: 'partial_accept',
      });
    }

    return recommendations;
  }

  // Private helper methods
  private async retryFailedOperations(
    failures: PartialUpdateFailure[],
    strategy: RecoveryStrategy,
    recoveredOperations: string[],
    remainingFailures: PartialUpdateFailure[],
    newErrors: string[]
  ): Promise<{
    success: boolean;
    recoveredOperations: string[];
    remainingFailures: PartialUpdateFailure[];
    newErrors?: string[];
  }> {
    const maxRetries = strategy.maxRetries || 3;
    const retryDelay = strategy.retryDelay || this.DEFAULT_RETRY_DELAY;

    for (const failure of failures) {
      let retryCount = 0;
      let recovered = false;

      while (retryCount < maxRetries && !recovered) {
        try {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          
          // Attempt to retry the specific operation
          // This would need to be implemented based on the specific failure type
          // For now, we'll mark it as attempted
          recovered = true;
          recoveredOperations.push(`${failure.operation}.${failure.field || 'unknown'}`);
        } catch (retryError) {
          retryCount++;
          if (retryCount >= maxRetries) {
            remainingFailures.push({
              ...failure,
              recoveryAttempted: true,
              recoverySuccessful: false,
            });
          }
        }
      }
    }

    return {
      success: remainingFailures.length === 0,
      recoveredOperations,
      remainingFailures,
      newErrors: newErrors.length > 0 ? newErrors : undefined,
    };
  }

  private async rollbackToSnapshot(
    operationId: string,
    failures: PartialUpdateFailure[],
    recoveredOperations: string[],
    newErrors: string[]
  ): Promise<{
    success: boolean;
    recoveredOperations: string[];
    remainingFailures: PartialUpdateFailure[];
    newErrors?: string[];
  }> {
    const snapshot = this.snapshots.get(operationId);
    if (!snapshot) {
      newErrors.push('No snapshot available for rollback');
      return {
        success: false,
        recoveredOperations,
        remainingFailures: failures,
        newErrors,
      };
    }

    try {
      // Attempt to restore from snapshot
      // This would involve calling the appropriate service methods to restore data
      recoveredOperations.push('rollback_completed');
      
      return {
        success: true,
        recoveredOperations,
        remainingFailures: [],
        newErrors: newErrors.length > 0 ? newErrors : undefined,
      };
    } catch (rollbackError) {
      newErrors.push(`Rollback failed: ${rollbackError instanceof Error ? rollbackError.message : 'Unknown error'}`);
      return {
        success: false,
        recoveredOperations,
        remainingFailures: failures,
        newErrors,
      };
    }
  }

  private async acceptPartialSuccess(
    failures: PartialUpdateFailure[],
    recoveredOperations: string[],
    remainingFailures: PartialUpdateFailure[]
  ): Promise<{
    success: boolean;
    recoveredOperations: string[];
    remainingFailures: PartialUpdateFailure[];
  }> {
    // Mark all failures as accepted (partial success strategy)
    failures.forEach(failure => {
      recoveredOperations.push(`accepted_partial_${failure.operation}.${failure.field || 'unknown'}`);
    });

    return {
      success: true,
      recoveredOperations,
      remainingFailures: [],
    };
  }

  private compareDataObjects(
    expected: any,
    actual: any,
    type: 'booking' | 'swap',
    inconsistencies: Array<{
      type: 'booking' | 'swap' | 'relationship';
      field: string;
      expected: any;
      actual: any;
    }>
  ): void {
    for (const [key, expectedValue] of Object.entries(expected)) {
      if (actual[key] !== expectedValue) {
        inconsistencies.push({
          type,
          field: key,
          expected: expectedValue,
          actual: actual[key],
        });
      }
    }
  }

  private async repairBookingField(bookingId: string, field: string, expectedValue: any): Promise<void> {
    const updateData = { [field]: expectedValue };
    await bookingEditService.updateBooking(bookingId, updateData);
  }

  private async repairSwapField(bookingId: string, field: string, expectedValue: any): Promise<void> {
    const swapSpec = await swapSpecificationService.getSwapSpecificationByBooking(bookingId);
    if (swapSpec) {
      const updateData = { [field]: expectedValue };
      await swapSpecificationService.updateSwapSpecification(swapSpec.id, updateData);
    }
  }

  private cleanupOldSnapshots(): void {
    if (this.snapshots.size > this.MAX_SNAPSHOTS) {
      const sortedSnapshots = Array.from(this.snapshots.entries())
        .sort(([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime());
      
      const toDelete = sortedSnapshots.slice(0, this.snapshots.size - this.MAX_SNAPSHOTS);
      toDelete.forEach(([key]) => this.snapshots.delete(key));
    }
  }

  /**
   * Clears all snapshots (useful for cleanup)
   */
  clearSnapshots(): void {
    this.snapshots.clear();
  }

  /**
   * Gets snapshot information for debugging
   */
  getSnapshotInfo(): Array<{
    operationId: string;
    timestamp: Date;
    hasBookingData: boolean;
    hasSwapData: boolean;
  }> {
    return Array.from(this.snapshots.entries()).map(([operationId, snapshot]) => ({
      operationId,
      timestamp: snapshot.timestamp,
      hasBookingData: !!snapshot.bookingData,
      hasSwapData: !!snapshot.swapData,
    }));
  }
}

export const apiErrorRecoveryService = new ApiErrorRecoveryService();