import { test, expect, Page } from '@playwright/test';

/**
 * Edge Cases and Advanced Scenarios for Swap Targeting
 * 
 * Tests complex targeting scenarios, validation edge cases,
 * and system behavior under unusual conditions.
 */

test.describe('Swap Targeting Edge Cases', () => {

    test.describe('Circular Targeting Prevention', () => {

        test('should prevent direct circular targeting', async ({ page }) => {
            // Alice creates swap A
            await loginUser(page, 'alice@test.com');
            const swapA = await createSwap(page, 'Alice Beach House');

            // Bob creates swap B and targets A
            await loginUser(page, 'bob@test.com');
            const swapB = await createSwap(page, 'Bob Mountain Cabin');
            await targetSwap(page, swapA);

            // Alice tries to target Bob's swap (should be prevented)
            await loginUser(page, 'alice@test.com');
            await page.goto('/browse');

            const bobSwapCard = page.locator(`[data-testid="swap-card-${swapB}"]`);
            const targetButton = bobSwapCard.locator('[data-testid="target-my-swap-btn"]');

            await expect(targetButton).toBeDisabled();

            const circularWarning = bobSwapCard.locator('[data-testid="circular-targeting-warning"]');
            await expect(circularWarning).toBeVisible();
            await expect(circularWarning).toContainText('Cannot target - would create circular targeting');
        });

        test('should prevent indirect circular targeting (A->B->C->A)', async ({ page }) => {
            // Create chain: Alice -> Bob -> Charlie
            await loginUser(page, 'alice@test.com');
            const swapA = await createSwap(page, 'Alice Beach House');

            await loginUser(page, 'bob@test.com');
            const swapB = await createSwap(page, 'Bob Mountain Cabin');
            await targetSwap(page, swapA);

            await loginUser(page, 'charlie@test.com');
            const swapC = await createSwap(page, 'Charlie City Loft');
            await targetSwap(page, swapB);

            // Alice tries to target Charlie (would create A->C, but C->B->A exists)
            await loginUser(page, 'alice@test.com');
            await page.goto('/browse');

            const charlieSwapCard = page.locator(`[data-testid="swap-card-${swapC}"]`);
            const targetButton = charlieSwapCard.locator('[data-testid="target-my-swap-btn"]');

            await expect(targetButton).toBeDisabled();

            const circularWarning = charlieSwapCard.locator('[data-testid="circular-targeting-warning"]');
            await expect(circularWarning).toBeVisible();
        });
    });

    test.describe('Self-Targeting Prevention', () => {

        test('should prevent user from targeting their own swap', async ({ page }) => {
            await loginUser(page, 'alice@test.com');
            const swapA = await createSwap(page, 'Alice Beach House');

            // Alice creates second swap and tries to target her first swap
            const swapB = await createSwap(page, 'Alice City Apartment');

            await page.goto('/browse');
            const ownSwapCard = page.locator(`[data-testid="swap-card-${swapA}"]`);

            // Should not show target button for own swap
            const targetButton = ownSwapCard.locator('[data-testid="target-my-swap-btn"]');
            await expect(targetButton).not.toBeVisible();

            const ownSwapMessage = ownSwapCard.locator('[data-testid="own-swap-message"]');
            await expect(ownSwapMessage).toBeVisible();
            await expect(ownSwapMessage).toContainText('Your swap');
        });
    });

    test.describe('Swap State Validation', () => {

        test('should prevent targeting cancelled swaps', async ({ page }) => {
            await loginUser(page, 'alice@test.com');
            const swapA = await createSwap(page, 'Alice Beach House');

            // Alice cancels her swap
            await page.goto('/dashboard');
            await page.locator('[data-testid="cancel-swap-btn"]').click();
            await page.locator('[data-testid="confirm-cancel-btn"]').click();

            // Bob tries to target the cancelled swap
            await loginUser(page, 'bob@test.com');
            const swapB = await createSwap(page, 'Bob Mountain Cabin');

            await page.goto('/browse');

            // Cancelled swap should not appear in browse results
            const cancelledSwapCard = page.locator(`[data-testid="swap-card-${swapA}"]`);
            await expect(cancelledSwapCard).not.toBeVisible();
        });

        test('should prevent targeting already matched swaps', async ({ page }) => {
            // Alice and Bob create swaps and match
            await loginUser(page, 'alice@test.com');
            const swapA = await createSwap(page, 'Alice Beach House');

            await loginUser(page, 'bob@test.com');
            const swapB = await createSwap(page, 'Bob Mountain Cabin');
            await targetSwap(page, swapA);

            // Alice accepts Bob's proposal
            await loginUser(page, 'alice@test.com');
            await page.goto('/dashboard');
            await page.locator('[data-testid="accept-proposal-btn"]').click();

            // Charlie tries to target Alice's now-matched swap
            await loginUser(page, 'charlie@test.com');
            const swapC = await createSwap(page, 'Charlie City Loft');

            await page.goto('/browse');

            // Matched swap should not appear in browse results
            const matchedSwapCard = page.locator(`[data-testid="swap-card-${swapA}"]`);
            await expect(matchedSwapCard).not.toBeVisible();
        });

        test('should handle targeting when target swap becomes unavailable', async ({ page }) => {
            await loginUser(page, 'alice@test.com');
            const swapA = await createSwap(page, 'Alice Beach House');

            await loginUser(page, 'bob@test.com');
            const swapB = await createSwap(page, 'Bob Mountain Cabin');
            await targetSwap(page, swapA);

            // Alice deletes her swap while Bob is targeting it
            await loginUser(page, 'alice@test.com');
            await page.goto('/dashboard');
            await page.locator('[data-testid="delete-swap-btn"]').click();
            await page.locator('[data-testid="confirm-delete-btn"]').click();

            // Bob should be notified and his swap should revert to general availability
            await loginUser(page, 'bob@test.com');
            await page.goto('/dashboard');

            const targetUnavailableNotification = page.locator('[data-testid="target-unavailable-notification"]');
            await expect(targetUnavailableNotification).toBeVisible();
            await expect(targetUnavailableNotification).toContainText('Target swap is no longer available');

            const swapStatus = page.locator('[data-testid="swap-status"]');
            await expect(swapStatus).toContainText('Available for proposals');
        });
    });

    test.describe('Targeting History and Audit Trail', () => {

        test('should maintain complete targeting history', async ({ page }) => {
            await loginUser(page, 'alice@test.com');
            const swapA = await createSwap(page, 'Alice Beach House');

            await loginUser(page, 'bob@test.com');
            const swapB = await createSwap(page, 'Bob Mountain Cabin');

            // Bob targets Alice
            await targetSwap(page, swapA);

            // Bob retargets to Charlie
            await loginUser(page, 'charlie@test.com');
            const swapC = await createSwap(page, 'Charlie City Loft');

            await loginUser(page, 'bob@test.com');
            await page.goto('/dashboard');
            await page.locator('[data-testid="retarget-btn"]').click();
            await page.goto('/browse');
            await targetSwap(page, swapC);

            // Check targeting history
            await page.goto('/dashboard');
            await page.locator('[data-testid="view-targeting-history-btn"]').click();

            const historyModal = page.locator('[data-testid="targeting-history-modal"]');
            await expect(historyModal).toBeVisible();

            const historyEntries = historyModal.locator('[data-testid="history-entry"]');
            await expect(historyEntries).toHaveCount(3);

            // Verify history entries
            await expect(historyEntries.nth(0)).toContainText('Targeted Charlie City Loft');
            await expect(historyEntries.nth(1)).toContainText('Removed target from Alice Beach House');
            await expect(historyEntries.nth(2)).toContainText('Targeted Alice Beach House');

            // Verify timestamps are in correct order
            const timestamps = await historyEntries.locator('[data-testid="history-timestamp"]').allTextContents();
            expect(new Date(timestamps[0])).toBeGreaterThan(new Date(timestamps[1]));
            expect(new Date(timestamps[1])).toBeGreaterThan(new Date(timestamps[2]));
        });

        test('should show targeting activity from other users perspective', async ({ page }) => {
            await loginUser(page, 'alice@test.com');
            const swapA = await createSwap(page, 'Alice Beach House');

            // Multiple users target Alice's swap over time
            await loginUser(page, 'bob@test.com');
            const swapB = await createSwap(page, 'Bob Mountain Cabin');
            await targetSwap(page, swapA);

            // Bob rejects, Charlie targets
            await loginUser(page, 'alice@test.com');
            await page.goto('/dashboard');
            await page.locator('[data-testid="reject-proposal-btn"]').click();

            await loginUser(page, 'charlie@test.com');
            const swapC = await createSwap(page, 'Charlie City Loft');
            await targetSwap(page, swapA);

            // Alice views her targeting activity
            await loginUser(page, 'alice@test.com');
            await page.goto('/dashboard');
            await page.locator('[data-testid="view-targeting-activity-btn"]').click();

            const activityModal = page.locator('[data-testid="targeting-activity-modal"]');
            await expect(activityModal).toBeVisible();

            const activityEntries = activityModal.locator('[data-testid="activity-entry"]');
            await expect(activityEntries).toHaveCount(3);

            await expect(activityEntries.nth(0)).toContainText('Charlie targeted your swap');
            await expect(activityEntries.nth(1)).toContainText('You rejected Bob\'s proposal');
            await expect(activityEntries.nth(2)).toContainText('Bob targeted your swap');
        });
    });

    test.describe('Real-time Updates and Synchronization', () => {

        test('should update targeting status in real-time across sessions', async ({ browser }) => {
            const context1 = await browser.newContext();
            const context2 = await browser.newContext();
            const alicePage = await context1.newPage();
            const bobPage = await context2.newPage();

            // Alice creates swap and watches dashboard
            await alicePage.goto('/');
            await loginUser(alicePage, 'alice@test.com');
            const swapA = await createSwap(alicePage, 'Alice Beach House');
            await alicePage.goto('/dashboard');

            // Bob targets Alice's swap
            await bobPage.goto('/');
            await loginUser(bobPage, 'bob@test.com');
            const swapB = await createSwap(bobPage, 'Bob Mountain Cabin');
            await targetSwap(bobPage, swapA);

            // Alice should see real-time notification
            const realtimeNotification = alicePage.locator('[data-testid="realtime-targeting-notification"]');
            await expect(realtimeNotification).toBeVisible({ timeout: 5000 });
            await expect(realtimeNotification).toContainText('Bob Mountain Cabin is targeting your swap');

            // Proposal count should update in real-time
            const proposalCount = alicePage.locator('[data-testid="proposal-count"]');
            await expect(proposalCount).toContainText('1 new proposal');

            await context1.close();
            await context2.close();
        });

        test('should synchronize targeting state after network reconnection', async ({ page }) => {
            await loginUser(page, 'alice@test.com');
            const swapA = await createSwap(page, 'Alice Beach House');

            await loginUser(page, 'bob@test.com');
            const swapB = await createSwap(page, 'Bob Mountain Cabin');

            // Simulate network disconnection
            await page.context().setOffline(true);

            // Try to target while offline (should queue the action)
            await page.goto('/browse');
            const aliceSwapCard = page.locator(`[data-testid="swap-card-${swapA}"]`);
            await aliceSwapCard.locator('[data-testid="target-my-swap-btn"]').click();
            await page.locator('[data-testid="confirm-targeting-btn"]').click();

            // Should show offline message
            const offlineMessage = page.locator('[data-testid="offline-message"]');
            await expect(offlineMessage).toBeVisible();
            await expect(offlineMessage).toContainText('Action will be completed when connection is restored');

            // Reconnect network
            await page.context().setOffline(false);

            // Should automatically sync and complete the targeting
            const syncSuccessMessage = page.locator('[data-testid="sync-success-message"]');
            await expect(syncSuccessMessage).toBeVisible({ timeout: 10000 });

            // Verify targeting was completed
            await page.goto('/dashboard');
            const targetStatus = page.locator('[data-testid="current-target-status"]');
            await expect(targetStatus).toContainText('Targeting: Alice Beach House');
        });
    });

    test.describe('Performance and Stress Testing', () => {

        test('should handle rapid targeting/retargeting without issues', async ({ page }) => {
            // Create multiple target swaps
            const targetSwaps = [];
            for (let i = 0; i < 5; i++) {
                await loginUser(page, `user${i}@test.com`);
                const swapId = await createSwap(page, `Swap ${i}`);
                targetSwaps.push(swapId);
            }

            // Bob rapidly targets and retargets
            await loginUser(page, 'bob@test.com');
            const bobSwap = await createSwap(page, 'Bob Rapid Swap');

            // Rapidly cycle through targets
            for (const targetSwap of targetSwaps) {
                await page.goto('/browse');
                await targetSwap(page, targetSwap);

                // Verify targeting succeeded
                await page.goto('/dashboard');
                const targetStatus = page.locator('[data-testid="current-target-status"]');
                await expect(targetStatus).toContainText('Targeting:');

                // Small delay to simulate user behavior
                await page.waitForTimeout(100);
            }

            // Verify final state is consistent
            await page.goto('/dashboard');
            const finalStatus = page.locator('[data-testid="current-target-status"]');
            await expect(finalStatus).toContainText('Targeting: Swap 4');

            // Verify targeting history is complete
            await page.locator('[data-testid="view-targeting-history-btn"]').click();
            const historyEntries = page.locator('[data-testid="history-entry"]');
            await expect(historyEntries).toHaveCount(9); // 5 targets + 4 retargets
        });
    });
});

// Helper functions (reused from main test file)
async function loginUser(page: Page, email: string) {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', 'TestPass123!');
    await page.click('[data-testid="login-btn"]');
    await page.waitForURL('/dashboard');
}

async function createSwap(page: Page, title: string) {
    await page.goto('/create-swap');
    await page.fill('[data-testid="booking-title-input"]', title);
    await page.fill('[data-testid="booking-location-input"]', 'Test Location');
    await page.fill('[data-testid="booking-dates-input"]', '2025-07-01 to 2025-07-07');
    await page.fill('[data-testid="booking-guests-input"]', '4');
    await page.click('[data-testid="one-for-one-mode-radio"]');
    await page.click('[data-testid="create-swap-btn"]');
    await page.waitForURL('/dashboard');

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