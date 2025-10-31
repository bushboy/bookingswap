import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SwapBrowser } from '../SwapBrowser';
import { SwapWithBookings } from '../../../services/bookingService';

// Mock dependencies
vi.mock('../../../hooks/useDebounce', () => ({
  useDebounce: (value: any) => value,
}));

vi.mock('../../../services/SwapFilterService', () => ({
  swapFilterService: {
    applyCoreBrowsingFilters: vi.fn((swaps) => swaps),
    applyUserFilters: vi.fn((swaps) => swaps),
    getFilterSummary: vi.fn(() => 'Test filter summary'),
  },
  SwapFilters: {},
}));

vi.mock('../SwapCard', () => ({
  SwapCard: ({ swap, onAction }: any) => (
    <div data-testid={`booking-swap-${swap.id}`}>
      <h3>{swap.sourceBooking.title}</h3>
      <button onClick={() => onAction('propose', swap)}>Propose Swap</button>
    </div>
  ),
}));

vi.mock('../CashSwapCard', () => ({
  CashSwapCard: ({ swap, onMakeOffer }: any) => (
    <div data-testid={`cash-swap-${swap.id}`}>
      <h3>{swap.sourceBooking.title}</h3>
      <span>Cash Sale: ${swap.cashDetails.minAmount} - ${swap.cashDetails.maxAmount}</span>
      <button onClick={() => onMakeOffer(swap.id)}>Make Cash Offer</button>
    </div>
  ),
}));

vi.mock('../SwapProposalModal', () => ({
  SwapProposalModal: ({ isOpen, onClose }: any) => (
    isOpen ? <div data-testid="swap-proposal-modal">
      <button onClick={onClose}>Close Modal</button>
    </div> : null
  ),
}));

vi.mock('../../booking/FilterPanel', () => ({
  FilterPanel: ({ filters, onChange, mode }: any) => (
    <div data-testid="filter-panel">
      <span>Mode: {mode}</span>
      {mode === 'swap' && (
        <div>
          <label>
            <input
              type="radio"
              name="swapType"
              value="both"
              checked={!filters.swapType || filters.swapType === 'both'}
              onChange={() => onChange({ ...filters, swapType: 'both' })}
            />
            All Swaps
          </label>
          <label>
            <input
              type="radio"
              name="swapType"
              value="booking"
              checked={filters.swapType === 'booking'}
              onChange={() => onChange({ ...filters, swapType: 'booking' })}
            />
            Booking Swaps
          </label>
          <label>
            <input
              type="radio"
              name="swapType"
              value="cash"
              checked={filters.swapType === 'cash'}
              onChange={() => onChange({ ...filters, swapType: 'cash' })}
            />
            Cash Sales
          </label>
        </div>
      )}
    </div>
  ),
}));

