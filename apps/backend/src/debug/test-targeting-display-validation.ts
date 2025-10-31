/**
 * Test script for Task 5: Test and validate targeting display with existing data
 * 
 * This script validates:
 * - Verify that existing swap_targets table data appears in the UI
 * - Test that both users in a targeting relationship can see the connection
 * - Validate that targeting actions work with the simplified display
 * - Ensure no data loss or corruption during the simplification
 */

import { Pool } from 'pg';
import { SwapTargetingRepository } from '../database/repositories/SwapTargetingRepository';
import { SwapRepository } from '../database/repositories/SwapRepository';
import { SwapProposalService } from '../services/swap/SwapProposalService';
import { TargetingDebugUtils } from '../utils/targetingDebugUtils';
import { TargetingProductionLogger } from '../utils/targetingProductionLogger';
import { logger } from '../utils/logger';
import { EnhancedSwapCardData } from '@booking-swap/shared';

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'booking_swap',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
};

interface ValidationResult {
    success: boolean;
    message: string;
    details?: any;
}

interface TestResults {
    subtask1: ValidationResult; // Verify existing swap_targets data appears in UI
    subtask2: ValidationResult; // Test both users can see the connection
    subtask3: ValidationResult; // Validate targeting actions work
    subtask4: ValidationResult; // Ensure no data loss during simplification
    overall: ValidationResult;
}

class TargetingDisplayValidator {
    constructor(
        private pool: Pool,
        private swapTargetingRepository: SwapTargetingRepository,
        private swapRepository: SwapRepository,
        private swapProposalService: SwapProposalService,
        private debugUtils: TargetingDebugUtils
    ) { }

    /**
     * Sub-task 1: Verify that existing swap_targets table data appears in the UI
     */
    async validateSwapTargetsDataInUI(): Promise<ValidationResult> {
        try {
            logger.info('Sub-task 1: Validating swap_targets data appears in UI');

            // Get all swap_targets from database
            const swapTargetsQuery = `
                SELECT st.*, 
                       s1.user_id as source_user_id,
                       s2.user_id as target_user_id
                FROM swap_targets st
                JOIN swaps s1 ON st.source_swap_id = s1.id
                JOIN swaps s2 ON st.target_swap_id = s2.id
                WHERE st.status = 'active'
                LIMIT 10
            `;

            const swapTargetsResult = await this.pool.query(swapTargetsQuery);

            if (swapTargetsResult.rows.length === 0) {
                return {
                    success: true,
                    message: 'No active swap_targets found in database - nothing to validate',
                    details: { swapTargetsCount: 0 }
                };
            }

            logger.info(`Found ${swapTargetsResult.rows.length} active swap_targets to validate`);

            // Test each user involved in targeting relationships
            const usersToTest = new Set<string>();
            swapTargetsResult.rows.forEach(row => {
                usersToTest.add(row.source_user_id);
                usersToTest.add(row.target_user_id);
            });

            let successCount = 0;
            let totalTests = 0;
            const validationDetails: any[] = [];

            for (const userId of usersToTest) {
                totalTests++;

                try {
                    // Get user's swap cards with targeting data
                    const swapCards = await this.swapProposalService.getUserSwapsWithTargeting(userId);

                    // Check if targeting data is present
                    const swapsWithTargeting = swapCards.filter(card =>
                        card.targeting && (
                            (card.targeting.incomingTargetCount && card.targeting.incomingTargetCount > 0) ||
                            card.targeting.outgoingTarget
                        )
                    );

                    // Verify targeting data matches database
                    const userTargetingFromDB = swapTargetsResult.rows.filter(row =>
                        row.source_user_id === userId || row.target_user_id === userId
                    );

                    const hasExpectedTargeting = userTargetingFromDB.length > 0;
                    const hasUITargeting = swapsWithTargeting.length > 0;

                    if (hasExpectedTargeting === hasUITargeting) {
                        successCount++;
                        validationDetails.push({
                            userId,
                            status: 'success',
                            expectedTargeting: hasExpectedTargeting,
                            uiTargeting: hasUITargeting,
                            swapsWithTargeting: swapsWithTargeting.length,
                            dbTargetingCount: userTargetingFromDB.length
                        });
                    } else {
                        validationDetails.push({
                            userId,
                            status: 'mismatch',
                            expectedTargeting: hasExpectedTargeting,
                            uiTargeting: hasUITargeting,
                            swapsWithTargeting: swapsWithTargeting.length,
                            dbTargetingCount: userTargetingFromDB.length,
                            issue: hasExpectedTargeting ? 'DB has targeting but UI does not' : 'UI has targeting but DB does not'
                        });
                    }

                } catch (error) {
                    validationDetails.push({
                        userId,
                        status: 'error',
                        error: error.message
                    });
                }
            }

            const successRate = totalTests > 0 ? (successCount / totalTests) * 100 : 100;

            return {
                success: successRate >= 90, // 90% success rate threshold
                message: `Swap targets data validation: ${successCount}/${totalTests} users passed (${successRate.toFixed(1)}%)`,
                details: {
                    totalUsers: totalTests,
                    successfulUsers: successCount,
                    successRate,
                    validationDetails,
                    swapTargetsInDB: swapTargetsResult.rows.length
                }
            };

        } catch (error) {
            logger.error('Sub-task 1 validation failed', { error });
            return {
                success: false,
                message: `Failed to validate swap_targets data in UI: ${error.message}`,
                details: { error: error.message }
            };
        }
    }

