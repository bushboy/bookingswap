import { test, expect } from '@playwright/test';
import { MockServices } from '../fixtures/mock-services';

test.describe('Booking Management User Journey', () => {
  let mockServices: MockServices;

  test.beforeEach(async ({ page }) => {
    mockServices = new MockServices(page);
    await mockServices.setupAllMocks();
    
    // Login user
    await page.goto('/');
    await page.click('[data-testid="connect-wallet-button"]');
    await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
  });

  test('User can create, edit, and delete bookings', async ({ page }) => {
    // Create new booking
    await page.click('[data-testid="list-booking-button"]');
    
    await page.fill('[data-testid="booking-title"]', 'Mountain Resort Cabin');
    await page.selectOption('[data-testid="booking-type"]', 'hotel');
    await page.fill('[data-testid="booking-description"]', 'Cozy cabin with mountain views');
    await page.fill('[data-testid="booking-city"]', 'Aspen');
    await page.fill('[data-testid="booking-country"]', 'USA');
    await page.fill('[data-testid="check-in-date"]', '2024-12-15');
    await page.fill('[data-testid="check-out-date"]', '2024-12-20');
    await page.fill('[data-testid="original-price"]', '2000');
    await page.fill('[data-testid="swap-value"]', '1800');
    await page.fill('[data-testid="provider"]', 'Airbnb');
    await page.fill('[data-testid="confirmation-number"]', 'AB987654321');
    
    await page.click('[data-testid="submit-booking"]');
    
    // Verify creation success
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Booking listed successfully');
    
    // Navigate to my bookings
    await page.goto('/dashboard');
    await page.click('[data-testid="my-bookings-tab"]');
    
    // Verify booking appears in list
    await expect(page.locator('[data-testid="booking-item"]')).toContainText('Mountain Resort Cabin');
    
    // Edit booking
    await page.click('[data-testid="edit-booking-button"]').first();
    await page.fill('[data-testid="booking-description"]', 'Updated: Luxury cabin with stunning mountain views');
    await page.fill('[data-testid="swap-value"]', '1900');
    await page.click('[data-testid="save-changes"]');
    
    // Verify edit success
    await expect(page.locator('[data-testid="update-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="booking-item"]')).toContainText('Updated: Luxury cabin');
    
    // Delete booking
    await page.click('[data-testid="delete-booking-button"]').first();
    await page.click('[data-testid="confirm-delete"]');
    
    // Verify deletion
    await expect(page.locator('[data-testid="delete-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="booking-item"]')).not.toContainText('Mountain Resort Cabin');
  });

  test('User can search and filter bookings effectively', async ({ page }) => {
    await page.goto('/bookings');
    
    // Test location search
    await page.fill('[data-testid="search-location"]', 'Paris');
    await page.click('[data-testid="search-button"]');
    
    await expect(page.locator('[data-testid="search-results"]')).toContainText('Paris');
    await expect(page.locator('[data-testid="booking-card"]')).toHaveCount(1);
    
    // Test date range filter
    await page.fill('[data-testid="date-from"]', '2024-12-20');
    await page.fill('[data-testid="date-to"]', '2024-12-25');
    await page.click('[data-testid="apply-filters"]');
    
    // Verify filtered results
    await expect(page.locator('[data-testid="booking-card"]')).toHaveCount(1);
    
    // Test booking type filter
    await page.selectOption('[data-testid="booking-type-filter"]', 'event');
    await page.click('[data-testid="apply-filters"]');
    
    await expect(page.locator('[data-testid="booking-card"]')).toContainText('Concert Tickets');
    
    // Test price range filter
    await page.fill('[data-testid="price-min"]', '500');
    await page.fill('[data-testid="price-max"]', '1000');
    await page.click('[data-testid="apply-filters"]');
    
    // Clear all filters
    await page.click('[data-testid="clear-filters"]');
    await expect(page.locator('[data-testid="booking-card"]')).toHaveCount(2);
  });

  test('User can view detailed booking information', async ({ page }) => {
    await page.goto('/bookings');
    
    // Click on a booking card
    await page.click('[data-testid="booking-card"]').first();
    
    // Verify detailed view
    await expect(page.locator('[data-testid="booking-detail-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="booking-description"]')).toBeVisible();
    await expect(page.locator('[data-testid="booking-location"]')).toBeVisible();
    await expect(page.locator('[data-testid="booking-dates"]')).toBeVisible();
    await expect(page.locator('[data-testid="booking-price"]')).toBeVisible();
    await expect(page.locator('[data-testid="provider-info"]')).toBeVisible();
    await expect(page.locator('[data-testid="verification-status"]')).toBeVisible();
    await expect(page.locator('[data-testid="blockchain-info"]')).toBeVisible();
    
    // Test image gallery if present
    const imageGallery = page.locator('[data-testid="image-gallery"]');
    if (await imageGallery.isVisible()) {
      await page.click('[data-testid="next-image"]');
      await page.click('[data-testid="prev-image"]');
    }
    
    // Test map view if present
    const mapView = page.locator('[data-testid="location-map"]');
    if (await mapView.isVisible()) {
      await expect(mapView).toBeVisible();
    }
  });

  test('User can manage booking verification process', async ({ page }) => {
    // Create unverified booking
    await page.click('[data-testid="list-booking-button"]');
    
    // Fill minimal required fields
    await page.fill('[data-testid="booking-title"]', 'Unverified Hotel');
    await page.selectOption('[data-testid="booking-type"]', 'hotel');
    await page.fill('[data-testid="booking-city"]', 'Miami');
    await page.fill('[data-testid="booking-country"]', 'USA');
    await page.fill('[data-testid="check-in-date"]', '2024-12-10');
    await page.fill('[data-testid="check-out-date"]', '2024-12-15');
    await page.fill('[data-testid="original-price"]', '800');
    await page.fill('[data-testid="swap-value"]', '750');
    await page.fill('[data-testid="provider"]', 'Hotels.com');
    await page.fill('[data-testid="confirmation-number"]', 'HT123456');
    
    await page.click('[data-testid="submit-booking"]');
    
    // Navigate to verification section
    await page.goto('/dashboard');
    await page.click('[data-testid="verification-needed-tab"]');
    
    // Upload verification documents
    await page.click('[data-testid="upload-documents-button"]');
    
    // Mock file upload
    const fileInput = page.locator('[data-testid="file-upload"]');
    await fileInput.setInputFiles({
      name: 'booking-confirmation.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('mock pdf content'),
    });
    
    await page.click('[data-testid="submit-verification"]');
    
    // Verify submission
    await expect(page.locator('[data-testid="verification-submitted"]')).toContainText('Documents submitted for review');
    
    // Mock verification completion
    await page.route('**/api/bookings/*/verification', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'verified',
          verifiedAt: new Date().toISOString(),
        }),
      });
    });
    
    // Check verification status
    await page.reload();
    await expect(page.locator('[data-testid="verification-status"]')).toContainText('Verified');
  });

  test('User can handle booking validation errors', async ({ page }) => {
    // Mock validation failure
    await page.route('**/api/external/booking-validation', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Booking not found or expired',
          code: 'BOOKING_INVALID',
        }),
      });
    });
    
    await page.click('[data-testid="list-booking-button"]');
    
    // Fill form with invalid booking
    await page.fill('[data-testid="booking-title"]', 'Invalid Booking');
    await page.selectOption('[data-testid="booking-type"]', 'hotel');
    await page.fill('[data-testid="confirmation-number"]', 'INVALID123');
    await page.fill('[data-testid="provider"]', 'Booking.com');
    
    await page.click('[data-testid="validate-booking"]');
    
    // Verify error handling
    await expect(page.locator('[data-testid="validation-error"]')).toContainText('Booking not found or expired');
    await expect(page.locator('[data-testid="submit-booking"]')).toBeDisabled();
    
    // Test retry with correct information
    await page.fill('[data-testid="confirmation-number"]', 'BK123456789');
    await page.click('[data-testid="validate-booking"]');
    
    await expect(page.locator('[data-testid="validation-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="submit-booking"]')).toBeEnabled();
  });
});