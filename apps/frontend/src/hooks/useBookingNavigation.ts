import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { bookingService } from '@/services/bookingService';
import { 
  BookingNavigationHelper, 
  BookingUrlHelper, 
  BrowserNavigationHelper,
  NavigationOptions 
} from '@/utils/navigationHelpers';
import { 
  BookingNavigationGuardManager,
  NavigationGuardHook,
  GuardResult 
} from '@/utils/navigationGuards';
import { Booking } from '@booking-swap/shared';
import { useCallback, useEffect, useMemo } from 'react';

/**
 * Custom hook for booking navigation with integrated guards and helpers
 * 
 * This hook provides a unified interface for navigation between booking edit
 * and swap specification interfaces, with built-in access control and
 * URL parameter management.
 * 
 * Requirements addressed:
 * - 6.1: Clear entry points for both editing and swap creation
 * - 6.2: Logical next steps and navigation flow
 * - 6.3: Browser navigation handling
 * - 6.4: Deep linking support
 * - 6.5: Unsaved changes handling
 * - 6.6: Bookmark and sharing support
 * - 6.7: Efficient navigation patterns
 * - 6.8: Context switching support
 */
export const useBookingNavigation = () => {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const { user, token } = useAuth();

  // Initialize navigation helpers
  const navigationHelper = useMemo(
    () => new BookingNavigationHelper(navigate),
    [navigate]
  );

  const guardManager = useMemo(
    () => new BookingNavigationGuardManager(bookingService),
    []
  );

  const guardHook = useMemo(
    () => new NavigationGuardHook(guardManager),
    [guardManager]
  );

  // Extract current navigation context
  const bookingId = BookingUrlHelper.getBookingIdFromParams(params);
  const returnTo = BookingUrlHelper.getReturnUrlFromSearch(location.search);
  const isBookingRoute = BookingUrlHelper.isBookingRoute(location.pathname);
  const isSwapSpecificationRoute = BookingUrlHelper.isSwapSpecificationRoute(location.pathname);

  /**
   * Navigate to booking edit with access validation
   * Requirements: 6.1, 6.4, 6.5
   */
  const navigateToBookingEdit = useCallback(async (
    booking: Booking,
    options: NavigationOptions = {}
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user?.id || !token) {
      return { success: false, error: 'Authentication required' };
    }

    try {
      // Validate access using guards
      const guardResult = await guardHook.canAccessBookingEdit(
        booking.id,
        user.id,
        token
      );

      if (!guardResult.canAccess) {
        if (guardResult.redirectTo) {
          navigate(guardResult.redirectTo);
        }
        return { success: false, error: guardResult.reason };
      }

      // Navigate if access is granted
      navigationHelper.navigateToBookingEdit(booking, options);
      return { success: true };

    } catch (error) {
      console.error('Error navigating to booking edit:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Navigation failed' 
      };
    }
  }, [user?.id, token, guardHook, navigationHelper, navigate]);

  /**
   * Navigate to swap specification with access validation
   * Requirements: 6.1, 6.4, 6.5
   */
  const navigateToSwapSpecification = useCallback(async (
    booking: Booking,
    options: NavigationOptions = {}
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user?.id || !token) {
      return { success: false, error: 'Authentication required' };
    }

    try {
      // Validate access using guards
      const guardResult = await guardHook.canAccessSwapSpecification(
        booking.id,
        user.id,
        token
      );

      if (!guardResult.canAccess) {
        if (guardResult.redirectTo) {
          navigate(guardResult.redirectTo);
        }
        return { success: false, error: guardResult.reason };
      }

      // Navigate if access is granted
      navigationHelper.navigateToSwapSpecification(booking, options);
      return { success: true };

    } catch (error) {
      console.error('Error navigating to swap specification:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Navigation failed' 
      };
    }
  }, [user?.id, token, guardHook, navigationHelper, navigate]);

  /**
   * Navigate back to bookings with optional state
   * Requirements: 6.7, 6.8
   */
  const navigateToBookings = useCallback((
    state?: { message?: string; type?: 'success' | 'error' | 'info' }
  ) => {
    navigationHelper.navigateToBookings(state);
  }, [navigationHelper]);

  /**
   * Navigate to return URL with fallback
   * Requirements: 6.7, 6.8
   */
  const navigateToReturnUrl = useCallback((
    fallback: string = '/bookings',
    state?: any
  ) => {
    navigationHelper.navigateToReturnUrl(returnTo, fallback, state);
  }, [navigationHelper, returnTo]);

  /**
   * Handle navigation with unsaved changes confirmation
   * Requirements: 6.5, 6.6
   */
  const navigateWithUnsavedChanges = useCallback((
    destination: string,
    hasUnsavedChanges: boolean,
    onConfirm?: () => void
  ): boolean => {
    return navigationHelper.navigateWithUnsavedChanges(
      destination,
      hasUnsavedChanges,
      onConfirm
    );
  }, [navigationHelper]);

  /**
   * Check if user can access booking edit
   * Requirements: 6.4, 6.5
   */
  const canAccessBookingEdit = useCallback(async (
    bookingId: string
  ): Promise<{ canAccess: boolean; reason?: string }> => {
    if (!user?.id || !token) {
      return { canAccess: false, reason: 'Authentication required' };
    }

    try {
      return await guardHook.canAccessBookingEdit(bookingId, user.id, token);
    } catch (error) {
      console.error('Error checking booking edit access:', error);
      return { 
        canAccess: false, 
        reason: error instanceof Error ? error.message : 'Access check failed' 
      };
    }
  }, [user?.id, token, guardHook]);

  /**
   * Check if user can access swap specification
   * Requirements: 6.4, 6.5
   */
  const canAccessSwapSpecification = useCallback(async (
    bookingId: string
  ): Promise<{ canAccess: boolean; reason?: string }> => {
    if (!user?.id || !token) {
      return { canAccess: false, reason: 'Authentication required' };
    }

    try {
      return await guardHook.canAccessSwapSpecification(bookingId, user.id, token);
    } catch (error) {
      console.error('Error checking swap specification access:', error);
      return { 
        canAccess: false, 
        reason: error instanceof Error ? error.message : 'Access check failed' 
      };
    }
  }, [user?.id, token, guardHook]);

  /**
   * Generate shareable URLs for booking operations
   * Requirements: 6.6, 6.7
   */
  const generateShareableUrls = useCallback((bookingId: string) => {
    return {
      editUrl: BookingUrlHelper.buildBookingUrl('/bookings', bookingId, { edit: true }),
      swapSpecificationUrl: BookingUrlHelper.buildBookingUrl(
        '/bookings/:bookingId/swap-specification',
        bookingId
      ),
    };
  }, []);

  /**
   * Set up browser navigation handling
   * Requirements: 6.4, 6.5
   */
  const setupBrowserNavigation = useCallback((
    onBack: () => void,
    hasUnsavedChanges: boolean = false
  ) => {
    const handlePopstate = (event: PopStateEvent) => {
      BrowserNavigationHelper.handleBrowserBack(onBack, hasUnsavedChanges);
    };

    return BrowserNavigationHelper.setupPopstateListener(handlePopstate);
  }, []);

  return {
    // Navigation methods
    navigateToBookingEdit,
    navigateToSwapSpecification,
    navigateToBookings,
    navigateToReturnUrl,
    navigateWithUnsavedChanges,

    // Access control methods
    canAccessBookingEdit,
    canAccessSwapSpecification,

    // Utility methods
    generateShareableUrls,
    setupBrowserNavigation,

    // Current navigation context
    currentBookingId: bookingId,
    returnUrl: returnTo,
    isBookingRoute,
    isSwapSpecificationRoute,

    // URL helpers (for advanced usage)
    urlHelper: BookingUrlHelper,
    navigationHelper,
  };
};

