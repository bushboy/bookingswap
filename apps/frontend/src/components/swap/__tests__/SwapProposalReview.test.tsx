import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SwapProposalReview } from '../SwapProposalReview';
import { Swap, Booking } from '@booking-swap/shared';

const mockSourceBooking: Booking = {
  id: 'source-1',
  userId: 'user1',
  type: 'hotel',
  title: 'City Hotel in New York',
  description: 'Modern hotel in Manhattan',
  location: {
    city: 'New York',
    country: 'USA',
  },
  dateRange: {
    checkIn: new Date('2024-07-01'),
    checkOut: new Date('2024-07-05'),
  },
  originalPrice: 600,
  swapValue: 550,
  providerDetails: {
    provider: 'Expedia',
    confirmationNumber: 'NYC456',
    bookingReference: 'REF123',
  },
  verification: {
    status: 'verified',
    verifiedAt: new Date(),
    documents: [],
  },
  blockchain: {
    transactionId: 'tx789',
    consensusTimestamp: '456789123',
    topicId: 'topic3',
  },
  status: 'available',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockTargetBooking: Booking = {
  id: 'target-1',
  userId: 'user2',
  type: 'hotel',
  title: 'Beach Resort in Miami',
  description: 'Luxury beachfront resort',
  location: {
    city: 'Miami',
    country: 'USA',
  },
  dateRange: {
    checkIn: new Date('2024-07-01'),
    checkOut: new Date('2024-07-05'),
  },
  originalPrice: 800,
  swapValue: 750,
  providerDetails: {
    provider: 'Hotels.com',
    confirmationNumber: 'MIA123',
    bookingReference: 'REF789',
  },
  verification: {
    status: 'verified',
    verifiedAt: new Date(),
    documents: [],
  },
  blockchain: {
    transactionId: 'tx456',
    consensusTimestamp: '987654321',
    topicId: 'topic2',
  },
  status: 'available',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockSwap: Swap = {
  id: 'swap-1',
  sourceBookingId: 'source-1',
  targetBookingId: 'target-1',
  proposerId: 'user1',
  ownerId: 'user2',
  status: 'pending',
  terms: {
    additionalPayment: 100,
    conditions: [
      'Must confirm 24h before check-in',
      'No cancellation after acceptance',
    ],
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  },
  blockchain: {
    proposalTransactionId: 'tx-proposal-123',
  },
  timeline: {
    proposedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('SwapProposalReview', () => {
  const mockOnAccept = vi.fn();
  const mockOnReject = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnAccept.mockClear();
    mockOnReject.mockClear();
    mockOnClose.mockClear();
  });

  it('renders swap proposal details correctly', () => {
    render(
      <SwapProposalReview
        swap={mockSwap}
        sourceBooking={mockSourceBooking}
        targetBooking={mockTargetBooking}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Swap Proposal Review')).toBeInTheDocument();
    expect(screen.getByText('They offer:')).toBeInTheDocument();
    expect(screen.getByText('You give:')).toBeInTheDocument();
    expect(screen.getByText('City Hotel in New York')).toBeInTheDocument();
    expect(screen.getByText('Beach Resort in Miami')).toBeInTheDocument();
  });

  it('displays value analysis correctly', () => {
    render(
      <SwapProposalReview
        swap={mockSwap}
        sourceBooking={mockSourceBooking}
        targetBooking={mockTargetBooking}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Value Analysis')).toBeInTheDocument();
    expect(screen.getByText('$550')).toBeInTheDocument(); // Their booking
    expect(screen.getByText('+$100')).toBeInTheDocument(); // Additional payment
    expect(screen.getByText('$650')).toBeInTheDocument(); // Total value
    expect(screen.getByText('$750')).toBeInTheDocument(); // Your booking
    // Net difference: $650 (total) - $750 (your booking) = -$100
    expect(screen.getByText('$-100')).toBeInTheDocument(); // Net difference
  });

  it('displays swap conditions when present', () => {
    render(
      <SwapProposalReview
        swap={mockSwap}
        sourceBooking={mockSourceBooking}
        targetBooking={mockTargetBooking}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Swap Conditions')).toBeInTheDocument();
    expect(
      screen.getByText('• Must confirm 24h before check-in')
    ).toBeInTheDocument();
    expect(
      screen.getByText('• No cancellation after acceptance')
    ).toBeInTheDocument();
  });

  it('does not display conditions section when no conditions', () => {
    const swapWithoutConditions = {
      ...mockSwap,
      terms: {
        ...mockSwap.terms,
        conditions: [],
      },
    };

    render(
      <SwapProposalReview
        swap={swapWithoutConditions}
        sourceBooking={mockSourceBooking}
        targetBooking={mockTargetBooking}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );

    expect(screen.queryByText('Swap Conditions')).not.toBeInTheDocument();
  });

  it('shows accept and reject buttons for pending swaps', () => {
    render(
      <SwapProposalReview
        swap={mockSwap}
        sourceBooking={mockSourceBooking}
        targetBooking={mockTargetBooking}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Accept Proposal' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  it('does not show action buttons for non-pending swaps', () => {
    const acceptedSwap = {
      ...mockSwap,
      status: 'accepted' as const,
    };

    render(
      <SwapProposalReview
        swap={acceptedSwap}
        sourceBooking={mockSourceBooking}
        targetBooking={mockTargetBooking}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );

    expect(
      screen.queryByRole('button', { name: 'Accept Proposal' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Reject' })
    ).not.toBeInTheDocument();
  });

  it('shows expired warning for expired proposals', () => {
    const expiredSwap = {
      ...mockSwap,
      terms: {
        ...mockSwap.terms,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      },
    };

    render(
      <SwapProposalReview
        swap={expiredSwap}
        sourceBooking={mockSourceBooking}
        targetBooking={mockTargetBooking}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );

    expect(
      screen.getByText('⚠️ This proposal has expired')
    ).toBeInTheDocument();
  });

  it('calls onAccept when accept button is clicked', () => {
    render(
      <SwapProposalReview
        swap={mockSwap}
        sourceBooking={mockSourceBooking}
        targetBooking={mockTargetBooking}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );

    const acceptButton = screen.getByRole('button', {
      name: 'Accept Proposal',
    });
    fireEvent.click(acceptButton);

    expect(mockOnAccept).toHaveBeenCalledWith('swap-1');
  });

  it('shows reject reason input when reject is clicked first time', async () => {
    render(
      <SwapProposalReview
        swap={mockSwap}
        sourceBooking={mockSourceBooking}
        targetBooking={mockTargetBooking}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );

    const rejectButton = screen.getByRole('button', { name: 'Reject' });
    fireEvent.click(rejectButton);

    await waitFor(() => {
      expect(
        screen.getByText('Reason for rejection (optional)')
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Confirm Rejection' })
      ).toBeInTheDocument();
    });
  });

  it('calls onReject with reason when confirm rejection is clicked', async () => {
    render(
      <SwapProposalReview
        swap={mockSwap}
        sourceBooking={mockSourceBooking}
        targetBooking={mockTargetBooking}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );

    const rejectButton = screen.getByRole('button', { name: 'Reject' });
    fireEvent.click(rejectButton);

    await waitFor(() => {
      const reasonTextarea = screen.getByPlaceholderText(
        /Let them know why you're declining/
      );
      fireEvent.change(reasonTextarea, {
        target: { value: 'Not suitable for my needs' },
      });
    });

    const confirmButton = screen.getByRole('button', {
      name: 'Confirm Rejection',
    });
    fireEvent.click(confirmButton);

    expect(mockOnReject).toHaveBeenCalledWith(
      'swap-1',
      'Not suitable for my needs'
    );
  });

  it('calls onClose when close button is clicked', () => {
    render(
      <SwapProposalReview
        swap={mockSwap}
        sourceBooking={mockSourceBooking}
        targetBooking={mockTargetBooking}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        onClose={mockOnClose}
      />
    );

    const closeButton = screen.getByRole('button', { name: '✕' });
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows loading state on buttons', () => {
    render(
      <SwapProposalReview
        swap={mockSwap}
        sourceBooking={mockSourceBooking}
        targetBooking={mockTargetBooking}
        onAccept={mockOnAccept}
        onReject={mockOnReject}
        onClose={mockOnClose}
        loading={true}
      />
    );

    const acceptButton = screen.getByRole('button', {
      name: 'Accept Proposal',
    });
    const rejectButton = screen.getByRole('button', { name: 'Reject' });

    expect(acceptButton).toBeDisabled();
    expect(rejectButton).toBeDisabled();
    expect(acceptButton).toHaveStyle({ opacity: '0.6' });
    expect(rejectButton).toHaveStyle({ opacity: '0.6' });
  });
});
