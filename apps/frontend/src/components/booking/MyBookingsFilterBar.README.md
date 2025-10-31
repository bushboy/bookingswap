# MyBookingsFilterBar Component

A simplified filter bar component designed specifically for personal booking management. This component replaces the complex `IntegratedFilterPanel` for "My Bookings" pages where users manage their own bookings rather than browsing other users' bookings.

## Purpose

The `MyBookingsFilterBar` provides a clean, tab-based interface for filtering personal bookings by status. It's designed to be:

- **Simple**: Only essential filters for personal booking management
- **Clear**: Visual status indicators with booking counts
- **Accessible**: Full keyboard navigation and screen reader support
- **Mobile-friendly**: Horizontal scrolling tabs that work on all devices

## Features

- **Status-based filtering**: All, Active, With Swaps, Completed, Expired
- **Booking count badges**: Shows the number of bookings in each category
- **Visual feedback**: Active state styling and hover effects
- **Accessibility**: ARIA labels, keyboard navigation, and screen reader support
- **Responsive design**: Horizontal scrolling on mobile devices

## Usage

```tsx
import { MyBookingsFilterBar, MyBookingsStatus } from '@/components/booking/MyBookingsFilterBar';

const [currentFilter, setCurrentFilter] = useState<MyBookingsStatus>('all');

const bookingCounts = {
  all: 10,
  active: 5,
  with_swaps: 2,
  completed: 2,
  expired: 1,
};

<MyBookingsFilterBar
  currentFilter={currentFilter}
  bookingCounts={bookingCounts}
  onChange={setCurrentFilter}
/>
```

## Props

### `MyBookingsFilterBarProps`

| Prop | Type | Description |
|------|------|-------------|
| `currentFilter` | `MyBookingsStatus` | Currently active filter status |
| `bookingCounts` | `Record<MyBookingsStatus, number>` | Count of bookings for each status |
| `onChange` | `(status: MyBookingsStatus) => void` | Callback when filter changes |

### `MyBookingsStatus`

```tsx
type MyBookingsStatus = 'all' | 'active' | 'with_swaps' | 'completed' | 'expired';
```

## Filter Categories

| Status | Description | Icon |
|--------|-------------|------|
| `all` | All your bookings | 📋 |
| `active` | Current and upcoming bookings | ✅ |
| `with_swaps` | Bookings with active swap proposals | 🔄 |
| `completed` | Past bookings and completed swaps | ✔️ |
| `expired` | Expired or cancelled bookings | ⏰ |

## Implementation Notes

### Replacing IntegratedFilterPanel

This component is designed to replace `IntegratedFilterPanel` in personal booking management contexts:

```tsx
// Before (complex filtering)
<IntegratedFilterPanel
  filters={filters}
  onChange={handleFilterChange}
  onReset={handleFilterReset}
/>

// After (simplified filtering)
<MyBookingsFilterBar
  currentFilter={statusFilter}
  bookingCounts={bookingCounts}
  onChange={setStatusFilter}
/>
```

### Calculating Booking Counts

You'll need to calculate booking counts based on your booking data:

```tsx
const calculateBookingCounts = (bookings: BookingWithSwapInfo[]): Record<MyBookingsStatus, number> => {
  const counts = {
    all: bookings.length,
    active: 0,
    with_swaps: 0,
    completed: 0,
    expired: 0,
  };

  bookings.forEach(booking => {
    const now = new Date();
    const eventDate = new Date(booking.dateRange.end);
    
    if (booking.status === 'cancelled' || eventDate < now) {
      counts.expired++;
    } else if (booking.swapInfo?.hasActiveProposals || booking.swapInfo?.swapId) {
      counts.with_swaps++;
      counts.active++;
    } else if (booking.status === 'available') {
      counts.active++;
    } else {
      counts.completed++;
    }
  });

  return counts;
};
```

## Accessibility Features

- **Keyboard Navigation**: Tab through filters, activate with Enter/Space
- **Screen Reader Support**: Descriptive ARIA labels and live regions
- **High Contrast**: Supports high contrast mode
- **Focus Management**: Clear focus indicators

## Styling

The component uses the design system tokens for consistent styling:

- Colors: Primary, neutral, and semantic color scales
- Typography: Consistent font sizes and weights
- Spacing: Standard spacing tokens
- Border Radius: Consistent rounded corners

## Mobile Considerations

- Horizontal scrolling for filter tabs on small screens
- Touch-friendly tap targets (minimum 44px)
- Responsive text sizing
- Optimized for thumb navigation

## Testing

The component includes comprehensive tests covering:

- Rendering all filter tabs with correct counts
- Click and keyboard interaction handling
- Accessibility features
- Edge cases (zero counts, singular/plural text)

Run tests with:
```bash
npm test MyBookingsFilterBar.test.tsx
```

## Migration Guide

### From IntegratedFilterPanel

1. Replace the import:
   ```tsx
   // Remove
   import { IntegratedFilterPanel } from '@/components/booking/IntegratedFilterPanel';
   
   // Add
   import { MyBookingsFilterBar } from '@/components/booking/MyBookingsFilterBar';
   ```

2. Update state management:
   ```tsx
   // Before
   const [filters, setFilters] = useState<EnhancedBookingFilters>({});
   
   // After
   const [statusFilter, setStatusFilter] = useState<MyBookingsStatus>('all');
   ```

3. Replace the component:
   ```tsx
   // Before
   <IntegratedFilterPanel
     filters={filters}
     onChange={handleFilterChange}
     onReset={handleFilterReset}
   />
   
   // After
   <MyBookingsFilterBar
     currentFilter={statusFilter}
     bookingCounts={bookingCounts}
     onChange={setStatusFilter}
   />
   ```

4. Update filtering logic to use simple status-based filtering instead of complex filter objects.