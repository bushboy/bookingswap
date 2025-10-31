/**
 * Diagnostic script to trace the targeting data flow from database to UI
 * This will help identify exactly where the targeting data is getting lost
 */

import { Pool } from 'pg';

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'booking_swap',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
};

async function diagnoseTargetingDataFlow(): Promise<void> {
    const pool = new Pool(dbConfig);

    try {
        console.log('🔍 Diagnosing Targeting Data Flow\n');

        // Step 1: Check if swap_targets table exists and has data
        console.log('1. Checking swap_targets table...');
        try {
            const swapTargetsExistsQuery = `
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'swap_targets'
                );
            `;
            const existsResult = await pool.query(swapTargetsExistsQuery);
            const tableExists = existsResult.rows[0].exists;

            if (!tableExists) {
                console.log('   ❌ swap_targets table does NOT exist!');
                console.log('   This is the primary issue - the targeting system expects this table.');
                return;
            }

            console.log('   ✅ swap_targets table exists');

            // Check table structure
            const structureQuery = `
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'swap_targets'
                ORDER BY ordinal_position;
            `;
            const structureResult = await pool.query(structureQuery);
            console.log('   Table structure:');
            structureResult.rows.forEach(row => {
                console.log(`     - ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
            });

            // Check data count
            const countQuery = `SELECT COUNT(*) as total FROM swap_targets`;
            const countResult = await pool.query(countQuery);
            const totalRecords = countResult.rows[0].total;
            console.log(`   Total records: ${totalRecords}`);

            if (totalRecords > 0) {
                // Show sample data
                const sampleQuery = `
                    SELECT id, source_swap_id, target_swap_id, proposal_id, status, created_at
                    FROM swap_targets
                    ORDER BY created_at DESC
                    LIMIT 5
                `;
                const sampleResult = await pool.query(sampleQuery);
                console.log('   Sample records:');
                sampleResult.rows.forEach((row, index) => {
                    console.log(`     ${index + 1}. ID: ${row.id}, Source: ${row.source_swap_id}, Target: ${row.target_swap_id}, Status: ${row.status}`);
                });
            } else {
                console.log('   ⚠️  No records in swap_targets table');
            }

        } catch (error) {
            console.log(`   ❌ Error checking swap_targets: ${error.message}`);
        }

        console.log();

        // Step 2: Check swaps table for proposal data (fallback mechanism)
        console.log('2. Checking swaps table for proposal data...');
        try {
            const swapsQuery = `
                SELECT COUNT(*) as total_swaps,
                       COUNT(CASE WHEN target_booking_id IS NOT NULL THEN 1 END) as swaps_with_targets,
                       COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_swaps
                FROM swaps
            `;
            const swapsResult = await pool.query(swapsQuery);
            const { total_swaps, swaps_with_targets, pending_swaps } = swapsResult.rows[0];

            console.log(`   Total swaps: ${total_swaps}`);
            console.log(`   Swaps with targets: ${swaps_with_targets}`);
            console.log(`   Pending swaps: ${pending_swaps}`);

            if (swaps_with_targets > 0) {
                // Show sample targeting relationships from swaps table
                const sampleSwapsQuery = `
                    SELECT s.id, s.proposer_id, s.target_booking_id, s.status,
                           u1.email as proposer_email,
                           b.title as target_booking_title,
                           u2.email as target_owner_email
                    FROM swaps s
                    JOIN users u1 ON s.proposer_id = u1.id
                    JOIN bookings b ON s.target_booking_id = b.id
                    JOIN users u2 ON b.user_id = u2.id
                    WHERE s.target_booking_id IS NOT NULL
                    AND s.status = 'pending'
                    LIMIT 3
                `;
                const sampleSwapsResult = await pool.query(sampleSwapsQuery);
                console.log('   Sample targeting relationships from swaps:');
                sampleSwapsResult.rows.forEach((row, index) => {
                    console.log(`     ${index + 1}. ${row.proposer_email} → ${row.target_owner_email} (${row.target_booking_title})`);
                });
            }

        } catch (error) {
            console.log(`   ❌ Error checking swaps: ${error.message}`);
        }

        console.log();

        // Step 3: Test the repository method with a real user
        console.log('3. Testing SwapTargetingRepository.getTargetingDataForUserSwaps()...');
        try {
            // Get a sample user
            const userQuery = `SELECT id, email FROM users LIMIT 1`;
            const userResult = await pool.query(userQuery);

            if (userResult.rows.length === 0) {
                console.log('   ⚠️  No users found in database');
            } else {
                const sampleUser = userResult.rows[0];
                console.log(`   Testing with user: ${sampleUser.email} (${sampleUser.id})`);

                // Manually execute the repository query to see what it returns
                const incomingQuery = `
                    -- Incoming targets from swap_targets table (new targeting system)
                    SELECT 
                        st.id as target_id,
                        st.target_swap_id,
                        st.source_swap_id,
                        st.proposal_id,
                        st.status,
                        st.created_at,
                        st.updated_at,
                        'targeting' as source_type
                    FROM swap_targets st
                    JOIN swaps ts ON st.target_swap_id = ts.id  -- Target swap (user's swap)
                    JOIN swaps s ON st.source_swap_id = s.id    -- Source swap (other user's swap)
                    WHERE ts.owner_id = $1 AND st.status = 'active'
                    
                    UNION ALL
                    
                    -- Incoming targets from regular proposals (existing swaps table)
                    SELECT 
                        p.id as target_id,
                        p.id as target_swap_id,
                        p.id as source_swap_id,
                        p.id as proposal_id,
                        CASE 
                            WHEN p.status = 'pending' THEN 'active'
                            ELSE p.status
                        END as status,
                        p.created_at,
                        p.updated_at,
                        'proposal' as source_type
                    FROM swaps p
                    JOIN bookings tb ON p.target_booking_id = tb.id -- Target booking
                    WHERE tb.user_id = $1                          -- Target booking belongs to the user
                    AND p.status IN ('pending', 'accepted') 
                    AND p.proposer_id != $1                        -- Exclude self-proposals
                    
                    ORDER BY created_at DESC
                `;

                const incomingResult = await pool.query(incomingQuery, [sampleUser.id]);
                console.log(`   Incoming targets found: ${incomingResult.rows.length}`);

                if (incomingResult.rows.length > 0) {
                    console.log('   Incoming targets:');
                    incomingResult.rows.forEach((row, index) => {
                        console.log(`     ${index + 1}. ${row.source_type}: ${row.target_id} (status: ${row.status})`);
                    });
                }

                const outgoingQuery = `
                    -- Outgoing targets from swap_targets table (new targeting system)
                    SELECT 
                        st.id as target_id,
                        st.source_swap_id,
                        st.target_swap_id,
                        st.proposal_id,
                        st.status,
                        st.created_at,
                        st.updated_at,
                        'targeting' as source_type
                    FROM swap_targets st
                    JOIN swaps ss ON st.source_swap_id = ss.id  -- Source swap (user's swap)
                    JOIN swaps s ON st.target_swap_id = s.id    -- Target swap (other user's swap)
                    WHERE ss.owner_id = $1 AND st.status = 'active'
                    
                    UNION ALL
                    
                    -- Outgoing targets from regular proposals (existing swaps table)
                    SELECT 
                        p.id as target_id,
                        p.id as source_swap_id,
                        p.id as target_swap_id,
                        p.id as proposal_id,
                        CASE 
                            WHEN p.status = 'pending' THEN 'active'
                            ELSE p.status
                        END as status,
                        p.created_at,
                        p.updated_at,
                        'proposal' as source_type
                    FROM swaps p
                    JOIN bookings tb ON p.target_booking_id = tb.id  -- Target booking details
                    WHERE p.proposer_id = $1                         -- User's proposals
                    AND p.target_booking_id IS NOT NULL              -- Has a target
                    AND p.status IN ('pending', 'accepted')
                    AND tb.user_id != $1                             -- Exclude self-targeting
                    
                    ORDER BY created_at DESC
                `;

                const outgoingResult = await pool.query(outgoingQuery, [sampleUser.id]);
                console.log(`   Outgoing targets found: ${outgoingResult.rows.length}`);

                if (outgoingResult.rows.length > 0) {
                    console.log('   Outgoing targets:');
                    outgoingResult.rows.forEach((row, index) => {
                        console.log(`     ${index + 1}. ${row.source_type}: ${row.target_id} (status: ${row.status})`);
                    });
                }
            }

        } catch (error) {
            console.log(`   ❌ Error testing repository method: ${error.message}`);
        }

        console.log();

        // Step 4: Check the service layer transformation
        console.log('4. Checking service layer data transformation...');
        try {
            // Check if SimpleTargetingTransformer is being used correctly
            console.log('   The data flow should be:');
            console.log('   1. SwapTargetingRepository.getTargetingDataForUserSwaps() → Raw data');
            console.log('   2. SimpleTargetingTransformer.transform() → Simplified data');
            console.log('   3. SwapProposalService.getUserSwapsWithTargeting() → Enhanced swap cards');
            console.log('   4. SwapController.getUserSwaps() → API response');
            console.log('   5. Frontend SwapCard component → UI display');

        } catch (error) {
            console.log(`   ❌ Error in service layer check: ${error.message}`);
        }

        console.log();

        // Step 5: Summary and recommendations
        console.log('📋 DIAGNOSIS SUMMARY:');
        console.log();

        // Check if we have the basic infrastructure
        const hasSwapTargetsTable = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'swap_targets'
            );
        `).then(result => result.rows[0].exists);

        const hasSwapTargetsData = hasSwapTargetsTable ?
            await pool.query(`SELECT COUNT(*) as count FROM swap_targets`).then(result => parseInt(result.rows[0].count) > 0) :
            false;

        const hasSwapsData = await pool.query(`
            SELECT COUNT(*) as count FROM swaps WHERE target_booking_id IS NOT NULL AND status = 'pending'
        `).then(result => parseInt(result.rows[0].count) > 0);

        console.log('Infrastructure Status:');
        console.log(`   swap_targets table exists: ${hasSwapTargetsTable ? '✅' : '❌'}`);
        console.log(`   swap_targets has data: ${hasSwapTargetsData ? '✅' : '❌'}`);
        console.log(`   swaps table has targeting data: ${hasSwapsData ? '✅' : '❌'}`);

        console.log();
        console.log('🎯 LIKELY ISSUES:');

        if (!hasSwapTargetsTable) {
            console.log('   ❌ CRITICAL: swap_targets table does not exist');
            console.log('      → Need to create the table with proper schema');
            console.log('      → Need to populate it with existing proposal data');
        } else if (!hasSwapTargetsData && !hasSwapsData) {
            console.log('   ❌ CRITICAL: No targeting data in either table');
            console.log('      → Need to create sample targeting relationships');
            console.log('      → Need to verify data creation workflow');
        } else if (!hasSwapTargetsData && hasSwapsData) {
            console.log('   ⚠️  WARNING: Only legacy proposal data exists');
            console.log('      → swap_targets table is empty but swaps table has data');
            console.log('      → The fallback mechanism should work, but may not be functioning');
        }

        console.log();
        console.log('🔧 RECOMMENDED FIXES:');
        console.log('   1. Verify swap_targets table schema matches expectations');
        console.log('   2. Create sample targeting data for testing');
        console.log('   3. Test the repository query manually');
        console.log('   4. Verify the service layer transformation');
        console.log('   5. Check the API endpoint response');
        console.log('   6. Validate frontend component data handling');

    } catch (error) {
        console.error('❌ Critical error during diagnosis:', error.message);
        console.error(error.stack);
    } finally {
        await pool.end();
    }
}

// Run the diagnosis
if (require.main === module) {
    diagnoseTargetingDataFlow()
        .then(() => {
            console.log('\n✅ Targeting data flow diagnosis completed');
        })
        .catch((error) => {
            console.error('\n❌ Diagnosis failed:', error.message);
            process.exit(1);
        });
}

export { diagnoseTargetingDataFlow };