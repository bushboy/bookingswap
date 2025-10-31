import { test, expect } from '@playwright/test';

test.describe('Booking Swap Management E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.route('**/api/auth/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'user1',
            username: 'testuser',
            email: 'test@example.com',
            profile: {
              firstName: 'Test',
              lastName: 'User',
              verification: { status: 'verified' },
            },
          },
          token: 'mock-jwt-token',
        }),
      });
    });

    // Mock bookings API
    await page.route('**/api/bookings**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: '1',
              userId: 'user1',
              type: 'hotel',
              title: 'Luxury Hotel Paris',
              description: 'Beautiful hotel in the heart of Paris',
              location: { city: 'Paris', country: 'France' },
              dateRange: {
                checkIn: '2024-06-01T00:00:00.000Z',
                checkOut: '2024-06-05T00:00:00.000Z',
              },
              originalPrice: 500,
              swapValue: 450,
              status: 'available',
              verification: { status: 'verified' },
            },
          ]),
        });
      } else if (route.request().method() === 'POST') {
        const requestBody = await route.request().postDataJSON();
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'new-booking',
            ...requestBody,
            status: 'available',
            verification: { status: 'pending' },
            createdAt: new Date().toISOString(),
          }),
        });
      }
    });

    // Mock swaps API
    await page.route('**/api/swaps**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'swap1',
              sourceBookingId: 'booking1',
              targetBookingId: 'booking2',
              status: 'pending',
              sourceBooking: {
                id: 'booking1',
                title: 'My Hotel Booking',
                location: { city: 'New York', country: 'USA' },
              },
              targetBooking: {
                id: 'booking2',
                title: 'Their Hotel Booking',
                location: { city: 'Paris', country: 'France' },
              },
              proposer: { id: 'user1', username: 'testuser' },
              owner: { id: 'user2', username: 'otheruser' },
            },
          ]),
        });
      } else if (route.request().method() === 'POST') {
        const requestBody = await route.request().postDataJSON();
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'new-swap',
            ...requestBody,
            status: 'pending',
            createdAt: new Date().toISOString(),
          }),
        });
      }
    });

    await page.goto('/');
  });

  test.describe('Booking Management', () => {
    test('should create a new booking successfully', async ({ page }) => {
      // Navigate to bookings page
      await page.click('nav a[href="/bookings"]');
      await expect(page).toHaveURL('/bookings');

      // Click create booking button
      await page.click('button:has-text("Create Booking")');

      // Fill out the booking form
      await page.fill('input[name="title"]', 'Test Hotel Booking');
      await page.fill('textarea[name="description"]', 'A beautiful test hotel');
      await page.selectOption('select[name="type"]', 'hotel');
      await page.fill('input[name="location.city"]', 'London');
      await page.fill('input[name="location.country"]', 'UK');
      await page.fill('input[name="dateRange.checkIn"]', '2024-07-01');
      await page.fill('input[name="dateRange.checkOut"]', '2024-07-05');
      await page.fill('input[name="originalPrice"]', '600');
      await page.fill('input[name="swapValue"]', '550');
      await page.fill('input[name="providerDetails.provider"]', 'Hotels.com');
      await page.fill('input[name="providerDetails.confirmationNumber"]', 'CONF123');

      // Submit the form
      await page.click('button[type="submit"]:has-text("Create Booking")');

      // Wait for success message
      await expect(page.locator('.toast-success')).toContainText('Booking created successfully');

      // Verify booking appears in list
      await expect(page.locator('.booking-card')).toContainText('Test Hotel Booking');
    });

    test('should filter bookings by type and location', async ({ page }) => {
      await page.goto('/bookings');

      // Initially should show all bookings
      await expect(page.locator('.booking-card')).toHaveCount(1);

      // Filter by hotel type
      await page.check('input[type="checkbox"][value="hotel"]');
      await expect(page.locator('.booking-card')).toHaveCount(1);

      // Filter by location
      await page.fill('input[placeholder*="city"]', 'Paris');
      await page.press('input[placeholder*="city"]', 'Enter');
      await expect(page.locator('.booking-card')).toHaveCount(1);

      // Clear filters
      await page.click('button:has-text("Clear Filters")');
      await expect(page.locator('.booking-card')).toHaveCount(1);
    });

    test('should edit an existing booking', async ({ page }) => {
      await page.goto('/bookings');

      // Click edit button on first booking
      await page.click('.booking-card button:has-text("Edit")');

      // Update the title
      await page.fill('input[name="title"]', 'Updated Hotel Title');

      // Submit the form
      await page.click('button[type="submit"]:has-text("Update Booking")');

      // Wait for success message
      await expect(page.locator('.toast-success')).toContainText('Booking updated successfully');

      // Verify updated title appears
      await expect(page.locator('.booking-card')).toContainText('Updated Hotel Title');
    });

    test('should delete a booking with confirmation', async ({ page }) => {
      await page.goto('/bookings');

      // Click delete button
      await page.click('.booking-card button:has-text("Delete")');

      // Confirm deletion in modal
      await expect(page.locator('.modal')).toContainText('Are you sure you want to delete');
      await page.click('.modal button:has-text("Confirm")');

      // Wait for success message
      await expect(page.locator('.toast-success')).toContainText('Booking deleted successfully');

      // Verify booking is removed
      await expect(page.locator('.booking-card')).toHaveCount(0);
      await expect(page.locator('.empty-state')).toContainText('No bookings found');
    });
  });

  test.describe('Swap Management', () => {
    test('should create a swap proposal', async ({ page }) => {
      await page.goto('/bookings');

      // Click create swap button on a booking
      await page.click('.booking-card button:has-text("Create Swap")');

      // Fill swap proposal form
      await page.fill('textarea[name="message"]', 'I would like to swap my booking');
      await page.fill('input[name="additionalPayment"]', '50');
      await page.fill('textarea[name="conditions"]', 'Flexible check-in required');

      // Submit proposal
      await page.click('button:has-text("Send Proposal")');

      // Wait for success message
      await expect(page.locator('.toast-success')).toContainText('Swap proposal created');

      // Navigate to swaps page to verify
      await page.click('nav a[href="/swaps"]');
      await expect(page.locator('.swap-card')).toContainText('My Hotel Booking');
    });

    test('should browse and filter available swaps', async ({ page }) => {
      await page.goto('/swaps/browse');

      // Should show available swaps
      await expect(page.locator('.swap-card')).toHaveCount(1);

      // Filter by location
      await page.fill('input[placeholder*="location"]', 'Paris');
      await page.press('input[placeholder*="location"]', 'Enter');

      // Filter by date range
      await page.fill('input[name="dateFrom"]', '2024-06-01');
      await page.fill('input[name="dateTo"]', '2024-06-30');

      // Apply filters
      await page.click('button:has-text("Apply Filters")');

      // Should show filtered results
      await expect(page.locator('.swap-card')).toHaveCount(1);
    });

    test('should respond to a swap proposal', async ({ page }) => {
      await page.goto('/swaps');

      // Click on pending swap
      await page.click('.swap-card');

      // Should open proposal details modal
      await expect(page.locator('.modal')).toContainText('Swap Proposal Details');

      // Accept the proposal
      await page.click('button:has-text("Accept")');

      // Confirm acceptance
      await expect(page.locator('.confirmation-modal')).toContainText('Accept Swap Proposal');
      await page.click('.confirmation-modal button:has-text("Confirm")');

      // Wait for success message
      await expect(page.locator('.toast-success')).toContainText('Swap proposal accepted');

      // Verify swap status changed
      await expect(page.locator('.swap-card .status-badge')).toContainText('Accepted');
    });

    test('should complete a swap with blockchain transaction', async ({ page }) => {
      // Mock wallet connection
      await page.addInitScript(() => {
        window.ethereum = {
          request: async ({ method }: { method: string }) => {
            if (method === 'eth_requestAccounts') {
              return ['0x1234567890123456789012345678901234567890'];
            }
            if (method === 'eth_sendTransaction') {
              return '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
            }
            return null;
          },
        };
      });

      await page.goto('/swaps');

      // Navigate to accepted swap
      await page.click('.swap-card:has(.status-badge:has-text("Accepted"))');

      // Click complete swap
      await page.click('button:has-text("Complete Swap")');

      // Review completion details
      await expect(page.locator('.completion-modal')).toContainText('Complete Swap');
      await expect(page.locator('.completion-modal')).toContainText('Blockchain Transaction');

      // Agree to terms
      await page.check('input[type="checkbox"]:near(:text("I agree to the terms"))');

      // Complete the swap
      await page.click('button:has-text("Complete Swap")');

      // Wait for blockchain transaction
      await expect(page.locator('.loading-spinner')).toBeVisible();
      await expect(page.locator('.toast-success')).toContainText('Swap completed successfully');

      // Verify swap status
      await expect(page.locator('.swap-card .status-badge')).toContainText('Completed');
    });

    test('should track swap timeline and events', async ({ page }) => {
      await page.goto('/swaps');

      // Click on a swap to view details
      await page.click('.swap-card');

      // Navigate to timeline tab
      await page.click('button:has-text("Timeline")');

      // Should show swap events
      await expect(page.locator('.timeline-event')).toContainText('Swap created');
      await expect(page.locator('.timeline-event')).toContainText('Proposal sent');

      // Events should be in chronological order
      const events = page.locator('.timeline-event');
      const firstEvent = events.first();
      const lastEvent = events.last();

      await expect(firstEvent).toContainText('Swap created');
      // Last event depends on swap status
    });
  });

  test.describe('Real-time Updates', () => {
    test('should receive real-time swap notifications', async ({ page }) => {
      await page.goto('/swaps');

      // Mock WebSocket connection
      await page.evaluate(() => {
        // Simulate receiving a WebSocket message
        window.dispatchEvent(new CustomEvent('swap-update', {
          detail: {
            type: 'swap_proposal',
            data: {
              id: 'new-swap',
              status: 'pending',
              message: 'New swap proposal received',
            },
          },
        }));
      });

      // Should show notification
      await expect(page.locator('.notification-toast')).toContainText('New swap proposal received');

      // Notification bell should show count
      await expect(page.locator('.notification-bell .count')).toContainText('1');
    });

    test('should update swap status in real-time', async ({ page }) => {
      await page.goto('/swaps');

      // Initially shows pending status
      await expect(page.locator('.swap-card .status-badge')).toContainText('Pending');

      // Simulate real-time status update
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('swap-update', {
          detail: {
            type: 'swap_accepted',
            data: {
              id: 'swap1',
              status: 'accepted',
            },
          },
        }));
      });

      // Status should update without page refresh
      await expect(page.locator('.swap-card .status-badge')).toContainText('Accepted');
    });
  });

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // Mock network error
      await page.route('**/api/bookings', async (route) => {
        await route.abort('failed');
      });

      await page.goto('/bookings');

      // Should show error state
      await expect(page.locator('.error-state')).toContainText('Failed to load bookings');

      // Should offer retry option
      await expect(page.locator('button:has-text("Retry")')).toBeVisible();

      // Retry should work when network is restored
      await page.unroute('**/api/bookings');
      await page.route('**/api/bookings', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      });

      await page.click('button:has-text("Retry")');
      await expect(page.locator('.error-state')).not.toBeVisible();
    });

    test('should handle validation errors in forms', async ({ page }) => {
      await page.goto('/bookings');
      await page.click('button:has-text("Create Booking")');

      // Try to submit empty form
      await page.click('button[type="submit"]:has-text("Create Booking")');

      // Should show validation errors
      await expect(page.locator('.field-error')).toContainText('Title is required');
      await expect(page.locator('.field-error')).toContainText('Type is required');

      // Form should not be submitted
      await expect(page.locator('.modal')).toBeVisible();
    });

    test('should handle expired swaps', async ({ page }) => {
      // Mock expired swap
      await page.route('**/api/swaps', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'expired-swap',
              status: 'expired',
              expiresAt: new Date(Date.now() - 1000).toISOString(),
              sourceBooking: { title: 'Expired Swap' },
            },
          ]),
        });
      });

      await page.goto('/swaps');

      // Navigate to expired tab
      await page.click('button:has-text("Expired")');

      // Should show expired swap
      await expect(page.locator('.swap-card')).toContainText('Expired Swap');
      await expect(page.locator('.swap-card .status-badge')).toContainText('Expired');

      // Should not allow actions on expired swap
      await expect(page.locator('.swap-card button:has-text("Accept")')).not.toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should be keyboard navigable', async ({ page }) => {
      await page.goto('/bookings');

      // Tab through interactive elements
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toHaveAttribute('href', '/bookings');

      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toContainText('Create Booking');

      // Enter should activate focused element
      await page.keyboard.press('Enter');
      await expect(page.locator('.modal')).toBeVisible();

      // Escape should close modal
      await page.keyboard.press('Escape');
      await expect(page.locator('.modal')).not.toBeVisible();
    });

    test('should have proper ARIA labels and roles', async ({ page }) => {
      await page.goto('/bookings');

      // Check main navigation
      await expect(page.locator('nav')).toHaveAttribute('role', 'navigation');

      // Check booking cards
      await expect(page.locator('.booking-card')).toHaveAttribute('role', 'article');

      // Check buttons have proper labels
      await expect(page.locator('button:has-text("Create Booking")')).toHaveAttribute('aria-label');

      // Check form inputs have labels
      await page.click('button:has-text("Create Booking")');
      await expect(page.locator('input[name="title"]')).toHaveAttribute('aria-labelledby');
    });

    test('should announce changes to screen readers', async ({ page }) => {
      await page.goto('/swaps');

      // Check for live regions
      await expect(page.locator('[aria-live="polite"]')).toBeVisible();

      // Status changes should be announced
      await page.evaluate(() => {
        const liveRegion = document.querySelector('[aria-live="polite"]');
        if (liveRegion) {
          liveRegion.textContent = 'Swap status updated to accepted';
        }
      });

      await expect(page.locator('[aria-live="polite"]')).toContainText('Swap status updated to accepted');
    });
  });

  test.describe('Performance', () => {
    test('should load pages within acceptable time', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/bookings');
      const loadTime = Date.now() - startTime;

      // Page should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);

      // Check for performance metrics
      const performanceMetrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        return {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        };
      });

      expect(performanceMetrics.domContentLoaded).toBeLessThan(2000);
    });

    test('should handle large datasets efficiently', async ({ page }) => {
      // Mock large dataset
      const largeBookingList = Array.from({ length: 100 }, (_, i) => ({
        id: `booking-${i}`,
        title: `Hotel ${i}`,
        type: 'hotel',
        status: 'available',
        location: { city: 'City', country: 'Country' },
        originalPrice: 100 + i,
      }));

      await page.route('**/api/bookings', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(largeBookingList),
        });
      });

      const startTime = Date.now();
      await page.goto('/bookings');
      
      // Wait for content to load
      await expect(page.locator('.booking-card')).toHaveCount(12); // Assuming pagination
      
      const renderTime = Date.now() - startTime;
      
      // Should render efficiently even with large dataset
      expect(renderTime).toBeLessThan(5000);

      // Should show pagination
      await expect(page.locator('.pagination')).toBeVisible();
    });
  });
});