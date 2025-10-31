const { Pool } = require('pg');

// Database connection
const pool = new Pool({
    user: 'booking_swap',
    host: 'localhost',
    database: 'booking_swap_db',
    password: 'P@ssword123',
    port: 5432,
});

async function debugSwapCreation() {
    try {
        console.log('=== Understanding Swap Creation vs Proposals ===\n');

        // Get the swap with target_booking_id
        const swapWithTargetResult = await pool.query(`
            SELECT s.id, s.source_booking_id, s.target_booking_id, s.proposer_id, s.owner_id, s.status,
                   sb.title as source_title, sb.user_id as source_user_id,
                   tb.title as target_title, tb.user_id as target_user_id
            FROM swaps s
            LEFT JOIN bookings sb ON s.source_booking_id = sb.id
            LEFT JOIN bookings tb ON s.target_booking_id = tb.id
            WHERE s.target_booking_id IS NOT NULL
        `);

        console.log('=== Swap with target_booking_id ===');
        swapWithTargetResult.rows.forEach(row => {
            console.log(`Swap ${row.id}:`);
            console.log(`  - Source booking: ${row.source_booking_id} (${row.source_title}) owned by ${row.source_user_id}`);
            console.log(`  - Target booking: ${row.target_booking_id} (${row.target_title}) owned by ${row.target_user_id}`);
            console.log(`  - Proposer: ${row.proposer_id}`);
            console.log(`  - Owner: ${row.owner_id}`);
            console.log(`  - Status: ${row.status}`);
            console.log(`  - Is cross-user proposal: ${row.proposer_id !== row.owner_id ? 'YES' : 'NO'}`);
            console.log(`  - Target booking owner matches swap owner: ${row.target_user_id === row.owner_id ? 'YES' : 'NO'}`);
        });

        // Check what the targeting system expects
        console.log('\n=== What the targeting system expects ===');
        console.log('For a proper cross-user proposal:');
        console.log('1. User A creates a swap targeting User B\'s booking');
        console.log('2. This creates a swap record with:');
        console.log('   - source_booking_id: User A\'s booking');
        console.log('   - target_booking_id: User B\'s booking');
        console.log('   - proposer_id: User A');
        console.log('   - owner_id: User B (target booking owner)');
        console.log('3. This would show up as an "incoming target" for User B');
        console.log('4. And as an "outgoing target" for User A');

        // Let's simulate what should happen
        const users = await pool.query('SELECT id, display_name FROM users LIMIT 2');
        const bookings = await pool.query('SELECT id, title, user_id FROM bookings LIMIT 2');

        if (users.rows.length >= 2 && bookings.rows.length >= 2) {
            const userA = users.rows[0];
            const userB = users.rows[1];
            const bookingA = bookings.rows.find(b => b.user_id === userA.id) || bookings.rows[0];
            const bookingB = bookings.rows.find(b => b.user_id === userB.id) || bookings.rows[1];

            console.log('\n=== Simulation: If User A proposes to User B ===');
            console.log(`User A: ${userA.display_name || userA.id}`);
            console.log(`User B: ${userB.display_name || userB.id}`);
            console.log(`User A's booking: ${bookingA.title} (${bookingA.id})`);
            console.log(`User B's booking: ${bookingB.title} (${bookingB.id})`);

            console.log('\nProposal would create swap:');
            console.log(`  - source_booking_id: ${bookingA.id} (User A's booking)`);
            console.log(`  - target_booking_id: ${bookingB.id} (User B's booking)`);
            console.log(`  - proposer_id: ${userA.id} (User A)`);
            console.log(`  - owner_id: ${userB.id} (User B - target booking owner)`);

            console.log('\nThis would show in targeting queries as:');
            console.log(`  - Incoming target for User B: User A is targeting User B's booking`);
            console.log(`  - Outgoing target for User A: User A is targeting User B's booking`);
        }

        // Check if there's a mismatch in the current data
        console.log('\n=== Current Data Analysis ===');
        const currentSwap = swapWithTargetResult.rows[0];
        if (currentSwap) {
            console.log('Current swap analysis:');
            if (currentSwap.proposer_id === currentSwap.owner_id) {
                console.log('❌ This is NOT a cross-user proposal (proposer = owner)');
                console.log('❌ This appears to be a user creating a swap targeting a specific booking');
                console.log('❌ But they are the owner of their own swap, not a proposal to someone else');

                if (currentSwap.target_user_id !== currentSwap.owner_id) {
                    console.log('🤔 However, the target booking belongs to a different user');
                    console.log('🤔 This suggests the user created a swap targeting someone else\'s booking');
                    console.log('🤔 But the swap ownership model might be incorrect');
                }
            } else {
                console.log('✅ This IS a cross-user proposal');
            }
        }

    } catch (error) {
        console.error('Error debugging swap creation:', error);
    } finally {
        await pool.end();
    }
}

debugSwapCreation();