/**
 * Script to create test targeting data for validation
 * This will help us test the targeting display functionality with real data
 */

import { Pool } from 'pg';

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'booking_swap',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
};

async function createTestTargetingData(): Promise<void> {
    const pool = new Pool(dbConfig);

    try {
        console.log('🔧 Creating test targeting data...\n');

        // Step 1: Check current state
        console.log('1. Checking current database state...');

        const tablesCheck = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM swap_targets) as swap_targets_count,
                (SELECT COUNT(*) FROM swaps WHERE status = 'pending') as pending_swaps_count,
                (SELECT COUNT(*) FROM users) as users_count,
                (SELECT COUNT(*) FROM bookings) as bookings_count
        `);

        const { swap_targets_count, pending_swaps_count, users_count, bookings_count } = tablesCheck.rows[0];

        console.log(`   swap_targets: ${swap_targets_count} records`);
        console.log(`   pending swaps: ${pending_swaps_count} records`);
        console.log(`   users: ${users_count} records`);
        console.log(`   bookings: ${bookings_count} records`);

        if (users_count < 2) {
            console.log('   ⚠️  Need at least 2 users to create targeting relationships');
            console.log('   Creating test users...');

            // Create test users
            await pool.query(`
                INSERT INTO users (id, email, display_name, password_hash, email_verified, created_at, updated_at)
                VALUES 
                    ('user-test-1', 'alice@test.com', 'Alice Johnson', 'hashed_password', true, NOW(), NOW()),
                    ('user-test-2', 'bob@test.com', 'Bob Smith', 'hashed_password', true, NOW(), NOW()),
                    ('user-test-3', 'charlie@test.com', 'Charlie Wilson', 'hashed_password', true, NOW(), NOW())
                ON CONFLICT (email) DO NOTHING
            `);
            console.log('   ✅ Test users created');
        }

        if (bookings_count < 3) {
            console.log('   ⚠️  Need at least 3 bookings to create targeting relationships');
            console.log('   Creating test bookings...');

            // Create test bookings
            await pool.query(`
                INSERT INTO bookings (id, user_id, title, city, country, check_in_date, check_out_date, original_price, swap_value, created_at, updated_at)
                VALUES 
                    ('booking-test-1', 'user-test-1', 'Manhattan Luxury Suite', 'New York', 'USA', '2024-02-01', '2024-02-05', 1500, 1200, NOW(), NOW()),
                    ('booking-test-2', 'user-test-2', 'Paris Apartment', 'Paris', 'France', '2024-02-01', '2024-02-05', 1400, 1100, NOW(), NOW()),
                    ('booking-test-3', 'user-test-3', 'Tokyo Business Hotel', 'Tokyo', 'Japan', '2024-02-01', '2024-02-05', 1300, 1000, NOW(), NOW())
                ON CONFLICT (id) DO NOTHING
            `);
            console.log('   ✅ Test bookings created');
        }

        if (pending_swaps_count < 3) {
            console.log('   ⚠️  Need at least 3 swaps to create targeting relationships');
            console.log('   Creating test swaps...');

            // Create test swaps
            await pool.query(`
                INSERT INTO swaps (id, owner_id, source_booking_id, status, acceptance_strategy, created_at, updated_at, expires_at)
                VALUES 
                    ('swap-test-1', 'user-test-1', 'booking-test-1', 'pending', '{"type": "first_match"}', NOW(), NOW(), NOW() + INTERVAL '30 days'),
                    ('swap-test-2', 'user-test-2', 'booking-test-2', 'pending', '{"type": "first_match"}', NOW(), NOW(), NOW() + INTERVAL '30 days'),
                    ('swap-test-3', 'user-test-3', 'booking-test-3', 'pending', '{"type": "first_match"}', NOW(), NOW(), NOW() + INTERVAL '30 days')
                ON CONFLICT (id) DO NOTHING
            `);
            console.log('   ✅ Test swaps created');
        }

        console.log();

        // Step 2: Create targeting relationships in swap_targets table
        console.log('2. Creating targeting relationships...');

        // Create some targeting relationships:
        // - User B targets User A's swap
        // - User C targets User A's swap  
        // - User A targets User C's swap

        const targetingData = [
            {
                id: 'target-test-1',
                source_swap_id: 'swap-test-2', // Bob's swap
                target_swap_id: 'swap-test-1', // targeting Alice's swap
                proposal_id: 'proposal-test-1'
            },
            {
                id: 'target-test-2',
                source_swap_id: 'swap-test-3', // Charlie's swap
                target_swap_id: 'swap-test-1', // targeting Alice's swap
                proposal_id: 'proposal-test-2'
            },
            {
                id: 'target-test-3',
                source_swap_id: 'swap-test-1', // Alice's swap
                target_swap_id: 'swap-test-3', // targeting Charlie's swap
                proposal_id: 'proposal-test-3'
            }
        ];

        // First create the proposal swaps that the targeting relationships reference
        for (const target of targetingData) {
            await pool.query(`
                INSERT INTO swaps (id, proposer_id, source_booking_id, target_booking_id, status, created_at, updated_at, expires_at)
                SELECT 
                    $1 as id,
                    s.owner_id as proposer_id,
                    s.source_booking_id,
                    t.source_booking_id as target_booking_id,
                    'pending' as status,
                    NOW() as created_at,
                    NOW() as updated_at,
                    NOW() + INTERVAL '30 days' as expires_at
                FROM swaps s, swaps t
                WHERE s.id = $2 AND t.id = $3
                ON CONFLICT (id) DO NOTHING
            `, [target.proposal_id, target.source_swap_id, target.target_swap_id]);
        }

        // Now create the targeting relationships
        for (const target of targetingData) {
            await pool.query(`
                INSERT INTO swap_targets (id, source_swap_id, target_swap_id, proposal_id, status, created_at, updated_at)
                VALUES ($1, $2, $3, $4, 'active', NOW(), NOW())
                ON CONFLICT (id) DO NOTHING
            `, [target.id, target.source_swap_id, target.target_swap_id, target.proposal_id]);
        }

        console.log('   ✅ Targeting relationships created');

        // Step 3: Verify the data was created correctly
        console.log();
        console.log('3. Verifying created data...');

        const verificationQuery = `
            SELECT 
                st.id as target_id,
                st.source_swap_id,
                st.target_swap_id,
                st.status,
                u1.email as source_user,
                u2.email as target_user,
                b1.title as source_booking,
                b2.title as target_booking
            FROM swap_targets st
            JOIN swaps s1 ON st.source_swap_id = s1.id
            JOIN swaps s2 ON st.target_swap_id = s2.id
            JOIN users u1 ON s1.owner_id = u1.id
            JOIN users u2 ON s2.owner_id = u2.id
            JOIN bookings b1 ON s1.source_booking_id = b1.id
            JOIN bookings b2 ON s2.source_booking_id = b2.id
            WHERE st.status = 'active'
            ORDER BY st.created_at
        `;

        const verificationResult = await pool.query(verificationQuery);

        console.log(`   Found ${verificationResult.rows.length} active targeting relationships:`);
        verificationResult.rows.forEach((row, index) => {
            console.log(`     ${index + 1}. ${row.source_user} (${row.source_booking}) → ${row.target_user} (${row.target_booking})`);
        });

        // Step 4: Test the repository query
        console.log();
        console.log('4. Testing repository query...');

        // Test with Alice (user-test-1) who should have 2 incoming targets and 1 outgoing target
        const testUserId = 'user-test-1';

        const incomingQuery = `
            -- Incoming targets from swap_targets table (new targeting system)
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
                b.check_in_date as booking_check_in,
                b.check_out_date as booking_check_out,
                b.original_price as booking_price,
                u.id as owner_id,
                u.display_name as owner_name,
                u.email as owner_email,
                'targeting' as source_type
            FROM swap_targets st
            JOIN swaps ts ON st.target_swap_id = ts.id  -- Target swap (user's swap)
            JOIN swaps s ON st.source_swap_id = s.id    -- Source swap (other user's swap)
            JOIN bookings b ON s.source_booking_id = b.id
            JOIN users u ON s.owner_id = u.id
            WHERE ts.owner_id = $1 AND st.status = 'active'
            ORDER BY st.created_at DESC
        `;

        const incomingResult = await pool.query(incomingQuery, [testUserId]);
        console.log(`   Alice has ${incomingResult.rows.length} incoming targets:`);
        incomingResult.rows.forEach((row, index) => {
            console.log(`     ${index + 1}. From ${row.owner_name} (${row.booking_title})`);
        });

        const outgoingQuery = `
            -- Outgoing targets from swap_targets table (new targeting system)
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
                b.check_in_date as booking_check_in,
                b.check_out_date as booking_check_out,
                b.original_price as booking_price,
                u.id as owner_id,
                u.display_name as owner_name,
                u.email as owner_email,
                'targeting' as source_type
            FROM swap_targets st
            JOIN swaps ss ON st.source_swap_id = ss.id  -- Source swap (user's swap)
            JOIN swaps s ON st.target_swap_id = s.id    -- Target swap (other user's swap)
            JOIN bookings b ON s.source_booking_id = b.id
            JOIN users u ON s.owner_id = u.id
            WHERE ss.owner_id = $1 AND st.status = 'active'
            ORDER BY st.created_at DESC
        `;

        const outgoingResult = await pool.query(outgoingQuery, [testUserId]);
        console.log(`   Alice has ${outgoingResult.rows.length} outgoing targets:`);
        outgoingResult.rows.forEach((row, index) => {
            console.log(`     ${index + 1}. To ${row.owner_name} (${row.booking_title})`);
        });

        console.log();
        console.log('🎉 Test targeting data created successfully!');
        console.log();
        console.log('📋 Summary:');
        console.log(`   - Created ${verificationResult.rows.length} targeting relationships`);
        console.log(`   - Alice (user-test-1) has ${incomingResult.rows.length} incoming and ${outgoingResult.rows.length} outgoing targets`);
        console.log('   - Data is ready for testing the targeting display functionality');
        console.log();
        console.log('🔍 Next steps:');
        console.log('   1. Test the API endpoint: GET /api/swaps (with Alice\'s auth token)');
        console.log('   2. Verify the frontend SwapCard displays the targeting indicators');
        console.log('   3. Test the targeting actions (accept/reject/cancel)');

    } catch (error) {
        console.error('❌ Error creating test targeting data:', error.message);
        console.error(error.stack);
    } finally {
        await pool.end();
    }
}

// Run the script
if (require.main === module) {
    createTestTargetingData()
        .then(() => {
            console.log('\n✅ Test data creation completed');
        })
        .catch((error) => {
            console.error('\n❌ Test data creation failed:', error.message);
            process.exit(1);
        });
}

export { createTestTargetingData };