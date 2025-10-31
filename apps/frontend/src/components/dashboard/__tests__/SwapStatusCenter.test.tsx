import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { SwapStatusCenter } from '../SwapStatusCenter';

describe('SwapStatusCenter', () => {
  const mockSwapProposals = [
    {
      id: '1',
      sourceBookingTitle: 'Tokyo Flight',
      targetBookingTitle: 'Miami Hotel',
      proposerName: 'Alice Johnson',
      status: 'pending' as const,
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours from now
      additionalPayment: 500,
      isIncoming: true,
    },
    {
      id: '2',
      sourceBookingTitle: 'Paris Hotel',
      targetBookingTitle: 'Concert Tickets',
      proposerName: 'Bob Smith',
      status: 'pending' as const,
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now (expiring soon)
      isIncoming: false,
    },
    {
      id: '3',
      sourceBookingTitle: 'Ski Resort',
      targetBookingTitle: 'Beach Resort',
      proposerName: 'Carol Davis',
      status: 'completed' as const,
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired
      additionalPayment: 200,
      isIncoming: true,
    },
  ];

  const mockOnAcceptSwap = vi.fn();
  const mockOnRejectSwap = vi.fn();
  const mockOnViewSwap = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders swap status center with pending and active swaps', () => {
    render(
      <SwapStatusCenter
        swapProposals={mockSwapProposals}
        onAcceptSwap={mockOnAcceptSwap}
        onRejectSwap={mockOnRejectSwap}
        onViewSwap={mockOnViewSwap}
      />
    );

    expect(screen.getByText('Pending Swap Proposals (2)')).toBeInTheDocument();
    expect(screen.getByText('Active Swaps (1)')).toBeInTheDocument();
  });

  it('displays pending swap proposals correctly', () => {
    render(
      <SwapStatusCenter
        swapProposals={mockSwapProposals}
        onAcceptSwap={mockOnAcceptSwap}
        onRejectSwap={mockOnRejectSwap}
        onViewSwap={mockOnViewSwap}
      />
    );

    expect(screen.getByText('Tokyo Flight')).toBeInTheDocument();
    expect(screen.getByText('Miami Hotel')).toBeInTheDocument();
    expect(screen.getByText('Paris Hotel')).toBeInTheDocument();
    expect(screen.getByText('Concert Tickets')).toBeInTheDocument();
    expect(screen.getByText('From: Alice Johnson')).toBeInTheDocument();
    expect(screen.getByText('To: Bob Smith')).toBeInTheDocument();
  });

  it('shows additional payment when present', () => {
    render(
      <SwapStatusCenter
        swapProposals={mockSwapProposals}
        onAcceptSwap={mockOnAcceptSwap}
        onRejectSwap={mockOnRejectSwap}
        onViewSwap={mockOnViewSwap}
      />
    );

    expect(screen.getByText('Additional payment: $500')).toBeInTheDocument();
  });

  it('displays expiration times correctly', () => {
    render(
      <SwapStatusCenter
        swapProposals={mockSwapProposals}
        onAcceptSwap={mockOnAcceptSwap}
        onRejectSwap={mockOnRejectSwap}
        onViewSwap={mockOnViewSwap}
      />
    );

    expect(screen.getByText(/days? left/)).toBeInTheDocument();
    expect(screen.getByText(/hours? left/)).toBeInTheDocument();
  });

  it('shows accept and reject buttons for incoming pending swaps', () => {
    render(
      <SwapStatusCenter
        swapProposals={mockSwapProposals}
        onAcceptSwap={mockOnAcceptSwap}
        onRejectSwap={mockOnRejectSwap}
        onViewSwap={mockOnViewSwap}
      />
    );

    const acceptButtons = screen.getAllByText('Accept');
    const rejectButtons = screen.getAllByText('Reject');

    expect(acceptButtons).toHaveLength(1); // Only for incoming pending swaps
    expect(rejectButtons).toHaveLength(1);
  });

  it('calls onAcceptSwap when accept button is clicked', () => {
    render(
      <SwapStatusCenter
        swapProposals={mockSwapProposals}
        onAcceptSwap={mockOnAcceptSwap}
        onRejectSwap={mockOnRejectSwap}
        onViewSwap={mockOnViewSwap}
      />
    );

    const acceptButton = screen.getByText('Accept');
    fireEvent.click(acceptButton);

    expect(mockOnAcceptSwap).toHaveBeenCalledWith('1');
  });

  it('calls onRejectSwap when reject button is clicked', () => {
    render(
      <SwapStatusCenter
        swapProposals={mockSwapProposals}
        onAcceptSwap={mockOnAcceptSwap}
        onRejectSwap={mockOnRejectSwap}
        onViewSwap={mockOnViewSwap}
      />
    );

    const rejectButton = screen.getByText('Reject');
    fireEvent.click(rejectButton);

    expect(mockOnRejectSwap).toHaveBeenCalledWith('1');
  });

  it('calls onViewSwap when view details button is clicked', () => {
    render(
      <SwapStatusCenter
        swapProposals={mockSwapProposals}
        onAcceptSwap={mockOnAcceptSwap}
        onRejectSwap={mockOnRejectSwap}
        onViewSwap={mockOnViewSwap}
      />
    );

    const viewButtons = screen.getAllByText('View Details');
    fireEvent.click(viewButtons[0]);

    expect(mockOnViewSwap).toHaveBeenCalledWith('1');
  });

  it('displays active swaps in separate section', () => {
    render(
      <SwapStatusCenter
        swapProposals={mockSwapProposals}
        onAcceptSwap={mockOnAcceptSwap}
        onRejectSwap={mockOnRejectSwap}
        onViewSwap={mockOnViewSwap}
      />
    );

    expect(screen.getByText('Swap Completed')).toBeInTheDocument();
    expect(screen.getByText('Ski Resort')).toBeInTheDocument();
    expect(screen.getByText('Beach Resort')).toBeInTheDocument();
    expect(screen.getByText('With: Carol Davis')).toBeInTheDocument();
  });

  it('shows correct status badges', () => {
    render(
      <SwapStatusCenter
        swapProposals={mockSwapProposals}
        onAcceptSwap={mockOnAcceptSwap}
        onRejectSwap={mockOnRejectSwap}
        onViewSwap={mockOnViewSwap}
      />
    );

    expect(screen.getAllByText('Pending')).toHaveLength(2);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('renders empty state for pending swaps when none exist', () => {
    const noSwaps = mockSwapProposals.filter(s => s.status !== 'pending');
    render(
      <SwapStatusCenter
        swapProposals={noSwaps}
        onAcceptSwap={mockOnAcceptSwap}
        onRejectSwap={mockOnRejectSwap}
        onViewSwap={mockOnViewSwap}
      />
    );

    expect(screen.getByText('No pending swap proposals')).toBeInTheDocument();
  });

  it('renders empty state for active swaps when none exist', () => {
    const pendingOnly = mockSwapProposals.filter(s => s.status === 'pending');
    render(
      <SwapStatusCenter
        swapProposals={pendingOnly}
        onAcceptSwap={mockOnAcceptSwap}
        onRejectSwap={mockOnRejectSwap}
        onViewSwap={mockOnViewSwap}
      />
    );

    expect(screen.getByText('No active swaps')).toBeInTheDocument();
  });

  it('distinguishes between incoming and outgoing proposals', () => {
    render(
      <SwapStatusCenter
        swapProposals={mockSwapProposals}
        onAcceptSwap={mockOnAcceptSwap}
        onRejectSwap={mockOnRejectSwap}
        onViewSwap={mockOnViewSwap}
      />
    );

    expect(screen.getByText('Incoming Swap Proposal')).toBeInTheDocument();
    expect(screen.getByText('Outgoing Swap Proposal')).toBeInTheDocument();
  });

  it('does not show accept/reject buttons for outgoing proposals', () => {
    const outgoingOnly = [
      {
        ...mockSwapProposals[1],
        isIncoming: false,
      },
    ];

    render(
      <SwapStatusCenter
        swapProposals={outgoingOnly}
        onAcceptSwap={mockOnAcceptSwap}
        onRejectSwap={mockOnRejectSwap}
        onViewSwap={mockOnViewSwap}
      />
    );

    expect(screen.queryByText('Accept')).not.toBeInTheDocument();
    expect(screen.queryByText('Reject')).not.toBeInTheDocument();
    expect(screen.getByText('View Details')).toBeInTheDocument();
  });

  it('handles expired proposals correctly', () => {
    const expiredProposal = {
      ...mockSwapProposals[0],
      expiresAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
    };

    render(
      <SwapStatusCenter
        swapProposals={[expiredProposal]}
        onAcceptSwap={mockOnAcceptSwap}
        onRejectSwap={mockOnRejectSwap}
        onViewSwap={mockOnViewSwap}
      />
    );

    expect(screen.getByText('Expired')).toBeInTheDocument();
  });
});
