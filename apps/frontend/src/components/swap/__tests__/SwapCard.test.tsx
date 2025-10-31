import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SwapCard } from '../SwapCard';
import { SwapWithBookings } from '@/services/swapService';
import { Booking } from '@booking-swap/shared';

// Mock data
const mockSourceBooking: Booking = {
  id: 'booking-1',
  userId: 'user-1',
  type: 'hotel',
  title: 'Luxury Hotel in Paris',
  description: 'Beautiful hotel in the heart of Paris',
  location: {
    city: 'Paris',
    country: 'France',
    coordinates: [48.8566, 2.3522],
  },
  dateRange: {
    checkIn: new Date('2024-06-01'),
    checkOut: new Date('2024-06-05'),
  },
  originalPrice: 800,
  swapValue: 750,
  providerDetails: {
    provider: 'Booking.com',
    confirmationNumber: 'BK123456',
    bookingReference: 'REF789',
  },
  verification: {
    status: 'verified',
    verifiedAt: new Date('2024-05-01'),
    documents: ['doc1.pdf'],
  },
  blockchain: {
    transactionId: 'tx123',
    consensusTimestamp: '1234567890',
    topicId: 'topic123',
  },
  status: 'available',
  createdAt: new Date('2024-05-01'),
  updatedAt: new Date('2024-05-01'),
};

const mockTargetBooking: Booking = {
  id: 'booking-2',
  userId: 'user-2',
  type: 'event',
  title: 'Concert Tickets in London',
  description: 'Premium concert tickets for a famous artist',
  location: {
    city: 'London',
    country: 'UK',
    coordinates: [51.5074, -0.1278],
  },
  dateRange: {
    checkIn: new Date('2024-06-10'),
    checkOut: new Date('2024-06-10'),
  },
  originalPrice: 600,
  swapValue: 700,
  providerDetails: {
    provider: 'Ticketmaster',
    confirmationNumber: 'TM789012',
    bookingReference: 'REF456',
  },
  verification: {
    status: 'verified',
    verifiedAt: new Date('2024-05-02'),
    documents: ['doc2.pdf'],
  },
  blockchain: {
    transactionId: 'tx456',
    consensusTimestamp: '1234567891',
    topicId: 'topic456',
  },
  status: 'available',
  createdAt: new Date('2024-05-02'),
  updatedAt: new Date('2024-05-02'),
};