/**
 * Hook for URL parameter extraction and validation
 * Requirements: 6.3, 6.6
 */
export const useBookingUrlParams = () => {
  const params = useParams();
  const location = useLocation();

  const bookingId = BookingUrlHelper.getBookingIdFromParams(params);
  const returnTo = BookingUrlHelper.getReturnUrlFromSearch(location.search);
  
  // Extract edit parameter from search params
  const searchParams = new URLSearchParams(location.search);
  const isEditMode = searchParams.get('edit') === 'true' || searchParams.has('edit');

  // Validate parameters
  const validation = useMemo(() => {
    return BookingUrlHelper.validateDeepLinkParams({
      bookingId: bookingId || undefined,
      returnTo: returnTo || undefined,
    });
  }, [bookingId, returnTo]);

  return {
    bookingId,
    returnTo,
    isEditMode,
    isValid: validation.isValid,
    validationErrors: validation.errors,
  };
};

/**
 * Hook for handling unsaved changes during navigation
 * Requirements: 6.5, 6.6
 */
export const useUnsavedChangesGuard = (
  hasUnsavedChanges: boolean,
  onSave?: () => Promise<void> | void,
  onDiscard?: () => void
) => {
  const navigate = useNavigate();

  // Set up beforeunload listener for browser refresh/close
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return event.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const navigateWithConfirmation = useCallback(async (
    destination: string,
    options: { replace?: boolean } = {}
  ): Promise<boolean> => {
    if (!hasUnsavedChanges) {
      navigate(destination, options);
      return true;
    }

    const action = window.confirm(
      'You have unsaved changes. What would you like to do?\n\n' +
      'OK - Save changes and continue\n' +
      'Cancel - Stay on this page'
    );

    if (action) {
      try {
        if (onSave) {
          await onSave();
        }
        navigate(destination, options);
        return true;
      } catch (error) {
        console.error('Error saving changes:', error);
        alert('Failed to save changes. Please try again.');
        return false;
      }
    }

    return false;
  }, [hasUnsavedChanges, navigate, onSave]);

  const discardChangesAndNavigate = useCallback((
    destination: string,
    options: { replace?: boolean } = {}
  ) => {
    if (onDiscard) {
      onDiscard();
    }
    navigate(destination, options);
  }, [navigate, onDiscard]);

  return {
    navigateWithConfirmation,
    discardChangesAndNavigate,
    hasUnsavedChanges,
  };
};