import { test, expect, Page } from '@playwright/test';

// Test data
const testUser = {
  email: 'testuser@example.com',
  password: 'TestPassword123!',
  firstName: 'Test',
  lastName: 'User',
};

const testBooking = {
  title: 'Paris Hotel Stay E2E Test',
  description: 'A beautiful hotel in the heart of Paris for E2E testing',
  type: 'hotel',
  city: 'Paris',
  country: 'France',
  checkInDate: '2024-06-01',
  checkOutDate: '2024-06-05',
  originalPrice: '350',
  provider: 'Booking.com',
  confirmationNumber: 'E2E123456',
};

const swapPreferences = {
  minCashAmount: '200',
  acceptanceStrategy: 'first-match',
};

// Helper functions
async function loginUser(page: Page) {
  await page.goto('/login');
  await page.fill('[data-testid="email-input"]', testUser.email);
  await page.fill('[data-testid="password-input"]', testUser.password);
  await page.click('[data-testid="login-button"]');
  await expect(page).toHaveURL('/dashboard');
}

async function createBookingWithSwap(page: Page) {
  // Navigate to bookings page
  await page.click('[data-testid="nav-bookings"]');
  await expect(page).toHaveURL('/bookings');

  // Open booking creation form
  await page.click('[data-testid="create-booking-button"]');
  await expect(page.locator('[data-testid="unified-booking-form"]')).toBeVisible();

  // Fill basic booking information
  await page.fill('[data-testid="booking-title"]', testBooking.title);
  await page.fill('[data-testid="booking-description"]', testBooking.description);
  await page.selectOption('[data-testid="booking-type"]', testBooking.type);
  await page.fill('[data-testid="booking-city"]', testBooking.city);
  await page.fill('[data-testid="booking-country"]', testBooking.country);
  await page.fill('[data-testid="checkin-date"]', testBooking.checkInDate);
  await page.fill('[data-testid="checkout-date"]', testBooking.checkOutDate);
  await page.fill('[data-testid="original-price"]', testBooking.originalPrice);
  await page.fill('[data-testid="provider"]', testBooking.provider);
  await page.fill('[data-testid="confirmation-number"]', testBooking.confirmationNumber);

  // Enable swap preferences
  await page.click('[data-testid="swap-toggle"]');
  await expect(page.locator('[data-testid="swap-preferences-section"]')).toBeVisible();

  // Configure swap preferences
  await page.check('[data-testid="accept-booking-swaps"]');
  await page.check('[data-testid="accept-cash-offers"]');
  await page.fill('[data-testid="min-cash-amount"]', swapPreferences.minCashAmount);
  await page.selectOption('[data-testid="acceptance-strategy"]', swapPreferences.acceptanceStrategy);

  // Submit form
  await page.click('[data-testid="submit-booking"]');
  
  // Wait for success and form to close
  await expect(page.locator('[data-testid="unified-booking-form"]')).not.toBeVisible();
  await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
}

async function navigateToBrowsePage(page: Page) {
  await page.click('[data-testid="nav-browse"]');
  await expect(page).toHaveURL('/browse');
  await expect(page.locator('[data-testid="booking-listings"]')).toBeVisible();
}

