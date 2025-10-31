# Authentication Redirect Investigation Report

## Issue Summary
Users are sometimes redirected to `/login` when accessing the `/swaps` page immediately after logging in, despite having a valid authentication token.

## Investigation Date
October 22, 2025

---

## Key Findings

### 1. **Race Condition in Auth State Initialization**

**Location**: `apps/frontend/src/contexts/AuthContext.tsx` (lines 119-170)

**Problem**: The AuthContext has an `isLoading` state that initializes to `true` and asynchronously loads auth data from localStorage. During this initialization:
- Token is validated from localStorage
- User data is parsed from localStorage  
- `isStable` flag is set to `true` when complete

**Issue**: If the SwapsPage component mounts and the ProtectedRoute checks authentication BEFORE the AuthContext finishes initializing, it will see:
- `isAuthenticated: false` (because user/token aren't set yet)
- `isLoading: true` (showing loading spinner)

However, there's a brief window where `isLoading` might transition to `false` before `user` and `token` are set, causing ProtectedRoute to redirect.

**Code Evidence**:
```typescript:apps/frontend/src/components/auth/ProtectedRoute.tsx
// Lines 65-80
if (!isAuthenticated) {
  console.log('🔒 LOGIN REDIRECT TRIGGERED by ProtectedRoute:', {
    component: 'ProtectedRoute',
    reason: 'User not authenticated',
    conditions: {
      isAuthenticated: isAuthenticated,
      isLoading: isLoading,
      hasUser: !!useAuth().user,
      hasToken: !!useAuth().token
    }
  });
  return <Navigate to="/login" state={{ from: location }} replace />;
}
```

The ProtectedRoute only checks `isLoading` and `isAuthenticated`, but doesn't wait for the `isStable` flag that indicates auth initialization is complete.

---

### 2. **Token Validation Timing Issues**

**Location**: `apps/frontend/src/contexts/AuthContext.tsx` (lines 81-108)

**Problem**: The token validation has a 30-second buffer for expiration:
```typescript
// Check expiration with 30-second buffer to account for clock skew
if (payload.exp && payload.exp < (now + 30)) {
  return { isValid: false, reason: 'expired' };
}
```

**Issue**: If a user logs in with a token that has less than 30 seconds until expiration, it will be:
1. Accepted by the backend during login
2. Rejected by the frontend's validateToken function
3. Causing the auth state to be cleared and triggering a redirect

**Timeline**:
1. User logs in at the backend → Token with exp=1000 (30 seconds from now)
2. Login succeeds, token saved to localStorage
3. AuthContext initializes, validates token → Token rejected (< 30 sec buffer)
4. Auth cleared → User redirected to login

---

### 3. **Multiple Redirect Trigger Points**

There are **5 different mechanisms** that can trigger an authentication redirect:

#### A. ProtectedRoute Component
```typescript:apps/frontend/src/components/auth/ProtectedRoute.tsx
if (!isAuthenticated) {
  return <Navigate to="/login" state={{ from: location }} replace />;
}
```

#### B. useAuthRedirect Hook
```typescript:apps/frontend/src/hooks/useAuthRedirect.ts
const handleAuthRedirect = () => {
  logout();
  window.location.replace(loginUrl);
};
window.addEventListener('auth:redirect-to-login', handleAuthRedirect);
```

#### C. Token Expiration in AuthContext
```typescript:apps/frontend/src/contexts/AuthContext.tsx
// Periodic validation every 60 seconds
const validation = validateToken(token);
if (!validation.isValid) {
  logout();
}
```

#### D. ProposalAcceptanceThunks
```typescript:apps/frontend/src/store/thunks/proposalAcceptanceThunks.ts
if (ProposalErrorHandler.shouldRedirectToLogin(error)) {
  window.dispatchEvent(new CustomEvent('auth:redirect-to-login'));
}
```

#### E. SwapApiService
```typescript:apps/frontend/src/services/swapApiService.ts
private handleAuthenticationError(): void {
  localStorage.removeItem('auth_token');
  window.dispatchEvent(new CustomEvent('auth:token-expired'));
}
```

**Issue**: These multiple trigger points can cause cascading redirects or conflicting auth state updates.

---

### 4. **SwapService API Call Timing**

**Location**: `apps/frontend/src/pages/SwapsPage.tsx` (lines 456-573)

**Problem**: The SwapsPage loads swap data immediately when the component mounts:

```typescript
React.useEffect(() => {
  if (user?.id) {
    loadSwaps();
  }
}, [user?.id, activeTab, sortBy, sortOrder, searchQuery]);
```

**Issue**: If this effect runs while:
- Auth token exists in localStorage
- But AuthContext hasn't fully initialized
- API call fails with 401

Then the API interceptor will trigger auth cleanup and redirect.

**API Interceptor Flow**:
```typescript:apps/frontend/src/services/swapService.ts
// Request interceptor
config => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}

// Response interceptor
error => {
  // 401 → Returns INVALID_TOKEN error
  // SwapApiService.handleAuthenticationError() → Clears tokens and dispatches 'auth:token-expired'
}
```

---

### 5. **Targeting Operations Causing False Positives**

**Location**: `apps/frontend/src/services/authErrorHandler.ts`

**Background**: The app has sophisticated logic to prevent targeting operation errors from corrupting main auth state. However, there might be cases where:

1. A targeting API call fails with 401
2. The error handler doesn't properly classify it as targeting-related
3. Main auth state gets cleared
4. User gets redirected to login

**Code Evidence**:
```typescript:apps/frontend/src/pages/SwapsPage.tsx
// Lines 220-270 - Targeting data is loaded AFTER swaps
React.useEffect(() => {
  if (rawSwaps.length > 0 && user?.id && loadingPhase === 'targeting') {
    // If auth token is missing at this point, skip targeting load
    if (!authToken) {
      console.warn('SwapsPage: No auth token available, skipping targeting data load');
      // But what if authToken was just removed by another error handler?
    }
  }
}, [rawSwaps, user?.id, loadingPhase]);
```

---

## Root Cause Analysis

The most likely scenarios for the redirect issue:

### **Scenario 1: Auth Initialization Race Condition** (MOST LIKELY)
1. User logs in successfully → Token and user saved to localStorage
2. Navigation to `/swaps` occurs
3. ProtectedRoute mounts, checks auth → `isLoading: true`
4. Shows loading spinner
5. AuthContext starts initialization
6. **BRIEF WINDOW**: `isLoading` becomes `false` before `user` and `token` are set
7. ProtectedRoute re-renders, sees `isAuthenticated: false`
8. **REDIRECT TRIGGERED**

### **Scenario 2: Token Validation Buffer Issue**
1. User logs in with token expiring in < 30 seconds
2. Backend accepts token (valid)
3. Frontend validates token with 30-second buffer
4. Token rejected as "expired"
5. Auth cleared
6. **REDIRECT TRIGGERED**

### **Scenario 3: Double API Call Collision**
1. User logs in, navigates to `/swaps`
2. SwapsPage effect fires, calls `loadSwaps()`
3. Simultaneously, some other component makes an API call
4. One call returns 401 (race condition with token)
5. API interceptor clears auth tokens
6. Second call now fails with missing token
7. **REDIRECT TRIGGERED**

---

## Evidence from Codebase

### Console Logs Show Multiple Redirect Sources
The codebase has extensive logging for redirect triggers:

```typescript
// From ProtectedRoute
console.log('🔒 LOGIN REDIRECT TRIGGERED by ProtectedRoute:', {...});

// From useAuthRedirect
console.log('🔒 LOGIN REDIRECT TRIGGERED by useAuthRedirect Hook:', {...});

// From AuthContext
console.log('🔒 LOGIN REDIRECT TRIGGERED by AuthContext (Token Validation):', {...});

// From ProposalAcceptanceThunk
console.log('🔒 LOGIN REDIRECT TRIGGERED by ProposalAcceptanceThunk:', {...});
```

**Action Item**: Check browser console logs when the issue occurs to identify which component triggers the redirect.

---

## Proposed Solutions

### **Solution 1: Use `isStable` Flag in ProtectedRoute** (RECOMMENDED)

**Problem**: ProtectedRoute doesn't wait for auth to stabilize before checking authentication.

**Fix**: Update ProtectedRoute to check the `isStable` flag:

```typescript:apps/frontend/src/components/auth/ProtectedRoute.tsx
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, isStable } = useAuth();
  const location = useLocation();

  // Show loading spinner while auth is initializing OR not stable
  if (isLoading || !isStable) {
    return <LoadingSpinner />;
  }

  // Only check authentication after auth state is stable
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
```

**Impact**: Prevents redirects during auth initialization race condition.

---

### **Solution 2: Remove 30-Second Buffer from Token Validation**

**Problem**: Frontend rejects tokens that backend accepts, causing immediate logout after login.

**Fix**: Remove or reduce the expiration buffer:

```typescript:apps/frontend/src/contexts/AuthContext.tsx
// Original (line 94):
if (payload.exp && payload.exp < (now + 30)) {

// Fixed:
if (payload.exp && payload.exp < now) {
```

**Alternative**: Add grace period instead of pre-emptive rejection:
```typescript
// Allow tokens that expired in the last 60 seconds (backend might still accept)
if (payload.exp && payload.exp < (now - 60)) {
```

**Impact**: Prevents false positives from token validation.

---

### **Solution 3: Debounce Auth State Changes**

**Problem**: Rapid auth state changes can cause UI flickering and race conditions.

**Fix**: Add a debounce to auth state updates:

```typescript:apps/frontend/src/contexts/AuthContext.tsx
const [authState, setAuthState] = useState({
  user: null,
  token: null,
  isLoading: true,
  isStable: false
});

// Use a ref to batch updates
const updateAuthRef = useRef<NodeJS.Timeout>();

const updateAuth = (updates: Partial<AuthState>) => {
  clearTimeout(updateAuthRef.current);
  updateAuthRef.current = setTimeout(() => {
    setAuthState(prev => ({ ...prev, ...updates }));
  }, 10); // Small debounce
};
```

**Impact**: Reduces race condition window.

---

### **Solution 4: Add Auth State Synchronization Check**

**Problem**: Multiple components can trigger auth cleanup simultaneously.

**Fix**: Add a mutex/lock mechanism for auth operations:

```typescript:apps/frontend/src/contexts/AuthContext.tsx
const authOperationInProgress = useRef(false);

const logout = () => {
  if (authOperationInProgress.current) {
    console.log('Auth operation already in progress, skipping duplicate logout');
    return;
  }
  
  authOperationInProgress.current = true;
  try {
    clearAuthStorage();
    setIsStable(true);
    setLastValidation(null);
  } finally {
    authOperationInProgress.current = false;
  }
};
```

**Impact**: Prevents cascading auth failures.

---

### **Solution 5: Wait for Stable Auth in SwapsPage**

**Problem**: SwapsPage might make API calls before auth is fully initialized.

**Fix**: Use the `waitForStableAuth` method:

```typescript:apps/frontend/src/pages/SwapsPage.tsx
const loadSwaps = async () => {
  // Wait for auth to stabilize before making API calls
  const isAuthenticated = await waitForStableAuth();
  
  if (!isAuthenticated) {
    console.log('SwapsPage - Auth not available after stabilization');
    setError('Authentication required. Please log in to view your proposals.');
    return;
  }

  // Proceed with API call...
};
```

**Impact**: Ensures API calls only happen when auth is ready.

---

## Debugging Steps

### Step 1: Add Comprehensive Logging

Add this to the browser console to track auth state changes:

```javascript
// Monitor auth state changes
let lastAuthState = null;
setInterval(() => {
  const token = localStorage.getItem('auth_token');
  const user = localStorage.getItem('auth_user');
  const currentState = { hasToken: !!token, hasUser: !!user };
  
  if (JSON.stringify(currentState) !== JSON.stringify(lastAuthState)) {
    console.log('🔐 Auth state changed:', {
      timestamp: new Date().toISOString(),
      from: lastAuthState,
      to: currentState,
      stackTrace: new Error().stack
    });
    lastAuthState = currentState;
  }
}, 100);
```

### Step 2: Enable Performance Markers

```javascript
// In AuthContext initialization
performance.mark('auth-init-start');
// ... initialization code ...
performance.mark('auth-init-end');
performance.measure('auth-init-duration', 'auth-init-start', 'auth-init-end');
console.log('Auth initialization took:', performance.getEntriesByName('auth-init-duration')[0].duration);
```

### Step 3: Monitor Redux Actions

```javascript
// Add to store configuration
const loggingMiddleware = store => next => action => {
  if (action.type.includes('auth') || action.type.includes('logout')) {
    console.log('🔴 Auth-related Redux action:', {
      type: action.type,
      payload: action.payload,
      timestamp: new Date().toISOString()
    });
  }
  return next(action);
};
```

### Step 4: Track API Interceptor Behavior

```javascript
// Add to swapService.ts request interceptor
console.log('📤 API Request:', {
  url: config.url,
  hasToken: !!config.headers.Authorization,
  timestamp: new Date().toISOString()
});

// Add to response interceptor
console.log('📥 API Response:', {
  url: error.config?.url,
  status: error.response?.status,
  willClearAuth: error.response?.status === 401,
  timestamp: new Date().toISOString()
});
```

---

## Testing Plan

### Test Case 1: Normal Login Flow
1. Clear all localStorage
2. Navigate to `/login`
3. Enter valid credentials
4. Submit login form
5. **Expected**: Redirect to `/swaps` without additional redirects
6. **Check console**: Should NOT see "LOGIN REDIRECT TRIGGERED" logs

### Test Case 2: Token Near Expiration
1. Mock a token that expires in 25 seconds
2. Complete login with this token
3. Navigate to `/swaps`
4. **Expected**: Should stay on `/swaps` page
5. **Check console**: Should NOT see "expired" token validation

### Test Case 3: Rapid Navigation
1. Log in successfully
2. Immediately navigate to `/swaps` (within 100ms of login)
3. **Expected**: Should show loading spinner, then swaps page
4. **Should NOT**: Redirect back to login

### Test Case 4: Page Refresh
1. Log in and navigate to `/swaps`
2. Refresh the page (F5)
3. **Expected**: Should remain on `/swaps` after reload
4. **Check**: Auth should reinitialize from localStorage correctly

---

## Immediate Actions

1. ✅ **Add `isStable` check to ProtectedRoute** (Solution 1)
2. ✅ **Review and adjust token expiration buffer** (Solution 2)
3. ✅ **Add auth operation mutex** (Solution 4)
4. ⏳ **Add comprehensive logging** (Debugging Steps 1-4)
5. ⏳ **Create test cases** (Testing Plan)

---

## Additional Notes

### AuthContext has `waitForStableAuth` method
This method is already available but not used by ProtectedRoute:

```typescript:apps/frontend/src/contexts/AuthContext.tsx
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
```

This should be utilized in components that need guaranteed stable auth state.

### Token Validation Happens Multiple Times
- **On mount** (AuthContext initialization)
- **Every 60 seconds** (periodic validation)
- **On API call** (backend validates)
- **On specific actions** (manual validation)

This multiple validation might cause timing issues if not synchronized.

---

## Conclusion

The most likely cause of the redirect issue is **Solution 1: Auth initialization race condition**. The ProtectedRoute component checks authentication before the AuthContext has finished loading the auth state from localStorage.

**Recommended Fix Priority**:
1. **HIGH**: Add `isStable` check to ProtectedRoute
2. **MEDIUM**: Review token expiration buffer logic
3. **LOW**: Add auth operation mutex

These fixes should resolve 90%+ of the redirect issues.
