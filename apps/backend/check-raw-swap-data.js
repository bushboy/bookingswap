/**
 * Check raw swap data directly from the database
 * to see what field names we actually get
 */

const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'booking_swap_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
});

async function checkRawData() {
    try {
        console.log('🔍 Checking raw swap data structure...\n');

        // Get a sample user ID that has swaps
        const userQuery = await pool.query(`
            SELECT DISTINCT sb.user_id 
            FROM swaps s
            JOIN bookings sb ON s.source_booking_id = sb.id
            LIMIT 1;
        `);

        if (userQuery.rows.length === 0) {
            console.log('❌ No swaps found in database');
            return;
        }

        const userId = userQuery.rows[0].user_id;
        console.log(`✅ Testing with user ID: ${userId}\n`);

        // Run the EXACT query from SwapRepository
        const query = `
            WITH user_swaps AS (
                SELECT 
                    s.id,
                    s.source_booking_id,
                    s.status,
                    s.created_at,
                    sb.user_id as owner_id,
                    sb.title as source_title,
                    sb.city as source_city,
                    sb.country as source_country
                FROM swaps s
                LEFT JOIN bookings sb ON s.source_booking_id = sb.id
                LEFT JOIN users u_owner ON sb.user_id = u_owner.id
                WHERE sb.user_id = $1 
                    AND s.status IN ('pending', 'accepted', 'completed')
                ORDER BY s.created_at DESC
                LIMIT 1
            ),
            incoming_proposals AS (
                SELECT 
                    proposer_swap.id,
                    proposer_swap.id as proposer_swap_id,
                    proposer_booking.user_id as proposer_id,
                    proposer_booking.title as proposer_booking_title,
                    proposer_booking.city as proposer_booking_city,
                    proposer_booking.country as proposer_booking_country,
                    proposer_booking.check_in_date as proposer_booking_check_in,
                    proposer_booking.check_out_date as proposer_booking_check_out,
                    st.target_swap_id
                FROM swap_targets st
                JOIN user_swaps us ON st.target_swap_id = us.id
                JOIN swaps proposer_swap ON st.source_swap_id = proposer_swap.id
                JOIN bookings proposer_booking ON proposer_swap.source_booking_id = proposer_booking.id
                WHERE st.status = 'active'
            )
            SELECT 
                us.id,
                us.source_title,
                us.source_city,
                us.source_country,
                COALESCE(
                    JSON_AGG(
                        DISTINCT JSONB_BUILD_OBJECT(
                            'id', ip.id,
                            'proposerBookingTitle', ip.proposer_booking_title,
                            'proposerBookingCity', ip.proposer_booking_city,
                            'proposerBookingCountry', ip.proposer_booking_country,
                            'proposerBookingCheckIn', ip.proposer_booking_check_in,
                            'proposerBookingCheckOut', ip.proposer_booking_check_out
                        )
                    ) FILTER (WHERE ip.id IS NOT NULL),
                    '[]'::json
                ) as incoming_proposals
            FROM user_swaps us
            LEFT JOIN incoming_proposals ip ON ip.target_swap_id = us.id
            GROUP BY us.id, us.source_title, us.source_city, us.source_country;
        `;

        const result = await pool.query(query, [userId]);

        console.log('📊 Raw Query Result:\n');
        console.log(JSON.stringify(result.rows, null, 2));

        if (result.rows.length > 0 && result.rows[0].incoming_proposals) {
            console.log('\n🎯 Field Analysis:');
            const proposals = result.rows[0].incoming_proposals;

            if (Array.isArray(proposals) && proposals.length > 0) {
                const firstProposal = proposals[0];
                console.log('First Proposal Keys:', Object.keys(firstProposal));
                console.log('\nField Values:');
                console.log('  proposerBookingTitle:', firstProposal.proposerBookingTitle);
                console.log('  proposerBookingCity:', firstProposal.proposerBookingCity,
                    firstProposal.proposerBookingCity ? '✅' : '❌ NULL/Missing');
                console.log('  proposerBookingCountry:', firstProposal.proposerBookingCountry,
                    firstProposal.proposerBookingCountry ? '✅' : '❌ NULL/Missing');
                console.log('  proposerBookingCheckIn:', firstProposal.proposerBookingCheckIn,
                    firstProposal.proposerBookingCheckIn ? '✅' : '❌ NULL/Missing');
                console.log('  proposerBookingCheckOut:', firstProposal.proposerBookingCheckOut,
                    firstProposal.proposerBookingCheckOut ? '✅' : '❌ NULL/Missing');
            } else {
                console.log('❌ No incoming proposals found');
            }
        }

        console.log('\n✅ Check complete!');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await pool.end();
    }
}

checkRawData();