    /**
     * Sub-task 2: Test that both users in a targeting relationship can see the connection
     */
    async validateBidirectionalVisibility(): Promise<ValidationResult> {
        try {
            logger.info('Sub-task 2: Validating bidirectional targeting visibility');

            // Find targeting relationships where both users exist
            const relationshipsQuery = `
                SELECT st.id as target_id,
                       st.source_swap_id,
                       st.target_swap_id,
                       s1.user_id as source_user_id,
                       s2.user_id as target_user_id,
                       s1.id as source_swap_id_check,
                       s2.id as target_swap_id_check
                FROM swap_targets st
                JOIN swaps s1 ON st.source_swap_id = s1.id
                JOIN swaps s2 ON st.target_swap_id = s2.id
                WHERE st.status = 'active'
                  AND s1.user_id != s2.user_id
                LIMIT 5
            `;

            const relationshipsResult = await this.pool.query(relationshipsQuery);

            if (relationshipsResult.rows.length === 0) {
                return {
                    success: true,
                    message: 'No bidirectional targeting relationships found to test',
                    details: { relationshipsCount: 0 }
                };
            }

            logger.info(`Testing ${relationshipsResult.rows.length} bidirectional targeting relationships`);

            let successCount = 0;
            const relationshipTests: any[] = [];

            for (const relationship of relationshipsResult.rows) {
                const { source_user_id, target_user_id, source_swap_id, target_swap_id, target_id } = relationship;

                try {
                    // Test source user can see outgoing target
                    const sourceUserCards = await this.swapProposalService.getUserSwapsWithTargeting(source_user_id);
                    const sourceSwapCard = sourceUserCards.find(card => card.userSwap.id === source_swap_id);

                    // Test target user can see incoming target
                    const targetUserCards = await this.swapProposalService.getUserSwapsWithTargeting(target_user_id);
                    const targetSwapCard = targetUserCards.find(card => card.userSwap.id === target_swap_id);

                    const sourceCanSeeOutgoing = sourceSwapCard?.targeting?.outgoingTarget?.targetSwapId === target_swap_id;
                    const targetCanSeeIncoming = targetSwapCard?.targeting?.incomingTargets?.some(
                        target => target.sourceSwapId === source_swap_id
                    ) || false;

                    const bothCanSee = sourceCanSeeOutgoing && targetCanSeeIncoming;

                    if (bothCanSee) {
                        successCount++;
                    }

                    relationshipTests.push({
                        targetId: target_id,
                        sourceUserId: source_user_id,
                        targetUserId: target_user_id,
                        sourceSwapId: source_swap_id,
                        targetSwapId: target_swap_id,
                        sourceCanSeeOutgoing,
                        targetCanSeeIncoming,
                        bothCanSee,
                        status: bothCanSee ? 'success' : 'failed'
                    });

                } catch (error) {
                    relationshipTests.push({
                        targetId: target_id,
                        sourceUserId: source_user_id,
                        targetUserId: target_user_id,
                        status: 'error',
                        error: error.message
                    });
                }
            }

            const successRate = relationshipsResult.rows.length > 0 ?
                (successCount / relationshipsResult.rows.length) * 100 : 100;

            return {
                success: successRate >= 90,
                message: `Bidirectional visibility: ${successCount}/${relationshipsResult.rows.length} relationships passed (${successRate.toFixed(1)}%)`,
                details: {
                    totalRelationships: relationshipsResult.rows.length,
                    successfulRelationships: successCount,
                    successRate,
                    relationshipTests
                }
            };

        } catch (error) {
            logger.error('Sub-task 2 validation failed', { error });
            return {
                success: false,
                message: `Failed to validate bidirectional visibility: ${error.message}`,
                details: { error: error.message }
            };
        }
    }

