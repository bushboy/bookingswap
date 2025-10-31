import { NavigateFunction } from 'react-router-dom';
import { Booking } from '@booking-swap/shared';
import { NavigationQueryManager, ReturnNavigationHelper, NavigationContext } from './urlQueryHelpers';

/**
 * Navigation helpers for booking edit and swap specification interfaces
 * 
 * These utilities provide clean transitions between the separated interfaces
 * and handle URL parameter management for booking context.
 */

export interface NavigationOptions {
  returnTo?: string;
  preserveState?: boolean;
  replace?: boolean;
  hasUnsavedChanges?: boolean;
}

export interface BookingNavigationContext {
  bookingId: string;
  userId?: string;
  hasUnsavedChanges?: boolean;
}

/**
 * Navigation helper class for booking-related routes
 */
export class BookingNavigationHelper {
  private navigate: NavigateFunction;

  constructor(navigate: NavigateFunction) {
    this.navigate = navigate;
  }

  /**
   * Navigate to booking edit form
   * Requirements: 6.1, 6.2, 6.3
   */
  navigateToBookingEdit(
    booking: Booking,
    options: NavigationOptions = {}
  ): void {
    const { returnTo = '/bookings', replace = false, preserveState = false } = options;
    
    // Build navigation context
    const context: NavigationContext = {
      returnTo: returnTo !== '/bookings' ? returnTo : undefined,
      preserveState,
      fromInterface: 'booking-edit',
      bookingId: booking.id,
    };

    // For modal-based editing, we stay on the same page but update URL params
    const searchParams = new URLSearchParams();
    searchParams.set('edit', booking.id);
    
    // Add navigation context to URL
    const contextUrl = NavigationQueryManager.buildUrlWithContext('/bookings', context);
    
    this.navigate(contextUrl, { replace });
  }

  /**
   * Navigate to swap specification page
   * Requirements: 6.1, 6.2, 6.3, 6.4
   */
  navigateToSwapSpecification(
    booking: Booking,
    options: NavigationOptions = {}
  ): void {
    const { returnTo = '/bookings', replace = false, preserveState = false } = options;
    
    // Build navigation context
    const context: NavigationContext = {
      returnTo: returnTo !== '/bookings' ? returnTo : undefined,
      preserveState,
      fromInterface: 'swap-specification',
      bookingId: booking.id,
    };

    // Build URL with navigation context
    const baseUrl = `/bookings/${booking.id}/swap-specification`;
    const contextUrl = NavigationQueryManager.buildUrlWithContext(baseUrl, context);

    this.navigate(contextUrl, { replace });
  }

  /**
   * Navigate back to bookings list with optional state
   * Requirements: 6.7, 6.8
   */
  navigateToBookings(
    state?: { message?: string; type?: 'success' | 'error' | 'info' }
  ): void {
    this.navigate('/bookings', { state });
  }

  /**
   * Navigate to a specific return URL with fallback
   * Requirements: 6.7, 6.8
   */
  navigateToReturnUrl(
    returnTo: string | null,
    fallback: string = '/bookings',
    state?: any
  ): void {
    const destination = returnTo || fallback;
    this.navigate(destination, { state });
  }

  /**
   * Handle unsaved changes navigation with user confirmation
   * Requirements: 6.5, 6.6
   */
  navigateWithUnsavedChanges(
    destination: string,
    hasUnsavedChanges: boolean,
    onConfirm?: () => void
  ): boolean {
    if (!hasUnsavedChanges) {
      this.navigate(destination);
      return true;
    }

    const confirmed = window.confirm(
      'You have unsaved changes. Are you sure you want to leave? Your changes will be lost.'
    );

    if (confirmed) {
      onConfirm?.();
      this.navigate(destination);
      return true;
    }

    return false;
  }
}

/**
 * URL parameter utilities for booking context
 */
export class BookingUrlHelper {
  /**
   * Extract booking ID from URL parameters
   * Requirements: 6.3
   */
  static getBookingIdFromParams(params: Record<string, string | undefined>): string | null {
    return params.bookingId || params.id || null;
  }

