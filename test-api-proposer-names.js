/**
 * Test the /api/swaps endpoint to verify proposer names are resolved
 * This tests the complete end-to-end flow
 */

const http = require('http');
const https = require('https');

async function testApiProposerNames() {
    console.log('🔍 Testing /api/swaps endpoint for proposer name resolution...\n');

    // Configuration
    const config = {
        host: process.env.API_HOST || 'localhost',
        port: process.env.API_PORT || 3001,
        protocol: process.env.API_PROTOCOL || 'http',
        testUserId: process.env.TEST_USER_ID || 'test-user-123'
    };

    const client = config.protocol === 'https' ? https : http;

    try {
        // Test 1: Check if API is accessible
        console.log('📋 Test 1: Checking API accessibility');

        const healthCheck = await makeRequest(client, {
            hostname: config.host,
            port: config.port,
            path: '/health',
            method: 'GET'
        });

        if (healthCheck.statusCode === 200) {
            console.log('  ✅ API is accessible');
        } else {
            console.log('  ⚠️  API health check returned:', healthCheck.statusCode);
        }

        // Test 2: Test the swaps endpoint
        console.log('\n📋 Test 2: Testing /api/swaps endpoint');

        const swapsResponse = await makeRequest(client, {
            hostname: config.host,
            port: config.port,
            path: `/api/swaps?userId=${config.testUserId}`,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer test-token` // Add if needed
            }
        });

        console.log(`  Response status: ${swapsResponse.statusCode}`);

        if (swapsResponse.statusCode === 200) {
            const swapsData = JSON.parse(swapsResponse.body);

            console.log(`  Found ${swapsData.length || 0} swap cards`);

            if (swapsData.length > 0) {
                let totalProposals = 0;
                let validProposerNames = 0;
                let unknownProposerNames = 0;

                swapsData.forEach((swapCard, index) => {
                    console.log(`  Swap Card ${index + 1}:`);
                    console.log(`    User swap: ${swapCard.userSwap?.id || 'N/A'}`);
                    console.log(`    Proposals: ${swapCard.proposalsFromOthers?.length || 0}`);

                    if (swapCard.proposalsFromOthers) {
                        swapCard.proposalsFromOthers.forEach((proposal, pIndex) => {
                            totalProposals++;
                            const proposerName = proposal.proposerName;

                            console.log(`      Proposal ${pIndex + 1}: "${proposerName}"`);

                            if (!proposerName || proposerName === 'Unknown User' || proposerName === 'unknown') {
                                unknownProposerNames++;
                            } else {
                                validProposerNames++;
                            }
                        });
                    }
                });

                const successRate = totalProposals > 0 ? (validProposerNames / totalProposals) * 100 : 100;

                console.log(`\n  📊 Proposer Name Analysis:`);
                console.log(`    Total proposals: ${totalProposals}`);
                console.log(`    Valid names: ${validProposerNames}`);
                console.log(`    Unknown names: ${unknownProposerNames}`);
                console.log(`    Success rate: ${successRate.toFixed(1)}%`);

                if (successRate > 80) {
                    console.log('  ✅ Proposer names are resolved correctly');
                } else if (successRate > 50) {
                    console.log('  ⚠️  Some proposer names are unresolved');
                } else {
                    console.log('  ❌ Too many unresolved proposer names');
                }
            } else {
                console.log('  ℹ️  No swap data available for testing');
            }
        } else {
            console.log(`  ❌ API request failed: ${swapsResponse.statusCode}`);
            console.log(`  Response: ${swapsResponse.body}`);
        }

        // Test 3: Test with different user ID if available
        console.log('\n📋 Test 3: Testing with sample user data');

        // Try to get a real user ID from the database if possible
        const { Pool } = require('pg');

        try {
            const pool = new Pool({
                host: process.env.DB_HOST || 'localhost',
                port: process.env.DB_PORT || 5432,
                database: process.env.DB_NAME || 'booking_swap_dev',
                user: process.env.DB_USER || 'postgres',
                password: process.env.DB_PASSWORD || 'password',
            });

            const userQuery = `
        SELECT DISTINCT sb.user_id 
        FROM swaps s 
        JOIN bookings sb ON s.source_booking_id = sb.id 
        WHERE s.status = 'pending' 
        LIMIT 1
      `;

            const userResult = await pool.query(userQuery);

            if (userResult.rows.length > 0) {
                const realUserId = userResult.rows[0].user_id;
                console.log(`  Testing with real user ID: ${realUserId}`);

                const realUserResponse = await makeRequest(client, {
                    hostname: config.host,
                    port: config.port,
                    path: `/api/swaps?userId=${realUserId}`,
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (realUserResponse.statusCode === 200) {
                    const realUserData = JSON.parse(realUserResponse.body);
                    console.log(`  Real user has ${realUserData.length || 0} swap cards`);
                } else {
                    console.log(`  Real user test failed: ${realUserResponse.statusCode}`);
                }
            }

            await pool.end();
        } catch (dbError) {
            console.log('  ⚠️  Could not connect to database for real user test');
        }

    } catch (error) {
        console.error('❌ API test failed:', error.message);
    }
}

function makeRequest(client, options) {
    return new Promise((resolve, reject) => {
        const req = client.request(options, (res) => {
            let body = '';

            res.on('data', (chunk) => {
                body += chunk;
            });

            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: body
                });
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

// Run the test
testApiProposerNames().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});