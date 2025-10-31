const { Pool } = require('pg');

// Simple test to verify proposer names are working
async function testProposerNames() {
    const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'booking_swap_dev',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
    });

    try {
        console.log('Testing proposer name resolution...');

        // Test the actual query used by findSwapCardsWithProposals
        const query = `
      SELECT 
        s.id as swap_id,
        u.display_name as proposer_name,
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

      WHERE s.status = 'pending'
      LIMIT 10
    `;

        const result = await pool.query(query);

        console.log(`Found ${result.rows.length} swaps to test`);

        let validNames = 0;
        let nullNames = 0;
        let unknownNames = 0;

        result.rows.forEach(row => {
            console.log(`Swap ${row.swap_id}: "${row.proposer_name || 'NULL'}" (${row.join_chain_status})`);

            if (!row.proposer_name) {
                nullNames++;
            } else if (row.proposer_name === 'Unknown User' || row.proposer_name === 'unknown') {
                unknownNames++;
            } else {
                validNames++;
            }
        });

        console.log(`\nResults:`);
        console.log(`Valid names: ${validNames}`);
        console.log(`NULL names: ${nullNames}`);
        console.log(`Unknown names: ${unknownNames}`);

        const successRate = result.rows.length > 0 ? (validNames / result.rows.length) * 100 : 0;
        console.log(`Success rate: ${successRate.toFixed(1)}%`);

        if (successRate > 70) {
            console.log('✅ Test PASSED: Most proposer names are resolved correctly');
        } else {
            console.log('❌ Test FAILED: Too many unresolved proposer names');
        }

    } catch (error) {
        console.error('Test failed:', error.message);
    } finally {
        await pool.end();
    }
}

testProposerNames();