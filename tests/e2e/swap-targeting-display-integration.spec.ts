import { test, expect, Page } from '@playwright/test';

/**
 * End-to-End Tests for Swap Targeting Display Integration
 * 
 * These tests focus specifically on the targeting display integration features,
 * testing the complete workflow from targeting data retrieval to UI display
 * and user interactions with targeting information.
 */

// Test data setup
const testUsers = {
    alice: {
        email: 'alice.display@test.com',
        password: 'TestPass123!',
        name: 'Alice Display'
    },
    bob: {
        email: 'bob.display@test.com',
        password: 'TestPass123!',
        name: 'Bob Display'
    },
    charlie: {
        email: 'charlie.display@test.com',
        password: 'TestPass123!',
        name: 'Charlie Display'
    },
    diana: {
        email: 'diana.display@test.com',
        password: 'TestPass123!',
        name: 'Diana Display'
    }
};

const testBookings = {
    alice: {
        title: 'Alice Beachfront Villa',
        location: 'Malibu, CA',
        dates: '2025-08-01 to 2025-08-07',
        guests: 6,
        price: 2500
    },
    bob: {
        title: 'Bob Mountain Retreat',
        location: 'Aspen, CO',
        dates: '2025-08-01 to 2025-08-07',
        guests: 4,
        price: 1800
    },
    charlie: {
        title: 'Charlie Urban Loft',
        location: 'Manhattan, NY',
        dates: '2025-08-01 to 2025-08-07',
        guests: 2,
        price: 2200
    },
    diana: {
        title: 'Diana Lake House',
        location: 'Lake Tahoe, CA',
        dates: '2025-08-01 to 2025-08-07',
        guests: 8,
        price: 3000
    }
};

