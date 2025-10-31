# Authentication and Routing Enhancement Specification

## Overview
This specification outlines the requirements and implementation approach for restructuring the application's routing to make `/browse` the default public view, while protecting `/bookings` and `/swaps` routes for authenticated users only. Additionally, it includes comprehensive token validation to ensure expired tokens are properly handled.

## Current State Analysis

### 1. Current Routing Structure
**Location**: `apps/frontend/src/router/index.tsx`

- **Root Route (`/`)**: Currently protected by `ProtectedRoute`, defaults to `BookingsPage`
- **Public Routes**:
  - `/login` - LoginForm
  - `/register` - RegisterForm
  - `/auth/forgot-password` - PasswordResetRequest
  - `/auth/reset-password` - PasswordReset
  
- **Protected Routes** (all wrapped in `ProtectedRoute` under `/`):
  - `/bookings` - BookingsPage (current default)
  - `/browse` - BrowsePageWithLoading
  - `/swaps` - SwapsPageWithLoading
  - `/dashboard` - DashboardPageWithLoading
  - `/profile` - ProfilePageWithLoading
  - `/admin` - AdminPageWithLoading

### 2. Current Authentication System

#### Frontend Components
**Location**: `apps/frontend/src/contexts/AuthContext.tsx`

- **Token Storage**: Tokens stored in `localStorage` with key `auth_token`
- **User Storage**: User data stored in `localStorage` with key `auth_user`
- **Authentication Check**: Based on presence of both `user` and `token`
- **Token Expiration Listener**: Listens for `auth:token-expired` events from API service
- **Auto Logout**: Triggers logout when token expiration event is received

**Location**: `apps/frontend/src/components/auth/ProtectedRoute.tsx`

- Checks `isAuthenticated` from AuthContext
- Shows loading spinner while authentication is being checked
- Redirects to `/login` with return location state if not authenticated

#### Frontend Token Validation
**Location**: `apps/frontend/src/services/swapApiService.ts` (lines 502-576)

- **Client-side validation** includes:
  - JWT format validation (3 parts separated by dots)
  - Token expiration check with 30-second buffer
  - Payload decoding to extract expiration time (`exp` field)
  
- **Current validation timing**: 
  - Validated before each API call via `validateAuthentication()` method
  - Automatically triggers logout if token is invalid/expired

#### Backend Token Validation
**Location**: `apps/backend/src/middleware/auth.ts`

- **JWT verification** using `jsonwebtoken` library
- **Comprehensive error handling** for:
  - Missing tokens (401)
  - Invalid token format (401)
  - Token expiration (401 with `TOKEN_EXPIRED` code)
  - Token blacklisting
  - User not found (401)
  - Database errors (500)

**Location**: `apps/backend/src/services/auth/AuthService.ts` (lines 155-221)

- **Token generation**: JWT with configurable expiration (default 24h)
- **Token payload** includes:
  - `userId` - User ID
  - `jti` - JWT ID for blacklisting
  - `email` / `username` - For email-based auth
  - `walletAddress` - For wallet-based auth
  - `exp` - Expiration timestamp
  - `iat` - Issued at timestamp

- **Token verification** includes:
  - JWT signature verification
  - Expiration check
  - Blacklist check (if blacklist repository available)
  - Session invalidation check

### 3. Current Token Lifecycle

1. **Login**: Token generated and stored in `localStorage` with 24h expiration
2. **API Requests**: Token added to Authorization header as `Bearer <token>`
3. **Client-side Check**: Before API calls, token format and expiration validated
4. **Server-side Check**: On each protected endpoint, token verified by auth middleware
5. **Expiration Handling**: 
   - Server returns 401 with `TOKEN_EXPIRED` code
   - Client catches error and dispatches `auth:token-expired` event
   - AuthContext listener triggers logout

---

## Requirements

### 1. Default View: `/browse` as Public Route

**Requirement**: Make `/browse` the default landing page accessible without authentication.

**Current Issues**:
- `/browse` is currently wrapped in `ProtectedRoute`, requiring authentication
- Root path (`/`) defaults to `/bookings` which is protected
- New/unauthenticated users cannot see available swaps without logging in first

**User Stories**:
- As an unauthenticated visitor, I should be able to browse available swaps without logging in
- As an unauthenticated visitor, when I visit the root URL, I should see the browse page
- As an unauthenticated visitor browsing swaps, I should see prompts to login/register when attempting authenticated actions

### 2. Protected Routes: `/bookings` and `/swaps`

**Requirement**: Restrict access to `/bookings` and `/swaps` to authenticated users only.

