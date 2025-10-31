import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { MobileProposalForm } from '../MobileProposalForm';
import { MobileFilterInterface } from '../MobileFilterInterface';
import { TouchFriendlyBookingCard } from '../TouchFriendlyBookingCard';
import { ResponsiveSwapPreferencesSection } from '../ResponsiveSwapPreferencesSection';
import { SwipeGestureHandler } from '../SwipeGestureHandler';
import { BookingWithSwapInfo, Booking, EnhancedBookingFilters } from '@booking-swap/shared';

// Mock hooks
vi.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isMobile: true,
    isTablet: false,
    isDesktop: false,
    breakpoint: 'sm',
    width: 375,
    height: 667,
  }),
  useTouch: () => true,
}));

// Mock design tokens
vi.mock('@/design-system/tokens', () => ({
  tokens: {
    colors: {
      primary: { 50: '#f0f4f8', 500: '#627d98', 600: '#486581' },
      neutral: { 50: '#fafaf9', 200: '#e7e5e4', 300: '#d6d3d1', 500: '#78716c', 900: '#1c1917' },
      white: '#ffffff',
      error: { 300: '#fca5a5', 600: '#dc2626' },
      warning: { 600: '#d97706' },
    },
    spacing: { 1: '0.25rem', 2: '0.5rem', 3: '0.75rem', 4: '1rem', 6: '1.5rem' },
    typography: {
      fontSize: { xs: '0.75rem', sm: '0.875rem', base: '1rem', lg: '1.125rem', xl: '1.25rem' },
      fontWeight: { medium: '500', semibold: '600' },
    },
    borderRadius: { md: '0.375rem', lg: '0.5rem', '2xl': '1rem', full: '9999px' },
    shadows: { sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)', md: '0 4px 6px -1px rgb(0 0 0 / 0.1)' },
  },
}));

// Mock UI components
vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, variant, loading, disabled, style }: any) => (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={style}
      data-variant={variant}
      data-loading={loading}
    >
      {loading ? 'Loading...' : children}
    </button>
  ),
}));

vi.mock('@/components/ui/Card', () => ({
  Card: ({ children, variant, style }: any) => (
    <div data-variant={variant} style={style}>
      {children}
    </div>
  ),
  CardContent: ({ children }: any) => <div>{children}</div>,
}));

// Test data
const mockBooking: BookingWithSwapInfo = {
  id: 'booking-1',
  title: 'Test Hotel Booking',
  description: 'A nice hotel in the city',
  type: 'hotel',
  location: { city: 'New York', country: 'USA' },
  dateRange: { checkIn: '2024-06-01', checkOut: '2024-06-05' },
  originalPrice: 500,
  swapValue: 450,
  status: 'available',
  userId: 'user-1',
  swapInfo: {
    swapId: 'swap-1',
    paymentTypes: ['booking', 'cash'],
    acceptanceStrategy: 'first-match',
    minCashAmount: 200,
    hasActiveProposals: true,
    activeProposalCount: 2,
  },
};

const mockUserBookings: Booking[] = [
  {
    id: 'user-booking-1',
    title: 'My Hotel Booking',
    description: 'My booking to swap',
    type: 'hotel',
    location: { city: 'Boston', country: 'USA' },
    dateRange: { checkIn: '2024-07-01', checkOut: '2024-07-05' },
    originalPrice: 400,
    swapValue: 380,
    status: 'available',
    userId: 'current-user',
  },
];

const mockFilters: EnhancedBookingFilters = {
  swapAvailable: false,
  acceptsCash: false,
  auctionMode: false,
  type: [],
  priceRange: { min: 0, max: 10000 },
  location: { city: '' },
};

