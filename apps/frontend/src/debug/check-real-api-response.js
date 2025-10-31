/**
 * Debug script to check what the real API is returning in the browser
 * Add this to the browser console to see the actual API response
 */

// Function to intercept and log API responses
function interceptSwapApiCalls() {
    // Store the original fetch function
    const originalFetch = window.fetch;

    // Override fetch to intercept API calls
    window.fetch = function (...args) {
        const [url, options] = args;

        // Check if this is a swaps API call
        if (url && url.includes('/api/swaps')) {
            console.log('🔍 Intercepted API call:', url);

            // Call the original fetch and log the response
            return originalFetch.apply(this, args)
                .then(response => {
                    // Clone the response so we can read it without consuming it
                    const responseClone = response.clone();

                    responseClone.json().then(data => {
                        console.log('📡 API Response for', url, ':', data);

                        // Check specifically for targeting data
                        if (data.data && data.data.swapCards) {
                            data.data.swapCards.forEach((card, index) => {
                                console.log(`🎯 Card ${index + 1} targeting analysis:`, {
                                    swapId: card.userSwap?.id,
                                    hasTargeting: !!card.targeting,
                                    targetingData: card.targeting,
                                    incomingCount: card.targeting?.incomingTargetCount || 0,
                                    hasOutgoing: !!card.targeting?.outgoingTarget,
                                    shouldShowIndicators: !!(card.targeting && (
                                        (card.targeting.incomingTargets && card.targeting.incomingTargets.length > 0) ||
                                        card.targeting.outgoingTarget
                                    ))
                                });
                            });
                        }
                    }).catch(err => {
                        console.log('❌ Error parsing API response:', err);
                    });

                    return response;
                })
                .catch(error => {
                    console.log('❌ API call failed:', error);
                    throw error;
                });
        }

        // For non-swaps API calls, just use the original fetch
        return originalFetch.apply(this, args);
    };

    console.log('✅ API interceptor installed. Refresh the page to see API calls.');
}

// Function to check current swap cards in the DOM
function checkSwapCardsInDOM() {
    console.log('🔍 Checking swap cards in DOM...');

    // Look for swap card elements
    const swapCards = document.querySelectorAll('[title*="Swap card"]');
    console.log(`Found ${swapCards.length} swap cards in DOM`);

    swapCards.forEach((card, index) => {
        console.log(`Card ${index + 1}:`);
        console.log('  Title:', card.getAttribute('title'));

        // Look for targeting indicators
        const outgoingIcon = card.querySelector('span:contains("📤")') ||
            Array.from(card.querySelectorAll('span')).find(span => span.textContent === '📤');
        const incomingIcon = card.querySelector('span:contains("📥")') ||
            Array.from(card.querySelectorAll('span')).find(span => span.textContent === '📥');
        const detailsLink = Array.from(card.querySelectorAll('div')).find(div =>
            div.textContent && div.textContent.includes('details')
        );

        console.log('  Targeting indicators found:', {
            outgoingIcon: !!outgoingIcon,
            incomingIcon: !!incomingIcon,
            detailsLink: !!detailsLink
        });

        // Log all text content to see what's actually there
        console.log('  All text content:', card.textContent);
    });
}

// Function to manually test the targeting logic
function testTargetingLogic() {
    console.log('🧪 Testing targeting logic...');

    // Example data structure from our API test
    const mockTargeting = {
        incomingTargets: [],
        incomingTargetCount: 0,
        outgoingTarget: {
            targetId: "808ad4bb-feaa-4b0c-9347-ca28a254d790",
            targetSwapId: "f63db0b1-8151-4cde-a623-4398c984958f",
            status: "active"
        },
        canReceiveTargets: true,
        canTarget: true
    };

    const hasTargeting = mockTargeting && (
        mockTargeting.incomingTargets.length > 0 ||
        mockTargeting.outgoingTarget
    );

    console.log('Targeting logic test:', {
        targeting: mockTargeting,
        incomingLength: mockTargeting.incomingTargets.length,
        hasOutgoing: !!mockTargeting.outgoingTarget,
        hasTargeting: hasTargeting,
        shouldShowIndicators: hasTargeting
    });
}

// Export functions to global scope for browser console use
window.interceptSwapApiCalls = interceptSwapApiCalls;
window.checkSwapCardsInDOM = checkSwapCardsInDOM;
window.testTargetingLogic = testTargetingLogic;

console.log('🐛 Targeting Debug Tools Loaded!');
console.log('Available functions:');
console.log('  - interceptSwapApiCalls() - Intercept and log API calls');
console.log('  - checkSwapCardsInDOM() - Check current swap cards in DOM');
console.log('  - testTargetingLogic() - Test targeting logic with mock data');
console.log('');
console.log('Usage:');
console.log('  1. Run interceptSwapApiCalls() first');
console.log('  2. Refresh the page to see API calls');
console.log('  3. Run checkSwapCardsInDOM() to inspect current cards');