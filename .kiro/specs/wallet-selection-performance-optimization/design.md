# Design Document

## Overview

This design eliminates the performance bottleneck in wallet selection by removing expensive pre-connection availability checks for external wallet providers. The solution focuses on immediate UI responsiveness by displaying all wallet options statically and performing detection only when users attempt to connect.

## Architecture

### Current Architecture Issues
- WalletService performs expensive availability checks on initialization
- WalletSelectionModal waits for provider detection before displaying
- KabilaAdapter and other adapters perform complex availability detection with retries
- Multiple layers of caching and background polling create complexity

### New Simplified Architecture
- WalletService registers providers without availability checks
- WalletSelectionModal displays immediately with static provider information
- Wallet detection happens only on connection attempt (lazy loading)
- Mock wallet remains immediately available for development

## Components and Interfaces

### WalletService Changes
```typescript
class WalletService {
  // Remove availability caching
  // Remove background provider polling
  // Remove complex availability detection
  
  // Simplified provider registration
  public registerProvider(provider: WalletProvider): void {
    // Register immediately without availability checks
  }
  
  // Simplified provider listing
  public getProviders(): WalletProvider[] {
    // Return all registered providers
  }
  
  // Remove getAvailableProviders() method
  // Remove getProviderAvailabilityStatus() method
  // Remove checkProviderAvailabilityWithCache() method
}
```

### WalletSelectionModal Changes
```typescript
const WalletSelectionModal = () => {
  // Remove provider availability state management
  // Remove availability checking useEffect
  // Remove real-time availability updates
  
  // Static provider display
  const renderProviderOption = (provider) => {
    return (
      <ProviderOption
        provider={provider}
        onConnect={() => handleConnect(provider.id)}
        showInstallLink={true}
      />
    );
  };
  
  // Lazy connection with loading state
  const handleConnect = async (providerId) => {
    setConnectingProvider(providerId);
    try {
      await connect(providerId);
    } catch (error) {
      // Handle connection errors with specific guidance
    } finally {
      setConnectingProvider(null);
    }
  };
};
```

### Provider Adapter Changes
```typescript
class KabilaAdapter {
  // Remove availability caching
  // Remove health monitoring
  // Remove background validation
  // Remove complex retry logic in isAvailable()
  
  // Simplified availability check (only called on connect)
  public async isAvailable(): Promise<boolean> {
    return typeof window !== 'undefined' && 
           window.kabila !== undefined &&
           window.kabila.isAvailable === true;
  }
}
```

## Data Models

### Simplified Provider Information
```typescript
interface StaticProviderInfo {
  id: string;
  name: string;
  icon: string;
  description: string;
  installUrl: string;
  troubleshootingUrl?: string;
}

// Remove complex availability state
// Remove caching timestamps
// Remove health monitoring data
```

### Connection State
```typescript
interface ConnectionAttempt {
  providerId: string;
  isConnecting: boolean;
  error?: WalletError;
}

// Simplified state management focused on connection attempts
```

## Error Handling

### Connection-Time Error Handling
- Move all wallet detection errors to connection attempt phase
- Provide specific error messages with actionable guidance
- Show install links and troubleshooting information
- Allow immediate retry without modal closure

### Error Categories
1. **Provider Not Found**: Show install button with direct link
2. **Wallet Locked**: Show unlock instructions
3. **Connection Rejected**: Show retry option with guidance
4. **Network Issues**: Show network troubleshooting steps

## Testing Strategy

### Mock Wallet Testing
- Ensure mock wallet connects immediately in development
- Verify mock wallet doesn't interfere with production builds
- Test mock wallet provides realistic data for development

### Performance Testing
- Measure modal display time (target: <100ms)
- Verify no blocking operations during modal open
- Test connection attempt performance for each provider
- Validate error handling doesn't block UI

### User Experience Testing
- Test wallet selection flow with various providers
- Verify error messages are clear and actionable
- Test install link functionality
- Validate retry mechanisms work correctly

## Implementation Plan

### Phase 1: Remove Availability Detection
1. Remove availability caching from WalletService
2. Remove background polling and health monitoring
3. Simplify provider registration process
4. Update WalletSelectionModal to display statically

### Phase 2: Implement Lazy Connection
1. Move wallet detection to connection attempt
2. Add connection loading states to modal
3. Implement specific error handling for each provider
4. Add retry mechanisms

### Phase 3: Optimize Mock Wallet
1. Ensure mock wallet bypasses all detection
2. Verify immediate availability in development
3. Test production build excludes mock wallet properly

### Phase 4: Testing and Validation
1. Performance testing of modal display time
2. User experience testing of connection flows
3. Error handling validation
4. Cross-browser compatibility testing