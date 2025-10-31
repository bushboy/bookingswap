import { test, expect } from '@playwright/test';
import { MockServices } from '../fixtures/mock-services';

test.describe('Swap Operations User Journey', () => {
  let mockServices: MockServices;

  test.beforeEach(async ({ page }) => {
    mockServices = new MockServices(page);
    await mockServices.setupAllMocks();
    
    await page.goto('/');
    await page.click('[data-testid="connect-wallet-button"]');
    await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
  });

  test('User can create and manage swap proposals', async ({ page }) => {
    // Navigate to available bookings
    await page.goto('/bookings');
    
    // Select a booking to swap for
    await page.click('[data-testid="booking-card"]').first();
    await page.click('[data-testid="propose-swap-button"]');
    
    // Fill swap proposal form
    await page.selectOption('[data-testid="my-booking-select"]', 'booking-hotel-001');
    await page.fill('[data-testid="additional-payment"]', '150');
    await page.fill('[data-testid="swap-message"]', 'Would love to swap my Paris hotel for your London event tickets!');
    await page.check('[data-testid="agree-terms"]');
    
    // Set expiration
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    await page.fill('[data-testid="expiration-date"]', futureDate.toISOString().split('T')[0]);
    
    await page.click('[data-testid="submit-proposal"]');
    
    // Verify proposal creation
    await expect(page.locator('[data-testid="proposal-success"]')).toContainText('Swap proposal sent successfully');
    await expect(page.locator('[data-testid="blockchain-confirmation"]')).toBeVisible();
    
    // Navigate to dashboard to view proposal
    await page.goto('/dashboard');
    await page.click('[data-testid="sent-proposals-tab"]');
    
    // Verify proposal appears in sent list
    await expect(page.locator('[data-testid="proposal-item"]')).toBeVisible();
    await expect(page.locator('[data-testid="proposal-status"]')).toContainText('Pending');
    
    // View proposal details
    await page.click('[data-testid="proposal-item"]').first();
    await expect(page.locator('[data-testid="proposal-details"]')).toBeVisible();
    await expect(page.locator('[data-testid="source-booking"]')).toContainText('Paris hotel');
    await expect(page.locator('[data-testid="target-booking"]')).toContainText('London event');
    await expect(page.locator('[data-testid="additional-payment"]')).toContainText('$150');
  });

  test('User can respond to received swap proposals', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.click('[data-testid="received-proposals-tab"]');
    
    // Mock received proposal
    await page.route('**/api/swaps/received', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          swaps: [{
            id: 'swap-received-001',
            sourceBooking: {
              title: 'Concert Tickets - Rock Festival',
              location: { city: 'Austin', country: 'USA' },
              dateRange: { checkIn: '2024-12-18', checkOut: '2024-12-18' },
            },
            targetBooking: {
              title: 'Luxury Hotel Suite',
              location: { city: 'Paris', country: 'France' },
              dateRange: { checkIn: '2024-12-20', checkOut: '2024-12-25' },
            },
            proposer: { displayName: 'John Doe', reputation: { score: 4.7 } },
            terms: {
              additionalPayment: 200,
              conditions: ['Valid ID required'],
              expiresAt: '2024-12-31T23:59:59Z',
            },
            status: 'pending',
          }],
        }),
      });
    });
    
    await page.reload();
    
    // View received proposal
    await expect(page.locator('[data-testid="received-proposal-item"]')).toBeVisible();
    await page.click('[data-testid="received-proposal-item"]').first();
    
    // Review proposal details
    await expect(page.locator('[data-testid="proposer-info"]')).toContainText('John Doe');
    await expect(page.locator('[data-testid="proposer-rating"]')).toContainText('4.7');
    await expect(page.locator('[data-testid="swap-terms"]')).toContainText('$200');
    
    // Accept the proposal
    await page.click('[data-testid="accept-proposal-button"]');
    
    // Confirm acceptance with additional verification
    await page.check('[data-testid="confirm-terms"]');
    await page.check('[data-testid="confirm-blockchain"]');
    await page.click('[data-testid="final-accept-button"]');
    
    // Verify acceptance process
    await expect(page.locator('[data-testid="acceptance-processing"]')).toBeVisible();
    await expect(page.locator('[data-testid="blockchain-transaction"]')).toBeVisible();
    
    // Wait for completion
    await page.waitForSelector('[data-testid="swap-accepted"]', { timeout: 30000 });
    await expect(page.locator('[data-testid="swap-accepted"]')).toContainText('Swap accepted successfully');
  });

  test('User can reject swap proposals with feedback', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click('[data-testid="received-proposals-tab"]');
    
    // Select a proposal to reject
    await page.click('[data-testid="received-proposal-item"]').first();
    await page.click('[data-testid="reject-proposal-button"]');
    
    // Provide rejection reason
    await page.selectOption('[data-testid="rejection-reason"]', 'dates-not-suitable');
    await page.fill('[data-testid="rejection-message"]', 'Sorry, the dates don\'t work for my schedule.');
    await page.check('[data-testid="allow-counter-offer"]');
    
    await page.click('[data-testid="confirm-rejection"]');
    
    // Verify rejection
    await expect(page.locator('[data-testid="rejection-success"]')).toContainText('Proposal rejected');
    await expect(page.locator('[data-testid="notification-sent"]')).toContainText('Proposer has been notified');
  });

  test('User can track swap execution and completion', async ({ page }) => {
    // Mock an accepted swap in execution phase
    await page.route('**/api/swaps/*/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'executing',
          blockchain: {
            executionTransactionId: 'tx-execution-001',
            escrowContractId: 'contract-001',
          },
          timeline: {
            acceptedAt: new Date().toISOString(),
            executionStartedAt: new Date().toISOString(),
          },
        }),
      });
    });
    
    await page.goto('/swaps/swap-001');
    
    // Verify execution tracking
    await expect(page.locator('[data-testid="swap-status"]')).toContainText('Executing');
    await expect(page.locator('[data-testid="progress-bar"]')).toBeVisible();
    await expect(page.locator('[data-testid="blockchain-tx-link"]')).toBeVisible();
    
    // Mock completion
    await page.route('**/api/swaps/*/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'completed',
          blockchain: {
            executionTransactionId: 'tx-execution-001',
            completionTransactionId: 'tx-completion-001',
          },
          timeline: {
            acceptedAt: new Date(Date.now() - 300000).toISOString(),
            executionStartedAt: new Date(Date.now() - 180000).toISOString(),
            completedAt: new Date().toISOString(),
          },
        }),
      });
    });
    
    await page.reload();
    
    // Verify completion
    await expect(page.locator('[data-testid="swap-status"]')).toContainText('Completed');
    await expect(page.locator('[data-testid="completion-celebration"]')).toBeVisible();
    await expect(page.locator('[data-testid="new-booking-access"]')).toBeVisible();
    
    // Test rating system
    await page.click('[data-testid="rate-experience-button"]');
    await page.click('[data-testid="star-rating-5"]');
    await page.fill('[data-testid="review-text"]', 'Great swap experience! Very smooth process.');
    await page.click('[data-testid="submit-review"]');
    
    await expect(page.locator('[data-testid="review-submitted"]')).toBeVisible();
  });

  test('User can handle swap failures and disputes', async ({ page }) => {
    // Mock swap failure
    await page.route('**/api/swaps/*/execute', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Smart contract execution failed',
          code: 'CONTRACT_ERROR',
          details: 'Insufficient gas for transaction',
        }),
      });
    });
    
    await page.goto('/swaps/swap-001');
    await page.click('[data-testid="retry-execution-button"]');
    
    // Verify error handling
    await expect(page.locator('[data-testid="execution-error"]')).toContainText('Smart contract execution failed');
    await expect(page.locator('[data-testid="error-details"]')).toContainText('Insufficient gas');
    
    // Test dispute initiation
    await page.click('[data-testid="report-issue-button"]');
    await page.selectOption('[data-testid="issue-type"]', 'technical-failure');
    await page.fill('[data-testid="issue-description"]', 'Swap failed due to blockchain error, need assistance');
    await page.click('[data-testid="submit-dispute"]');
    
    // Verify dispute creation
    await expect(page.locator('[data-testid="dispute-created"]')).toContainText('Support ticket created');
    await expect(page.locator('[data-testid="dispute-id"]')).toBeVisible();
    
    // Test automatic retry mechanism
    await page.click('[data-testid="enable-auto-retry"]');
    await expect(page.locator('[data-testid="auto-retry-enabled"]')).toContainText('Will retry automatically');
  });

  test('User can manage swap expiration and extensions', async ({ page }) => {
    // Mock expiring swap
    const expirationTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
    
    await page.route('**/api/swaps/expiring', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          swaps: [{
            id: 'swap-expiring-001',
            terms: { expiresAt: expirationTime.toISOString() },
            status: 'pending',
            timeRemaining: 7200, // 2 hours in seconds
          }],
        }),
      });
    });
    
    await page.goto('/dashboard');
    await page.click('[data-testid="expiring-swaps-tab"]');
    
    // Verify expiring swap notification
    await expect(page.locator('[data-testid="expiring-swap-item"]')).toBeVisible();
    await expect(page.locator('[data-testid="time-remaining"]')).toContainText('2 hours');
    
    // Request extension
    await page.click('[data-testid="request-extension-button"]');
    await page.selectOption('[data-testid="extension-duration"]', '24-hours');
    await page.fill('[data-testid="extension-reason"]', 'Need more time to review booking details');
    await page.click('[data-testid="submit-extension-request"]');
    
    // Verify extension request
    await expect(page.locator('[data-testid="extension-requested"]')).toContainText('Extension request sent');
    
    // Mock automatic expiration
    await page.route('**/api/swaps/*/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'expired',
          timeline: { expiredAt: new Date().toISOString() },
        }),
      });
    });
    
    // Simulate time passing and check expired status
    await page.reload();
    await expect(page.locator('[data-testid="swap-expired"]')).toContainText('Swap expired');
    await expect(page.locator('[data-testid="booking-unlocked"]')).toContainText('Your booking is now available');
  });
});