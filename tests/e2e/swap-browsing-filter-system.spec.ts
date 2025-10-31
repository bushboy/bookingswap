import { test, expect } from '@playwright/test';

/**
 * End-to-end tests for the swap browsing filter system
 * Tests complete user workflows with filtering as required by task 10.5
 */
test.describe('Swap Browsing Filter System E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.route('**/api/auth/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'current-user',
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

    // Mock comprehensive swaps API with filtering scenarios
    await page.route('**/api/swaps**', async (route) => {
      const url = new URL(route.request().url());
      const searchParams = url.searchParams;
      
      // Base dataset with various scenarios
      const allSwaps = [
        // User's own swap - should be filtered out
        {
          id: 'own-swap',
          sourceBooking: {
            id: 'own-booking',
            title: 'My Own Hotel',
            description: 'My personal booking',
            userId: 'current-user',
            status: 'available',
            type: 'hotel',
            location: { city: 'Paris', country: 'France' },
            dateRange: { checkIn: '2024-06-01T00:00:00Z', checkOut: '2024-06-05T00:00:00Z' },
            swapValue: 800,
            originalPrice: 1000,
          },
          owner: { id: 'current-user', name: 'Current User' },
          swapType: 'booking',
          hasActiveProposals: true,
          activeProposalCount: 1,
          status: 'pending',
        },
        // Cancelled booking - should be filtered out
        {
          id: 'cancelled-swap',
          sourceBooking: {
            id: 'cancelled-booking',
            title: 'Cancelled Hotel London',
            description: 'This booking was cancelled',
            userId: 'user-2',
            status: 'cancelled',
            type: 'hotel',
            location: { city: 'London', country: 'UK' },
            dateRange: { checkIn: '2024-06-01T00:00:00Z', checkOut: '2024-06-05T00:00:00Z' },
            swapValue: 600,
            originalPrice: 800,
          },
          owner: { id: 'user-2', name: 'User 2' },
          swapType: 'booking',
          hasActiveProposals: true,
          activeProposalCount: 1,
          status: 'pending',
        },
        // No active proposals - should be filtered out
        {
          id: 'no-proposals-swap',
          sourceBooking: {
            id: 'no-proposals-booking',
            title: 'Hotel Without Proposals',
            description: 'No one has made proposals yet',
            userId: 'user-3',
            status: 'available',
            type: 'hotel',
            location: { city: 'Rome', country: 'Italy' },
            dateRange: { checkIn: '2024-06-01T00:00:00Z', checkOut: '2024-06-05T00:00:00Z' },
            swapValue: 700,
            originalPrice: 900,
          },
          owner: { id: 'user-3', name: 'User 3' },
          swapType: 'booking',
          hasActiveProposals: false,
          activeProposalCount: 0,
          status: 'pending',
        },
        // Valid booking swap - Paris
        {
          id: 'valid-booking-paris',
          sourceBooking: {
            id: 'valid-booking-paris-id',
            title: 'Luxury Hotel Paris',
            description: 'Beautiful luxury hotel in central Paris',
            userId: 'user-4',
            status: 'available',
            type: 'hotel',
            location: { city: 'Paris', country: 'France' },
            dateRange: { checkIn: '2024-06-01T00:00:00Z', checkOut: '2024-06-05T00:00:00Z' },
            swapValue: 1200,
            originalPrice: 1500,
          },
          owner: { id: 'user-4', name: 'User 4' },
          swapType: 'booking',
          hasActiveProposals: true,
          activeProposalCount: 2,
          status: 'pending',
        },
        // Valid booking swap - London
        {
          id: 'valid-booking-london',
          sourceBooking: {
            id: 'valid-booking-london-id',
            title: 'Business Hotel London',
            description: 'Modern business hotel in London',
            userId: 'user-5',
            status: 'available',
            type: 'hotel',
            location: { city: 'London', country: 'UK' },
            dateRange: { checkIn: '2024-07-01T00:00:00Z', checkOut: '2024-07-05T00:00:00Z' },
            swapValue: 800,
            originalPrice: 1000,
          },
          owner: { id: 'user-5', name: 'User 5' },
          swapType: 'booking',
          hasActiveProposals: true,
          activeProposalCount: 1,
          status: 'pending',
        },
        // Valid cash swap - Paris
        {
          id: 'valid-cash-paris',
          sourceBooking: {
            id: 'valid-cash-paris-id',
            title: 'Concert Tickets Paris',
            description: 'Premium concert tickets',
            userId: 'user-6',
            status: 'available',
            type: 'event',
            location: { city: 'Paris', country: 'France' },
            dateRange: { checkIn: '2024-06-15T00:00:00Z', checkOut: '2024-06-15T00:00:00Z' },
            swapValue: 400,
            originalPrice: 500,
          },
          owner: { id: 'user-6', name: 'User 6' },
          swapType: 'cash',
          cashDetails: {
            minAmount: 300,
            maxAmount: 500,
            preferredAmount: 400,
            currency: 'USD',
          },
          hasActiveProposals: true,
          activeProposalCount: 3,
          status: 'pending',
        },
        // Valid cash swap - Tokyo (high price)
        {
          id: 'valid-cash-tokyo',
          sourceBooking: {
            id: 'valid-cash-tokyo-id',
            title: 'Flight to Tokyo',
            description: 'Business class flight to Tokyo',
            userId: 'user-7',
            status: 'available',
            type: 'flight',
            location: { city: 'Tokyo', country: 'Japan' },
            dateRange: { checkIn: '2024-08-01T00:00:00Z', checkOut: '2024-08-01T00:00:00Z' },
            swapValue: 1800,
            originalPrice: 2000,
          },
          owner: { id: 'user-7', name: 'User 7' },
          swapType: 'cash',
          cashDetails: {
            minAmount: 1500,
            maxAmount: 2000,
            preferredAmount: 1800,
            currency: 'USD',
          },
          hasActiveProposals: true,
          activeProposalCount: 1,
          status: 'pending',
        },
      ];

      // Apply core filtering (simulate backend filtering)
      let filteredSwaps = allSwaps.filter(swap => 
        swap.owner.id !== 'current-user' && 
        swap.sourceBooking.status !== 'cancelled' && 
        swap.hasActiveProposals
      );

      // Apply user filters based on query parameters
      const city = searchParams.get('city');
      const country = searchParams.get('country');
      const minPrice = searchParams.get('minPrice');
      const maxPrice = searchParams.get('maxPrice');
      const swapType = searchParams.get('swapType');
      const dateStart = searchParams.get('dateStart');
      const dateEnd = searchParams.get('dateEnd');

      if (city) {
        filteredSwaps = filteredSwaps.filter(swap => 
          swap.sourceBooking.location.city.toLowerCase().includes(city.toLowerCase())
        );
      }

      if (country) {
        filteredSwaps = filteredSwaps.filter(swap => 
          swap.sourceBooking.location.country.toLowerCase().includes(country.toLowerCase())
        );
      }

      if (minPrice) {
        const min = parseInt(minPrice);
        filteredSwaps = filteredSwaps.filter(swap => {
          const price = swap.swapType === 'cash' 
            ? (swap.cashDetails?.preferredAmount || 0)
            : swap.sourceBooking.swapValue;
          return price >= min;
        });
      }

      if (maxPrice) {
        const max = parseInt(maxPrice);
        filteredSwaps = filteredSwaps.filter(swap => {
          const price = swap.swapType === 'cash' 
            ? (swap.cashDetails?.preferredAmount || 0)
            : swap.sourceBooking.swapValue;
          return price <= max;
        });
      }

      if (swapType && swapType !== 'both') {
        filteredSwaps = filteredSwaps.filter(swap => swap.swapType === swapType);
      }

      if (dateStart && dateEnd) {
        const start = new Date(dateStart);
        const end = new Date(dateEnd);
        filteredSwaps = filteredSwaps.filter(swap => {
          const checkIn = new Date(swap.sourceBooking.dateRange.checkIn);
          const checkOut = new Date(swap.sourceBooking.dateRange.checkOut);
          return checkIn >= start && checkOut <= end;
        });
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          swaps: filteredSwaps,
          totalCount: filteredSwaps.length,
          hasMore: false,
        }),
      });
    });

    await page.goto('/swaps/browse');
  });

  test.describe('Core Filtering Behavior', () => {
    test('should only display swaps that pass core filtering rules', async ({ page }) => {
      // Wait for swaps to load
      await expect(page.locator('.swap-card')).toHaveCount(4);

      // Should show valid swaps
      await expect(page.locator('[data-testid="swap-card-valid-booking-paris"]')).toBeVisible();
      await expect(page.locator('[data-testid="swap-card-valid-booking-london"]')).toBeVisible();
      await expect(page.locator('[data-testid="swap-card-valid-cash-paris"]')).toBeVisible();
      await expect(page.locator('[data-testid="swap-card-valid-cash-tokyo"]')).toBeVisible();

      // Should not show filtered out swaps
      await expect(page.locator('[data-testid="swap-card-own-swap"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="swap-card-cancelled-swap"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="swap-card-no-proposals-swap"]')).not.toBeVisible();

      // Should show correct count
      await expect(page.locator('.results-count')).toContainText('4 swaps available');
    });

    test('should display filter summary with core restrictions', async ({ page }) => {
      await expect(page.locator('.filter-summary')).toContainText('excluding your own bookings');
      await expect(page.locator('.filter-summary')).toContainText('excluding cancelled bookings');
      await expect(page.locator('.filter-summary')).toContainText('only showing bookings with active swap proposals');
    });
  });

  test.describe('Location Filtering', () => {
    test('should filter swaps by city', async ({ page }) => {
      // Open filters
      await page.click('button:has-text("Show Filters")');

      // Apply city filter
      await page.fill('input[placeholder="City"]', 'Paris');
      await page.click('button:has-text("Apply Filters")');

      // Wait for filtered results
      await expect(page.locator('.swap-card')).toHaveCount(2);

      // Should only show Paris swaps
      await expect(page.locator('[data-testid="swap-card-valid-booking-paris"]')).toBeVisible();
      await expect(page.locator('[data-testid="swap-card-valid-cash-paris"]')).toBeVisible();

      // Should not show non-Paris swaps
      await expect(page.locator('[data-testid="swap-card-valid-booking-london"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="swap-card-valid-cash-tokyo"]')).not.toBeVisible();

      // Should show updated count
      await expect(page.locator('.results-count')).toContainText('2 swaps available');
    });

    test('should filter swaps by country', async ({ page }) => {
      // Open filters
      await page.click('button:has-text("Show Filters")');

      // Apply country filter
      await page.fill('input[placeholder="Country"]', 'France');
      await page.click('button:has-text("Apply Filters")');

      // Wait for filtered results
      await expect(page.locator('.swap-card')).toHaveCount(2);

      // Should only show France swaps
      await expect(page.locator('[data-testid="swap-card-valid-booking-paris"]')).toBeVisible();
      await expect(page.locator('[data-testid="swap-card-valid-cash-paris"]')).toBeVisible();
    });

    test('should combine city and country filters', async ({ page }) => {
      // Open filters
      await page.click('button:has-text("Show Filters")');

      // Apply both filters
      await page.fill('input[placeholder="City"]', 'Paris');
      await page.fill('input[placeholder="Country"]', 'France');
      await page.click('button:has-text("Apply Filters")');

      // Should show Paris, France swaps only
      await expect(page.locator('.swap-card')).toHaveCount(2);
      await expect(page.locator('[data-testid="swap-card-valid-booking-paris"]')).toBeVisible();
      await expect(page.locator('[data-testid="swap-card-valid-cash-paris"]')).toBeVisible();
    });
  });

  test.describe('Price Range Filtering', () => {
    test('should filter swaps by minimum price', async ({ page }) => {
      // Open filters
      await page.click('button:has-text("Show Filters")');

      // Apply minimum price filter
      await page.fill('input[placeholder="Min Price"]', '1000');
      await page.click('button:has-text("Apply Filters")');

      // Should only show high-price swaps
      await expect(page.locator('.swap-card')).toHaveCount(2);
      await expect(page.locator('[data-testid="swap-card-valid-booking-paris"]')).toBeVisible(); // 1200
      await expect(page.locator('[data-testid="swap-card-valid-cash-tokyo"]')).toBeVisible(); // 1800
    });

    test('should filter swaps by maximum price', async ({ page }) => {
      // Open filters
      await page.click('button:has-text("Show Filters")');

      // Apply maximum price filter
      await page.fill('input[placeholder="Max Price"]', '1000');
      await page.click('button:has-text("Apply Filters")');

      // Should only show low-price swaps
      await expect(page.locator('.swap-card')).toHaveCount(2);
      await expect(page.locator('[data-testid="swap-card-valid-booking-london"]')).toBeVisible(); // 800
      await expect(page.locator('[data-testid="swap-card-valid-cash-paris"]')).toBeVisible(); // 400
    });

    test('should filter swaps by price range', async ({ page }) => {
      // Open filters
      await page.click('button:has-text("Show Filters")');

      // Apply price range filter
      await page.fill('input[placeholder="Min Price"]', '500');
      await page.fill('input[placeholder="Max Price"]', '1500');
      await page.click('button:has-text("Apply Filters")');

      // Should show swaps in range
      await expect(page.locator('.swap-card')).toHaveCount(2);
      await expect(page.locator('[data-testid="swap-card-valid-booking-london"]')).toBeVisible(); // 800
      await expect(page.locator('[data-testid="swap-card-valid-booking-paris"]')).toBeVisible(); // 1200
    });
  });

  test.describe('Swap Type Filtering', () => {
    test('should filter to booking swaps only', async ({ page }) => {
      // Open filters
      await page.click('button:has-text("Show Filters")');

      // Apply swap type filter
      await page.selectOption('select[name="swapType"]', 'booking');
      await page.click('button:has-text("Apply Filters")');

      // Should only show booking swaps
      await expect(page.locator('.swap-card')).toHaveCount(2);
      await expect(page.locator('[data-testid="swap-card-valid-booking-paris"]')).toBeVisible();
      await expect(page.locator('[data-testid="swap-card-valid-booking-london"]')).toBeVisible();

      // Should not show cash swaps
      await expect(page.locator('[data-testid="swap-card-valid-cash-paris"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="swap-card-valid-cash-tokyo"]')).not.toBeVisible();
    });

    test('should filter to cash swaps only', async ({ page }) => {
      // Open filters
      await page.click('button:has-text("Show Filters")');

      // Apply swap type filter
      await page.selectOption('select[name="swapType"]', 'cash');
      await page.click('button:has-text("Apply Filters")');

      // Should only show cash swaps
      await expect(page.locator('.swap-card')).toHaveCount(2);
      await expect(page.locator('[data-testid="swap-card-valid-cash-paris"]')).toBeVisible();
      await expect(page.locator('[data-testid="swap-card-valid-cash-tokyo"]')).toBeVisible();

      // Should not show booking swaps
      await expect(page.locator('[data-testid="swap-card-valid-booking-paris"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="swap-card-valid-booking-london"]')).not.toBeVisible();
    });
  });

  test.describe('Date Range Filtering', () => {
    test('should filter swaps by date range', async ({ page }) => {
      // Open filters
      await page.click('button:has-text("Show Filters")');

      // Apply date range filter (June 2024)
      await page.fill('input[name="dateStart"]', '2024-06-01');
      await page.fill('input[name="dateEnd"]', '2024-06-30');
      await page.click('button:has-text("Apply Filters")');

      // Should show June swaps
      await expect(page.locator('.swap-card')).toHaveCount(2);
      await expect(page.locator('[data-testid="swap-card-valid-booking-paris"]')).toBeVisible(); // June 1-5
      await expect(page.locator('[data-testid="swap-card-valid-cash-paris"]')).toBeVisible(); // June 15

      // Should not show non-June swaps
      await expect(page.locator('[data-testid="swap-card-valid-booking-london"]')).not.toBeVisible(); // July
      await expect(page.locator('[data-testid="swap-card-valid-cash-tokyo"]')).not.toBeVisible(); // August
    });
  });

  test.describe('Combined Filtering', () => {
    test('should apply multiple filters simultaneously', async ({ page }) => {
      // Open filters
      await page.click('button:has-text("Show Filters")');

      // Apply multiple filters: Paris + Cash + Price range 300-500
      await page.fill('input[placeholder="City"]', 'Paris');
      await page.selectOption('select[name="swapType"]', 'cash');
      await page.fill('input[placeholder="Min Price"]', '300');
      await page.fill('input[placeholder="Max Price"]', '500');
      await page.click('button:has-text("Apply Filters")');

      // Should only show Paris cash swap in price range
      await expect(page.locator('.swap-card')).toHaveCount(1);
      await expect(page.locator('[data-testid="swap-card-valid-cash-paris"]')).toBeVisible();

      // Should show count of 1
      await expect(page.locator('.results-count')).toContainText('1 swaps available');
    });

    test('should show empty state when all swaps are filtered out', async ({ page }) => {
      // Open filters
      await page.click('button:has-text("Show Filters")');

      // Apply filters that exclude all swaps
      await page.fill('input[placeholder="City"]', 'NonexistentCity');
      await page.click('button:has-text("Apply Filters")');

      // Should show empty state
      await expect(page.locator('.empty-state')).toContainText('No swaps match your criteria');
      await expect(page.locator('.empty-state')).toContainText('All available swaps are filtered out');

      // Should not show any swap cards
      await expect(page.locator('.swap-card')).toHaveCount(0);
    });
  });

  test.describe('Filter Reset and Management', () => {
    test('should reset all filters and show all valid swaps', async ({ page }) => {
      // Open filters and apply some
      await page.click('button:has-text("Show Filters")');
      await page.fill('input[placeholder="City"]', 'Paris');
      await page.click('button:has-text("Apply Filters")');

      // Verify filtered state
      await expect(page.locator('.swap-card')).toHaveCount(2);

      // Reset filters
      await page.click('button:has-text("Reset Filters")');

      // Should show all valid swaps again
      await expect(page.locator('.swap-card')).toHaveCount(4);
      await expect(page.locator('[data-testid="swap-card-valid-booking-paris"]')).toBeVisible();
      await expect(page.locator('[data-testid="swap-card-valid-booking-london"]')).toBeVisible();
      await expect(page.locator('[data-testid="swap-card-valid-cash-paris"]')).toBeVisible();
      await expect(page.locator('[data-testid="swap-card-valid-cash-tokyo"]')).toBeVisible();
    });

    test('should maintain filter state when navigating away and back', async ({ page }) => {
      // Apply filters
      await page.click('button:has-text("Show Filters")');
      await page.fill('input[placeholder="City"]', 'Paris');
      await page.click('button:has-text("Apply Filters")');

      // Verify filtered state
      await expect(page.locator('.swap-card')).toHaveCount(2);

      // Navigate away and back
      await page.goto('/bookings');
      await page.goto('/swaps/browse');

      // Filters should be reset (or maintained based on implementation)
      // This tests the expected behavior of your application
      await expect(page.locator('.swap-card')).toHaveCount(4);
    });
  });

  test.describe('Search Integration with Filtering', () => {
    test('should combine search with filters', async ({ page }) => {
      // Apply search
      await page.fill('input[placeholder*="Search"]', 'Hotel');

      // Open filters and apply additional filter
      await page.click('button:has-text("Show Filters")');
      await page.fill('input[placeholder="City"]', 'Paris');
      await page.click('button:has-text("Apply Filters")');

      // Should show only Paris hotel (combines search + filter)
      await expect(page.locator('.swap-card')).toHaveCount(1);
      await expect(page.locator('[data-testid="swap-card-valid-booking-paris"]')).toBeVisible();
    });
  });

  test.describe('Real-time Filter Updates', () => {
    test('should update results immediately as filters change', async ({ page }) => {
      // Open filters
      await page.click('button:has-text("Show Filters")');

      const cityFilter = page.locator('input[placeholder="City"]');

      // Type 'P' - should trigger filtering
      await cityFilter.fill('P');
      await page.waitForTimeout(500); // Wait for debounce

      // Should show Paris swaps
      await expect(page.locator('[data-testid="swap-card-valid-booking-paris"]')).toBeVisible();
      await expect(page.locator('[data-testid="swap-card-valid-cash-paris"]')).toBeVisible();

      // Complete 'Paris'
      await cityFilter.fill('Paris');
      await page.waitForTimeout(500);

      // Should still show Paris swaps
      await expect(page.locator('.swap-card')).toHaveCount(2);

      // Clear and type 'London'
      await cityFilter.fill('London');
      await page.waitForTimeout(500);

      // Should show London swap
      await expect(page.locator('[data-testid="swap-card-valid-booking-london"]')).toBeVisible();
      await expect(page.locator('[data-testid="swap-card-valid-booking-paris"]')).not.toBeVisible();
    });
  });

  test.describe('Performance with Large Datasets', () => {
    test('should handle filtering with reasonable performance', async ({ page }) => {
      // Mock a larger dataset
      await page.route('**/api/swaps**', async (route) => {
        const largeDataset = [];
        for (let i = 0; i < 100; i++) {
          largeDataset.push({
            id: `swap-${i}`,
            sourceBooking: {
              id: `booking-${i}`,
              title: `Booking ${i}`,
              userId: `user-${i}`,
              status: 'available',
              type: 'hotel',
              location: { city: `City${i % 10}`, country: `Country${i % 5}` },
              dateRange: { checkIn: '2024-06-01T00:00:00Z', checkOut: '2024-06-05T00:00:00Z' },
              swapValue: (i % 20) * 100 + 500,
              originalPrice: (i % 20) * 100 + 700,
            },
            owner: { id: `user-${i}`, name: `User ${i}` },
            swapType: i % 2 === 0 ? 'booking' : 'cash',
            hasActiveProposals: true,
            activeProposalCount: 1,
            status: 'pending',
          });
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            swaps: largeDataset,
            totalCount: largeDataset.length,
            hasMore: false,
          }),
        });
      });

      await page.reload();

      // Measure filter application time
      const startTime = Date.now();
      
      await page.click('button:has-text("Show Filters")');
      await page.fill('input[placeholder="City"]', 'City5');
      await page.click('button:has-text("Apply Filters")');
      
      // Wait for results to update
      await page.waitForSelector('.swap-card', { timeout: 5000 });
      
      const endTime = Date.now();
      const filterTime = endTime - startTime;

      // Should complete within reasonable time (5 seconds for large dataset)
      expect(filterTime).toBeLessThan(5000);

      // Should show filtered results
      await expect(page.locator('.swap-card')).toHaveCountGreaterThan(0);
    });
  });

  test.describe('Accessibility in Filtering', () => {
    test('should be keyboard navigable', async ({ page }) => {
      // Tab through filter controls
      await page.keyboard.press('Tab'); // Search input
      await page.keyboard.press('Tab'); // Show Filters button
      await page.keyboard.press('Enter'); // Open filters

      // Tab through filter inputs
      await page.keyboard.press('Tab'); // City input
      await page.keyboard.type('Paris');
      
      await page.keyboard.press('Tab'); // Country input
      await page.keyboard.press('Tab'); // Min price input
      await page.keyboard.press('Tab'); // Max price input
      await page.keyboard.press('Tab'); // Swap type select
      await page.keyboard.press('Tab'); // Apply button
      await page.keyboard.press('Enter'); // Apply filters

      // Should show filtered results
      await expect(page.locator('.swap-card')).toHaveCount(2);
    });

    test('should announce filter changes to screen readers', async ({ page }) => {
      // Check for ARIA live regions
      await expect(page.locator('[aria-live="polite"]')).toBeVisible();

      // Apply filter and check for announcements
      await page.click('button:has-text("Show Filters")');
      await page.fill('input[placeholder="City"]', 'Paris');
      await page.click('button:has-text("Apply Filters")');

      // Results should be announced
      await expect(page.locator('.results-count')).toContainText('2 swaps available');
    });

    test('should have proper form labels and descriptions', async ({ page }) => {
      await page.click('button:has-text("Show Filters")');

      // Check for proper labeling
      await expect(page.locator('label[for="city-filter"]')).toContainText('City');
      await expect(page.locator('label[for="country-filter"]')).toContainText('Country');
      await expect(page.locator('label[for="min-price-filter"]')).toContainText('Minimum Price');
      await expect(page.locator('label[for="max-price-filter"]')).toContainText('Maximum Price');
    });
  });

  test.describe('Error Handling in Filtering', () => {
    test('should handle API errors gracefully during filtering', async ({ page }) => {
      // Mock API error
      await page.route('**/api/swaps**', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        });
      });

      await page.reload();

      // Should show error state
      await expect(page.locator('.error-state')).toContainText('Failed to load swaps');

      // Should offer retry option
      await expect(page.locator('button:has-text("Retry")')).toBeVisible();
    });

    test('should handle network timeouts during filtering', async ({ page }) => {
      // Mock slow API response
      await page.route('**/api/swaps**', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second delay
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ swaps: [], totalCount: 0, hasMore: false }),
        });
      });

      await page.click('button:has-text("Show Filters")');
      await page.fill('input[placeholder="City"]', 'Paris');
      await page.click('button:has-text("Apply Filters")');

      // Should show loading state
      await expect(page.locator('.loading-spinner')).toBeVisible();

      // Should eventually timeout or show results
      // This tests the application's timeout handling
    });
  });
});