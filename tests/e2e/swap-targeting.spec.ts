import { test, expect, Page } from '@playwright/test';

/**
 * End-to-End Tests for Swap Targeting Workflows
 * 
 * These tests cover the complete targeting process from browse to completion,
 * including auction mode and one-for-one targeting scenarios.
 */

// Test data setup
const testUsers = {
    alice: {
        email: 'alice.targeting@test.com',
        password: 'TestPass123!',
        name: 'Alice Targeting'
    },
    bob: {
        email: 'bob.targeting@test.com',
        password: 'TestPass123!',
        name: 'Bob Targeting'
    },
    charlie: {
        email: 'charlie.targeting@test.com',
        password: 'TestPass123!',
        name: 'Charlie Targeting'
    }
};

const testBookings = {
    alice: {
        title: 'Alice Beach House',
        location: 'Miami Beach',
        dates: '2025-07-01 to 2025-07-07',
        guests: 4
    },
    bob: {
        title: 'Bob Mountain Cabin',
        location: 'Aspen',
        dates: '2025-07-01 to 2025-07-07',
        guests: 4
    },
    charlie: {
        title: 'Charlie City Loft',
        location: 'New York',
        dates: '2025-07-01 to 2025-07-07',
        guests: 4
    }
};

test.describe('Swap Targeting End-to-End Workflows', () => {

    test.beforeEach(async ({ page }) => {
        // Setup test environment
        await page.goto('/');
        await setupTestData(page);
    });

    test.describe('Basic Targeting Workflow', () => {

        test('should complete full targeting workflow from browse to acceptance', async ({ page }) => {
            // Step 1: Alice creates a swap
            await loginUser(page, testUsers.alice);
            const aliceSwapId = await createSwap(page, testBookings.alice, 'one-for-one');
            await page.goto('/dashboard');

            // Step 2: Bob creates a swap  
            await loginUser(page, testUsers.bob);
            const bobSwapId = await createSwap(page, testBookings.bob, 'one-for-one');

            // Step 3: Bob browses and targets Alice's swap
            await page.goto('/browse');
            await page.waitForSelector('[data-testid="swap-browser"]');

            // Find Alice's swap and target it
            const aliceSwapCard = page.locator(`[data-testid="swap-card-${aliceSwapId}"]`);
            await expect(aliceSwapCard).toBeVisible();

            const targetButton = aliceSwapCard.locator('[data-testid="target-my-swap-btn"]');
            await expect(targetButton).toBeVisible();
            await expect(targetButton).toBeEnabled();

            await targetButton.click();

            // Confirm targeting in modal
            const confirmModal = page.locator('[data-testid="targeting-confirmation-modal"]');
            await expect(confirmModal).toBeVisible();

            await page.locator('[data-testid="confirm-targeting-btn"]').click();

            // Verify targeting success
            await expect(page.locator('[data-testid="targeting-success-message"]')).toBeVisible();

            // Step 4: Verify Bob's swap is now targeting Alice's swap
            await page.goto('/dashboard');
            const targetStatus = page.locator('[data-testid="current-target-status"]');
            await expect(targetStatus).toContainText('Targeting: Alice Beach House');

            // Step 5: Alice sees the proposal and accepts it
            await loginUser(page, testUsers.alice);
            await page.goto('/dashboard');

            const proposalNotification = page.locator('[data-testid="new-proposal-notification"]');
            await expect(proposalNotification).toBeVisible();
            await expect(proposalNotification).toContainText('Bob Mountain Cabin');

            await page.locator('[data-testid="view-proposal-btn"]').click();

            const proposalModal = page.locator('[data-testid="proposal-details-modal"]');
            await expect(proposalModal).toBeVisible();

            await page.locator('[data-testid="accept-proposal-btn"]').click();

            // Step 6: Verify both swaps are now matched
            await expect(page.locator('[data-testid="swap-matched-status"]')).toBeVisible();

            // Verify Bob also sees the match
            await loginUser(page, testUsers.bob);
            await page.goto('/dashboard');
            await expect(page.locator('[data-testid="swap-matched-status"]')).toBeVisible();
        });

        test('should handle targeting rejection and allow retargeting', async ({ page }) => {
            // Setup: Alice and Bob create swaps
            await loginUser(page, testUsers.alice);
            const aliceSwapId = await createSwap(page, testBookings.alice, 'one-for-one');

            await loginUser(page, testUsers.bob);
            const bobSwapId = await createSwap(page, testBookings.bob, 'one-for-one');

            // Bob targets Alice's swap
            await targetSwap(page, aliceSwapId);

            // Alice rejects the proposal
            await loginUser(page, testUsers.alice);
            await page.goto('/dashboard');
            await page.locator('[data-testid="view-proposal-btn"]').click();
            await page.locator('[data-testid="reject-proposal-btn"]').click();

            // Verify Bob can retarget to someone else
            await loginUser(page, testUsers.bob);
            await page.goto('/dashboard');

            const retargetButton = page.locator('[data-testid="retarget-swap-btn"]');
            await expect(retargetButton).toBeVisible();
            await expect(retargetButton).toBeEnabled();

            // Create Charlie's swap for retargeting
            await loginUser(page, testUsers.charlie);
            const charlieSwapId = await createSwap(page, testBookings.charlie, 'one-for-one');

            // Bob retargets to Charlie
            await loginUser(page, testUsers.bob);
            await page.goto('/browse');
            await targetSwap(page, charlieSwapId);

            // Verify retargeting worked
            await page.goto('/dashboard');
            const targetStatus = page.locator('[data-testid="current-target-status"]');
            await expect(targetStatus).toContainText('Targeting: Charlie City Loft');
        });
    });

    test.describe('Auction Mode Targeting', () => {

        test('should allow multiple users to target auction mode swap', async ({ page }) => {
            // Alice creates auction mode swap
            await loginUser(page, testUsers.alice);
            const aliceSwapId = await createSwap(page, testBookings.alice, 'auction', { duration: 24 });

            // Bob creates swap and targets Alice
            await loginUser(page, testUsers.bob);
            const bobSwapId = await createSwap(page, testBookings.bob, 'one-for-one');
            await targetSwap(page, aliceSwapId);

            // Charlie creates swap and also targets Alice (should be allowed in auction mode)
            await loginUser(page, testUsers.charlie);
            const charlieSwapId = await createSwap(page, testBookings.charlie, 'one-for-one');
            await targetSwap(page, aliceSwapId);

            // Verify Alice sees multiple proposals
            await loginUser(page, testUsers.alice);
            await page.goto('/dashboard');

            const proposalCount = page.locator('[data-testid="proposal-count"]');
            await expect(proposalCount).toContainText('2 proposals');

            const proposalsList = page.locator('[data-testid="proposals-list"]');
            await expect(proposalsList.locator('[data-testid="proposal-item"]')).toHaveCount(2);

            // Verify auction timer is visible
            const auctionTimer = page.locator('[data-testid="auction-timer"]');
            await expect(auctionTimer).toBeVisible();
            await expect(auctionTimer).toContainText('23h');
        });

        test('should prevent targeting after auction ends', async ({ page }) => {
            // Alice creates short auction (1 minute for testing)
            await loginUser(page, testUsers.alice);
            const aliceSwapId = await createSwap(page, testBookings.alice, 'auction', { duration: 0.02 }); // 1 minute

            // Wait for auction to end
            await page.waitForTimeout(70000); // Wait 70 seconds

            // Bob tries to target after auction ends
            await loginUser(page, testUsers.bob);
            const bobSwapId = await createSwap(page, testBookings.bob, 'one-for-one');

            await page.goto('/browse');
            const aliceSwapCard = page.locator(`[data-testid="swap-card-${aliceSwapId}"]`);

            const targetButton = aliceSwapCard.locator('[data-testid="target-my-swap-btn"]');
            await expect(targetButton).toBeDisabled();

            const auctionEndedMessage = aliceSwapCard.locator('[data-testid="auction-ended-message"]');
            await expect(auctionEndedMessage).toBeVisible();
            await expect(auctionEndedMessage).toContainText('Auction Ended');
        });
    });

    test.describe('One-for-One Targeting Restrictions', () => {

        test('should prevent multiple targeting of one-for-one swap', async ({ page }) => {
            // Alice creates one-for-one swap
            await loginUser(page, testUsers.alice);
            const aliceSwapId = await createSwap(page, testBookings.alice, 'one-for-one');

            // Bob targets Alice's swap
            await loginUser(page, testUsers.bob);
            const bobSwapId = await createSwap(page, testBookings.bob, 'one-for-one');
            await targetSwap(page, aliceSwapId);

            // Charlie tries to target the same swap (should be prevented)
            await loginUser(page, testUsers.charlie);
            const charlieSwapId = await createSwap(page, testBookings.charlie, 'one-for-one');

            await page.goto('/browse');
            const aliceSwapCard = page.locator(`[data-testid="swap-card-${aliceSwapId}"]`);

            const targetButton = aliceSwapCard.locator('[data-testid="target-my-swap-btn"]');
            await expect(targetButton).toBeDisabled();

            const pendingMessage = aliceSwapCard.locator('[data-testid="proposal-pending-message"]');
            await expect(pendingMessage).toBeVisible();
            await expect(pendingMessage).toContainText('Proposal Pending - Cannot Target');
        });

        test('should allow targeting after proposal is rejected', async ({ page }) => {
            // Setup: Alice creates swap, Bob targets it
            await loginUser(page, testUsers.alice);
            const aliceSwapId = await createSwap(page, testBookings.alice, 'one-for-one');

            await loginUser(page, testUsers.bob);
            const bobSwapId = await createSwap(page, testBookings.bob, 'one-for-one');
            await targetSwap(page, aliceSwapId);

            // Alice rejects Bob's proposal
            await loginUser(page, testUsers.alice);
            await page.goto('/dashboard');
            await page.locator('[data-testid="view-proposal-btn"]').click();
            await page.locator('[data-testid="reject-proposal-btn"]').click();

            // Charlie should now be able to target Alice's swap
            await loginUser(page, testUsers.charlie);
            const charlieSwapId = await createSwap(page, testBookings.charlie, 'one-for-one');

            await page.goto('/browse');
            const aliceSwapCard = page.locator(`[data-testid="swap-card-${aliceSwapId}"]`);

            const targetButton = aliceSwapCard.locator('[data-testid="target-my-swap-btn"]');
            await expect(targetButton).toBeEnabled();

            await targetButton.click();
            await page.locator('[data-testid="confirm-targeting-btn"]').click();

            await expect(page.locator('[data-testid="targeting-success-message"]')).toBeVisible();
        });
    });

    test.describe('Concurrent Targeting Scenarios', () => {

        test('should handle concurrent targeting attempts gracefully', async ({ browser }) => {
            // Create multiple browser contexts for concurrent users
            const context1 = await browser.newContext();
            const context2 = await browser.newContext();
            const page1 = await context1.newPage();
            const page2 = await context2.newPage();

            // Alice creates a one-for-one swap
            await page1.goto('/');
            await loginUser(page1, testUsers.alice);
            const aliceSwapId = await createSwap(page1, testBookings.alice, 'one-for-one');

            // Bob and Charlie both create swaps
            await page1.goto('/');
            await loginUser(page1, testUsers.bob);
            const bobSwapId = await createSwap(page1, testBookings.bob, 'one-for-one');

            await page2.goto('/');
            await loginUser(page2, testUsers.charlie);
            const charlieSwapId = await createSwap(page2, testBookings.charlie, 'one-for-one');

            // Both try to target Alice's swap simultaneously
            await Promise.all([
                page1.goto('/browse'),
                page2.goto('/browse')
            ]);

            const [aliceCard1, aliceCard2] = await Promise.all([
                page1.locator(`[data-testid="swap-card-${aliceSwapId}"]`),
                page2.locator(`[data-testid="swap-card-${aliceSwapId}"]`)
            ]);

            // Click target buttons simultaneously
            await Promise.all([
                aliceCard1.locator('[data-testid="target-my-swap-btn"]').click(),
                aliceCard2.locator('[data-testid="target-my-swap-btn"]').click()
            ]);

            // Confirm targeting simultaneously
            await Promise.all([
                page1.locator('[data-testid="confirm-targeting-btn"]').click(),
                page2.locator('[data-testid="confirm-targeting-btn"]').click()
            ]);

            // One should succeed, one should fail gracefully
            const [result1, result2] = await Promise.all([
                page1.locator('[data-testid="targeting-result-message"]').textContent(),
                page2.locator('[data-testid="targeting-result-message"]').textContent()
            ]);

            const results = [result1, result2];
            expect(results).toContain('Targeting successful');
            expect(results).toContain('Swap is no longer available for targeting');

            await context1.close();
            await context2.close();
        });
    });

    test.describe('Error Recovery and Rollback', () => {

        test('should recover from network failures during targeting', async ({ page }) => {
            await loginUser(page, testUsers.alice);
            const aliceSwapId = await createSwap(page, testBookings.alice, 'one-for-one');

            await loginUser(page, testUsers.bob);
            const bobSwapId = await createSwap(page, testBookings.bob, 'one-for-one');

            // Simulate network failure during targeting
            await page.route('**/api/swaps/*/target', route => {
                route.abort('failed');
            });

            await page.goto('/browse');
            const aliceSwapCard = page.locator(`[data-testid="swap-card-${aliceSwapId}"]`);
            await aliceSwapCard.locator('[data-testid="target-my-swap-btn"]').click();
            await page.locator('[data-testid="confirm-targeting-btn"]').click();

            // Should show error message
            await expect(page.locator('[data-testid="targeting-error-message"]')).toBeVisible();
            await expect(page.locator('[data-testid="targeting-error-message"]')).toContainText('Network error');

            // Should show retry button
            const retryButton = page.locator('[data-testid="retry-targeting-btn"]');
            await expect(retryButton).toBeVisible();

            // Remove network failure and retry
            await page.unroute('**/api/swaps/*/target');
            await retryButton.click();

            // Should succeed on retry
            await expect(page.locator('[data-testid="targeting-success-message"]')).toBeVisible();
        });

        test('should rollback partial targeting on database errors', async ({ page }) => {
            await loginUser(page, testUsers.alice);
            const aliceSwapId = await createSwap(page, testBookings.alice, 'one-for-one');

            await loginUser(page, testUsers.bob);
            const bobSwapId = await createSwap(page, testBookings.bob, 'one-for-one');

            // Simulate database error during targeting
            await page.route('**/api/swaps/*/target', route => {
                route.fulfill({
                    status: 500,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'Database transaction failed' })
                });
            });

            await page.goto('/browse');
            const aliceSwapCard = page.locator(`[data-testid="swap-card-${aliceSwapId}"]`);
            await aliceSwapCard.locator('[data-testid="target-my-swap-btn"]').click();
            await page.locator('[data-testid="confirm-targeting-btn"]').click();

            // Should show database error
            await expect(page.locator('[data-testid="targeting-error-message"]')).toContainText('Database error');

            // Verify Bob's swap is not in targeting state
            await page.goto('/dashboard');
            const targetStatus = page.locator('[data-testid="current-target-status"]');
            await expect(targetStatus).toContainText('No active target');

            // Verify Alice's swap is still available
            await page.unroute('**/api/swaps/*/target');
            await page.goto('/browse');
            const aliceSwapCardRetry = page.locator(`[data-testid="swap-card-${aliceSwapId}"]`);
            const targetButtonRetry = aliceSwapCardRetry.locator('[data-testid="target-my-swap-btn"]');
            await expect(targetButtonRetry).toBeEnabled();
        });
    });
});