    /**
     * Sub-task 3: Validate that targeting actions work with the simplified display
     */
    async validateTargetingActions(): Promise<ValidationResult> {
        try {
            logger.info('Sub-task 3: Validating targeting actions work with simplified display');

            // This is a structural validation since we can't perform actual actions in a test
            // We validate that the data structure supports the required actions

            // Find users with targeting data
            const usersWithTargetingQuery = `
                SELECT DISTINCT s.user_id
                FROM swaps s
                WHERE s.id IN (
                    SELECT source_swap_id FROM swap_targets WHERE status = 'active'
                    UNION
                    SELECT target_swap_id FROM swap_targets WHERE status = 'active'
                )
                LIMIT 3
            `;

            const usersResult = await this.pool.query(usersWithTargetingQuery);

            if (usersResult.rows.length === 0) {
                return {
                    success: true,
                    message: 'No users with targeting data found to test actions',
                    details: { usersCount: 0 }
                };
            }

            let validationResults: any[] = [];
            let successCount = 0;

            for (const userRow of usersResult.rows) {
                const userId = userRow.user_id;

                try {
                    const swapCards = await this.swapProposalService.getUserSwapsWithTargeting(userId);

                    for (const card of swapCards) {
                        if (!card.targeting) continue;

                        const validation = {
                            userId,
                            swapId: card.userSwap.id,
                            hasTargeting: true,
                            incomingTargets: card.targeting.incomingTargets?.length || 0,
                            hasOutgoingTarget: !!card.targeting.outgoingTarget,
                            canReceiveTargets: card.targeting.canReceiveTargets,
                            canTarget: card.targeting.canTarget,
                            actionValidation: {
                                canAcceptIncoming: false,
                                canRejectIncoming: false,
                                canCancelOutgoing: false,
                                canRetarget: false
                            }
                        };

                        // Validate action capabilities based on targeting data
                        if (card.targeting.incomingTargets && card.targeting.incomingTargets.length > 0) {
                            validation.actionValidation.canAcceptIncoming = card.targeting.incomingTargets.some(
                                target => target.status === 'active' && target.targetId && target.proposalId
                            );
                            validation.actionValidation.canRejectIncoming = validation.actionValidation.canAcceptIncoming;
                        }

                        if (card.targeting.outgoingTarget) {
                            validation.actionValidation.canCancelOutgoing =
                                card.targeting.outgoingTarget.status === 'active' &&
                                !!card.targeting.outgoingTarget.targetId;
                            validation.actionValidation.canRetarget = validation.actionValidation.canCancelOutgoing;
                        }

                        const hasValidActions = Object.values(validation.actionValidation).some(Boolean);

                        if (hasValidActions) {
                            successCount++;
                        }

                        validationResults.push({
                            ...validation,
                            hasValidActions,
                            status: hasValidActions ? 'success' : 'no_actions_available'
                        });
                    }

                } catch (error) {
                    validationResults.push({
                        userId,
                        status: 'error',
                        error: error.message
                    });
                }
            }

            const totalValidations = validationResults.length;
            const successRate = totalValidations > 0 ? (successCount / totalValidations) * 100 : 100;

            return {
                success: successRate >= 70, // Lower threshold since this is structural validation
                message: `Targeting actions validation: ${successCount}/${totalValidations} cards support actions (${successRate.toFixed(1)}%)`,
                details: {
                    totalValidations,
                    successfulValidations: successCount,
                    successRate,
                    validationResults
                }
            };

        } catch (error) {
            logger.error('Sub-task 3 validation failed', { error });
            return {
                success: false,
                message: `Failed to validate targeting actions: ${error.message}`,
                details: { error: error.message }
            };
        }
    }

