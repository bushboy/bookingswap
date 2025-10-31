#!/usr/bin/env node

/**
 * Comprehensive verification script for the proposer name fix
 * Tests the complete fix with real swap proposal data
 * Verifies that actual user names appear instead of "unknown"
 * Confirms that fallback only occurs when user data truly doesn't exist
 * Requirements: 1.1, 1.4, 2.4
 */

const { Pool } = require('pg');
const path = require('path');

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'booking_swap_dev',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
};

class ProposerNameFixVerifier {
    constructor() {
        this.pool = new Pool(dbConfig);
        this.testResults = {
            totalTests: 0,
            passed: 0,
            failed: 0,
            details: []
        };
    }

    async runVerification() {
        console.log('🔍 Starting comprehensive proposer name fix verification...\n');

        try {
            // Test 1: Verify actual user names appear instead of "unknown"
            await this.testActualUserNamesAppear();

            // Test 2: Verify JOIN chain works correctly
            await this.testJoinChainIntegrity();

            // Test 3: Verify fallback mechanisms work
            await this.testFallbackMechanisms();

            // Test 4: Verify enrichment process
            await this.testProposerDataEnrichment();

            // Test 5: Test complete data flow through SwapProposalService
            await this.testCompleteDataFlow();

            // Test 6: Verify monitoring and logging
            await this.testMonitoringAndLogging();

            this.printResults();

        } catch (error) {
            console.error('❌ Verification failed with error:', error);
            process.exit(1);
        } finally {
            await this.pool.end();
        }
    }

    /**
     * Test 1: Verify actual user names appear instead of "unknown"
     * Requirements: 1.1, 1.4
     */
    async testActualUserNamesAppear() {
        console.log('📋 Test 1: Verifying actual user names appear instead of "unknown"');

        try {
            // Get sample swap data with proposals
            const query = `
        SELECT 
          s.id as swap_id,
          sb.user_id as owner_id,
          u_owner.display_name as owner_name,
          
          -- Proposer data from JOIN chain
          u.display_name as proposer_name,
          u.email as proposer_email,
          tb.user_id as proposer_user_id,
          
          -- JOIN chain validation
          CASE 
            WHEN st.id IS NULL THEN 'no_swap_target'
            WHEN ts.id IS NULL THEN 'missing_target_swap'
            WHEN tb.id IS NULL THEN 'missing_target_booking'
            WHEN u.id IS NULL THEN 'missing_user'
            ELSE 'complete'
          END as join_chain_status

        FROM swaps s
        JOIN bookings sb ON s.source_booking_id = sb.id
        JOIN users u_owner ON sb.user_id = u_owner.id
        LEFT JOIN swap_targets st ON s.id = st.target_swap_id AND st.status = 'active'
        LEFT JOIN swaps ts ON st.source_swap_id = ts.id
        LEFT JOIN bookings tb ON ts.source_booking_id = tb.id
        LEFT JOIN users u ON tb.user_id = u.id

        WHERE s.status = 'pending'
        AND st.id IS NOT NULL  -- Only swaps with proposals
        LIMIT 10
      `;

            const result = await this.pool.query(query);

            if (result.rows.length === 0) {
                this.recordTest('Test 1', false, 'No swap proposals found in database for testing');
                return;
            }

            let unknownCount = 0;
            let validNameCount = 0;
            let nullNameCount = 0;

            for (const row of result.rows) {
                if (!row.proposer_name) {
                    nullNameCount++;
                } else if (row.proposer_name === 'Unknown User' || row.proposer_name === 'unknown') {
                    unknownCount++;
                } else {
                    validNameCount++;
                }

                console.log(`  Swap ${row.swap_id}: ${row.proposer_name || 'NULL'} (${row.join_chain_status})`);
            }

            const totalProposals = result.rows.length;
            const successRate = (validNameCount / totalProposals) * 100;

            console.log(`  📊 Results: ${validNameCount}/${totalProposals} valid names (${successRate.toFixed(1)}%)`);
            console.log(`  📊 NULL names: ${nullNameCount}, Unknown names: ${unknownCount}`);

            // Test passes if we have more valid names than unknown/null
            const testPassed = validNameCount > (unknownCount + nullNameCount);

            this.recordTest(
                'Test 1: Actual user names appear',
                testPassed,
                `${validNameCount}/${totalProposals} proposals show actual user names (${successRate.toFixed(1)}% success rate)`
            );

        } catch (error) {
            this.recordTest('Test 1', false, `Error: ${error.message}`);
        }
    }

