# Wallet Integration with Authentication System

This document describes how the Hedera wallet integration has been wired into the main application.

## Components Added

### 1. WalletAuthIntegration
- **Location**: `src/components/auth/WalletAuthIntegration.tsx`
- **Purpose**: Manages the connection between wallet state and traditional authentication
- **Features**:
  - Automatically disconnects wallet when user logs out
  - Logs wallet connection status for debugging
  - Runs as a side-effect component (no UI)

### 2. WalletProtectedRoute
- **Location**: `src/components/auth/WalletProtectedRoute.tsx`
- **Purpose**: Route component that can optionally require wallet connection
- **Features**:
  - Can require wallet connection for specific routes
  - Shows wallet connection prompt when needed
  - Displays loading state during wallet connection
  - Graceful fallback for non-wallet routes

### 3. useWalletAuth Hook
- **Location**: `src/hooks/useWalletAuth.ts`
- **Purpose**: Combines traditional auth and wallet state
- **Features**:
  - Unified authentication state
  - Combined logout function (disconnects wallet + logs out)
  - Helper functions for feature access checks

## Integration Points

### 1. App Component
- Added `WalletAuthIntegration` component to manage wallet/auth connection
- Maintains existing provider hierarchy: Redux → Auth → Wallet

### 2. Header Component
- Added `WalletConnectButton` to the navigation bar
- Updated logout function to use combined wallet/auth logout
- Shows wallet status alongside user information

### 3. Router Configuration
- Added `WalletProtectedRoute` wrapper for swap-related routes
- Swaps pages now require wallet connection
- Custom fallback messages for different routes

## Usage Examples

### Protecting a Route with Wallet Requirement
```tsx
<WalletProtectedRoute 
  requireWallet={true}
  fallbackMessage="Connect your Hedera wallet to access this feature."
>
  <YourComponent />
</WalletProtectedRoute>
```

### Using Combined Auth State
```tsx
import { useWalletAuth } from '@/hooks/useWalletAuth';

function MyComponent() {
  const { 
    isAuthenticated, 
    isWalletConnected, 
    isFullyAuthenticated,
    logout 
  } = useWalletAuth();

  // Use combined state...
}
```

### Checking Feature Access
```tsx
import { useWalletFeatureAccess } from '@/hooks/useWalletAuth';

function MyComponent() {
  const { 
    canAccessWalletFeatures,
    needsAuth,
    needsWallet 
  } = useWalletFeatureAccess();

  if (needsAuth) return <LoginPrompt />;
  if (needsWallet) return <WalletConnectPrompt />;
  
  // Render wallet features...
}
```

## Requirements Satisfied

This implementation satisfies the following requirements from the spec:

- **1.1**: "Connect Wallet" button prominently displayed in header
- **2.1**: Wallet address and connection status shown in header
- **3.5**: Wallet connection maintained across navigation until explicitly disconnected

## Architecture Benefits

1. **Non-Breaking**: Existing authentication continues to work unchanged
2. **Progressive Enhancement**: Wallet features are additive, not required
3. **Separation of Concerns**: Wallet logic is separate but integrated
4. **Flexible**: Routes can optionally require wallet connection
5. **Consistent UX**: Unified logout clears both auth and wallet state