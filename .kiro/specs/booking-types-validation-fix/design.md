# Design Document

## Overview

This design addresses the booking types validation mismatch between frontend dropdowns and backend API acceptance. The investigation reveals that while both frontend and backend are configured to support 5 accommodation types (hotel, vacation_rental, resort, hostel, bnb), there may be inconsistencies in the actual validation logic or API endpoint handling.

The solution involves:
1. Comprehensive validation testing of all booking types
2. Ensuring consistent type definitions across the stack
3. Implementing proper error handling and user feedback
4. Creating a centralized configuration for booking types

## Architecture

### Current State Analysis

**Frontend Components:**
- `BookingForm.tsx` - Shows 5 accommodation types
- `BookingFormModal.tsx` - Shows 5 accommodation types  
- `UnifiedBookingForm.tsx` - Shows 5 accommodation types

**Backend Validation:**
- `packages/shared/src/validation/booking.ts` - Validates 5 accommodation types
- `packages/shared/src/validation/unified-booking.ts` - Validates 5 accommodation types

**Potential Issues:**
- API endpoint may not be using the correct validation schema
- Type definitions may be inconsistent between components
- Runtime validation may differ from schema definitions

### Target Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Shared Types   │    │   Backend API   │
│   Components    │◄──►│   & Validation   │◄──►│   Endpoints     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌────────▼────────┐              │
         │              │  Booking Types  │              │
         │              │  Configuration  │              │
         │              └─────────────────┘              │
         │                                               │
         └───────────────── Validation ──────────────────┘
```

## Components and Interfaces

### 1. Booking Types Configuration

**Location:** `packages/shared/src/config/booking-types.ts`

```typescript
export const ENABLED_BOOKING_TYPES = [
  'hotel',
  'vacation_rental', 
  'resort',
  'hostel',
  'bnb'
] as const;

export type EnabledBookingType = typeof ENABLED_BOOKING_TYPES[number];

export const BOOKING_TYPE_LABELS: Record<EnabledBookingType, { label: string; icon: string }> = {
  hotel: { label: 'Hotel', icon: '🏨' },
  vacation_rental: { label: 'Vacation Rental', icon: '🏡' },
  resort: { label: 'Resort', icon: '🏖️' },
  hostel: { label: 'Hostel', icon: '🏠' },
  bnb: { label: 'Bed & Breakfast', icon: '🛏️' },
};
```

### 2. Updated Validation Schemas

**Booking Validation Schema:**
- Import enabled types from centralized configuration
- Ensure consistent validation across all schemas
- Provide clear error messages for invalid types

**API Endpoint Validation:**
- Verify all booking endpoints use the correct validation schema
- Ensure middleware applies validation consistently
- Add logging for validation failures

### 3. Frontend Component Updates

**Dropdown Configuration:**
- Import booking types from shared configuration
- Ensure all form components use the same type definitions
- Add runtime validation before form submission

### 4. Testing Strategy

**Validation Testing:**
- Test each booking type through the complete flow
- Verify API accepts all enabled types
- Test error handling for disabled types
- Validate frontend-backend consistency

## Data Models

### Booking Type Configuration

```typescript
interface BookingTypeConfig {
  value: EnabledBookingType;
  label: string;
  icon: string;
  enabled: boolean;
}

interface BookingValidationResult {
  isValid: boolean;
  errors: string[];
  acceptedTypes: EnabledBookingType[];
}
```

### API Response Models

```typescript
interface BookingCreationResponse {
  success: boolean;
  data?: {
    booking: Booking;
  };
  error?: {
    message: string;
    code: string;
    details?: {
      field: string;
      acceptedValues: string[];
    };
  };
}
```

## Error Handling

### Validation Error Responses

**Invalid Booking Type Error:**
```json
{
  "success": false,
  "error": {
    "message": "Invalid booking type provided",
    "code": "INVALID_BOOKING_TYPE",
    "details": {
      "field": "type",
      "providedValue": "invalid_type",
      "acceptedValues": ["hotel", "vacation_rental", "resort", "hostel", "bnb"]
    }
  }
}
```

### Frontend Error Handling

- Display clear error messages when validation fails
- Show accepted booking types in error messages
- Prevent form submission with invalid types
- Provide real-time validation feedback

### Backend Error Logging

- Log validation failures with request details
- Track which booking types are being rejected
- Monitor for patterns in validation errors
- Alert on unexpected validation failures

## Testing Strategy

### Unit Tests

**Validation Schema Tests:**
- Test each enabled booking type passes validation
- Test disabled booking types are rejected
- Test invalid booking types return appropriate errors
- Test validation schema consistency

**Frontend Component Tests:**
- Test dropdown shows only enabled booking types
- Test form submission with each booking type
- Test error handling for validation failures
- Test real-time validation feedback

### Integration Tests

**API Endpoint Tests:**
- Test booking creation with each enabled type
- Test API returns appropriate errors for invalid types
- Test validation middleware applies correctly
- Test error response format consistency

**End-to-End Tests:**
- Test complete booking creation flow for each type
- Test user experience with validation errors
- Test form behavior with different booking types
- Test error message display and clarity

### Manual Testing Checklist

1. **Dropdown Verification:**
   - Verify all 5 accommodation types appear in dropdown
   - Confirm type labels and icons are correct
   - Test dropdown behavior in all form components

2. **API Validation Testing:**
   - Submit booking with each type via API directly
   - Verify successful creation for all enabled types
   - Test error responses for invalid types

3. **User Flow Testing:**
   - Complete booking creation for each type through UI
   - Verify no validation errors for enabled types
   - Test error handling and user feedback

4. **Configuration Testing:**
   - Verify centralized configuration is used consistently
   - Test enabling/disabling booking types
   - Confirm changes propagate to all components

## Implementation Approach

### Phase 1: Investigation and Diagnosis
- Test current API behavior with all booking types
- Identify specific validation failures
- Document inconsistencies between frontend and backend

### Phase 2: Centralized Configuration
- Create shared booking types configuration
- Update validation schemas to use centralized config
- Ensure consistent type definitions

### Phase 3: Frontend Updates
- Update all form components to use shared configuration
- Implement consistent error handling
- Add real-time validation feedback

### Phase 4: Backend Validation
- Verify API endpoints use correct validation
- Update error responses for clarity
- Add comprehensive logging

### Phase 5: Testing and Validation
- Execute comprehensive test suite
- Perform manual validation testing
- Document validation behavior

This design ensures that the booking types validation issue is resolved systematically, with proper testing and consistent configuration across the entire application stack.