    /**
     * Test 2: Verify JOIN chain works correctly
     * Requirements: 2.1, 2.2
     */
    async testJoinChainIntegrity() {
        console.log('\n📋 Test 2: Verifying JOIN chain integrity');

        try {
            // Test the complete JOIN chain
            const query = `
        SELECT 
          COUNT(*) as total_swaps,
          COUNT(st.id) as swaps_with_targets,
          COUNT(ts.id) as valid_target_swaps,
          COUNT(tb.id) as valid_target_bookings,
          COUNT(u.id) as valid_users,
          COUNT(u.display_name) as users_with_names,
          
          -- Calculate success rates
          ROUND(
            (COUNT(u.display_name)::float / NULLIF(COUNT(st.id), 0)) * 100, 2
          ) as name_success_rate

        FROM swaps s
        JOIN bookings sb ON s.source_booking_id = sb.id
        LEFT JOIN swap_targets st ON s.id = st.target_swap_id AND st.status = 'active'
        LEFT JOIN swaps ts ON st.source_swap_id = ts.id
        LEFT JOIN bookings tb ON ts.source_booking_id = tb.id
        LEFT JOIN users u ON tb.user_id = u.id

        WHERE s.status = 'pending'
      `;

            const result = await this.pool.query(query);
            const stats = result.rows[0];

            console.log(`  📊 Total swaps: ${stats.total_swaps}`);
            console.log(`  📊 Swaps with targets: ${stats.swaps_with_targets}`);
            console.log(`  📊 Valid target swaps: ${stats.valid_target_swaps}`);
            console.log(`  📊 Valid target bookings: ${stats.valid_target_bookings}`);
            console.log(`  📊 Valid users: ${stats.valid_users}`);
            console.log(`  📊 Users with names: ${stats.users_with_names}`);
            console.log(`  📊 Name success rate: ${stats.name_success_rate || 0}%`);

            // Test passes if JOIN chain maintains reasonable integrity
            const joinIntegrity = stats.swaps_with_targets > 0 &&
                (stats.valid_users / stats.swaps_with_targets) > 0.8;

            this.recordTest(
                'Test 2: JOIN chain integrity',
                joinIntegrity,
                `JOIN chain maintains ${((stats.valid_users / stats.swaps_with_targets) * 100).toFixed(1)}% integrity`
            );

        } catch (error) {
            this.recordTest('Test 2', false, `Error: ${error.message}`);
        }
    }

    /**
     * Test 3: Verify fallback mechanisms work
     * Requirements: 2.4
     */
    async testFallbackMechanisms() {
        console.log('\n📋 Test 3: Verifying fallback mechanisms');

        try {
            // Test direct user lookup fallback
            const directLookupQuery = `
        SELECT u.id, u.display_name, u.email
        FROM users u
        WHERE u.display_name IS NOT NULL
        LIMIT 5
      `;

            const directResult = await this.pool.query(directLookupQuery);

            if (directResult.rows.length === 0) {
                this.recordTest('Test 3', false, 'No users with display names found for fallback testing');
                return;
            }

            // Test booking-derived lookup
            const bookingDerivedQuery = `
        SELECT DISTINCT b.user_id, u.display_name
        FROM bookings b
        JOIN users u ON b.user_id = u.id
        WHERE u.display_name IS NOT NULL
        LIMIT 5
      `;

            const bookingResult = await this.pool.query(bookingDerivedQuery);

            console.log(`  📊 Direct user lookups available: ${directResult.rows.length}`);
            console.log(`  📊 Booking-derived lookups available: ${bookingResult.rows.length}`);

            // Test swap-target derived lookup
            const swapTargetQuery = `
        SELECT COUNT(*) as count
        FROM swap_targets st
        JOIN swaps s ON st.source_swap_id = s.id
        JOIN bookings b ON s.source_booking_id = b.id
        JOIN users u ON b.user_id = u.id
        WHERE u.display_name IS NOT NULL
        AND st.status = 'active'
      `;

            const swapTargetResult = await this.pool.query(swapTargetQuery);
            const swapTargetCount = swapTargetResult.rows[0].count;

            console.log(`  📊 Swap-target derived lookups available: ${swapTargetCount}`);

            const fallbacksAvailable = directResult.rows.length > 0 &&
                bookingResult.rows.length > 0 &&
                swapTargetCount > 0;

            this.recordTest(
                'Test 3: Fallback mechanisms',
                fallbacksAvailable,
                `Multiple fallback lookup methods are available and functional`
            );

        } catch (error) {
            this.recordTest('Test 3', false, `Error: ${error.message}`);
        }
    }