describe('MobileProposalForm', () => {
  const defaultProps = {
    booking: mockBooking,
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    isOpen: true,
    userBookings: mockUserBookings,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders mobile proposal form when open', () => {
    render(<MobileProposalForm {...defaultProps} />);
    
    expect(screen.getByText('Make a Proposal')).toBeInTheDocument();
    expect(screen.getByText('Test Hotel Booking')).toBeInTheDocument();
  });

  it('shows proposal type selector when both booking and cash are available', () => {
    render(<MobileProposalForm {...defaultProps} />);
    
    expect(screen.getByText('How would you like to propose?')).toBeInTheDocument();
    expect(screen.getByText('Swap with my booking')).toBeInTheDocument();
    expect(screen.getByText('Make cash offer')).toBeInTheDocument();
  });

  it('handles booking selection', async () => {
    render(<MobileProposalForm {...defaultProps} />);
    
    // Should default to booking proposal type
    expect(screen.getByText('Select Your Booking')).toBeInTheDocument();
    
    // Click to expand booking selector
    fireEvent.click(screen.getByText('Choose a booking to swap...'));
    
    await waitFor(() => {
      expect(screen.getByText('My Hotel Booking')).toBeInTheDocument();
    });
  });

  it('handles cash amount input', () => {
    render(<MobileProposalForm {...defaultProps} />);
    
    // Switch to cash proposal
    fireEvent.click(screen.getByText('Make cash offer'));
    
    expect(screen.getByText('Cash Offer Amount')).toBeInTheDocument();
    
    const cashInput = screen.getByDisplayValue('200');
    fireEvent.change(cashInput, { target: { value: '300' } });
    
    expect(cashInput).toHaveValue(300);
  });

  it('validates proposal before submission', async () => {
    const onSubmit = vi.fn();
    render(<MobileProposalForm {...defaultProps} onSubmit={onSubmit} />);
    
    // Try to submit without selecting a booking
    const submitButton = screen.getByText('Send Proposal');
    expect(submitButton).toBeDisabled();
  });

  it('calls onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(<MobileProposalForm {...defaultProps} onCancel={onCancel} />);
    
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });
});

describe('MobileFilterInterface', () => {
  const defaultProps = {
    filters: mockFilters,
    onChange: vi.fn(),
    onReset: vi.fn(),
    onClose: vi.fn(),
    isOpen: true,
    resultCount: 5,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders filter interface when open', () => {
    render(<MobileFilterInterface {...defaultProps} />);
    
    expect(screen.getByText('Filter Bookings')).toBeInTheDocument();
    expect(screen.getByText('Swap Options')).toBeInTheDocument();
  });

  it('handles swap filter toggles', () => {
    const onChange = vi.fn();
    render(<MobileFilterInterface {...defaultProps} onChange={onChange} />);
    
    // Toggle "Available for Swap"
    const swapToggle = screen.getByText('Available for Swap').closest('div');
    fireEvent.click(swapToggle!);
    
    expect(onChange).toHaveBeenCalledWith({
      ...mockFilters,
      swapAvailable: true,
    });
  });

  it('shows result count in action button', () => {
    render(<MobileFilterInterface {...defaultProps} />);
    
    expect(screen.getByText('Show Results (5)')).toBeInTheDocument();
  });

  it('handles filter reset', () => {
    const onReset = vi.fn();
    render(<MobileFilterInterface {...defaultProps} onReset={onReset} />);
    
    fireEvent.click(screen.getByText(/Reset/));
    expect(onReset).toHaveBeenCalled();
  });
});

