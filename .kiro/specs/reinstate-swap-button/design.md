# Design Document

## Overview

This design reinstates the "Create Swap" button on booking cards within the booking listing interface. The solution modifies the existing `OwnerActions` component to include a "Create Swap" button when no active swap exists for a booking. The button integrates with the existing `EnhancedSwapCreationModal` component to provide a seamless swap creation experience directly from the booking card.

The design leverages the existing React component architecture and maintains consistency with the current UI patterns while adding the missing swap initiation functionality.

## Architecture

### Component Modification Strategy

The design focuses on enhancing the existing `OwnerActions` component rather than creating new components, ensuring minimal disruption to the current architecture:

```
BookingCard (existing)
├── CardContent (existing)
├── SwapStatusBadge (existing)
├── SwapInfoPanel (existing)
└── OwnerActions (modified)
    ├── Edit Button (existing)
    ├── Create Swap Button (new) ← Main addition
    ├── Manage Swap Button (existing)
    └── View Proposals Button (existing)
```

### State Management Integration

The design integrates with the existing Redux state management without requiring new state structures:

```typescript
// Existing state structure remains unchanged
interface BookingState {
  bookings: BookingWithSwapInfo[];
  loading: boolean;
  error: string | null;
}

interface SwapState {
  swaps: SwapWithBookings[];
  loading: boolean;
  error: string | null;
}

// UI state for modal management (existing)
interface UIState {
  modals: {
    swapCreation: {
      isOpen: boolean;
      bookingId?: string;
    };
  };
}
```

## Components and Interfaces

### Enhanced OwnerActions Component

The primary modification involves updating the `OwnerActions` component to include the "Create Swap" button:

```typescript
interface OwnerActionsProps {
  booking: Booking;
  swapInfo?: SwapInfo;
  onEdit?: (booking: Booking) => void;
  onManageSwap?: (swapInfo: SwapInfo) => void;
  onCreateSwap?: (booking: Booking) => void; // This prop already exists
  onViewProposals?: (swapInfo: SwapInfo) => void;
}

export const OwnerActions: React.FC<OwnerActionsProps> = ({
  booking,
  swapInfo,
  onEdit,
  onManageSwap,
  onCreateSwap,
  onViewProposals
}) => {
  const hasActiveSwap = swapInfo?.hasActiveProposals;
  const hasPendingProposals = swapInfo?.activeProposalCount && swapInfo.activeProposalCount > 0;
  const isBookingActive = booking.status === 'available';
  const canCreateSwap = isBookingActive && !hasActiveSwap && onCreateSwap;

  const actionsStyles = {
    display: 'flex',
    gap: tokens.spacing[2],
    flexWrap: 'wrap' as const,
  };

  const getCreateSwapTooltip = (): string => {
    if (!isBookingActive) {
      return 'Cannot create swap for inactive booking';
    }
    if (hasActiveSwap) {
      return 'Booking already has an active swap';
    }
    return 'Create a swap proposal for this booking';
  };

  return (
    <div style={actionsStyles}>
      {/* Edit Button - Existing */}
      <Button
        variant="outline"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          onEdit?.(booking);
        }}
        disabled={!isBookingActive}
        title={
          !isBookingActive
            ? 'Cannot edit inactive booking'
            : 'Edit booking details only'
        }
      >
        Edit
      </Button>

      {/* Create Swap Button - New Addition */}
      {!hasActiveSwap && (
        <Button
          variant="primary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onCreateSwap?.(booking);
          }}
          disabled={!canCreateSwap}
          title={getCreateSwapTooltip()}
        >
          Create Swap
        </Button>
      )}

      {/* Existing Swap Management Buttons */}
      {hasActiveSwap && swapInfo && (
        <>
          <Button
            variant="primary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onManageSwap?.(swapInfo);
            }}
            title="Manage swap settings"
          >
            Manage Swap
          </Button>

          {hasPendingProposals && (
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onViewProposals?.(swapInfo);
              }}
              title={`View ${swapInfo.activeProposalCount} pending proposal${swapInfo.activeProposalCount > 1 ? 's' : ''}`}
            >
              View Proposals ({swapInfo.activeProposalCount})
            </Button>
          )}
        </>
      )}
    </div>
  );
};
```

### Button State Logic

The "Create Swap" button visibility and state are determined by the following logic:

