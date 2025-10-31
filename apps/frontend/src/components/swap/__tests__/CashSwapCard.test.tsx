import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CashSwapCard } from '../CashSwapCard';
import { SwapWithBookings } from '../../../services/bookingService';

// Mock the responsive hook
vi.mock('../../../hooks/useResponsive', () => ({
  useResponsive: () => ({
    isMobile: false,
    isTablet: false,
  }),
}));

const mockCashSwap: SwapWithBookings = {
  id: 'cash-swap-1',
  sourceBooking: {
    id: 'booking-1',
    title: 'Luxury Hotel in Paris',
    type: 'hotel',
    location: {
      city: 'Paris',
      country: 'France',
    },
    dateRange: {
      checkIn: new Date('2024-06-01'),
      checkOut: new Date('2024-06-05'),
    },
    swapValue: 1200,
    originalPrice: 1500,
    status: 'available',
    userId: 'owner-1',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    verification: {
      status: 'verified',
      verifiedAt: new Date('2024-01-01'),
    },
    providerDetails: {
      provider: 'Booking.com',
      confirmationNumber: 'ABC123',
      bookingReference: 'REF456',
    },
  },
  owner: {
    id: 'owner-1',
    name: 'John Doe',
    walletAddress: '0x123',
  },
  proposer: {
    id: 'proposer-1',
    name: 'Jane Smith',
    walletAddress: '0x456',
  },
  swapType: 'cash',
  cashDetails: {
    minAmount: 800,
    maxAmount: 1200,
    preferredAmount: 1000,
    currency: 'USD',
    paymentMethods: ['Credit Card', 'Bank Transfer'],
    escrowRequired: true,
    platformFeePercentage: 3,
  },
  hasActiveProposals: true,
  activeProposalCount: 2,
  status: 'pending',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('CashSwapCard', () => {
  const mockOnMakeOffer = vi.fn();
  const mockOnViewOffers = vi.fn();
  const mockOnViewDetails = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders cash swap card with correct information', () => {
    render(
      <CashSwapCard
        swap={mockCashSwap}
        onMakeOffer={mockOnMakeOffer}
        onViewOffers={mockOnViewOffers}
        onViewDetails={mockOnViewDetails}
        currentUserId="different-user"
      />
    );

    expect(screen.getByText('Cash Sale')).toBeInTheDocument();
    expect(screen.getByText('Luxury Hotel in Paris')).toBeInTheDocument();
    expect(screen.getByText('Paris, France')).toBeInTheDocument();
    expect(screen.getByText('$800.00 - $1,200.00')).toBeInTheDocument();
    expect(screen.getByText('Preferred: $1,000.00')).toBeInTheDocument();
    expect(screen.getByText('Credit Card')).toBeInTheDocument();
    expect(screen.getByText('Bank Transfer')).toBeInTheDocument();
    expect(screen.getByText('Secure escrow protection included')).toBeInTheDocument();
  });

  it('shows make offer button for non-owner users', () => {
    render(
      <CashSwapCard
        swap={mockCashSwap}
        onMakeOffer={mockOnMakeOffer}
        onViewOffers={mockOnViewOffers}
        onViewDetails={mockOnViewDetails}
        currentUserId="different-user"
      />
    );

    const makeOfferButton = screen.getByText('Make Cash Offer');
    expect(makeOfferButton).toBeInTheDocument();
    
    fireEvent.click(makeOfferButton);
    expect(mockOnMakeOffer).toHaveBeenCalledWith('cash-swap-1');
  });

  it('shows view offers button for owner users', () => {
    render(
      <CashSwapCard
        swap={mockCashSwap}
        onMakeOffer={mockOnMakeOffer}
        onViewOffers={mockOnViewOffers}
        onViewDetails={mockOnViewDetails}
        currentUserId="owner-1"
      />
    );

    const viewOffersButton = screen.getByText('View Offers (2)');
    expect(viewOffersButton).toBeInTheDocument();
    
    fireEvent.click(viewOffersButton);
    expect(mockOnViewOffers).toHaveBeenCalledWith('cash-swap-1');
  });

  it('calls onViewDetails when card is clicked', () => {
    render(
      <CashSwapCard
        swap={mockCashSwap}
        onMakeOffer={mockOnMakeOffer}
        onViewOffers={mockOnViewOffers}
        onViewDetails={mockOnViewDetails}
        currentUserId="different-user"
      />
    );

    const card = screen.getByText('Luxury Hotel in Paris').closest('[role="button"], div');
    if (card) {
      fireEvent.click(card);
      expect(mockOnViewDetails).toHaveBeenCalledWith(mockCashSwap);
    }
  });

  it('displays active proposal count', () => {
    render(
      <CashSwapCard
        swap={mockCashSwap}
        onMakeOffer={mockOnMakeOffer}
        onViewOffers={mockOnViewOffers}
        onViewDetails={mockOnViewDetails}
        currentUserId="different-user"
      />
    );

    expect(screen.getByText('2 offers')).toBeInTheDocument();
  });

  it('does not render if cashDetails is missing', () => {
    const swapWithoutCashDetails = {
      ...mockCashSwap,
      cashDetails: undefined,
    };

    const { container } = render(
      <CashSwapCard
        swap={swapWithoutCashDetails}
        onMakeOffer={mockOnMakeOffer}
        onViewOffers={mockOnViewOffers}
        onViewDetails={mockOnViewDetails}
        currentUserId="different-user"
      />
    );

    expect(container.firstChild).toBeNull();
  });
});