const { Pool } = require('pg');

// Database connection
const pool = new Pool({
    user: 'booking_swap',
    host: 'localhost',
    database: 'booking_swap_db',
    password: 'P@ssword123',
    port: 5432,
});

async function debugTargetingData() {
    try {
        console.log('=== Debugging Targeting Data ===\n');

        // Check if swap_targets table has data
        const swapTargetsResult = await pool.query('SELECT COUNT(*) as count FROM swap_targets');
        console.log(`swap_targets table has ${swapTargetsResult.rows[0].count} records`);

        // Check if swaps table has data with target_booking_id
        const swapsWithTargetsResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM swaps 
      WHERE target_booking_id IS NOT NULL
    `);
        console.log(`swaps table has ${swapsWithTargetsResult.rows[0].count} records with target_booking_id`);

        // Check total swaps
        const totalSwapsResult = await pool.query('SELECT COUNT(*) as count FROM swaps');
        console.log(`swaps table has ${totalSwapsResult.rows[0].count} total records`);

        // Sample some swaps data
        const sampleSwapsResult = await pool.query(`
      SELECT id, source_booking_id, target_booking_id, proposer_id, owner_id, status, created_at
      FROM swaps 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
        console.log('\n=== Sample Swaps Data ===');
        sampleSwapsResult.rows.forEach(row => {
            console.log(`Swap ${row.id}: source=${row.source_booking_id}, target=${row.target_booking_id}, proposer=${row.proposer_id}, owner=${row.owner_id}, status=${row.status}`);
        });

        // Check if there are any swaps where proposer != owner (actual proposals)
        const proposalsResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM swaps 
      WHERE proposer_id != owner_id
    `);
        console.log(`\nFound ${proposalsResult.rows[0].count} swaps where proposer_id != owner_id (actual proposals)`);

        // Let's also check what users exist
        const usersResult = await pool.query('SELECT id, display_name FROM users ORDER BY created_at');
        console.log('\n=== Users in Database ===');
        usersResult.rows.forEach(user => {
            console.log(`User ${user.id}: ${user.display_name}`);
        });

        // Check if we can create a test proposal between different users
        if (usersResult.rows.length >= 2) {
            const user1 = usersResult.rows[0];
            const user2 = usersResult.rows[1];

            console.log(`\n=== Checking Swaps for Cross-User Proposals ===`);
            console.log(`User 1: ${user1.display_name} (${user1.id})`);
            console.log(`User 2: ${user2.display_name} (${user2.id})`);

            // Check swaps owned by user1
            const user1SwapsResult = await pool.query(`
        SELECT id, source_booking_id, target_booking_id, status 
        FROM swaps 
        WHERE owner_id = $1
      `, [user1.id]);
            console.log(`User 1 owns ${user1SwapsResult.rows.length} swaps`);

            // Check swaps owned by user2  
            const user2SwapsResult = await pool.query(`
        SELECT id, source_booking_id, target_booking_id, status 
        FROM swaps 
        WHERE owner_id = $1
      `, [user2.id]);
            console.log(`User 2 owns ${user2SwapsResult.rows.length} swaps`);

            // Now let's test what happens if we simulate a cross-user proposal
            console.log('\n=== Simulating Cross-User Targeting ===');

            if (user1SwapsResult.rows.length > 0 && user2SwapsResult.rows.length > 0) {
                const user1Swap = user1SwapsResult.rows[0];
                const user2Swap = user2SwapsResult.rows[0];

                console.log(`If User 2 (${user2.display_name}) targets User 1's swap (${user1Swap.id}):`);
                console.log(`- User 2 would create a swap with target_booking_id = ${user1Swap.source_booking_id}`);
                console.log(`- This would show up as an incoming target for User 1`);

                // Test the query that would find this
                const simulatedQuery = `
                    SELECT 
                        p.id as proposal_id,
                        p.proposer_id,
                        p.source_booking_id,
                        p.target_booking_id,
                        ts.id as target_swap_id,
                        ts.owner_id as target_owner_id
                    FROM swaps p
                    JOIN swaps ts ON p.target_booking_id = ts.source_booking_id
                    WHERE ts.owner_id = $1 
                    AND p.proposer_id = $2
                    AND p.status IN ('pending', 'accepted')
                `;

                const simulatedResult = await pool.query(simulatedQuery, [user1.id, user2.id]);
                console.log(`Current query would find ${simulatedResult.rows.length} targeting relationships`);
            }
        }

        // Test the actual targeting query for the first user
        if (usersResult.rows.length > 0) {
            const testUserId = usersResult.rows[0].id;
            console.log(`\n=== Testing Actual Targeting Query for User ${usersResult.rows[0].display_name} ===`);

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
        SELECT 
            p.id as target_id,
            ts.id as target_swap_id,
            p.id as source_swap_id,
            'proposal' as source_type
        FROM swaps p
        JOIN swaps ts ON p.target_booking_id = ts.source_booking_id  -- Find target swap by booking
        WHERE ts.owner_id = $1 
        AND p.status IN ('pending', 'accepted') 
        AND p.proposer_id != $1  -- Exclude self-proposals
        
        ORDER BY target_id DESC
      `;

            const incomingResult = await pool.query(incomingQuery, [testUserId]);
            console.log(`Found ${incomingResult.rows.length} incoming targets for user ${usersResult.rows[0].display_name}`);
            incomingResult.rows.forEach(row => {
                console.log(`  - ${row.source_type}: target_id=${row.target_id}, target_swap=${row.target_swap_id}, source_swap=${row.source_swap_id}`);
            });
        }

    } catch (error) {
        console.error('Error debugging targeting data:', error);
    } finally {
        await pool.end();
    }
}

debugTargetingData();