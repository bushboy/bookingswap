const { Pool } = require('pg');

// Debug script to analyze the data structure mismatch
async function analyzeDataMismatch() {
    const pool = new Pool({
        user: 'postgres',
        host: 'localhost',
        database: 'booking_swap',
        password: 'password',
        port: 5432,
    });

    try {
        console.log('🔍 Analyzing Swap Targeting Data Structure Mismatch...\n');

        // 1. Check swaps table structure and data
        console.log('📋 SWAPS TABLE ANALYSIS:');
        const swapsResult = await pool.query(`
      SELECT 
        id, 
        source_booking_id, 
        target_booking_id, 
        proposer_id, 
        owner_id, 
        status, 
        created_at 
      FROM swaps 
      ORDER BY created_at DESC 
      LIMIT 5
    `);

        console.log(`Total swaps: ${swapsResult.rows.length}`);
        swapsResult.rows.forEach((swap, index) => {
            console.log(`  ${index + 1}. Swap ${swap.id}`);
            console.log(`     Proposer: ${swap.proposer_id} → Owner: ${swap.owner_id}`);
            console.log(`     Source Booking: ${swap.source_booking_id}`);
            console.log(`     Target Booking: ${swap.target_booking_id}`);
            console.log(`     Status: ${swap.status}`);
            console.log('');
        });

        // 2. Check swap_targets table structure and data
        console.log('🎯 SWAP_TARGETS TABLE ANALYSIS:');
        const targetsResult = await pool.query(`
      SELECT 
        id, 
        source_swap_id, 
        target_swap_id, 
        proposal_id, 
        status, 
        created_at 
      FROM swap_targets 
      ORDER BY created_at DESC 
      LIMIT 5
    `);

        console.log(`Total targeting relationships: ${targetsResult.rows.length}`);
        if (targetsResult.rows.length === 0) {
            console.log('  ❌ NO TARGETING RELATIONSHIPS FOUND!');
            console.log('  This explains why targeting display is not working.');
        } else {
            targetsResult.rows.forEach((target, index) => {
                console.log(`  ${index + 1}. Target ${target.id}`);
                console.log(`     Source Swap: ${target.source_swap_id} → Target Swap: ${target.target_swap_id}`);
                console.log(`     Proposal: ${target.proposal_id}`);
                console.log(`     Status: ${target.status}`);
                console.log('');
            });
        }

        // 3. Analyze the relationship between the two tables
        console.log('🔗 RELATIONSHIP ANALYSIS:');

        // Check if any swaps should be converted to targeting relationships
        const proposalAnalysis = await pool.query(`
      SELECT 
        s1.id as proposal_id,
        s1.proposer_id,
        s1.owner_id,
        s1.source_booking_id as proposer_booking,
        s1.target_booking_id as target_booking,
        s1.status,
        s2.id as target_swap_id,
        s2.owner_id as target_swap_owner
      FROM swaps s1
      LEFT JOIN swaps s2 ON s1.target_booking_id = s2.source_booking_id
      WHERE s1.status = 'pending'
      ORDER BY s1.created_at DESC
      LIMIT 5
    `);

        console.log('Potential targeting relationships from existing swaps:');
        proposalAnalysis.rows.forEach((row, index) => {
            console.log(`  ${index + 1}. Proposal ${row.proposal_id}`);
            console.log(`     ${row.proposer_id} (proposer) wants to swap with ${row.owner_id} (owner)`);
            console.log(`     Proposer's booking: ${row.proposer_booking}`);
            console.log(`     Target booking: ${row.target_booking}`);
            if (row.target_swap_id) {
                console.log(`     ✅ Target swap exists: ${row.target_swap_id} (owned by ${row.target_swap_owner})`);
                console.log(`     This should show as: ${row.proposer_id} targeting ${row.target_swap_owner}'s swap`);
            } else {
                console.log(`     ❌ No corresponding target swap found`);
            }
            console.log('');
        });

        // 4. Check what the targeting queries would return
        console.log('🔍 TESTING TARGETING QUERIES:');

        if (swapsResult.rows.length > 0) {
            const testUserId = swapsResult.rows[0].owner_id;
            console.log(`Testing targeting queries for user: ${testUserId}`);

            // Test incoming targets query
            const incomingQuery = `
        SELECT 
            st.id as target_id,
            st.target_swap_id,
            st.source_swap_id,
            st.proposal_id,
            st.status
        FROM swap_targets st
        JOIN swaps ts ON st.target_swap_id = ts.id
        WHERE ts.owner_id = $1 AND st.status = 'active'
      `;

            const incomingResult = await pool.query(incomingQuery, [testUserId]);
            console.log(`  Incoming targets for ${testUserId}: ${incomingResult.rows.length}`);

            // Test outgoing targets query
            const outgoingQuery = `
        SELECT 
            st.id as target_id,
            st.source_swap_id,
            st.target_swap_id,
            st.proposal_id,
            st.status
        FROM swap_targets st
        JOIN swaps ss ON st.source_swap_id = ss.id
        WHERE ss.owner_id = $1 AND st.status = 'active'
      `;

            const outgoingResult = await pool.query(outgoingQuery, [testUserId]);
            console.log(`  Outgoing targets for ${testUserId}: ${outgoingResult.rows.length}`);
        }

        // 5. Recommendations
        console.log('\n💡 RECOMMENDATIONS:');
        console.log('1. The targeting system expects data in swap_targets table');
        console.log('2. Regular swap proposals are in swaps table');
        console.log('3. Need to either:');
        console.log('   a) Populate swap_targets from existing swaps, OR');
        console.log('   b) Modify targeting queries to include regular proposals');
        console.log('4. Current targeting display only works with swap_targets data');
        console.log('5. This explains why existing swaps don\'t show targeting information');

    } catch (error) {
        console.error('❌ Error analyzing data mismatch:', error.message);
    } finally {
        await pool.end();
    }
}

analyzeDataMismatch();