const { Pool } = require('pg');

// Database connection
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'booking_swap',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
});

async function debugTargetingFlow() {
    try {
        console.log('🔍 Debugging Swap Targeting Flow...\n');

        // 1. Check if we have any swaps
        const swapsResult = await pool.query(`
      SELECT id, owner_id, source_booking_id, status, created_at 
      FROM swaps 
      ORDER BY created_at DESC 
      LIMIT 10
    `);

        console.log('📋 Recent Swaps:');
        swapsResult.rows.forEach(swap => {
            console.log(`  - Swap ${swap.id} (Owner: ${swap.owner_id}, Status: ${swap.status})`);
        });
        console.log('');

        // 2. Check if we have any targeting relationships
        const targetsResult = await pool.query(`
      SELECT st.*, 
             s1.owner_id as source_owner,
             s2.owner_id as target_owner
      FROM swap_targets st
      JOIN swaps s1 ON st.source_swap_id = s1.id
      JOIN swaps s2 ON st.target_swap_id = s2.id
      ORDER BY st.created_at DESC
      LIMIT 10
    `);

        console.log('🎯 Targeting Relationships:');
        if (targetsResult.rows.length === 0) {
            console.log('  ❌ No targeting relationships found!');
        } else {
            targetsResult.rows.forEach(target => {
                console.log(`  - ${target.source_owner} targeting ${target.target_owner} (Status: ${target.status})`);
                console.log(`    Source Swap: ${target.source_swap_id}`);
                console.log(`    Target Swap: ${target.target_swap_id}`);
                console.log(`    Proposal: ${target.proposal_id}`);
                console.log('');
            });
        }

        // 3. Test the targeting data query for a specific user
        if (swapsResult.rows.length > 0) {
            const testUserId = swapsResult.rows[0].owner_id;
            console.log(`🧪 Testing targeting data for user: ${testUserId}`);

            const incomingQuery = `
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
            u.id as owner_id,
            u.display_name as owner_name,
            u.email as owner_email
        FROM swap_targets st
        JOIN swaps ts ON st.target_swap_id = ts.id  -- Target swap (user's swap)
        JOIN swaps s ON st.source_swap_id = s.id    -- Source swap (other user's swap)
        JOIN bookings b ON s.source_booking_id = b.id
        JOIN users u ON s.owner_id = u.id
        WHERE ts.owner_id = $1 AND st.status = 'active'
        ORDER BY st.created_at DESC
      `;

            const incomingResult = await pool.query(incomingQuery, [testUserId]);
            console.log(`  📥 Incoming targets: ${incomingResult.rows.length}`);

            const outgoingQuery = `
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
            u.id as owner_id,
            u.display_name as owner_name,
            u.email as owner_email
        FROM swap_targets st
        JOIN swaps ss ON st.source_swap_id = ss.id  -- Source swap (user's swap)
        JOIN swaps s ON st.target_swap_id = s.id    -- Target swap (other user's swap)
        JOIN bookings b ON s.source_booking_id = b.id
        JOIN users u ON s.owner_id = u.id
        WHERE ss.owner_id = $1 AND st.status = 'active'
        ORDER BY st.created_at DESC
      `;

            const outgoingResult = await pool.query(outgoingQuery, [testUserId]);
            console.log(`  📤 Outgoing targets: ${outgoingResult.rows.length}`);
        }

        // 4. Check if the API endpoint is working
        console.log('\n🌐 Testing API Endpoint...');

        // We can't easily test the API from here without authentication,
        // but we can check if the service method would work
        console.log('  ℹ️  To test the API endpoint, use:');
        console.log('  curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3001/api/swaps');

    } catch (error) {
        console.error('❌ Error debugging targeting flow:', error);
    } finally {
        await pool.end();
    }
}

debugTargetingFlow();