  /**
   * Extract return URL from search parameters
   * Requirements: 6.7, 6.8
   */
  static getReturnUrlFromSearch(search: string): string | null {
    const searchParams = new URLSearchParams(search);
    const returnTo = searchParams.get('returnTo');
    return returnTo ? ReturnNavigationHelper.sanitizeReturnUrl(returnTo) : null;
  }

  /**
   * Build URL with booking context and return parameters
   * Requirements: 6.3, 6.7, 6.8
   */
  static buildBookingUrl(
    basePath: string,
    bookingId: string,
    options: {
      returnTo?: string;
      edit?: boolean;
      [key: string]: any;
    } = {}
  ): string {
    const { returnTo, edit, ...otherParams } = options;
    const searchParams = new URLSearchParams();

    if (returnTo) {
      searchParams.set('returnTo', returnTo);
    }

    if (edit) {
      searchParams.set('edit', 'true');
    }

    // Add any other parameters
    Object.entries(otherParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.set(key, String(value));
      }
    });

    const queryString = searchParams.toString();
    const url = basePath.includes(':bookingId') 
      ? basePath.replace(':bookingId', bookingId)
      : `${basePath}/${bookingId}`;

    return queryString ? `${url}?${queryString}` : url;
  }

  /**
   * Check if current URL matches a booking-related route
   * Requirements: 6.1, 6.2
   */
  static isBookingRoute(pathname: string): boolean {
    return pathname.startsWith('/bookings');
  }

  /**
   * Check if current URL is the swap specification route
   * Requirements: 6.1, 6.2
   */
  static isSwapSpecificationRoute(pathname: string): boolean {
    return pathname.includes('/swap-specification');
  }
}

/**
 * Browser navigation utilities for handling back/forward buttons
 */
export class BrowserNavigationHelper {
  /**
   * Handle browser back button with custom logic
   * Requirements: 6.4, 6.5
   */
  static handleBrowserBack(
    onBack: () => void,
    hasUnsavedChanges: boolean = false
  ): void {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to go back? Your changes will be lost.'
      );
      
      if (confirmed) {
        onBack();
      } else {
        // Push current state back to prevent navigation
        window.history.pushState(null, '', window.location.href);
      }
    } else {
      onBack();
    }
  }

  /**
   * Set up popstate listener for custom back button handling
   * Requirements: 6.4, 6.5
   */
  static setupPopstateListener(
    onPopstate: (event: PopStateEvent) => void
  ): () => void {
    window.addEventListener('popstate', onPopstate);
    
    // Return cleanup function
    return () => {
      window.removeEventListener('popstate', onPopstate);
    };
  }

  /**
   * Push state to history for custom navigation handling
   * Requirements: 6.4
   */
  static pushNavigationState(
    state: any,
    title: string = '',
    url?: string
  ): void {
    window.history.pushState(state, title, url);
  }
}

/**
 * Deep linking utilities for bookmarks and shared links
 */
export class DeepLinkingHelper {
  /**
   * Generate shareable URL for booking edit
   * Requirements: 6.6, 6.7
   */
  static generateBookingEditLink(
    bookingId: string,
    options: { returnTo?: string } = {}
  ): string {
    const baseUrl = window.location.origin;
    const url = BookingUrlHelper.buildBookingUrl('/bookings', bookingId, {
      edit: true,
      ...options,
    });
    
    return `${baseUrl}${url}`;
  }

  /**
   * Generate shareable URL for swap specification
   * Requirements: 6.6, 6.7
   */
  static generateSwapSpecificationLink(
    bookingId: string,
    options: { returnTo?: string } = {}
  ): string {
    const baseUrl = window.location.origin;
    const url = BookingUrlHelper.buildBookingUrl(
      '/bookings/:bookingId/swap-specification',
      bookingId,
      options
    );
    
    return `${baseUrl}${url}`;
  }

  /**
   * Validate deep link parameters
   * Requirements: 6.6
   */
  static validateDeepLinkParams(params: {
    bookingId?: string;
    returnTo?: string;
  }): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!params.bookingId) {
      errors.push('Booking ID is required');
    } else if (!/^[a-zA-Z0-9-_]+$/.test(params.bookingId)) {
      errors.push('Invalid booking ID format');
    }

    if (params.returnTo && !params.returnTo.startsWith('/')) {
      errors.push('Return URL must be a relative path');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}