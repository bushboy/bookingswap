# Design Document

## Overview

This design implements a feature flag-based approach to temporarily hide auction and cash swap functionality from the user interface while preserving all backend functionality. The solution uses conditional rendering controlled by configuration constants, ensuring easy restoration of features without code changes.

## Architecture

### Feature Flag System

The design introduces a centralized feature flag configuration that controls UI visibility:

```typescript
// apps/frontend/src/config/featureFlags.ts
export const FEATURE_FLAGS = {
  ENABLE_AUCTION_MODE: false,
  ENABLE_CASH_SWAPS: false,
  ENABLE_CASH_PROPOSALS: false,
} as const;
```

### Component Modification Strategy

Instead of removing code, components will use conditional rendering based on feature flags:

1. **Conditional Wrapping**: UI elements wrapped in feature flag checks
2. **Default Value Enforcement**: Hidden options automatically set to safe defaults
3. **Validation Preservation**: All existing validation logic remains intact
4. **Graceful Degradation**: UI adapts seamlessly when features are disabled

## Components and Interfaces

### 1. SwapCreationModal Component

**Current State Analysis:**
- Has payment type selection (booking exchange vs cash)
- Has acceptance strategy selection (first match vs auction)
- Contains auction-specific settings (end date, auto-select)
- Contains cash payment settings (minimum/preferred amounts)

**Design Changes:**

```typescript
// Payment Types Section - Hide cash option
{FEATURE_FLAGS.ENABLE_CASH_SWAPS && (
  <div>
    <label style={checkboxStyles}>
      <input
        type="radio"
        name="paymentTypes"
        checked={
          formData.paymentTypes.bookingExchange &&
          formData.paymentTypes.cashPayment
        }
        onChange={() => {
          updatePaymentTypes('bookingExchange', true);
          updatePaymentTypes('cashPayment', true);
        }}
      />
      <span>Booking Exchange and Cash</span>
    </label>
    {/* Cash payment settings */}
  </div>
)}

// Acceptance Strategy Section - Hide auction option
{!isLastMinuteBooking && FEATURE_FLAGS.ENABLE_AUCTION_MODE && (
  <div>
    <label style={checkboxStyles}>
      <input
        type="radio"
        name="acceptanceStrategy"
        checked={formData.acceptanceStrategy.type === 'auction'}
        onChange={() => updateAcceptanceStrategy('type', 'auction')}
      />
      <span>Auction Mode</span>
    </label>
    {/* Auction settings */}
  </div>
)}
```

**Default Value Enforcement:**
```typescript
// Force defaults when features are disabled
React.useEffect(() => {
  if (!FEATURE_FLAGS.ENABLE_CASH_SWAPS) {
    updatePaymentTypes('cashPayment', false);
  }
  if (!FEATURE_FLAGS.ENABLE_AUCTION_MODE) {
    updateAcceptanceStrategy('type', 'first_match');
  }
}, []);
```

### 2. MakeProposalModal Component

**Current State Analysis:**
- Shows cash offer option when no eligible swaps
- Has dedicated cash offer form
- Contains cash proposal submission logic

**Design Changes:**

```typescript
// Hide cash offer option
{FEATURE_FLAGS.ENABLE_CASH_PROPOSALS && (
  <Card
    variant="outlined"
    style={{
      cursor: 'pointer',
      border: `2px solid ${tokens.colors.success[200]}`,
      backgroundColor: tokens.colors.success[50],
    }}
    onClick={() => {
      setShowForm(true);
      setSelectedSwap(null);
    }}
  >
    <CardContent>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2rem' }}>💰</div>
        <h5>Make Cash Offer</h5>
        <p>Offer cash instead of a swap exchange</p>
      </div>
    </CardContent>
  </Card>
)}

// Modified no swaps available message
{!eligibleSwaps || eligibleSwaps.length === 0 ? (
  <div style={{ textAlign: 'center' }}>
    <h3>No Available Swaps</h3>
    <p>
      You don't have any swaps available to propose for this exchange right now.
      {FEATURE_FLAGS.ENABLE_CASH_PROPOSALS && 
        " However, you can always make a cash offer instead!"
      }
    </p>
    <div style={{ display: 'flex', gap: tokens.spacing[3] }}>
      {FEATURE_FLAGS.ENABLE_CASH_PROPOSALS && (
        <Button variant="primary" onClick={() => {
          setShowForm(true);
          setSelectedSwap(null);
        }}>
          💰 Make Cash Offer
        </Button>
      )}
      <Button variant="primary" onClick={() => onClose()}>
        Create a Swap
      </Button>
    </div>
  </div>
) : (
  // Regular swap list
)}
```

