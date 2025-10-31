import { test, expect, Page } from '@playwright/test';

/**
 * End-to-end tests for the swap self-exclusion fix
 * 
 * This test suite verifies that:
 * 1. Users never see their own swaps as proposals from themselves
 * 2. Swap cards display correctly with the user's swap on the left and only genuine proposals from others on the right
 * 3. The complete data flow from database to frontend works correctly
 * 4. Self-proposals are filtered out at all levels of the system
 * 
 * Requirements covered: 1.1, 1.2, 1.3, 2.1, 2.3
 */

test.describe('Swap Self-Exclusion Fix - End-to-End Tests', () => {
    let page: Page;

    test.beforeEach(async ({ page: testPage }) => {
        page = testPage;

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

    test('should display swap cards with user swap on left and only genuine proposals from others on right', async () => {
        // Navigate to swaps page
        await page.goto('/swaps');
        await page.waitForLoadState('networkidle');

        // Wait for swap cards to load
        await expect(page.locator('[data-testid="swap-card"]').first()).toBeVisible({ timeout: 10000 });

        // Get all swap cards
        const swapCards = page.locator('[data-testid="swap-card"]');
        const cardCount = await swapCards.count();

        expect(cardCount).toBeGreaterThan(0);

        // Test each swap card to ensure proper structure
        for (let i = 0; i < cardCount; i++) {
            const card = swapCards.nth(i);

            // Verify card has the expected structure
            await expect(card.locator('[data-testid="user-swap-section"]')).toBeVisible();
            await expect(card.locator('[data-testid="proposals-section"]')).toBeVisible();

            // Get user swap data from the left side
            const userSwapSection = card.locator('[data-testid="user-swap-section"]');
            const userSwapTitle = await userSwapSection.locator('[data-testid="booking-title"]').textContent();

            // Get proposals from the right side
            const proposalsSection = card.locator('[data-testid="proposals-section"]');
            const proposalCards = proposalsSection.locator('[data-testid="proposal-card"]');
            const proposalCount = await proposalCards.count();

            if (proposalCount > 0) {
                // Verify each proposal is from a different user (not self-proposal)
                for (let j = 0; j < proposalCount; j++) {
                    const proposal = proposalCards.nth(j);
                    const proposalTitle = await proposal.locator('[data-testid="booking-title"]').textContent();
                    const proposerName = await proposal.locator('[data-testid="proposer-name"]').textContent();

                    // Ensure the proposal is not the same as the user's swap
                    expect(proposalTitle).not.toBe(userSwapTitle);

                    // Ensure proposer is not the current user
                    expect(proposerName).not.toBe('You');
                    expect(proposerName).not.toContain('testuser@example.com');

                    // Verify proposal has valid data structure
                    await expect(proposal.locator('[data-testid="booking-title"]')).toBeVisible();
                    await expect(proposal.locator('[data-testid="booking-location"]')).toBeVisible();
                    await expect(proposal.locator('[data-testid="booking-dates"]')).toBeVisible();
                    await expect(proposal.locator('[data-testid="proposer-name"]')).toBeVisible();
                }
            } else {
                // If no proposals, verify the empty state message
                await expect(proposalsSection.locator('[data-testid="no-proposals-message"]')).toBeVisible();
                const emptyMessage = await proposalsSection.locator('[data-testid="no-proposals-message"]').textContent();
                expect(emptyMessage).toContain('No proposals yet');
            }
        }
    });

    test('should never display self-proposals in any scenario', async () => {
        // Navigate to swaps page
        await page.goto('/swaps');
        await page.waitForLoadState('networkidle');

        // Wait for swap cards to load
        await expect(page.locator('[data-testid="swap-card"]').first()).toBeVisible({ timeout: 10000 });

        // Get current user information
        const userMenu = page.locator('[data-testid="user-menu"]');
        await userMenu.click();
        const currentUserEmail = await page.locator('[data-testid="user-email"]').textContent();
        await userMenu.click(); // Close menu

        // Check all swap cards for self-proposals
        const swapCards = page.locator('[data-testid="swap-card"]');
        const cardCount = await swapCards.count();

        for (let i = 0; i < cardCount; i++) {
            const card = swapCards.nth(i);
            const proposalsSection = card.locator('[data-testid="proposals-section"]');
            const proposalCards = proposalsSection.locator('[data-testid="proposal-card"]');
            const proposalCount = await proposalCards.count();

            // Check each proposal to ensure it's not from the current user
            for (let j = 0; j < proposalCount; j++) {
                const proposal = proposalCards.nth(j);
                const proposerInfo = await proposal.locator('[data-testid="proposer-info"]').textContent();

                // Ensure no self-proposals exist
                expect(proposerInfo).not.toContain(currentUserEmail || '');
                expect(proposerInfo).not.toContain('You');
                expect(proposerInfo).not.toContain('(You)');
            }
        }
    });

    test('should handle multiple proposals per swap correctly', async () => {
        // Navigate to swaps page
        await page.goto('/swaps');
        await page.waitForLoadState('networkidle');

        // Wait for swap cards to load
        await expect(page.locator('[data-testid="swap-card"]').first()).toBeVisible({ timeout: 10000 });

        // Find a swap card with multiple proposals
        const swapCards = page.locator('[data-testid="swap-card"]');
        const cardCount = await swapCards.count();

        let multiProposalCard = null;
        let multiProposalCount = 0;

        for (let i = 0; i < cardCount; i++) {
            const card = swapCards.nth(i);
            const proposalCards = card.locator('[data-testid="proposals-section"] [data-testid="proposal-card"]');
            const proposalCount = await proposalCards.count();

            if (proposalCount > 1) {
                multiProposalCard = card;
                multiProposalCount = proposalCount;
                break;
            }
        }

        if (multiProposalCard) {
            // Verify multiple proposals are displayed correctly
            const proposalsSection = multiProposalCard.locator('[data-testid="proposals-section"]');

            // Check proposal count indicator
            const proposalCountIndicator = await proposalsSection.locator('[data-testid="proposal-count"]').textContent();
            expect(proposalCountIndicator).toContain(multiProposalCount.toString());

            // Verify each proposal is unique and from different users
            const proposalCards = proposalsSection.locator('[data-testid="proposal-card"]');
            const proposerNames = [];

            for (let i = 0; i < multiProposalCount; i++) {
                const proposal = proposalCards.nth(i);
                const proposerName = await proposal.locator('[data-testid="proposer-name"]').textContent();

                // Ensure no duplicate proposers (which could indicate self-proposals)
                expect(proposerNames).not.toContain(proposerName);
                proposerNames.push(proposerName);

                // Verify proposal structure
                await expect(proposal.locator('[data-testid="booking-title"]')).toBeVisible();
                await expect(proposal.locator('[data-testid="booking-location"]')).toBeVisible();
                await expect(proposal.locator('[data-testid="proposal-actions"]')).toBeVisible();
            }
        }
    });

    test('should display correct empty state when no valid proposals exist', async () => {
        // Navigate to swaps page
        await page.goto('/swaps');
        await page.waitForLoadState('networkidle');

        // Wait for swap cards to load
        await expect(page.locator('[data-testid="swap-card"]').first()).toBeVisible({ timeout: 10000 });

        // Find swap cards with no proposals
        const swapCards = page.locator('[data-testid="swap-card"]');
        const cardCount = await swapCards.count();

        let emptyProposalCard = null;

        for (let i = 0; i < cardCount; i++) {
            const card = swapCards.nth(i);
            const proposalCards = card.locator('[data-testid="proposals-section"] [data-testid="proposal-card"]');
            const proposalCount = await proposalCards.count();

            if (proposalCount === 0) {
                emptyProposalCard = card;
                break;
            }
        }

        if (emptyProposalCard) {
            const proposalsSection = emptyProposalCard.locator('[data-testid="proposals-section"]');

            // Verify empty state message is displayed
            await expect(proposalsSection.locator('[data-testid="no-proposals-message"]')).toBeVisible();

            const emptyMessage = await proposalsSection.locator('[data-testid="no-proposals-message"]').textContent();
            expect(emptyMessage).toMatch(/no proposals yet|no valid proposals/i);

            // Ensure no proposal cards are present
            const proposalCards = proposalsSection.locator('[data-testid="proposal-card"]');
            expect(await proposalCards.count()).toBe(0);
        }
    });

    test('should maintain data consistency across page refreshes', async () => {
        // Navigate to swaps page
        await page.goto('/swaps');
        await page.waitForLoadState('networkidle');

        // Wait for swap cards to load
        await expect(page.locator('[data-testid="swap-card"]').first()).toBeVisible({ timeout: 10000 });

        // Capture initial state
        const initialSwapCards = page.locator('[data-testid="swap-card"]');
        const initialCardCount = await initialSwapCards.count();

        const initialData = [];
        for (let i = 0; i < initialCardCount; i++) {
            const card = initialSwapCards.nth(i);
            const userSwapTitle = await card.locator('[data-testid="user-swap-section"] [data-testid="booking-title"]').textContent();
            const proposalCount = await card.locator('[data-testid="proposals-section"] [data-testid="proposal-card"]').count();

            initialData.push({
                userSwapTitle,
                proposalCount
            });
        }

        // Refresh the page
        await page.reload();
        await page.waitForLoadState('networkidle');
        await expect(page.locator('[data-testid="swap-card"]').first()).toBeVisible({ timeout: 10000 });

        // Verify data consistency after refresh
        const refreshedSwapCards = page.locator('[data-testid="swap-card"]');
        const refreshedCardCount = await refreshedSwapCards.count();

        expect(refreshedCardCount).toBe(initialCardCount);

        for (let i = 0; i < refreshedCardCount; i++) {
            const card = refreshedSwapCards.nth(i);
            const userSwapTitle = await card.locator('[data-testid="user-swap-section"] [data-testid="booking-title"]').textContent();
            const proposalCount = await card.locator('[data-testid="proposals-section"] [data-testid="proposal-card"]').count();

            // Find matching initial data
            const matchingInitialData = initialData.find(data => data.userSwapTitle === userSwapTitle);
            expect(matchingInitialData).toBeDefined();
            expect(proposalCount).toBe(matchingInitialData?.proposalCount);

            // Verify no self-proposals after refresh
            const proposalCards = card.locator('[data-testid="proposals-section"] [data-testid="proposal-card"]');
            for (let j = 0; j < proposalCount; j++) {
                const proposal = proposalCards.nth(j);
                const proposalTitle = await proposal.locator('[data-testid="booking-title"]').textContent();
                const proposerName = await proposal.locator('[data-testid="proposer-name"]').textContent();

                expect(proposalTitle).not.toBe(userSwapTitle);
                expect(proposerName).not.toBe('You');
            }
        }
    });

    test('should handle API errors gracefully without showing self-proposals', async () => {
        // Navigate to swaps page
        await page.goto('/swaps');

        // Intercept API calls and simulate error scenarios
        await page.route('**/api/swaps/user/**', async route => {
            // Simulate network error
            await route.abort('failed');
        });

        await page.reload();
        await page.waitForLoadState('networkidle');

        // Verify error state is handled gracefully
        const errorMessage = page.locator('[data-testid="error-message"]');
        if (await errorMessage.isVisible()) {
            const errorText = await errorMessage.textContent();
            expect(errorText).toMatch(/error|failed|unable to load/i);
        }

        // Ensure no swap cards are displayed in error state
        const swapCards = page.locator('[data-testid="swap-card"]');
        expect(await swapCards.count()).toBe(0);

        // Remove the route interception
        await page.unroute('**/api/swaps/user/**');
    });

    test('should verify proposal actions work correctly without self-proposals', async () => {
        // Navigate to swaps page
        await page.goto('/swaps');
        await page.waitForLoadState('networkidle');

        // Wait for swap cards to load
        await expect(page.locator('[data-testid="swap-card"]').first()).toBeVisible({ timeout: 10000 });

        // Find a swap card with proposals
        const swapCards = page.locator('[data-testid="swap-card"]');
        const cardCount = await swapCards.count();

        let cardWithProposals = null;

        for (let i = 0; i < cardCount; i++) {
            const card = swapCards.nth(i);
            const proposalCards = card.locator('[data-testid="proposals-section"] [data-testid="proposal-card"]');
            const proposalCount = await proposalCards.count();

            if (proposalCount > 0) {
                cardWithProposals = card;
                break;
            }
        }

        if (cardWithProposals) {
            const proposalsSection = cardWithProposals.locator('[data-testid="proposals-section"]');
            const firstProposal = proposalsSection.locator('[data-testid="proposal-card"]').first();

            // Verify proposal actions are available
            const acceptButton = firstProposal.locator('[data-testid="accept-proposal-button"]');
            const rejectButton = firstProposal.locator('[data-testid="reject-proposal-button"]');

            if (await acceptButton.isVisible()) {
                // Verify the proposal is not from the current user before testing actions
                const proposerName = await firstProposal.locator('[data-testid="proposer-name"]').textContent();
                expect(proposerName).not.toBe('You');

                // Test accept action (without actually accepting)
                await expect(acceptButton).toBeEnabled();
                await expect(rejectButton).toBeEnabled();

                // Click accept button to test interaction
                await acceptButton.click();

                // Verify confirmation dialog or action feedback
                const confirmDialog = page.locator('[data-testid="confirm-dialog"]');
                if (await confirmDialog.isVisible()) {
                    // Cancel the action to avoid actually accepting
                    await page.locator('[data-testid="cancel-button"]').click();
                }
            }
        }
    });

    test('should verify data integrity with database-level filtering', async () => {
        // Navigate to swaps page
        await page.goto('/swaps');
        await page.waitForLoadState('networkidle');

        // Intercept API calls to verify data structure
        let apiResponseData = null;

        await page.route('**/api/swaps/user/**', async route => {
            const response = await route.fetch();
            const data = await response.json();
            apiResponseData = data;
            await route.fulfill({ response });
        });

        // Reload to trigger API call
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Verify API response structure
        if (apiResponseData) {
            expect(apiResponseData.success).toBe(true);
            expect(Array.isArray(apiResponseData.data)).toBe(true);

            // Verify each swap card data structure
            for (const swapCardData of apiResponseData.data) {
                expect(swapCardData).toHaveProperty('userSwap');
                expect(swapCardData).toHaveProperty('proposalsFromOthers');
                expect(swapCardData).toHaveProperty('proposalCount');

                // Verify no self-proposals in the data
                const userSwapId = swapCardData.userSwap.id;
                const userSwapOwnerId = swapCardData.userSwap.ownerId;

                for (const proposal of swapCardData.proposalsFromOthers) {
                    // Ensure proposer is not the same as swap owner
                    expect(proposal.proposerId).not.toBe(userSwapOwnerId);

                    // Ensure proposal is not for the same booking
                    expect(proposal.targetBookingId).not.toBe(swapCardData.userSwap.bookingId);
                }
            }
        }

        await page.unroute('**/api/swaps/user/**');
    });
});