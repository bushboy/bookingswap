/**
 * Test the /api/swaps/cards endpoint that the frontend is actually calling
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

async function testSwapsCardsEndpoint() {
    const pool = new Pool(dbConfig);

    try {
        console.log('🧪 Testing /api/swaps/cards Endpoint (Frontend is calling this)\n');

        // Get user with targeting data
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

        const testUser = usersWithTargetingResult.rows[0];
        console.log(`Testing with user: ${testUser.email}`);
        console.log(`Expected targeting: ${testUser.incoming_count} incoming, ${testUser.outgoing_count} outgoing\n`);

        // Create JWT token
        const token = jwt.sign(
            {
                userId: testUser.id,
                email: testUser.email,
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
            },
            JWT_SECRET
        );

        // Test both endpoints
        const endpoints = [
            { name: '/api/swaps', url: 'http://localhost:3001/api/swaps' },
            { name: '/api/swaps/cards', url: 'http://localhost:3001/api/swaps/cards' }
        ];

        for (const endpoint of endpoints) {
            console.log(`\n=== Testing ${endpoint.name} ===`);

            try {
                const response = await fetch(endpoint.url, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                console.log(`Response status: ${response.status} ${response.statusText}`);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.log(`❌ Error response: ${errorText}`);
                    continue;
                }

                const responseData = await response.json();
                console.log('✅ API call successful');

                // Analyze response structure
                const swapCards = responseData.data?.swapCards || [];
                console.log(`Found ${swapCards.length} swap cards`);

                if (swapCards.length > 0) {
                    swapCards.forEach((card, index) => {
                        console.log(`\nCard ${index + 1}:`);
                        console.log(`  Swap ID: ${card.userSwap?.id}`);
                        console.log(`  Has targeting: ${!!card.targeting}`);

                        if (card.targeting) {
                            console.log(`  Targeting data:`);
                            console.log(`    Incoming count: ${card.targeting.incomingTargetCount || 0}`);
                            console.log(`    Incoming targets: ${card.targeting.incomingTargets?.length || 0}`);
                            console.log(`    Has outgoing: ${!!card.targeting.outgoingTarget}`);
                            console.log(`    Can receive: ${card.targeting.canReceiveTargets}`);
                            console.log(`    Can target: ${card.targeting.canTarget}`);
                        } else {
                            console.log(`  ❌ No targeting data`);
                        }
                    });
                } else {
                    console.log('⚠️  No swap cards returned');
                }

                // Show metadata if available
                if (responseData.metadata?.targeting) {
                    console.log(`\nMetadata targeting info:`);
                    console.log(`  Data included: ${responseData.metadata.targeting.dataIncluded}`);
                    console.log(`  Total incoming: ${responseData.metadata.targeting.totalIncomingTargets}`);
                    console.log(`  Total outgoing: ${responseData.metadata.targeting.totalOutgoingTargets}`);
                }

            } catch (fetchError) {
                console.log(`❌ HTTP request failed: ${fetchError.message}`);
            }
        }

        console.log('\n🎯 COMPARISON SUMMARY:');
        console.log('If /api/swaps has targeting data but /api/swaps/cards does not,');
        console.log('then the frontend is calling the wrong endpoint!');

    } catch (error) {
        console.error('❌ Error testing endpoints:', error.message);
    } finally {
        await pool.end();
    }
}

// Run the test
testSwapsCardsEndpoint()
    .then(() => {
        console.log('\n✅ Endpoint comparison test completed');
    })
    .catch((error) => {
        console.error('\n❌ Test failed:', error.message);
        process.exit(1);
    });