### 3. Related Components

**Components requiring updates:**
- `CashOfferForm.tsx` - Conditional rendering of entire component
- `CashSwapCard.tsx` - Hide from swap displays
- `AuctionManagementDashboard.tsx` - Hide auction-related UI elements
- `TargetingValidationFeedback.tsx` - Hide auction info displays

## Data Models

### Feature Flag Configuration

```typescript
interface FeatureFlags {
  ENABLE_AUCTION_MODE: boolean;
  ENABLE_CASH_SWAPS: boolean;
  ENABLE_CASH_PROPOSALS: boolean;
}

// Environment-based configuration
const getFeatureFlags = (): FeatureFlags => {
  return {
    ENABLE_AUCTION_MODE: process.env.REACT_APP_ENABLE_AUCTION_MODE === 'true',
    ENABLE_CASH_SWAPS: process.env.REACT_APP_ENABLE_CASH_SWAPS === 'true',
    ENABLE_CASH_PROPOSALS: process.env.REACT_APP_ENABLE_CASH_PROPOSALS === 'true',
  };
};
```

### Form Data Handling

```typescript
// Enhanced form validation that respects feature flags
const validateForm = (): boolean => {
  const newErrors: Record<string, string> = {};

  // Standard validations...

  // Skip cash-related validations when feature is disabled
  if (FEATURE_FLAGS.ENABLE_CASH_SWAPS && formData.paymentTypes.cashPayment) {
    // Cash validation logic
  }

  // Skip auction-related validations when feature is disabled
  if (FEATURE_FLAGS.ENABLE_AUCTION_MODE && formData.acceptanceStrategy.type === 'auction') {
    // Auction validation logic
  }

  return Object.keys(newErrors).length === 0;
};
```

## Error Handling

### Graceful Degradation

```typescript
// Handle cases where backend still returns auction/cash data
const sanitizeSwapData = (swap: any) => {
  if (!FEATURE_FLAGS.ENABLE_AUCTION_MODE) {
    // Remove auction-related properties from display
    const { auctionInfo, ...sanitizedSwap } = swap;
    return sanitizedSwap;
  }
  return swap;
};

// Error boundaries for feature flag mismatches
const FeatureFlagErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ErrorBoundary
      fallback={<div>Feature temporarily unavailable</div>}
      onError={(error) => {
        if (error.message.includes('auction') || error.message.includes('cash')) {
          console.warn('Feature flag mismatch detected:', error);
        }
      }}
    >
      {children}
    </ErrorBoundary>
  );
};
```

### Backend Compatibility

```typescript
// API request sanitization
const sanitizeCreateSwapRequest = (request: EnhancedCreateSwapRequest) => {
  const sanitized = { ...request };
  
  if (!FEATURE_FLAGS.ENABLE_AUCTION_MODE) {
    sanitized.acceptanceStrategy = { type: 'first_match' };
    sanitized.auctionSettings = undefined;
  }
  
  if (!FEATURE_FLAGS.ENABLE_CASH_SWAPS) {
    sanitized.paymentTypes.cashPayment = false;
    sanitized.paymentTypes.minimumCashAmount = undefined;
    sanitized.paymentTypes.preferredCashAmount = undefined;
  }
  
  return sanitized;
};
```

## Testing Strategy

### Unit Tests