test.describe('Swap Targeting Display Integration', () => {

    test.beforeEach(async ({ page }) => {
        // Setup test environment and clean state
        await page.goto('/');
        await setupTestEnvironment(page);
    });

    test.describe('Enhanced Swap Card Display', () => {

        test('should display targeting indicators on swap cards', async ({ page }) => {
            // Setup: Alice creates auction mode swap
            await loginUser(page, testUsers.alice);
            const aliceSwapId = await createSwap(page, testBookings.alice, 'auction', { duration: 24 });

            // Bob and Charlie create swaps and target Alice
            await loginUser(page, testUsers.bob);
            const bobSwapId = await createSwap(page, testBookings.bob, 'one-for-one');
            await targetSwap(page, aliceSwapId);

            await loginUser(page, testUsers.charlie);
            const charlieSwapId = await createSwap(page, testBookings.charlie, 'one-for-one');
            await targetSwap(page, aliceSwapId);

            // Alice views her swaps - should see incoming targeting indicators
            await loginUser(page, testUsers.alice);
            await page.goto('/swaps');

            const aliceSwapCard = page.locator(`[data-testid="enhanced-swap-card-${aliceSwapId}"]`);
            await expect(aliceSwapCard).toBeVisible();

            // Verify incoming targeting indicator
            const incomingIndicator = aliceSwapCard.locator('[data-testid="incoming-targets-indicator"]');
            await expect(incomingIndicator).toBeVisible();
            await expect(incomingIndicator).toContainText('2 targeting proposals');

            // Verify targeting indicator styling for auction mode
            const auctionIndicator = aliceSwapCard.locator('[data-testid="auction-targeting-indicator"]');
            await expect(auctionIndicator).toBeVisible();
            await expect(auctionIndicator).toHaveClass(/auction-mode/);

            // Bob views his swaps - should see outgoing targeting indicator
            await loginUser(page, testUsers.bob);
            await page.goto('/swaps');

            const bobSwapCard = page.locator(`[data-testid="enhanced-swap-card-${bobSwapId}"]`);
            await expect(bobSwapCard).toBeVisible();

            const outgoingIndicator = bobSwapCard.locator('[data-testid="outgoing-target-indicator"]');
            await expect(outgoingIndicator).toBeVisible();
            await expect(outgoingIndicator).toContainText('Targeting: Alice Beachfront Villa');

            // Verify targeting status badge
            const statusBadge = bobSwapCard.locator('[data-testid="targeting-status-badge"]');
            await expect(statusBadge).toBeVisible();
            await expect(statusBadge).toHaveClass(/pending/);
        });

        test('should display detailed targeting information in expanded view', async ({ page }) => {
            // Setup targeting scenario
            await loginUser(page, testUsers.alice);
            const aliceSwapId = await createSwap(page, testBookings.alice, 'one-for-one');

            await loginUser(page, testUsers.bob);
            const bobSwapId = await createSwap(page, testBookings.bob, 'one-for-one');
            await targetSwap(page, aliceSwapId);

            // Alice views detailed targeting information
            await loginUser(page, testUsers.alice);
            await page.goto('/swaps');

            const aliceSwapCard = page.locator(`[data-testid="enhanced-swap-card-${aliceSwapId}"]`);

            // Expand targeting details
            const expandButton = aliceSwapCard.locator('[data-testid="expand-targeting-details"]');
            await expandButton.click();

            // Verify incoming targets display
            const incomingTargetsSection = aliceSwapCard.locator('[data-testid="incoming-targets-display"]');
            await expect(incomingTargetsSection).toBeVisible();

            // Check targeting proposal details
            const proposalCard = incomingTargetsSection.locator('[data-testid="targeting-proposal-card"]');
            await expect(proposalCard).toBeVisible();
            await expect(proposalCard).toContainText('Bob Mountain Retreat');
            await expect(proposalCard).toContainText('Aspen, CO');
            await expect(proposalCard).toContainText('$1,800');
            await expect(proposalCard).toContainText('Bob Display');

            // Verify proposal timestamp
            const proposalTimestamp = proposalCard.locator('[data-testid="proposal-timestamp"]');
            await expect(proposalTimestamp).toBeVisible();
            await expect(proposalTimestamp).toContainText(/\d+ minutes? ago/);

            // Verify action buttons
            const acceptButton = proposalCard.locator('[data-testid="accept-proposal-btn"]');
            const rejectButton = proposalCard.locator('[data-testid="reject-proposal-btn"]');
            await expect(acceptButton).toBeVisible();
            await expect(acceptButton).toBeEnabled();
            await expect(rejectButton).toBeVisible();
            await expect(rejectButton).toBeEnabled();
        });

        test('should show targeting capabilities and restrictions', async ({ page }) => {
            // Setup: Alice creates swap that's already being targeted
            await loginUser(page, testUsers.alice);
            const aliceSwapId = await createSwap(page, testBookings.alice, 'one-for-one');

            await loginUser(page, testUsers.bob);
            const bobSwapId = await createSwap(page, testBookings.bob, 'one-for-one');
            await targetSwap(page, aliceSwapId);

            // Charlie views Alice's swap - should see targeting restrictions
            await loginUser(page, testUsers.charlie);
            const charlieSwapId = await createSwap(page, testBookings.charlie, 'one-for-one');

            await page.goto('/browse');
            const aliceSwapCard = page.locator(`[data-testid="swap-card-${aliceSwapId}"]`);

            // Verify targeting restriction indicator
            const restrictionIndicator = aliceSwapCard.locator('[data-testid="targeting-restriction-indicator"]');
            await expect(restrictionIndicator).toBeVisible();
            await expect(restrictionIndicator).toContainText('Proposal Pending');

            // Verify target button is disabled
            const targetButton = aliceSwapCard.locator('[data-testid="target-my-swap-btn"]');
            await expect(targetButton).toBeDisabled();

            // Hover to see restriction tooltip
            await restrictionIndicator.hover();
            const tooltip = page.locator('[data-testid="restriction-tooltip"]');
            await expect(tooltip).toBeVisible();
            await expect(tooltip).toContainText('This swap already has a pending proposal');

            // Diana creates auction mode swap - should show different capabilities
            await loginUser(page, testUsers.diana);
            const dianaSwapId = await createSwap(page, testBookings.diana, 'auction', { duration: 48 });

            await loginUser(page, testUsers.charlie);
            await page.goto('/browse');

            const dianaSwapCard = page.locator(`[data-testid="swap-card-${dianaSwapId}"]`);
            const auctionCapability = dianaSwapCard.locator('[data-testid="auction-capability-indicator"]');
            await expect(auctionCapability).toBeVisible();
            await expect(auctionCapability).toContainText('Auction Mode - Multiple proposals accepted');
        });
    });

    test.describe('Real-time Targeting Updates', () => {

        test('should update targeting display in real-time when new proposals arrive', async ({ browser }) => {
            const context1 = await browser.newContext();
            const context2 = await browser.newContext();
            const alicePage = await context1.newPage();
            const bobPage = await context2.newPage();

            // Alice creates swap and watches her swaps page
            await alicePage.goto('/');
            await loginUser(alicePage, testUsers.alice);
            const aliceSwapId = await createSwap(alicePage, testBookings.alice, 'auction');
            await alicePage.goto('/swaps');

            // Verify initial state - no targeting proposals
            const aliceSwapCard = alicePage.locator(`[data-testid="enhanced-swap-card-${aliceSwapId}"]`);
            const incomingIndicator = aliceSwapCard.locator('[data-testid="incoming-targets-indicator"]');
            await expect(incomingIndicator).toContainText('0 targeting proposals');

            // Bob creates swap and targets Alice
            await bobPage.goto('/');
            await loginUser(bobPage, testUsers.bob);
            const bobSwapId = await createSwap(bobPage, testBookings.bob, 'one-for-one');
            await targetSwap(bobPage, aliceSwapId);

            // Alice should see real-time update
            await expect(incomingIndicator).toContainText('1 targeting proposal', { timeout: 5000 });

            // Verify real-time notification
            const realtimeNotification = alicePage.locator('[data-testid="realtime-targeting-notification"]');
            await expect(realtimeNotification).toBeVisible({ timeout: 3000 });
            await expect(realtimeNotification).toContainText('New targeting proposal from Bob Display');

            // Expand details to see the new proposal
            await aliceSwapCard.locator('[data-testid="expand-targeting-details"]').click();
            const proposalCard = aliceSwapCard.locator('[data-testid="targeting-proposal-card"]');
            await expect(proposalCard).toBeVisible();
            await expect(proposalCard).toContainText('Bob Mountain Retreat');

            await context1.close();
            await context2.close();
        });

        test('should update targeting status when proposals are accepted/rejected', async ({ browser }) => {
            const context1 = await browser.newContext();
            const context2 = await browser.newContext();
            const alicePage = await context1.newPage();
            const bobPage = await context2.newPage();

            // Setup targeting scenario
            await alicePage.goto('/');
            await loginUser(alicePage, testUsers.alice);
            const aliceSwapId = await createSwap(alicePage, testBookings.alice, 'one-for-one');

            await bobPage.goto('/');
            await loginUser(bobPage, testUsers.bob);
            const bobSwapId = await createSwap(bobPage, testBookings.bob, 'one-for-one');
            await targetSwap(bobPage, aliceSwapId);

            // Bob watches his swaps page
            await bobPage.goto('/swaps');
            const bobSwapCard = bobPage.locator(`[data-testid="enhanced-swap-card-${bobSwapId}"]`);
            const outgoingIndicator = bobSwapCard.locator('[data-testid="outgoing-target-indicator"]');
            await expect(outgoingIndicator).toContainText('Targeting: Alice Beachfront Villa');

            const statusBadge = bobSwapCard.locator('[data-testid="targeting-status-badge"]');
            await expect(statusBadge).toHaveClass(/pending/);

            // Alice accepts the proposal
            await alicePage.goto('/swaps');
            const aliceSwapCard = alicePage.locator(`[data-testid="enhanced-swap-card-${aliceSwapId}"]`);
            await aliceSwapCard.locator('[data-testid="expand-targeting-details"]').click();

            const proposalCard = aliceSwapCard.locator('[data-testid="targeting-proposal-card"]');
            await proposalCard.locator('[data-testid="accept-proposal-btn"]').click();

            // Confirm acceptance
            const confirmModal = alicePage.locator('[data-testid="accept-proposal-modal"]');
            await expect(confirmModal).toBeVisible();
            await confirmModal.locator('[data-testid="confirm-accept-btn"]').click();

            // Bob should see real-time status update
            await expect(statusBadge).toHaveClass(/accepted/, { timeout: 5000 });
            await expect(outgoingIndicator).toContainText('Matched with: Alice Beachfront Villa');

            // Verify success notification for Bob
            const successNotification = bobPage.locator('[data-testid="proposal-accepted-notification"]');
            await expect(successNotification).toBeVisible({ timeout: 3000 });
            await expect(successNotification).toContainText('Your proposal was accepted!');

            await context1.close();
            await context2.close();
        });

        test('should handle optimistic updates and rollback on failure', async ({ page }) => {
            await loginUser(page, testUsers.alice);
            const aliceSwapId = await createSwap(page, testBookings.alice, 'one-for-one');

            await loginUser(page, testUsers.bob);
            const bobSwapId = await createSwap(page, testBookings.bob, 'one-for-one');

            // Simulate network failure for targeting action
            await page.route('**/api/swaps/*/target', route => {
                route.abort('failed');
            });

            await page.goto('/browse');
            const aliceSwapCard = page.locator(`[data-testid="swap-card-${aliceSwapId}"]`);
            await aliceSwapCard.locator('[data-testid="target-my-swap-btn"]').click();
            await page.locator('[data-testid="confirm-targeting-btn"]').click();

            // Should show optimistic update initially
            await page.goto('/swaps');
            const bobSwapCard = page.locator(`[data-testid="enhanced-swap-card-${bobSwapId}"]`);
            const outgoingIndicator = bobSwapCard.locator('[data-testid="outgoing-target-indicator"]');

            // Optimistic update shows targeting
            await expect(outgoingIndicator).toContainText('Targeting: Alice Beachfront Villa');

            // Loading indicator should be visible
            const loadingIndicator = bobSwapCard.locator('[data-testid="targeting-loading-indicator"]');
            await expect(loadingIndicator).toBeVisible();

            // After failure, should rollback to original state
            await expect(outgoingIndicator).toContainText('No active target', { timeout: 5000 });
            await expect(loadingIndicator).not.toBeVisible();

            // Error notification should appear
            const errorNotification = page.locator('[data-testid="targeting-error-notification"]');
            await expect(errorNotification).toBeVisible();
            await expect(errorNotification).toContainText('Failed to target swap');

            // Retry button should be available
            const retryButton = errorNotification.locator('[data-testid="retry-targeting-btn"]');
            await expect(retryButton).toBeVisible();

            // Remove network failure and retry
            await page.unroute('**/api/swaps/*/target');
            await retryButton.click();

            // Should succeed on retry
            await expect(outgoingIndicator).toContainText('Targeting: Alice Beachfront Villa');
            await expect(errorNotification).not.toBeVisible();
        });
    });

    test.describe('Targeting Actions Integration', () => {

        test('should execute targeting actions from swap card interface', async ({ page }) => {
            await loginUser(page, testUsers.alice);
            const aliceSwapId = await createSwap(page, testBookings.alice, 'one-for-one');

            await loginUser(page, testUsers.bob);
            const bobSwapId = await createSwap(page, testBookings.bob, 'one-for-one');

            // Bob targets Alice from browse page
            await page.goto('/browse');
            const aliceSwapCard = page.locator(`[data-testid="swap-card-${aliceSwapId}"]`);

            // Use quick target action from card
            const quickTargetButton = aliceSwapCard.locator('[data-testid="quick-target-btn"]');
            await expect(quickTargetButton).toBeVisible();
            await quickTargetButton.click();

            // Verify targeting confirmation modal
            const confirmModal = page.locator('[data-testid="targeting-confirmation-modal"]');
            await expect(confirmModal).toBeVisible();

            // Check modal content
            await expect(confirmModal).toContainText('Target Alice Beachfront Villa');
            await expect(confirmModal).toContainText('Your swap: Bob Mountain Retreat');
            await expect(confirmModal).toContainText('Target swap: Alice Beachfront Villa');

            await confirmModal.locator('[data-testid="confirm-targeting-btn"]').click();

            // Verify success and navigation to swaps page
            await expect(page.locator('[data-testid="targeting-success-message"]')).toBeVisible();
            await page.waitForURL('/swaps');

            // Verify targeting is reflected in swap card
            const bobSwapCard = page.locator(`[data-testid="enhanced-swap-card-${bobSwapId}"]`);
            const outgoingIndicator = bobSwapCard.locator('[data-testid="outgoing-target-indicator"]');
            await expect(outgoingIndicator).toContainText('Targeting: Alice Beachfront Villa');
        });

        test('should handle retargeting workflow', async ({ page }) => {
            // Setup initial targeting
            await loginUser(page, testUsers.alice);
            const aliceSwapId = await createSwap(page, testBookings.alice, 'one-for-one');

            await loginUser(page, testUsers.bob);
            const bobSwapId = await createSwap(page, testBookings.bob, 'one-for-one');
            await targetSwap(page, aliceSwapId);

            // Create Charlie's swap for retargeting
            await loginUser(page, testUsers.charlie);
            const charlieSwapId = await createSwap(page, testBookings.charlie, 'one-for-one');

            // Bob initiates retargeting
            await loginUser(page, testUsers.bob);
            await page.goto('/swaps');

            const bobSwapCard = page.locator(`[data-testid="enhanced-swap-card-${bobSwapId}"]`);
            const retargetButton = bobSwapCard.locator('[data-testid="retarget-btn"]');
            await expect(retargetButton).toBeVisible();
            await retargetButton.click();

            // Should navigate to browse page with retargeting mode
            await page.waitForURL('/browse?mode=retarget');

            // Verify retargeting mode indicators
            const retargetingBanner = page.locator('[data-testid="retargeting-mode-banner"]');
            await expect(retargetingBanner).toBeVisible();
            await expect(retargetingBanner).toContainText('Retargeting from: Alice Beachfront Villa');

            // Select Charlie's swap for retargeting
            const charlieSwapCard = page.locator(`[data-testid="swap-card-${charlieSwapId}"]`);
            const retargetToButton = charlieSwapCard.locator('[data-testid="retarget-to-btn"]');
            await expect(retargetToButton).toBeVisible();
            await retargetToButton.click();

            // Confirm retargeting
            const retargetModal = page.locator('[data-testid="retargeting-confirmation-modal"]');
            await expect(retargetModal).toBeVisible();
            await expect(retargetModal).toContainText('Change target from Alice Beachfront Villa to Charlie Urban Loft');

            await retargetModal.locator('[data-testid="confirm-retarget-btn"]').click();

            // Verify retargeting success
            await expect(page.locator('[data-testid="retargeting-success-message"]')).toBeVisible();
            await page.waitForURL('/swaps');

            // Verify new targeting status
            const updatedBobCard = page.locator(`[data-testid="enhanced-swap-card-${bobSwapId}"]`);
            const updatedIndicator = updatedBobCard.locator('[data-testid="outgoing-target-indicator"]');
            await expect(updatedIndicator).toContainText('Targeting: Charlie Urban Loft');
        });

        test('should handle proposal acceptance workflow', async ({ page }) => {
            // Setup targeting scenario
            await loginUser(page, testUsers.alice);
            const aliceSwapId = await createSwap(page, testBookings.alice, 'one-for-one');

            await loginUser(page, testUsers.bob);
            const bobSwapId = await createSwap(page, testBookings.bob, 'one-for-one');
            await targetSwap(page, aliceSwapId);

            // Alice reviews and accepts proposal
            await loginUser(page, testUsers.alice);
            await page.goto('/swaps');

            const aliceSwapCard = page.locator(`[data-testid="enhanced-swap-card-${aliceSwapId}"]`);
            await aliceSwapCard.locator('[data-testid="expand-targeting-details"]').click();

            const proposalCard = aliceSwapCard.locator('[data-testid="targeting-proposal-card"]');

            // Review proposal details before accepting
            const reviewButton = proposalCard.locator('[data-testid="review-proposal-btn"]');
            await reviewButton.click();

            const reviewModal = page.locator('[data-testid="proposal-review-modal"]');
            await expect(reviewModal).toBeVisible();

            // Verify comprehensive proposal information
            await expect(reviewModal).toContainText('Bob Mountain Retreat');
            await expect(reviewModal).toContainText('Aspen, CO');
            await expect(reviewModal).toContainText('4 guests');
            await expect(reviewModal).toContainText('$1,800');

            // Check compatibility indicators
            const compatibilitySection = reviewModal.locator('[data-testid="compatibility-section"]');
            await expect(compatibilitySection).toBeVisible();
            await expect(compatibilitySection).toContainText('Date Match: ✓');
            await expect(compatibilitySection).toContainText('Guest Capacity: ✓');

            // Accept proposal from review modal
            const acceptFromReviewButton = reviewModal.locator('[data-testid="accept-from-review-btn"]');
            await acceptFromReviewButton.click();

            // Final confirmation
            const finalConfirmModal = page.locator('[data-testid="final-accept-confirmation"]');
            await expect(finalConfirmModal).toBeVisible();
            await expect(finalConfirmModal).toContainText('This will create a binding swap agreement');

            await finalConfirmModal.locator('[data-testid="final-confirm-accept-btn"]').click();

            // Verify acceptance success
            const successMessage = page.locator('[data-testid="proposal-accepted-success"]');
            await expect(successMessage).toBeVisible();
            await expect(successMessage).toContainText('Swap agreement created successfully');

            // Verify swap status update
            const swapStatus = aliceSwapCard.locator('[data-testid="swap-status-indicator"]');
            await expect(swapStatus).toContainText('Matched');
            await expect(swapStatus).toHaveClass(/matched/);

            // Verify targeting section is replaced with match information
            const matchInfo = aliceSwapCard.locator('[data-testid="match-information"]');
            await expect(matchInfo).toBeVisible();
            await expect(matchInfo).toContainText('Matched with: Bob Mountain Retreat');
        });
    });

    test.describe('Mobile Responsive Targeting Display', () => {

        test('should adapt targeting display for mobile screens', async ({ page }) => {
            // Set mobile viewport
            await page.setViewportSize({ width: 375, height: 667 });

            await loginUser(page, testUsers.alice);
            const aliceSwapId = await createSwap(page, testBookings.alice, 'auction');

            await loginUser(page, testUsers.bob);
            const bobSwapId = await createSwap(page, testBookings.bob, 'one-for-one');
            await targetSwap(page, aliceSwapId);

            // Alice views swaps on mobile
            await loginUser(page, testUsers.alice);
            await page.goto('/swaps');

            const aliceSwapCard = page.locator(`[data-testid="enhanced-swap-card-${aliceSwapId}"]`);

            // Verify mobile-specific targeting indicators
            const mobileTargetingIndicator = aliceSwapCard.locator('[data-testid="mobile-targeting-indicator"]');
            await expect(mobileTargetingIndicator).toBeVisible();
            await expect(mobileTargetingIndicator).toHaveClass(/mobile-compact/);

            // Verify collapsible targeting details
            const collapseToggle = aliceSwapCard.locator('[data-testid="mobile-targeting-toggle"]');
            await expect(collapseToggle).toBeVisible();
            await collapseToggle.click();

            const mobileTargetingDetails = aliceSwapCard.locator('[data-testid="mobile-targeting-details"]');
            await expect(mobileTargetingDetails).toBeVisible();

            // Verify mobile-friendly action buttons
            const mobileActionButtons = mobileTargetingDetails.locator('[data-testid="mobile-targeting-actions"]');
            await expect(mobileActionButtons).toBeVisible();

            const mobileAcceptButton = mobileActionButtons.locator('[data-testid="mobile-accept-btn"]');
            await expect(mobileAcceptButton).toBeVisible();
            await expect(mobileAcceptButton).toHaveClass(/touch-friendly/);

            // Test swipe gesture for proposal navigation (if multiple proposals)
            await loginUser(page, testUsers.charlie);
            const charlieSwapId = await createSwap(page, testUsers.charlie, 'one-for-one');
            await targetSwap(page, aliceSwapId);

            await loginUser(page, testUsers.alice);
            await page.goto('/swaps');

            const proposalCarousel = aliceSwapCard.locator('[data-testid="mobile-proposal-carousel"]');
            await expect(proposalCarousel).toBeVisible();

            // Simulate swipe gesture
            await proposalCarousel.hover();
            await page.mouse.down();
            await page.mouse.move(100, 0);
            await page.mouse.up();

            // Verify carousel moved to next proposal
            const activeProposal = proposalCarousel.locator('[data-testid="active-proposal"]');
            await expect(activeProposal).toContainText('Charlie Urban Loft');
        });

        test('should provide mobile-optimized targeting notifications', async ({ page }) => {
            // Set mobile viewport
            await page.setViewportSize({ width: 375, height: 667 });

            await loginUser(page, testUsers.alice);
            const aliceSwapId = await createSwap(page, testBookings.alice, 'one-for-one');
            await page.goto('/swaps');

            // Simulate mobile push notification for new targeting proposal
            await page.evaluate(() => {
                // Mock mobile notification
                (window as any).mockMobileNotification = {
                    title: 'New Targeting Proposal',
                    body: 'Bob Display wants to swap with your Alice Beachfront Villa',
                    data: { swapId: 'alice-swap-id', type: 'targeting_proposal' }
                };
            });

            // Bob targets Alice's swap
            await loginUser(page, testUsers.bob);
            const bobSwapId = await createSwap(page, testUsers.bob, 'one-for-one');
            await targetSwap(page, aliceSwapId);

            // Alice should receive mobile notification
            await loginUser(page, testUsers.alice);
            await page.goto('/swaps');

            const mobileNotificationBanner = page.locator('[data-testid="mobile-notification-banner"]');
            await expect(mobileNotificationBanner).toBeVisible({ timeout: 5000 });
            await expect(mobileNotificationBanner).toContainText('New targeting proposal from Bob Display');

            // Verify mobile notification actions
            const viewProposalButton = mobileNotificationBanner.locator('[data-testid="mobile-view-proposal-btn"]');
            const dismissButton = mobileNotificationBanner.locator('[data-testid="mobile-dismiss-btn"]');

            await expect(viewProposalButton).toBeVisible();
            await expect(dismissButton).toBeVisible();

            // Test notification tap action
            await viewProposalButton.click();

            // Should scroll to and highlight the relevant swap card
            const highlightedCard = page.locator(`[data-testid="enhanced-swap-card-${aliceSwapId}"]`);
            await expect(highlightedCard).toHaveClass(/highlighted/);

            // Targeting details should auto-expand on mobile
            const autoExpandedDetails = highlightedCard.locator('[data-testid="mobile-targeting-details"]');
            await expect(autoExpandedDetails).toBeVisible();
        });
    });

    test.describe('Targeting History Integration', () => {

        test('should display targeting history from swap cards', async ({ page }) => {
            // Create complex targeting history
            await loginUser(page, testUsers.alice);
            const aliceSwapId = await createSwap(page, testBookings.alice, 'one-for-one');

            await loginUser(page, testUsers.bob);
            const bobSwapId = await createSwap(page, testBookings.bob, 'one-for-one');
            await targetSwap(page, aliceSwapId);

            // Alice rejects Bob's proposal
            await loginUser(page, testUsers.alice);
            await page.goto('/swaps');
            const aliceSwapCard = page.locator(`[data-testid="enhanced-swap-card-${aliceSwapId}"]`);
            await aliceSwapCard.locator('[data-testid="expand-targeting-details"]').click();
            await aliceSwapCard.locator('[data-testid="reject-proposal-btn"]').click();

            // Charlie targets Alice
            await loginUser(page, testUsers.charlie);
            const charlieSwapId = await createSwap(page, testBookings.charlie, 'one-for-one');
            await targetSwap(page, aliceSwapId);

            // Alice accepts Charlie's proposal
            await loginUser(page, testUsers.alice);
            await page.goto('/swaps');
            await aliceSwapCard.locator('[data-testid="expand-targeting-details"]').click();
            await aliceSwapCard.locator('[data-testid="accept-proposal-btn"]').click();
            await page.locator('[data-testid="confirm-accept-btn"]').click();

            // View targeting history from swap card
            const historyButton = aliceSwapCard.locator('[data-testid="view-targeting-history-btn"]');
            await expect(historyButton).toBeVisible();
            await historyButton.click();

            const historyModal = page.locator('[data-testid="targeting-history-modal"]');
            await expect(historyModal).toBeVisible();

            // Verify complete history timeline
            const historyEntries = historyModal.locator('[data-testid="history-entry"]');
            await expect(historyEntries).toHaveCount(4);

            // Check chronological order (newest first)
            await expect(historyEntries.nth(0)).toContainText('Accepted proposal from Charlie Display');
            await expect(historyEntries.nth(1)).toContainText('Charlie Display targeted your swap');
            await expect(historyEntries.nth(2)).toContainText('Rejected proposal from Bob Display');
            await expect(historyEntries.nth(3)).toContainText('Bob Display targeted your swap');

            // Verify history entry details
            const firstEntry = historyEntries.nth(0);
            await expect(firstEntry).toContainText('Charlie Urban Loft');
            await expect(firstEntry).toContainText('Manhattan, NY');

            const entryTimestamp = firstEntry.locator('[data-testid="history-timestamp"]');
            await expect(entryTimestamp).toBeVisible();
            await expect(entryTimestamp).toContainText(/\d+ minutes? ago/);

            // Test history filtering
            const filterDropdown = historyModal.locator('[data-testid="history-filter-dropdown"]');
            await filterDropdown.click();
            await page.locator('[data-testid="filter-accepted-only"]').click();

            // Should show only accepted proposals
            await expect(historyEntries).toHaveCount(1);
            await expect(historyEntries.nth(0)).toContainText('Accepted proposal from Charlie Display');
        });

        test('should show targeting activity across multiple swaps', async ({ page }) => {
            // Alice creates multiple swaps
            await loginUser(page, testUsers.alice);
            const aliceSwap1 = await createSwap(page, testBookings.alice, 'one-for-one');
            const aliceSwap2 = await createSwap(page, { ...testBookings.alice, title: 'Alice City Apartment' }, 'auction');

            // Different users target different swaps
            await loginUser(page, testUsers.bob);
            const bobSwapId = await createSwap(page, testBookings.bob, 'one-for-one');
            await targetSwap(page, aliceSwap1);

            await loginUser(page, testUsers.charlie);
            const charlieSwapId = await createSwap(page, testBookings.charlie, 'one-for-one');
            await targetSwap(page, aliceSwap2);

            await loginUser(page, testUsers.diana);
            const dianaSwapId = await createSwap(page, testBookings.diana, 'one-for-one');
            await targetSwap(page, aliceSwap2); // Second proposal for auction mode

            // Alice views comprehensive targeting activity
            await loginUser(page, testUsers.alice);
            await page.goto('/swaps');

            const activityButton = page.locator('[data-testid="view-all-targeting-activity-btn"]');
            await expect(activityButton).toBeVisible();
            await activityButton.click();

            const activityModal = page.locator('[data-testid="targeting-activity-modal"]');
            await expect(activityModal).toBeVisible();

            // Verify activity across all swaps
            const activityEntries = activityModal.locator('[data-testid="activity-entry"]');
            await expect(activityEntries).toHaveCount(3);

            // Check activity grouping by swap
            const swap1Activities = activityModal.locator('[data-testid="swap-activity-group-1"]');
            const swap2Activities = activityModal.locator('[data-testid="swap-activity-group-2"]');

            await expect(swap1Activities).toContainText('Alice Beachfront Villa');
            await expect(swap1Activities).toContainText('1 targeting proposal');

            await expect(swap2Activities).toContainText('Alice City Apartment');
            await expect(swap2Activities).toContainText('2 targeting proposals');

            // Test activity timeline view
            const timelineToggle = activityModal.locator('[data-testid="timeline-view-toggle"]');
            await timelineToggle.click();

            const timelineView = activityModal.locator('[data-testid="activity-timeline"]');
            await expect(timelineView).toBeVisible();

            // Verify chronological timeline
            const timelineEntries = timelineView.locator('[data-testid="timeline-entry"]');
            await expect(timelineEntries).toHaveCount(3);

            // Most recent should be Diana's proposal
            await expect(timelineEntries.nth(0)).toContainText('Diana Display targeted Alice City Apartment');
        });
    });

    test.describe('Error Handling and Edge Cases', () => {

        test('should handle targeting data loading failures gracefully', async ({ page }) => {
            // Simulate targeting data API failure
            await page.route('**/api/swaps/*/targeting-data', route => {
                route.fulfill({
                    status: 500,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'Targeting data service unavailable' })
                });
            });

            await loginUser(page, testUsers.alice);
            const aliceSwapId = await createSwap(page, testBookings.alice, 'one-for-one');

            await page.goto('/swaps');

            const aliceSwapCard = page.locator(`[data-testid="enhanced-swap-card-${aliceSwapId}"]`);

            // Should show fallback to basic swap card
            const fallbackIndicator = aliceSwapCard.locator('[data-testid="targeting-data-unavailable"]');
            await expect(fallbackIndicator).toBeVisible();
            await expect(fallbackIndicator).toContainText('Targeting information temporarily unavailable');

            // Should still show basic swap information
            await expect(aliceSwapCard).toContainText('Alice Beachfront Villa');
            await expect(aliceSwapCard).toContainText('Malibu, CA');

            // Retry button should be available
            const retryButton = aliceSwapCard.locator('[data-testid="retry-targeting-data-btn"]');
            await expect(retryButton).toBeVisible();

            // Remove API failure and retry
            await page.unroute('**/api/swaps/*/targeting-data');
            await retryButton.click();

            // Should load targeting data successfully
            await expect(fallbackIndicator).not.toBeVisible();
            const targetingIndicator = aliceSwapCard.locator('[data-testid="incoming-targets-indicator"]');
            await expect(targetingIndicator).toBeVisible();
        });

        test('should handle partial targeting data gracefully', async ({ page }) => {
            // Simulate partial data response
            await page.route('**/api/swaps/*/targeting-data', route => {
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        incomingTargets: [
                            {
                                targetId: 'target-1',
                                sourceSwapId: 'bob-swap',
                                // Missing some fields to simulate partial data
                                status: 'active',
                                createdAt: new Date().toISOString()
                            }
                        ],
                        outgoingTarget: null,
                        warnings: ['Some targeting data may be incomplete']
                    })
                });
            });

            await loginUser(page, testUsers.alice);
            const aliceSwapId = await createSwap(page, testBookings.alice, 'one-for-one');

            await page.goto('/swaps');

            const aliceSwapCard = page.locator(`[data-testid="enhanced-swap-card-${aliceSwapId}"]`);

            // Should show available data with warning
            const partialDataWarning = aliceSwapCard.locator('[data-testid="partial-data-warning"]');
            await expect(partialDataWarning).toBeVisible();
            await expect(partialDataWarning).toContainText('Some targeting information may be incomplete');

            // Should still show what data is available
            const incomingIndicator = aliceSwapCard.locator('[data-testid="incoming-targets-indicator"]');
            await expect(incomingIndicator).toBeVisible();
            await expect(incomingIndicator).toContainText('1 targeting proposal');

            // Expand details to see partial information
            await aliceSwapCard.locator('[data-testid="expand-targeting-details"]').click();

            const proposalCard = aliceSwapCard.locator('[data-testid="targeting-proposal-card"]');
            await expect(proposalCard).toBeVisible();

            // Should show placeholder for missing data
            const missingDataPlaceholder = proposalCard.locator('[data-testid="missing-data-placeholder"]');
            await expect(missingDataPlaceholder).toBeVisible();
            await expect(missingDataPlaceholder).toContainText('Swap details loading...');
        });

        test('should handle concurrent targeting state changes', async ({ browser }) => {
            const context1 = await browser.newContext();
            const context2 = await browser.newContext();
            const context3 = await browser.newContext();

            const alicePage = await context1.newPage();
            const bobPage = await context2.newPage();
            const charliePage = await context3.newPage();

            // Setup: Alice creates one-for-one swap
            await alicePage.goto('/');
            await loginUser(alicePage, testUsers.alice);
            const aliceSwapId = await createSwap(alicePage, testBookings.alice, 'one-for-one');

            // Bob and Charlie both create swaps
            await bobPage.goto('/');
            await loginUser(bobPage, testUsers.bob);
            const bobSwapId = await createSwap(bobPage, testBookings.bob, 'one-for-one');

            await charliePage.goto('/');
            await loginUser(charliePage, testUsers.charlie);
            const charlieSwapId = await createSwap(charliePage, testBookings.charlie, 'one-for-one');

            // Both try to target Alice's swap simultaneously
            await Promise.all([
                bobPage.goto('/browse'),
                charliePage.goto('/browse')
            ]);

            const [bobAliceCard, charlieAliceCard] = await Promise.all([
                bobPage.locator(`[data-testid="swap-card-${aliceSwapId}"]`),
                charliePage.locator(`[data-testid="swap-card-${aliceSwapId}"]`)
            ]);

            // Click target buttons simultaneously
            await Promise.all([
                bobAliceCard.locator('[data-testid="target-my-swap-btn"]').click(),
                charlieAliceCard.locator('[data-testid="target-my-swap-btn"]').click()
            ]);

            // Confirm targeting simultaneously
            await Promise.all([
                bobPage.locator('[data-testid="confirm-targeting-btn"]').click(),
                charliePage.locator('[data-testid="confirm-targeting-btn"]').click()
            ]);

            // One should succeed, one should get conflict error
            const [bobResult, charlieResult] = await Promise.all([
                bobPage.locator('[data-testid="targeting-result-message"]').textContent(),
                charliePage.locator('[data-testid="targeting-result-message"]').textContent()
            ]);

            const results = [bobResult, charlieResult];
            expect(results.filter(r => r?.includes('successful'))).toHaveLength(1);
            expect(results.filter(r => r?.includes('no longer available') || r?.includes('conflict'))).toHaveLength(1);

            // Alice should see only one proposal
            await alicePage.goto('/swaps');
            const aliceSwapCard = alicePage.locator(`[data-testid="enhanced-swap-card-${aliceSwapId}"]`);
            const incomingIndicator = aliceSwapCard.locator('[data-testid="incoming-targets-indicator"]');
            await expect(incomingIndicator).toContainText('1 targeting proposal');

            await context1.close();
            await context2.close();
            await context3.close();
        });
    });
});

// Helper functions
async function setupTestEnvironment(page: Page) {
    // Clear any existing test data and setup clean state
    await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
    });

    // Setup test data in database if needed
    await page.route('**/api/test/setup', route => {
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true })
        });
    });
}

async function loginUser(page: Page, user: typeof testUsers.alice) {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', user.email);
    await page.fill('[data-testid="password-input"]', user.password);
    await page.click('[data-testid="login-btn"]');
    await page.waitForURL('/dashboard');
}

async function createSwap(
    page: Page,
    booking: typeof testBookings.alice,
    mode: 'one-for-one' | 'auction',
    options?: { duration?: number }
) {
    await page.goto('/create-swap');

    await page.fill('[data-testid="booking-title-input"]', booking.title);
    await page.fill('[data-testid="booking-location-input"]', booking.location);
    await page.fill('[data-testid="booking-dates-input"]', booking.dates);
    await page.fill('[data-testid="booking-guests-input"]', booking.guests.toString());
    await page.fill('[data-testid="booking-price-input"]', booking.price.toString());

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