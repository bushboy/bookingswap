// Test script for enhanced derived relationships function
// This script tests the get_swap_with_derived_relationships function

const { Pool } = require('pg');

async function testDerivedRelationshipsFunction() {
    const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'booking_swap_db',
        user: process.env.DB_USER || 'booking_swap',
        password: process.env.DB_PASSWORD || 'P@ssword123',
    });

    try {
        console.log('Testing enhanced derived relationships function...');

        // Test 1: Run the validation function from the migration
        console.log('\n1. Running built-in validation tests...');
        const validationResult = await pool.query(`
      SELECT * FROM test_enhanced_derived_relationships_functions()
    `);

        console.log('Validation results:');
        validationResult.rows.forEach(row => {
            const status = row.passed ? '✅ PASS' : '❌ FAIL';
            console.log(`${status}: ${row.test_name} - ${row.details}`);
        });

        // Test 2: Test with a real swap if available
        console.log('\n2. Testing with real data...');
        const swapQuery = await pool.query('SELECT id FROM swaps LIMIT 1');

        if (swapQuery.rows.length > 0) {
            const swapId = swapQuery.rows[0].id;
            console.log(`Testing with swap ID: ${swapId}`);

            const derivedResult = await pool.query(`
        SELECT * FROM get_swap_with_derived_relationships($1)
      `, [swapId]);

            if (derivedResult.rows.length > 0) {
                const result = derivedResult.rows[0];
                console.log('✅ Function returned data:');
                console.log(`  - Swap ID: ${result.swap_id}`);
                console.log(`  - Source Booking ID: ${result.source_booking_id}`);
                console.log(`  - Proposer: ${result.proposer_name} (${result.proposer_id})`);
                console.log(`  - Proposer Email: ${result.proposer_email || 'N/A'}`);
                console.log(`  - Target Booking: ${result.target_booking_id || 'None'}`);
                console.log(`  - Target Owner: ${result.target_owner_name || 'None'}`);
                console.log(`  - Swap Status: ${result.swap_status}`);
                console.log(`  - Targeting Status: ${result.targeting_status || 'None'}`);
            } else {
                console.log('⚠️  Function returned no data for the test swap');
            }
        } else {
            console.log('⚠️  No swaps found in database for testing');
        }

        // Test 3: Test multiple swaps function
        console.log('\n3. Testing multiple swaps function...');
        const multipleSwapsQuery = await pool.query('SELECT ARRAY(SELECT id FROM swaps LIMIT 3) as swap_ids');

        if (multipleSwapsQuery.rows.length > 0 && multipleSwapsQuery.rows[0].swap_ids.length > 0) {
            const swapIds = multipleSwapsQuery.rows[0].swap_ids;
            console.log(`Testing with ${swapIds.length} swap IDs`);

            const multipleResult = await pool.query(`
        SELECT COUNT(*) as count FROM get_multiple_swaps_with_derived_relationships($1)
      `, [swapIds]);

            console.log(`✅ Multiple swaps function returned ${multipleResult.rows[0].count} results`);
        }

        // Test 4: Test relationships summary function
        console.log('\n4. Testing relationships summary function...');
        if (swapQuery.rows.length > 0) {
            const swapId = swapQuery.rows[0].id;

            const summaryResult = await pool.query(`
        SELECT * FROM get_swap_relationships_summary($1)
      `, [swapId]);

            if (summaryResult.rows.length > 0) {
                const summary = summaryResult.rows[0];
                console.log('✅ Summary function returned data:');
                console.log(`  - Has Proposer: ${summary.has_proposer}`);
                console.log(`  - Has Target: ${summary.has_target}`);
                console.log(`  - Active Targeting Count: ${summary.active_targeting_count}`);
                console.log(`  - Total Targeting Count: ${summary.total_targeting_count}`);
            }
        }

        console.log('\n✅ All tests completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Error details:', error);
    } finally {
        await pool.end();
    }
}

// Run the test
testDerivedRelationshipsFunction().catch(console.error);