**Current Issues**:
- Both routes are already protected, but need to ensure consistency
- Need clear user messaging when attempting to access without authentication

**User Stories**:
- As an unauthenticated user, when I try to access `/bookings`, I should be redirected to login
- As an unauthenticated user, when I try to access `/swaps`, I should be redirected to login
- As an authenticated user, I should have seamless access to both routes

### 3. Enhanced Token Validation

**Requirement**: Validate token expiration on both client and server, treating expired tokens as invalid regardless of storage.

**Current Issues**:
- Client-side validation exists but occurs only before API calls
- No validation on route navigation
- User could navigate protected routes with expired token until first API call
- Token expiration not checked on app initialization beyond localStorage presence

**User Stories**:
- As a user with an expired token, I should be treated as logged out immediately upon page load
- As a user with an expired token, I should be redirected to login when accessing protected routes
- As a user with an expired token, I should see a clear message that my session expired
- As a user, when my token expires during an active session, I should be logged out gracefully

---

## Proposed Solution

### 1. Routing Architecture Changes

#### Create Public Route Wrapper
**New Component**: `apps/frontend/src/components/auth/PublicRoute.tsx`

```typescript
interface PublicRouteProps {
  children: React.ReactNode;
}

export const PublicRoute: React.FC<PublicRouteProps> = ({ children }) => {
  // Allows access regardless of authentication status
  // No redirect logic needed
  return <>{children}</>;
};
```

#### Restructure Router Configuration
**File to Modify**: `apps/frontend/src/router/index.tsx`

**Changes**:
1. Move `/browse` route outside of protected routes section
2. Make root (`/`) route public and default to BrowsePage
3. Keep `/bookings` and `/swaps` under protected routes
4. Update navigation structure

**New Router Structure**:
```typescript
const router = createBrowserRouter([
  // Public routes - no authentication required
  {
    path: '/',
    element: <Layout />,  // Layout without ProtectedRoute wrapper
    errorElement: <NotFoundPage />,
    children: [
      {
        index: true,
        element: <BrowsePageWithLoading />, // New default
      },
      {
        path: 'browse',
        element: <BrowsePageWithLoading />,
      },
    ],
  },
  {
    path: '/login',
    element: <LoginForm />,
  },
  {
    path: '/register',
    element: <RegisterForm />,
  },
  {
    path: '/auth/forgot-password',
    element: <PasswordResetRequest />,
  },
  {
    path: '/auth/reset-password',
    element: <PasswordReset />,
  },
  
  // Protected routes - authentication required
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: 'bookings',
        element: <BookingsPage />,
      },
      {
        path: 'bookings/new',
        element: <BookingsPage />,
      },
      {
        path: 'bookings/:id',
        element: <BookingsPage />,
      },
      {
        path: 'bookings/:id/edit',
        element: <BookingsPage />,
      },
      {
        path: 'bookings/:bookingId/swap-specification',
        element: <BookingSwapSpecificationPageWithLoading />,
      },
      {
        path: 'swaps',
        element: <SwapsPageWithLoading />,
      },
      {
        path: 'swaps/:id',
        element: <SwapsPageWithLoading />,
      },
      {
        path: 'dashboard',
        element: <DashboardPageWithLoading />,
      },
      {
        path: 'profile',
        element: <ProfilePageWithLoading />,
      },
      {
        path: 'admin',
        element: <AdminPageWithLoading />,
      },
    ],
  },
]);
```

### 2. Layout Component Enhancement

**Challenge**: Layout component needs to work for both authenticated and unauthenticated users

**File to Modify**: `apps/frontend/src/components/layout/Layout.tsx`

**Changes**:
1. Check authentication status via `useAuth()`
2. Conditionally render navigation items based on auth status
3. Show login/register buttons for unauthenticated users
4. Show user menu for authenticated users

**Considerations**:
- Sidebar navigation should hide `/bookings` and `/swaps` for unauthenticated users
- Header should show appropriate CTAs based on auth status
- Browse link should be visible to all users

### 3. Enhanced Token Validation

#### Client-Side Validation Enhancement

**File to Modify**: `apps/frontend/src/contexts/AuthContext.tsx`

**Changes**:

