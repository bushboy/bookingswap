import { AuthError, BackendErrorResponse, convertBackendError } from '@/components/auth/AuthErrorDisplay';

export interface PasswordResetRequestData {
  email: string;
  resetBaseUrl: string;
}

export interface PasswordResetData {
  token: string;
  newPassword: string;
}

export interface TokenValidationData {
  token: string;
}

export interface PasswordResetRequestResponse {
  success: boolean;
  message: string;
  resetToken?: string; // Only in development
  expiresAt?: string; // Only in development
}

export interface PasswordResetResponse {
  success: boolean;
  message: string;
}

export interface TokenValidationResponse {
  valid: boolean;
  expiresAt?: string;
}

export class PasswordRecoveryApiError extends Error {
  public readonly authError: AuthError;
  public readonly originalResponse?: Response;

  constructor(authError: AuthError, originalResponse?: Response) {
    super(authError.message);
    this.name = 'PasswordRecoveryApiError';
    this.authError = authError;
    this.originalResponse = originalResponse;
  }
}

/**
 * Base API call function with comprehensive error handling
 */
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const url = `${baseUrl}${endpoint}`;

  // Add default headers
  const headers = {
    'Content-Type': 'application/json',
    'X-Request-ID': `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle network errors
    if (!response.ok) {
      // Try to parse error response
      let errorData: BackendErrorResponse | null = null;
      try {
        const text = await response.text();
        if (text) {
          errorData = JSON.parse(text);
        }
      } catch (parseError) {
        // If we can't parse the error response, create a generic error
      }

      if (errorData && errorData.error) {
        // Convert backend error to frontend error
        const authError = convertBackendError(errorData);
        throw new PasswordRecoveryApiError(authError, response);
      } else {
        // Create generic error based on status code
        const authError: AuthError = {
          type: response.status >= 500 ? 'server' : 'network',
          message: getGenericErrorMessage(response.status),
          code: `HTTP_${response.status}`,
          retryable: response.status >= 500 || response.status === 429,
        };
        throw new PasswordRecoveryApiError(authError, response);
      }
    }

    // Parse successful response
    const data = await response.json();
    return data as T;
  } catch (error) {
    if (error instanceof PasswordRecoveryApiError) {
      throw error;
    }

    // Handle network/fetch errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      const authError: AuthError = {
        type: 'network',
        message: 'Unable to connect to the server. Please check your internet connection.',
        code: 'NETWORK_ERROR',
        retryable: true,
      };
      throw new PasswordRecoveryApiError(authError);
    }

    // Handle other unexpected errors
    const authError: AuthError = {
      type: 'server',
      message: 'An unexpected error occurred. Please try again.',
      code: 'UNEXPECTED_ERROR',
      retryable: true,
    };
    throw new PasswordRecoveryApiError(authError);
  }
}

/**
 * Get generic error message based on HTTP status code
 */
function getGenericErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Invalid request. Please check your input and try again.';
    case 401:
      return 'Authentication failed. Please verify your information.';
    case 403:
      return 'Access denied. You do not have permission to perform this action.';
    case 404:
      return 'The requested resource was not found.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    case 500:
      return 'Internal server error. Please try again later.';
    case 502:
    case 503:
    case 504:
      return 'Service temporarily unavailable. Please try again later.';
    default:
      return 'An error occurred. Please try again.';
  }
}

/**
 * Request password reset
 */
export async function requestPasswordReset(
  data: PasswordResetRequestData
): Promise<PasswordResetRequestResponse> {
  return apiCall<PasswordResetRequestResponse>('/api/auth/request-password-reset', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Reset password using token
 */
export async function resetPassword(
  data: PasswordResetData
): Promise<PasswordResetResponse> {
  return apiCall<PasswordResetResponse>('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Validate password reset token
 */
export async function validatePasswordResetToken(
  data: TokenValidationData
): Promise<TokenValidationResponse> {
  return apiCall<TokenValidationResponse>('/api/auth/validate-reset-token', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Utility function to handle API errors in components
 */
export function handlePasswordRecoveryError(error: unknown): AuthError {
  if (error instanceof PasswordRecoveryApiError) {
    return error.authError;
  }

  // Handle other types of errors
  if (error instanceof Error) {
    return {
      type: 'server',
      message: error.message || 'An unexpected error occurred.',
      code: 'UNKNOWN_ERROR',
      retryable: true,
    };
  }

  // Fallback for unknown error types
  return {
    type: 'server',
    message: 'An unexpected error occurred. Please try again.',
    code: 'UNKNOWN_ERROR',
    retryable: true,
  };
}

/**
 * Utility function to determine if an error should trigger a retry
 */
export function shouldRetryError(error: AuthError): boolean {
  return error.retryable === true && error.type !== 'rate_limit' && error.type !== 'rate_limiting';
}

/**
 * Utility function to get retry delay based on error type
 */
export function getRetryDelay(error: AuthError, attemptNumber: number = 1): number {
  if (error.type === 'rate_limit' || error.type === 'rate_limiting') {
    // For rate limiting, suggest longer delays
    return Math.min(60000 * attemptNumber, 300000); // 1-5 minutes
  }

  if (error.type === 'network') {
    // For network errors, use exponential backoff
    return Math.min(1000 * Math.pow(2, attemptNumber - 1), 30000); // 1s, 2s, 4s, 8s, 16s, 30s max
  }

  // For server errors, use moderate delays
  return Math.min(5000 * attemptNumber, 30000); // 5s, 10s, 15s, 20s, 25s, 30s max
}

/**
 * Utility function to format error for user display
 */
export function formatErrorForUser(error: AuthError): string {
  // For security-sensitive errors, always show the secure message
  if (error.code?.includes('EMAIL_NOT_FOUND') ||
    error.code?.includes('USER_NOT_FOUND') ||
    error.code?.includes('WALLET_ONLY_USER')) {
    return 'If an account with that email exists, a password reset link has been sent.';
  }

  if (error.code?.includes('TOKEN_') && error.type === 'authentication') {
    return 'Invalid or expired reset token. Please request a new password reset.';
  }

  return error.message;
}