```typescript
describe('SwapCreationModal with Feature Flags', () => {
  beforeEach(() => {
    // Mock feature flags
    jest.mock('../config/featureFlags', () => ({
      FEATURE_FLAGS: {
        ENABLE_AUCTION_MODE: false,
        ENABLE_CASH_SWAPS: false,
        ENABLE_CASH_PROPOSALS: false,
      }
    }));
  });

  it('should hide auction mode option when feature flag is disabled', () => {
    render(<SwapCreationModal {...props} />);
    expect(screen.queryByText('Auction Mode')).not.toBeInTheDocument();
  });

  it('should hide cash payment option when feature flag is disabled', () => {
    render(<SwapCreationModal {...props} />);
    expect(screen.queryByText('Booking Exchange and Cash')).not.toBeInTheDocument();
  });

  it('should force first_match acceptance strategy when auction is disabled', () => {
    const { result } = renderHook(() => useSwapCreationForm());
    expect(result.current.formData.acceptanceStrategy.type).toBe('first_match');
  });
});
```

### Integration Tests

```typescript
describe('Feature Flag Integration', () => {
  it('should handle form submission with hidden features', async () => {
    const onSubmit = jest.fn();
    render(<SwapCreationModal onSubmit={onSubmit} {...props} />);
    
    // Fill form and submit
    fireEvent.click(screen.getByText('Create Swap'));
    
    // Verify submitted data doesn't include hidden features
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        acceptanceStrategy: { type: 'first_match' },
        paymentTypes: { bookingExchange: true, cashPayment: false }
      })
    );
  });
});
```

### Visual Regression Tests

```typescript
describe('UI Consistency with Hidden Features', () => {
  it('should maintain proper layout when features are hidden', () => {
    const { container } = render(<SwapCreationModal {...props} />);
    expect(container).toMatchSnapshot('swap-creation-modal-simplified');
  });
});
```

## Implementation Considerations

### Performance Impact

- **Minimal Bundle Size Impact**: Feature flags add negligible overhead
- **Runtime Performance**: Conditional rendering has minimal performance cost
- **Memory Usage**: No significant memory impact as code remains loaded

### Accessibility

- **Screen Reader Compatibility**: Hidden elements properly removed from accessibility tree
- **Keyboard Navigation**: Tab order remains logical with hidden elements
- **ARIA Labels**: Updated to reflect available options only

### Browser Compatibility

- **Feature Flag Support**: Works across all supported browsers
- **Conditional Rendering**: Standard React patterns, no compatibility issues
- **Environment Variables**: Properly handled in build process

### Rollback Strategy

```typescript
// Easy rollback by changing configuration
export const FEATURE_FLAGS = {
  ENABLE_AUCTION_MODE: true,  // Simply change to true
  ENABLE_CASH_SWAPS: true,    // Simply change to true
  ENABLE_CASH_PROPOSALS: true, // Simply change to true
} as const;
```

## Security Considerations

### Frontend Security

- **Feature Flag Exposure**: Flags are visible in client code but don't expose sensitive data
- **API Security**: Backend validation remains intact regardless of UI state
- **Data Sanitization**: Client-side sanitization prevents malformed requests

### Backend Compatibility

- **API Endpoints**: All existing endpoints remain functional
- **Data Validation**: Server-side validation handles both enabled and disabled feature states
- **Database Integrity**: No database changes required, existing data preserved

## Deployment Strategy

### Environment Configuration

```bash
# Development
REACT_APP_ENABLE_AUCTION_MODE=false
REACT_APP_ENABLE_CASH_SWAPS=false
REACT_APP_ENABLE_CASH_PROPOSALS=false

# Production
REACT_APP_ENABLE_AUCTION_MODE=false
REACT_APP_ENABLE_CASH_SWAPS=false
REACT_APP_ENABLE_CASH_PROPOSALS=false

# Future re-enablement
REACT_APP_ENABLE_AUCTION_MODE=true
REACT_APP_ENABLE_CASH_SWAPS=true
REACT_APP_ENABLE_CASH_PROPOSALS=true
```

### Gradual Rollout

1. **Phase 1**: Deploy with features disabled
2. **Phase 2**: Monitor for any issues or user feedback
3. **Phase 3**: Optionally re-enable features individually
4. **Phase 4**: Full feature restoration when ready

This design ensures a clean, maintainable solution that temporarily hides complex features while preserving all functionality for future restoration.