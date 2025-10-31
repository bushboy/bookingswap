import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SwapStatusTracker } from '../SwapStatusTracker';
import { Swap } from '@booking-swap/shared';

const mockSwap: Swap = {
  id: 'swap-1',
  sourceBookingId: 'source-1',
  targetBookingId: 'target-1',
  proposerId: 'user1',
  ownerId: 'user2',
  status: 'pending',
  terms: {
    additionalPayment: 100,
    conditions: ['Must confirm 24h before check-in'],
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

describe('SwapStatusTracker', () => {
  const mockOnViewDetails = vi.fn();

  beforeEach(() => {
    mockOnViewDetails.mockClear();
  });

  it('renders compact view correctly', () => {
    render(
      <SwapStatusTracker
        swap={mockSwap}
        onViewDetails={mockOnViewDetails}
        compact={true}
      />
    );

    expect(screen.getByText('Proposal Sent')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'View Details' })
    ).toBeInTheDocument();
  });

  it('renders full view with progress steps', () => {
    render(
      <SwapStatusTracker
        swap={mockSwap}
        onViewDetails={mockOnViewDetails}
        compact={false}
      />
    );

    expect(screen.getByText('Swap Progress')).toBeInTheDocument();
    expect(screen.getByText('Proposal Sent')).toBeInTheDocument();
    expect(
      screen.getByText('Waiting for response from the booking owner')
    ).toBeInTheDocument();
    expect(screen.getByText('Proposal Accepted')).toBeInTheDocument();
    expect(screen.getByText('Swap Completed')).toBeInTheDocument();
  });

  it('shows correct status for accepted swap', () => {
    const acceptedSwap = {
      ...mockSwap,
      status: 'accepted' as const,
      timeline: {
        ...mockSwap.timeline,
        respondedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      },
    };

    render(
      <SwapStatusTracker
        swap={acceptedSwap}
        onViewDetails={mockOnViewDetails}
        compact={true}
      />
    );

    expect(screen.getByText('Proposal Accepted')).toBeInTheDocument();
    expect(screen.getByText('Accepted')).toBeInTheDocument();
  });

  it('shows correct status for completed swap', () => {
    const completedSwap = {
      ...mockSwap,
      status: 'completed' as const,
      timeline: {
        ...mockSwap.timeline,
        respondedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
    };

    render(
      <SwapStatusTracker
        swap={completedSwap}
        onViewDetails={mockOnViewDetails}
        compact={true}
      />
    );

    expect(screen.getByText('Swap Completed')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('shows correct status for rejected swap', () => {
    const rejectedSwap = {
      ...mockSwap,
      status: 'rejected' as const,
      timeline: {
        ...mockSwap.timeline,
        respondedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
    };

    render(
      <SwapStatusTracker
        swap={rejectedSwap}
        onViewDetails={mockOnViewDetails}
        compact={false}
      />
    );

    expect(screen.getByText('Proposal Rejected')).toBeInTheDocument();
    expect(
      screen.getByText('The booking owner declined your proposal')
    ).toBeInTheDocument();
    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });

  it('shows correct status for cancelled swap', () => {
    const cancelledSwap = {
      ...mockSwap,
      status: 'cancelled' as const,
    };

    render(
      <SwapStatusTracker
        swap={cancelledSwap}
        onViewDetails={mockOnViewDetails}
        compact={false}
      />
    );

    expect(screen.getByText('Proposal Cancelled')).toBeInTheDocument();
    expect(screen.getByText('The proposal was cancelled')).toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
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
      <SwapStatusTracker
        swap={expiredSwap}
        onViewDetails={mockOnViewDetails}
        compact={true}
      />
    );

    expect(
      screen.getByText('⚠️ This proposal has expired')
    ).toBeInTheDocument();
  });

  it('displays proposal ID and expiration info in full view', () => {
    render(
      <SwapStatusTracker
        swap={mockSwap}
        onViewDetails={mockOnViewDetails}
        compact={false}
      />
    );

    expect(screen.getByText('Proposal ID')).toBeInTheDocument();
    expect(screen.getByText(/swap-1/)).toBeInTheDocument();
    expect(screen.getByText('Expires')).toBeInTheDocument();
  });

  it('calls onViewDetails when view details button is clicked', () => {
    render(
      <SwapStatusTracker
        swap={mockSwap}
        onViewDetails={mockOnViewDetails}
        compact={true}
      />
    );

    const viewDetailsButton = screen.getByRole('button', {
      name: 'View Details',
    });
    fireEvent.click(viewDetailsButton);

    expect(mockOnViewDetails).toHaveBeenCalledWith('swap-1');
  });

  it('shows view full details button in full view', () => {
    render(
      <SwapStatusTracker
        swap={mockSwap}
        onViewDetails={mockOnViewDetails}
        compact={false}
      />
    );

    const viewDetailsButton = screen.getByRole('button', {
      name: 'View Full Details',
    });
    fireEvent.click(viewDetailsButton);

    expect(mockOnViewDetails).toHaveBeenCalledWith('swap-1');
  });

  it('does not show view details button when onViewDetails is not provided', () => {
    render(<SwapStatusTracker swap={mockSwap} compact={true} />);

    expect(
      screen.queryByRole('button', { name: 'View Details' })
    ).not.toBeInTheDocument();
  });

  it('shows timestamps for completed steps', () => {
    const completedSwap = {
      ...mockSwap,
      status: 'completed' as const,
      timeline: {
        proposedAt: new Date('2024-01-01T10:00:00Z'),
        respondedAt: new Date('2024-01-02T15:30:00Z'),
        completedAt: new Date('2024-01-03T09:15:00Z'),
      },
    };

    render(
      <SwapStatusTracker
        swap={completedSwap}
        onViewDetails={mockOnViewDetails}
        compact={false}
      />
    );

    // Check that timestamps are displayed (exact format may vary based on locale)
    expect(screen.getByText(/Jan 1/)).toBeInTheDocument();
    expect(screen.getByText(/Jan 2/)).toBeInTheDocument();
    expect(screen.getByText(/Jan 3/)).toBeInTheDocument();
  });
});