describe('TouchFriendlyBookingCard', () => {
  const defaultProps = {
    booking: mockBooking,
    userRole: 'browser' as const,
    userBookings: mockUserBookings,
    onViewDetails: vi.fn(),
    onMakeProposal: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders booking card with touch-friendly elements', () => {
    render(<TouchFriendlyBookingCard {...defaultProps} />);
    
    expect(screen.getByText('Test Hotel Booking')).toBeInTheDocument();
    expect(screen.getByText('New York, USA')).toBeInTheDocument();
    expect(screen.getByText('$450')).toBeInTheDocument();
  });

  it('shows appropriate actions for browser role', () => {
    render(<TouchFriendlyBookingCard {...defaultProps} />);
    
    expect(screen.getByText('Make Proposal')).toBeInTheDocument();
    expect(screen.getByText('View Details')).toBeInTheDocument();
  });

  it('shows owner actions for owner role', () => {
    const ownerProps = {
      ...defaultProps,
      userRole: 'owner' as const,
      onEdit: vi.fn(),
      onManageSwap: vi.fn(),
    };
    
    render(<TouchFriendlyBookingCard {...ownerProps} />);
    
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Manage Swap')).toBeInTheDocument();
  });

  it('handles proposal form opening', () => {
    render(<TouchFriendlyBookingCard {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Make Proposal'));
    
    // Should open mobile proposal form
    expect(screen.getByText('Make a Proposal')).toBeInTheDocument();
  });
});

describe('ResponsiveSwapPreferencesSection', () => {
  const defaultProps = {
    enabled: false,
    onToggle: vi.fn(),
    preferences: undefined,
    onChange: vi.fn(),
    errors: {},
    eventDate: new Date('2024-06-15'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders mobile toggle when on mobile', () => {
    render(<ResponsiveSwapPreferencesSection {...defaultProps} />);
    
    expect(screen.getByText('Make available for swapping')).toBeInTheDocument();
  });

  it('handles toggle activation', () => {
    const onToggle = vi.fn();
    render(<ResponsiveSwapPreferencesSection {...defaultProps} onToggle={onToggle} />);
    
    fireEvent.click(screen.getByText('Make available for swapping'));
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('shows options when enabled and expanded', () => {
    const enabledProps = {
      ...defaultProps,
      enabled: true,
      preferences: {
        paymentTypes: ['booking'] as ('booking' | 'cash')[],
        acceptanceStrategy: 'first-match' as const,
        swapConditions: [],
      },
    };
    
    render(<ResponsiveSwapPreferencesSection {...enabledProps} />);
    
    // Click to expand options
    fireEvent.click(screen.getByText('▼ Show Options'));
    
    expect(screen.getByText('What types of proposals will you accept?')).toBeInTheDocument();
  });
});

describe('SwipeGestureHandler', () => {
  const defaultProps = {
    children: <div>Swipeable Content</div>,
    onSwipeLeft: vi.fn(),
    onSwipeRight: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children content', () => {
    render(<SwipeGestureHandler {...defaultProps} />);
    
    expect(screen.getByText('Swipeable Content')).toBeInTheDocument();
  });

  it('shows swipe hint for touch devices', () => {
    render(<SwipeGestureHandler {...defaultProps} />);
    
    expect(screen.getByText('👈 👉 Swipe for actions')).toBeInTheDocument();
  });

  it('handles touch events', () => {
    const onSwipeRight = vi.fn();
    render(<SwipeGestureHandler {...defaultProps} onSwipeRight={onSwipeRight} />);
    
    const element = screen.getByText('Swipeable Content').parentElement!;
    
    // Simulate swipe right
    fireEvent.touchStart(element, {
      touches: [{ clientX: 100, clientY: 100 }],
    });
    
    fireEvent.touchMove(element, {
      touches: [{ clientX: 200, clientY: 100 }],
    });
    
    fireEvent.touchEnd(element);
    
    expect(onSwipeRight).toHaveBeenCalled();
  });
});

// Integration tests
describe('Mobile Components Integration', () => {
  it('mobile proposal form integrates with touch-friendly booking card', async () => {
    const onMakeProposal = vi.fn();
    
    render(
      <TouchFriendlyBookingCard
        booking={mockBooking}
        userRole="browser"
        userBookings={mockUserBookings}
        onMakeProposal={onMakeProposal}
      />
    );
    
    // Open proposal form
    fireEvent.click(screen.getByText('Make Proposal'));
    
    // Should show mobile proposal form
    expect(screen.getByText('Make a Proposal')).toBeInTheDocument();
    
    // Select a booking
    fireEvent.click(screen.getByText('Choose a booking to swap...'));
    
    await waitFor(() => {
      fireEvent.click(screen.getByText('My Hotel Booking'));
    });
    
    // Submit proposal
    const submitButton = screen.getByText('Send Proposal');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(onMakeProposal).toHaveBeenCalled();
    });
  });

  it('responsive swap preferences adapts to mobile layout', () => {
    render(
      <ResponsiveSwapPreferencesSection
        enabled={true}
        onToggle={vi.fn()}
        preferences={{
          paymentTypes: ['booking', 'cash'],
          acceptanceStrategy: 'first-match',
          swapConditions: [],
        }}
        onChange={vi.fn()}
        errors={{}}
        eventDate={new Date('2024-06-15')}
      />
    );
    
    // Should show mobile-optimized layout
    expect(screen.getByText('Make available for swapping')).toBeInTheDocument();
    
    // Expand to show options
    fireEvent.click(screen.getByText('▼ Show Options'));
    
    expect(screen.getByText('What types of proposals will you accept?')).toBeInTheDocument();
  });
});