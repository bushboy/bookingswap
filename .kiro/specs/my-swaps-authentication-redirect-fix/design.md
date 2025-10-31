# Design Document

## Overview

The My Swaps authentication redirect issue occurs specifically when users with outgoing targets (users who are targeting other users' swaps) experience unexpected redirects to the login page after briefly viewing their swaps. This problem stems from authentication validation failures during targeting-related API calls, where the system incorrectly invalidates valid tokens when processing targeting data. The issue manifests as:

1. User with outgoing targets navigates to `/swaps` with valid authentication
2. ProtectedRoute allows access based on initial auth state
3. SwapsPage renders and begins loading swap data including targeting information
4. During targeting data retrieval, authentication validation incorrectly fails
5. User is redirected to login despite having a valid token, creating a poor user experience

The core issue is that targeting-related API calls have different authentication validation logic that incorrectly rejects valid tokens, particularly when the targeting points to other users' swaps.

## Architecture

### Current Authentication Flow Issues

The current implementation has targeting-specific authentication problems:

```
User Navigation → ProtectedRoute Check → SwapsPage Mount → Swap Data Load → Targeting Data Load → Auth Failure
     ↓                    ↓                   ↓                ↓                  ↓                  ↓
  Valid Token        Passes Check        useEffect         Success           Targeting API        Redirect
  (Outgoing Target)                     Triggers                            Call Fails           Triggered
```

The issue specifically occurs when:
1. User has outgoing targets (targeting other users' swaps)
2. Main swap data loads successfully with valid token
3. Targeting data API calls use different validation logic
4. Valid token is incorrectly rejected during targeting data retrieval
5. Authentication state is corrupted, triggering logout

### Root Cause Analysis

1. **Targeting-Specific Authentication Issues**: Users with outgoing targets trigger additional API calls to fetch targeting data, which use different authentication validation logic
2. **Inconsistent Token Validation**: The targeting-related endpoints may have stricter or different token validation that incorrectly rejects valid tokens
3. **Cross-User Data Access**: When users target other users' swaps, the API calls involve cross-user data access that may trigger incorrect authorization failures
4. **Authentication State Corruption**: Failed targeting API calls incorrectly trigger authentication state cleanup, causing valid users to be logged out
5. **Targeting Data Loading Race**: The targeting data loading process interferes with the main authentication flow, causing valid tokens to be invalidated

## Components and Interfaces

### Enhanced Authentication State Management

```typescript
interface AuthenticationState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isStable: boolean; // New: indicates auth state is stable for API calls
  lastValidation: Date | null; // New: track last successful validation
}

interface TokenValidationResult {
  isValid: boolean;
  reason?: 'expired' | 'invalid_format' | 'missing_claims';
  shouldRetry?: boolean; // New: indicates if validation should be retried
}
```

### SwapsPage Authentication Integration

```typescript
interface SwapsPageAuthState {
  authReady: boolean; // Authentication is ready for API calls
  authError: string | null; // Specific authentication error
  retryCount: number; // Track retry attempts
}
```

### Targeting-Specific Authentication Guard

```typescript
interface TargetingAuthGuard {
  validateTokenForTargeting(token: string): Promise<boolean>;
  handleTargetingAuthFailure(error: any): void;
  shouldRetryTargetingRequest(error: any): boolean;
  isTargetingAuthError(error: any): boolean;
}

interface ApiAuthGuard {
  validateBeforeRequest(): Promise<boolean>;
  handleAuthFailure(error: any): void;
  shouldRetryRequest(error: any): boolean;
  isAuthenticationError(error: any): boolean; // Distinguish auth from other errors
}
```

## Data Models

### Enhanced Authentication Context

The AuthContext will be enhanced to provide more granular authentication state:

```typescript
export interface EnhancedAuthContextType extends AuthContextType {
  isStable: boolean; // Auth state is stable and ready for API calls
  lastValidation: Date | null; // Last successful token validation
  validateToken(): Promise<boolean>; // Manual token validation
  waitForStableAuth(): Promise<boolean>; // Wait for auth to stabilize
}
```

### SwapsPage State Model

```typescript
interface SwapsPageState {
  // Existing state
  rawSwaps: SwapCardData[];
  isLoading: boolean;
  error: string | null;
  
  // Enhanced authentication state
  authState: {
    isReady: boolean;
    error: string | null;
    retryCount: number;
    lastCheck: Date | null;
  };
  
  // Targeting-specific state
  targetingState: {
    isLoading: boolean;
    error: string | null;
    authError: boolean; // Distinguish targeting auth errors from other errors
    retryCount: number;
  };
  
  // Loading phases
  loadingPhase: 'auth' | 'swaps' | 'targeting' | 'complete' | 'error';
}
```

## Error Handling

### Authentication Error Classification

```typescript
enum AuthErrorType {
  TOKEN_EXPIRED = 'token_expired',
  TOKEN_INVALID = 'token_invalid',
  TOKEN_MISSING = 'token_missing',
  NETWORK_ERROR = 'network_error',
  TARGETING_AUTH_FAILURE = 'targeting_auth_failure', // New: targeting-specific auth failure
  CROSS_USER_ACCESS_DENIED = 'cross_user_access_denied', // New: targeting other users fails
  FALSE_POSITIVE_AUTH_FAILURE = 'false_positive_auth_failure' // New: valid token incorrectly rejected
}

interface AuthError {
  type: AuthErrorType;
  message: string;
  shouldRetry: boolean;
  retryDelay?: number;
  isTargetingRelated?: boolean; // New: indicates if error is from targeting operations
  shouldTriggerLogout?: boolean; // New: indicates if error should cause logout
}
```

### Graceful Error Recovery

1. **Token Validation Consistency**: Ensure all API endpoints (including targeting) use consistent token validation logic
2. **Targeting Error Isolation**: Isolate targeting-related authentication errors from main authentication state
3. **Selective Retry Logic**: Retry targeting operations without affecting main authentication state
4. **Error Classification**: Distinguish between genuine authentication failures and targeting-specific issues
5. **State Preservation**: Maintain user's authentication state when targeting operations fail

### Error Handling Strategy

```typescript
class SwapsPageAuthHandler {
  async validateAuthBeforeLoad(): Promise<AuthValidationResult> {
    // Pre-validate authentication state
    // Ensure token is valid for both swap and targeting operations
    // Return clear validation result
  }
  
  handleAuthError(error: AuthError): void {
    // Classify error type and source (swap vs targeting)
    // Only trigger logout for genuine authentication failures
    // Preserve authentication state for targeting-specific errors
    // Show appropriate user feedback
  }
  
  async handleTargetingError(error: AuthError): Promise<void> {
    // Handle targeting-specific authentication errors
    // Do not corrupt main authentication state
    // Retry targeting operations independently
    // Provide user feedback about targeting issues
  }
  
  isGenuineAuthFailure(error: AuthError): boolean {
    // Determine if error represents genuine token invalidity
    // Return false for targeting-specific or false positive errors
    // Return true only for actual token expiration/invalidity
  }
  
  async retryTargetingWithBackoff(operation: () => Promise<any>, maxRetries: number): Promise<any> {
    // Implement exponential backoff for targeting operations
    // Do not affect main authentication state during retries
    // Handle targeting-specific error types appropriately
  }
}
```

## Testing Strategy

### Unit Tests

1. **Authentication State Management**
   - Token validation timing
   - State consistency during transitions
   - Race condition handling

2. **SwapsPage Authentication Integration**
   - Auth state validation before API calls
   - Error handling for different auth failure types
   - Retry logic with various scenarios

3. **API Authentication Guards**
   - Request interceptor behavior
   - Token refresh handling
   - Error response processing

### Integration Tests

1. **End-to-End Authentication Flow**
   - User navigation with valid/invalid tokens
   - Token expiration during page usage
   - Network interruption scenarios

2. **SwapsPage Loading Scenarios**
   - Normal loading with valid auth
   - Loading with expired token
   - Loading with network issues
   - Concurrent authentication state changes

### Performance Tests

1. **Authentication Validation Performance**
   - Token validation timing
   - API call latency with auth checks
   - Memory usage during auth state management

2. **User Experience Metrics**
   - Time to first meaningful content
   - Frequency of unexpected redirects
   - Success rate of swap data loading

## Implementation Phases

### Phase 1: Targeting Authentication Analysis
- Identify targeting-specific API endpoints causing authentication failures
- Analyze token validation differences between swap and targeting endpoints
- Add comprehensive logging for targeting-related authentication

### Phase 2: Authentication Error Classification
- Implement error classification to distinguish targeting vs genuine auth failures
- Add targeting-specific error handling that doesn't corrupt main auth state
- Ensure only genuine token invalidity triggers logout

### Phase 3: Targeting Data Loading Isolation
- Isolate targeting data loading from main authentication flow
- Implement independent retry logic for targeting operations
- Add targeting-specific error states and user feedback

### Phase 4: Consistent Token Validation
- Ensure all API endpoints use consistent token validation logic
- Fix targeting endpoints to properly validate tokens
- Add comprehensive testing for users with outgoing targets

## Security Considerations

1. **Token Validation**: Ensure all token validations include proper expiration and format checks
2. **Error Information**: Avoid exposing sensitive authentication details in error messages
3. **State Consistency**: Maintain consistent authentication state across all components
4. **Logout Handling**: Ensure proper cleanup when authentication fails

## Performance Considerations

1. **Validation Frequency**: Balance security with performance for token validation
2. **API Call Batching**: Avoid redundant authentication checks for concurrent requests
3. **State Updates**: Minimize unnecessary re-renders during authentication state changes
4. **Memory Management**: Properly cleanup authentication timers and event listeners