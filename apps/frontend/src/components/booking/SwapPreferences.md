# SwapPreferencesSection Components

This document describes the SwapPreferencesSection component and its sub-components implemented for the booking swap UI simplification feature.

## Overview

The SwapPreferencesSection is a collapsible component that integrates swap functionality directly into booking forms. It allows users to specify swap preferences when creating or editing bookings, eliminating the need for separate swap creation workflows.

## Components

### 1. SwapPreferencesSection

**Main collapsible section component for swap settings within booking form**

- **Props**: `enabled`, `onToggle`, `preferences`, `onChange`, `errors`, `eventDate`
- **Features**:
  - Collapsible interface with toggle checkbox
  - Conditional rendering based on event timing
  - Integrated validation error display
  - Progressive disclosure of swap options

### 2. PaymentTypeSelector

**Component for choosing booking/cash payment options**

- **Props**: `selected`, `onChange`, `error`
- **Features**:
  - Multi-select checkboxes for payment types
  - Visual selection indicators
  - Prevents removing all payment types
  - Descriptive labels for each option

### 3. CashAmountInput

**Input component with validation for minimum/maximum cash amounts**

- **Props**: `label`, `value`, `onChange`, `error`, `minAmount`, `maxAmount`
- **Features**:
  - Dollar sign prefix icon
  - Real-time validation
  - Min/max amount constraints
  - Formatted number input

### 4. AcceptanceStrategySelector

**Radio button selector for auction/first-match options**

- **Props**: `selected`, `onChange`, `disabled`, `eventDate`, `error`
- **Features**:
  - Radio button selection
  - Automatic disabling for last-minute events
  - Detailed descriptions for each strategy
  - Warning messages for unavailable options

### 5. AuctionEndDatePicker

**Date picker with one-week-before-event validation**

- **Props**: `value`, `onChange`, `minDate`, `maxDate`, `eventDate`, `error`
- **Features**:
  - Date input with constraints
  - Automatic validation against event date
  - Helper text with event information
  - End-of-day time setting

### 6. SwapConditionsInput

**Dynamic input for additional swap terms**

- **Props**: `value`, `onChange`, `error`
- **Features**:
  - Add/remove conditions dynamically
  - Common condition suggestions
  - Duplicate prevention
  - Empty state messaging

## Usage Example

```tsx
import { SwapPreferencesSection } from '@/components/booking';

const BookingForm = () => {
  const [swapEnabled, setSwapEnabled] = useState(false);
  const [preferences, setPreferences] = useState<SwapPreferencesData>();
  const [errors, setErrors] = useState({});

  return (
    <form>
      {/* Other booking fields */}
      
      <SwapPreferencesSection
        enabled={swapEnabled}
        onToggle={setSwapEnabled}
        preferences={preferences}
        onChange={setPreferences}
        errors={errors}
        eventDate={bookingDate}
      />
      
      {/* Form actions */}
    </form>
  );
};
```

## Validation Rules

### Payment Types
- At least one payment type must be selected
- Cannot remove the last remaining payment type

### Cash Amounts
- Minimum cash amount required when cash payments enabled
- Must be positive numbers
- Maximum amount is optional

### Acceptance Strategy
- Auction mode disabled for events within one week
- First match always available

### Auction End Date
- Must be at least one week before event date
- Cannot be in the past
- Automatically sets time to 11:59 PM

### Swap Conditions
- Optional additional requirements
- No duplicates allowed
- Suggestions provided for common conditions

## Accessibility Features

- Proper ARIA labels and descriptions
- Keyboard navigation support
- Screen reader friendly
- High contrast support
- Focus management

## Integration Points

The SwapPreferencesSection integrates with:

1. **UnifiedBookingForm** - Main booking creation form
2. **BookingEditForm** - Existing booking modification
3. **ValidationService** - Form validation logic
4. **SwapService** - Backend swap operations

## Requirements Satisfied

This implementation satisfies the following requirements from the specification:

- **1.1**: Integrated booking and swap creation
- **1.5**: Simplified booking creation flow
- **5.1**: Single, intuitive form interface
- **5.2**: Progressive disclosure of swap settings
- **6.1**: Enhanced listing display
- **7.1**: Mobile-optimized components

## Testing

Comprehensive test suites are provided for:

- Component rendering and interaction
- Form validation logic
- Error handling and display
- Accessibility compliance
- Integration with parent forms

See `__tests__/` directory for detailed test implementations.