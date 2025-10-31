/**
 * Script to inspect existing targeting data in the database
 */

const { Pool } = require('pg');

// Database configuration (matching the .env file)
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'booking_swap_db',
    user: process.env.DB_USER || 'booking_swap',
    password: process.env.DB_PASSWORD || 'P@ssword123',
};

async function inspectExistingData() {
    const pool = new Pool(dbConfig);

    try {
        console.log('🔍 Inspecting Existing Targeting Data\n');

        // Step 1: Show all users
        console.log('1. Users in the system:');
        const usersResult = await pool.query(`
            SELECT id, email, display_name, created_at
            FROM users
            ORDER BY created_at DESC
            LIMIT 10
        `);

        if (usersResult.rows.length === 0) {
            console.log('   No users found');
        } else {
            usersResult.rows.forEach((user, index) => {
                console.log(`   ${index + 1}. ${user.email} (${user.display_name || 'No name'}) - ID: ${user.id}`);
            });
        }

        console.log();

        // Step 2: Show all swaps
        console.log('2. Swaps in the system:');
        const swapsResult = await pool.query(`
            SELECT s.id, s.owner_id, s.status, u.email as owner_email, b.title as booking_title
            FROM swaps s
            JOIN users u ON s.owner_id = u.id
            LEFT JOIN bookings b ON s.source_booking_id = b.id
            ORDER BY s.created_at DESC
            LIMIT 10
        `);

        if (swapsResult.rows.length === 0) {
            console.log('   No swaps found');
        } else {
            swapsResult.rows.forEach((swap, index) => {
                console.log(`   ${index + 1}. ${swap.owner_email}: ${swap.booking_title || 'No title'} (${swap.status}) - ID: ${swap.id}`);
            });
        }

        console.log();

        // Step 3: Show all targeting relationships
        console.log('3. Targeting relationships:');
        const targetingResult = await pool.query(`
            SELECT 
                st.id as target_id,
                st.source_swap_id,
                st.target_swap_id,
                st.status,
                st.created_at,
                u1.email as source_user,
                u2.email as target_user,
                b1.title as source_booking,
                b2.title as target_booking
            FROM swap_targets st
            JOIN swaps s1 ON st.source_swap_id = s1.id
            JOIN swaps s2 ON st.target_swap_id = s2.id
            JOIN users u1 ON s1.owner_id = u1.id
            JOIN users u2 ON s2.owner_id = u2.id
            LEFT JOIN bookings b1 ON s1.source_booking_id = b1.id
            LEFT JOIN bookings b2 ON s2.source_booking_id = b2.id
            ORDER BY st.created_at DESC
        `);

        if (targetingResult.rows.length === 0) {
            console.log('   No targeting relationships found');
        } else {
            targetingResult.rows.forEach((target, index) => {
                console.log(`   ${index + 1}. ${target.source_user} (${target.source_booking || 'No title'}) → ${target.target_user} (${target.target_booking || 'No title'}) [${target.status}]`);
                console.log(`      Target ID: ${target.target_id}`);
            });
        }

        console.log();

        // Step 4: Test with actual users who have targeting data
        console.log('4. Testing with users who have targeting data:');

        // Get users who are involved in targeting relationships
        const usersWithTargetingResult = await pool.query(`
            SELECT DISTINCT u.id, u.email, 
                   COUNT(DISTINCT st1.id) as incoming_count,
                   COUNT(DISTINCT st2.id) as outgoing_count
            FROM users u
            LEFT JOIN swaps s ON u.id = s.owner_id
            LEFT JOIN swap_targets st1 ON s.id = st1.target_swap_id AND st1.status = 'active'
            LEFT JOIN swap_targets st2 ON s.id = st2.source_swap_id AND st2.status = 'active'
            WHERE st1.id IS NOT NULL OR st2.id IS NOT NULL
            GROUP BY u.id, u.email
        `);

        if (usersWithTargetingResult.rows.length === 0) {
            console.log('   No users with targeting data found');
        } else {
            for (const user of usersWithTargetingResult.rows) {
                console.log(`   Testing ${user.email} (${user.incoming_count} incoming, ${user.outgoing_count} outgoing):`);

                // Test the actual repository query for this user
                const incomingQuery = `
                    SELECT 
                        st.id as target_id,
                        st.source_swap_id,
                        u.email as source_user,
                        b.title as source_booking
                    FROM swap_targets st
                    JOIN swaps ts ON st.target_swap_id = ts.id
                    JOIN swaps s ON st.source_swap_id = s.id
                    JOIN users u ON s.owner_id = u.id
                    LEFT JOIN bookings b ON s.source_booking_id = b.id
                    WHERE ts.owner_id = $1 AND st.status = 'active'
                `;

                const incomingResult = await pool.query(incomingQuery, [user.id]);
                console.log(`     Incoming targets: ${incomingResult.rows.length}`);
                incomingResult.rows.forEach((target, index) => {
                    console.log(`       ${index + 1}. From ${target.source_user} (${target.source_booking || 'No title'})`);
                });

                const outgoingQuery = `
                    SELECT 
                        st.id as target_id,
                        st.target_swap_id,
                        u.email as target_user,
                        b.title as target_booking
                    FROM swap_targets st
                    JOIN swaps ss ON st.source_swap_id = ss.id
                    JOIN swaps s ON st.target_swap_id = s.id
                    JOIN users u ON s.owner_id = u.id
                    LEFT JOIN bookings b ON s.source_booking_id = b.id
                    WHERE ss.owner_id = $1 AND st.status = 'active'
                `;

                const outgoingResult = await pool.query(outgoingQuery, [user.id]);
                console.log(`     Outgoing targets: ${outgoingResult.rows.length}`);
                outgoingResult.rows.forEach((target, index) => {
                    console.log(`       ${index + 1}. To ${target.target_user} (${target.target_booking || 'No title'})`);
                });
            }
        }

        console.log();

        // Step 5: Show the exact data structure that should be returned
        console.log('5. Expected API response structure:');
        if (usersWithTargetingResult.rows.length > 0) {
            const testUser = usersWithTargetingResult.rows[0];
            console.log(`   For user ${testUser.email}, the API should return:`);
            console.log('   {');
            console.log('     "userSwap": { ... },');
            console.log('     "proposalsFromOthers": [ ... ],');
            console.log('     "targeting": {');
            console.log(`       "incomingTargetCount": ${testUser.incoming_count},`);
            console.log('       "incomingTargets": [');
            console.log('         { "targetId": "...", "sourceSwap": { ... } }');
            console.log('       ],');
            if (testUser.outgoing_count > 0) {
                console.log('       "outgoingTarget": {');
                console.log('         "targetId": "...", "targetSwap": { ... }');
                console.log('       },');
            }
            console.log('       "canReceiveTargets": true,');
            console.log('       "canTarget": true');
            console.log('     }');
            console.log('   }');
        }

        console.log();
        console.log('🎯 SUMMARY:');
        console.log(`   - Found ${usersResult.rows.length} users`);
        console.log(`   - Found ${swapsResult.rows.length} swaps`);
        console.log(`   - Found ${targetingResult.rows.length} targeting relationships`);
        console.log(`   - Found ${usersWithTargetingResult.rows.length} users with targeting data`);

        if (usersWithTargetingResult.rows.length > 0) {
            console.log();
            console.log('✅ GOOD NEWS: Targeting data exists!');
            console.log('   The issue is likely in the service layer or frontend component.');
            console.log('   Test the API with one of these users who have targeting data.');
        } else {
            console.log();
            console.log('⚠️  No users have targeting relationships.');
            console.log('   This explains why no targets appear in the UI.');
        }

    } catch (error) {
        console.error('❌ Error inspecting data:', error.message);
    } finally {
        await pool.end();
    }
}

// Run the inspection
inspectExistingData()
    .then(() => {
        console.log('\n✅ Data inspection completed');
    })
    .catch((error) => {
        console.error('\n❌ Data inspection failed:', error.message);
        process.exit(1);
    });