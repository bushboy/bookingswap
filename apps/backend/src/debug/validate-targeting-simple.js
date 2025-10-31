/**
 * Simple JavaScript validation script for targeting display
 * This can be run directly with node without TypeScript compilation
 */

const { Pool } = require('pg');

// Database configuration (matching the .env file)
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'booking_swap_db',
    user: process.env.DB_USER || 'booking_swap',
    password: process.env.DB_PASSWORD || 'P@ssword123',
};

async function validateTargetingDisplay() {
    const pool = new Pool(dbConfig);

    try {
        console.log('🔍 Validating Targeting Display System\n');

        // Step 1: Check if swap_targets table exists
        console.log('1. Checking swap_targets table...');
        try {
            const tableExistsResult = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'swap_targets'
                );
            `);
            const tableExists = tableExistsResult.rows[0].exists;

            if (!tableExists) {
                console.log('   ❌ CRITICAL: swap_targets table does NOT exist!');
                console.log('   → Run database migrations to create the table');
                return;
            }

            console.log('   ✅ swap_targets table exists');

            // Check data count
            const countResult = await pool.query('SELECT COUNT(*) as count FROM swap_targets');
            const recordCount = parseInt(countResult.rows[0].count);
            console.log(`   Records in swap_targets: ${recordCount}`);

            if (recordCount === 0) {
                console.log('   ⚠️  No targeting data found - this is likely the issue!');
            } else {
                // Show sample data
                const sampleResult = await pool.query(`
                    SELECT id, source_swap_id, target_swap_id, status 
                    FROM swap_targets 
                    LIMIT 3
                `);
                console.log('   Sample targeting records:');
                sampleResult.rows.forEach((row, index) => {
                    console.log(`     ${index + 1}. ${row.source_swap_id} → ${row.target_swap_id} (${row.status})`);
                });
            }

        } catch (error) {
            console.log(`   ❌ Error checking swap_targets: ${error.message}`);
        }

        console.log();

        // Step 2: Check existing swaps data (fallback mechanism)
        console.log('2. Checking swaps table for proposal data...');
        try {
            const swapsResult = await pool.query(`
                SELECT 
                    COUNT(*) as total_swaps,
                    COUNT(CASE WHEN target_booking_id IS NOT NULL THEN 1 END) as swaps_with_targets,
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_swaps
                FROM swaps
            `);
            const { total_swaps, swaps_with_targets, pending_swaps } = swapsResult.rows[0];

            console.log(`   Total swaps: ${total_swaps}`);
            console.log(`   Swaps with targets: ${swaps_with_targets}`);
            console.log(`   Pending swaps: ${pending_swaps}`);

            if (swaps_with_targets > 0) {
                console.log('   ✅ Found proposal data that could be used as fallback');
            } else {
                console.log('   ⚠️  No proposal data found in swaps table either');
            }

        } catch (error) {
            console.log(`   ❌ Error checking swaps: ${error.message}`);
        }

        console.log();

        // Step 3: Test the actual repository query
        console.log('3. Testing repository query logic...');
        try {
            // Get a sample user
            const userResult = await pool.query('SELECT id, email FROM users LIMIT 1');

            if (userResult.rows.length === 0) {
                console.log('   ⚠️  No users found - cannot test queries');
            } else {
                const testUser = userResult.rows[0];
                console.log(`   Testing with user: ${testUser.email}`);

                // Test the incoming targets query (simplified version)
                const incomingQuery = `
                    SELECT COUNT(*) as count FROM (
                        -- From swap_targets table
                        SELECT st.id
                        FROM swap_targets st
                        JOIN swaps ts ON st.target_swap_id = ts.id
                        WHERE ts.owner_id = $1 AND st.status = 'active'
                        
                        UNION ALL
                        
                        -- From swaps table (proposals)
                        SELECT p.id
                        FROM swaps p
                        JOIN bookings tb ON p.target_booking_id = tb.id
                        WHERE tb.user_id = $1 
                        AND p.status = 'pending'
                        AND p.proposer_id != $1
                    ) combined
                `;

                const incomingResult = await pool.query(incomingQuery, [testUser.id]);
                const incomingCount = parseInt(incomingResult.rows[0].count);
                console.log(`   Incoming targets for ${testUser.email}: ${incomingCount}`);

                // Test the outgoing targets query (simplified version)
                const outgoingQuery = `
                    SELECT COUNT(*) as count FROM (
                        -- From swap_targets table
                        SELECT st.id
                        FROM swap_targets st
                        JOIN swaps ss ON st.source_swap_id = ss.id
                        WHERE ss.owner_id = $1 AND st.status = 'active'
                        
                        UNION ALL
                        
                        -- From swaps table (user's proposals)
                        SELECT p.id
                        FROM swaps p
                        JOIN bookings tb ON p.target_booking_id = tb.id
                        WHERE p.proposer_id = $1
                        AND p.status = 'pending'
                        AND tb.user_id != $1
                    ) combined
                `;

                const outgoingResult = await pool.query(outgoingQuery, [testUser.id]);
                const outgoingCount = parseInt(outgoingResult.rows[0].count);
                console.log(`   Outgoing targets for ${testUser.email}: ${outgoingCount}`);

                if (incomingCount === 0 && outgoingCount === 0) {
                    console.log('   ⚠️  No targeting data found for this user');
                } else {
                    console.log('   ✅ Found targeting data - the queries should work');
                }
            }

        } catch (error) {
            console.log(`   ❌ Error testing queries: ${error.message}`);
        }

        console.log();

        // Step 4: Diagnosis and recommendations
        console.log('📋 DIAGNOSIS:');

        const swapTargetsExists = await pool.query(`
            SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'swap_targets')
        `).then(result => result.rows[0].exists);

        const swapTargetsHasData = swapTargetsExists ?
            await pool.query('SELECT COUNT(*) as count FROM swap_targets').then(result => parseInt(result.rows[0].count) > 0) :
            false;

        const swapsHasProposals = await pool.query(`
            SELECT COUNT(*) as count FROM swaps WHERE target_booking_id IS NOT NULL AND status = 'pending'
        `).then(result => parseInt(result.rows[0].count) > 0);

        console.log(`   swap_targets table exists: ${swapTargetsExists ? '✅' : '❌'}`);
        console.log(`   swap_targets has data: ${swapTargetsHasData ? '✅' : '❌'}`);
        console.log(`   swaps has proposal data: ${swapsHasProposals ? '✅' : '❌'}`);

        console.log();
        console.log('🎯 ROOT CAUSE:');

        if (!swapTargetsExists) {
            console.log('   ❌ The swap_targets table does not exist');
            console.log('   → Run database migrations: npm run migrate');
        } else if (!swapTargetsHasData && !swapsHasProposals) {
            console.log('   ❌ No targeting data exists in either table');
            console.log('   → Create test data or verify the targeting creation workflow');
        } else if (!swapTargetsHasData && swapsHasProposals) {
            console.log('   ⚠️  swap_targets table is empty but swaps table has proposals');
            console.log('   → The fallback mechanism should work, but may have a bug');
            console.log('   → Check the SwapTargetingRepository.getTargetingDataForUserSwaps() method');
        } else {
            console.log('   ✅ Data exists - the issue may be in the service layer or frontend');
            console.log('   → Check the SimpleTargetingTransformer');
            console.log('   → Check the SwapProposalService.getUserSwapsWithTargeting() method');
            console.log('   → Check the frontend SwapCard component');
        }

        console.log();
        console.log('🔧 NEXT STEPS:');
        console.log('   1. Create test targeting data if none exists');
        console.log('   2. Test the API endpoint: GET /api/swaps');
        console.log('   3. Check the browser network tab for API responses');
        console.log('   4. Verify the frontend component receives targeting data');

    } catch (error) {
        console.error('❌ Critical error during validation:', error.message);
    } finally {
        await pool.end();
    }
}

// Run the validation
validateTargetingDisplay()
    .then(() => {
        console.log('\n✅ Targeting display validation completed');
    })
    .catch((error) => {
        console.error('\n❌ Validation failed:', error.message);
        process.exit(1);
    });