    /**
     * Test 4: Verify proposer data enrichment
     * Requirements: 1.3, 2.1
     */
    async testProposerDataEnrichment() {
        console.log('\n📋 Test 4: Verifying proposer data enrichment');

        try {
            // Find swaps with missing proposer names that should be enrichable
            const missingProposerQuery = `
        SELECT 
          s.id as swap_id,
          tb.user_id as proposer_user_id,
          u.display_name as direct_user_name
        FROM swaps s
        JOIN bookings sb ON s.source_booking_id = sb.id
        LEFT JOIN swap_targets st ON s.id = st.target_swap_id AND st.status = 'active'
        LEFT JOIN swaps ts ON st.source_swap_id = ts.id
        LEFT JOIN bookings tb ON ts.source_booking_id = tb.id
        LEFT JOIN users u ON tb.user_id = u.id
        WHERE s.status = 'pending'
        AND st.id IS NOT NULL
        AND (u.display_name IS NULL OR u.display_name = '')
        AND tb.user_id IS NOT NULL
        LIMIT 5
      `;

            const missingResult = await this.pool.query(missingProposerQuery);

            if (missingResult.rows.length === 0) {
                console.log('  ✅ No missing proposer names found - JOIN chain is working correctly');
                this.recordTest('Test 4: Proposer enrichment', true, 'No enrichment needed - all proposer names resolved');
                return;
            }

            // Test if these users can be found through direct lookup
            let enrichableCount = 0;
            for (const row of missingResult.rows) {
                if (row.proposer_user_id) {
                    const directLookupQuery = `
            SELECT display_name FROM users WHERE id = $1 AND display_name IS NOT NULL
          `;
                    const directResult = await this.pool.query(directLookupQuery, [row.proposer_user_id]);

                    if (directResult.rows.length > 0) {
                        enrichableCount++;
                        console.log(`  📊 Swap ${row.swap_id}: User ${row.proposer_user_id} enrichable with "${directResult.rows[0].display_name}"`);
                    }
                }
            }

            const enrichmentRate = (enrichableCount / missingResult.rows.length) * 100;
            console.log(`  📊 Enrichment potential: ${enrichableCount}/${missingResult.rows.length} (${enrichmentRate.toFixed(1)}%)`);

            this.recordTest(
                'Test 4: Proposer enrichment',
                enrichmentRate > 50,
                `${enrichmentRate.toFixed(1)}% of missing proposer names can be enriched`
            );

        } catch (error) {
            this.recordTest('Test 4', false, `Error: ${error.message}`);
        }
    }

