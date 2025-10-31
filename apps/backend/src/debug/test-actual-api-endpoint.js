/**
 * Test the actual API endpoint to see what's being returned
 * This will help identify exactly where the targeting data is being lost
 */

const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

// Database configuration (matching the .env file)
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'booking_swap_db',
    user: process.env.DB_USER || 'booking_swap',
    password: process.env.DB_PASSWORD || 'P@ssword123',
};

// JWT configuration (from .env file)
const JWT_SECRET = process.env.JWT_SECRET || 'E4p+9jdS5T82WGwa00WI8fZoMTQXQuXbkclBLrxCe64=';

async function testActualApiEndpoint() {
    const pool = new Pool(dbConfig);

    try {
        console.log('🧪 Testing Actual API Endpoint\n');

        // Step 1: Get a user with targeting data and create a JWT token
        const usersWithTargetingResult = await pool.query(`
            SELECT DISTINCT u.id, u.email, u.password_hash,
                   COUNT(DISTINCT st1.id) as incoming_count,
                   COUNT(DISTINCT st2.id) as outgoing_count
            FROM users u
            LEFT JOIN swaps s ON u.id = s.owner_id
            LEFT JOIN swap_targets st1 ON s.id = st1.target_swap_id AND st1.status = 'active'
            LEFT JOIN swap_targets st2 ON s.id = st2.source_swap_id AND st2.status = 'active'
            WHERE st1.id IS NOT NULL OR st2.id IS NOT NULL
            GROUP BY u.id, u.email, u.password_hash
            LIMIT 1
        `);

        if (usersWithTargetingResult.rows.length === 0) {
            console.log('❌ No users with targeting data found');
            return;
        }

        const testUser = usersWithTargetingResult.rows[0];
        console.log(`Testing with user: ${testUser.email}`);
        console.log(`Expected targeting: ${testUser.incoming_count} incoming, ${testUser.outgoing_count} outgoing\n`);

        // Step 2: Create a JWT token for this user
        const token = jwt.sign(
            {
                userId: testUser.id,
                email: testUser.email,
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
            },
            JWT_SECRET
        );

        console.log('1. Generated JWT token for API testing');
        console.log(`   Token: ${token.substring(0, 50)}...`);
        console.log();

        // Step 3: Test the API endpoint using HTTP request
        console.log('2. Testing API endpoint: GET /api/swaps');

        try {
            const response = await fetch('http://localhost:3001/api/swaps', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log(`   Response status: ${response.status} ${response.statusText}`);

            if (!response.ok) {
                const errorText = await response.text();
                console.log(`   Error response: ${errorText}`);

                if (response.status === 401) {
                    console.log('   ❌ Authentication failed - check JWT token or auth middleware');
                } else if (response.status === 500) {
                    console.log('   ❌ Server error - check backend logs');
                }
                return;
            }

            const responseData = await response.json();
            console.log('   ✅ API call successful');
            console.log();

            // Step 4: Analyze the response structure
            console.log('3. Analyzing API response structure:');

            if (!responseData.success) {
                console.log('   ❌ API returned success: false');
                console.log(`   Error: ${JSON.stringify(responseData.error || responseData)}`);
                return;
            }

            const swapCards = responseData.data?.swapCards || [];
            console.log(`   Found ${swapCards.length} swap cards`);

            if (swapCards.length === 0) {
                console.log('   ⚠️  No swap cards returned - user may not have any swaps');
                return;
            }

            // Step 5: Check each swap card for targeting data
            console.log();
            console.log('4. Checking swap cards for targeting data:');

            let cardsWithTargeting = 0;
            let totalIncoming = 0;
            let totalOutgoing = 0;

            swapCards.forEach((card, index) => {
                console.log(`   Card ${index + 1}: ${card.userSwap?.id || 'Unknown ID'}`);

                if (card.targeting) {
                    cardsWithTargeting++;
                    const incomingCount = card.targeting.incomingTargetCount || card.targeting.incomingTargets?.length || 0;
                    const hasOutgoing = !!card.targeting.outgoingTarget;

                    totalIncoming += incomingCount;
                    if (hasOutgoing) totalOutgoing++;

                    console.log(`     ✅ Has targeting data:`);
                    console.log(`       - Incoming targets: ${incomingCount}`);
                    console.log(`       - Outgoing target: ${hasOutgoing ? 'Yes' : 'No'}`);
                    console.log(`       - Can receive targets: ${card.targeting.canReceiveTargets}`);
                    console.log(`       - Can target: ${card.targeting.canTarget}`);

                    if (incomingCount > 0 && card.targeting.incomingTargets) {
                        console.log(`       - Incoming targets details:`);
                        card.targeting.incomingTargets.forEach((target, targetIndex) => {
                            console.log(`         ${targetIndex + 1}. ${target.sourceSwap?.ownerName || 'Unknown'} (${target.sourceSwap?.bookingDetails?.title || 'Unknown booking'})`);
                        });
                    }

                    if (hasOutgoing && card.targeting.outgoingTarget) {
                        const outgoing = card.targeting.outgoingTarget;
                        console.log(`       - Outgoing target: ${outgoing.targetSwap?.ownerName || 'Unknown'} (${outgoing.targetSwap?.bookingDetails?.title || 'Unknown booking'})`);
                    }
                } else {
                    console.log(`     ❌ No targeting data found`);
                }
            });

            console.log();
            console.log('5. Summary:');
            console.log(`   Total swap cards: ${swapCards.length}`);
            console.log(`   Cards with targeting data: ${cardsWithTargeting}`);
            console.log(`   Total incoming targets: ${totalIncoming}`);
            console.log(`   Total outgoing targets: ${totalOutgoing}`);
            console.log(`   Expected incoming: ${testUser.incoming_count}`);
            console.log(`   Expected outgoing: ${testUser.outgoing_count}`);

            console.log();
            console.log('🎯 DIAGNOSIS:');

            if (cardsWithTargeting === 0) {
                console.log('   ❌ ISSUE FOUND: No targeting data in API response');
                console.log('   → The targeting data is not making it from the service layer to the API response');
                console.log('   → Check SwapProposalService.getUserSwapsWithTargeting() method');
                console.log('   → Check SwapController.getUserSwaps() method');
                console.log('   → Check if targeting data is being filtered out');
            } else if (totalIncoming < testUser.incoming_count || totalOutgoing < testUser.outgoing_count) {
                console.log('   ⚠️  PARTIAL ISSUE: Some targeting data is missing');
                console.log('   → Some targeting relationships are not being returned');
                console.log('   → Check data transformation logic');
            } else {
                console.log('   ✅ SUCCESS: Targeting data is present in API response');
                console.log('   → The issue is likely in the frontend SwapCard component');
                console.log('   → Check if the frontend is displaying the targeting indicators');
            }

            // Step 6: Show the exact response structure for debugging
            console.log();
            console.log('6. Sample API response structure:');
            if (swapCards.length > 0) {
                const sampleCard = swapCards[0];
                console.log('   {');
                console.log(`     "userSwap": { "id": "${sampleCard.userSwap?.id || 'unknown'}" },`);
                console.log(`     "proposalCount": ${sampleCard.proposalCount || 0},`);
                if (sampleCard.targeting) {
                    console.log('     "targeting": {');
                    console.log(`       "incomingTargetCount": ${sampleCard.targeting.incomingTargetCount || 0},`);
                    console.log(`       "incomingTargets": [${sampleCard.targeting.incomingTargets?.length || 0} items],`);
                    console.log(`       "outgoingTarget": ${sampleCard.targeting.outgoingTarget ? 'present' : 'null'},`);
                    console.log(`       "canReceiveTargets": ${sampleCard.targeting.canReceiveTargets},`);
                    console.log(`       "canTarget": ${sampleCard.targeting.canTarget}`);
                    console.log('     }');
                } else {
                    console.log('     "targeting": null');
                }
                console.log('   }');
            }

        } catch (fetchError) {
            console.log(`   ❌ HTTP request failed: ${fetchError.message}`);

            if (fetchError.code === 'ECONNREFUSED') {
                console.log('   → Backend server is not running on localhost:3001');
                console.log('   → Start the backend server: npm run dev');
            } else {
                console.log('   → Check if the backend server is accessible');
                console.log('   → Verify the API endpoint URL');
            }
        }

    } catch (error) {
        console.error('❌ Error testing API endpoint:', error.message);
        console.error(error.stack);
    } finally {
        await pool.end();
    }
}

// Check if fetch is available (Node.js 18+)
if (typeof fetch === 'undefined') {
    console.log('❌ fetch is not available in this Node.js version');
    console.log('   This test requires Node.js 18+ or you can install node-fetch');
    console.log('   Alternative: Test the API endpoint manually using curl or Postman');
    console.log();
    console.log('   Manual test command:');
    console.log('   curl -H "Authorization: Bearer <token>" http://localhost:3001/api/swaps');
    process.exit(1);
}

// Run the test
testActualApiEndpoint()
    .then(() => {
        console.log('\n✅ API endpoint test completed');
    })
    .catch((error) => {
        console.error('\n❌ API endpoint test failed:', error.message);
        process.exit(1);
    });