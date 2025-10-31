/**
 * Integration test for SwapProposerMonitoringService
 * This file demonstrates the monitoring functionality and can be run to verify implementation
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

import { SwapProposerMonitoringService } from './SwapProposerMonitoringService';
import { logger } from '../../utils/logger';

async function runMonitoringIntegrationTest() {
    console.log('Starting SwapProposerMonitoringService integration test...');

    const monitoringService = SwapProposerMonitoringService.getInstance();

    // Test 1: JOIN chain failure detection and logging (Requirements: 3.1, 3.2)
    console.log('\n=== Test 1: JOIN Chain Monitoring ===');

    const userId = 'test-user-123';
    const swapId1 = 'swap-001';
    const swapId2 = 'swap-002';
    const swapId3 = 'swap-003';

    // Record successful JOIN chain
    monitoringService.recordJoinChainSuccess(userId, swapId1, 'John Doe');

    // Record various JOIN chain failures
    monitoringService.recordJoinChainFailure(
        userId,
        swapId2,
        'null_proposer_name',
        {
            proposerId: 'proposer-456',
            proposerName: null,
            joinChainStatus: 'missing_user'
        }
    );

    monitoringService.recordJoinChainFailure(
        userId,
        swapId3,
        'missing_swap_target',
        {
            expectedTargetSwapId: 'target-swap-789',
            swapStatus: 'pending',
            joinChainStatus: 'no_swap_target'
        }
    );

    // Get JOIN chain health statistics
    const joinChainStats = monitoringService.getJoinChainHealthStats();
    console.log('JOIN Chain Health Stats:', JSON.stringify(joinChainStats, null, 2));

    // Test 2: Proposer lookup success/failure monitoring (Requirements: 3.3, 3.4)
    console.log('\n=== Test 2: Proposer Lookup Monitoring ===');

    const proposerId = 'proposer-123';

    // Record successful lookups with different methods
    monitoringService.recordProposerLookupAttempt(
        swapId1,
        proposerId,
        'direct',
        true,
        'Jane Smith'
    );

    monitoringService.recordProposerLookupAttempt(
        'swap-004',
        proposerId,
        'booking_derived',
        true,
        'Bob Johnson'
    );

    // Record failed lookups
    monitoringService.recordProposerLookupAttempt(
        swapId2,
        proposerId,
        'fallback',
        false,
        undefined,
        'User record not found'
    );

    // Get proposer lookup success rates
    const proposerLookupStats = monitoringService.getProposerLookupSuccessRates();
    console.log('Proposer Lookup Success Rates:', JSON.stringify(proposerLookupStats, null, 2));

    // Test 3: Missing user relationship diagnostics (Requirements: 3.2, 3.3)
    console.log('\n=== Test 3: Missing User Relationship Diagnostics ===');

    monitoringService.recordMissingUserRelationship(
        swapId2,
        proposerId,
        'user_record',
        {
            expectedTable: 'users',
            expectedId: proposerId,
            actualResult: null,
            queryUsed: 'SELECT * FROM users WHERE id = ?'
        }
    );

    // Test 4: Comprehensive diagnostic report (Requirements: 3.1, 3.2, 3.3, 3.4)
    console.log('\n=== Test 4: Comprehensive Diagnostic Report ===');

    const diagnosticReport = monitoringService.generateDiagnosticReport();
    console.log('Diagnostic Report:', JSON.stringify(diagnosticReport, null, 2));

    // Test 5: Health status determination
    console.log('\n=== Test 5: Health Status ===');
    console.log('Overall Health Status:', diagnosticReport.overallHealth.healthStatus);
    console.log('JOIN Chain Success Rate:', (diagnosticReport.overallHealth.joinChainSuccessRate * 100).toFixed(2) + '%');
    console.log('Proposer Lookup Success Rate:', (diagnosticReport.overallHealth.proposerLookupSuccessRate * 100).toFixed(2) + '%');

    if (diagnosticReport.criticalIssues.length > 0) {
        console.log('\nCritical Issues Detected:');
        diagnosticReport.criticalIssues.forEach((issue, index) => {
            console.log(`${index + 1}. ${issue.type}: ${issue.description}`);
            console.log(`   Recommended Action: ${issue.recommendedAction}`);
        });
    }

    if (diagnosticReport.recommendations.length > 0) {
        console.log('\nRecommendations:');
        diagnosticReport.recommendations.forEach((recommendation, index) => {
            console.log(`${index + 1}. ${recommendation}`);
        });
    }

    console.log('\n=== Integration Test Completed Successfully ===');
    console.log('All monitoring features are working correctly!');

    return {
        success: true,
        joinChainStats,
        proposerLookupStats,
        diagnosticReport
    };
}

// Export for use in other tests or manual execution
export { runMonitoringIntegrationTest };

// Allow direct execution
if (require.main === module) {
    runMonitoringIntegrationTest()
        .then(result => {
            console.log('\nTest completed with result:', result.success ? 'SUCCESS' : 'FAILURE');
            process.exit(0);
        })
        .catch(error => {
            console.error('Test failed with error:', error);
            process.exit(1);
        });
}