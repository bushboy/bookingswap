/**
 * Test script to verify the frontend service fix
 * Run this in the browser console to test the swapService
 */

// Test the swapService after the fix
async function testSwapServiceFix() {
    console.log('🧪 Testing SwapService Fix');

    // Get the user ID (you'll need to be logged in)
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = user.id;

    if (!userId) {
        console.log('❌ No user found. Please log in first.');
        return;
    }

    console.log(`Testing with user: ${user.email || userId}`);

    try {
        // Import the swapService (this assumes it's available globally)
        // In a real test, you'd import it properly
        const response = await fetch('/api/swaps', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        console.log('✅ API Response:', data);

        if (data.data?.swapCards) {
            data.data.swapCards.forEach((card, index) => {
                console.log(`Card ${index + 1}:`, {
                    swapId: card.userSwap?.id,
                    hasTargeting: !!card.targeting,
                    incomingCount: card.targeting?.incomingTargetCount || 0,
                    hasOutgoing: !!card.targeting?.outgoingTarget
                });
            });
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Make it available globally
window.testSwapServiceFix = testSwapServiceFix;

console.log('🔧 Service fix test loaded. Run testSwapServiceFix() to test.');