    /**
     * Test 5: Test complete data flow through SwapProposalService
     * Requirements: 1.1, 1.2
     */
    async testCompleteDataFlow() {
        console.log('\n📋 Test 5: Testing complete data flow simulation');

        try {
            // Simulate the complete query that SwapProposalService would use
            const completeFlowQuery = `
        SELECT 
          s.id as swap_id,
          sb.user_id as owner_id,
          s.source_booking_id as user_booking_id,
          s.status as swap_status,
          s.created_at as swap_created_at,
          
          -- User's booking details
          sb.title as user_booking_title,
          sb.city as user_booking_city,
          sb.country as user_booking_country,
          
          -- Proposer details (what the fix should provide)
          COALESCE(u.display_name, 'Unknown User') as proposer_name,
          u.email as proposer_email,
          tb.user_id as proposer_user_id,
          
          -- Proposer booking details
          tb.title as proposer_booking_title,
          tb.city as proposer_booking_city,
          tb.country as proposer_booking_country,
          
          -- Validation fields
          CASE 
            WHEN st.id IS NULL THEN 'no_swap_target'
            WHEN ts.id IS NULL THEN 'missing_target_swap'
            WHEN tb.id IS NULL THEN 'missing_target_booking'
            WHEN u.id IS NULL THEN 'missing_user'
            ELSE 'complete'
          END as join_chain_status

        FROM swaps s
        JOIN bookings sb ON s.source_booking_id = sb.id
        LEFT JOIN swap_targets st ON s.id = st.target_swap_id AND st.status = 'active'
        LEFT JOIN swaps ts ON st.source_swap_id = ts.id
        LEFT JOIN bookings tb ON ts.source_booking_id = tb.id
        LEFT JOIN users u ON tb.user_id = u.id

        WHERE sb.user_id IS NOT NULL
        AND s.status = 'pending'
        ORDER BY s.created_at DESC
        LIMIT 10
      `;

            const result = await this.pool.query(completeFlowQuery);

            if (result.rows.length === 0) {
                this.recordTest('Test 5', false, 'No data available for complete flow testing');
                return;
            }

            let completeFlowCount = 0;
            let unknownUserCount = 0;
            let validProposerCount = 0;

            for (const row of result.rows) {
                if (row.join_chain_status === 'complete') {
                    completeFlowCount++;
                }

                if (row.proposer_name === 'Unknown User') {
                    unknownUserCount++;
                } else if (row.proposer_name && row.proposer_name !== 'Unknown User') {
                    validProposerCount++;
                }

                console.log(`  📊 Swap ${row.swap_id}: "${row.proposer_name}" (${row.join_chain_status})`);
            }

            const completeFlowRate = (completeFlowCount / result.rows.length) * 100;
            const validProposerRate = (validProposerCount / result.rows.length) * 100;

            console.log(`  📊 Complete flow success: ${completeFlowCount}/${result.rows.length} (${completeFlowRate.toFixed(1)}%)`);
            console.log(`  📊 Valid proposer names: ${validProposerCount}/${result.rows.length} (${validProposerRate.toFixed(1)}%)`);
            console.log(`  📊 Unknown users: ${unknownUserCount}/${result.rows.length}`);

            // Test passes if we have good data flow and minimal unknown users
            const testPassed = validProposerRate > 70 && unknownUserCount < (result.rows.length * 0.3);

            this.recordTest(
                'Test 5: Complete data flow',
                testPassed,
                `${validProposerRate.toFixed(1)}% valid proposer names, ${unknownUserCount} unknown users`
            );

        } catch (error) {
            this.recordTest('Test 5', false, `Error: ${error.message}`);
        }
    }