const mockSwap: SwapWithBookings = {
  id: 'swap-1',
  sourceBookingId: 'booking-1',
  targetBookingId: 'booking-2',
  proposerId: 'user-1',
  ownerId: 'user-2',
  status: 'pending',
  terms: {
    additionalPayment: 50,
    conditions: ['Must confirm 24 hours before', 'No cancellations allowed'],
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  },
  blockchain: {
    proposalTransactionId: 'tx789',
  },
  timeline: {
    proposedAt: new Date('2024-05-15'),
  },
  sourceBooking: mockSourceBooking,
  targetBooking: mockTargetBooking,
  proposer: {
    id: 'user-1',
    walletAddress: '0x123',
    profile: {
      displayName: 'John Doe',
      bio: 'Travel enthusiast',
      avatar: 'avatar1.jpg',
    },
    verification: {
      level: 'verified',
      verifiedAt: new Date('2024-01-01'),
    },
    preferences: {
      notifications: {
        email: true,
        push: true,
        sms: false,
      },
      privacy: {
        showProfile: true,
        showBookings: true,
      },
    },
    swapCriteria: {
      maxAdditionalPayment: 100,
      preferredLocations: ['Paris', 'London'],
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  owner: {
    id: 'user-2',
    walletAddress: '0x456',
    profile: {
      displayName: 'Jane Smith',
      bio: 'Event lover',
      avatar: 'avatar2.jpg',
    },
    verification: {
      level: 'verified',
      verifiedAt: new Date('2024-01-02'),
    },
    preferences: {
      notifications: {
        email: true,
        push: true,
        sms: false,
      },
      privacy: {
        showProfile: true,
        showBookings: true,
      },
    },
    swapCriteria: {
      maxAdditionalPayment: 200,
      preferredLocations: ['London', 'New York'],
    },
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
  },
  createdAt: new Date('2024-05-15'),
  updatedAt: new Date('2024-05-15'),
};

describe('SwapCard', () => {
  const mockOnAccept = vi.fn();
  const mockOnReject = vi.fn();
  const mockOnCancel = vi.fn();
  const mockOnViewDetails = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders swap card with both bookings', () => {
    render(
      <SwapCard
        swap={mockSwap}
        userRole="owner"
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        onViewDetails={mockOnViewDetails}
      />
    );

    expect(screen.getByText('Luxury Hotel in Paris')).toBeInTheDocument();
    expect(screen.getByText('Concert Tickets in London')).toBeInTheDocument();
    expect(screen.getByText('Paris, France')).toBeInTheDocument();
    expect(screen.getByText('London, UK')).toBeInTheDocument();
  });

  it('displays correct status badge', () => {
    render(
      <SwapCard
        swap={mockSwap}
        userRole="owner"
        onAccept={mockOnAccept}
        onReject={mockOnReject}
      />
    );

    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  it('shows accept and reject buttons for owner when status is pending', () => {
    render(
      <SwapCard
        swap={mockSwap}
        userRole="owner"
        onAccept={mockOnAccept}
        onReject={mockOnReject}
      />
    );

    expect(screen.getByText('Accept Swap')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
  });

  it('shows cancel button for proposer when status is pending', () => {
    render(
      <SwapCard swap={mockSwap} userRole="proposer" onCancel={mockOnCancel} />
    );

    expect(screen.getByText('Cancel Proposal')).toBeInTheDocument();
  });

  it('calls onAccept when accept button is clicked', () => {
    render(
      <SwapCard
        swap={mockSwap}
        userRole="owner"
        onAccept={mockOnAccept}
        onReject={mockOnReject}
      />
    );

    fireEvent.click(screen.getByText('Accept Swap'));
    expect(mockOnAccept).toHaveBeenCalledTimes(1);
  });

  it('calls onReject when reject button is clicked', () => {
    render(
      <SwapCard
        swap={mockSwap}
        userRole="owner"
        onAccept={mockOnAccept}
        onReject={mockOnReject}
      />
    );

    fireEvent.click(screen.getByText('Reject'));
    expect(mockOnReject).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(
      <SwapCard swap={mockSwap} userRole="proposer" onCancel={mockOnCancel} />
    );

    fireEvent.click(screen.getByText('Cancel Proposal'));
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('displays swap terms when present', () => {
    render(<SwapCard swap={mockSwap} userRole="owner" />);

    expect(screen.getByText('Swap Terms')).toBeInTheDocument();
    expect(screen.getByText('Additional payment: $50.00')).toBeInTheDocument();
    expect(
      screen.getByText('Must confirm 24 hours before')
    ).toBeInTheDocument();
    expect(screen.getByText('No cancellations allowed')).toBeInTheDocument();
  });

  it('displays timeline information', () => {
    render(<SwapCard swap={mockSwap} userRole="owner" />);

    expect(screen.getByText('Timeline')).toBeInTheDocument();
    expect(screen.getByText(/Proposed on/)).toBeInTheDocument();
  });

  it('does not show action buttons when swap is not pending', () => {
    const acceptedSwap = {
      ...mockSwap,
      status: 'accepted' as const,
      timeline: {
        ...mockSwap.timeline,
        respondedAt: new Date('2024-05-16'),
      },
    };

    render(
      <SwapCard
        swap={acceptedSwap}
        userRole="owner"
        onAccept={mockOnAccept}
        onReject={mockOnReject}
      />
    );

    expect(screen.queryByText('Accept Swap')).not.toBeInTheDocument();
    expect(screen.queryByText('Reject')).not.toBeInTheDocument();
  });

  it('shows expired status when swap has expired', () => {
    const expiredSwap = {
      ...mockSwap,
      terms: {
        ...mockSwap.terms,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      },
    };

    render(<SwapCard swap={expiredSwap} userRole="owner" />);

    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('handles keyboard navigation', () => {
    render(
      <SwapCard
        swap={mockSwap}
        userRole="owner"
        onViewDetails={mockOnViewDetails}
      />
    );

    const card = screen.getByRole('article');
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(mockOnViewDetails).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(card, { key: ' ' });
    expect(mockOnViewDetails).toHaveBeenCalledTimes(2);
  });

  it('displays correct user role indicators', () => {
    render(<SwapCard swap={mockSwap} userRole="proposer" />);

    expect(screen.getByText('Your Booking')).toBeInTheDocument();
    expect(screen.getByText('Their Booking')).toBeInTheDocument();
  });

  it('formats currency correctly', () => {
    render(<SwapCard swap={mockSwap} userRole="owner" />);

    expect(screen.getByText('$750.00')).toBeInTheDocument();
    expect(screen.getByText('$700.00')).toBeInTheDocument();
  });
});
