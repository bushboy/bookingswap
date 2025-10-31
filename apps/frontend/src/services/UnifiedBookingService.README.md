# UnifiedBookingService

The `UnifiedBookingService` extends the existing `BookingService` with integrated swap operations, providing a unified interface for booking and swap management as specified in the booking swap UI simplification feature.

## Overview

This service implements the requirements for integrating swap functionality directly into booking workflows, eliminating the need for separate booking and swap creation processes.

## Key Features

### 1. Unified Booking and Swap Creation (Requirement 1.1)

- **`createBookingWithSwap(data: UnifiedBookingData)`**: Creates a booking with optional swap preferences in a single operation
- **`updateBookingWithSwap(bookingId: string, data: UpdateBookingWithSwapRequest)`**: Updates booking and associated swap preferences

### 2. Enhanced Booking Listings (Requirements 2.1, 3.1)

- **`getBookingsWithSwapInfo(filters: EnhancedBookingFilters, currentUserId: string)`**: Retrieves bookings with integrated swap information and applies swap-specific filtering
- **`applyBrowsingRestrictions(bookings, currentUserId)`**: Filters out user's own bookings and applies browsing restrictions

### 3. Inline Proposal Management (Requirement 4.1)

- **`makeInlineProposal(bookingId: string, proposalData: InlineProposalData)`**: Creates swap proposals directly from booking listings
- **`getUserRoleForBooking(bookingId: string, userId: string)`**: Determines user role (owner/browser/proposer) for booking interactions

### 4. User Context and Utilities

- **`getUserAvailableBookings(userId: string, excludeBookingId?: string)`**: Gets user's available bookings for swap proposals

## Usage Examples

### Creating a Booking with Swap Preferences

```typescript
import { unifiedBookingService } from './services/UnifiedBookingService';

const bookingData: UnifiedBookingData = {
  type: 'hotel',
  title: 'Luxury Hotel in NYC',
  description: 'Beautiful hotel room with city view',
  location: { city: 'New York', country: 'USA' },
  dateRange: {
    checkIn: new Date('2024-06-01'),
    checkOut: new Date('2024-06-05')
  },
  originalPrice: 800,
  swapValue: 800,
  providerDetails: {
    provider: 'Booking.com',
    confirmationNumber: 'ABC123',
    bookingReference: 'REF456'
  },
  swapEnabled: true,
  swapPreferences: {
    paymentTypes: ['booking', 'cash'],
    minCashAmount: 300,
    acceptanceStrategy: 'auction',
    auctionEndDate: new Date('2024-05-25'),
    swapConditions: ['Non-smoking room', 'City view preferred']
  }
};

try {
  const result = await unifiedBookingService.createBookingWithSwap(bookingData);
  console.log('Booking created:', result.booking);
  console.log('Swap enabled:', result.swap);
} catch (error) {
  console.error('Failed to create booking with swap:', error);
}
```

### Getting Bookings with Swap Information

```typescript
const filters: EnhancedBookingFilters = {
  location: { city: 'New York' },
  dateRange: {
    start: new Date('2024-06-01'),
    end: new Date('2024-06-30')
  },
  swapAvailable: true,
  acceptsCash: true,
  priceRange: { min: 200, max: 1000 },
  sortBy: 'auction_end_date',
  sortOrder: 'asc'
};

const bookingsWithSwapInfo = await unifiedBookingService.getBookingsWithSwapInfo(
  filters,
  'current-user-id'
);

bookingsWithSwapInfo.forEach(booking => {
  console.log(`Booking: ${booking.title}`);
  if (booking.swapInfo) {
    console.log(`Swap available: ${booking.swapInfo.paymentTypes.join(', ')}`);
    console.log(`Active proposals: ${booking.swapInfo.activeProposalCount}`);
  }
});
```

### Making an Inline Proposal