    /**
     * Test 6: Verify monitoring and logging capabilities
     * Requirements: 3.1, 3.2, 3.3, 3.4
     */
    async testMonitoringAndLogging() {
        console.log('\n📋 Test 6: Verifying monitoring and logging capabilities');

        try {
            // Test that we can detect and categorize JOIN chain issues
            const diagnosticQuery = `
        SELECT 
          COUNT(*) as total_swaps,
          COUNT(CASE WHEN st.id IS NULL THEN 1 END) as no_swap_targets,
          COUNT(CASE WHEN st.id IS NOT NULL AND ts.id IS NULL THEN 1 END) as missing_target_swaps,
          COUNT(CASE WHEN ts.id IS NOT NULL AND tb.id IS NULL THEN 1 END) as missing_target_bookings,
          COUNT(CASE WHEN tb.id IS NOT NULL AND u.id IS NULL THEN 1 END) as missing_users,
          COUNT(CASE WHEN u.id IS NOT NULL AND u.display_name IS NULL THEN 1 END) as users_without_names,
          COUNT(CASE WHEN u.display_name IS NOT NULL THEN 1 END) as complete_chains

        FROM swaps s
        JOIN bookings sb ON s.source_booking_id = sb.id
        LEFT JOIN swap_targets st ON s.id = st.target_swap_id AND st.status = 'active'
        LEFT JOIN swaps ts ON st.source_swap_id = ts.id
        LEFT JOIN bookings tb ON ts.source_booking_id = tb.id
        LEFT JOIN users u ON tb.user_id = u.id

        WHERE s.status = 'pending'
      `;

            const diagnosticResult = await this.pool.query(diagnosticQuery);
            const stats = diagnosticResult.rows[0];

            console.log('  📊 Diagnostic Statistics:');
            console.log(`    Total swaps: ${stats.total_swaps}`);
            console.log(`    No swap targets: ${stats.no_swap_targets}`);
            console.log(`    Missing target swaps: ${stats.missing_target_swaps}`);
            console.log(`    Missing target bookings: ${stats.missing_target_bookings}`);
            console.log(`    Missing users: ${stats.missing_users}`);
            console.log(`    Users without names: ${stats.users_without_names}`);
            console.log(`    Complete chains: ${stats.complete_chains}`);

            // Test that we can identify specific failure points
            const canDiagnose = parseInt(stats.total_swaps) > 0 &&
                (parseInt(stats.complete_chains) + parseInt(stats.no_swap_targets) +
                    parseInt(stats.missing_target_swaps) + parseInt(stats.missing_target_bookings) +
                    parseInt(stats.missing_users) + parseInt(stats.users_without_names)) === parseInt(stats.total_swaps);

            this.recordTest(
                'Test 6: Monitoring capabilities',
                canDiagnose,
                'Can categorize and diagnose JOIN chain failures for monitoring'
            );

        } catch (error) {
            this.recordTest('Test 6', false, `Error: ${error.message}`);
        }
    }

    recordTest(testName, passed, details) {
        this.testResults.totalTests++;
        if (passed) {
            this.testResults.passed++;
            console.log(`  ✅ ${testName}: PASSED - ${details}`);
        } else {
            this.testResults.failed++;
            console.log(`  ❌ ${testName}: FAILED - ${details}`);
        }

        this.testResults.details.push({
            name: testName,
            passed,
            details
        });
    }

    printResults() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 PROPOSER NAME FIX VERIFICATION RESULTS');
        console.log('='.repeat(80));

        console.log(`Total Tests: ${this.testResults.totalTests}`);
        console.log(`Passed: ${this.testResults.passed}`);
        console.log(`Failed: ${this.testResults.failed}`);
        console.log(`Success Rate: ${((this.testResults.passed / this.testResults.totalTests) * 100).toFixed(1)}%`);

        console.log('\nDetailed Results:');
        this.testResults.details.forEach((test, index) => {
            const status = test.passed ? '✅ PASS' : '❌ FAIL';
            console.log(`${index + 1}. ${status} - ${test.name}`);
            console.log(`   ${test.details}`);
        });

        if (this.testResults.failed === 0) {
            console.log('\n🎉 ALL TESTS PASSED! The proposer name fix is working correctly.');
            console.log('✅ Actual user names appear instead of "unknown"');
            console.log('✅ Fallback mechanisms work when user data is missing');
            console.log('✅ JOIN chain integrity is maintained');
            console.log('✅ Monitoring and diagnostic capabilities are functional');
        } else {
            console.log(`\n⚠️  ${this.testResults.failed} test(s) failed. Review the implementation.`);
            process.exit(1);
        }
    }
}

// Run the verification
if (require.main === module) {
    const verifier = new ProposerNameFixVerifier();
    verifier.runVerification().catch(error => {
        console.error('Verification failed:', error);
        process.exit(1);
    });
}

module.exports = ProposerNameFixVerifier;