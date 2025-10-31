/**
 * Debug script to check if swap proposal location data is flowing through correctly
 * Run this with: node apps/backend/debug-swap-location.js
 */

const { Pool } = require('pg');

// Update these with your database credentials
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'booking_swap_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
});

async function debugSwapLocationData() {
    try {
        console.log('🔍 Checking booking location data...\n');

        // Check if bookings have location data
        const bookingsCheck = await pool.query(`
      SELECT 
        id,
        title,
        city,
        country,
        check_in_date,
        check_out_date,
        CASE WHEN city IS NULL THEN '❌ NULL' ELSE '✅ ' || city END as city_status,
        CASE WHEN country IS NULL THEN '❌ NULL' ELSE '✅ ' || country END as country_status
      FROM bookings
      WHERE id IN (
        SELECT source_booking_id FROM swaps
      )
      LIMIT 5;
    `);

        console.log('📋 Sample Bookings:');
        console.table(bookingsCheck.rows);

        // Check swap_targets with booking data
        const swapTargetsCheck = await pool.query(`
      SELECT 
        st.id as swap_target_id,
        st.source_swap_id,
        st.target_swap_id,
        pb.title as proposer_booking_title,
        pb.city as proposer_city,
        pb.country as proposer_country,
        CASE WHEN pb.city IS NULL THEN '❌' ELSE '✅' END as has_city,
        CASE WHEN pb.country IS NULL THEN '❌' ELSE '✅' END as has_country
      FROM swap_targets st
      JOIN swaps ps ON st.source_swap_id = ps.id
      JOIN bookings pb ON ps.source_booking_id = pb.id
      WHERE st.status = 'active'
      LIMIT 5;
    `);

        console.log('\n🎯 Sample Swap Targets with Booking Data:');
        console.table(swapTargetsCheck.rows);

        // First, find a swap that has incoming proposals (is a target)
        const targetSwapCheck = await pool.query(`
      SELECT DISTINCT st.target_swap_id
      FROM swap_targets st
      WHERE st.status = 'active'
      LIMIT 1;
    `);

        console.log('\n🎯 Found target swap with proposals:', targetSwapCheck.rows);

        // Test the actual query used in production
        const productionQuery = await pool.query(`
      WITH user_swaps AS (
        SELECT 
          s.id,
          s.source_booking_id,
          sb.user_id as owner_id,
          sb.title as source_title,
          sb.city as source_city,
          sb.country as source_country
        FROM swaps s
        LEFT JOIN bookings sb ON s.source_booking_id = sb.id
        WHERE s.id = $1  -- Use the swap that has incoming proposals
      ),
      incoming_proposals AS (
        SELECT 
          proposer_swap.id,
          proposer_booking.title as proposer_booking_title,
          proposer_booking.city as proposer_booking_city,
          proposer_booking.country as proposer_booking_country,
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
        JSON_AGG(
          JSONB_BUILD_OBJECT(
            'proposerBookingTitle', ip.proposer_booking_title,
            'proposerBookingCity', ip.proposer_booking_city,
            'proposerBookingCountry', ip.proposer_booking_country
          )
        ) FILTER (WHERE ip.id IS NOT NULL) as incoming_proposals
      FROM user_swaps us
      LEFT JOIN incoming_proposals ip ON ip.target_swap_id = us.id
      GROUP BY us.id, us.source_title, us.source_city, us.source_country;
    `, [targetSwapCheck.rows[0]?.target_swap_id || '00000000-0000-0000-0000-000000000000']);

        console.log('\n🏭 Production Query Test Result:');
        console.log(JSON.stringify(productionQuery.rows, null, 2));

        if (productionQuery.rows.length > 0) {
            const firstRow = productionQuery.rows[0];
            if (firstRow.incoming_proposals && firstRow.incoming_proposals.length > 0) {
                const firstProposal = firstRow.incoming_proposals[0];
                console.log('\n📊 First Proposal Analysis:');
                console.log('  proposerBookingCity:', firstProposal.proposerBookingCity || '❌ NULL/Missing');
                console.log('  proposerBookingCountry:', firstProposal.proposerBookingCountry || '❌ NULL/Missing');
                console.log('  proposerBookingTitle:', firstProposal.proposerBookingTitle || '❌ NULL/Missing');
            }
        }

        // Test the transformation logic using proposer_booking prefix
        console.log('\n🔄 Testing Field Name Transformation:');
        const testRow = {
            proposer_booking_city: 'Test City',
            proposer_booking_country: 'Test Country',
            proposer_booking_title: 'Test Hotel',
            proposer_booking_id: 'test-id',
            proposer_booking_check_in: new Date('2025-11-01'),
            proposer_booking_check_out: new Date('2025-11-05'),
            proposer_booking_original_price: 1000,
            proposer_booking_swap_value: 950
        };

        // Simulate transformation
        const transformRowToBookingDetails = (row, prefix) => {
            return {
                id: row[`${prefix}_id`],
                title: row[`${prefix}_title`] || 'Booking Details Unavailable',
                location: {
                    city: row[`${prefix}_city`] || 'Unknown',
                    country: row[`${prefix}_country`] || 'Unknown'
                },
                dateRange: {
                    checkIn: row[`${prefix}_check_in`] || new Date(),
                    checkOut: row[`${prefix}_check_out`] || new Date()
                },
                originalPrice: row[`${prefix}_original_price`] || null,
                swapValue: row[`${prefix}_swap_value`] || null
            };
        };

        const transformedBooking = transformRowToBookingDetails(testRow, 'proposer_booking');
        console.log('  Transformed with proposer_booking prefix:');
        console.log('  - City:', transformedBooking.location.city);
        console.log('  - Country:', transformedBooking.location.country);
        console.log('  - Title:', transformedBooking.title);

        if (transformedBooking.location.city === 'Test City' && transformedBooking.location.country === 'Test Country') {
            console.log('  ✅ Transformation works correctly with proposer_booking prefix!');
        } else {
            console.log('  ❌ Transformation failed!');
        }

        console.log('\n✅ Debug script completed successfully!');
        console.log('\n💡 Next Steps:');
        console.log('  1. If city/country show as NULL, populate them in your bookings table');
        console.log('  2. Restart your backend server to pick up SQL query changes');
        console.log('  3. Clear any API caches');

    } catch (error) {
        console.error('❌ Error during debug:', error);
    } finally {
        await pool.end();
    }
}

debugSwapLocationData();