```typescript
// Booking proposal
const bookingProposal: InlineProposalData = {
  type: 'booking',
  selectedBookingId: 'user-booking-123',
  message: 'Would love to swap my beach resort for your city hotel!',
  conditions: ['Flexible check-in time']
};

// Cash proposal
const cashProposal: InlineProposalData = {
  type: 'cash',
  cashAmount: 500,
  paymentMethodId: 'payment-method-456',
  message: 'Offering cash for your booking'
};

try {
  const proposal = await unifiedBookingService.makeInlineProposal(
    'target-booking-id',
    bookingProposal
  );
  console.log('Proposal submitted:', proposal);
} catch (error) {
  console.error('Failed to submit proposal:', error);
}
```

### Updating Booking with Swap Preferences

```typescript
const updateRequest: UpdateBookingWithSwapRequest = {
  bookingData: {
    title: 'Updated Hotel Booking',
    description: 'Updated description with more details'
  },
  swapEnabled: true,
  swapPreferences: {
    paymentTypes: ['cash'],
    minCashAmount: 400,
    acceptanceStrategy: 'first-match',
    swapConditions: ['Updated conditions']
  }
};

const result = await unifiedBookingService.updateBookingWithSwap(
  'booking-id',
  updateRequest
);
```

## Data Validation

The service includes comprehensive validation for:

### Booking Data Validation
- Required fields (title, description, location, dates, price)
- Date range validation (check-out after check-in, future dates)
- Price validation (positive values)
- Provider details validation

### Swap Preferences Validation
- Payment types selection (at least one required)
- Cash amount validation (positive values when cash enabled)
- Auction date validation (at least one week before event)
- Swap conditions validation

### Inline Proposal Validation
- Proposal type validation
- Required fields based on proposal type
- Cash amount and payment method validation for cash proposals
- Selected booking validation for booking proposals

## Error Handling

The service provides comprehensive error handling with specific error types:

- **ValidationError**: For invalid input data
- **BusinessLogicError**: For business rule violations
- **SwapPlatformError**: For platform-specific errors
- **Network errors**: For connectivity issues

## Integration with Existing Services

The `UnifiedBookingService` integrates with:

- **BookingService**: For core booking operations
- **SwapService**: For swap-related operations
- **Backend API**: For enhanced swap endpoints

## Testing

The service includes comprehensive test coverage:

- **Unit tests**: Individual method testing with mocked dependencies
- **Integration tests**: Service instantiation and method validation
- **Validation tests**: Input validation and error handling
- **Filter tests**: Booking filtering and sorting functionality

## Requirements Mapping

This implementation addresses the following requirements:

- **1.1**: Integrated Booking and Swap Creation
- **2.1**: Booking Listings with Integrated Swap Actions  
- **2.2**: Enhanced booking listings with swap information
- **3.1**: Streamlined Booking Discovery and Filtering
- **4.1**: Quick Proposal Management from Listings

## API Endpoints Used

The service interacts with the following backend endpoints:

- `POST /swaps/enhanced` - Create enhanced swap with preferences
- `PUT /swaps/enhanced/:id` - Update existing swap preferences
- `GET /swaps/info/:bookingId` - Get swap information for booking
- `GET /swaps/by-booking/:bookingId` - Get swap by booking ID
- `POST /swaps/:swapId/proposals/booking` - Create booking proposal
- `POST /swaps/:swapId/proposals/cash` - Create cash proposal
- `POST /swaps/:swapId/cancel` - Cancel swap

## Performance Considerations

- **Batch operations**: Fetches swap info for multiple bookings efficiently
- **Filtering optimization**: Applies core filters before swap-specific filters
- **Pagination support**: Handles large result sets with offset/limit
- **Caching**: Leverages existing service caching where possible

## Security Considerations

- **Authentication**: Uses existing auth token mechanism
- **Authorization**: Respects user ownership and permissions
- **Input validation**: Comprehensive validation prevents malicious input
- **Error handling**: Prevents information leakage through error messages