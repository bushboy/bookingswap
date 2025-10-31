# Design Document

## Overview

The user profile loading issue stems from a disconnect between two authentication systems: the AuthContext (which properly manages localStorage and user sessions) and the Redux authSlice (which components like ReceivedProposalsSection depend on). The solution involves creating a synchronization mechanism that keeps both systems in sync, ensuring that when a user is authenticated in AuthContext, their data is immediately available in the Redux store.

## Architecture

### Current State Problem

```
AuthContext (✅ Has User Data)
    ↓ (No Connection)
Redux Store (❌ Empty User Data)
    ↓
ReceivedProposalsSection (❌ Shows "User Profile Not Loaded")
```

### Proposed Solution

```
AuthContext (✅ Has User Data)
    ↓ (Auth Sync Hook)
Redux Store (✅ Synchronized User Data)
    ↓
ReceivedProposalsSection (✅ Shows Proposals with Actions)
```

## Components and Interfaces

### 1. Auth Synchronization Hook (`useAuthSync`)

A custom React hook that bridges AuthContext and Redux store:

```typescript
interface AuthSyncHook {
  // Synchronizes AuthContext user data to Redux store
  syncUserToRedux: (user: User | null, token: string | null) => void;
  
  // Checks if sync is needed and performs it
  ensureSync: () => void;
  
  // Provides sync status for debugging
  syncStatus: {
    isInSync: boolean;
    lastSyncTime: Date | null;
    syncAttempts: number;
  };
}
```

### 2. Enhanced Auth Context Integration

Modify the existing AuthContext to trigger Redux updates:

```typescript
// In AuthProvider, add Redux dispatch calls
useEffect(() => {
  if (user && token) {
    // Dispatch to Redux store when AuthContext user changes
    dispatch(setUser(user));
    dispatch(setAuthenticated(true));
  } else {
    // Clear Redux store when user logs out
    dispatch(logout());
  }
}, [user, token, dispatch]);
```

### 3. Redux Store Initialization

Enhance the Redux store to accept initialization from AuthContext:

```typescript
// New action for initializing from external auth source
const initializeFromAuthContext = createAction<{
  user: User;
  isAuthenticated: boolean;
}>('auth/initializeFromAuthContext');

// Enhanced reducer to handle external initialization
const authSlice = createSlice({
  // ... existing reducers
  extraReducers: (builder) => {
    builder.addCase(initializeFromAuthContext, (state, action) => {
      state.user = action.payload.user;
      state.isAuthenticated = action.payload.isAuthenticated;
      state.loading = false;
      state.error = null;
    });
  }
});
```

### 4. Component-Level Fallback

Enhance ReceivedProposalsSection to handle missing Redux data:

```typescript
const ReceivedProposalsSection = (props) => {
  const reduxUserId = useAppSelector(selectCurrentUserId);
  const { user: authContextUser } = useAuth();
  
  // Fallback to AuthContext if Redux is empty
  const effectiveUserId = reduxUserId || authContextUser?.id;
  
  // Trigger sync if there's a mismatch
  const { ensureSync } = useAuthSync();
  
  useEffect(() => {
    if (!reduxUserId && authContextUser?.id) {
      ensureSync();
    }
  }, [reduxUserId, authContextUser?.id, ensureSync]);
  
  // Rest of component logic...
};
```

## Data Models

### User Data Synchronization

```typescript
interface SyncState {
  authContextUser: User | null;
  reduxUser: User | null;
  isInSync: boolean;
  lastSyncAttempt: Date | null;
  syncErrors: string[];
}

interface SyncAction {
  type: 'SYNC_USER_TO_REDUX' | 'SYNC_FAILED' | 'SYNC_SUCCESS';
  payload?: {
    user?: User;
    error?: string;
    timestamp: Date;
  };
}
```

### Enhanced Auth State

```typescript
interface EnhancedAuthState extends AuthState {
  // Existing fields...
  syncStatus: {
    lastSyncTime: Date | null;
    syncSource: 'localStorage' | 'authContext' | 'api' | null;
    hasSyncError: boolean;
    syncErrorMessage: string | null;
  };
}
```

## Error Handling

### 1. Sync Failure Recovery

```typescript
const handleSyncFailure = (error: Error, context: string) => {
  console.error(`Auth sync failed in ${context}:`, error);
  
  // Attempt fallback strategies
  if (context === 'redux_update') {
    // Try direct localStorage read
    attemptLocalStorageSync();
  } else if (context === 'localStorage_read') {
    // Clear potentially corrupted data
    clearAuthStorage();
    // Redirect to login
    redirectToLogin();
  }
};
```

### 2. Race Condition Prevention

```typescript
const useSyncLock = () => {
  const syncInProgress = useRef(false);
  
  const withSyncLock = async (operation: () => Promise<void>) => {
    if (syncInProgress.current) {
      console.log('Sync already in progress, skipping');
      return;
    }
    
    syncInProgress.current = true;
    try {
      await operation();
    } finally {
      syncInProgress.current = false;
    }
  };
  
  return { withSyncLock };
};
```

### 3. Data Validation

```typescript
const validateUserData = (user: any): user is User => {
  return (
    user &&
    typeof user.id === 'string' &&
    typeof user.username === 'string' &&
    typeof user.email === 'string' &&
    user.id.length > 0
  );
};
```

## Testing Strategy

### 1. Unit Tests

- Test `useAuthSync` hook in isolation
- Test Redux action creators and reducers
- Test user data validation functions
- Test error handling scenarios

### 2. Integration Tests

- Test AuthContext → Redux synchronization
- Test localStorage → Redux initialization
- Test component fallback behavior
- Test race condition handling

### 3. E2E Tests

- Test full user login flow with sync
- Test page refresh with localStorage data
- Test logout and cleanup
- Test error recovery scenarios

### 4. Development Tools

```typescript
// Debug component for development
const AuthSyncDebugger = () => {
  const authContextUser = useAuth().user;
  const reduxUser = useAppSelector(selectCurrentUser);
  const { syncStatus } = useAuthSync();
  
  if (process.env.NODE_ENV !== 'development') return null;
  
  return (
    <div style={{ position: 'fixed', bottom: 0, right: 0, background: 'black', color: 'white', padding: '10px' }}>
      <h4>Auth Sync Debug</h4>
      <div>AuthContext User: {authContextUser?.id || 'None'}</div>
      <div>Redux User: {reduxUser?.id || 'None'}</div>
      <div>In Sync: {syncStatus.isInSync ? '✅' : '❌'}</div>
      <div>Last Sync: {syncStatus.lastSyncTime?.toLocaleTimeString() || 'Never'}</div>
    </div>
  );
};
```

## Implementation Phases

### Phase 1: Core Synchronization
- Create `useAuthSync` hook
- Add Redux actions for external initialization
- Implement basic AuthContext → Redux sync

### Phase 2: Error Handling & Recovery
- Add sync failure detection and recovery
- Implement race condition prevention
- Add data validation

### Phase 3: Component Integration
- Update ReceivedProposalsSection with fallback logic
- Add sync triggers in key components
- Implement development debugging tools

### Phase 4: Testing & Optimization
- Add comprehensive test coverage
- Performance optimization for sync operations
- Production monitoring and error reporting