```typescript
interface SwapButtonState {
  visible: boolean;
  enabled: boolean;
  tooltip: string;
  variant: 'primary' | 'secondary' | 'outline';
}

const getSwapButtonState = (
  booking: Booking,
  swapInfo?: SwapInfo,
  onCreateSwap?: (booking: Booking) => void
): SwapButtonState => {
  const hasActiveSwap = swapInfo?.hasActiveProposals;
  const isBookingActive = booking.status === 'available';
  const hasCreateHandler = Boolean(onCreateSwap);

  // Button is not visible if there's already an active swap
  if (hasActiveSwap) {
    return {
      visible: false,
      enabled: false,
      tooltip: '',
      variant: 'primary'
    };
  }

  // Button is visible but disabled if booking is not active
  if (!isBookingActive) {
    return {
      visible: true,
      enabled: false,
      tooltip: 'Cannot create swap for inactive booking',
      variant: 'primary'
    };
  }

  // Button is visible but disabled if no handler is provided
  if (!hasCreateHandler) {
    return {
      visible: true,
      enabled: false,
      tooltip: 'Swap creation not available',
      variant: 'primary'
    };
  }

  // Button is fully functional
  return {
    visible: true,
    enabled: true,
    tooltip: 'Create a swap proposal for this booking',
    variant: 'primary'
  };
};
```

### Integration with Existing Modal System

The design leverages the existing `EnhancedSwapCreationModal` without modifications:

```typescript
// Parent component (e.g., BookingsPage) handles modal state
const BookingsPage: React.FC = () => {
  const [swapCreationModal, setSwapCreationModal] = useState<{
    isOpen: boolean;
    booking: Booking | null;
  }>({
    isOpen: false,
    booking: null
  });

  const handleCreateSwap = (booking: Booking) => {
    setSwapCreationModal({
      isOpen: true,
      booking
    });
  };

  const handleCloseSwapModal = () => {
    setSwapCreationModal({
      isOpen: false,
      booking: null
    });
  };

  const handleSwapSubmit = async (data: EnhancedCreateSwapRequest) => {
    try {
      await dispatch(createEnhancedSwapThunk(data));
      handleCloseSwapModal();
      // Refresh bookings to show updated swap status
      dispatch(fetchBookingsThunk());
    } catch (error) {
      // Error handling is managed by the modal component
      console.error('Swap creation failed:', error);
    }
  };

  return (
    <>
      {/* Booking listings with enhanced cards */}
      {bookings.map(booking => (
        <BookingCard
          key={booking.id}
          booking={booking}
          userRole="owner"
          onCreateSwap={handleCreateSwap}
          // ... other props
        />
      ))}

      {/* Existing swap creation modal */}
      <EnhancedSwapCreationModal
        isOpen={swapCreationModal.isOpen}
        onClose={handleCloseSwapModal}
        booking={swapCreationModal.booking}
        onSubmit={handleSwapSubmit}
      />
    </>
  );
};
```

## Data Models

### Button Configuration Interface

```typescript
interface SwapButtonConfig {
  showCreateButton: boolean;
  buttonEnabled: boolean;
  tooltipText: string;
  buttonVariant: 'primary' | 'secondary' | 'outline';
}

interface SwapButtonProps {
  booking: Booking;
  swapInfo?: SwapInfo;
  config: SwapButtonConfig;
  onClick: (booking: Booking) => void;
}
```

### Enhanced Props Interface

The existing `BookingCardProps` interface already includes the necessary `onCreateSwap` prop:

```typescript
// No changes needed to existing interfaces
export interface BookingCardProps {
  booking: BookingWithSwapInfo;
  userRole: BookingUserRole;
  onEdit?: (booking: Booking) => void;
  onDelete?: (bookingId: string) => void;
  onViewDetails?: (booking: Booking) => void;
  onCreateSwap?: (booking: Booking) => void; // Already exists
  onMakeProposal?: () => void;
  onManageSwap?: (swapInfo: SwapInfo) => void;
  onViewProposals?: (swapInfo: SwapInfo) => void;
  // ... other existing props
}
```

## Error Handling

### Button State Error Handling

