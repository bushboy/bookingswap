import { test, expect } from '@playwright/test';
import { MockServices } from '../fixtures/mock-services';
import { testBookings } from '../fixtures/test-data';

test.describe('Complete Swap Flow - End to End', () => {
  let mockServices: MockServices;

  test.beforeEach(async ({ page }) => {
    mockServices = new MockServices(page);
    await mockServices.setupAllMocks();
  });

  test('User can complete full booking swap journey', async ({ page }) => {
    // Step 1: User connects wallet and logs in
    await page.goto('/');

    // Connect wallet
    await page.click('[data-testid="connect-wallet-button"]');
    await expect(
      page.locator('[data-testid="wallet-connected"]')
    ).toBeVisible();

    // Verify user is logged in
    await expect(page.locator('[data-testid="user-profile"]')).toContainText(
      'Alice Johnson'
    );

    // Step 2: User lists a new booking for swap
    await page.click('[data-testid="list-booking-button"]');

    // Fill booking form
    await page.fill('[data-testid="booking-title"]', 'Test Hotel Booking');
    await page.selectOption('[data-testid="booking-type"]', 'hotel');
    await page.fill(
      '[data-testid="booking-description"]',
      'Beautiful hotel room in downtown'
    );
    await page.fill('[data-testid="booking-city"]', 'New York');
    await page.fill('[data-testid="booking-country"]', 'USA');
    await page.fill('[data-testid="check-in-date"]', '2024-12-20');
    await page.fill('[data-testid="check-out-date"]', '2024-12-25');
    await page.fill('[data-testid="original-price"]', '1500');
    await page.fill('[data-testid="swap-value"]', '1200');
    await page.fill('[data-testid="provider"]', 'Booking.com');
    await page.fill('[data-testid="confirmation-number"]', 'BK123456789');

    // Submit booking
    await page.click('[data-testid="submit-booking"]');

    // Verify booking was created
    await expect(page.locator('[data-testid="success-message"]')).toContainText(
      'Booking listed successfully'
    );
    await expect(
      page.locator('[data-testid="blockchain-confirmation"]')
    ).toBeVisible();

    // Step 3: User searches for available bookings
    await page.goto('/bookings');

    // Use search filters
    await page.fill('[data-testid="search-location"]', 'London');
    await page.selectOption('[data-testid="booking-type-filter"]', 'event');
    await page.click('[data-testid="search-button"]');

    // Verify search results
    await expect(page.locator('[data-testid="booking-card"]')).toHaveCount(1);
    await expect(
      page.locator('[data-testid="booking-card"]').first()
    ).toContainText('Concert Tickets');

    // Step 4: User proposes a swap
    await page.click('[data-testid="booking-card"]').first();
    await page.click('[data-testid="propose-swap-button"]');

    // Select own booking to offer
    await page.selectOption(
      '[data-testid="my-booking-select"]',
      testBookings.hotelBooking.id
    );
    await page.fill('[data-testid="additional-payment"]', '100');
    await page.fill('[data-testid="swap-conditions"]', 'Valid ID required');

    // Submit swap proposal
    await page.click('[data-testid="submit-swap-proposal"]');

    // Verify proposal was created
    await expect(
      page.locator('[data-testid="proposal-success"]')
    ).toContainText('Swap proposal sent');
    await expect(
      page.locator('[data-testid="blockchain-record"]')
    ).toBeVisible();

    // Step 5: Navigate to dashboard to check swap status
    await page.goto('/dashboard');

    // Verify pending swap appears
    await expect(page.locator('[data-testid="pending-swaps"]')).toContainText(
      '1 pending'
    );
    await expect(page.locator('[data-testid="swap-item"]')).toBeVisible();

    // Step 6: Simulate other user accepting the swap (switch context)
    // In a real test, this would involve a second browser context
    await page.goto('/dashboard');
    await page.click('[data-testid="received-proposals-tab"]');

    // Accept the swap proposal
    await page.click('[data-testid="swap-proposal-item"]').first();
    await page.click('[data-testid="accept-swap-button"]');

    // Confirm acceptance
    await page.click('[data-testid="confirm-acceptance"]');

    // Verify swap execution
    await expect(page.locator('[data-testid="swap-executing"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="blockchain-transaction"]')
    ).toBeVisible();

    // Wait for completion
    await page.waitForSelector('[data-testid="swap-completed"]', {
      timeout: 30000,
    });
    await expect(page.locator('[data-testid="swap-completed"]')).toContainText(
      'Swap completed successfully'
    );

    // Step 7: Verify final state
    await page.goto('/dashboard');

    // Check transaction history
    await page.click('[data-testid="transaction-history-tab"]');
    await expect(page.locator('[data-testid="completed-swap"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="blockchain-verification"]')
    ).toBeVisible();

    // Verify booking ownership changed
    await page.click('[data-testid="my-bookings-tab"]');
    await expect(page.locator('[data-testid="booking-item"]')).toContainText(
      'Concert Tickets'
    );
  });

  test('User can cancel swap proposal before acceptance', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="connect-wallet-button"]');

    // Navigate to dashboard with existing proposal
    await page.goto('/dashboard');
    await page.click('[data-testid="pending-swaps-tab"]');

    // Cancel a pending proposal
    await page.click('[data-testid="swap-proposal-item"]').first();
    await page.click('[data-testid="cancel-proposal-button"]');
    await page.click('[data-testid="confirm-cancellation"]');

    // Verify cancellation
    await expect(
      page.locator('[data-testid="cancellation-success"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="booking-unlocked"]')
    ).toContainText('Booking is now available');
  });

  test('User receives real-time notifications during swap process', async ({
    page,
  }) => {
    await page.goto('/');
    await page.click('[data-testid="connect-wallet-button"]');

    // Enable notifications
    await page.goto('/profile');
    await page.check('[data-testid="enable-notifications"]');
    await page.click('[data-testid="save-preferences"]');

    // Navigate back to dashboard
    await page.goto('/dashboard');

    // Simulate receiving a swap proposal (via WebSocket)
    await page.evaluate(() => {
      // @ts-ignore
      window.mockWebSocket.emit('swap-proposal-received', {
        swapId: 'swap-123',
        proposer: 'Bob Smith',
        booking: 'Concert Tickets - The Beatles Tribute',
      });
    });

    // Verify notification appears
    await expect(page.locator('[data-testid="notification-bell"]')).toHaveClass(
      /notification-active/
    );
    await page.click('[data-testid="notification-bell"]');
    await expect(
      page.locator('[data-testid="notification-item"]')
    ).toContainText('New swap proposal');

    // Click notification to navigate to proposal
    await page.click('[data-testid="notification-item"]').first();
    await expect(page.url()).toContain('/swaps/');
  });

  test('User can handle swap failures gracefully', async ({ page }) => {
    // Mock blockchain failure
    await page.route('**/api/blockchain/submit-transaction', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Blockchain network unavailable',
          code: 'NETWORK_ERROR',
          retryable: true,
        }),
      });
    });

    await page.goto('/');
    await page.click('[data-testid="connect-wallet-button"]');

    // Attempt to create booking
    await page.click('[data-testid="list-booking-button"]');
    // ... fill form ...
    await page.click('[data-testid="submit-booking"]');

    // Verify error handling
    await expect(page.locator('[data-testid="error-message"]')).toContainText(
      'Blockchain network unavailable'
    );
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();

    // Test retry functionality
    await page.click('[data-testid="retry-button"]');
    await expect(
      page.locator('[data-testid="retrying-message"]')
    ).toBeVisible();
  });
});
