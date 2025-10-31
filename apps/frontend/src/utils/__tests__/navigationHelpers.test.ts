import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  BookingNavigationHelper, 
  BookingUrlHelper, 
  BrowserNavigationHelper,
  DeepLinkingHelper 
} from '../navigationHelpers';
import { Booking } from '@booking-swap/shared';

// Mock navigate function
const mockNavigate = vi.fn();

// Mock booking data
const mockBooking: Booking = {
  id: 'booking-123',
  userId: 'user-456',
  title: 'Test Booking',
  description: 'Test Description',
  type: 'hotel',
  location: {
    city: 'Test City',
    country: 'Test Country',
    address: 'Test Address',
  },
  dateRange: {
    checkIn: '2024-12-01',
    checkOut: '2024-12-03',
  },
  originalPrice: 200,
  swapValue: 180,
  providerDetails: {
    name: 'Test Provider',
    contact: 'test@provider.com',
  },
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('BookingNavigationHelper', () => {
  let navigationHelper: BookingNavigationHelper;

  beforeEach(() => {
    vi.clearAllMocks();
    navigationHelper = new BookingNavigationHelper(mockNavigate);
  });

  describe('navigateToBookingEdit', () => {
    it('should navigate to booking edit with default return URL', () => {
      navigationHelper.navigateToBookingEdit(mockBooking);

      expect(mockNavigate).toHaveBeenCalledWith(
        '/bookings?edit=booking-123',
        { replace: false }
      );
    });

    it('should navigate to booking edit with custom return URL', () => {
      navigationHelper.navigateToBookingEdit(mockBooking, { 
        returnTo: '/dashboard' 
      });

      expect(mockNavigate).toHaveBeenCalledWith(
        '/bookings?edit=booking-123&returnTo=%2Fdashboard',
        { replace: false }
      );
    });

    it('should support replace navigation', () => {
      navigationHelper.navigateToBookingEdit(mockBooking, { 
        replace: true 
      });

      expect(mockNavigate).toHaveBeenCalledWith(
        '/bookings?edit=booking-123',
        { replace: true }
      );
    });
  });

  describe('navigateToSwapSpecification', () => {
    it('should navigate to swap specification with default return URL', () => {
      navigationHelper.navigateToSwapSpecification(mockBooking);

      expect(mockNavigate).toHaveBeenCalledWith(
        '/bookings/booking-123/swap-specification',
        { replace: false }
      );
    });

    it('should navigate to swap specification with custom return URL', () => {
      navigationHelper.navigateToSwapSpecification(mockBooking, { 
        returnTo: '/dashboard' 
      });

      expect(mockNavigate).toHaveBeenCalledWith(
        '/bookings/booking-123/swap-specification?returnTo=%2Fdashboard',
        { replace: false }
      );
    });
  });

  describe('navigateWithUnsavedChanges', () => {
    beforeEach(() => {
      // Mock window.confirm
      vi.stubGlobal('confirm', vi.fn());
    });

    it('should navigate immediately when no unsaved changes', () => {
      const result = navigationHelper.navigateWithUnsavedChanges(
        '/test-destination',
        false
      );

      expect(result).toBe(true);
      expect(mockNavigate).toHaveBeenCalledWith('/test-destination');
      expect(window.confirm).not.toHaveBeenCalled();
    });

    it('should show confirmation when there are unsaved changes', () => {
      vi.mocked(window.confirm).mockReturnValue(true);
      const onConfirm = vi.fn();

      const result = navigationHelper.navigateWithUnsavedChanges(
        '/test-destination',
        true,
        onConfirm
      );

      expect(result).toBe(true);
      expect(window.confirm).toHaveBeenCalledWith(
        'You have unsaved changes. Are you sure you want to leave? Your changes will be lost.'
      );
      expect(onConfirm).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/test-destination');
    });

    it('should not navigate when user cancels confirmation', () => {
      vi.mocked(window.confirm).mockReturnValue(false);
      const onConfirm = vi.fn();

      const result = navigationHelper.navigateWithUnsavedChanges(
        '/test-destination',
        true,
        onConfirm
      );

      expect(result).toBe(false);
      expect(onConfirm).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});

describe('BookingUrlHelper', () => {
  describe('getBookingIdFromParams', () => {
    it('should extract booking ID from bookingId parameter', () => {
      const params = { bookingId: 'booking-123' };
      const result = BookingUrlHelper.getBookingIdFromParams(params);
      expect(result).toBe('booking-123');
    });

    it('should extract booking ID from id parameter as fallback', () => {
      const params = { id: 'booking-456' };
      const result = BookingUrlHelper.getBookingIdFromParams(params);
      expect(result).toBe('booking-456');
    });

    it('should return null when no booking ID found', () => {
      const params = {};
      const result = BookingUrlHelper.getBookingIdFromParams(params);
      expect(result).toBeNull();
    });
  });

  describe('getReturnUrlFromSearch', () => {
    it('should extract return URL from search parameters', () => {
      const search = '?returnTo=%2Fdashboard&other=value';
      const result = BookingUrlHelper.getReturnUrlFromSearch(search);
      expect(result).toBe('/dashboard');
    });

    it('should return null when no return URL found', () => {
      const search = '?other=value';
      const result = BookingUrlHelper.getReturnUrlFromSearch(search);
      expect(result).toBeNull();
    });
  });

  describe('buildBookingUrl', () => {
    it('should build URL with booking ID replacement', () => {
      const result = BookingUrlHelper.buildBookingUrl(
        '/bookings/:bookingId/swap-specification',
        'booking-123'
      );
      expect(result).toBe('/bookings/booking-123/swap-specification');
    });

    it('should build URL with query parameters', () => {
      const result = BookingUrlHelper.buildBookingUrl(
        '/bookings',
        'booking-123',
        { returnTo: '/dashboard', edit: true }
      );
      expect(result).toBe('/bookings/booking-123?returnTo=%2Fdashboard&edit=true');
    });

    it('should handle undefined and null parameters', () => {
      const result = BookingUrlHelper.buildBookingUrl(
        '/bookings',
        'booking-123',
        { returnTo: '/dashboard', undefined: undefined, null: null }
      );
      expect(result).toBe('/bookings/booking-123?returnTo=%2Fdashboard');
    });
  });

  describe('route detection methods', () => {
    it('should detect booking routes', () => {
      expect(BookingUrlHelper.isBookingRoute('/bookings')).toBe(true);
      expect(BookingUrlHelper.isBookingRoute('/bookings/123')).toBe(true);
      expect(BookingUrlHelper.isBookingRoute('/swaps')).toBe(false);
    });

    it('should detect swap specification routes', () => {
      expect(BookingUrlHelper.isSwapSpecificationRoute('/bookings/123/swap-specification')).toBe(true);
      expect(BookingUrlHelper.isSwapSpecificationRoute('/bookings/123')).toBe(false);
    });
  });
});

describe('BrowserNavigationHelper', () => {
  beforeEach(() => {
    vi.stubGlobal('confirm', vi.fn());
    vi.stubGlobal('history', {
      pushState: vi.fn(),
    });
  });

  describe('handleBrowserBack', () => {
    it('should call onBack immediately when no unsaved changes', () => {
      const onBack = vi.fn();
      BrowserNavigationHelper.handleBrowserBack(onBack, false);

      expect(onBack).toHaveBeenCalled();
      expect(window.confirm).not.toHaveBeenCalled();
    });

    it('should show confirmation when there are unsaved changes', () => {
      vi.mocked(window.confirm).mockReturnValue(true);
      const onBack = vi.fn();

      BrowserNavigationHelper.handleBrowserBack(onBack, true);

      expect(window.confirm).toHaveBeenCalledWith(
        'You have unsaved changes. Are you sure you want to go back? Your changes will be lost.'
      );
      expect(onBack).toHaveBeenCalled();
    });

    it('should prevent navigation when user cancels', () => {
      vi.mocked(window.confirm).mockReturnValue(false);
      const onBack = vi.fn();

      BrowserNavigationHelper.handleBrowserBack(onBack, true);

      expect(onBack).not.toHaveBeenCalled();
      expect(window.history.pushState).toHaveBeenCalledWith(
        null, 
        '', 
        window.location.href
      );
    });
  });

  describe('setupPopstateListener', () => {
    it('should add and remove popstate listener', () => {
      const addEventListener = vi.spyOn(window, 'addEventListener');
      const removeEventListener = vi.spyOn(window, 'removeEventListener');
      const onPopstate = vi.fn();

      const cleanup = BrowserNavigationHelper.setupPopstateListener(onPopstate);

      expect(addEventListener).toHaveBeenCalledWith('popstate', onPopstate);

      cleanup();

      expect(removeEventListener).toHaveBeenCalledWith('popstate', onPopstate);
    });
  });
});

describe('DeepLinkingHelper', () => {
  beforeEach(() => {
    // Mock window.location
    vi.stubGlobal('location', {
      origin: 'https://example.com',
    });
  });

  describe('generateBookingEditLink', () => {
    it('should generate booking edit link', () => {
      const result = DeepLinkingHelper.generateBookingEditLink('booking-123');
      expect(result).toBe('https://example.com/bookings/booking-123?edit=true');
    });

    it('should generate booking edit link with return URL', () => {
      const result = DeepLinkingHelper.generateBookingEditLink('booking-123', {
        returnTo: '/dashboard'
      });
      expect(result).toBe('https://example.com/bookings/booking-123?returnTo=%2Fdashboard&edit=true');
    });
  });

  describe('generateSwapSpecificationLink', () => {
    it('should generate swap specification link', () => {
      const result = DeepLinkingHelper.generateSwapSpecificationLink('booking-123');
      expect(result).toBe('https://example.com/bookings/booking-123/swap-specification');
    });

    it('should generate swap specification link with return URL', () => {
      const result = DeepLinkingHelper.generateSwapSpecificationLink('booking-123', {
        returnTo: '/dashboard'
      });
      expect(result).toBe('https://example.com/bookings/booking-123/swap-specification?returnTo=%2Fdashboard');
    });
  });

  describe('validateDeepLinkParams', () => {
    it('should validate valid parameters', () => {
      const result = DeepLinkingHelper.validateDeepLinkParams({
        bookingId: 'booking-123',
        returnTo: '/dashboard'
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing booking ID', () => {
      const result = DeepLinkingHelper.validateDeepLinkParams({});

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Booking ID is required');
    });

    it('should reject invalid booking ID format', () => {
      const result = DeepLinkingHelper.validateDeepLinkParams({
        bookingId: 'invalid booking id!'
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid booking ID format');
    });

    it('should reject invalid return URL format', () => {
      const result = DeepLinkingHelper.validateDeepLinkParams({
        bookingId: 'booking-123',
        returnTo: 'https://external.com/path'
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Return URL must be a relative path');
    });
  });
});