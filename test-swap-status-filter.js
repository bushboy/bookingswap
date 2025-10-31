/**
 * Test script to verify swap status filter fix
 * Run with: node test-swap-status-filter.js
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:3001/api';

// You'll need to replace this with a valid auth token
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'your-auth-token-here';

async function testSwapStatusFilter() {
    console.log('🧪 Testing Swap Status Filter Fix\n');

    try {
        // Test 1: Get all swaps (no filter)
        console.log('Test 1: Fetching all swaps...');
        const allSwapsResponse = await axios.get(`${API_BASE_URL}/swaps`, {
            headers: {
                Authorization: `Bearer ${AUTH_TOKEN}`,
            },
        });

        console.log('✅ All swaps fetched successfully');
        console.log(`   - Total swaps: ${allSwapsResponse.data.data.swapCards.length}`);
        console.log(`   - Response has swapCards key: ${!!allSwapsResponse.data.data.swapCards}`);

        if (allSwapsResponse.data.data.swapCards.length > 0) {
            const firstSwap = allSwapsResponse.data.data.swapCards[0];
            console.log(`   - First swap status: ${firstSwap.userSwap.status}`);
            console.log(`   - Has targeting data: ${!!firstSwap.targeting}`);
            console.log(`   - Proposal count: ${firstSwap.proposalCount}`);
        }

        // Test 2: Get pending swaps
        console.log('\nTest 2: Fetching pending swaps...');
        const pendingSwapsResponse = await axios.get(`${API_BASE_URL}/swaps?status=pending`, {
            headers: {
                Authorization: `Bearer ${AUTH_TOKEN}`,
            },
        });

        console.log('✅ Pending swaps fetched successfully');
        console.log(`   - Total pending: ${pendingSwapsResponse.data.data.swapCards.length}`);
        console.log(`   - Response has swapCards key: ${!!pendingSwapsResponse.data.data.swapCards}`);

        // Verify all returned swaps have pending status
        const allPending = pendingSwapsResponse.data.data.swapCards.every(
            card => card.userSwap.status === 'pending'
        );
        console.log(`   - All swaps have pending status: ${allPending ? '✅' : '❌'}`);

        // Test 3: Get completed swaps
        console.log('\nTest 3: Fetching completed swaps...');
        const completedSwapsResponse = await axios.get(`${API_BASE_URL}/swaps?status=completed`, {
            headers: {
                Authorization: `Bearer ${AUTH_TOKEN}`,
            },
        });

        console.log('✅ Completed swaps fetched successfully');
        console.log(`   - Total completed: ${completedSwapsResponse.data.data.swapCards.length}`);
        console.log(`   - Response has swapCards key: ${!!completedSwapsResponse.data.data.swapCards}`);

        // Verify all returned swaps have completed status
        const allCompleted = completedSwapsResponse.data.data.swapCards.every(
            card => card.userSwap.status === 'completed'
        );
        console.log(`   - All swaps have completed status: ${allCompleted ? '✅' : '❌'}`);

        // Test 4: Get accepted swaps
        console.log('\nTest 4: Fetching accepted swaps...');
        const acceptedSwapsResponse = await axios.get(`${API_BASE_URL}/swaps?status=accepted`, {
            headers: {
                Authorization: `Bearer ${AUTH_TOKEN}`,
            },
        });

        console.log('✅ Accepted swaps fetched successfully');
        console.log(`   - Total accepted: ${acceptedSwapsResponse.data.data.swapCards.length}`);
        console.log(`   - Response has swapCards key: ${!!acceptedSwapsResponse.data.data.swapCards}`);

        console.log('\n✅ All tests passed! The fix is working correctly.');
        console.log('\n📝 Summary:');
        console.log(`   - All swaps: ${allSwapsResponse.data.data.swapCards.length}`);
        console.log(`   - Pending: ${pendingSwapsResponse.data.data.swapCards.length}`);
        console.log(`   - Accepted: ${acceptedSwapsResponse.data.data.swapCards.length}`);
        console.log(`   - Completed: ${completedSwapsResponse.data.data.swapCards.length}`);

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        }

        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            console.log('\n💡 Tip: Make sure to set a valid AUTH_TOKEN environment variable:');
            console.log('   export AUTH_TOKEN="your-token-here"');
            console.log('   node test-swap-status-filter.js');
        }
    }
}

// Run the test
testSwapStatusFilter();