1. **Add token validation on initialization**:
```typescript
// Enhanced initialization with validation
useEffect(() => {
  const savedToken = localStorage.getItem('auth_token');
  const savedUser = localStorage.getItem('auth_user');

  if (savedToken && savedUser) {
    try {
      // Validate token before setting auth state
      if (isTokenValid(savedToken)) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } else {
        // Token expired - clear storage
        console.log('Stored token is expired, clearing auth state');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      }
    } catch (error) {
      console.error('Error validating saved token:', error);
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
    }
  }

  setIsLoading(false);
}, []);

// Token validation helper
const isTokenValid = (token: string): boolean => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const payload = JSON.parse(atob(parts[1]));
    const now = Math.floor(Date.now() / 1000);

    // Check if token is expired (with 30 second buffer)
    if (payload.exp && payload.exp < (now + 30)) {
      return false;
    }

    return true;
  } catch (error) {
    console.warn('Invalid token format:', error);
    return false;
  }
};
```

2. **Add periodic token validation**:
```typescript
// Check token validity periodically (every 60 seconds)
useEffect(() => {
  if (!token || !user) return;

  const interval = setInterval(() => {
    if (!isTokenValid(token)) {
      console.log('Token expired during session, logging out');
      logout();
    }
  }, 60000); // Check every minute

  return () => clearInterval(interval);
}, [token, user]);
```

#### Server-Side Validation (Already Comprehensive)

**No changes needed** - Backend token validation is already robust with:
- JWT signature verification
- Expiration checking
- Blacklist checking
- Session invalidation checking

### 4. User Experience Enhancements

#### BrowsePage for Unauthenticated Users

**File to Modify**: `apps/frontend/src/pages/BrowsePage.tsx`

**Changes**:
1. Check authentication status
2. Show login/register prompts for actions requiring authentication:
   - Making proposals
   - Viewing detailed swap information
   - Accessing user-specific features

**Example**:
```typescript
const { isAuthenticated } = useAuth();
const navigate = useNavigate();

const handleMakeProposal = (swapId: string) => {
  if (!isAuthenticated) {
    // Show login prompt or redirect to login
    navigate('/login', { state: { from: `/browse`, action: 'make-proposal', swapId } });
    return;
  }
  
  // Proceed with proposal creation
  setSelectedSwapId(swapId);
  setShowProposalModal(true);
};
```

#### Authentication Flow Messages

**Files to Consider**:
- `apps/frontend/src/components/auth/LoginForm.tsx`
- `apps/frontend/src/components/auth/AuthErrorDisplay.tsx`

**New Messages**:
- "Your session has expired. Please log in again." (for expired tokens)
- "Please log in to create a proposal" (when accessing auth-required features from browse)
- "Please log in to view your bookings" (when accessing `/bookings` unauthenticated)

---

## Implementation Steps

### Phase 1: Routing Restructure (High Priority)
1. ✅ Create `PublicRoute` component (if needed, or use no wrapper)
2. ✅ Modify router configuration to separate public and protected routes
3. ✅ Update Layout component to handle both auth states
4. ✅ Update navigation components (Sidebar, Header) to conditionally show links
5. ✅ Test routing behavior for authenticated and unauthenticated users

### Phase 2: Token Validation Enhancement (High Priority)
1. ✅ Add token validation function to AuthContext
2. ✅ Validate token on AuthContext initialization
3. ✅ Add periodic token validation
4. ✅ Test token expiration scenarios:
   - Expired token in localStorage on page load
   - Token expiring during active session
   - Token validation with invalid format
   - Token validation after logout/login cycles

### Phase 3: User Experience Polish (Medium Priority)
1. ✅ Update BrowsePage to handle unauthenticated users
2. ✅ Add authentication prompts for protected actions
3. ✅ Update error messages for token expiration
4. ✅ Add "Sign up to create proposals" prompts on browse page
5. ✅ Test user flows:
   - Unauthenticated user browsing swaps
   - Unauthenticated user attempting to make proposal
   - Unauthenticated user accessing protected routes
   - User with expired token navigating app