test.describe('Booking Swap UI Simplification - E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up test environment
    await page.goto('/');
    
    // Mock API responses for consistent testing
    await page.route('**/api/bookings/with-swap-info', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'test-booking-1',
            title: 'Rome Apartment',
            description: 'Beautiful apartment in Rome',
            location: { city: 'Rome', country: 'Italy' },
            originalPrice: 280,
            swapInfo: {
              swapId: 'swap-1',
              paymentTypes: ['booking', 'cash'],
              acceptanceStrategy: 'first-match',
              minCashAmount: 150,
              hasActiveProposals: true,
              activeProposalCount: 1,
              userProposalStatus: 'none',
            },
          },
        ]),
      });
    });
  });

  test.describe('Complete Booking Creation with Swap Workflow', () => {
    test('should create booking with swap preferences successfully', async ({ page }) => {
      await loginUser(page);
      await createBookingWithSwap(page);

      // Verify booking appears in listings with swap indicator
      await expect(page.locator('[data-testid="booking-card"]').filter({ hasText: testBooking.title })).toBeVisible();
      await expect(page.locator('[data-testid="swap-status-badge"]')).toBeVisible();
      await expect(page.locator('[data-testid="swap-status-badge"]')).toHaveText('Available for Swap');
    });

    test('should validate required fields before submission', async ({ page }) => {
      await loginUser(page);
      
      // Navigate to bookings page and open form
      await page.click('[data-testid="nav-bookings"]');
      await page.click('[data-testid="create-booking-button"]');

      // Try to submit without filling required fields
      await page.click('[data-testid="submit-booking"]');

      // Should show validation errors
      await expect(page.locator('[role="alert"]').first()).toBeVisible();
      await expect(page.locator('[data-testid="unified-booking-form"]')).toBeVisible(); // Form should remain open
    });

    test('should validate swap preferences when enabled', async ({ page }) => {
      await loginUser(page);
      
      await page.click('[data-testid="nav-bookings"]');
      await page.click('[data-testid="create-booking-button"]');

      // Fill basic booking info
      await page.fill('[data-testid="booking-title"]', testBooking.title);
      await page.fill('[data-testid="booking-description"]', testBooking.description);
      await page.fill('[data-testid="booking-city"]', testBooking.city);
      await page.fill('[data-testid="booking-country"]', testBooking.country);
      await page.fill('[data-testid="original-price"]', testBooking.originalPrice);

      // Enable swap but don't configure properly
      await page.click('[data-testid="swap-toggle"]');
      await page.check('[data-testid="accept-cash-offers"]');
      // Don't set minimum cash amount

      await page.click('[data-testid="submit-booking"]');

      // Should show swap validation error
      await expect(page.locator('[role="alert"]').filter({ hasText: /minimum cash amount/i })).toBeVisible();
    });

    test('should handle auction mode validation correctly', async ({ page }) => {
      await loginUser(page);
      
      await page.click('[data-testid="nav-bookings"]');
      await page.click('[data-testid="create-booking-button"]');

      // Fill basic info with near-future date
      await page.fill('[data-testid="booking-title"]', testBooking.title);
      await page.fill('[data-testid="booking-description"]', testBooking.description);
      await page.fill('[data-testid="checkin-date"]', '2024-06-01');
      await page.fill('[data-testid="checkout-date"]', '2024-06-03');

      // Enable swap with auction mode
      await page.click('[data-testid="swap-toggle"]');
      await page.check('[data-testid="accept-booking-swaps"]');
      await page.selectOption('[data-testid="acceptance-strategy"]', 'auction');

      // Set auction end date too close to event
      await page.fill('[data-testid="auction-end-date"]', '2024-05-30'); // Only 2 days before

      await page.click('[data-testid="submit-booking"]');

      // Should show auction validation error
      await expect(page.locator('[role="alert"]').filter({ hasText: /auction must end at least one week before/i })).toBeVisible();
    });
  });

  test.describe('Booking Discovery and Filtering', () => {
    test('should filter bookings by swap availability', async ({ page }) => {
      await loginUser(page);
      await navigateToBrowsePage(page);

      // Initially should show all bookings
      await expect(page.locator('[data-testid="booking-card"]')).toHaveCount(1);

      // Apply swap filter
      await page.check('[data-testid="filter-swap-available"]');

      // Should still show the swappable booking
      await expect(page.locator('[data-testid="booking-card"]')).toHaveCount(1);
      await expect(page.locator('[data-testid="swap-status-badge"]')).toBeVisible();

      // Mock response with non-swappable booking
      await page.route('**/api/bookings/with-swap-info*', async route => {
        const url = new URL(route.request().url());
        const swapAvailable = url.searchParams.get('swapAvailable');
        
        if (swapAvailable === 'true') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([]), // No swappable bookings
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
              {
                id: 'non-swappable-booking',
                title: 'Non-Swappable Booking',
                swapInfo: null,
              },
            ]),
          });
        }
      });

      // Uncheck filter
      await page.uncheck('[data-testid="filter-swap-available"]');

      // Should show non-swappable booking
      await expect(page.locator('[data-testid="booking-card"]')).toHaveCount(1);
      await expect(page.locator('[data-testid="booking-card"]')).toHaveText(/Non-Swappable Booking/);
    });

    test('should combine multiple filters correctly', async ({ page }) => {
      await loginUser(page);
      await navigateToBrowsePage(page);

      // Apply multiple filters
      await page.check('[data-testid="filter-swap-available"]');
      await page.check('[data-testid="filter-accepts-cash"]');
      await page.check('[data-testid="filter-auction-mode"]');

      // Verify filter summary shows active filters
      await expect(page.locator('[data-testid="filter-summary"]')).toContainText('3 filters active');
      await expect(page.locator('[data-testid="active-filter"]').filter({ hasText: 'Available for Swap' })).toBeVisible();
      await expect(page.locator('[data-testid="active-filter"]').filter({ hasText: 'Accepts Cash' })).toBeVisible();
      await expect(page.locator('[data-testid="active-filter"]').filter({ hasText: 'Auction Mode' })).toBeVisible();

      // Reset filters
      await page.click('[data-testid="reset-filters"]');

      // All filters should be cleared
      await expect(page.locator('[data-testid="filter-summary"]')).toContainText('No filters active');
    });
  });

  test.describe('Inline Proposal Workflow', () => {
    test('should make cash proposal directly from listing', async ({ page }) => {
      await loginUser(page);
      await navigateToBrowsePage(page);

      // Wait for booking to load
      await expect(page.locator('[data-testid="booking-card"]').first()).toBeVisible();

      // Click make proposal button
      await page.click('[data-testid="make-proposal-button"]');

      // Inline proposal form should appear
      await expect(page.locator('[data-testid="inline-proposal-form"]')).toBeVisible();

      // Select cash proposal type
      await page.check('[data-testid="proposal-type-cash"]');

      // Fill cash amount
      await page.fill('[data-testid="cash-amount-input"]', '200');

      // Add message
      await page.fill('[data-testid="proposal-message"]', 'Very interested in this swap!');

      // Mock successful proposal submission
      await page.route('**/api/proposals', async route => {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'proposal-1',
            status: 'pending',
            message: 'Proposal submitted successfully',
          }),
        });
      });

      // Submit proposal
      await page.click('[data-testid="submit-proposal"]');

      // Should show success message and close form
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="inline-proposal-form"]')).not.toBeVisible();

      // Booking card should update to show proposal status
      await expect(page.locator('[data-testid="user-proposal-status"]')).toHaveText('Proposal Pending');
    });

    test('should make booking proposal with user booking selection', async ({ page }) => {
      // Mock user bookings
      await page.route('**/api/user/bookings', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'user-booking-1',
              title: 'My London Hotel',
              status: 'available',
              originalPrice: 250,
            },
            {
              id: 'user-booking-2',
              title: 'My Barcelona Apartment',
              status: 'available',
              originalPrice: 180,
            },
          ]),
        });
      });

      await loginUser(page);
      await navigateToBrowsePage(page);

      await page.click('[data-testid="make-proposal-button"]');
      await expect(page.locator('[data-testid="inline-proposal-form"]')).toBeVisible();

      // Select booking proposal type (should be default)
      await expect(page.locator('[data-testid="proposal-type-booking"]')).toBeChecked();

      // Select user booking
      await page.selectOption('[data-testid="booking-selector"]', 'user-booking-1');

      // Verify booking details are shown
      await expect(page.locator('[data-testid="selected-booking-details"]')).toContainText('My London Hotel');
      await expect(page.locator('[data-testid="selected-booking-details"]')).toContainText('$250');

      // Add message
      await page.fill('[data-testid="proposal-message"]', 'Perfect match for dates!');

      // Submit proposal
      await page.click('[data-testid="submit-proposal"]');

      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
    });

    test('should validate proposal form before submission', async ({ page }) => {
      await loginUser(page);
      await navigateToBrowsePage(page);

      await page.click('[data-testid="make-proposal-button"]');

      // Try to submit without selecting booking
      await page.click('[data-testid="submit-proposal"]');

      // Should show validation error
      await expect(page.locator('[role="alert"]').filter({ hasText: /please select a booking/i })).toBeVisible();

      // Switch to cash and try invalid amount
      await page.check('[data-testid="proposal-type-cash"]');
      await page.fill('[data-testid="cash-amount-input"]', '50'); // Below minimum

      await page.click('[data-testid="submit-proposal"]');

      // Should show cash validation error
      await expect(page.locator('[role="alert"]').filter({ hasText: /minimum amount is/i })).toBeVisible();
    });

    test('should cancel proposal form', async ({ page }) => {
      await loginUser(page);
      await navigateToBrowsePage(page);

      await page.click('[data-testid="make-proposal-button"]');
      await expect(page.locator('[data-testid="inline-proposal-form"]')).toBeVisible();

      // Cancel form
      await page.click('[data-testid="cancel-proposal"]');

      // Form should close
      await expect(page.locator('[data-testid="inline-proposal-form"]')).not.toBeVisible();
    });
  });

  test.describe('Booking Management with Swap Integration', () => {
    test('should edit existing booking and update swap preferences', async ({ page }) => {
      await loginUser(page);

      // Mock existing booking with swap
      await page.route('**/api/bookings/user-booking-1', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'user-booking-1',
            title: 'Existing Paris Hotel',
            description: 'Original description',
            swapEnabled: true,
            swapPreferences: {
              paymentTypes: ['booking'],
              acceptanceStrategy: 'first-match',
            },
          }),
        });
      });

      // Navigate to bookings and edit
      await page.click('[data-testid="nav-bookings"]');
      await page.click('[data-testid="edit-booking-user-booking-1"]');

      // Form should open in edit mode with existing data
      await expect(page.locator('[data-testid="unified-booking-form"]')).toBeVisible();
      await expect(page.locator('[data-testid="form-title"]')).toHaveText('Edit Booking');
      await expect(page.locator('[data-testid="booking-title"]')).toHaveValue('Existing Paris Hotel');
      await expect(page.locator('[data-testid="swap-toggle"]')).toBeChecked();

      // Update booking details
      await page.fill('[data-testid="booking-title"]', 'Updated Paris Hotel');
      await page.fill('[data-testid="booking-description"]', 'Updated description with more details');

      // Update swap preferences
      await page.check('[data-testid="accept-cash-offers"]');
      await page.fill('[data-testid="min-cash-amount"]', '300');

      // Mock successful update
      await page.route('**/api/bookings/user-booking-1', async route => {
        if (route.request().method() === 'PUT') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              booking: { id: 'user-booking-1', title: 'Updated Paris Hotel' },
              swap: { id: 'swap-1', minCashAmount: 300 },
            }),
          });
        }
      });

      // Submit update
      await page.click('[data-testid="submit-booking"]');

      // Should show success and close form
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="unified-booking-form"]')).not.toBeVisible();

      // Updated booking should appear in list
      await expect(page.locator('[data-testid="booking-card"]').filter({ hasText: 'Updated Paris Hotel' })).toBeVisible();
    });

    test('should disable swap for existing booking', async ({ page }) => {
      await loginUser(page);

      // Mock existing booking with swap enabled
      await page.route('**/api/bookings/user-booking-1', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'user-booking-1',
            title: 'Booking with Swap',
            swapEnabled: true,
            swapPreferences: {
              paymentTypes: ['booking', 'cash'],
              minCashAmount: 200,
            },
          }),
        });
      });

      await page.click('[data-testid="nav-bookings"]');
      await page.click('[data-testid="edit-booking-user-booking-1"]');

      // Disable swap
      await page.uncheck('[data-testid="swap-toggle"]');

      // Swap preferences should be hidden
      await expect(page.locator('[data-testid="swap-preferences-section"]')).not.toBeVisible();

      // Submit update
      await page.click('[data-testid="submit-booking"]');

      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();

      // Booking should no longer show swap indicator
      await expect(page.locator('[data-testid="booking-card"]').filter({ hasText: 'Booking with Swap' })).toBeVisible();
      await expect(page.locator('[data-testid="swap-status-badge"]')).not.toBeVisible();
    });
  });

  test.describe('Accessibility and Keyboard Navigation', () => {
    test('should support keyboard navigation through booking form', async ({ page }) => {
      await loginUser(page);
      await page.click('[data-testid="nav-bookings"]');
      await page.click('[data-testid="create-booking-button"]');

      // Tab through form elements
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="booking-title"]')).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="booking-description"]')).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="booking-type"]')).toBeFocused();

      // Continue tabbing to swap toggle
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press('Tab');
      }
      await expect(page.locator('[data-testid="swap-toggle"]')).toBeFocused();

      // Enable swap with space key
      await page.keyboard.press('Space');
      await expect(page.locator('[data-testid="swap-preferences-section"]')).toBeVisible();
    });

    test('should support keyboard navigation in proposal form', async ({ page }) => {
      await loginUser(page);
      await navigateToBrowsePage(page);

      // Open proposal form with keyboard
      await page.keyboard.press('Tab'); // Focus on first booking card
      await page.keyboard.press('Enter'); // Should open proposal form

      await expect(page.locator('[data-testid="inline-proposal-form"]')).toBeVisible();

      // Tab through proposal form
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="proposal-type-booking"]')).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="proposal-type-cash"]')).toBeFocused();

      // Switch to cash with arrow keys
      await page.keyboard.press('ArrowDown');
      await expect(page.locator('[data-testid="proposal-type-cash"]')).toBeChecked();

      // Tab to cash amount input
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="cash-amount-input"]')).toBeFocused();
    });

    test('should announce form validation errors to screen readers', async ({ page }) => {
      await loginUser(page);
      await page.click('[data-testid="nav-bookings"]');
      await page.click('[data-testid="create-booking-button"]');

      // Submit empty form
      await page.click('[data-testid="submit-booking"]');

      // Check for ARIA live regions
      const errorRegion = page.locator('[role="alert"][aria-live="assertive"]');
      await expect(errorRegion).toBeVisible();
      await expect(errorRegion).toContainText(/required/i);
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('should adapt booking form for mobile screens', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await loginUser(page);
      await page.click('[data-testid="nav-bookings"]');
      await page.click('[data-testid="create-booking-button"]');

      // Form should use mobile layout
      await expect(page.locator('[data-testid="unified-booking-form"]')).toHaveClass(/mobile-layout/);

      // Swap preferences should be collapsible on mobile
      await page.click('[data-testid="swap-toggle"]');
      await expect(page.locator('[data-testid="swap-preferences-section"]')).toHaveClass(/collapsible/);
    });

    test('should use mobile-optimized proposal form', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      await loginUser(page);
      await navigateToBrowsePage(page);

      await page.click('[data-testid="make-proposal-button"]');

      // Should use bottom sheet layout on mobile
      await expect(page.locator('[data-testid="inline-proposal-form"]')).toHaveClass(/bottom-sheet/);

      // Cash input should use numeric keyboard
      await page.check('[data-testid="proposal-type-cash"]');
      const cashInput = page.locator('[data-testid="cash-amount-input"]');
      await expect(cashInput).toHaveAttribute('inputmode', 'decimal');
    });
  });

  test.describe('Error Handling and Recovery', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      await loginUser(page);

      // Mock network error for booking creation
      await page.route('**/api/bookings', async route => {
        await route.abort('failed');
      });

      await page.click('[data-testid="nav-bookings"]');
      await page.click('[data-testid="create-booking-button"]');

      // Fill and submit form
      await page.fill('[data-testid="booking-title"]', testBooking.title);
      await page.fill('[data-testid="booking-description"]', testBooking.description);
      await page.click('[data-testid="submit-booking"]');

      // Should show error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText(/network error/i);

      // Form should remain open for retry
      await expect(page.locator('[data-testid="unified-booking-form"]')).toBeVisible();

      // Should have retry button
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    });

    test('should recover from proposal submission failures', async ({ page }) => {
      await loginUser(page);
      await navigateToBrowsePage(page);

      await page.click('[data-testid="make-proposal-button"]');

      // Mock proposal failure
      await page.route('**/api/proposals', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        });
      });

      // Fill and submit proposal
      await page.check('[data-testid="proposal-type-cash"]');
      await page.fill('[data-testid="cash-amount-input"]', '200');
      await page.click('[data-testid="submit-proposal"]');

      // Should show error and keep form open
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="inline-proposal-form"]')).toBeVisible();

      // Fix the API and retry
      await page.route('**/api/proposals', async route => {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'proposal-1', status: 'pending' }),
        });
      });

      await page.click('[data-testid="submit-proposal"]');

      // Should succeed on retry
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="inline-proposal-form"]')).not.toBeVisible();
    });
  });

  test.describe('Performance', () => {
    test('should load booking listings quickly', async ({ page }) => {
      await loginUser(page);

      const startTime = Date.now();
      await navigateToBrowsePage(page);
      
      // Wait for first booking to appear
      await expect(page.locator('[data-testid="booking-card"]').first()).toBeVisible();
      
      const loadTime = Date.now() - startTime;
      
      // Should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);
    });

    test('should handle large booking lists efficiently', async ({ page }) => {
      // Mock large dataset
      const manyBookings = Array.from({ length: 50 }, (_, i) => ({
        id: `booking-${i}`,
        title: `Booking ${i}`,
        location: { city: 'City', country: 'Country' },
        originalPrice: 100 + i,
        swapInfo: i % 3 === 0 ? { hasActiveProposals: true } : null,
      }));

      await page.route('**/api/bookings/with-swap-info', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(manyBookings),
        });
      });

      await loginUser(page);

      const startTime = Date.now();
      await navigateToBrowsePage(page);

      // Wait for all bookings to render
      await expect(page.locator('[data-testid="booking-card"]')).toHaveCount(50);

      const renderTime = Date.now() - startTime;

      // Should render 50 bookings within 5 seconds
      expect(renderTime).toBeLessThan(5000);
    });
  });
});