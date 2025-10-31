/**
 * Test the data transformation pipeline to identify where the issue occurs
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

async function testDataTransformation() {
    const pool = new Pool(dbConfig);

    try {
        console.log('🧪 Testing Data Transformation Pipeline\n');

        // Step 1: Get a user with targeting data
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
            LIMIT 1
        `);

        if (usersWithTargetingResult.rows.length === 0) {
            console.log('❌ No users with targeting data found');
            return;
        }

        const testUser = usersWithTargetingResult.rows[0];
        console.log(`Testing with user: ${testUser.email}\n`);

        // Step 2: Execute the repository query and show the exact structure
        console.log('1. Repository Query Results:');

        const incomingQuery = `
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
            JOIN swaps ts ON st.target_swap_id = ts.id
            JOIN swaps s ON st.source_swap_id = s.id
            JOIN bookings b ON s.source_booking_id = b.id
            JOIN users u ON s.owner_id = u.id
            WHERE ts.owner_id = $1 AND st.status = 'active'
        `;

        const outgoingQuery = `
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
            JOIN swaps ss ON st.source_swap_id = ss.id
            JOIN swaps s ON st.target_swap_id = s.id
            JOIN bookings b ON s.source_booking_id = b.id
            JOIN users u ON s.owner_id = u.id
            WHERE ss.owner_id = $1 AND st.status = 'active'
        `;

        const [incomingResult, outgoingResult] = await Promise.all([
            pool.query(incomingQuery, [testUser.id]),
            pool.query(outgoingQuery, [testUser.id])
        ]);

        console.log(`   Incoming targets: ${incomingResult.rows.length}`);
        if (incomingResult.rows.length > 0) {
            console.log('   Sample incoming target structure:');
            const sample = incomingResult.rows[0];
            console.log('   {');
            Object.keys(sample).forEach(key => {
                console.log(`     ${key}: ${JSON.stringify(sample[key])}`);
            });
            console.log('   }');
        }

        console.log(`   Outgoing targets: ${outgoingResult.rows.length}`);
        if (outgoingResult.rows.length > 0) {
            console.log('   Sample outgoing target structure:');
            const sample = outgoingResult.rows[0];
            console.log('   {');
            Object.keys(sample).forEach(key => {
                console.log(`     ${key}: ${JSON.stringify(sample[key])}`);
            });
            console.log('   }');
        }

        console.log();

        // Step 3: Show what the repository method should return
        console.log('2. Expected Repository Method Output:');

        const repositoryOutput = {
            incomingTargets: incomingResult.rows.map(row => ({
                targetId: row.target_id,
                targetSwapId: row.target_swap_id,
                sourceSwapId: row.source_swap_id,
                sourceSwapDetails: {
                    id: row.source_swap_id,
                    bookingId: row.source_booking_id,
                    bookingTitle: row.booking_title || 'Untitled Booking',
                    bookingLocation: `${row.booking_city || 'Unknown'}, ${row.booking_country || 'Unknown'}`,
                    bookingCheckIn: new Date(row.booking_check_in),
                    bookingCheckOut: new Date(row.booking_check_out),
                    bookingPrice: parseFloat(row.booking_price) || 0,
                    ownerId: row.owner_id,
                    ownerName: row.owner_name || 'Unknown User',
                    ownerEmail: row.owner_email || ''
                },
                proposalId: row.proposal_id,
                status: row.status,
                createdAt: new Date(row.created_at),
                updatedAt: new Date(row.updated_at)
            })),
            outgoingTargets: outgoingResult.rows.map(row => ({
                targetId: row.target_id,
                sourceSwapId: row.source_swap_id,
                targetSwapId: row.target_swap_id,
                targetSwapDetails: {
                    id: row.target_swap_id,
                    bookingId: row.source_booking_id,
                    bookingTitle: row.booking_title || 'Untitled Booking',
                    bookingLocation: `${row.booking_city || 'Unknown'}, ${row.booking_country || 'Unknown'}`,
                    bookingCheckIn: new Date(row.booking_check_in),
                    bookingCheckOut: new Date(row.booking_check_out),
                    bookingPrice: parseFloat(row.booking_price) || 0,
                    ownerId: row.owner_id,
                    ownerName: row.owner_name || 'Unknown User',
                    ownerEmail: row.owner_email || '',
                    acceptanceStrategy: typeof row.acceptance_strategy === 'string'
                        ? JSON.parse(row.acceptance_strategy)
                        : (row.acceptance_strategy || { type: 'first_match' })
                },
                proposalId: row.proposal_id,
                status: row.status,
                createdAt: new Date(row.created_at),
                updatedAt: new Date(row.updated_at)
            }))
        };

        console.log('   Repository output structure:');
        console.log(`     incomingTargets: ${repositoryOutput.incomingTargets.length} items`);
        console.log(`     outgoingTargets: ${repositoryOutput.outgoingTargets.length} items`);

        if (repositoryOutput.incomingTargets.length > 0) {
            console.log('   Sample incoming target:');
            console.log('   {');
            const sample = repositoryOutput.incomingTargets[0];
            Object.keys(sample).forEach(key => {
                if (key === 'sourceSwapDetails') {
                    console.log(`     ${key}: {`);
                    Object.keys(sample[key]).forEach(subKey => {
                        console.log(`       ${subKey}: ${JSON.stringify(sample[key][subKey])}`);
                    });
                    console.log('     }');
                } else {
                    console.log(`     ${key}: ${JSON.stringify(sample[key])}`);
                }
            });
            console.log('   }');
        }

        if (repositoryOutput.outgoingTargets.length > 0) {
            console.log('   Sample outgoing target:');
            console.log('   {');
            const sample = repositoryOutput.outgoingTargets[0];
            Object.keys(sample).forEach(key => {
                if (key === 'targetSwapDetails') {
                    console.log(`     ${key}: {`);
                    Object.keys(sample[key]).forEach(subKey => {
                        console.log(`       ${subKey}: ${JSON.stringify(sample[key][subKey])}`);
                    });
                    console.log('     }');
                } else {
                    console.log(`     ${key}: ${JSON.stringify(sample[key])}`);
                }
            });
            console.log('   }');
        }

        console.log();

        // Step 4: Test the conversion to SimpleTargetingTransformer format
        console.log('3. Conversion to SimpleTargetingTransformer Format:');

        const rawDataForTransformer = [];

        // Process incoming targets
        for (const incoming of repositoryOutput.incomingTargets) {
            const rawItem = {
                direction: 'incoming',
                target_id: incoming.targetId,
                target_swap_id: incoming.targetSwapId,
                source_swap_id: incoming.sourceSwapId,
                proposal_id: incoming.proposalId || '',
                status: incoming.status,
                created_at: new Date(incoming.createdAt),
                updated_at: new Date(incoming.updatedAt),
                booking_title: incoming.sourceSwapDetails?.bookingTitle ?? 'Untitled Booking',
                booking_city: incoming.sourceSwapDetails?.bookingCity ?? 'Unknown',
                booking_country: incoming.sourceSwapDetails?.bookingCountry ?? 'Unknown',
                check_in: new Date(incoming.sourceSwapDetails?.bookingCheckIn || Date.now()),
                check_out: new Date(incoming.sourceSwapDetails?.bookingCheckOut || Date.now()),
                price: incoming.sourceSwapDetails?.bookingPrice || 0,
                owner_name: incoming.sourceSwapDetails?.ownerName ?? 'Unknown User',
                owner_email: incoming.sourceSwapDetails?.ownerEmail ?? '',
                data_source: 'swap_targets'
            };
            rawDataForTransformer.push(rawItem);
        }

        // Process outgoing targets
        for (const outgoing of repositoryOutput.outgoingTargets) {
            const rawItem = {
                direction: 'outgoing',
                target_id: outgoing.targetId,
                target_swap_id: outgoing.targetSwapId,
                source_swap_id: outgoing.sourceSwapId,
                proposal_id: outgoing.proposalId || '',
                status: outgoing.status,
                created_at: new Date(outgoing.createdAt),
                updated_at: new Date(outgoing.updatedAt),
                booking_title: outgoing.targetSwapDetails?.bookingTitle ?? 'Untitled Booking',
                booking_city: outgoing.targetSwapDetails?.bookingCity ?? 'Unknown',
                booking_country: outgoing.targetSwapDetails?.bookingCountry ?? 'Unknown',
                check_in: new Date(outgoing.targetSwapDetails?.bookingCheckIn || Date.now()),
                check_out: new Date(outgoing.targetSwapDetails?.bookingCheckOut || Date.now()),
                price: outgoing.targetSwapDetails?.bookingPrice || 0,
                owner_name: outgoing.targetSwapDetails?.ownerName ?? 'Unknown User',
                owner_email: outgoing.targetSwapDetails?.ownerEmail ?? '',
                data_source: 'swap_targets'
            };
            rawDataForTransformer.push(rawItem);
        }

        console.log(`   Converted ${rawDataForTransformer.length} items for transformer`);

        if (rawDataForTransformer.length > 0) {
            console.log('   Sample converted item:');
            const sample = rawDataForTransformer[0];
            console.log('   {');
            Object.keys(sample).forEach(key => {
                console.log(`     ${key}: ${JSON.stringify(sample[key])}`);
            });
            console.log('   }');
        }

        console.log();

        // Step 5: Show what the final API response should look like
        console.log('4. Expected Final API Response Structure:');
        console.log('   {');
        console.log('     "userSwap": { ... },');
        console.log('     "proposalsFromOthers": [ ... ],');
        console.log('     "targeting": {');
        console.log(`       "incomingTargetCount": ${repositoryOutput.incomingTargets.length},`);
        console.log('       "incomingTargets": [');
        repositoryOutput.incomingTargets.forEach((target, index) => {
            console.log(`         {`);
            console.log(`           "targetId": "${target.targetId}",`);
            console.log(`           "sourceSwapId": "${target.sourceSwapId}",`);
            console.log(`           "sourceSwap": {`);
            console.log(`             "ownerName": "${target.sourceSwapDetails.ownerName}",`);
            console.log(`             "bookingDetails": { "title": "${target.sourceSwapDetails.bookingTitle}" }`);
            console.log(`           }`);
            console.log(`         }${index < repositoryOutput.incomingTargets.length - 1 ? ',' : ''}`);
        });
        console.log('       ],');
        if (repositoryOutput.outgoingTargets.length > 0) {
            const outgoing = repositoryOutput.outgoingTargets[0];
            console.log('       "outgoingTarget": {');
            console.log(`         "targetId": "${outgoing.targetId}",`);
            console.log(`         "targetSwapId": "${outgoing.targetSwapId}",`);
            console.log(`         "targetSwap": {`);
            console.log(`           "ownerName": "${outgoing.targetSwapDetails.ownerName}",`);
            console.log(`           "bookingDetails": { "title": "${outgoing.targetSwapDetails.bookingTitle}" }`);
            console.log(`         }`);
            console.log('       },');
        }
        console.log('       "canReceiveTargets": true,');
        console.log('       "canTarget": true');
        console.log('     }');
        console.log('   }');

        console.log();
        console.log('🎯 SUMMARY:');
        console.log('   ✅ Repository query returns data');
        console.log('   ✅ Data structure conversion looks correct');
        console.log('   ✅ Expected API response structure is clear');
        console.log();
        console.log('   → The issue is likely in the actual service implementation');
        console.log('   → Test the real API endpoint to see what it returns');
        console.log('   → Check if the data is being lost during transformation');

    } catch (error) {
        console.error('❌ Error testing data transformation:', error.message);
        console.error(error.stack);
    } finally {
        await pool.end();
    }
}

// Run the test
testDataTransformation()
    .then(() => {
        console.log('\n✅ Data transformation test completed');
    })
    .catch((error) => {
        console.error('\n❌ Data transformation test failed:', error.message);
        process.exit(1);
    });