const mockBookingSwap: SwapWithBookings = {
  id: 'booking-swap-1',
  sourceBooking: {
    id: 'booking-1',
    title: 'Hotel Booking Swap',
    type: 'hotel',
    location: { city: 'Paris', country: 'France' },
    dateRange: { checkIn: new Date('2024-06-01'), checkOut: new Date('2024-06-05') },
    swapValue: 1200,
    originalPrice: 1500,
    status: 'available',
    userId: 'owner-1',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    verification: { status: 'verified', verifiedAt: new Date('2024-01-01') },
    providerDetails: { provider: 'Booking.com', confirmationNumber: 'ABC123', bookingReference: 'REF456' },
  },
  targetBooking: {
    id: 'booking-2',
    title: 'Target Booking',
    type: 'hotel',
    location: { city: 'London', country: 'UK' },
    dateRange: { checkIn: new Date('2024-07-01'), checkOut: new Date('2024-07-05') },
    swapValue: 1100,
    originalPrice: 1400,
    status: 'available',
    userId: 'proposer-1',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    verification: { status: 'verified', verifiedAt: new Date('2024-01-01') },
    providerDetails: { provider: 'Hotels.com', confirmationNumber: 'DEF456', bookingReference: 'REF789' },
  },
  owner: { id: 'owner-1', name: 'John Doe', walletAddress: '0x123' },
  proposer: { id: 'proposer-1', name: 'Jane Smith', walletAddress: '0x456' },
  swapType: 'booking',
  hasActiveProposals: true,
  activeProposalCount: 1,
  status: 'pending',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockCashSwap: SwapWithBookings = {
  id: 'cash-swap-1',
  sourceBooking: {
    id: 'booking-3',
    title: 'Cash Sale Hotel',
    type: 'hotel',
    location: { city: 'Tokyo', country: 'Japan' },
    dateRange: { checkIn: new Date('2024-08-01'), checkOut: new Date('2024-08-05') },
    swapValue: 800,
    originalPrice: 1000,
    status: 'available',
    userId: 'owner-2',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    verification: { status: 'verified', verifiedAt: new Date('2024-01-01') },
    providerDetails: { provider: 'Expedia', confirmationNumber: 'GHI789', bookingReference: 'REF012' },
  },
  owner: { id: 'owner-2', name: 'Bob Wilson', walletAddress: '0x789' },
  proposer: { id: 'proposer-2', name: 'Alice Brown', walletAddress: '0xabc' },
  swapType: 'cash',
  cashDetails: {
    minAmount: 600,
    maxAmount: 800,
    preferredAmount: 700,
    currency: 'USD',
    paymentMethods: ['Credit Card', 'PayPal'],
    escrowRequired: true,
    platformFeePercentage: 3,
  },
  hasActiveProposals: true,
  activeProposalCount: 2,
  status: 'pending',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('Cash Swap Browsing Integration', () => {
  const mockProps = {
    swaps: [mockBookingSwap, mockCashSwap],
    userBookings: [],
    loading: false,
    error: null,
    onSwapSelect: vi.fn(),
    onSwapProposal: vi.fn(),
    currentUserId: 'test-user',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders both booking and cash swaps by default', () => {
    render(<SwapBrowser {...mockProps} />);

    expect(screen.getByTestId('booking-swap-booking-swap-1')).toBeInTheDocument();
    expect(screen.getByTestId('cash-swap-cash-swap-1')).toBeInTheDocument();
    expect(screen.getByText('Hotel Booking Swap')).toBeInTheDocument();
    expect(screen.getByText('Cash Sale Hotel')).toBeInTheDocument();
  });

  it('shows filter panel in swap mode', async () => {
    render(<SwapBrowser {...mockProps} />);

    // Open filters
    const showFiltersButton = screen.getByText('Show Filters');
    fireEvent.click(showFiltersButton);

    await waitFor(() => {
      expect(screen.getByTestId('filter-panel')).toBeInTheDocument();
      expect(screen.getByText('Mode: swap')).toBeInTheDocument();
    });
  });

  it('allows filtering by swap type', async () => {
    render(<SwapBrowser {...mockProps} />);

    // Open filters
    const showFiltersButton = screen.getByText('Show Filters');
    fireEvent.click(showFiltersButton);

    await waitFor(() => {
      expect(screen.getByText('Cash Sales')).toBeInTheDocument();
    });

    // Filter to cash swaps only
    const cashRadio = screen.getByLabelText('Cash Sales');
    fireEvent.click(cashRadio);

    // Both swaps should still be visible since we're not actually filtering in this test
    // (the actual filtering is mocked)
    expect(screen.getByTestId('booking-swap-booking-swap-1')).toBeInTheDocument();
    expect(screen.getByTestId('cash-swap-cash-swap-1')).toBeInTheDocument();
  });

  it('renders cash swap card with correct cash details', () => {
    render(<SwapBrowser {...mockProps} />);

    const cashSwapCard = screen.getByTestId('cash-swap-cash-swap-1');
    expect(cashSwapCard).toBeInTheDocument();
    expect(screen.getByText('Cash Sale: $600 - $800')).toBeInTheDocument();
  });

  it('handles cash offer action', () => {
    const mockOnSwapProposal = vi.fn();
    render(<SwapBrowser {...mockProps} onSwapProposal={mockOnSwapProposal} />);

    const makeOfferButton = screen.getByText('Make Cash Offer');
    fireEvent.click(makeOfferButton);

    // The cash offer modal should open (mocked)
    expect(screen.getByTestId('swap-proposal-modal')).toBeInTheDocument();
  });

  it('handles booking swap proposal action', () => {
    const mockOnSwapProposal = vi.fn();
    render(<SwapBrowser {...mockProps} onSwapProposal={mockOnSwapProposal} />);

    const proposeSwapButton = screen.getByText('Propose Swap');
    fireEvent.click(proposeSwapButton);

    // The swap proposal modal should open (mocked)
    expect(screen.getByTestId('swap-proposal-modal')).toBeInTheDocument();
  });

  it('displays correct swap count in results header', () => {
    render(<SwapBrowser {...mockProps} />);

    expect(screen.getByText('2 swaps available for proposals')).toBeInTheDocument();
  });

  it('shows empty state when no swaps are available', () => {
    render(<SwapBrowser {...mockProps} swaps={[]} />);

    expect(screen.getByText('No swaps available')).toBeInTheDocument();
    expect(screen.getByText(/There are no active swaps available/)).toBeInTheDocument();
  });
});