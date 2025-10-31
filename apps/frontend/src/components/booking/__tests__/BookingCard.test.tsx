import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BookingCard } from '../BookingCard';
import { BookingWithSwapInfo, BookingUserRole, SwapInfo } from '@booking-swap/shared';

import { vi } from 'vitest';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(() => vi.fn()),
}));

// Mock hooks
vi.mock('@/hooks/useBookingWithWallet', () => ({
  useBookingWithWallet: vi.fn(() => ({
    enableSwappingWithWallet: vi.fn(),
    canEnableSwapping: vi.fn(() => true),
    isWalletConnected: true,
  })),
}));

// Mock swap components
vi.mock('@/components/swap/UnifiedSwapEnablement', () => ({
  UnifiedSwapEnablement: ({ isOpen, onClose, onSuccess }: any) => 
    isOpen ? <div data-testid="unified-swap-enablement">Swap Enablement Modal</div> : null,
}));

// Mock the UI components
vi.mock('@/components/ui/Card', () => ({
  Card: ({ children, ...props }: any) => <div data-testid="card" {...props}>{children}</div>,
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
}));

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

// Mock the swap components
vi.mock('../SwapStatusBadge', () => ({
  SwapStatusBadge: ({ swapInfo }: any) => (
    <div data-testid="swap-status-badge">
      {swapInfo?.hasActiveProposals ? 'Available for Swap' : 'No Swap'}
    </div>
  ),
}));

vi.mock('../SwapInfoPanel', () => ({
  SwapInfoPanel: ({ swapInfo, userRole }: any) => (
    <div data-testid="swap-info-panel">
      Swap Info - Role: {userRole}
    </div>
  ),
}));

vi.mock('../BookingActions', () => ({
  OwnerActions: ({ booking, onEdit, onEnableSwapping }: any) => (
    <div data-testid="owner-actions">
      Owner Actions for {booking.title}
      <button onClick={() => onEdit?.(booking)}>Edit</button>
      <button onClick={() => onEnableSwapping?.(booking)}>Enable Swapping</button>
    </div>
  ),
  BrowserActions: ({ booking, onMakeProposal }: any) => (
    <div data-testid="browser-actions">
      <button onClick={onMakeProposal}>Make Proposal</button>
    </div>
  ),
  ProposerActions: ({ booking }: any) => (
    <div data-testid="proposer-actions">Proposer Actions for {booking.title}</div>
  ),
}));

const mockBooking: BookingWithSwapInfo = {
  id: 'booking-1',
  userId: 'user-1',
  type: 'hotel',
  title: 'Test Hotel Booking',
  description: 'A test hotel booking',
  location: {
    city: 'New York',
    country: 'USA',
    address: '123 Test St',
    coordinates: { lat: 40.7128, lng: -74.0060 }
  },
  dateRange: {
    checkIn: new Date('2024-06-01'),
    checkOut: new Date('2024-06-03')
  },
  originalPrice: 500,
  swapValue: 450,
  providerDetails: {
    name: 'Test Hotel',
    confirmationNumber: 'TEST123'
  },
  status: 'available',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01')
};

const mockSwapInfo: SwapInfo = {
  swapId: 'swap-1',
  paymentTypes: ['booking', 'cash'],
  acceptanceStrategy: 'first-match',
  minCashAmount: 200,
  hasActiveProposals: true,
  activeProposalCount: 2,
  userProposalStatus: 'none',
  swapConditions: ['Must be in same city']
};

const mockBookingWithSwap: BookingWithSwapInfo = {
  ...mockBooking,
  swapInfo: mockSwapInfo
};

