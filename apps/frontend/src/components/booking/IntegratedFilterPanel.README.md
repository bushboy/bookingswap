# IntegratedFilterPanel Component

The `IntegratedFilterPanel` component enhances the existing `FilterPanel` with swap-specific filters, providing a unified interface for filtering bookings based on both traditional criteria and swap availability.

## Features

### Swap-Specific Filters
- **SwapAvailabilityToggle**: Filter for bookings available for swapping
- **CashAcceptanceToggle**: Filter for bookings that accept cash offers  
- **AuctionModeToggle**: Filter for bookings with active auctions

### Enhanced Filter Management
- **FilterSummary**: Visual summary of active filters with count and tags
- **Reset Functionality**: Clear all filters with a single action
- **Expandable Sections**: Organized filter categories with collapsible sections

### Existing Filter Support
- Booking Type (Hotel, Event, Flight, Rental)
- Location (City, Country, Radius)
- Date Range (Check-in, Check-out, Flexible dates)
- Price Range (Min/Max pricing)
- Booking Status (Available, Locked, Swapped, Cancelled)
- Verification Status (Verified, Pending, Failed)

## Usage

```tsx
import { IntegratedFilterPanel, EnhancedBookingFilters } from '@/components/booking';

const MyComponent = () => {
  const [filters, setFilters] = useState<EnhancedBookingFilters>({});

  const handleFiltersChange = (newFilters: EnhancedBookingFilters) => {
    setFilters(newFilters);
    // Apply filters to booking search/display
  };

  const handleReset = () => {
    setFilters({});
  };

  return (
    <IntegratedFilterPanel
      filters={filters}
      onChange={handleFiltersChange}
      onReset={handleReset}
    />
  );
};
```

## Props

### IntegratedFilterPanelProps

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `filters` | `EnhancedBookingFilters` | Yes | Current filter state |
| `onChange` | `(filters: EnhancedBookingFilters) => void` | Yes | Callback when filters change |
| `onReset` | `() => void` | Yes | Callback to reset all filters |

### EnhancedBookingFilters

Extends the base `BookingFilters` interface with swap-specific properties:

```typescript
interface EnhancedBookingFilters extends BookingFilters {
  // Swap-specific filters
  swapAvailable?: boolean;
  acceptsCash?: boolean;
  auctionMode?: boolean;
  swapType?: 'booking' | 'cash' | 'both';
}
```

## Sub-Components

### SwapAvailabilityToggle
- **Purpose**: Filter for bookings available for swapping
- **Visual**: Checkbox with swap icon (🔄)
- **Styling**: Primary color scheme when active

### CashAcceptanceToggle  
- **Purpose**: Filter for bookings accepting cash offers
- **Visual**: Checkbox with money icon (💰)
- **Styling**: Success color scheme when active

### AuctionModeToggle
- **Purpose**: Filter for bookings with active auctions
- **Visual**: Checkbox with clock icon (⏰)  
- **Styling**: Warning color scheme when active

### FilterSummary
- **Purpose**: Display active filter count and details
- **Features**: 
  - Shows total count of active filters
  - Lists filter categories with visual tags
  - "No filters applied" message when empty

## Styling

The component uses the design system tokens for consistent styling:

- **Colors**: Neutral, primary, success, warning color palettes
- **Spacing**: Consistent spacing scale from tokens
- **Typography**: Font sizes and weights from design system
- **Border Radius**: Consistent border radius values

## Accessibility

- **Keyboard Navigation**: Full keyboard support for all interactive elements
- **ARIA Labels**: Proper labeling for screen readers
- **Focus Management**: Logical tab order and focus indicators
- **Screen Reader Support**: Descriptive text for swap-specific controls

## Requirements Satisfied

This component satisfies the following requirements from the specification:

- **3.1**: Filter options for "Available for Swap", "Accepts Cash", and "Auction Mode"
- **3.2**: "Available for Swap" filter shows only bookings with active swap proposals
- **3.3**: "Accepts Cash" filter shows only bookings accepting cash payments
- **3.4**: "Auction Mode" filter shows only bookings running auctions with time remaining

## Testing

The component includes comprehensive tests covering:

- Basic rendering and section display
- Swap filter toggle functionality
- Traditional filter integration
- Filter summary display
- Reset functionality
- Accessibility features
- Keyboard navigation
- Complex filter combinations

Run tests with:
```bash
npm test IntegratedFilterPanel.test.tsx
```

## Integration Notes

- Maintains backward compatibility with existing `BookingFilters`
- Can be used as a drop-in replacement for `FilterPanel`
- Integrates seamlessly with existing booking search/display logic
- Supports all existing filter functionality while adding swap features