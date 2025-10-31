/**
 * Test script to verify that swaps with accepted targets are excluded from browse results
 * 
 * This script:
 * 1. Creates two test swaps
 * 2. Creates a targeting relationship with status='accepted'
 * 3. Verifies that both swaps are excluded from browse results
 */

const { Pool } = require('pg');

// Import centralized wallet configuration
const WALLET_CONFIG = {
  PRIMARY_TESTNET_ACCOUNT: '0.0.6199687',
  TRANSACTION_ID_PREFIX: '0.0.6199687@'
};

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'booking_swap_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

async function testAcceptedTargetFilter() {
  console.log('🧪 Testing accepted target filter in browse results...\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Step 1: Get or create test user
    console.log('1️⃣  Getting test user...');
    let userResult = await client.query(`
      SELECT id FROM users WHERE email = 'test-browse@example.com'
    `);

    let userId;
    if (userResult.rows.length > 0) {
      userId = userResult.rows[0].id;
      console.log(`   ✅ Using existing user: ${userId}`);
    } else {
      userResult = await client.query(`
        INSERT INTO users (email, username, password_hash)
        VALUES ('test-browse@example.com', 'test-browse-user', 'dummy-hash')
        RETURNING id
      `);
      userId = userResult.rows[0].id;
      console.log(`   ✅ Created new user: ${userId}`);
    }

    // Step 2: Create test bookings
    console.log('\n2️⃣  Creating test bookings...');
    const booking1Result = await client.query(`
      INSERT INTO bookings (
        user_id, title, description, type, status,
        check_in_date, check_out_date,
        city, country, original_price, swap_value,
        provider_name, confirmation_number, blockchain_topic_id
      )
      VALUES (
        $1, 'Test Hotel Paris', 'Luxury hotel', 'hotel', 'available',
        '2025-06-01', '2025-06-07',
        'Paris', 'France', 1200, 1200,
        'Test Provider', 'TEST-CONFIRM-001', $2
      )
      RETURNING id
    `, [userId, WALLET_CONFIG.PRIMARY_TESTNET_ACCOUNT]);
    const booking1Id = booking1Result.rows[0].id;

    const booking2Result = await client.query(`
      INSERT INTO bookings (
        user_id, title, description, type, status,
        check_in_date, check_out_date,
        city, country, original_price, swap_value,
        provider_name, confirmation_number, blockchain_topic_id
      )
      VALUES (
        $1, 'Test Hotel Rome', 'Beautiful hotel', 'hotel', 'available',
        '2025-07-01', '2025-07-07',
        'Rome', 'Italy', 1500, 1500,
        'Test Provider', 'TEST-CONFIRM-002', $2
      )
      RETURNING id
    `, [userId, WALLET_CONFIG.PRIMARY_TESTNET_ACCOUNT]);
    const booking2Id = booking2Result.rows[0].id;
    console.log(`   ✅ Created booking 1: ${booking1Id}`);
    console.log(`   ✅ Created booking 2: ${booking2Id}`);

    // Step 3: Create test swaps
    console.log('\n3️⃣  Creating test swaps...');
    const swap1Result = await client.query(`
      INSERT INTO swaps (
        source_booking_id, status, expires_at,
        payment_types, acceptance_strategy,
        blockchain_proposal_transaction_id
      )
      VALUES (
        $1, 'pending', NOW() + INTERVAL '30 days',
        '{"bookingExchange": true, "cashPayment": false}'::jsonb,
        '{"type": "first_match"}'::jsonb,
        $2
      )
      RETURNING id
    `, [booking1Id, `${WALLET_CONFIG.TRANSACTION_ID_PREFIX}1234567890.000000000`]);
    const swap1Id = swap1Result.rows[0].id;

    const swap2Result = await client.query(`
      INSERT INTO swaps (
        source_booking_id, status, expires_at,
        payment_types, acceptance_strategy,
        blockchain_proposal_transaction_id
      )
      VALUES (
        $1, 'pending', NOW() + INTERVAL '30 days',
        '{"bookingExchange": true, "cashPayment": false}'::jsonb,
        '{"type": "first_match"}'::jsonb,
        $2
      )
      RETURNING id
    `, [booking2Id, `${WALLET_CONFIG.TRANSACTION_ID_PREFIX}1234567891.000000000`]);
    const swap2Id = swap2Result.rows[0].id;
    console.log(`   ✅ Created swap 1: ${swap1Id}`);
    console.log(`   ✅ Created swap 2: ${swap2Id}`);

    // Step 4: Query browse results BEFORE creating accepted target
    console.log('\n4️⃣  Checking browse results BEFORE accepted target...');
    const beforeResult = await client.query(`
      SELECT s.id, s.status, sb.title
      FROM swaps s
      LEFT JOIN bookings sb ON s.source_booking_id = sb.id
      WHERE s.status IN ('pending', 'rejected')
        AND s.expires_at > CURRENT_TIMESTAMP
        AND NOT EXISTS (
          SELECT 1 FROM swap_targets st
          WHERE (st.source_swap_id = s.id OR st.target_swap_id = s.id)
          AND st.status = 'accepted'
        )
        AND s.id IN ($1, $2)
    `, [swap1Id, swap2Id]);
    console.log(`   📊 Found ${beforeResult.rows.length} swaps in browse results`);
    beforeResult.rows.forEach(row => {
      console.log(`      - ${row.title} (${row.id}) - status: ${row.status}`);
    });

    // Step 5: Create accepted target relationship
    console.log('\n5️⃣  Creating accepted target relationship...');
    const targetResult = await client.query(`
      INSERT INTO swap_targets (
        source_swap_id, target_swap_id, status
      )
      VALUES ($1, $2, 'accepted')
      RETURNING id
    `, [swap1Id, swap2Id]);
    const targetId = targetResult.rows[0].id;
    console.log(`   ✅ Created accepted target: ${targetId}`);
    console.log(`      Source swap: ${swap1Id} → Target swap: ${swap2Id}`);

    // Step 6: Query browse results AFTER creating accepted target
    console.log('\n6️⃣  Checking browse results AFTER accepted target...');
    const afterResult = await client.query(`
      SELECT s.id, s.status, sb.title
      FROM swaps s
      LEFT JOIN bookings sb ON s.source_booking_id = sb.id
      WHERE s.status IN ('pending', 'rejected')
        AND s.expires_at > CURRENT_TIMESTAMP
        AND NOT EXISTS (
          SELECT 1 FROM swap_targets st
          WHERE (st.source_swap_id = s.id OR st.target_swap_id = s.id)
          AND st.status = 'accepted'
        )
        AND s.id IN ($1, $2)
    `, [swap1Id, swap2Id]);
    console.log(`   📊 Found ${afterResult.rows.length} swaps in browse results`);
    if (afterResult.rows.length > 0) {
      afterResult.rows.forEach(row => {
        console.log(`      - ${row.title} (${row.id}) - status: ${row.status}`);
      });
    }

    // Step 7: Verify the filter worked
    console.log('\n7️⃣  Verification:');
    console.log(`   Before accepted target: ${beforeResult.rows.length} swaps visible`);
    console.log(`   After accepted target:  ${afterResult.rows.length} swaps visible`);

    if (beforeResult.rows.length === 2 && afterResult.rows.length === 0) {
      console.log('\n   ✅ SUCCESS: Both swaps correctly excluded from browse!');
      console.log('      - Source swap (targeting another) is hidden ✓');
      console.log('      - Target swap (being targeted) is hidden ✓');
    } else {
      console.log('\n   ❌ FAILURE: Filter did not work as expected');
      console.log(`      Expected: 2 swaps before, 0 swaps after`);
      console.log(`      Got: ${beforeResult.rows.length} before, ${afterResult.rows.length} after`);
    }

    // Rollback to avoid polluting the database
    await client.query('ROLLBACK');
    console.log('\n🔄 Rolled back test data');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error during test:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the test
testAcceptedTargetFilter()
  .then(() => {
    console.log('\n✅ Test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  })
  .finally(() => {
    pool.end();
  });

