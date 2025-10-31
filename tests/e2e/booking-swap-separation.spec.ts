import { test, expect } from '@playwright/test';

test.describe('Booking-Swap Separation E2E Tests', () => {
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
        const url = route.request().url();
        if (url.includes('/test-booking-1')) {
          // Single booking request
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'test-booking-1',
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
              providerDetails: {
                provider: 'Booking.com',
                confirmationNumber: 'ABC123',
                bookingReference: 'REF456',
              },
            }),
          });
        } else {
          // Bookings list request
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
              {
                id: 'test-booking-1',
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
        }
      } else if (route.request().method() === 'PUT') {
        const requestBody = await route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-booking-1',
            ...requestBody,
            updatedAt: new Date().toISOString(),
          }),
        });
      }
    });

    // Mock unified booking service for swap info
    await page.route('**/api/bookings/with-swap-info**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'test-booking-1',
            title: 'Luxury Hotel Paris',
            swapInfo: null, // No existing swap
          },
        ]),
      });
    });

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
        isConnected: () => true,
      };
    });

    await page.goto('/');
  });

  test.describe('Edit-Only Workflow', () => {
    test('should edit booking details without creating swap', async ({ page }) => {
      // Navigate to bookings page
      await page.click('nav a[href="/bookings"]');
      await expect(page).toHaveURL('/bookings');

      // Click edit button on booking card
      await page.click('[data-testid="booking-card"] button:has-text("Edit")');

      // Should open booking edit modal
      await expect(page.locator('[data-testid="booking-edit-modal"]')).toBeVisible();
      await expect(page.locator('h1:has-text("Edit Booking Details")')).toBeVisible();

      // Verify booking-focused interface
      await expect(page.locator('text=Booking Edit Mode')).toBeVisible();
      await expect(page.locator('text=Focus on your booking details only')).toBeVisible();

      // Should not show swap-related fields
      await expect(page.locator('text=Payment Types')).not.toBeVisible();
      await expect(page.locator('text=Acceptance Strategy')).not.toBeVisible();
      await expect(page.locator('text=Auction End Date')).not.toBeVisible();

      // Edit booking title
      const titleInput = page.locator('input[name="title"]');
      await titleInput.clear();
      await titleInput.fill('Updated Luxury Hotel Paris');

      // Edit description
      const descriptionInput = page.locator('textarea[name="description"]');
      await descriptionInput.clear();
      await descriptionInput.fill('Updated beautiful hotel description');

      // Update pricing
      const originalPriceInput = page.locator('input[name="originalPrice"]');
      await originalPriceInput.clear();
      await originalPriceInput.fill('550');

      // Save changes
      await page.click('button[type="submit"]:has-text("Update Booking")');

      // Should show success message
      await expect(page.locator('.toast-success')).toContainText('Booking updated successfully');

      // Should close modal and return to bookings list
      await expect(page.locator('[data-testid="booking-edit-modal"]')).not.toBeVisible();

      // Verify updated booking appears in list
      await expect(page.locator('[data-testid="booking-card"]')).toContainText('Updated Luxury Hotel Paris');
    });

    test('should validate booking-only fields', async ({ page }) => {
      await page.goto('/bookings');
      await page.click('[data-testid="booking-card"] button:has-text("Edit")');

      // Clear required fields
      await page.fill('input[name="title"]', '');
      await page.fill('input[name="originalPrice"]', '0');

      // Try to submit
      await page.click('button[type="submit"]:has-text("Update Booking")');

      // Should show validation errors
      await expect(page.locator('.validation-error')).toContainText('Title is required');
      await expect(page.locator('.validation-error')).toContainText('Original price must be greater than 0');

      // Should not show swap-related validation errors
      await expect(page.locator('text=Payment types are required')).not.toBeVisible();
      await expect(page.locator('text=Acceptance strategy is required')).not.toBeVisible();

      // Form should not submit
      await expect(page.locator('[data-testid="booking-edit-modal"]')).toBeVisible();
    });

    test('should handle unsaved changes in booking edit', async ({ page }) => {
      await page.goto('/bookings');
      await page.click('[data-testid="booking-card"] button:has-text("Edit")');

      // Make changes
      await page.fill('input[name="title"]', 'Modified Title');

      // Try to close without saving
      await page.click('button:has-text("Cancel")');

      // Should show unsaved changes warning
      await expect(page.locator('.unsaved-changes-modal')).toBeVisible();
      await expect(page.locator('text=You have unsaved booking changes')).toBeVisible();

      // Choose to save changes
      await page.click('button:has-text("Save Changes")');

      // Should save and close
      await expect(page.locator('.toast-success')).toContainText('Booking updated successfully');
      await expect(page.locator('[data-testid="booking-edit-modal"]')).not.toBeVisible();
    });
  });

  test.describe('Edit-Then-Swap Workflow', () => {
    test('should navigate from booking edit to swap specification', async ({ page }) => {
      await page.goto('/bookings');
      await page.click('[data-testid="booking-card"] button:has-text("Edit")');

      // Verify in booking edit mode
      await expect(page.locator('text=Booking Edit Mode')).toBeVisible();

      // Click Enable Swapping button
      await page.click('button:has-text("Enable Swapping")');

      // Should navigate to swap specification page
      await expect(page).toHaveURL('/bookings/test-booking-1/swap-specification');
      await expect(page.locator('h1:has-text("Swap Specification")')).toBeVisible();

      // Should show booking context (read-only)
      await expect(page.locator('text=Booking Context')).toBeVisible();
      await expect(page.locator('text=Luxury Hotel Paris')).toBeVisible();
      await expect(page.locator('text=Beautiful hotel in the heart of Paris')).toBeVisible();

      // Should show swap-focused interface
      await expect(page.locator('text=Configure swap preferences')).toBeVisible();
      await expect(page.locator('[data-testid="swap-preferences-section"]')).toBeVisible();
    });

    test('should preserve booking changes when navigating to swap specification', async ({ page }) => {
      await page.goto('/bookings');
      await page.click('[data-testid="booking-card"] button:has-text("Edit")');

      // Make booking changes
      await page.fill('input[name="title"]', 'Modified Hotel Title');
      await page.fill('input[name="originalPrice"]', '600');

      // Navigate to swap specification
      await page.click('button:has-text("Enable Swapping")');

      // Should prompt to save changes
      await expect(page.locator('.unsaved-changes-modal')).toBeVisible();
      await expect(page.locator('text=You have unsaved booking changes')).toBeVisible();

      // Choose to save and continue
      await page.click('button:has-text("Save and Continue")');

      // Should navigate to swap specification with updated booking context
      await expect(page).toHaveURL('/bookings/test-booking-1/swap-specification');
      await expect(page.locator('text=Modified Hotel Title')).toBeVisible();
    });

    test('should complete full edit-then-swap workflow', async ({ page }) => {
      // Start with booking edit
      await page.goto('/bookings');
      await page.click('[data-testid="booking-card"] button:has-text("Edit")');

      // Update booking details
      await page.fill('input[name="title"]', 'Premium Hotel Paris');
      await page.fill('input[name="swapValue"]', '480');

      // Save booking changes
      await page.click('button[type="submit"]:has-text("Update Booking")');
      await expect(page.locator('.toast-success')).toContainText('Booking updated successfully');

      // Navigate to swap specification
      await page.click('[data-testid="booking-card"] button:has-text("Enable Swapping")');
      await expect(page).toHaveURL('/bookings/test-booking-1/swap-specification');

      // Configure swap preferences
      await page.check('input[type="checkbox"]:near(:text("Enable Swapping"))');
      await page.selectOption('select[name="acceptanceStrategy"]', 'auction');
      await page.fill('input[name="minCashAmount"]', '50');
      await page.fill('input[name="maxCashAmount"]', '200');

      // Enable swapping
      await page.click('button:has-text("Enable Swapping")');

      // Should show success and navigate back
      await expect(page.locator('.toast-success')).toContainText('Swapping enabled successfully');
      await expect(page).toHaveURL('/bookings');

      // Verify booking now shows swap enabled
      await expect(page.locator('[data-testid="booking-card"]')).toContainText('Premium Hotel Paris');
      await expect(page.locator('[data-testid="swap-status-badge"]')).toContainText('Swap Enabled');
    });
  });

  test.describe('Swap Specification Interface', () => {
    test('should show dedicated swap interface', async ({ page }) => {
      await page.goto('/bookings/test-booking-1/swap-specification');

      // Should show swap-focused page header
      await expect(page.locator('h1:has-text("Swap Specification")')).toBeVisible();
      await expect(page.locator('text=Configure swap preferences')).toBeVisible();

      // Should show booking context in read-only format
      await expect(page.locator('[data-testid="booking-context"]')).toBeVisible();
      await expect(page.locator('text=Luxury Hotel Paris')).toBeVisible();
      await expect(page.locator('text=Paris, France')).toBeVisible();
      await expect(page.locator('text=$500')).toBeVisible();

      // Should show swap configuration section
      await expect(page.locator('[data-testid="swap-configuration"]')).toBeVisible();
      await expect(page.locator('text=Payment Types')).toBeVisible();
      await expect(page.locator('text=Acceptance Strategy')).toBeVisible();

      // Should show wallet status
      await expect(page.locator('[data-testid="wallet-status"]')).toBeVisible();
      await expect(page.locator('text=Wallet Connected')).toBeVisible();
    });

    test('should validate swap-specific fields', async ({ page }) => {
      await page.goto('/bookings/test-booking-1/swap-specification');

      // Enable swapping
      await page.check('input[type="checkbox"]:near(:text("Enable Swapping"))');

      // Set invalid cash amounts
      await page.fill('input[name="minCashAmount"]', '500');
      await page.fill('input[name="maxCashAmount"]', '100');

      // Try to save
      await page.click('button:has-text("Enable Swapping")');

      // Should show swap-specific validation errors
      await expect(page.locator('.validation-error')).toContainText('Maximum cash amount must be greater than minimum');

      // Should not show booking-related validation errors
      await expect(page.locator('text=Title is required')).not.toBeVisible();
      await expect(page.locator('text=Description is required')).not.toBeVisible();
    });

    test('should handle existing swap preferences', async ({ page }) => {
      // Mock existing swap info
      await page.route('**/api/bookings/with-swap-info**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'test-booking-1',
              title: 'Luxury Hotel Paris',
              swapInfo: {
                paymentTypes: ['booking', 'cash'],
                acceptanceStrategy: 'auction',
                minCashAmount: 50,
                maxCashAmount: 200,
                swapConditions: ['flexible-dates'],
              },
            },
          ]),
        });
      });

      await page.goto('/bookings/test-booking-1/swap-specification');

      // Should load existing preferences
      await expect(page.locator('input[type="checkbox"]:near(:text("Enable Swapping"))')).toBeChecked();
      await expect(page.locator('select[name="acceptanceStrategy"]')).toHaveValue('auction');
      await expect(page.locator('input[name="minCashAmount"]')).toHaveValue('50');
      await expect(page.locator('input[name="maxCashAmount"]')).toHaveValue('200');

      // Should show update button instead of enable button
      await expect(page.locator('button:has-text("Update Preferences")')).toBeVisible();
    });
  });

  test.describe('Navigation and Breadcrumbs', () => {
    test('should show proper breadcrumb navigation', async ({ page }) => {
      await page.goto('/bookings/test-booking-1/swap-specification');

      // Should show breadcrumbs
      await expect(page.locator('[data-testid="breadcrumb-navigation"]')).toBeVisible();
      await expect(page.locator('text=Bookings')).toBeVisible();
      await expect(page.locator('text=Luxury Hotel Paris')).toBeVisible();
      await expect(page.locator('text=Swap Specification')).toBeVisible();

      // Clicking bookings breadcrumb should navigate back
      await page.click('[data-testid="breadcrumb-navigation"] a:has-text("Bookings")');
      await expect(page).toHaveURL('/bookings');
    });

    test('should handle back navigation', async ({ page }) => {
      await page.goto('/bookings/test-booking-1/swap-specification');

      // Click back button
      await page.click('button:has-text("Back to Bookings")');

      // Should navigate back to bookings
      await expect(page).toHaveURL('/bookings');
    });

    test('should handle browser back/forward navigation', async ({ page }) => {
      // Start at bookings
      await page.goto('/bookings');

      // Navigate to swap specification
      await page.goto('/bookings/test-booking-1/swap-specification');
      await expect(page.locator('h1:has-text("Swap Specification")')).toBeVisible();

      // Use browser back
      await page.goBack();
      await expect(page).toHaveURL('/bookings');

      // Use browser forward
      await page.goForward();
      await expect(page).toHaveURL('/bookings/test-booking-1/swap-specification');
      await expect(page.locator('h1:has-text("Swap Specification")')).toBeVisible();
    });

    test('should handle deep linking to swap specification', async ({ page }) => {
      // Direct navigation to swap specification URL
      await page.goto('/bookings/test-booking-1/swap-specification?returnTo=/bookings');

      // Should load swap specification page
      await expect(page.locator('h1:has-text("Swap Specification")')).toBeVisible();
      await expect(page.locator('text=Luxury Hotel Paris')).toBeVisible();

      // Should respect returnTo parameter
      await page.click('button:has-text("Back to Bookings")');
      await expect(page).toHaveURL('/bookings');
    });
  });

  test.describe('Error Handling', () => {
    test('should handle booking not found error', async ({ page }) => {
      // Mock booking not found
      await page.route('**/api/bookings/nonexistent-booking', async (route) => {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Booking not found' }),
        });
      });

      await page.goto('/bookings/nonexistent-booking/swap-specification');

      // Should show error state
      await expect(page.locator('.error-state')).toBeVisible();
      await expect(page.locator('text=Unable to Load Booking')).toBeVisible();
      await expect(page.locator('text=Booking not found')).toBeVisible();

      // Should provide return option
      await expect(page.locator('button:has-text("Return to Bookings")')).toBeVisible();
    });

    test('should handle access denied error', async ({ page }) => {
      // Mock access denied
      await page.route('**/api/bookings/test-booking-1', async (route) => {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Access denied' }),
        });
      });

      await page.goto('/bookings/test-booking-1/swap-specification');

      // Should show access denied error
      await expect(page.locator('text=Access denied')).toBeVisible();
      await expect(page.locator('button:has-text("Return to Bookings")')).toBeVisible();
    });

    test('should handle network errors gracefully', async ({ page }) => {
      // Mock network error
      await page.route('**/api/bookings/test-booking-1', async (route) => {
        await route.abort('failed');
      });

      await page.goto('/bookings/test-booking-1/swap-specification');

      // Should show network error
      await expect(page.locator('.error-state')).toBeVisible();
      await expect(page.locator('text=Failed to load booking data')).toBeVisible();
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('should work on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto('/bookings/test-booking-1/swap-specification');

      // Should show mobile-optimized layout
      await expect(page.locator('h1:has-text("Swap Specification")')).toBeVisible();
      await expect(page.locator('[data-testid="booking-context"]')).toBeVisible();

      // Should have mobile-friendly navigation
      await expect(page.locator('button:has-text("Back to Bookings")')).toBeVisible();

      // Should handle mobile interactions
      await page.tap('input[type="checkbox"]:near(:text("Enable Swapping"))');
      await expect(page.locator('input[type="checkbox"]:near(:text("Enable Swapping"))')).toBeChecked();
    });

    test('should handle touch gestures', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/bookings/test-booking-1/swap-specification');

      // Should handle tap interactions
      await page.tap('[data-testid="swap-configuration"]');
      await expect(page.locator('[data-testid="swap-preferences-section"]')).toBeVisible();

      // Should handle swipe gestures (if implemented)
      // This would depend on the specific swipe implementation
    });
  });

  test.describe('Accessibility', () => {
    test('should be keyboard navigable', async ({ page }) => {
      await page.goto('/bookings/test-booking-1/swap-specification');

      // Tab through interactive elements
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toContainText('Back to Bookings');

      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toHaveAttribute('type', 'checkbox');

      // Enter should activate focused element
      await page.keyboard.press('Enter');
      await expect(page.locator('input[type="checkbox"]:near(:text("Enable Swapping"))')).toBeChecked();
    });

    test('should have proper ARIA labels', async ({ page }) => {
      await page.goto('/bookings/test-booking-1/swap-specification');

      // Check main sections have proper labels
      await expect(page.locator('[data-testid="booking-context"]')).toHaveAttribute('role', 'region');
      await expect(page.locator('[data-testid="swap-configuration"]')).toHaveAttribute('role', 'region');

      // Check form elements have proper labels
      await expect(page.locator('input[type="checkbox"]:near(:text("Enable Swapping"))')).toHaveAttribute('aria-labelledby');
    });

    test('should announce changes to screen readers', async ({ page }) => {
      await page.goto('/bookings/test-booking-1/swap-specification');

      // Check for live regions
      await expect(page.locator('[aria-live="polite"]')).toBeVisible();

      // Enable swapping should trigger announcement
      await page.check('input[type="checkbox"]:near(:text("Enable Swapping"))');

      // Should announce the change (this would be tested with screen reader tools in practice)
      await expect(page.locator('[aria-live="polite"]')).toContainText('Swapping enabled');
    });
  });
});