import { Pool } from 'pg';
import { getDatabaseConfig } from './src/database/config';

async function investigateSchema() {
    const config = getDatabaseConfig();
    const pool = new Pool(config);

    try {
        console.log('=== Database Schema Investigation ===\n');

        // 1. Check current table structures
        console.log('1. Examining table structures...\n');

        // Get swaps table structure
        const swapsStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'swaps' AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);

        console.log('SWAPS table structure:');
        swapsStructure.rows.forEach(row => {
            console.log(`  ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${row.column_default ? `DEFAULT ${row.column_default}` : ''}`);
        });
        console.log();

        // Get swap_proposals table structure
        const proposalsStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'swap_proposals' AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);

        console.log('SWAP_PROPOSALS table structure:');
        if (proposalsStructure.rows.length > 0) {
            proposalsStructure.rows.forEach(row => {
                console.log(`  ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${row.column_default ? `DEFAULT ${row.column_default}` : ''}`);
            });
        } else {
            console.log('  Table does not exist');
        }
        console.log();

        // Get swap_proposal_metadata table structure
        const metadataStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'swap_proposal_metadata' AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);

        console.log('SWAP_PROPOSAL_METADATA table structure:');
        if (metadataStructure.rows.length > 0) {
            metadataStructure.rows.forEach(row => {
                console.log(`  ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${row.column_default ? `DEFAULT ${row.column_default}` : ''}`);
            });
        } else {
            console.log('  Table does not exist');
        }
        console.log();

        // Get swap_targets table structure
        const targetsStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'swap_targets' AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);

        console.log('SWAP_TARGETS table structure:');
        if (targetsStructure.rows.length > 0) {
            targetsStructure.rows.forEach(row => {
                console.log(`  ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${row.column_default ? `DEFAULT ${row.column_default}` : ''}`);
            });
        } else {
            console.log('  Table does not exist');
        }
        console.log();

        // Get bookings table structure
        const bookingsStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'bookings' AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);

        console.log('BOOKINGS table structure:');
        bookingsStructure.rows.forEach(row => {
            console.log(`  ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${row.column_default ? `DEFAULT ${row.column_default}` : ''}`);
        });
        console.log();

        // 2. Check foreign key relationships
        console.log('2. Examining foreign key relationships...\n');

        const foreignKeys = await pool.query(`
      SELECT 
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name IN ('swaps', 'swap_proposals', 'swap_proposal_metadata', 'swap_targets', 'bookings')
      ORDER BY tc.table_name, kcu.column_name;
    `);

        console.log('Foreign key relationships:');
        foreignKeys.rows.forEach(row => {
            console.log(`  ${row.table_name}.${row.column_name} -> ${row.foreign_table_name}.${row.foreign_column_name}`);
        });
        console.log();

        // 3. Check for sample data and identify potential issues
        console.log('3. Checking sample data...\n');

        // Check if we have any proposals
        const proposalCount = await pool.query(`
      SELECT COUNT(*) as count FROM swap_proposal_metadata;
    `);
        console.log(`Total proposals in swap_proposal_metadata: ${proposalCount.rows[0].count}`);

        if (parseInt(proposalCount.rows[0].count) > 0) {
            // Get a sample proposal to test queries
            const sampleProposal = await pool.query(`
        SELECT proposal_id FROM swap_proposal_metadata LIMIT 1;
      `);

            if (sampleProposal.rows.length > 0) {
                const proposalId = sampleProposal.rows[0].proposal_id;
                console.log(`Sample proposal ID: ${proposalId}`);

                // Try to identify the problematic query by testing common proposal queries
                console.log('\n4. Testing common proposal queries to identify issues...\n');

                try {
                    // Test basic proposal metadata query
                    const basicQuery = await pool.query(`
            SELECT * FROM swap_proposal_metadata WHERE proposal_id = $1;
          `, [proposalId]);
                    console.log('✓ Basic proposal metadata query works');
                } catch (error) {
                    console.log('✗ Basic proposal metadata query failed:', error.message);
                }

                try {
                    // Test query with joins to get proposer information
                    const proposerQuery = await pool.query(`
            SELECT 
              m.*,
              sb.user_id as proposer_user_id,
              u.display_name as proposer_name
            FROM swap_proposal_metadata m
            JOIN swaps s ON m.source_swap_id = s.id
            JOIN bookings sb ON s.source_booking_id = sb.id
            JOIN users u ON sb.user_id = u.id
            WHERE m.proposal_id = $1;
          `, [proposalId]);
                    console.log('✓ Proposer information query works');
                } catch (error) {
                    console.log('✗ Proposer information query failed:', error.message);
                }

                try {
                    // Test query with target owner information
                    const targetQuery = await pool.query(`
            SELECT 
              m.*,
              tb.user_id as target_owner_id,
              tu.display_name as target_owner_name
            FROM swap_proposal_metadata m
            JOIN swaps ts ON m.target_swap_id = ts.id
            JOIN bookings tb ON ts.source_booking_id = tb.id
            JOIN users tu ON tb.user_id = tu.id
            WHERE m.proposal_id = $1;
          `, [proposalId]);
                    console.log('✓ Target owner information query works');
                } catch (error) {
                    console.log('✗ Target owner information query failed:', error.message);
                }
            }
        }

        // 4. Check for any queries that might reference removed columns
        console.log('\n5. Checking for potential problematic column references...\n');

        // List all columns that were removed in the schema simplification
        const removedColumns = ['proposer_id', 'owner_id', 'target_booking_id', 'proposal_id'];

        console.log('Columns that were removed in schema simplification:');
        removedColumns.forEach(col => {
            console.log(`  - ${col}`);
        });
        console.log();

        // Check if any of these columns still exist (they shouldn't)
        for (const column of removedColumns) {
            const columnCheck = await pool.query(`
        SELECT table_name, column_name
        FROM information_schema.columns 
        WHERE column_name = $1 AND table_schema = 'public'
        AND table_name IN ('swaps', 'swap_targets', 'swap_proposals', 'swap_proposal_metadata');
      `, [column]);

            if (columnCheck.rows.length > 0) {
                console.log(`⚠️  Column '${column}' still exists in:`, columnCheck.rows.map(r => r.table_name).join(', '));
            } else {
                console.log(`✓ Column '${column}' properly removed`);
            }
        }

    } catch (error) {
        console.error('Error investigating schema:', error);
    } finally {
        await pool.end();
    }
}

// Run the investigation
investigateSchema().catch(console.error);