// Helper functions
async function setupTestData(page: Page) {
    // Setup test users and clean state
    await page.evaluate(() => {
        // Clear any existing test data
        localStorage.clear();
        sessionStorage.clear();
    });
}

async function loginUser(page: Page, user: typeof testUsers.alice) {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', user.email);
    await page.fill('[data-testid="password-input"]', user.password);
    await page.click('[data-testid="login-btn"]');
    await page.waitForURL('/dashboard');
}

async function createSwap(page: Page, booking: typeof testBookings.alice, mode: 'one-for-one' | 'auction', options?: { duration?: number }) {
    await page.goto('/create-swap');

    await page.fill('[data-testid="booking-title-input"]', booking.title);
    await page.fill('[data-testid="booking-location-input"]', booking.location);
    await page.fill('[data-testid="booking-dates-input"]', booking.dates);
    await page.fill('[data-testid="booking-guests-input"]', booking.guests.toString());

    if (mode === 'auction') {
        await page.click('[data-testid="auction-mode-radio"]');
        if (options?.duration) {
            await page.fill('[data-testid="auction-duration-input"]', options.duration.toString());
        }
    } else {
        await page.click('[data-testid="one-for-one-mode-radio"]');
    }

    await page.click('[data-testid="create-swap-btn"]');
    await page.waitForURL('/dashboard');

    // Extract swap ID from the created swap
    const swapId = await page.locator('[data-testid="swap-id"]').textContent();
    return swapId;
}

async function targetSwap(page: Page, targetSwapId: string) {
    await page.goto('/browse');
    const targetSwapCard = page.locator(`[data-testid="swap-card-${targetSwapId}"]`);
    await targetSwapCard.locator('[data-testid="target-my-swap-btn"]').click();
    await page.locator('[data-testid="confirm-targeting-btn"]').click();
    await expect(page.locator('[data-testid="targeting-success-message"]')).toBeVisible();
}