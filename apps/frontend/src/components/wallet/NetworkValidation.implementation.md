# Network Validation and Switching Implementation

## Overview

This implementation adds comprehensive network validation and switching functionality to the Hedera wallet integration, fulfilling requirement 4.4: "WHEN the wallet is on the wrong network THEN the system SHALL prompt the user to switch to the correct network".

## Components Implemented

### 1. NetworkValidator Service (`src/services/wallet/NetworkValidator.ts`)

**Purpose**: Core service for network validation logic and configuration management.

**Key Features**:
- Network validation against expected network configuration
- Provider-specific switching instructions
- User-friendly error messages and guidance
- Event-driven architecture for real-time updates
- Configurable validation rules

**Key Methods**:
- `validateNetwork(currentNetwork)`: Validates current network against expected
- `getNetworkGuidance()`: Provides user-friendly guidance for network mismatches
- `getProviderSwitchInstructions()`: Returns provider-specific switching steps
- `createSwitchRequest()`: Creates structured network switch requests

### 2. NetworkSwitchModal Component (`src/components/wallet/NetworkSwitchModal.tsx`)

**Purpose**: React modal component for prompting users to switch networks.

**Key Features**:
- Clear network mismatch visualization
- Provider-specific manual instructions
- Loading states during switch attempts
- Accessible design with proper ARIA attributes
- Responsive layout for mobile devices

**Props**:
- `currentNetwork`: The network the wallet is currently connected to
- `expectedNetwork`: The network required by the application
- `providerId`: Wallet provider identifier for specific instructions
- `onSwitchConfirm`: Callback for handling switch confirmation
- `isLoading`: Loading state during network switch

### 3. useNetworkValidation Hook (`src/hooks/useNetworkValidation.ts`)

**Purpose**: React hook for managing network validation state and actions.

**Key Features**:
- Automatic network validation when wallet state changes
- Modal state management
- Event handling for wallet service network events
- Integration with Redux wallet state
- Cleanup on component unmount

**Returns**:
- `validation`: Current network validation result
- `showSwitchModal`: Boolean for modal visibility
- `validateNetwork()`: Function to trigger validation
- `handleSwitchConfirm()`: Function to handle switch requests

### 4. WalletService Integration

**Enhanced Methods**:
- `validateCurrentNetwork()`: Validates the current wallet's network
- `requestNetworkSwitch()`: Initiates network switch process
- `handleNetworkChange()`: Handles network change events from providers
- `setExpectedNetwork()`: Configures the expected network
- Network validation during wallet connection process

### 5. Wallet Adapter Updates

**HashPackAdapter & BladeAdapter**:
- Added network change monitoring
- Periodic network status checking
- Network change event emission
- Proper cleanup of monitoring intervals

## Usage Examples

### Basic Network Validation

```typescript
import { useNetworkValidation } from '../hooks/useNetworkValidation';

const MyComponent = () => {
  const { validation, validateNetwork } = useNetworkValidation();
  
  useEffect(() => {
    validateNetwork();
  }, []);
  
  return (
    <div>
      {validation && !validation.isValid && (
        <div className="alert alert-warning">
          Wrong network detected: {validation.error?.message}
        </div>
      )}
    </div>
  );
};
```

### Network Switch Modal Integration

```typescript
import { NetworkSwitchModal } from '../components/wallet/NetworkSwitchModal';
import { useNetworkValidation } from '../hooks/useNetworkValidation';

const WalletComponent = () => {
  const {
    validation,
    showSwitchModal,
    networkValidator,
    handleSwitchConfirm,
    hideNetworkSwitchModal
  } = useNetworkValidation();
  
  return (
    <>
      {/* Your wallet UI */}
      
      {validation && !validation.isValid && (
        <NetworkSwitchModal
          isOpen={showSwitchModal}
          currentNetwork={validation.currentNetwork}
          expectedNetwork={validation.expectedNetwork}
          providerId="hashpack"
          networkValidator={networkValidator}
          onSwitchConfirm={handleSwitchConfirm}
          onCancel={hideNetworkSwitchModal}
          onClose={hideNetworkSwitchModal}
        />
      )}
    </>
  );
};
```

### Direct Service Usage

```typescript
import { walletService } from '../services/wallet/WalletService';

// Set expected network
walletService.setExpectedNetwork('mainnet');

// Validate current network
const validation = walletService.validateCurrentNetwork();
if (!validation?.isValid) {
  console.log('Network validation failed:', validation?.error);
}

// Listen for network changes
walletService.addEventListener('networkChanged', (event) => {
  console.log('Network changed:', event);
});
```

## Configuration

### Default Network Configuration

```typescript
export const defaultNetworkConfig: NetworkConfig = {
  expectedNetwork: 'testnet', // Default to testnet for development
  allowAutoSwitch: false, // Require user confirmation for network switches
};
```

### Customizing Network Validation

```typescript
const customValidator = new NetworkValidator({
  expectedNetwork: 'mainnet',
  allowAutoSwitch: true,
  customValidation: (network) => {
    // Custom validation logic
    return network === 'mainnet';
  }
});
```

## Error Handling

The implementation provides comprehensive error handling:

1. **Network Mismatch Errors**: Clear messages about current vs expected network
2. **Provider-Specific Errors**: Tailored error messages for HashPack, Blade, etc.
3. **Connection Errors**: Graceful handling of network connectivity issues
4. **Validation Errors**: Proper error boundaries and fallback states

## Testing

Comprehensive test suites are included:

1. **NetworkValidator.test.ts**: Unit tests for validation logic
2. **WalletService.network.test.ts**: Integration tests for service methods
3. **NetworkSwitchModal.test.tsx**: Component tests for modal behavior
4. **useNetworkValidation.test.ts**: Hook tests for state management

## Events

The system emits several events for integration:

- `networkValidated`: When network validation completes
- `networkValidationFailed`: When validation fails during connection
- `networkChanged`: When wallet network changes
- `networkSwitchRequested`: When user requests network switch

## Provider Support

### HashPack
- Automatic network detection
- Periodic network monitoring (5-second intervals)
- Provider-specific switching instructions

### Blade
- Basic network monitoring
- Testnet-focused validation
- Simplified switching guidance

### Extensible Architecture
- Easy to add new wallet providers
- Consistent interface across all providers
- Provider-specific customization support

## Security Considerations

1. **Input Validation**: All network inputs are validated
2. **Error Sanitization**: Error messages are sanitized before display
3. **Event Cleanup**: Proper cleanup of event listeners and intervals
4. **State Management**: Secure state management with Redux integration

## Performance

1. **Lazy Loading**: Components are loaded only when needed
2. **Efficient Polling**: Optimized network checking intervals
3. **Memory Management**: Proper cleanup of resources
4. **Event Debouncing**: Prevents excessive validation calls

## Accessibility

1. **ARIA Labels**: Proper accessibility attributes
2. **Keyboard Navigation**: Full keyboard support
3. **Screen Reader Support**: Semantic HTML structure
4. **Color Contrast**: Accessible color schemes

## Future Enhancements

1. **Automatic Network Switching**: Direct integration with wallet APIs
2. **Network History**: Track network changes over time
3. **Advanced Validation Rules**: More sophisticated validation logic
4. **Performance Metrics**: Network validation performance tracking

This implementation provides a robust foundation for network validation and switching in the Hedera wallet integration, ensuring users are always on the correct network for optimal application functionality.