```typescript
const SwapButtonWithErrorHandling: React.FC<{
  booking: Booking;
  swapInfo?: SwapInfo;
  onCreateSwap?: (booking: Booking) => void;
}> = ({ booking, swapInfo, onCreateSwap }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateSwap = async (booking: Booking) => {
    if (!onCreateSwap) return;

    setIsLoading(true);
    setError(null);

    try {
      await onCreateSwap(booking);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create swap');
    } finally {
      setIsLoading(false);
    }
  };

  const buttonState = getSwapButtonState(booking, swapInfo, onCreateSwap);

  if (!buttonState.visible) return null;

  return (
    <>
      <Button
        variant={buttonState.variant}
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          handleCreateSwap(booking);
        }}
        disabled={!buttonState.enabled || isLoading}
        title={error || buttonState.tooltip}
      >
        {isLoading ? 'Creating...' : 'Create Swap'}
      </Button>
      {error && (
        <div style={{ 
          fontSize: tokens.typography.fontSize.xs,
          color: tokens.colors.error[600],
          marginTop: tokens.spacing[1]
        }}>
          {error}
        </div>
      )}
    </>
  );
};
```

### Error Recovery Strategies

- **Network Failures**: Retry mechanism with exponential backoff
- **Validation Errors**: Display inline error messages with corrective guidance
- **Permission Errors**: Hide button and show appropriate messaging
- **Concurrent Modifications**: Refresh booking data and retry

## Testing Strategy

### Unit Tests

```typescript
describe('OwnerActions with Create Swap Button', () => {
  it('should show Create Swap button when no active swap exists', () => {
    const mockOnCreateSwap = jest.fn();
    
    render(
      <OwnerActions
        booking={mockActiveBooking}
        swapInfo={undefined}
        onCreateSwap={mockOnCreateSwap}
      />
    );

    expect(screen.getByText('Create Swap')).toBeInTheDocument();
    expect(screen.queryByText('Manage Swap')).not.toBeInTheDocument();
  });

  it('should hide Create Swap button when active swap exists', () => {
    render(
      <OwnerActions
        booking={mockActiveBooking}
        swapInfo={mockActiveSwapInfo}
        onCreateSwap={jest.fn()}
      />
    );

    expect(screen.queryByText('Create Swap')).not.toBeInTheDocument();
    expect(screen.getByText('Manage Swap')).toBeInTheDocument();
  });

  it('should disable Create Swap button for inactive bookings', () => {
    render(
      <OwnerActions
        booking={mockInactiveBooking}
        swapInfo={undefined}
        onCreateSwap={jest.fn()}
      />
    );

    const createButton = screen.getByText('Create Swap');
    expect(createButton).toBeDisabled();
    expect(createButton).toHaveAttribute('title', 'Cannot create swap for inactive booking');
  });

  it('should call onCreateSwap when button is clicked', () => {
    const mockOnCreateSwap = jest.fn();
    
    render(
      <OwnerActions
        booking={mockActiveBooking}
        swapInfo={undefined}
        onCreateSwap={mockOnCreateSwap}
      />
    );

    fireEvent.click(screen.getByText('Create Swap'));
    expect(mockOnCreateSwap).toHaveBeenCalledWith(mockActiveBooking);
  });

  it('should prevent event propagation when button is clicked', () => {
    const mockOnCreateSwap = jest.fn();
    const mockCardClick = jest.fn();
    
    render(
      <div onClick={mockCardClick}>
        <OwnerActions
          booking={mockActiveBooking}
          swapInfo={undefined}
          onCreateSwap={mockOnCreateSwap}
        />
      </div>
    );

    fireEvent.click(screen.getByText('Create Swap'));
    expect(mockOnCreateSwap).toHaveBeenCalled();
    expect(mockCardClick).not.toHaveBeenCalled();
  });
});
```

### Integration Tests

```typescript
describe('Booking Card Swap Creation Integration', () => {
  it('should open swap creation modal when Create Swap is clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <BookingsPage />
    );

    // Wait for bookings to load
    await waitFor(() => {
      expect(screen.getByText(mockBooking.title)).toBeInTheDocument();
    });

    // Click Create Swap button
    const createSwapButton = screen.getByText('Create Swap');
    await user.click(createSwapButton);

    // Verify modal opens
    expect(screen.getByText('Create Enhanced Swap')).toBeInTheDocument();
    expect(screen.getByDisplayValue(mockBooking.title)).toBeInTheDocument();
  });

  it('should update button state after successful swap creation', async () => {
    const user = userEvent.setup();
    mockCreateEnhancedSwap.mockResolvedValue(mockSwap);
    
    render(<BookingsPage />);

    // Click Create Swap
    await user.click(screen.getByText('Create Swap'));

    // Fill and submit form
    await user.type(screen.getByLabelText('Swap Title'), 'Test Swap');
    await user.click(screen.getByText('Create Swap'));

    // Wait for swap creation and UI update
    await waitFor(() => {
      expect(screen.queryByText('Create Swap')).not.toBeInTheDocument();
      expect(screen.getByText('Manage Swap')).toBeInTheDocument();
    });
  });
});
```

