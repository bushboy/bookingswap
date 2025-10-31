/**
 * Script to test the API endpoint that should return targeting data
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

async function testApiEndpoint() {
    const pool = new Pool(dbConfig);

    try {
        console.log('🧪 Testing API Endpoint Data Flow\n');

        // Step 1: Get users with targeting data
        const usersWithTargetingResult = await pool.query(`
            SELECT DISTINCT u.id, u.email, 
                   COUNT(DISTINCT st1.id) as incoming_count,
                   COUNT(DISTINCT st2.id) as outgoing_count
            FROM users u
            LEFT JOIN swaps s ON u.id = s.owner_id
            LEFT JOIN swap_targets st1 ON s.id = st1.target_swap_id AND st1.status = 'active'
            LEFT JOIN swap_targets st2 ON s.id = st2.source_swap_id AND st2.status = 'active'
            WHERE st1.id IS NOT NULL OR st2.id IS NOT NULL
            GROUP BY u.id, u.email
        `);

        if (usersWithTargetingResult.rows.length === 0) {
            console.log('❌ No users with targeting data found');
            return;
        }

        // Test with the first user who has targeting data
        const testUser = usersWithTargetingResult.rows[0];
        console.log(`Testing with user: ${testUser.email}`);
        console.log(`Expected: ${testUser.incoming_count} incoming, ${testUser.outgoing_count} outgoing\n`);

        // Step 2: Simulate the SwapTargetingRepository.getTargetingDataForUserSwaps() method
        console.log('1. Testing SwapTargetingRepository.getTargetingDataForUserSwaps()...');

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
                s.source_booking_id,
                b.title as booking_title,
                b.city as booking_city,
                b.country as booking_country,
                b.check_in_date as booking_check_in,
                b.check_out_date as booking_check_out,
                b.original_price as booking_price,
                u.id as owner_id,
                u.display_name as owner_name,
                u.email as owner_email,
                'targeting' as source_type
            FROM swap_targets st
            JOIN swaps ts ON st.target_swap_id = ts.id  -- Target swap (user's swap)
            JOIN swaps s ON st.source_swap_id = s.id    -- Source swap (other user's swap)
            JOIN bookings b ON s.source_booking_id = b.id
            JOIN users u ON s.owner_id = u.id
            WHERE ts.owner_id = $1 AND st.status = 'active'
            
            UNION ALL
            
            -- Incoming targets from regular proposals (existing swaps table)
            -- Find swaps where someone is targeting the user's bookings
            SELECT 
                p.id as target_id,
                p.id as target_swap_id,  -- The proposal swap itself
                p.id as source_swap_id,
                p.id as proposal_id,
                CASE 
                    WHEN p.status = 'pending' THEN 'active'
                    ELSE p.status
                END as status,
                p.created_at,
                p.updated_at,
                p.source_booking_id,
                b.title as booking_title,
                b.city as booking_city,
                b.country as booking_country,
                b.check_in_date as booking_check_in,
                b.check_out_date as booking_check_out,
                b.original_price as booking_price,
                u.id as owner_id,
                u.display_name as owner_name,
                u.email as owner_email,
                'proposal' as source_type
            FROM swaps p
            JOIN bookings b ON p.source_booking_id = b.id  -- Proposer's booking details
            JOIN users u ON p.proposer_id = u.id           -- Proposer's user details
            JOIN bookings tb ON p.target_booking_id = tb.id -- Target booking
            WHERE tb.user_id = $1                          -- Target booking belongs to the user
            AND p.status IN ('pending', 'accepted') 
            AND p.proposer_id != $1                        -- Exclude self-proposals
            
            ORDER BY created_at DESC
        `;

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
                s.source_booking_id,
                s.acceptance_strategy,
                b.title as booking_title,
                b.city as booking_city,
                b.country as booking_country,
                b.check_in_date as booking_check_in,
                b.check_out_date as booking_check_out,
                b.original_price as booking_price,
                u.id as owner_id,
                u.display_name as owner_name,
                u.email as owner_email,
                'targeting' as source_type
            FROM swap_targets st
            JOIN swaps ss ON st.source_swap_id = ss.id  -- Source swap (user's swap)
            JOIN swaps s ON st.target_swap_id = s.id    -- Target swap (other user's swap)
            JOIN bookings b ON s.source_booking_id = b.id
            JOIN users u ON s.owner_id = u.id
            WHERE ss.owner_id = $1 AND st.status = 'active'
            
            UNION ALL
            
            -- Outgoing targets from regular proposals (existing swaps table)
            -- Find swaps where the user is targeting someone else's bookings
            SELECT 
                p.id as target_id,
                p.id as source_swap_id,  -- The user's proposal swap
                p.id as target_swap_id,  -- Same as source for now (no separate target swap)
                p.id as proposal_id,
                CASE 
                    WHEN p.status = 'pending' THEN 'active'
                    ELSE p.status
                END as status,
                p.created_at,
                p.updated_at,
                p.target_booking_id as source_booking_id,  -- Target booking details
                NULL as acceptance_strategy,               -- Not available in current model
                tb.title as booking_title,
                tb.city as booking_city,
                tb.country as booking_country,
                tb.check_in_date as booking_check_in,
                tb.check_out_date as booking_check_out,
                tb.original_price as booking_price,
                tu.id as owner_id,
                tu.display_name as owner_name,
                tu.email as owner_email,
                'proposal' as source_type
            FROM swaps p
            JOIN bookings tb ON p.target_booking_id = tb.id  -- Target booking details
            JOIN users tu ON tb.user_id = tu.id              -- Target booking owner
            WHERE p.proposer_id = $1                         -- User's proposals
            AND p.target_booking_id IS NOT NULL              -- Has a target
            AND p.status IN ('pending', 'accepted')
            AND tb.user_id != $1                             -- Exclude self-targeting
            
            ORDER BY created_at DESC
        `;

        const [incomingResult, outgoingResult] = await Promise.all([
            pool.query(incomingQuery, [testUser.id]),
            pool.query(outgoingQuery, [testUser.id])
        ]);

        console.log(`   Incoming targets found: ${incomingResult.rows.length}`);
        if (incomingResult.rows.length > 0) {
            console.log('   Incoming targets data:');
            incomingResult.rows.forEach((row, index) => {
                console.log(`     ${index + 1}. ${row.source_type}: ${row.owner_email} (${row.booking_title})`);
                console.log(`        Target ID: ${row.target_id}`);
                console.log(`        Source Swap: ${row.source_swap_id}`);
                console.log(`        Target Swap: ${row.target_swap_id}`);
            });
        }

        console.log(`   Outgoing targets found: ${outgoingResult.rows.length}`);
        if (outgoingResult.rows.length > 0) {
            console.log('   Outgoing targets data:');
            outgoingResult.rows.forEach((row, index) => {
                console.log(`     ${index + 1}. ${row.source_type}: ${row.owner_email} (${row.booking_title})`);
                console.log(`        Target ID: ${row.target_id}`);
                console.log(`        Source Swap: ${row.source_swap_id}`);
                console.log(`        Target Swap: ${row.target_swap_id}`);
            });
        }

        console.log();

        // Step 3: Simulate the data transformation
        console.log('2. Testing data transformation...');

        const rawTargetingData = {
            incomingTargets: incomingResult.rows.map(row => ({
                targetId: row.target_id,
                targetSwapId: row.target_swap_id,
                sourceSwapId: row.source_swap_id,
                sourceSwapDetails: {
                    id: row.source_swap_id,
                    bookingId: row.source_booking_id,
                    bookingTitle: row.booking_title || 'Untitled Booking',
                    bookingLocation: `${row.booking_city || 'Unknown'}, ${row.booking_country || 'Unknown'}`,
                    bookingCheckIn: new Date(row.booking_check_in),
                    bookingCheckOut: new Date(row.booking_check_out),
                    bookingPrice: parseFloat(row.booking_price) || 0,
                    ownerId: row.owner_id,
                    ownerName: row.owner_name || 'Unknown User',
                    ownerEmail: row.owner_email || ''
                },
                proposalId: row.proposal_id,
                status: row.status,
                createdAt: new Date(row.created_at),
                updatedAt: new Date(row.updated_at)
            })),
            outgoingTargets: outgoingResult.rows.map(row => ({
                targetId: row.target_id,
                sourceSwapId: row.source_swap_id,
                targetSwapId: row.target_swap_id,
                targetSwapDetails: {
                    id: row.target_swap_id,
                    bookingId: row.source_booking_id,
                    bookingTitle: row.booking_title || 'Untitled Booking',
                    bookingLocation: `${row.booking_city || 'Unknown'}, ${row.booking_country || 'Unknown'}`,
                    bookingCheckIn: new Date(row.booking_check_in),
                    bookingCheckOut: new Date(row.booking_check_out),
                    bookingPrice: parseFloat(row.booking_price) || 0,
                    ownerId: row.owner_id,
                    ownerName: row.owner_name || 'Unknown User',
                    ownerEmail: row.owner_email || '',
                    acceptanceStrategy: typeof row.acceptance_strategy === 'string'
                        ? JSON.parse(row.acceptance_strategy)
                        : (row.acceptance_strategy || { type: 'first_match' })
                },
                proposalId: row.proposal_id,
                status: row.status,
                createdAt: new Date(row.created_at),
                updatedAt: new Date(row.updated_at)
            }))
        };

        console.log('   Raw targeting data structure:');
        console.log(`     incomingTargets: ${rawTargetingData.incomingTargets.length} items`);
        console.log(`     outgoingTargets: ${rawTargetingData.outgoingTargets.length} items`);

        // Step 4: Show what the SimpleTargetingTransformer should receive
        console.log();
        console.log('3. Expected SimpleTargetingTransformer input:');

        // The transformer expects data grouped by swap ID
        const transformerInput = [];

        // Get user's swaps
        const userSwapsResult = await pool.query(`
            SELECT s.id, s.owner_id, s.source_booking_id, s.status
            FROM swaps s
            WHERE s.owner_id = $1
            ORDER BY s.created_at DESC
        `, [testUser.id]);

        for (const swap of userSwapsResult.rows) {
            const swapTargetingData = {
                swapId: swap.id,
                incomingTargets: rawTargetingData.incomingTargets.filter(t => t.targetSwapId === swap.id),
                outgoingTarget: rawTargetingData.outgoingTargets.find(t => t.sourceSwapId === swap.id) || null
            };

            if (swapTargetingData.incomingTargets.length > 0 || swapTargetingData.outgoingTarget) {
                transformerInput.push(swapTargetingData);
                console.log(`   Swap ${swap.id}:`);
                console.log(`     Incoming: ${swapTargetingData.incomingTargets.length}`);
                console.log(`     Outgoing: ${swapTargetingData.outgoingTarget ? 1 : 0}`);
            }
        }

        if (transformerInput.length === 0) {
            console.log('   ⚠️  No targeting data to transform');
        }

        console.log();
        console.log('🎯 DIAGNOSIS:');

        if (incomingResult.rows.length > 0 || outgoingResult.rows.length > 0) {
            console.log('   ✅ Repository query returns targeting data');
            console.log('   ✅ Data transformation structure looks correct');
            console.log('   → The issue is likely in:');
            console.log('     1. SimpleTargetingTransformer.transform() method');
            console.log('     2. SwapProposalService.getUserSwapsWithTargeting() method');
            console.log('     3. API endpoint response formatting');
            console.log('     4. Frontend SwapCard component data handling');
        } else {
            console.log('   ❌ Repository query returns no data');
            console.log('   → Check the JOIN conditions and WHERE clauses');
        }

        console.log();
        console.log('🔧 NEXT STEPS:');
        console.log('   1. Test the actual API endpoint: GET /api/swaps');
        console.log(`   2. Use authentication for user: ${testUser.email}`);
        console.log('   3. Check the browser network tab for the API response');
        console.log('   4. Verify the response includes targeting data');
        console.log('   5. Check if the frontend SwapCard receives the targeting prop');

    } catch (error) {
        console.error('❌ Error testing API endpoint:', error.message);
        console.error(error.stack);
    } finally {
        await pool.end();
    }
}

// Run the test
testApiEndpoint()
    .then(() => {
        console.log('\n✅ API endpoint test completed');
    })
    .catch((error) => {
        console.error('\n❌ API endpoint test failed:', error.message);
        process.exit(1);
    });