/**
 * Debug script to check what data is actually being returned for proposer bookings
 * Run this with: node apps/backend/debug-proposer-data.js
 */

const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'booking_swap_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
});

async function debugProposerData() {
    try {
        console.log('🔍 Checking actual data returned from swap cards query...\n');

        // Get a user ID that has swaps
        const userCheck = await pool.query(`
            SELECT DISTINCT sb.user_id, u.display_name
            FROM swaps s
            JOIN bookings sb ON s.source_booking_id = sb.id
            JOIN users u ON sb.user_id = u.id
            LIMIT 1
        `);

        if (userCheck.rows.length === 0) {
            console.log('❌ No users with swaps found');
            return;
        }

        const userId = userCheck.rows[0].user_id;
        const userName = userCheck.rows[0].display_name;
        console.log(`Found user: ${userName} (${userId})\n`);

        // Run the actual query from SwapRepository
        const query = `
            SELECT 
              s.id as swap_id,
              sb.user_id as owner_id,
              sb.user_id as proposer_id,
              s.source_booking_id as user_booking_id,
              s.status as swap_status,
              s.created_at as swap_created_at,
              s.expires_at as swap_expires_at,
              s.additional_payment as proposal_additional_payment,
              s.conditions as proposal_conditions,
              
              sb.id as user_booking_id_full,
              sb.title as user_booking_title,
              sb.city as user_booking_city,
              sb.country as user_booking_country,
              sb.check_in_date as user_booking_check_in,
              sb.check_out_date as user_booking_check_out,
              sb.original_price as user_booking_original_price,
              sb.swap_value as user_booking_swap_value,
              
              -- Proposer booking details (from swap_targets)
              tb.id as proposer_booking_id_full,
              tb.title as proposer_booking_title,
              tb.city as proposer_booking_city,
              tb.country as proposer_booking_country,
              tb.check_in_date as proposer_booking_check_in,
              tb.check_out_date as proposer_booking_check_out,
              tb.original_price as proposer_booking_original_price,
              tb.swap_value as proposer_booking_swap_value,
              
              u.display_name as proposer_name,
              u.email as proposer_email

            FROM swaps s
            JOIN bookings sb ON s.source_booking_id = sb.id
            LEFT JOIN swap_targets st ON s.id = st.target_swap_id AND st.status = 'active'
            LEFT JOIN swaps ts ON st.source_swap_id = ts.id
            LEFT JOIN bookings tb ON ts.source_booking_id = tb.id
            LEFT JOIN users u ON tb.user_id = u.id

            WHERE sb.user_id = $1
            ORDER BY s.created_at DESC
            LIMIT 5
        `;

        const result = await pool.query(query, [userId]);

        console.log(`📊 Found ${result.rows.length} swap(s)\n`);

        result.rows.forEach((row, index) => {
            console.log(`\n═══════════════════════════════════════════════════════`);
            console.log(`SWAP #${index + 1}: ${row.swap_id}`);
            console.log(`═══════════════════════════════════════════════════════`);

            console.log('\n📋 USER BOOKING (Left Side - Should Always Work):');
            console.log('  Title:', row.user_booking_title || '❌ NULL');
            console.log('  City:', row.user_booking_city || '❌ NULL');
            console.log('  Country:', row.user_booking_country || '❌ NULL');
            console.log('  Check-in:', row.user_booking_check_in || '❌ NULL');
            console.log('  Check-out:', row.user_booking_check_out || '❌ NULL');

            console.log('\n👤 PROPOSER BOOKING (Right Side - THE PROBLEM):');
            console.log('  ID:', row.proposer_booking_id_full || '❌ NULL');
            console.log('  Title:', row.proposer_booking_title || '❌ NULL');
            console.log('  City:', row.proposer_booking_city || '❌ NULL');
            console.log('  Country:', row.proposer_booking_country || '❌ NULL');
            console.log('  Check-in:', row.proposer_booking_check_in || '❌ NULL');
            console.log('  Check-out:', row.proposer_booking_check_out || '❌ NULL');
            console.log('  Proposer Name:', row.proposer_name || '❌ NULL');
            console.log('  Proposer Email:', row.proposer_email || '❌ NULL');

            console.log('\n🔍 RAW COLUMN NAMES IN THIS ROW:');
            console.log('  ', Object.keys(row).filter(k => k.startsWith('proposer_')).join(', '));

            // Check if transformation would work
            const prefix = 'proposer_booking';
            console.log('\n🔧 TRANSFORMATION TEST:');
            console.log(`  Looking for: ${prefix}_city =`, row[`${prefix}_city`]);
            console.log(`  Looking for: ${prefix}_country =`, row[`${prefix}_country`]);
            console.log(`  Looking for: ${prefix}_check_in =`, row[`${prefix}_check_in`]);
            console.log(`  Looking for: ${prefix}_check_out =`, row[`${prefix}_check_out`]);
        });

        console.log('\n\n✅ Debug complete!');
        console.log('\n💡 Analysis:');
        console.log('   If proposer_booking_* fields are NULL, the JOINs are still broken.');
        console.log('   If they have values but transformation fails, the transformation logic is broken.');
        console.log('   If both work, the problem is in the frontend display.');

    } catch (error) {
        console.error('❌ Error during debug:', error);
    } finally {
        await pool.end();
    }
}

debugProposerData();

