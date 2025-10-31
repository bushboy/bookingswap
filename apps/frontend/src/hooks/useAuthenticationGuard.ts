import { useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { SwapPlatformError, ERROR_CODES } from '@booking-swap/shared';

/**
 * Configuration options for the authentication guard
 */
interface UseAuthenticationGuardOptions {
  /** Whether to automatically redirect to login on authentication errors */
  autoRedirect?: boolean;
  /** Custom redirect path (defaults to /login) */
  redirectPath?: string;
  /** Whether to preserve the current location for return after login */
  preserveLocation?: boolean;
}

/**
 * Return type for the authentication guard hook
 */
interface UseAuthenticationGuardReturn {
  /** Check if user is authenticated and handle accordingly */
  requireAuthentication: () => boolean;
  /** Handle authentication errors with appropriate actions */
  handleAuthError: (error: Error) => void;
  /** Check if an error is authentication-related */
  isAuthError: (error: Error) => boolean;
  /** Check if an error is authorization-related */
  isAuthorizationError: (error: Error) => boolean;
  /** Get user-friendly error message for auth errors */
  getAuthErrorMessage: (error: Error) => string;
}

/**
 * Custom hook for handling authentication and authorization in components
 * 
 * This hook provides utilities for:
 * - Checking authentication status
 * - Handling authentication errors
 * - Redirecting to login when needed
 * - Providing user-friendly error messages
 * 
 * Requirements satisfied:
 * - 4.1: Token validation before API calls
 * - 4.2: Redirect to login for unauthenticated users
 * - 4.3: Handle authorization errors with appropriate messaging
 * - 4.4: Token refresh or redirect to login when token expires
 */
export const useAuthenticationGuard = (
  options: UseAuthenticationGuardOptions = {}
): UseAuthenticationGuardReturn => {
  const {
    autoRedirect = true,
    redirectPath = '/login',
    preserveLocation = true,
  } = options;

  const { isAuthenticated, isLoading, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * Check if user is authenticated and redirect if not
   */
  const requireAuthentication = useCallback((): boolean => {
    if (isLoading) {
      return false; // Still loading, don't make decisions yet
    }

    if (!isAuthenticated || !user) {
      if (autoRedirect) {
        const state = preserveLocation ? { from: location } : undefined;
        navigate(redirectPath, { state, replace: true });
      }
      return false;
    }

    return true;
  }, [isAuthenticated, isLoading, user, autoRedirect, navigate, redirectPath, preserveLocation, location]);

  /**
   * Check if an error is authentication-related
   */
  const isAuthError = useCallback((error: Error): boolean => {
    if (error instanceof SwapPlatformError) {
      return error.code === ERROR_CODES.MISSING_TOKEN || 
             error.code === ERROR_CODES.INVALID_TOKEN;
    }
    
    // Check for common authentication error patterns
    const message = error.message?.toLowerCase() || '';
    return message.includes('authentication') || 
           message.includes('unauthorized') ||
           message.includes('token') ||
           message.includes('login');
  }, []);

  /**
   * Check if an error is authorization-related
   */
  const isAuthorizationError = useCallback((error: Error): boolean => {
    if (error instanceof SwapPlatformError) {
      return error.code === ERROR_CODES.ACCESS_DENIED;
    }
    
    // Check for common authorization error patterns
    const message = error.message?.toLowerCase() || '';
    return message.includes('authorization') || 
           message.includes('forbidden') ||
           message.includes('permission') ||
           message.includes('access denied');
  }, []);

  /**
   * Get user-friendly error message for authentication/authorization errors
   */
  const getAuthErrorMessage = useCallback((error: Error): string => {
    if (error instanceof SwapPlatformError) {
      switch (error.code) {
        case ERROR_CODES.MISSING_TOKEN:
          return 'Please log in to continue.';
        case ERROR_CODES.INVALID_TOKEN:
          return 'Your session has expired. Please log in again.';
        case ERROR_CODES.ACCESS_DENIED:
          return 'You don\'t have permission to access this resource.';
        default:
          return error.message;
      }
    }

    if (isAuthError(error)) {
      return 'Authentication required. Please log in to continue.';
    }

    if (isAuthorizationError(error)) {
      return 'You don\'t have permission to perform this action.';
    }

    return error.message || 'An unexpected error occurred.';
  }, [isAuthError, isAuthorizationError]);

  /**
   * Handle authentication and authorization errors
   */
  const handleAuthError = useCallback((error: Error): void => {
    console.error('Authentication/Authorization error:', error);

    if (isAuthError(error)) {
      // Authentication error - redirect to login
      if (autoRedirect) {
        const state = preserveLocation ? { from: location } : undefined;
        navigate(redirectPath, { state, replace: true });
      }
    } else if (isAuthorizationError(error)) {
      // Authorization error - stay on page but show error
      // The component should handle displaying the error message
      console.warn('Authorization error - user lacks permission');
    }
  }, [isAuthError, isAuthorizationError, autoRedirect, navigate, redirectPath, preserveLocation, location]);

  // Auto-check authentication on mount and when auth state changes
  useEffect(() => {
    if (!isLoading && autoRedirect) {
      requireAuthentication();
    }
  }, [isLoading, requireAuthentication, autoRedirect]);

  return {
    requireAuthentication,
    handleAuthError,
    isAuthError,
    isAuthorizationError,
    getAuthErrorMessage,
  };
};