### Accessibility Tests

```typescript
describe('Create Swap Button Accessibility', () => {
  it('should have proper ARIA attributes', () => {
    render(
      <OwnerActions
        booking={mockActiveBooking}
        swapInfo={undefined}
        onCreateSwap={jest.fn()}
      />
    );

    const button = screen.getByText('Create Swap');
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('title', 'Create a swap proposal for this booking');
  });

  it('should be keyboard accessible', () => {
    const mockOnCreateSwap = jest.fn();
    
    render(
      <OwnerActions
        booking={mockActiveBooking}
        swapInfo={undefined}
        onCreateSwap={mockOnCreateSwap}
      />
    );

    const button = screen.getByText('Create Swap');
    button.focus();
    fireEvent.keyDown(button, { key: 'Enter' });
    
    expect(mockOnCreateSwap).toHaveBeenCalled();
  });

  it('should have sufficient color contrast', () => {
    render(
      <OwnerActions
        booking={mockActiveBooking}
        swapInfo={undefined}
        onCreateSwap={jest.fn()}
      />
    );

    const button = screen.getByText('Create Swap');
    const styles = window.getComputedStyle(button);
    
    // Verify contrast meets WCAG AA standards
    expect(getContrastRatio(styles.color, styles.backgroundColor)).toBeGreaterThan(4.5);
  });
});
```

## Mobile and Responsive Design

### Button Layout Adaptation

```typescript
const responsiveActionsStyles = {
  display: 'flex',
  gap: tokens.spacing[2],
  flexWrap: 'wrap' as const,
  
  // Mobile-first responsive design
  '@media (max-width: 768px)': {
    flexDirection: 'column' as const,
    gap: tokens.spacing[1],
  },
  
  '@media (max-width: 480px)': {
    '& button': {
      fontSize: tokens.typography.fontSize.sm,
      padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
      minHeight: '44px', // Touch-friendly minimum
    }
  }
};
```

### Touch Target Optimization

```typescript
const mobileButtonStyles = {
  minHeight: '44px', // iOS/Android touch target minimum
  minWidth: '44px',
  padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
  fontSize: tokens.typography.fontSize.sm,
  
  // Ensure adequate spacing between buttons
  '&:not(:last-child)': {
    marginRight: tokens.spacing[2],
    
    '@media (max-width: 768px)': {
      marginRight: 0,
      marginBottom: tokens.spacing[1],
    }
  }
};
```

## Performance Considerations

### Rendering Optimization

```typescript
// Memoize button state calculation to prevent unnecessary re-renders
const MemoizedSwapButton = React.memo<SwapButtonProps>(({ booking, swapInfo, onCreateSwap }) => {
  const buttonState = useMemo(
    () => getSwapButtonState(booking, swapInfo, onCreateSwap),
    [booking.status, swapInfo?.hasActiveProposals, onCreateSwap]
  );

  if (!buttonState.visible) return null;

  return (
    <Button
      variant={buttonState.variant}
      size="sm"
      onClick={(e) => {
        e.stopPropagation();
        onCreateSwap?.(booking);
      }}
      disabled={!buttonState.enabled}
      title={buttonState.tooltip}
    >
      Create Swap
    </Button>
  );
});
```

### Event Handler Optimization

```typescript
// Use useCallback to prevent unnecessary re-renders of child components
const BookingCard: React.FC<BookingCardProps> = ({ booking, onCreateSwap, ...props }) => {
  const handleCreateSwap = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onCreateSwap?.(booking);
  }, [booking, onCreateSwap]);

  return (
    <Card>
      {/* Card content */}
      <OwnerActions
        booking={booking}
        onCreateSwap={handleCreateSwap}
        {...props}
      />
    </Card>
  );
};
```

This design provides a comprehensive solution for reinstating the swap button while maintaining consistency with the existing codebase and ensuring proper integration with current functionality.