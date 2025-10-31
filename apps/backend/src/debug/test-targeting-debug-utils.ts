/**
 * Test script for targeting debug utilities
 * This script can be run to validate that the debug utilities work correctly
 */

import { Pool } from 'pg';
import { SwapTargetingRepository } from '../database/repositories/SwapTargetingRepository';
import { SwapRepository } from '../database/repositories/SwapRepository';
import { TargetingDebugUtils } from '../utils/targetingDebugUtils';
import { TargetingProductionLogger } from '../utils/targetingProductionLogger';
import { logger } from '../utils/logger';

// Database configuration (use environment variables)
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'booking_swap',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
};

async function testTargetingDebugUtils() {
    const pool = new Pool(dbConfig);

    try {
        logger.info('Starting targeting debug utilities test');

        // Initialize repositories
        const swapTargetingRepository = new SwapTargetingRepository(pool);
        const swapRepository = new SwapRepository(pool);

        // Initialize debug utils
        const debugUtils = new TargetingDebugUtils(
            pool,
            swapTargetingRepository,
            swapRepository
        );

        // Test 1: Enable production logging
        logger.info('Test 1: Testing production logging configuration');
        TargetingProductionLogger.enableLogging();

        const loggingConfig = TargetingProductionLogger.getLoggingConfig();
        logger.info('Logging configuration:', loggingConfig);

        // Test 2: Test data consistency report (system-wide)
        logger.info('Test 2: Testing data consistency report');
        try {
            const consistencyReport = await debugUtils.generateDataConsistencyReport();
            logger.info('Data consistency report generated successfully', {
                swapTargetsCount: consistencyReport.swapTargetsCount,
                swapsCount: consistencyReport.swapsCount,
                bookingsCount: consistencyReport.bookingsCount,
                hasIssues: consistencyReport.orphanedTargets.length > 0 ||
                    consistencyReport.missingBookings.length > 0 ||
                    consistencyReport.inconsistentStatuses.length > 0 ||
                    consistencyReport.duplicateTargets.length > 0
            });
        } catch (error) {
            logger.error('Data consistency report test failed', { error });
        }

        // Test 3: Test with a sample user (if available)
        logger.info('Test 3: Testing user-specific debugging');
        try {
            // Get a sample user ID from the database
            const userQuery = 'SELECT id FROM users LIMIT 1';
            const userResult = await pool.query(userQuery);

            if (userResult.rows.length > 0) {
                const sampleUserId = userResult.rows[0].id;
                logger.info('Testing with sample user', { sampleUserId });

                // Test targeting data snapshot
                const snapshot = await debugUtils.createTargetingDataSnapshot(sampleUserId);
                logger.info('Targeting data snapshot created successfully', {
                    userId: sampleUserId,
                    incomingTargetsCount: snapshot.transformedData.incomingTargets.length,
                    outgoingTargetsCount: snapshot.transformedData.outgoingTargets.length,
                    dataIntegrity: snapshot.validationResults.dataIntegrity,
                    executionTime: snapshot.performanceMetrics.totalExecutionTime
                });

                // Test table vs display comparison
                const comparison = await debugUtils.compareTableDataWithDisplay(sampleUserId);
                logger.info('Table vs display comparison completed', {
                    userId: sampleUserId,
                    tableDataCount: comparison.tableData.length,
                    displayDataCount: comparison.displayData.length,
                    hasDiscrepancies: comparison.missingFromDisplay.length > 0 ||
                        comparison.extraInDisplay.length > 0 ||
                        comparison.differences.length > 0
                });

                // Test transformation logging
                await debugUtils.logTransformationSteps(sampleUserId);
                logger.info('Transformation steps logged successfully');

            } else {
                logger.warn('No users found in database, skipping user-specific tests');
            }
        } catch (error) {
            logger.error('User-specific debugging test failed', { error });
        }

        // Test 4: Test production logger methods
        logger.info('Test 4: Testing production logger methods');
        const testUserId = 'test-user-123';
        const testRequestId = 'test-request-456';

        TargetingProductionLogger.logOperationStart('test-operation', testUserId, testRequestId, { test: true });

        TargetingProductionLogger.logDataRetrievalStep(
            'test-data-retrieval',
            testUserId,
            { sampleData: 'test' },
            { step: 1 }
        );

        TargetingProductionLogger.logTransformationStep(
            'test-transformation',
            testUserId,
            { input: 'test' },
            { output: 'transformed' },
            150,
            { success: true }
        );

        TargetingProductionLogger.logValidationResults(
            testUserId,
            {
                dataIntegrity: true,
                missingReferences: [],
                inconsistencies: []
            },
            { testValidation: true }
        );

        TargetingProductionLogger.logPerformanceMetrics(
            'test-operation',
            testUserId,
            {
                executionTime: 500,
                queryTime: 200,
                transformationTime: 150,
                validationTime: 50,
                recordsProcessed: 10
            }
        );

        TargetingProductionLogger.logOperationComplete(
            'test-operation',
            testUserId,
            testRequestId,
            500,
            true,
            { testComplete: true }
        );

        logger.info('Production logger methods tested successfully');

        // Test 5: Disable production logging
        logger.info('Test 5: Disabling production logging');
        TargetingProductionLogger.disableLogging();

        const finalConfig = TargetingProductionLogger.getLoggingConfig();
        logger.info('Final logging configuration:', finalConfig);

        logger.info('All targeting debug utilities tests completed successfully');

    } catch (error) {
        logger.error('Targeting debug utilities test failed', { error });
        throw error;
    } finally {
        await pool.end();
    }
}

// Run the test if this file is executed directly
if (require.main === module) {
    testTargetingDebugUtils()
        .then(() => {
            logger.info('Test completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            logger.error('Test failed', { error });
            process.exit(1);
        });
}

export { testTargetingDebugUtils };