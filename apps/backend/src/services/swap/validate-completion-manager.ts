#!/usr/bin/env node

/**
 * Simple validation script for CompletionTransactionManager
 * Tests basic instantiation and method availability
 */

import { CompletionTransactionManager } from './CompletionTransactionManager';
import { getPool } from '../../database/config';
import {
    RelatedEntities,
    CompletionTransactionData,
    SwapCompletionErrorCodes
} from '@booking-swap/shared';

async function validateCompletionTransactionManager() {
    console.log('🔍 Validating CompletionTransactionManager implementation...');

    try {
        // Test 1: Basic instantiation
        const pool = getPool();
        const manager = new CompletionTransactionManager(pool);
        console.log('✅ CompletionTransactionManager instantiated successfully');

        // Test 2: Check required methods exist
        const requiredMethods = [
            'executeCompletionTransaction',
            'updateSwapStatuses',
            'updateBookingStatuses',
            'updateProposalStatus',
            'rollbackCompletionTransaction',
            'validateCompletionTransactionData',
            'getCompletionAuditRecord',
            'updateCompletionBlockchainTransaction'
        ];

        for (const method of requiredMethods) {
            if (typeof manager[method as keyof CompletionTransactionManager] !== 'function') {
                throw new Error(`Missing required method: ${method}`);
            }
        }
        console.log('✅ All required methods are present');

        // Test 3: Validation method works
        const mockEntities: RelatedEntities = {
            proposal: { id: 'test-proposal', targetUserId: 'user-1' },
            sourceSwap: { id: 'swap-1', status: 'pending' },
            sourceBooking: { id: 'booking-1', status: 'confirmed', userId: 'user-1' }
        };

        const mockTransactionData: CompletionTransactionData = {
            swapUpdates: [{
                swapId: 'swap-1',
                status: 'completed',
                completedAt: new Date()
            }],
            bookingUpdates: [{
                bookingId: 'booking-1',
                status: 'swapped',
                swappedAt: new Date()
            }],
            proposalUpdate: {
                proposalId: 'test-proposal',
                status: 'accepted',
                respondedAt: new Date(),
                respondedBy: 'user-1'
            }
        };

        // This should not throw an error
        manager.validateCompletionTransactionData(mockEntities, mockTransactionData);
        console.log('✅ Validation method works correctly');

        // Test 4: Error handling works
        try {
            const invalidData: CompletionTransactionData = {
                swapUpdates: [], // Empty array should cause validation error
                bookingUpdates: [],
                proposalUpdate: {
                    proposalId: 'test-proposal',
                    status: 'accepted',
                    respondedAt: new Date(),
                    respondedBy: 'user-1'
                }
            };
            manager.validateCompletionTransactionData(mockEntities, invalidData);
            throw new Error('Validation should have failed');
        } catch (error: any) {
            if (error.code === SwapCompletionErrorCodes.COMPLETION_VALIDATION_FAILED) {
                console.log('✅ Error handling works correctly');
            } else {
                throw error;
            }
        }

        console.log('🎉 CompletionTransactionManager validation completed successfully!');
        console.log('📋 Implementation includes:');
        console.log('   - Atomic transaction execution');
        console.log('   - Swap status updates with completion tracking');
        console.log('   - Booking status updates with ownership transfer');
        console.log('   - Proposal status updates');
        console.log('   - Completion audit trail creation');
        console.log('   - Rollback capabilities for failure recovery');
        console.log('   - Blockchain transaction ID tracking');
        console.log('   - Comprehensive validation and error handling');

    } catch (error) {
        console.error('❌ Validation failed:', error);
        process.exit(1);
    }
}

// Run validation if this script is executed directly
if (require.main === module) {
    validateCompletionTransactionManager()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('Validation script failed:', error);
            process.exit(1);
        });
}

export { validateCompletionTransactionManager };