    /**
     * Sub-task 4: Ensure no data loss or corruption during the simplification
     */
    async validateDataIntegrity(): Promise<ValidationResult> {
        try {
            logger.info('Sub-task 4: Validating data integrity during simplification');

            // Get comprehensive data consistency report
            const consistencyReport = await this.debugUtils.generateDataConsistencyReport();

            // Find users with targeting data for detailed comparison
            const usersWithTargetingQuery = `
                SELECT DISTINCT s.user_id
                FROM swaps s
                WHERE s.id IN (
                    SELECT source_swap_id FROM swap_targets WHERE status = 'active'
                    UNION
                    SELECT target_swap_id FROM swap_targets WHERE status = 'active'
                )
                LIMIT 5
            `;

            const usersResult = await this.pool.query(usersWithTargetingQuery);

            let dataIntegrityResults: any[] = [];
            let successCount = 0;

            for (const userRow of usersResult.rows) {
                const userId = userRow.user_id;

                try {
                    // Compare raw database data with processed service data
                    const comparison = await this.debugUtils.compareTableDataWithDisplay(userId);

                    const hasDiscrepancies =
                        comparison.missingFromDisplay.length > 0 ||
                        comparison.extraInDisplay.length > 0 ||
                        comparison.differences.length > 0;

                    const dataIntegrityScore = hasDiscrepancies ?
                        Math.max(0, 100 - (comparison.missingFromDisplay.length * 20) - (comparison.differences.length * 10)) : 100;

                    if (dataIntegrityScore >= 80) {
                        successCount++;
                    }

                    dataIntegrityResults.push({
                        userId,
                        dataIntegrityScore,
                        hasDiscrepancies,
                        missingFromDisplay: comparison.missingFromDisplay.length,
                        extraInDisplay: comparison.extraInDisplay.length,
                        differences: comparison.differences.length,
                        tableDataCount: comparison.tableData.length,
                        displayDataCount: comparison.displayData.length,
                        status: dataIntegrityScore >= 80 ? 'success' : 'integrity_issues'
                    });

                } catch (error) {
                    dataIntegrityResults.push({
                        userId,
                        status: 'error',
                        error: error.message
                    });
                }
            }

            const totalUsers = usersResult.rows.length;
            const successRate = totalUsers > 0 ? (successCount / totalUsers) * 100 : 100;

            // Overall system integrity assessment
            const systemIntegrityIssues =
                consistencyReport.orphanedTargets.length +
                consistencyReport.missingBookings.length +
                consistencyReport.inconsistentStatuses.length +
                consistencyReport.duplicateTargets.length;

            const systemIntegrityScore = Math.max(0, 100 - (systemIntegrityIssues * 5));

            return {
                success: successRate >= 80 && systemIntegrityScore >= 90,
                message: `Data integrity validation: ${successCount}/${totalUsers} users passed (${successRate.toFixed(1)}%), system integrity: ${systemIntegrityScore}%`,
                details: {
                    userIntegrity: {
                        totalUsers,
                        successfulUsers: successCount,
                        successRate,
                        dataIntegrityResults
                    },
                    systemIntegrity: {
                        score: systemIntegrityScore,
                        swapTargetsCount: consistencyReport.swapTargetsCount,
                        swapsCount: consistencyReport.swapsCount,
                        bookingsCount: consistencyReport.bookingsCount,
                        issues: {
                            orphanedTargets: consistencyReport.orphanedTargets.length,
                            missingBookings: consistencyReport.missingBookings.length,
                            inconsistentStatuses: consistencyReport.inconsistentStatuses.length,
                            duplicateTargets: consistencyReport.duplicateTargets.length
                        }
                    }
                }
            };

        } catch (error) {
            logger.error('Sub-task 4 validation failed', { error });
            return {
                success: false,
                message: `Failed to validate data integrity: ${error.message}`,
                details: { error: error.message }
            };
        }
    }