describe('BookingCard', () => {
  const defaultProps = {
    booking: mockBooking,
    userRole: 'browser' as BookingUserRole,
    onViewDetails: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders booking information correctly', () => {
    render(<BookingCard {...defaultProps} />);
    
    expect(screen.getByText('Test Hotel Booking')).toBeInTheDocument();
    expect(screen.getByText(/New York, USA/)).toBeInTheDocument();
    expect(screen.getByText('$450')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
  });

  it('shows swap indicators when swap info is available', () => {
    render(
      <BookingCard 
        {...defaultProps} 
        booking={mockBookingWithSwap}
        showSwapIndicators={true}
      />
    );
    
    expect(screen.getByTestId('swap-status-badge')).toBeInTheDocument();
    expect(screen.getByText('Available for Swap')).toBeInTheDocument();
  });

  it('hides swap indicators when showSwapIndicators is false', () => {
    render(
      <BookingCard 
        {...defaultProps} 
        booking={mockBookingWithSwap}
        showSwapIndicators={false}
      />
    );
    
    expect(screen.queryByTestId('swap-status-badge')).not.toBeInTheDocument();
  });

  it('displays payment type badges for swappable bookings', () => {
    render(
      <BookingCard 
        {...defaultProps} 
        booking={mockBookingWithSwap}
        showSwapIndicators={true}
      />
    );
    
    expect(screen.getByText('🔄')).toBeInTheDocument(); // Booking icon
    expect(screen.getByText('💰')).toBeInTheDocument(); // Cash icon
  });

  it('shows quick swap summary in compact mode', () => {
    render(
      <BookingCard 
        {...defaultProps} 
        booking={mockBookingWithSwap}
        compact={true}
        showSwapIndicators={true}
      />
    );
    
    expect(screen.getByText('💫 Available for swap')).toBeInTheDocument();
    expect(screen.getByText('Min: $200')).toBeInTheDocument();
  });

  it('displays auction countdown for urgent auctions', () => {
    const urgentAuctionSwap = {
      ...mockSwapInfo,
      acceptanceStrategy: 'auction' as const,
      timeRemaining: 2 * 60 * 60 * 1000, // 2 hours
    };

    const bookingWithUrgentAuction = {
      ...mockBooking,
      swapInfo: urgentAuctionSwap
    };

    render(
      <BookingCard 
        {...defaultProps} 
        booking={bookingWithUrgentAuction}
        showSwapIndicators={true}
      />
    );
    
    expect(screen.getByText('⏰ 2h left')).toBeInTheDocument();
  });

  it('renders owner actions for booking owner', () => {
    render(
      <BookingCard 
        {...defaultProps} 
        booking={mockBookingWithSwap}
        userRole="owner"
      />
    );
    
    expect(screen.getByTestId('owner-actions')).toBeInTheDocument();
  });

  it('renders browser actions for non-owner users', () => {
    render(
      <BookingCard 
        {...defaultProps} 
        booking={mockBookingWithSwap}
        userRole="browser"
      />
    );
    
    expect(screen.getByTestId('browser-actions')).toBeInTheDocument();
  });

  it('shows inline proposal form when showInlineProposal is true', async () => {
    const onInlineProposal = vi.fn().mockResolvedValue(undefined);
    
    render(
      <BookingCard 
        {...defaultProps} 
        booking={mockBookingWithSwap}
        userRole="browser"
        showInlineProposal={true}
        onInlineProposal={onInlineProposal}
      />
    );
    
    // Click make proposal button
    fireEvent.click(screen.getByText('Make Proposal'));
    
    // Check if inline form appears
    expect(screen.getByText('Make a Proposal')).toBeInTheDocument();
    expect(screen.getByText('🔄 Swap with my booking')).toBeInTheDocument();
    expect(screen.getByText('💰 Make cash offer')).toBeInTheDocument();
  });

  it('submits inline proposal correctly', async () => {
    const onInlineProposal = vi.fn().mockResolvedValue(undefined);
    
    render(
      <BookingCard 
        {...defaultProps} 
        booking={mockBookingWithSwap}
        userRole="browser"
        showInlineProposal={true}
        onInlineProposal={onInlineProposal}
      />
    );
    
    // Open inline form
    fireEvent.click(screen.getByText('Make Proposal'));
    
    // Select cash proposal
    fireEvent.click(screen.getByLabelText('💰 Make cash offer'));
    
    // Enter cash amount
    const cashInput = screen.getByLabelText(/Cash Offer Amount/);
    fireEvent.change(cashInput, { target: { value: '300' } });
    
    // Submit proposal
    fireEvent.click(screen.getByText('Send Proposal'));
    
    await waitFor(() => {
      expect(onInlineProposal).toHaveBeenCalledWith('booking-1', {
        type: 'cash',
        selectedBookingId: undefined,
        cashAmount: 300,
        message: undefined,
      });
    });
  });

  it('validates cash amount against minimum', () => {
    const onInlineProposal = vi.fn();
    
    render(
      <BookingCard 
        {...defaultProps} 
        booking={mockBookingWithSwap}
        userRole="browser"
        showInlineProposal={true}
        onInlineProposal={onInlineProposal}
      />
    );
    
    // Open inline form
    fireEvent.click(screen.getByText('Make Proposal'));
    
    // Select cash proposal
    fireEvent.click(screen.getByLabelText('💰 Make cash offer'));
    
    // Enter amount below minimum
    const cashInput = screen.getByLabelText(/Cash Offer Amount/);
    fireEvent.change(cashInput, { target: { value: '100' } });
    
    // Submit button should be disabled
    const submitButton = screen.getByText('Send Proposal');
    expect(submitButton).toBeDisabled();
  });

  it('handles card click for view details', () => {
    const onViewDetails = vi.fn();
    
    render(
      <BookingCard 
        {...defaultProps} 
        onViewDetails={onViewDetails}
      />
    );
    
    // Click on the card
    fireEvent.click(screen.getByTestId('card'));
    
    expect(onViewDetails).toHaveBeenCalledWith(mockBooking);
  });

  it('toggles swap details visibility', () => {
    render(
      <BookingCard 
        {...defaultProps} 
        booking={mockBookingWithSwap}
        showSwapIndicators={true}
      />
    );
    
    // Initially swap details should be hidden
    expect(screen.queryByTestId('swap-info-panel')).not.toBeInTheDocument();
    
    // Click show swap details
    fireEvent.click(screen.getByText('▶ Show Swap Details'));
    
    // Swap details should now be visible
    expect(screen.getByTestId('swap-info-panel')).toBeInTheDocument();
    
    // Click hide swap details
    fireEvent.click(screen.getByText('▼ Hide Swap Details'));
    
    // Swap details should be hidden again
    expect(screen.queryByTestId('swap-info-panel')).not.toBeInTheDocument();
  });

  it('shows user role indicator for owner', () => {
    render(
      <BookingCard 
        {...defaultProps} 
        userRole="owner"
      />
    );
    
    expect(screen.getByText('Your booking')).toBeInTheDocument();
  });

  it('auto-selects proposal type when only one option is available', () => {
    const cashOnlySwap = {
      ...mockSwapInfo,
      paymentTypes: ['cash'] as ('booking' | 'cash')[]
    };

    const bookingWithCashOnly = {
      ...mockBooking,
      swapInfo: cashOnlySwap
    };

    const onInlineProposal = vi.fn();
    
    render(
      <BookingCard 
        {...defaultProps} 
        booking={bookingWithCashOnly}
        userRole="browser"
        showInlineProposal={true}
        onInlineProposal={onInlineProposal}
      />
    );
    
    // Open inline form
    fireEvent.click(screen.getByText('Make Proposal'));
    
    // Should not show proposal type selector since only cash is available
    expect(screen.queryByText('Proposal Type')).not.toBeInTheDocument();
    
    // Should show cash input directly
    expect(screen.getByLabelText(/Cash Offer Amount/)).toBeInTheDocument();
  });

  it('calls separated action handlers for owner actions', () => {
    const onEdit = vi.fn();
    const onEnableSwapping = vi.fn();
    
    render(
      <BookingCard 
        {...defaultProps} 
        booking={mockBooking}
        userRole="owner"
        onEdit={onEdit}
        onEnableSwapping={onEnableSwapping}
      />
    );
    
    // Click edit button
    fireEvent.click(screen.getByText('Edit'));
    expect(onEdit).toHaveBeenCalledWith(mockBooking);
    
    // Click enable swapping button
    fireEvent.click(screen.getByText('Enable Swapping'));
    expect(onEnableSwapping).toHaveBeenCalledWith(mockBooking);
  });
});