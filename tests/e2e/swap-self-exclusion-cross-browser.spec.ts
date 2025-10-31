import { test, expect, devices } from '@playwright/test';

/**
 * Cross-browser and device testing for swap self-exclusion fix
 * 
 * This test suite verifies that:
 * 1. Swap cards display correctly across different browsers (Chrome, Firefox, Safari)
 * 2. Responsive behavior works properly with multiple proposals on mobile and tablet
 * 3. User experience is consistent across all platforms
 * 4. Self-exclusion filtering works correctly on all devices and browsers
 * 
 * Requirements covered: 1.1, 2.3
 */

// Test configurations for different browsers and devices
const browserConfigs = [
    { name: 'Desktop Chrome', ...devices['Desktop Chrome'] },
    { name: 'Desktop Firefox', ...devices['Desktop Firefox'] },
    { name: 'Desktop Safari', ...devices['Desktop Safari'] },
    { name: 'Mobile Chrome', ...devices['Pixel 5'] },
    { name: 'Mobile Safari', ...devices['iPhone 12'] },
    { name: 'Tablet', ...devices['iPad Pro'] },
];

for (const config of browserConfigs) {
    test.describe(`Swap Self-Exclusion - ${config.name}`, () => {
        test.use({ ...config });

        test.beforeEach(async ({ page }) => {
            // Navigate to login page and authenticate
            await page.goto('/login');

            // Login as test user
            await page.fill('[data-testid="email-input"]', 'testuser@example.com');
            await page.fill('[data-testid="password-input"]', 'testpassword123');
            await page.click('[data-testid="login-button"]');

            // Wait for successful login and redirect to dashboard
            await page.waitForURL('/dashboard');
            await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
        });

        test(`should display swap cards correctly on ${config.name}`, async ({ page }) => {
            // Navigate to swaps page
            await page.goto('/swaps');
            await page.waitForLoadState('networkidle');

            // Wait for swap cards to load
            await expect(page.locator('[data-testid="swap-card"]').first()).toBeVisible({ timeout: 10000 });

            // Get viewport size to determine device type
            const viewport = page.viewportSize();
            const isMobile = viewport && viewport.width < 768;
            const isTablet = viewport && viewport.width >= 768 && viewport.width < 1024;

            // Verify swap cards are visible and properly structured
            const swapCards = page.locator('[data-testid="swap-card"]');
            const cardCount = await swapCards.count();
            expect(cardCount).toBeGreaterThan(0);

            // Test responsive layout for each card
            for (let i = 0; i < Math.min(cardCount, 3); i++) { // Test first 3 cards
                const card = swapCards.nth(i);

                // Verify card structure exists
                await expect(card.locator('[data-testid="user-swap-section"]')).toBeVisible();
                await expect(card.locator('[data-testid="proposals-section"]')).toBeVisible();

                // Check responsive layout
                if (isMobile) {
                    // On mobile, sections should stack vertically
                    const userSwapSection = card.locator('[data-testid="user-swap-section"]');
                    const proposalsSection = card.locator('[data-testid="proposals-section"]');

                    const userSwapBox = await userSwapSection.boundingBox();
                    const proposalsBox = await proposalsSection.boundingBox();

                    if (userSwapBox && proposalsBox) {
                        // Proposals section should be below user swap section on mobile
                        expect(proposalsBox.y).toBeGreaterThan(userSwapBox.y + userSwapBox.height - 50);
                    }
                } else {
                    // On desktop/tablet, sections should be side by side
                    const userSwapSection = card.locator('[data-testid="user-swap-section"]');
                    const proposalsSection = card.locator('[data-testid="proposals-section"]');

                    const userSwapBox = await userSwapSection.boundingBox();
                    const proposalsBox = await proposalsSection.boundingBox();

                    if (userSwapBox && proposalsBox) {
                        // Sections should be roughly at the same vertical level
                        expect(Math.abs(proposalsBox.y - userSwapBox.y)).toBeLessThan(100);
                    }
                }

                // Verify no self-proposals regardless of device
                const proposalCards = card.locator('[data-testid="proposals-section"] [data-testid="proposal-card"]');
                const proposalCount = await proposalCards.count();

                const userSwapTitle = await card.locator('[data-testid="user-swap-section"] [data-testid="booking-title"]').textContent();

                for (let j = 0; j < proposalCount; j++) {
                    const proposal = proposalCards.nth(j);
                    const proposalTitle = await proposal.locator('[data-testid="booking-title"]').textContent();
                    const proposerName = await proposal.locator('[data-testid="proposer-name"]').textContent();

                    // Ensure no self-proposals
                    expect(proposalTitle).not.toBe(userSwapTitle);
                    expect(proposerName).not.toBe('You');
                }
            }
        });

        test(`should handle multiple proposals responsively on ${config.name}`, async ({ page }) => {
            // Navigate to swaps page
            await page.goto('/swaps');
            await page.waitForLoadState('networkidle');

            // Wait for swap cards to load
            await expect(page.locator('[data-testid="swap-card"]').first()).toBeVisible({ timeout: 10000 });

            // Find a card with multiple proposals
            const swapCards = page.locator('[data-testid="swap-card"]');
            const cardCount = await swapCards.count();

            let multiProposalCard = null;
            let proposalCount = 0;

            for (let i = 0; i < cardCount; i++) {
                const card = swapCards.nth(i);
                const proposals = card.locator('[data-testid="proposals-section"] [data-testid="proposal-card"]');
                const count = await proposals.count();

                if (count > 1) {
                    multiProposalCard = card;
                    proposalCount = count;
                    break;
                }
            }

            if (multiProposalCard) {
                const viewport = page.viewportSize();
                const isMobile = viewport && viewport.width < 768;

                const proposalsSection = multiProposalCard.locator('[data-testid="proposals-section"]');
                const proposalCards = proposalsSection.locator('[data-testid="proposal-card"]');

                // Verify all proposals are visible
                for (let i = 0; i < proposalCount; i++) {
                    await expect(proposalCards.nth(i)).toBeVisible();
                }

                if (isMobile) {
                    // On mobile, proposals should stack vertically
                    for (let i = 0; i < proposalCount - 1; i++) {
                        const currentProposal = proposalCards.nth(i);
                        const nextProposal = proposalCards.nth(i + 1);

                        const currentBox = await currentProposal.boundingBox();
                        const nextBox = await nextProposal.boundingBox();

                        if (currentBox && nextBox) {
                            // Next proposal should be below current one
                            expect(nextBox.y).toBeGreaterThan(currentBox.y + currentBox.height - 20);
                        }
                    }
                } else {
                    // On desktop/tablet, check if proposals are arranged properly
                    // They might be in a grid or horizontal layout
                    const firstProposal = proposalCards.first();
                    const lastProposal = proposalCards.last();

                    await expect(firstProposal).toBeVisible();
                    await expect(lastProposal).toBeVisible();
                }

                // Verify proposal count indicator is visible and correct
                const countIndicator = proposalsSection.locator('[data-testid="proposal-count"]');
                if (await countIndicator.isVisible()) {
                    const countText = await countIndicator.textContent();
                    expect(countText).toContain(proposalCount.toString());
                }
            }
        });

        test(`should maintain touch targets and accessibility on ${config.name}`, async ({ page }) => {
            // Navigate to swaps page
            await page.goto('/swaps');
            await page.waitForLoadState('networkidle');

            // Wait for swap cards to load
            await expect(page.locator('[data-testid="swap-card"]').first()).toBeVisible({ timeout: 10000 });

            const viewport = page.viewportSize();
            const isTouchDevice = viewport && viewport.width < 1024; // Mobile or tablet

            if (isTouchDevice) {
                // Test touch targets on touch devices
                const swapCards = page.locator('[data-testid="swap-card"]');
                const firstCard = swapCards.first();

                // Find proposal cards with action buttons
                const proposalCards = firstCard.locator('[data-testid="proposals-section"] [data-testid="proposal-card"]');
                const proposalCount = await proposalCards.count();

                if (proposalCount > 0) {
                    const firstProposal = proposalCards.first();

                    // Check touch target sizes for buttons
                    const acceptButton = firstProposal.locator('[data-testid="accept-proposal-button"]');
                    const rejectButton = firstProposal.locator('[data-testid="reject-proposal-button"]');

                    if (await acceptButton.isVisible()) {
                        const acceptBox = await acceptButton.boundingBox();
                        if (acceptBox) {
                            // Touch targets should be at least 44px (iOS) or 48px (Android) in size
                            expect(acceptBox.height).toBeGreaterThanOrEqual(44);
                            expect(acceptBox.width).toBeGreaterThanOrEqual(44);
                        }
                    }

                    if (await rejectButton.isVisible()) {
                        const rejectBox = await rejectButton.boundingBox();
                        if (rejectBox) {
                            expect(rejectBox.height).toBeGreaterThanOrEqual(44);
                            expect(rejectBox.width).toBeGreaterThanOrEqual(44);
                        }
                    }
                }
            }

            // Test keyboard navigation (important for all devices)
            const firstCard = page.locator('[data-testid="swap-card"]').first();
            await firstCard.focus();

            // Verify card is focusable
            await expect(firstCard).toBeFocused();

            // Test tab navigation through proposals
            const proposalCards = firstCard.locator('[data-testid="proposals-section"] [data-testid="proposal-card"]');
            const proposalCount = await proposalCards.count();

            if (proposalCount > 0) {
                // Tab to first proposal action
                await page.keyboard.press('Tab');

                // Should focus on an interactive element within the proposals
                const focusedElement = page.locator(':focus');
                await expect(focusedElement).toBeVisible();
            }
        });

        test(`should handle scrolling and viewport changes on ${config.name}`, async ({ page }) => {
            // Navigate to swaps page
            await page.goto('/swaps');
            await page.waitForLoadState('networkidle');

            // Wait for swap cards to load
            await expect(page.locator('[data-testid="swap-card"]').first()).toBeVisible({ timeout: 10000 });

            const swapCards = page.locator('[data-testid="swap-card"]');
            const cardCount = await swapCards.count();

            if (cardCount > 1) {
                // Test scrolling to different cards
                const lastCard = swapCards.last();

                // Scroll to the last card
                await lastCard.scrollIntoViewIfNeeded();
                await expect(lastCard).toBeVisible();

                // Verify the card structure is still correct after scrolling
                await expect(lastCard.locator('[data-testid="user-swap-section"]')).toBeVisible();
                await expect(lastCard.locator('[data-testid="proposals-section"]')).toBeVisible();

                // Verify no self-proposals in the scrolled card
                const proposalCards = lastCard.locator('[data-testid="proposals-section"] [data-testid="proposal-card"]');
                const proposalCount = await proposalCards.count();

                const userSwapTitle = await lastCard.locator('[data-testid="user-swap-section"] [data-testid="booking-title"]').textContent();

                for (let i = 0; i < proposalCount; i++) {
                    const proposal = proposalCards.nth(i);
                    const proposalTitle = await proposal.locator('[data-testid="booking-title"]').textContent();
                    const proposerName = await proposal.locator('[data-testid="proposer-name"]').textContent();

                    expect(proposalTitle).not.toBe(userSwapTitle);
                    expect(proposerName).not.toBe('You');
                }
            }
        });

        test(`should handle orientation changes on ${config.name}`, async ({ page, browserName }) => {
            // Skip orientation test for desktop browsers
            const viewport = page.viewportSize();
            if (!viewport || viewport.width >= 1024) {
                test.skip();
                return;
            }

            // Navigate to swaps page
            await page.goto('/swaps');
            await page.waitForLoadState('networkidle');

            // Wait for swap cards to load
            await expect(page.locator('[data-testid="swap-card"]').first()).toBeVisible({ timeout: 10000 });

            // Test portrait orientation (default)
            let swapCards = page.locator('[data-testid="swap-card"]');
            let cardCount = await swapCards.count();
            expect(cardCount).toBeGreaterThan(0);

            // Capture initial layout
            const firstCard = swapCards.first();
            const userSwapSection = firstCard.locator('[data-testid="user-swap-section"]');
            const proposalsSection = firstCard.locator('[data-testid="proposals-section"]');

            const portraitUserBox = await userSwapSection.boundingBox();
            const portraitProposalsBox = await proposalsSection.boundingBox();

            // Change to landscape orientation
            await page.setViewportSize({ width: 812, height: 375 }); // iPhone landscape
            await page.waitForTimeout(500); // Wait for layout to adjust

            // Verify cards are still visible and functional
            swapCards = page.locator('[data-testid="swap-card"]');
            cardCount = await swapCards.count();
            expect(cardCount).toBeGreaterThan(0);

            // Check layout in landscape
            const landscapeUserBox = await userSwapSection.boundingBox();
            const landscapeProposalsBox = await proposalsSection.boundingBox();

            // Layout should adapt to landscape orientation
            if (landscapeUserBox && landscapeProposalsBox) {
                // In landscape, sections might be more side-by-side
                const horizontalDistance = Math.abs(landscapeProposalsBox.x - (landscapeUserBox.x + landscapeUserBox.width));
                const verticalDistance = Math.abs(landscapeProposalsBox.y - landscapeUserBox.y);

                // Either horizontally adjacent or vertically stacked, but layout should be reasonable
                expect(horizontalDistance < 100 || verticalDistance < landscapeUserBox.height).toBe(true);
            }

            // Verify no self-proposals in landscape mode
            const proposalCards = firstCard.locator('[data-testid="proposals-section"] [data-testid="proposal-card"]');
            const proposalCount = await proposalCards.count();

            const userSwapTitle = await firstCard.locator('[data-testid="user-swap-section"] [data-testid="booking-title"]').textContent();

            for (let i = 0; i < proposalCount; i++) {
                const proposal = proposalCards.nth(i);
                const proposalTitle = await proposal.locator('[data-testid="booking-title"]').textContent();
                const proposerName = await proposal.locator('[data-testid="proposer-name"]').textContent();

                expect(proposalTitle).not.toBe(userSwapTitle);
                expect(proposerName).not.toBe('You');
            }
        });

        test(`should maintain performance on ${config.name}`, async ({ page }) => {
            // Navigate to swaps page
            await page.goto('/swaps');

            // Measure page load performance
            const startTime = Date.now();
            await page.waitForLoadState('networkidle');
            await expect(page.locator('[data-testid="swap-card"]').first()).toBeVisible({ timeout: 10000 });
            const loadTime = Date.now() - startTime;

            // Page should load within reasonable time (adjust threshold as needed)
            expect(loadTime).toBeLessThan(10000); // 10 seconds max

            // Verify all cards are rendered efficiently
            const swapCards = page.locator('[data-testid="swap-card"]');
            const cardCount = await swapCards.count();

            if (cardCount > 0) {
                // Test scrolling performance with multiple cards
                const scrollStartTime = Date.now();

                for (let i = 0; i < Math.min(cardCount, 5); i++) {
                    const card = swapCards.nth(i);
                    await card.scrollIntoViewIfNeeded();
                    await expect(card).toBeVisible();
                }

                const scrollTime = Date.now() - scrollStartTime;

                // Scrolling should be smooth and fast
                expect(scrollTime).toBeLessThan(5000); // 5 seconds max for 5 cards
            }
        });

        test(`should handle network conditions on ${config.name}`, async ({ page }) => {
            // Simulate slow network
            await page.route('**/*', async route => {
                await new Promise(resolve => setTimeout(resolve, 100)); // Add 100ms delay
                await route.continue();
            });

            // Navigate to swaps page
            await page.goto('/swaps');
            await page.waitForLoadState('networkidle');

            // Wait for swap cards to load (with longer timeout due to slow network)
            await expect(page.locator('[data-testid="swap-card"]').first()).toBeVisible({ timeout: 15000 });

            // Verify functionality still works with slow network
            const swapCards = page.locator('[data-testid="swap-card"]');
            const cardCount = await swapCards.count();
            expect(cardCount).toBeGreaterThan(0);

            // Verify no self-proposals even with network delays
            const firstCard = swapCards.first();
            const proposalCards = firstCard.locator('[data-testid="proposals-section"] [data-testid="proposal-card"]');
            const proposalCount = await proposalCards.count();

            const userSwapTitle = await firstCard.locator('[data-testid="user-swap-section"] [data-testid="booking-title"]').textContent();

            for (let i = 0; i < proposalCount; i++) {
                const proposal = proposalCards.nth(i);
                const proposalTitle = await proposal.locator('[data-testid="booking-title"]').textContent();
                const proposerName = await proposal.locator('[data-testid="proposer-name"]').textContent();

                expect(proposalTitle).not.toBe(userSwapTitle);
                expect(proposerName).not.toBe('You');
            }

            // Remove network simulation
            await page.unroute('**/*');
        });
    });
}