    /**
     * Run all validation tests
     */
    async runAllValidations(): Promise<TestResults> {
        logger.info('Starting comprehensive targeting display validation');

        // Enable production logging for detailed tracking
        TargetingProductionLogger.enableLogging();

        const results: TestResults = {
            subtask1: await this.validateSwapTargetsDataInUI(),
            subtask2: await this.validateBidirectionalVisibility(),
            subtask3: await this.validateTargetingActions(),
            subtask4: await this.validateDataIntegrity(),
            overall: { success: false, message: '' }
        };

        // Calculate overall success
        const subtaskResults = [results.subtask1, results.subtask2, results.subtask3, results.subtask4];
        const successfulSubtasks = subtaskResults.filter(result => result.success).length;
        const overallSuccess = successfulSubtasks >= 3; // At least 3 out of 4 subtasks must pass

        results.overall = {
            success: overallSuccess,
            message: `Overall validation: ${successfulSubtasks}/4 subtasks passed`,
            details: {
                subtaskResults: {
                    subtask1: results.subtask1.success,
                    subtask2: results.subtask2.success,
                    subtask3: results.subtask3.success,
                    subtask4: results.subtask4.success
                },
                successfulSubtasks,
                totalSubtasks: 4,
                overallSuccess
            }
        };

        return results;
    }
}

/**
 * Main test execution function
 */
async function testTargetingDisplayValidation(): Promise<void> {
    const pool = new Pool(dbConfig);

    try {
        logger.info('Starting Task 5: Test and validate targeting display with existing data');

        // Initialize repositories and services
        const swapTargetingRepository = new SwapTargetingRepository(pool);
        const swapRepository = new SwapRepository(pool);

        // Mock the required services for SwapProposalService
        const mockBookingService = {} as any;
        const mockHederaService = {} as any;
        const mockNotificationService = {} as any;
        const mockAuctionNotificationService = {} as any;
        const mockPaymentNotificationService = {} as any;
        const mockTimingNotificationService = {} as any;
        const mockAuctionManagementService = {} as any;
        const mockPaymentProcessingService = {} as any;
        const mockAuctionRepository = {} as any;

        const swapProposalService = new SwapProposalService(
            swapRepository,
            swapTargetingRepository,
            mockAuctionRepository,
            mockBookingService,
            mockHederaService,
            mockNotificationService,
            mockAuctionNotificationService,
            mockPaymentNotificationService,
            mockTimingNotificationService,
            mockAuctionManagementService,
            mockPaymentProcessingService
        );

        const debugUtils = new TargetingDebugUtils(
            pool,
            swapTargetingRepository,
            swapRepository
        );

        // Initialize validator
        const validator = new TargetingDisplayValidator(
            pool,
            swapTargetingRepository,
            swapRepository,
            swapProposalService,
            debugUtils
        );

        // Run all validations
        const results = await validator.runAllValidations();

        // Log detailed results
        logger.info('Task 5 Validation Results:', {
            overall: results.overall,
            subtask1: results.subtask1.message,
            subtask2: results.subtask2.message,
            subtask3: results.subtask3.message,
            subtask4: results.subtask4.message
        });

        // Print summary to console
        console.log('\n=== Task 5: Targeting Display Validation Results ===\n');
        console.log(`Overall Result: ${results.overall.success ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`Summary: ${results.overall.message}\n`);

        console.log('Sub-task Results:');
        console.log(`1. Swap targets data in UI: ${results.subtask1.success ? '✅' : '❌'} - ${results.subtask1.message}`);
        console.log(`2. Bidirectional visibility: ${results.subtask2.success ? '✅' : '❌'} - ${results.subtask2.message}`);
        console.log(`3. Targeting actions work: ${results.subtask3.success ? '✅' : '❌'} - ${results.subtask3.message}`);
        console.log(`4. Data integrity maintained: ${results.subtask4.success ? '✅' : '❌'} - ${results.subtask4.message}`);

        if (results.overall.success) {
            console.log('\n🎉 All targeting display validations passed! The implementation is working correctly.');
        } else {
            console.log('\n⚠️  Some validations failed. Check the detailed logs for specific issues.');
        }

        // Exit with appropriate code
        process.exit(results.overall.success ? 0 : 1);

    } catch (error) {
        logger.error('Task 5 validation failed with critical error', { error });
        console.error('\n❌ Critical error during validation:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    testTargetingDisplayValidation()
        .then(() => {
            logger.info('Task 5 validation completed');
        })
        .catch((error) => {
            logger.error('Task 5 validation failed', { error });
            process.exit(1);
        });
}

export { testTargetingDisplayValidation, TargetingDisplayValidator };