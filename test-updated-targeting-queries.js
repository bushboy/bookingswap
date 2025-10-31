const { Pool } = require('pg');

// Database connection
const pool = new Pool({
    user: 'booking_swap',
    host: 'localhost',
    database: 'booking_swap_db',
    password: 'P@ssword123',
    port: 5432,
});

async function testUpdatedQueries() {
    try {
        console.log('=== Testing Updated Targeting Queries ===\n');

        // Get users to test with
        const usersResult = await pool.query('SELECT id, display_name FROM users ORDER BY created_at LIMIT 2');
        if (usersResult.rows.length < 2) {
            console.log('Need at least 2 users to test targeting');
            return;
        }

        const user1 = usersResult.rows[0]; // User who created the swap targeting user3's booking
        const user3Id = '92d2a1de-8b8b-4b33-bbae-60df5c5a8af5'; // User whose booking is being targeted

        // Get user3 details
        const user3Result = await pool.query('SELECT id, display_name FROM users WHERE id = $1', [user3Id]);
        const user3 = user3Result.rows[0] || { id: user3Id, display_name: null };

        console.log(`Testing with:`);
        console.log(`User 1: ${user1.display_name || user1.id}`);
        console.log(`User 3: ${user3.display_name || user3.id}`);

        // Test incoming targets query for user3 (should show user1's proposal)
        console.log(`\n=== Incoming Targets for User 3 (${user3.display_name || user3.id}) ===`);
        const incomingQuery = `
            -- Incoming targets from swap_targets table (new targeting system)
            SELECT 
                st.id as target_id,
                st.target_swap_id,
                st.source_swap_id,
                'targeting' as source_type
            FROM swap_targets st
            JOIN swaps ts ON st.target_swap_id = ts.id  -- Target swap (user's swap)
            WHERE ts.owner_id = $1 AND st.status = 'active'
            
            UNION ALL
            
            -- Incoming targets from regular proposals (existing swaps table)
            -- Find swaps where someone is targeting the user's bookings
            SELECT 
                p.id as target_id,
                p.id as target_swap_id,  -- The proposal swap itself
                p.id as source_swap_id,
                'proposal' as source_type
            FROM swaps p
            JOIN bookings b ON p.source_booking_id = b.id  -- Proposer's booking details
            JOIN users u ON p.proposer_id = u.id           -- Proposer's user details
            JOIN bookings tb ON p.target_booking_id = tb.id -- Target booking
            WHERE tb.user_id = $1                          -- Target booking belongs to the user
            AND p.status IN ('pending', 'accepted') 
            AND p.proposer_id != $1                        -- Exclude self-proposals
            
            ORDER BY target_id DESC
        `;

        const incomingResult = await pool.query(incomingQuery, [user3.id]);
        console.log(`Found ${incomingResult.rows.length} incoming targets:`);
        incomingResult.rows.forEach(row => {
            console.log(`  - ${row.source_type}: target_id=${row.target_id}, target_swap=${row.target_swap_id}, source_swap=${row.source_swap_id}`);
        });

        // Test outgoing targets query for user1 (should show user1's proposal to user2)
        console.log(`\n=== Outgoing Targets for User 1 (${user1.display_name || user1.id}) ===`);
        const outgoingQuery = `
            -- Outgoing targets from swap_targets table (new targeting system)
            SELECT 
                st.id as target_id,
                st.source_swap_id,
                st.target_swap_id,
                'targeting' as source_type
            FROM swap_targets st
            JOIN swaps ss ON st.source_swap_id = ss.id  -- Source swap (user's swap)
            WHERE ss.owner_id = $1 AND st.status = 'active'
            
            UNION ALL
            
            -- Outgoing targets from regular proposals (existing swaps table)
            -- Find swaps where the user is targeting someone else's bookings
            SELECT 
                p.id as target_id,
                p.id as source_swap_id,  -- The user's proposal swap
                p.id as target_swap_id,  -- Same as source for now (no separate target swap)
                'proposal' as source_type
            FROM swaps p
            JOIN bookings tb ON p.target_booking_id = tb.id  -- Target booking details
            JOIN users tu ON tb.user_id = tu.id              -- Target booking owner
            WHERE p.proposer_id = $1                         -- User's proposals
            AND p.target_booking_id IS NOT NULL              -- Has a target
            AND p.status IN ('pending', 'accepted')
            AND tb.user_id != $1                             -- Exclude self-targeting
            
            ORDER BY target_id DESC
        `;

        const outgoingResult = await pool.query(outgoingQuery, [user1.id]);
        console.log(`Found ${outgoingResult.rows.length} outgoing targets:`);
        outgoingResult.rows.forEach(row => {
            console.log(`  - ${row.source_type}: target_id=${row.target_id}, source_swap=${row.source_swap_id}, target_swap=${row.target_swap_id}`);
        });

        // Show the actual swap data for context
        console.log('\n=== Current Swap Data for Context ===');
        const swapsResult = await pool.query(`
            SELECT s.id, s.source_booking_id, s.target_booking_id, s.proposer_id, s.owner_id, s.status,
                   sb.title as source_title, sb.user_id as source_user_id,
                   tb.title as target_title, tb.user_id as target_user_id,
                   pu.display_name as proposer_name, ou.display_name as owner_name
            FROM swaps s
            LEFT JOIN bookings sb ON s.source_booking_id = sb.id
            LEFT JOIN bookings tb ON s.target_booking_id = tb.id
            LEFT JOIN users pu ON s.proposer_id = pu.id
            LEFT JOIN users ou ON s.owner_id = ou.id
            ORDER BY s.created_at DESC
        `);

        swapsResult.rows.forEach(row => {
            console.log(`Swap ${row.id}:`);
            console.log(`  - Proposer: ${row.proposer_name || row.proposer_id} (${row.proposer_id})`);
            console.log(`  - Owner: ${row.owner_name || row.owner_id} (${row.owner_id})`);
            console.log(`  - Source: ${row.source_title} (owned by ${row.source_user_id})`);
            console.log(`  - Target: ${row.target_title || 'None'} (owned by ${row.target_user_id || 'N/A'})`);
            console.log(`  - Status: ${row.status}`);
            console.log('');
        });

    } catch (error) {
        console.error('Error testing queries:', error);
    } finally {
        await pool.end();
    }
}

testUpdatedQueries();