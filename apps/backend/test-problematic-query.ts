import { Pool } from 'pg';
import { getDatabaseConfig } from './src/database/config';

async function testProblematicQuery() {
    const config = getDatabaseConfig();
    const pool = new Pool(config);

    try {
        console.log('=== Testing Problematic Query from ProposalAcceptanceService ===\n');

        // Test the exact query from the getProposal method that's likely causing the error
        const proposalId = 'test-proposal-id'; // This will fail but we want to see the column error

        console.log('1. Testing swap_proposals query...\n');

        try {
            const proposalQuery = `
        SELECT 
          sp.id,
          sp.source_swap_id,
          sp.target_swap_id,
          sp.proposer_id,
          sp.target_user_id,
          sp.proposal_type,
          sp.status,
          sp.cash_offer_amount,
          sp.cash_offer_currency,
          sp.escrow_account_id,
          sp.payment_method_id,
          sp.responded_at,
          sp.responded_by,
          sp.rejection_reason,
          sp.blockchain_proposal_transaction_id,
          sp.blockchain_response_transaction_id,
          sp.message,
          sp.conditions,
          sp.expires_at,
          sp.created_at,
          sp.updated_at,
          'swap_proposals' as source_table
        FROM swap_proposals sp
        WHERE sp.id = $1
      `;

            const result = await pool.query(proposalQuery, [proposalId]);
            console.log('✓ swap_proposals query works fine');
        } catch (error) {
            console.log('✗ swap_proposals query failed:', error.message);
            if (error.message.includes('42703')) {
                console.log('  This is the PostgreSQL 42703 error we\'re looking for!');
            }
        }

        console.log('\n2. Testing swap_targets query...\n');

        try {
            const targetQuery = `
        SELECT 
          st.id as target_id,
          st.source_swap_id,
          st.target_swap_id,
          st.status,
          st.created_at as target_created_at,
          st.updated_at as target_updated_at,
          ss.id as source_swap_id_full,
          ss.source_booking_id as source_booking_id,
          ss.status as source_swap_status,
          ss.terms as source_terms,
          ss.blockchain as source_blockchain,
          ss.timeline as source_timeline,
          ss.created_at as source_created_at,
          ss.updated_at as source_updated_at,
          sb.user_id as proposer_id,
          ts.source_booking_id as target_booking_id,
          tb.user_id as target_user_id,
          'swap_targets' as source_table
        FROM swap_targets st
        INNER JOIN swaps ss ON st.source_swap_id = ss.id
        LEFT JOIN bookings sb ON ss.source_booking_id = sb.id
        LEFT JOIN swaps ts ON st.target_swap_id = ts.id
        LEFT JOIN bookings tb ON ts.source_booking_id = tb.id
        WHERE st.id = $1
      `;

            const result = await pool.query(targetQuery, [proposalId]);
            console.log('✓ swap_targets query works fine');
        } catch (error) {
            console.log('✗ swap_targets query failed:', error.message);
            if (error.message.includes('42703')) {
                console.log('  This is the PostgreSQL 42703 error we\'re looking for!');
                console.log('  Error position:', error.position);
            }
        }

        console.log('\n3. Testing individual column references...\n');

        // Test each column individually to identify which ones don't exist
        const columnsToTest = [
            { table: 'swaps', column: 'terms' },
            { table: 'swaps', column: 'blockchain' },
            { table: 'swaps', column: 'timeline' },
            { table: 'swap_targets', column: 'target_swap_id' },
            { table: 'swap_targets', column: 'source_swap_id' }
        ];

        for (const { table, column } of columnsToTest) {
            try {
                const testQuery = `SELECT ${column} FROM ${table} LIMIT 1`;
                await pool.query(testQuery);
                console.log(`✓ ${table}.${column} exists`);
            } catch (error) {
                console.log(`✗ ${table}.${column} does not exist:`, error.message);
            }
        }

        console.log('\n4. Checking actual column names in swaps table...\n');

        const swapsColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'swaps' AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);

        console.log('Actual columns in swaps table:');
        swapsColumns.rows.forEach(row => {
            console.log(`  ${row.column_name}: ${row.data_type}`);
        });

        console.log('\n5. Checking actual column names in swap_targets table...\n');

        const targetsColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'swap_targets' AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);

        console.log('Actual columns in swap_targets table:');
        targetsColumns.rows.forEach(row => {
            console.log(`  ${row.column_name}: ${row.data_type}`);
        });

        console.log('\n6. Testing a corrected query...\n');

        // Test a corrected version of the query that should work with the current schema
        try {
            const correctedQuery = `
        SELECT 
          st.id as target_id,
          st.source_swap_id,
          st.target_swap_id,
          st.status,
          st.created_at as target_created_at,
          st.updated_at as target_updated_at,
          ss.id as source_swap_id_full,
          ss.source_booking_id as source_booking_id,
          ss.status as source_swap_status,
          ss.additional_payment,
          ss.conditions,
          ss.expires_at,
          ss.blockchain_proposal_transaction_id,
          ss.blockchain_execution_transaction_id,
          ss.proposed_at,
          ss.responded_at,
          ss.completed_at,
          ss.created_at as source_created_at,
          ss.updated_at as source_updated_at,
          sb.user_id as proposer_id,
          ts.source_booking_id as target_booking_id,
          tb.user_id as target_user_id,
          'swap_targets' as source_table
        FROM swap_targets st
        INNER JOIN swaps ss ON st.source_swap_id = ss.id
        LEFT JOIN bookings sb ON ss.source_booking_id = sb.id
        LEFT JOIN swaps ts ON st.target_swap_id = ts.id
        LEFT JOIN bookings tb ON ts.source_booking_id = tb.id
        WHERE st.id = $1
      `;

            const result = await pool.query(correctedQuery, [proposalId]);
            console.log('✓ Corrected query works fine');
        } catch (error) {
            console.log('✗ Corrected query failed:', error.message);
        }

    } catch (error) {
        console.error('Error testing queries:', error);
    } finally {
        await pool.end();
    }
}

// Run the test
testProblematicQuery().catch(console.error);