import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { authErrorHandler, handleAuthError } from '@/services/authErrorHandler';
import { AuthErrorType, createErrorContext } from '@/types/authError';

export interface User {
  id: string;
  username: string;
  email: string;
  verificationLevel: string;
  createdAt: string;
}

interface TokenValidationResult {
  isValid: boolean;
  reason?: 'expired' | 'invalid_format' | 'missing_claims';
}

interface TokenPayload {
  userId: string;
  jti: string;
  email?: string;
  username?: string;
  walletAddress?: string;
  exp: number;
  iat: number;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (
    username: string,
    email: string,
    password: string,
    displayName?: string
  ) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
  isStable: boolean; // Auth state is stable and ready for API calls
  lastValidation: Date | null; // Last successful token validation
  validateToken: () => Promise<boolean>; // Manual token validation
  waitForStableAuth: () => Promise<boolean>; // Wait for auth to stabilize
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStable, setIsStable] = useState(false);
  const [lastValidation, setLastValidation] = useState<Date | null>(null);
  const authOperationInProgress = React.useRef(false);

  // Get API base URL from environment or fallback to direct backend URL
  const getApiUrl = (endpoint: string) => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
    return `${baseUrl}${endpoint}`;
  };

  // Token validation function that checks JWT format, expiration, and required claims
  const validateToken = (tokenToValidate: string): TokenValidationResult => {
    try {
      // Validate JWT format (3 parts separated by dots)
      const parts = tokenToValidate.split('.');
      if (parts.length !== 3) {
        return { isValid: false, reason: 'invalid_format' };
      }

      // Decode and validate payload
      const payload: TokenPayload = JSON.parse(atob(parts[1]));
      const now = Math.floor(Date.now() / 1000);

      // Check expiration - allow 5 seconds of grace period for clock skew
      // Changed from 30-second pre-emptive rejection to avoid false positives
      // Backend will still validate actual expiration
      if (payload.exp && payload.exp < (now - 5)) {
        return { isValid: false, reason: 'expired' };
      }

      // Validate required claims
      if (!payload.userId || !payload.exp) {
        return { isValid: false, reason: 'missing_claims' };
      }

      return { isValid: true };
    } catch (error) {
      console.error('Token validation error:', error);
      return { isValid: false, reason: 'invalid_format' };
    }
  };

  // Helper function to clear authentication storage consistently
  const clearAuthStorage = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setUser(null);
    setToken(null);
  };

  // Initialize auth state from localStorage with token validation
  useEffect(() => {
    const initializeAuth = async () => {
      const savedToken = localStorage.getItem('auth_token');
      const savedUser = localStorage.getItem('auth_user');

      if (savedToken && savedUser) {
        try {
          const validation = validateToken(savedToken);

          if (validation.isValid) {
            setToken(savedToken);
            setUser(JSON.parse(savedUser));
            setLastValidation(new Date());
            setIsStable(true);
          } else {
            console.log('🔒 LOGIN REDIRECT TRIGGERED by AuthContext (Token Validation):', {
              component: 'AuthContext',
              reason: 'Stored token validation failed',
              conditions: {
                hasStoredToken: !!savedToken,
                hasStoredUser: !!savedUser,
                tokenValidation: validation,
                validationReason: validation.reason
              },
              action: 'clearAuthStorage (will trigger ProtectedRoute redirect)',
              timestamp: new Date().toISOString()
            });

            console.log(`Stored token is ${validation.reason}, clearing auth state`);
            await handleAuthError(
              { reason: validation.reason, message: `Token ${validation.reason}` },
              createErrorContext('/auth/initialize', 'token_validation')
            );
            clearAuthStorage();
          }
        } catch (error) {
          console.error('Error parsing saved user data:', error);
          await handleAuthError(
            error,
            createErrorContext('/auth/initialize', 'user_data_parsing')
          );
          clearAuthStorage();
        }
      } else {
        setIsStable(true); // No auth data is also a stable state
      }

      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  // Periodic token validation (every 60 seconds) to detect expiration during active sessions
  useEffect(() => {
    if (!token || !user) return;

    const interval = setInterval(async () => {
      const validation = validateToken(token);
      if (!validation.isValid) {
        console.log(`Token ${validation.reason} during session`);

        const handlingResult = await handleAuthError(
          { reason: validation.reason, message: `Token ${validation.reason}` },
          createErrorContext('/auth/periodic-check', 'token_validation')
        );

        if (handlingResult.shouldTriggerLogout) {
          console.log('Periodic validation triggered logout');
          logout();
        } else {
          console.log('Periodic validation preserved session');
        }
      } else {
        setLastValidation(new Date());
      }
    }, 60000); // Check every 60 seconds

    return () => clearInterval(interval);
  }, [token, user]);

  // Listen for token expiration events from API service
  useEffect(() => {
    const handleTokenExpired = (event: CustomEvent) => {
      console.log('Token expired event received:', event.detail);

      // Only logout for genuine authentication failures
      if (event.detail?.reason === 'genuine_auth_failure') {
        console.log('Genuine auth failure detected, logging out user');
        logout();
      } else {
        console.log('Non-genuine auth event, preserving session');
      }
    };

    window.addEventListener('auth:token-expired', handleTokenExpired as EventListener);

    return () => {
      window.removeEventListener('auth:token-expired', handleTokenExpired as EventListener);
    };
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    setIsStable(false); // Mark as unstable during login

    try {
      const response = await fetch(getApiUrl('/auth/email-login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Login failed');
      }

      const data = await response.json();

      if (data.success && data.user && data.token) {
        // Validate token before setting auth state
        const validation = validateToken(data.token);
        if (!validation.isValid) {
          console.warn('Login received invalid token from backend:', validation.reason);
          throw new Error('Received invalid authentication token');
        }

        setUser(data.user);
        setToken(data.token);
        setLastValidation(new Date());

        // Save to localStorage
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('auth_user', JSON.stringify(data.user));

        setIsStable(true); // Mark as stable after successful login
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Login error:', error);
      setIsStable(true); // Mark as stable even on error (no auth state)
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    username: string,
    email: string,
    password: string,
    displayName?: string
  ): Promise<void> => {
    setIsLoading(true);
    setIsStable(false); // Mark as unstable during registration

    try {
      const response = await fetch(getApiUrl('/auth/register'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password, displayName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Registration failed');
      }

      const data = await response.json();

      if (data.success && data.user && data.token) {
        // Validate token before setting auth state
        const validation = validateToken(data.token);
        if (!validation.isValid) {
          console.warn('Registration received invalid token from backend:', validation.reason);
          throw new Error('Received invalid authentication token');
        }

        setUser(data.user);
        setToken(data.token);
        setLastValidation(new Date());

        // Save to localStorage
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('auth_user', JSON.stringify(data.user));

        setIsStable(true); // Mark as stable after successful registration
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Registration error:', error);
      setIsStable(true); // Mark as stable even on error (no auth state)
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    // Prevent cascading logout operations
    if (authOperationInProgress.current) {
      console.log('Auth operation already in progress, skipping duplicate logout');
      return;
    }

    authOperationInProgress.current = true;
    try {
      clearAuthStorage();
      setIsStable(true); // Reset to stable state after logout
      setLastValidation(null);
    } finally {
      // Reset after a small delay to prevent rapid re-entry
      setTimeout(() => {
        authOperationInProgress.current = false;
      }, 100);
    }
  };

  // Manual token validation
  const validateTokenManually = async (): Promise<boolean> => {
    if (!token) {
      return false;
    }

    try {
      const validation = validateToken(token);
      if (validation.isValid) {
        setLastValidation(new Date());
        return true;
      } else {
        const handlingResult = await handleAuthError(
          { reason: validation.reason, message: `Token ${validation.reason}` },
          createErrorContext('/auth/manual-validation', 'token_validation')
        );

        if (handlingResult.shouldTriggerLogout) {
          logout();
        }
        return false;
      }
    } catch (error) {
      await handleAuthError(
        error,
        createErrorContext('/auth/manual-validation', 'token_validation')
      );
      return false;
    }
  };

  // Wait for authentication state to stabilize
  const waitForStableAuth = async (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (isStable && !isLoading) {
        resolve(!!user && !!token);
        return;
      }

      const checkStability = () => {
        if (isStable && !isLoading) {
          resolve(!!user && !!token);
        } else {
          setTimeout(checkStability, 100);
        }
      };

      checkStability();
    });
  };

  const value: AuthContextType = {
    user,
    token,
    login,
    register,
    logout,
    isLoading,
    isAuthenticated: !!user && !!token,
    isStable,
    lastValidation,
    validateToken: validateTokenManually,
    waitForStableAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
