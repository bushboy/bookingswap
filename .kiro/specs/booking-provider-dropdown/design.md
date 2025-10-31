# Design Document

## Overview

The booking provider dropdown enhancement improves the user experience for both booking creation and editing by providing a standardized list of popular booking providers while maintaining flexibility for custom entries. The design leverages the existing form infrastructure and extends it with a smart dropdown component that handles both predefined and custom provider scenarios.

## Architecture

### Component Structure

```
BookingForm (Create/Edit)
├── ProviderSection
│   ├── ProviderDropdown
│   │   ├── PredefinedOptions
│   │   └── OtherOption
│   └── CustomProviderInput (conditional)
└── ValidationLayer
```

### Data Flow

1. **Form Initialization**: Load existing provider data and determine if it's predefined or custom
2. **Provider Selection**: Handle dropdown changes and toggle custom input visibility
3. **Validation**: Validate provider selection and custom input when applicable
4. **Form Submission**: Serialize provider data for API submission

## Components and Interfaces

### Provider Data Structure

```typescript
interface BookingProvider {
  value: string;
  label: string;
  icon: string;
}

interface ProviderState {
  selectedProvider: string;
  isCustomProvider: boolean;
  customProviderName: string;
}
```

### Provider List Configuration

The provider list includes major booking platforms ordered by popularity:

1. **Online Travel Agencies (OTAs)**:
   - Booking.com (🌐)
   - Expedia (✈️)
   - Hotels.com (🏨)
   - Agoda (🌏)
   - Priceline (💰)

2. **Vacation Rentals**:
   - Airbnb (🏠)
   - Vrbo (🏡)

3. **Meta-search Engines**:
   - Kayak (🛶)
   - Trivago (🔍)
   - TripAdvisor (🦉)

4. **Hotel Chains**:
   - Marriott (🏨)
   - Hilton (🏨)
   - Hyatt (🏨)
   - IHG (🏨)

5. **Direct Booking**:
   - Hotel Direct (📞)

6. **Custom Entry**:
   - Other (📝)

### Form Integration

The provider dropdown integrates seamlessly with the existing `BookingEditForm` component:

- **Responsive Design**: Adapts to mobile, tablet, and desktop layouts
- **Accessibility**: Full keyboard navigation and screen reader support
- **Validation**: Real-time validation with error messaging
- **State Management**: Integrates with existing form state and unsaved changes detection

## Data Models

### Provider Selection Logic

```typescript
// Determine if provider is predefined or custom
const initializeProviderState = (existingProvider: string): ProviderState => {
  const isPredefined = BOOKING_PROVIDERS.some(p => p.value === existingProvider);
  
  return {
    selectedProvider: isPredefined ? existingProvider : 'Other',
    isCustomProvider: !isPredefined,
    customProviderName: isPredefined ? '' : existingProvider
  };
};
```

### Validation Rules

1. **Provider Selection**: Must select a provider from dropdown
2. **Custom Provider**: When "Other" selected, custom name is required
3. **Custom Name Validation**: 
   - Non-empty string
   - Minimum 2 characters
   - Maximum 100 characters
   - No special characters except spaces, hyphens, and periods

### API Integration

The provider data is submitted as part of the existing `providerDetails` object:

```typescript
interface BookingProviderDetails {
  provider: string; // Either predefined value or custom name
  confirmationNumber: string;
  bookingReference?: string;
}
```

## Error Handling

### Validation Errors

1. **No Provider Selected**: "Please select a booking provider"
2. **Empty Custom Provider**: "Custom provider name is required when 'Other' is selected"
3. **Invalid Custom Provider**: "Provider name must be between 2-100 characters"

### Error Display

- Errors appear below the provider dropdown
- Real-time validation provides immediate feedback
- Error styling uses consistent form error patterns
- Screen reader announcements for accessibility

## Testing Strategy

### Unit Tests

1. **Provider List Rendering**: Verify all providers display with correct icons
2. **Selection Handling**: Test dropdown selection changes
3. **Custom Provider Toggle**: Test showing/hiding custom input
4. **Validation Logic**: Test all validation scenarios
5. **Form Integration**: Test provider data in form submission

### Integration Tests

1. **Form Initialization**: Test loading existing provider data
2. **Provider Switching**: Test changing between predefined and custom
3. **Form Submission**: Test complete booking creation/update flow
4. **Error Handling**: Test validation error display and recovery

### Accessibility Tests

1. **Keyboard Navigation**: Test dropdown and custom input navigation
2. **Screen Reader**: Test announcements and labels
3. **Focus Management**: Test focus handling during provider changes
4. **High Contrast**: Test visibility in high contrast mode

### Mobile Tests

1. **Touch Interaction**: Test dropdown usability on touch devices
2. **Responsive Layout**: Test provider section on various screen sizes
3. **Virtual Keyboard**: Test custom input with mobile keyboards
4. **Performance**: Test smooth interactions on mobile devices

## Implementation Notes

### Existing Implementation Status

The booking provider dropdown functionality is **already implemented** in the current `BookingEditForm.tsx` component. The existing implementation includes:

- Complete provider list with icons
- "Other" option with custom input
- Proper validation for both scenarios
- Mobile-responsive design
- Full accessibility support

### Enhancement Opportunities

While the core functionality exists, potential improvements include:

1. **Provider Analytics**: Track which providers are most commonly used
2. **Dynamic Provider List**: Load providers from configuration API
3. **Provider Validation**: Verify provider names against known databases
4. **Auto-complete**: Suggest providers as users type in custom field
5. **Provider Icons**: Enhanced icon set with brand colors

### Backward Compatibility

The design maintains full backward compatibility:
- Existing bookings with custom providers display correctly
- Form validation works with both old and new provider formats
- API contracts remain unchanged
- No migration required for existing data