### Phase 4: Testing and Validation (High Priority)
1. ✅ Unit tests for token validation functions
2. ✅ Integration tests for routing behavior
3. ✅ E2E tests for authentication flows
4. ✅ Manual testing of all scenarios
5. ✅ Performance testing (ensure token validation doesn't impact load times)

---

## Technical Considerations

### 1. Layout Component Architecture

**Challenge**: Layout component needs to be used in both public and protected contexts

**Options**:
- **Option A**: Create two Layout variants (PublicLayout and ProtectedLayout)
- **Option B**: Single Layout with conditional rendering based on auth state (RECOMMENDED)

**Recommendation**: Option B - Single Layout with conditional rendering
- **Pros**: DRY principle, easier maintenance, consistent UI structure
- **Cons**: Slightly more complex component logic

### 2. Token Validation Performance

**Concerns**:
- Token validation on every initialization could impact load time
- Periodic validation could cause unnecessary processing

**Mitigations**:
- Token validation is lightweight (just JWT decode and timestamp comparison)
- Periodic check every 60 seconds is minimal overhead
- Benefits of security outweigh minimal performance cost

### 3. Navigation State Management

**Consideration**: When unauthenticated users are redirected to login, preserve their intended destination

**Implementation**:
- Use React Router's location state to store return path
- After successful login, redirect to stored path or default to `/browse`
- Already partially implemented in ProtectedRoute

**Enhancement**:
```typescript
// In LoginForm.tsx
const location = useLocation();
const navigate = useNavigate();
const from = location.state?.from || '/browse';

const handleLoginSuccess = () => {
  navigate(from, { replace: true });
};
```

### 4. Token Storage Security

**Current State**: Tokens stored in localStorage

**Security Considerations**:
- localStorage is vulnerable to XSS attacks
- HttpOnly cookies are more secure but require CORS configuration

**Recommendation**: Keep localStorage for now with following mitigations:
- Implement Content Security Policy (CSP)
- Regular token expiration (24h is reasonable)
- Token blacklisting on logout
- Future consideration: Move to HttpOnly cookies with proper CORS setup

### 5. Server-Side Token Validation

**Current State**: Comprehensive backend validation already exists

**Verification Needed**:
- Ensure all protected endpoints use auth middleware
- Verify token expiration is consistently checked
- Confirm blacklist functionality works

**Audit Required**:
```bash
# Find all backend route files
# Check each route for auth middleware usage
grep -r "authenticate" apps/backend/src/routes/
```

---

## Testing Strategy

### 1. Unit Tests

**AuthContext Token Validation**:
```typescript
describe('AuthContext Token Validation', () => {
  it('should reject expired tokens on initialization', () => {
    // Create expired token
    // Set in localStorage
    // Initialize AuthContext
    // Verify isAuthenticated is false
  });

  it('should accept valid tokens on initialization', () => {
    // Create valid token
    // Set in localStorage
    // Initialize AuthContext
    // Verify isAuthenticated is true
  });

  it('should logout when token expires during session', () => {
    // Initialize with valid token
    // Mock time to simulate expiration
    // Wait for periodic check
    // Verify logout was called
  });
});
```

**Routing Tests**:
```typescript
describe('Public Route Access', () => {
  it('should allow unauthenticated access to /browse', () => {
    // Render app without authentication
    // Navigate to /browse
    // Verify BrowsePage renders
  });

  it('should redirect unauthenticated users from /bookings', () => {
    // Render app without authentication
    // Navigate to /bookings
    // Verify redirect to /login
  });
});
```

### 2. Integration Tests

**Token Expiration Flow**:
```typescript
describe('Token Expiration Integration', () => {
  it('should handle token expiration on API call', async () => {
    // Login to get valid token
    // Manually expire token in backend (or wait)
    // Make API call
    // Verify 401 response
    // Verify logout triggered
    // Verify redirect to login
  });
});
```

### 3. E2E Tests

**User Journey Tests**:
```typescript
describe('Unauthenticated User Journey', () => {
  it('should browse swaps and be prompted to login for proposal', async () => {
    // Visit root URL
    // Verify browse page loads
    // Click on swap
    // Click "Make Proposal"
    // Verify redirect to login
    // Login
    // Verify redirect back to browse with modal open
  });
});

describe('Token Expiration User Journey', () => {
  it('should handle expired token gracefully', async () => {
    // Login successfully
    // Manually expire token (or simulate)
    // Navigate to protected route
    // Verify redirect to login
    // Verify message about expired session
  });
});
```

---

## Security Considerations

### 1. Token Security
- ✅ Token stored in localStorage (acceptable for MVP, consider HttpOnly cookies later)
- ✅ Token validation on client and server
- ✅ Token expiration enforced
- ✅ Token blacklisting supported
- ❗ Consider implementing refresh tokens for better UX
- ❗ Consider rate limiting on auth endpoints

### 2. Route Protection
- ✅ Protected routes use ProtectedRoute wrapper
- ✅ Server-side validation on all protected endpoints
- ⚠️ Ensure consistent protection across all routes
- ⚠️ Verify admin routes have additional authorization checks

### 3. Data Exposure
- ❗ BrowsePage as public means swap listings are public
- ✅ Ensure sensitive user data not exposed in public listings
- ✅ Proposal details should remain protected
- ✅ User personal information should not be visible in public swaps

### 4. Attack Vectors
- **XSS**: Mitigate with CSP headers and input sanitization
- **CSRF**: Consider CSRF tokens for state-changing operations
- **Token Theft**: Short expiration times and HTTPS only
- **Brute Force**: Implement rate limiting on login endpoint

---

## Rollback Plan

If issues arise during implementation:

### Phase 1 Rollback (Routing)
1. Revert router configuration to original structure
2. Restore original Layout component
3. Clear browser cache for testers

**Risk Level**: Medium (affects all users)

### Phase 2 Rollback (Token Validation)
1. Remove token validation from AuthContext initialization
2. Remove periodic validation
3. Keep existing API-level validation

**Risk Level**: Low (only affects users with expired tokens)

---

## Success Criteria

### Functional Requirements
- ✅ Unauthenticated users can access `/browse` and view available swaps
- ✅ Root URL (`/`) shows browse page without requiring authentication
- ✅ `/bookings` and `/swaps` require authentication and redirect to login if not authenticated
- ✅ Users with expired tokens are treated as logged out on page load
- ✅ Users with tokens expiring during session are logged out gracefully

### User Experience
- ✅ Clear messaging when authentication is required
- ✅ Seamless redirect back to intended page after login
- ✅ No jarring errors or unexpected redirects
- ✅ Consistent navigation experience across auth states

### Security
- ✅ Expired tokens never grant access to protected resources
- ✅ All protected routes enforce authentication
- ✅ Token validation consistent between client and server
- ✅ No sensitive data exposed in public views

### Performance
- ✅ Token validation adds < 50ms to page load
- ✅ Periodic validation does not cause UI lag
- ✅ No memory leaks from validation intervals

---

## Documentation Updates Required

1. **README.md**: Update authentication flow documentation
2. **API Documentation**: Clarify which endpoints require authentication
3. **Developer Guide**: Add token validation guidelines
4. **User Guide**: Update navigation and authentication instructions
5. **Security Policy**: Document token handling and expiration policies

---

## Future Enhancements (Out of Scope)

1. **Refresh Tokens**: Implement refresh token mechanism for better UX
2. **Remember Me**: Option to extend token expiration for trusted devices
3. **Session Management**: View and revoke active sessions
4. **HttpOnly Cookies**: Move from localStorage to HttpOnly cookies
5. **OAuth Integration**: Add Google/Facebook login options
6. **2FA**: Two-factor authentication for enhanced security
7. **Progressive Enhancement**: Offline support with service workers

---

## Appendix

### A. Files to Modify

1. `apps/frontend/src/router/index.tsx` - Routing configuration
2. `apps/frontend/src/contexts/AuthContext.tsx` - Token validation
3. `apps/frontend/src/components/layout/Layout.tsx` - Conditional rendering
4. `apps/frontend/src/components/layout/Sidebar.tsx` - Navigation items
5. `apps/frontend/src/components/layout/Header.tsx` - Auth status display
6. `apps/frontend/src/pages/BrowsePage.tsx` - Unauthenticated experience
7. `apps/frontend/src/components/auth/LoginForm.tsx` - Return path handling
8. `apps/frontend/src/components/auth/index.ts` - Export PublicRoute (if created)

### B. New Files to Create

1. `apps/frontend/src/components/auth/PublicRoute.tsx` - Optional wrapper for public routes
2. `AUTHENTICATION_ROUTING_TESTS.md` - Test specifications document

### C. Environment Variables to Verify

```env
# Verify these are properly configured
JWT_SECRET=<secure-secret-key>
JWT_EXPIRES_IN=24h
VITE_API_BASE_URL=http://localhost:3001/api
```

### D. Backend Endpoints to Audit

1. `GET /api/swaps/browse` - Should be public
2. `GET /api/swaps/user/bookings` - Should be protected
3. `GET /api/swaps/user/proposals` - Should be protected
4. `POST /api/swaps/proposals` - Should be protected
5. `GET /api/auth/validate` - Token validation endpoint
6. `POST /api/auth/refresh` - Token refresh endpoint

---

## Conclusion

This specification provides a comprehensive plan for:
1. Making `/browse` the default public view
2. Protecting `/bookings` and `/swaps` for authenticated users
3. Implementing robust token validation to handle expired tokens

The implementation is structured in phases to minimize risk, with clear rollback procedures. Security is prioritized without compromising user experience, and the solution leverages existing infrastructure where possible.

**Estimated Implementation Time**: 3-5 days
**Risk Level**: Medium (affects core routing and authentication)
**Priority**: High (security and UX improvement)

---

**Document Version**: 1.0  
**Created**: October 19, 2025  
**Status**: Draft - Awaiting Approval  
**Next Steps**: Review specification with team, get approval, begin Phase 1 implementation

