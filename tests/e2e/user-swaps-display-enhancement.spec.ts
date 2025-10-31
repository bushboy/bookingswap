import { test, expect } from '@playwright/test';
import { MockServices } from './fixtures/mock-services';

test.describe('User Swaps Display Enhancement - Integration Tests', () => {
    let mockServices: MockServices;

    test.beforeEach(async ({ page }) => {
        mockServices = new MockServices(page);
        await mockServices.setupAllMocks();

        // Mock enhanced swaps API with complete booking details
        await page.route('**/api/swaps', async (route) => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify([
                        {
                            id: 'swap-001',
                            sourceBookingId: 'booking-hotel-001',
                            targetBookingId: 'booking-event-002',
                            status: 'pending',
                            proposerId: 'user-alice-123',
                            ownerId: 'user-bob-456',
                            createdAt: '2024-01-15T10:00:00Z',
                            terms: {
                                conditions: ['Valid ID required', 'Non-refundable after acceptance'],
                                expiresAt: '2024-12-31T23:59:59Z',
                            },
                            // Enhanced booking details from backend
                            sourceBooking: {
                                id: 'booking-hotel-001',
                                title: 'Luxury Hotel Suite in Paris',
                                location: {
                                    city: 'Paris',
                                    country: 'France',
                                },
                                dateRange: {
                                    checkIn: '2024-12-20T00:00:00Z',
                                    checkOut: '2024-12-25T00:00:00Z',
                                },
                                originalPrice: 1200,
                                swapValue: 1000,
                            },
                            targetBooking: {
                                id: 'booking-event-002',
                                title: 'Concert Tickets - The Beatles Tribute',
                                location: {
                                    city: 'London',
                                    country: 'UK',
                                },
                                dateRange: {
                                    checkIn: '2024-12-22T00:00:00Z',
                                    checkOut: '2024-12-22T00:00:00Z',
                                },
                                originalPrice: 800,
                                swapValue: 900,
                            },
                        },
                        {
                            id: 'swap-002',
                            sourceBookingId: 'booking-hotel-003',
                            targetBookingId: null, // Open swap
                            status: 'pending',
                            proposerId: 'user-alice-123',
                            ownerId: 'user-alice-123',
                            createdAt: '2024-01-16T14:30:00Z',
                            acceptanceStrategy: {
                                type: 'auction',
                            },
                            auctionId: 'auction-001',
                            sourceBooking: {
                                id: 'booking-hotel-003',
                                title: 'Beach Resort Villa',
                                location: {
                                    city: 'Miami',
                                    country: 'USA',
                                },
                                dateRange: {
                                    checkIn: '2024-07-01T00:00:00Z',
                                    checkOut: '2024-07-07T00:00:00Z',
                                },
                                originalPrice: 2500,
                                swapValue: 2200,
                            },
                            targetBooking: null,
                        },
                        {
                            id: 'swap-003',
                            sourceBookingId: 'booking-incomplete-001',
                            targetBookingId: 'booking-incomplete-002',
                            status: 'accepted',
                            proposerId: 'user-alice-123',
                            ownerId: 'user-bob-456',
                            createdAt: '2024-01-10T09:15:00Z',
                            acceptedAt: '2024-01-12T16:45:00Z',
                            // Test incomplete booking details scenario
                            sourceBooking: {
                                id: 'booking-incomplete-001',
                                title: null, // Missing title
                                location: {
                                    city: null, // Missing city
                                    country: 'Spain',
                                },
                                dateRange: {
                                    checkIn: '2024-08-15T00:00:00Z',
                                    checkOut: null, // Missing checkout date
                                },
                                originalPrice: null, // Missing price
                                swapValue: 800,
                            },
                            targetBooking: {
                                id: 'booking-incomplete-002',
                                title: 'Mountain Cabin Retreat',
                                location: {
                                    city: 'Aspen',
                                    country: null, // Missing country
                                },
                                dateRange: {
                                    checkIn: '2024-08-15T00:00:00Z',
                                    checkOut: '2024-08-20T00:00:00Z',
                                },
                                originalPrice: 1500,
                                swapValue: 1400,
                            },
                        },
                    ]),
                });
            }
        });

        // Mock authentication
        await page.route('**/api/auth/**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    user: {
                        id: 'user-alice-123',
                        username: 'alice',
                        email: 'alice@example.com',
                        profile: {
                            firstName: 'Alice',
                            lastName: 'Johnson',
                            verification: { status: 'verified' },
                        },
                    },
                    token: 'mock-jwt-token',
                }),
            });
        });

        await page.goto('/');
        await page.click('[data-testid="connect-wallet-button"]');
        await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
    });

    test.describe('8.1 Complete User Flow Testing', () => {
        test('should display booking details correctly in user swaps page', async ({ page }) => {
            // Navigate to user swaps page
            await page.goto('/swaps');

            // Wait for swaps to load
            await expect(page.locator('[data-testid="swap-card"]').first()).toBeVisible();

            // Verify first swap displays complete booking details
            const firstSwap = page.locator('[data-testid="swap-card"]').first();

            // Check source booking details
            await expect(firstSwap.locator('[data-testid="source-booking-title"]')).toContainText('Luxury Hotel Suite in Paris');
            await expect(firstSwap.locator('[data-testid="source-booking-location"]')).toContainText('Paris, France');
            await expect(firstSwap.locator('[data-testid="source-booking-dates"]')).toContainText('12/20/2024 - 12/25/2024');
            await expect(firstSwap.locator('[data-testid="source-booking-value"]')).toContainText('1,000');

            // Check target booking details
            await expect(firstSwap.locator('[data-testid="target-booking-title"]')).toContainText('Concert Tickets - The Beatles Tribute');
            await expect(firstSwap.locator('[data-testid="target-booking-location"]')).toContainText('London, UK');
            await expect(firstSwap.locator('[data-testid="target-booking-dates"]')).toContainText('12/22/2024 - 12/22/2024');
            await expect(firstSwap.locator('[data-testid="target-booking-value"]')).toContainText('900');

            // Verify swap conditions are displayed
            await expect(firstSwap.locator('[data-testid="swap-conditions"]')).toContainText('Valid ID required');
            await expect(firstSwap.locator('[data-testid="swap-conditions"]')).toContainText('Non-refundable after acceptance');
        });

        test('should handle open swaps (auction mode) correctly', async ({ page }) => {
            await page.goto('/swaps');

            // Find the auction swap
            const auctionSwap = page.locator('[data-testid="swap-card"]').nth(1);

            // Verify auction mode indicators
            await expect(auctionSwap.locator('[data-testid="swap-mode-indicator"]')).toContainText('🏆');
            await expect(auctionSwap.locator('[data-testid="target-booking-section"]')).toContainText('Auction Mode');
            await expect(auctionSwap.locator('[data-testid="auction-description"]')).toContainText('Collecting proposals via auction');

            // Verify auction button is present
            await expect(auctionSwap.locator('[data-testid="view-auction-button"]')).toBeVisible();

            // Source booking should still display correctly
            await expect(auctionSwap.locator('[data-testid="source-booking-title"]')).toContainText('Beach Resort Villa');
            await expect(auctionSwap.locator('[data-testid="source-booking-location"]')).toContainText('Miami, USA');
        });

        test('should display different swap states correctly', async ({ page }) => {
            await page.goto('/swaps');

            // Test pending swap
            const pendingSwap = page.locator('[data-testid="swap-card"]').first();
            await expect(pendingSwap.locator('[data-testid="status-badge"]')).toContainText('pending');
            await expect(pendingSwap.locator('[data-testid="accept-button"]')).toBeVisible();
            await expect(pendingSwap.locator('[data-testid="decline-button"]')).toBeVisible();

            // Test accepted swap
            const acceptedSwap = page.locator('[data-testid="swap-card"]').nth(2);
            await expect(acceptedSwap.locator('[data-testid="status-badge"]')).toContainText('accepted');
            await expect(acceptedSwap.locator('[data-testid="complete-swap-button"]')).toBeVisible();
        });

        test('should filter swaps by status correctly', async ({ page }) => {
            await page.goto('/swaps');

            // Initially should show all swaps
            await expect(page.locator('[data-testid="swap-card"]')).toHaveCount(3);

            // Filter by pending
            await page.click('[data-testid="pending-tab"]');
            await expect(page.locator('[data-testid="swap-card"]')).toHaveCount(2);

            // Filter by accepted
            await page.click('[data-testid="accepted-tab"]');
            await expect(page.locator('[data-testid="swap-card"]')).toHaveCount(1);
            await expect(page.locator('[data-testid="status-badge"]')).toContainText('accepted');

            // Back to all
            await page.click('[data-testid="all-tab"]');
            await expect(page.locator('[data-testid="swap-card"]')).toHaveCount(3);
        });

        test('should handle swap actions correctly', async ({ page }) => {
            // Mock swap acceptance
            await page.route('**/api/swaps/*/accept', async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ success: true, message: 'Swap accepted successfully' }),
                });
            });

            await page.goto('/swaps');

            const pendingSwap = page.locator('[data-testid="swap-card"]').first();

            // Accept swap
            await pendingSwap.locator('[data-testid="accept-button"]').click();

            // Verify success message
            await expect(page.locator('[data-testid="success-toast"]')).toContainText('Swap accepted successfully');
        });

        test('should navigate to swap completion correctly', async ({ page }) => {
            await page.goto('/swaps');

            const acceptedSwap = page.locator('[data-testid="swap-card"]').nth(2);

            // Click complete swap button
            await acceptedSwap.locator('[data-testid="complete-swap-button"]').click();

            // Should navigate to completion page
            await expect(page).toHaveURL(/\/swaps\/swap-003\/complete/);
        });

        test('should refresh swaps data correctly', async ({ page }) => {
            await page.goto('/swaps');

            // Wait for initial load
            await expect(page.locator('[data-testid="swap-card"]')).toHaveCount(3);

            // Click refresh button
            await page.click('[data-testid="refresh-button"]');

            // Should show loading state
            await expect(page.locator('[data-testid="refresh-button"]')).toContainText('Refreshing...');

            // Should reload data
            await expect(page.locator('[data-testid="swap-card"]')).toHaveCount(3);
            await expect(page.locator('[data-testid="refresh-button"]')).toContainText('🔄 Refresh');
        });
    });
});
test.
    describe('8.2 Data Consistency Validation', () => {
        test('should format location consistently with browse swaps page', async ({ page }) => {
            // Mock browse swaps data for comparison
            await page.route('**/api/swaps/browse', async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify([
                        {
                            id: 'browse-swap-001',
                            sourceBooking: {
                                id: 'booking-browse-001',
                                title: 'Test Hotel for Browse',
                                location: {
                                    city: 'Paris',
                                    country: 'France',
                                },
                                dateRange: {
                                    checkIn: '2024-12-20T00:00:00Z',
                                    checkOut: '2024-12-25T00:00:00Z',
                                },
                                originalPrice: 1200,
                                swapValue: 1000,
                            },
                        },
                    ]),
                });
            });

            // Check user swaps page formatting
            await page.goto('/swaps');
            const userSwapLocation = await page.locator('[data-testid="source-booking-location"]').first().textContent();
            expect(userSwapLocation).toBe('📍 Paris, France');

            // Check browse swaps page formatting (if it exists)
            // This would be implemented when browse swaps page is available
            // For now, we verify the format matches the expected "City, Country" pattern
            expect(userSwapLocation).toMatch(/📍 \w+, \w+/);
        });

        test('should format dates consistently across pages', async ({ page }) => {
            await page.goto('/swaps');

            // Check date format in user swaps
            const dateText = await page.locator('[data-testid="source-booking-dates"]').first().textContent();

            // Should be in MM/DD/YYYY - MM/DD/YYYY format
            expect(dateText).toMatch(/📅 \d{1,2}\/\d{1,2}\/\d{4} - \d{1,2}\/\d{1,2}\/\d{4}/);

            // Verify specific date formatting
            expect(dateText).toBe('📅 12/20/2024 - 12/25/2024');
        });

        test('should format monetary amounts consistently', async ({ page }) => {
            await page.goto('/swaps');

            // Check monetary formatting
            const valueText = await page.locator('[data-testid="source-booking-value"]').first().textContent();

            // Should include currency symbol and thousand separators
            expect(valueText).toMatch(/💰 \d{1,3}(,\d{3})*/);
            expect(valueText).toBe('💰 1,000');

            // Check higher value formatting
            const highValueSwap = page.locator('[data-testid="swap-card"]').nth(1);
            const highValueText = await highValueSwap.locator('[data-testid="source-booking-value"]').textContent();
            expect(highValueText).toBe('💰 2,200');
        });

        test('should handle missing booking data gracefully', async ({ page }) => {
            await page.goto('/swaps');

            // Find the swap with incomplete data
            const incompleteSwap = page.locator('[data-testid="swap-card"]').nth(2);

            // Check fallback values for missing data
            await expect(incompleteSwap.locator('[data-testid="source-booking-title"]')).toContainText('Booking booking-incomplete-001');
            await expect(incompleteSwap.locator('[data-testid="source-booking-location"]')).toContainText('Unknown, Spain');
            await expect(incompleteSwap.locator('[data-testid="source-booking-dates"]')).toContainText('8/15/2024 - Unknown dates');
            await expect(incompleteSwap.locator('[data-testid="source-booking-value"]')).toContainText('800');

            // Check warning indicators for missing data
            await expect(incompleteSwap.locator('[data-testid="data-warning"]')).toContainText('⚠️ Some booking details are unavailable');
        });

        test('should display appropriate fallback text for null booking details', async ({ page }) => {
            await page.goto('/swaps');

            // Check open swap (null target booking)
            const openSwap = page.locator('[data-testid="swap-card"]').nth(1);

            await expect(openSwap.locator('[data-testid="target-booking-section"]')).toContainText('Awaiting Proposals');
            await expect(openSwap.locator('[data-testid="auction-description"]')).toContainText('⏳ Collecting proposals via auction');
        });

        test('should maintain consistent styling across different swap states', async ({ page }) => {
            await page.goto('/swaps');

            // Check that all swap cards have consistent structure
            const swapCards = page.locator('[data-testid="swap-card"]');
            const cardCount = await swapCards.count();

            for (let i = 0; i < cardCount; i++) {
                const card = swapCards.nth(i);

                // Each card should have these elements
                await expect(card.locator('[data-testid="source-booking-section"]')).toBeVisible();
                await expect(card.locator('[data-testid="swap-arrow"]')).toBeVisible();
                await expect(card.locator('[data-testid="status-badge"]')).toBeVisible();
                await expect(card.locator('[data-testid="proposed-date"]')).toBeVisible();
            }
        });

        test('should handle edge cases in date formatting', async ({ page }) => {
            // Mock swap with edge case dates
            await page.route('**/api/swaps', async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify([
                        {
                            id: 'swap-edge-case',
                            sourceBookingId: 'booking-edge-001',
                            targetBookingId: 'booking-edge-002',
                            status: 'pending',
                            proposerId: 'user-alice-123',
                            ownerId: 'user-bob-456',
                            createdAt: '2024-01-15T10:00:00Z',
                            sourceBooking: {
                                id: 'booking-edge-001',
                                title: 'Same Day Event',
                                location: {
                                    city: 'New York',
                                    country: 'USA',
                                },
                                dateRange: {
                                    checkIn: '2024-12-31T00:00:00Z',
                                    checkOut: '2024-12-31T00:00:00Z', // Same day
                                },
                                originalPrice: 500,
                                swapValue: 500,
                            },
                            targetBooking: {
                                id: 'booking-edge-002',
                                title: 'Long Stay Booking',
                                location: {
                                    city: 'Tokyo',
                                    country: 'Japan',
                                },
                                dateRange: {
                                    checkIn: '2024-01-01T00:00:00Z',
                                    checkOut: '2024-12-31T00:00:00Z', // Year-long stay
                                },
                                originalPrice: 50000,
                                swapValue: 45000,
                            },
                        },
                    ]),
                });
            });

            await page.goto('/swaps');

            // Check same-day event formatting
            await expect(page.locator('[data-testid="source-booking-dates"]')).toContainText('12/31/2024 - 12/31/2024');

            // Check long stay formatting
            await expect(page.locator('[data-testid="target-booking-dates"]')).toContainText('1/1/2024 - 12/31/2024');

            // Check high value formatting
            await expect(page.locator('[data-testid="target-booking-value"]')).toContainText('45,000');
        });

        test('should handle network errors gracefully', async ({ page }) => {
            // Mock network error
            await page.route('**/api/swaps', async (route) => {
                await route.abort('failed');
            });

            await page.goto('/swaps');

            // Should show error state
            await expect(page.locator('[data-testid="error-message"]')).toContainText('Failed to load swaps');
            await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();

            // Test retry functionality
            await page.unroute('**/api/swaps');
            await page.route('**/api/swaps', async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify([]),
                });
            });

            await page.click('[data-testid="retry-button"]');
            await expect(page.locator('[data-testid="empty-state"]')).toBeVisible();
        });

        test('should handle partial API response gracefully', async ({ page }) => {
            // Mock partial response with some missing booking details
            await page.route('**/api/swaps', async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify([
                        {
                            id: 'swap-partial',
                            sourceBookingId: 'booking-001',
                            targetBookingId: 'booking-002',
                            status: 'pending',
                            proposerId: 'user-alice-123',
                            ownerId: 'user-bob-456',
                            createdAt: '2024-01-15T10:00:00Z',
                            sourceBooking: {
                                id: 'booking-001',
                                title: 'Available Booking',
                                location: {
                                    city: 'Berlin',
                                    country: 'Germany',
                                },
                                dateRange: {
                                    checkIn: '2024-06-01T00:00:00Z',
                                    checkOut: '2024-06-05T00:00:00Z',
                                },
                                originalPrice: 800,
                                swapValue: 750,
                            },
                            targetBooking: null, // Booking details failed to load
                        },
                    ]),
                });
            });

            await page.goto('/swaps');

            // Should handle missing target booking gracefully
            await expect(page.locator('[data-testid="source-booking-title"]')).toContainText('Available Booking');
            await expect(page.locator('[data-testid="target-booking-section"]')).toContainText('Awaiting Proposals');
        });

        test('should validate data completeness indicators', async ({ page }) => {
            await page.goto('/swaps');

            // Find swap with incomplete data
            const incompleteSwap = page.locator('[data-testid="swap-card"]').nth(2);

            // Should show data completeness warnings
            await expect(incompleteSwap.locator('[data-testid="data-warning"]')).toBeVisible();
            await expect(incompleteSwap.locator('[data-testid="data-warning"]')).toContainText('Some booking details are unavailable');

            // Complete data swaps should not show warnings
            const completeSwap = page.locator('[data-testid="swap-card"]').first();
            await expect(completeSwap.locator('[data-testid="data-warning"]')).not.toBeVisible();
        });

        test('should maintain performance with large datasets', async ({ page }) => {
            // Mock large dataset
            const largeSwapList = Array.from({ length: 50 }, (_, i) => ({
                id: `swap-${i}`,
                sourceBookingId: `booking-${i}-source`,
                targetBookingId: `booking-${i}-target`,
                status: i % 3 === 0 ? 'pending' : i % 3 === 1 ? 'accepted' : 'completed',
                proposerId: 'user-alice-123',
                ownerId: 'user-bob-456',
                createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
                sourceBooking: {
                    id: `booking-${i}-source`,
                    title: `Hotel Booking ${i}`,
                    location: {
                        city: `City${i}`,
                        country: `Country${i}`,
                    },
                    dateRange: {
                        checkIn: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString(),
                        checkOut: new Date(Date.now() + (i + 5) * 24 * 60 * 60 * 1000).toISOString(),
                    },
                    originalPrice: 1000 + i * 100,
                    swapValue: 900 + i * 90,
                },
                targetBooking: {
                    id: `booking-${i}-target`,
                    title: `Event Booking ${i}`,
                    location: {
                        city: `EventCity${i}`,
                        country: `EventCountry${i}`,
                    },
                    dateRange: {
                        checkIn: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString(),
                        checkOut: new Date(Date.now() + (i + 2) * 24 * 60 * 60 * 1000).toISOString(),
                    },
                    originalPrice: 800 + i * 80,
                    swapValue: 750 + i * 75,
                },
            }));

            await page.route('**/api/swaps', async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(largeSwapList),
                });
            });

            const startTime = Date.now();
            await page.goto('/swaps');

            // Wait for content to load
            await expect(page.locator('[data-testid="swap-card"]').first()).toBeVisible();

            const loadTime = Date.now() - startTime;

            // Should load within reasonable time (5 seconds for large dataset)
            expect(loadTime).toBeLessThan(5000);

            // Should display all swaps or implement pagination
            const swapCount = await page.locator('[data-testid="swap-card"]').count();
            expect(swapCount).toBeGreaterThan(0);
            expect(swapCount).toBeLessThanOrEqual(50);
        });
    });
});