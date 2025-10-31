import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useAuthenticationGuard } from '../useAuthenticationGuard';
import { SwapPlatformError, ERROR_CODES } from '@booking-swap/shared';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';

// Mock the auth context
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
const mockLocation = { pathname: '/test', search: '', hash: '', state: null, key: 'test' };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation,
  };
});

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('useAuthenticationGuard', () => {
  const mockUseAuth = vi.mocked(require('../../contexts/AuthContext').useAuth);

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock - authenticated user
    mockUseAuth.mockReturnValue({
      user: {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        verificationLevel: 'verified',
        createdAt: '2024-01-01T00:00:00Z',
      },
      token: 'valid-token',
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      isLoading: false,
      isAuthenticated: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('requireAuthentication', () => {
    it('should return true when user is authenticated', () => {
      const { result } = renderHook(() => useAuthenticationGuard(), {
        wrapper: TestWrapper,
      });

      const isAuthenticated = result.current.requireAuthentication();
      expect(isAuthenticated).toBe(true);
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should return false and redirect when user is not authenticated', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        token: null,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
        isAuthenticated: false,
      });

      const { result } = renderHook(() => useAuthenticationGuard(), {
        wrapper: TestWrapper,
      });

      const isAuthenticated = result.current.requireAuthentication();
      expect(isAuthenticated).toBe(false);
      expect(mockNavigate).toHaveBeenCalledWith('/login', {
        state: { from: mockLocation },
        replace: true,
      });
    });

    it('should return false without redirect when autoRedirect is disabled', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        token: null,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
        isAuthenticated: false,
      });

      const { result } = renderHook(
        () => useAuthenticationGuard({ autoRedirect: false }),
        { wrapper: TestWrapper }
      );

      const isAuthenticated = result.current.requireAuthentication();
      expect(isAuthenticated).toBe(false);
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should return false when still loading', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        token: null,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        isLoading: true,
        isAuthenticated: false,
      });

      const { result } = renderHook(() => useAuthenticationGuard(), {
        wrapper: TestWrapper,
      });

      const isAuthenticated = result.current.requireAuthentication();
      expect(isAuthenticated).toBe(false);
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('isAuthError', () => {
    it('should identify SwapPlatformError authentication errors', () => {
      const { result } = renderHook(() => useAuthenticationGuard(), {
        wrapper: TestWrapper,
      });

      const authError = new SwapPlatformError(
        ERROR_CODES.INVALID_TOKEN,
        'Invalid token',
        'authentication'
      );

      expect(result.current.isAuthError(authError)).toBe(true);
    });

    it('should identify authentication errors by message content', () => {
      const { result } = renderHook(() => useAuthenticationGuard(), {
        wrapper: TestWrapper,
      });

      const authError = new Error('Authentication required');
      expect(result.current.isAuthError(authError)).toBe(true);

      const tokenError = new Error('Invalid token provided');
      expect(result.current.isAuthError(tokenError)).toBe(true);

      const unauthorizedError = new Error('Unauthorized access');
      expect(result.current.isAuthError(unauthorizedError)).toBe(true);
    });

    it('should not identify non-authentication errors', () => {
      const { result } = renderHook(() => useAuthenticationGuard(), {
        wrapper: TestWrapper,
      });

      const networkError = new Error('Network connection failed');
      expect(result.current.isAuthError(networkError)).toBe(false);

      const validationError = new Error('Invalid input data');
      expect(result.current.isAuthError(validationError)).toBe(false);
    });
  });

  describe('isAuthorizationError', () => {
    it('should identify SwapPlatformError authorization errors', () => {
      const { result } = renderHook(() => useAuthenticationGuard(), {
        wrapper: TestWrapper,
      });

      const authzError = new SwapPlatformError(
        ERROR_CODES.ACCESS_DENIED,
        'Access denied',
        'authorization'
      );

      expect(result.current.isAuthorizationError(authzError)).toBe(true);
    });

    it('should identify authorization errors by message content', () => {
      const { result } = renderHook(() => useAuthenticationGuard(), {
        wrapper: TestWrapper,
      });

      const forbiddenError = new Error('Forbidden access');
      expect(result.current.isAuthorizationError(forbiddenError)).toBe(true);

      const permissionError = new Error('Permission denied');
      expect(result.current.isAuthorizationError(permissionError)).toBe(true);

      const accessError = new Error('Access denied to resource');
      expect(result.current.isAuthorizationError(accessError)).toBe(true);
    });

    it('should not identify non-authorization errors', () => {
      const { result } = renderHook(() => useAuthenticationGuard(), {
        wrapper: TestWrapper,
      });

      const networkError = new Error('Network connection failed');
      expect(result.current.isAuthorizationError(networkError)).toBe(false);

      const authError = new Error('Authentication required');
      expect(result.current.isAuthorizationError(authError)).toBe(false);
    });
  });

  describe('getAuthErrorMessage', () => {
    it('should return appropriate messages for SwapPlatformError codes', () => {
      const { result } = renderHook(() => useAuthenticationGuard(), {
        wrapper: TestWrapper,
      });

      const missingTokenError = new SwapPlatformError(
        ERROR_CODES.MISSING_TOKEN,
        'Token missing',
        'authentication'
      );
      expect(result.current.getAuthErrorMessage(missingTokenError)).toBe(
        'Please log in to continue.'
      );

      const invalidTokenError = new SwapPlatformError(
        ERROR_CODES.INVALID_TOKEN,
        'Token invalid',
        'authentication'
      );
      expect(result.current.getAuthErrorMessage(invalidTokenError)).toBe(
        'Your session has expired. Please log in again.'
      );

      const accessDeniedError = new SwapPlatformError(
        ERROR_CODES.ACCESS_DENIED,
        'Access denied',
        'authorization'
      );
      expect(result.current.getAuthErrorMessage(accessDeniedError)).toBe(
        'You don\'t have permission to access this resource.'
      );
    });

    it('should return generic messages for non-SwapPlatformError auth errors', () => {
      const { result } = renderHook(() => useAuthenticationGuard(), {
        wrapper: TestWrapper,
      });

      const authError = new Error('Authentication failed');
      expect(result.current.getAuthErrorMessage(authError)).toBe(
        'Authentication required. Please log in to continue.'
      );

      const authzError = new Error('Permission denied');
      expect(result.current.getAuthErrorMessage(authzError)).toBe(
        'You don\'t have permission to perform this action.'
      );
    });

    it('should return original message for non-auth errors', () => {
      const { result } = renderHook(() => useAuthenticationGuard(), {
        wrapper: TestWrapper,
      });

      const networkError = new Error('Network connection failed');
      expect(result.current.getAuthErrorMessage(networkError)).toBe(
        'Network connection failed'
      );
    });
  });

  describe('handleAuthError', () => {
    it('should redirect on authentication errors when autoRedirect is enabled', () => {
      const { result } = renderHook(() => useAuthenticationGuard(), {
        wrapper: TestWrapper,
      });

      const authError = new SwapPlatformError(
        ERROR_CODES.INVALID_TOKEN,
        'Token invalid',
        'authentication'
      );

      act(() => {
        result.current.handleAuthError(authError);
      });

      expect(mockNavigate).toHaveBeenCalledWith('/login', {
        state: { from: mockLocation },
        replace: true,
      });
    });

    it('should not redirect on authorization errors', () => {
      const { result } = renderHook(() => useAuthenticationGuard(), {
        wrapper: TestWrapper,
      });

      const authzError = new SwapPlatformError(
        ERROR_CODES.ACCESS_DENIED,
        'Access denied',
        'authorization'
      );

      act(() => {
        result.current.handleAuthError(authzError);
      });

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('should not redirect when autoRedirect is disabled', () => {
      const { result } = renderHook(
        () => useAuthenticationGuard({ autoRedirect: false }),
        { wrapper: TestWrapper }
      );

      const authError = new SwapPlatformError(
        ERROR_CODES.INVALID_TOKEN,
        'Token invalid',
        'authentication'
      );

      act(() => {
        result.current.handleAuthError(authError);
      });

      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('custom configuration', () => {
    it('should use custom redirect path', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        token: null,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
        isAuthenticated: false,
      });

      const { result } = renderHook(
        () => useAuthenticationGuard({ redirectPath: '/custom-login' }),
        { wrapper: TestWrapper }
      );

      result.current.requireAuthentication();

      expect(mockNavigate).toHaveBeenCalledWith('/custom-login', {
        state: { from: mockLocation },
        replace: true,
      });
    });

    it('should not preserve location when preserveLocation is false', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        token: null,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
        isAuthenticated: false,
      });

      const { result } = renderHook(
        () => useAuthenticationGuard({ preserveLocation: false }),
        { wrapper: TestWrapper }
      );

      result.current.requireAuthentication();

      expect(mockNavigate).toHaveBeenCalledWith('/login', {
        state: undefined,
        replace: true,
      });
    });
  });
});