// Additional test for browser-specific features
test.describe('Browser-Specific Features', () => {
    test('should work correctly in Chrome with DevTools', async ({ page, browserName }) => {
        test.skip(browserName !== 'chromium');

        // Enable DevTools
        const context = page.context();
        const cdp = await context.newCDPSession(page);

        // Navigate to swaps page
        await page.goto('/swaps');
        await page.waitForLoadState('networkidle');
        await expect(page.locator('[data-testid="swap-card"]').first()).toBeVisible({ timeout: 10000 });

        // Verify no console errors related to self-proposals
        const logs: string[] = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                logs.push(msg.text());
            }
        });

        // Interact with swap cards
        const swapCards = page.locator('[data-testid="swap-card"]');
        const firstCard = swapCards.first();
        await firstCard.click();

        // Wait a bit for any async operations
        await page.waitForTimeout(1000);

        // Check for self-proposal related errors
        const selfProposalErrors = logs.filter(log =>
            log.toLowerCase().includes('self') &&
            log.toLowerCase().includes('proposal')
        );

        expect(selfProposalErrors).toHaveLength(0);
    });

    test('should handle Safari-specific behaviors', async ({ page, browserName }) => {
        test.skip(browserName !== 'webkit');

        // Navigate to swaps page
        await page.goto('/swaps');
        await page.waitForLoadState('networkidle');
        await expect(page.locator('[data-testid="swap-card"]').first()).toBeVisible({ timeout: 10000 });

        // Test Safari-specific touch behaviors
        const firstCard = page.locator('[data-testid="swap-card"]').first();

        // Simulate touch events
        await firstCard.dispatchEvent('touchstart');
        await firstCard.dispatchEvent('touchend');

        // Verify card interaction works
        await expect(firstCard).toBeVisible();

        // Verify no self-proposals in Safari
        const proposalCards = firstCard.locator('[data-testid="proposals-section"] [data-testid="proposal-card"]');
        const proposalCount = await proposalCards.count();

        const userSwapTitle = await firstCard.locator('[data-testid="user-swap-section"] [data-testid="booking-title"]').textContent();

        for (let i = 0; i < proposalCount; i++) {
            const proposal = proposalCards.nth(i);
            const proposalTitle = await proposal.locator('[data-testid="booking-title"]').textContent();
            const proposerName = await proposal.locator('[data-testid="proposer-name"]').textContent();

            expect(proposalTitle).not.toBe(userSwapTitle);
            expect(proposerName).not.toBe('You');
        }
    });

    test('should handle Firefox-specific behaviors', async ({ page, browserName }) => {
        test.skip(browserName !== 'firefox');

        // Navigate to swaps page
        await page.goto('/swaps');
        await page.waitForLoadState('networkidle');
        await expect(page.locator('[data-testid="swap-card"]').first()).toBeVisible({ timeout: 10000 });

        // Test Firefox-specific keyboard navigation
        const firstCard = page.locator('[data-testid="swap-card"]').first();
        await firstCard.focus();

        // Test tab navigation
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');

        // Verify focus management works in Firefox
        const focusedElement = page.locator(':focus');
        await expect(focusedElement).toBeVisible();

        // Verify no self-proposals in Firefox
        const proposalCards = firstCard.locator('[data-testid="proposals-section"] [data-testid="proposal-card"]');
        const proposalCount = await proposalCards.count();

        const userSwapTitle = await firstCard.locator('[data-testid="user-swap-section"] [data-testid="booking-title"]').textContent();

        for (let i = 0; i < proposalCount; i++) {
            const proposal = proposalCards.nth(i);
            const proposalTitle = await proposal.locator('[data-testid="booking-title"]').textContent();
            const proposerName = await proposal.locator('[data-testid="proposer-name"]').textContent();

            expect(proposalTitle).not.toBe(userSwapTitle);
            expect(proposerName).not.toBe('You');
        }
    });
});