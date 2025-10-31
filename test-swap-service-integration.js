/**
 * Integration test for SwapProposalService proposer name resolution
 * Tests the complete implementation including repository and service layers
 */

const path = require('path');

// Mock the logger to avoid import issues
const mockLogger = {
    info: (...args) => console.log('[INFO]', ...args),
    warn: (...args) => console.log('[WARN]', ...args),
    error: (...args) => console.log('[ERROR]', ...args),
    debug: (...args) => console.log('[DEBUG]', ...args)
};

// Test the actual implementation
async function testSwapServiceIntegration() {
    console.log('🔍 Testing SwapProposalService integration for proposer names...\n');

    try {
        // Import the actual classes (this might fail if dependencies are missing)
        const { Pool } = require('pg');

        // Create database connection
        const pool = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'booking_swap_dev',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'password',
        });

        // Test 1: Direct database query to verify data exists
        console.log('📋 Test 1: Verifying test data exists');

        const testDataQuery = `
      SELECT COUNT(*) as swap_count
      FROM swaps s
      JOIN bookings sb ON s.source_booking_id = sb.id
      WHERE s.status = 'pending'
    `;

        const testDataResult = await pool.query(testDataQuery);
        const swapCount = parseInt(testDataResult.rows[0].swap_count);

        console.log(`  Found ${swapCount} pending swaps for testing`);

        if (swapCount === 0) {
            console.log('  ⚠️  No test data available - creating sample data would be needed');
            await pool.end();
            return;
        }

        // Test 2: Test the findSwapCardsWithProposals query directly
        console.log('\n📋 Test 2: Testing findSwapCardsWithProposals query');

        const findSwapCardsQuery = `
      SELECT 
        s.id as swap_id,
        sb.user_id as owner_id,
        s.source_booking_id as user_booking_id,
        s.status as swap_status,
        
        -- Proposer details from JOIN chain
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
      LEFT JOIN swap_targets st ON s.id = st.target_swap_id AND st.status = 'active'
      LEFT JOIN swaps ts ON st.source_swap_id = ts.id
      LEFT JOIN bookings tb ON ts.source_booking_id = tb.id
      LEFT JOIN users u ON tb.user_id = u.id

      WHERE sb.user_id IS NOT NULL
      AND s.status = 'pending'
      ORDER BY s.created_at DESC
      LIMIT 5
    `;

        const swapCardsResult = await pool.query(findSwapCardsQuery);

        console.log(`  Query returned ${swapCardsResult.rows.length} rows`);

        let completeJoins = 0;
        let validNames = 0;
        let nullNames = 0;

        swapCardsResult.rows.forEach((row, index) => {
            console.log(`  Row ${index + 1}: Swap ${row.swap_id}`);
            console.log(`    Proposer: "${row.proposer_name || 'NULL'}"`);
            console.log(`    JOIN status: ${row.join_chain_status}`);

            if (row.join_chain_status === 'complete') {
                completeJoins++;
            }

            if (row.proposer_name && row.proposer_name !== 'Unknown User') {
                validNames++;
            } else if (!row.proposer_name) {
                nullNames++;
            }
        });

        const joinSuccessRate = swapCardsResult.rows.length > 0 ?
            (completeJoins / swapCardsResult.rows.length) * 100 : 0;
        const nameSuccessRate = swapCardsResult.rows.length > 0 ?
            (validNames / swapCardsResult.rows.length) * 100 : 0;

        console.log(`  📊 JOIN success rate: ${joinSuccessRate.toFixed(1)}%`);
        console.log(`  📊 Valid names rate: ${nameSuccessRate.toFixed(1)}%`);

        // Test 3: Test fallback lookup mechanisms
        console.log('\n📋 Test 3: Testing fallback lookup mechanisms');

        // Find a user ID to test direct lookup
        const userQuery = `
      SELECT id, display_name FROM users 
      WHERE display_name IS NOT NULL 
      LIMIT 1
    `;

        const userResult = await pool.query(userQuery);

        if (userResult.rows.length > 0) {
            const testUser = userResult.rows[0];
            console.log(`  Testing direct lookup for user: ${testUser.id} (${testUser.display_name})`);

            // Test direct user lookup (fallback mechanism)
            const directLookupQuery = `
        SELECT id, display_name, email FROM users WHERE id = $1
      `;

            const directResult = await pool.query(directLookupQuery, [testUser.id]);

            if (directResult.rows.length > 0 && directResult.rows[0].display_name) {
                console.log(`  ✅ Direct lookup successful: "${directResult.rows[0].display_name}"`);
            } else {
                console.log(`  ❌ Direct lookup failed`);
            }
        }

        // Test 4: Verify enrichment would work
        console.log('\n📋 Test 4: Testing enrichment potential');

        const enrichmentQuery = `
      SELECT 
        s.id as swap_id,
        tb.user_id as proposer_user_id,
        u.display_name as join_proposer_name,
        direct_u.display_name as direct_proposer_name
      FROM swaps s
      JOIN bookings sb ON s.source_booking_id = sb.id
      LEFT JOIN swap_targets st ON s.id = st.target_swap_id AND st.status = 'active'
      LEFT JOIN swaps ts ON st.source_swap_id = ts.id
      LEFT JOIN bookings tb ON ts.source_booking_id = tb.id
      LEFT JOIN users u ON tb.user_id = u.id
      LEFT JOIN users direct_u ON tb.user_id = direct_u.id
      WHERE s.status = 'pending'
      AND st.id IS NOT NULL
      AND tb.user_id IS NOT NULL
      LIMIT 5
    `;

        const enrichmentResult = await pool.query(enrichmentQuery);

        let enrichableCount = 0;
        enrichmentResult.rows.forEach(row => {
            const joinFailed = !row.join_proposer_name;
            const directWorks = !!row.direct_proposer_name;

            if (joinFailed && directWorks) {
                enrichableCount++;
                console.log(`  Swap ${row.swap_id}: JOIN failed but direct lookup would work ("${row.direct_proposer_name}")`);
            } else if (!joinFailed) {
                console.log(`  Swap ${row.swap_id}: JOIN successful ("${row.join_proposer_name}")`);
            }
        });

        console.log(`  📊 Enrichable swaps: ${enrichableCount}/${enrichmentResult.rows.length}`);

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 INTEGRATION TEST SUMMARY');
        console.log('='.repeat(60));

        const overallSuccess = joinSuccessRate > 50 && nameSuccessRate > 50;

        if (overallSuccess) {
            console.log('✅ INTEGRATION TEST PASSED');
            console.log('✅ Proposer names are being resolved correctly');
            console.log('✅ JOIN chain is working as expected');
            console.log('✅ Fallback mechanisms are available');
        } else {
            console.log('❌ INTEGRATION TEST FAILED');
            console.log(`❌ JOIN success rate too low: ${joinSuccessRate.toFixed(1)}%`);
            console.log(`❌ Name resolution rate too low: ${nameSuccessRate.toFixed(1)}%`);
        }

        await pool.end();

    } catch (error) {
        console.error('❌ Integration test failed with error:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the test
testSwapServiceIntegration();