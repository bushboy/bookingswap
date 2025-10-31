# Pending Swap Feature

This document describes the implementation of the pending swap feature that deactivates swap buttons when a booking has pending swap proposals.

## Overview

When a booking has pending swap proposals, users should not be able to create new swaps or modify the booking until the pending proposals are resolved. This prevents conflicts and ensures data integrity.

## Implementation

### 1. useBookingSwaps Hook

**Location**: `src/hooks/useBookingSwaps.ts`

This hook provides functionality to check for pending swaps on bookings:

```typescript
const { hasPendingSwaps, pendingProposals, isLoading } = useBookingSwaps(bookingId);
```

**Features**:
- Fetches pending swap proposals from `/api/swaps/booking/:bookingId/proposals`
- Filters for only `pending` status proposals
- Handles loading states and errors gracefully
- Provides a batch version `useMultipleBookingSwaps` for performance

### 2. BookingCard Component Updates

**Location**: `src/components/booking/BookingCard.tsx`

The BookingCard component now:

**Disables Actions When Pending Swaps Exist**:
- ❌ Create Swap button (disabled)
- ❌ Edit button (disabled) 
- ❌ Delete button (disabled)
- ❌ Propose Swap button (disabled in browse mode)

**Visual Indicators**:
- Shows "X Pending Swap(s)" badge below the status
- Provides helpful tooltips explaining why buttons are disabled
- Shows loading state while checking for pending swaps

**Button States**:
```typescript
// Disabled when pending swaps exist
disabled={hasPendingSwaps || isLoading}
title={hasPendingSwaps ? "Cannot create swap - X pending proposals" : "Create swap"}
```

### 3. BookingsPage Integration

**Location**: `src/pages/BookingsPage.tsx`

The BookingsPage uses `useMultipleBookingSwaps` to efficiently check all bookings at once, avoiding individual API calls for each booking card.

## API Integration

### Endpoint Used
```
GET /api/swaps/booking/:bookingId/proposals
```

**Response Format**:
```json
{
  "success": true,
  "data": [
    {
      "id": "swap-1",
      "sourceBookingId": "booking-2", 
      "targetBookingId": "booking-1",
      "proposerId": "user-2",
      "status": "pending",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

## User Experience

### Visual States

1. **No Pending Swaps** (Normal State):
   - ✅ All buttons enabled
   - ✅ Normal status badge only

2. **Pending Swaps Exist**:
   - ❌ Swap/Edit/Delete buttons disabled
   - ⚠️ "X Pending Swaps" warning badge
   - 💡 Helpful tooltips on disabled buttons

3. **Loading State**:
   - ⏳ Buttons show "Loading..." text
   - ❌ Buttons disabled during check

### Error Handling

- **404 Response**: Treated as "no pending swaps" (normal case)
- **Network Errors**: Logged but don't block UI (fail gracefully)
- **Invalid Responses**: Handled with fallback to "no pending swaps"

## Testing

### Unit Tests

**useBookingSwaps Hook Tests**:
- ✅ Returns correct pending swap status
- ✅ Handles API responses properly
- ✅ Manages loading states
- ✅ Handles errors gracefully
- ✅ Batch processing works correctly

**BookingCard Component Tests**:
- ✅ Disables buttons when pending swaps exist
- ✅ Shows pending swap badges
- ✅ Displays correct tooltips
- ✅ Handles loading states
- ✅ Works in all variants (own/browse/swap)

## Performance Considerations

1. **Batch API Calls**: `useMultipleBookingSwaps` makes parallel requests for all bookings
2. **Caching**: Hook results are cached per booking ID
3. **Debouncing**: API calls are debounced to prevent excessive requests
4. **Error Recovery**: Failed requests don't block the UI

## Future Enhancements

1. **Real-time Updates**: WebSocket integration for live pending swap updates
2. **Caching Strategy**: Implement proper cache invalidation
3. **Optimistic Updates**: Update UI immediately when actions are taken
4. **Batch Operations**: Allow bulk actions on multiple bookings

## Usage Examples

### Basic Usage
```tsx
import { useBookingSwaps } from '@/hooks/useBookingSwaps';

function MyBookingCard({ booking }) {
  const { hasPendingSwaps, pendingProposals } = useBookingSwaps(booking.id);
  
  return (
    <button disabled={hasPendingSwaps}>
      {hasPendingSwaps ? 'Swap Pending' : 'Create Swap'}
    </button>
  );
}
```

### Batch Usage
```tsx
import { useMultipleBookingSwaps } from '@/hooks/useBookingSwaps';

function BookingsList({ bookings }) {
  const { getSwapInfo } = useMultipleBookingSwaps(bookings.map(b => b.id));
  
  return bookings.map(booking => {
    const swapInfo = getSwapInfo(booking.id);
    return <BookingCard key={booking.id} booking={booking} swapInfo={swapInfo} />;
  });
}
```

This feature ensures data integrity and provides clear user feedback about why certain actions are unavailable.