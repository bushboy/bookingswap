/**
 * Check the exact API response details to see the targeting data structure
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

async function checkApiResponseDetails() {
    const pool = new Pool(dbConfig);

    try {
        console.log('🔍 Checking API Response Details\n');

        // Get user with targeting data
        const usersWithTargetingResult = await pool.query(`
            SELECT DISTINCT u.id, u.email, u.password_hash
            FROM users u
            LEFT JOIN swaps s ON u.id = s.owner_id
            LEFT JOIN swap_targets st2 ON s.id = st2.source_swap_id AND st2.status = 'active'
            WHERE st2.id IS NOT NULL
            LIMIT 1
        `);

        const testUser = usersWithTargetingResult.rows[0];
        console.log(`Testing with user: ${testUser.email}\n`);

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

        // Call API
        const response = await fetch('http://localhost:3001/api/swaps', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const responseData = await response.json();
        const swapCards = responseData.data?.swapCards || [];

        console.log('Full API Response Structure:');
        console.log(JSON.stringify(responseData, null, 2));

        console.log('\n=== DETAILED TARGETING ANALYSIS ===\n');

        swapCards.forEach((card, index) => {
            console.log(`Card ${index + 1}:`);
            console.log(`  userSwap.id: ${card.userSwap?.id}`);
            console.log(`  targeting exists: ${!!card.targeting}`);

            if (card.targeting) {
                console.log(`  targeting structure:`);
                console.log(`    incomingTargetCount: ${card.targeting.incomingTargetCount}`);
                console.log(`    incomingTargets: ${JSON.stringify(card.targeting.incomingTargets)}`);
                console.log(`    incomingTargets.length: ${card.targeting.incomingTargets?.length || 0}`);
                console.log(`    outgoingTarget: ${JSON.stringify(card.targeting.outgoingTarget)}`);
                console.log(`    outgoingTarget exists: ${!!card.targeting.outgoingTarget}`);
                console.log(`    canReceiveTargets: ${card.targeting.canReceiveTargets}`);
                console.log(`    canTarget: ${card.targeting.canTarget}`);

                // Test the frontend condition
                const incomingLength = card.targeting.incomingTargets?.length || 0;
                const hasOutgoing = !!card.targeting.outgoingTarget;
                const frontendCondition = incomingLength > 0 || hasOutgoing;

                console.log(`\n  Frontend condition test:`);
                console.log(`    incomingTargets.length > 0: ${incomingLength > 0} (${incomingLength})`);
                console.log(`    !!outgoingTarget: ${hasOutgoing}`);
                console.log(`    hasTargeting = ${incomingLength > 0} || ${hasOutgoing} = ${frontendCondition}`);

                if (frontendCondition) {
                    console.log(`    ✅ Should show targeting indicators`);
                } else {
                    console.log(`    ❌ Will NOT show targeting indicators`);
                }
            } else {
                console.log(`  ❌ No targeting data`);
            }
            console.log();
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

// Run the check
checkApiResponseDetails()
    .then(() => {
        console.log('\n✅ API response details check completed');
    })
    .catch((error) => {
        console.error('\n❌ Check failed:', error.message);
        process.exit(1);
    });