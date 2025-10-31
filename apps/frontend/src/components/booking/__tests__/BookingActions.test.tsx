import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OwnerActions, BrowserActions, ProposerActions } from '../BookingActions';
import { Booking, SwapInfo } from '@booking-swap/shared';

const createMockBooking = (overrides: Partial<Booking> = {}): Booking => ({
  id: 'booking-1',
  userId: 'user-1',
  type: 'hotel',
  title: 'Test Booking',
  description: 'Test Description',
  location: { city: 'Test City', country: 'Test Country' },
  dateRange: {
    checkIn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    checkOut: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
  },
  originalPrice: 500,
  swapValue: 450,
  status: 'available',
  providerDetails: {
    provider: 'Test Provider',
    confirmationNumber: 'TEST123',
    bookingReference: 'REF123'
  },
  verification: {
    status: 'verified',
    verifiedAt: new Date(),
    documents: []
  },
  blockchain: {
    topicId: 'topic1'
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createMockSwapInfo = (overrides: Partial<SwapInfo> = {}): SwapInfo => ({
  swapId: 'swap-1',
  paymentTypes: ['booking'],
  acceptanceStrategy: 'first-match',
  hasActiveProposals: true,
  activeProposalCount: 1,
  userProposalStatus: 'none',
  swapConditions: [],
  hasAnySwapInitiated: true,
  ...overrides,
});

describe('OwnerActions', () => {
  const mockOnEdit = vi.fn();
  const mockOnManageSwap = vi.fn();
  const mockOnCreateSwap = vi.fn();
  const mockOnViewProposals = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders edit button for available booking without swap', () => {
    const booking = createMockBooking({ status: 'available' });

    render(
      <OwnerActions
        booking={booking}
        onEdit={mockOnEdit}
        onCreateSwap={mockOnCreateSwap}
      />
    );

    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Create Swap')).toBeInTheDocument();
  });

  it('shows edit button enabled when booking has active swap', () => {
    const booking = createMockBooking({ status: 'available' });
    const swapInfo = createMockSwapInfo({ hasActiveProposals: true });

    render(
      <OwnerActions
        booking={booking}
        swapInfo={swapInfo}
        onEdit={mockOnEdit}
      />
    );

    const editButton = screen.getByText('Edit');
    expect(editButton).not.toBeDisabled();
    expect(screen.queryByText('Create Swap')).not.toBeInTheDocument();
  });

  it('shows manage swap and view proposals buttons when swap is active', () => {
    const booking = createMockBooking({ status: 'available' });
    const swapInfo = createMockSwapInfo({
      hasActiveProposals: true,
      activeProposalCount: 3,
    });

    render(
      <OwnerActions
        booking={booking}
        swapInfo={swapInfo}
        onManageSwap={mockOnManageSwap}
        onViewProposals={mockOnViewProposals}
      />
    );

    expect(screen.getByText('Manage Swap')).toBeInTheDocument();
    expect(screen.getByText('View Proposals (3)')).toBeInTheDocument();
  });

  it('calls onEdit when edit button is clicked', () => {
    const booking = createMockBooking({ status: 'available' });

    render(
      <OwnerActions
        booking={booking}
        onEdit={mockOnEdit}
      />
    );

    fireEvent.click(screen.getByText('Edit'));
    expect(mockOnEdit).toHaveBeenCalledWith(booking);
  });

  it('calls onCreateSwap when create swap button is clicked', () => {
    const booking = createMockBooking({ status: 'available' });

    render(
      <OwnerActions
        booking={booking}
        onCreateSwap={mockOnCreateSwap}
      />
    );

    fireEvent.click(screen.getByText('Create Swap'));
    expect(mockOnCreateSwap).toHaveBeenCalledWith(booking);
  });
});

describe('BrowserActions', () => {
  const mockOnMakeProposal = vi.fn();
  const mockOnViewDetails = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders view details and make proposal buttons', () => {
    const booking = createMockBooking({ status: 'available' });
    const swapInfo = createMockSwapInfo({ hasActiveProposals: true });

    render(
      <BrowserActions
        booking={booking}
        swapInfo={swapInfo}
        onMakeProposal={mockOnMakeProposal}
        onViewDetails={mockOnViewDetails}
      />
    );

    expect(screen.getByText('View Details')).toBeInTheDocument();
    expect(screen.getByText('Make Proposal')).toBeInTheDocument();
  });

  it('shows "Place Bid" for auction strategy', () => {
    const booking = createMockBooking({ status: 'available' });
    const swapInfo = createMockSwapInfo({
      hasActiveProposals: true,
      acceptanceStrategy: 'auction',
    });

    render(
      <BrowserActions
        booking={booking}
        swapInfo={swapInfo}
        onMakeProposal={mockOnMakeProposal}
      />
    );

    expect(screen.getByText('Place Bid')).toBeInTheDocument();
  });

  it('shows "Bid Now!" for ending soon auctions', () => {
    const booking = createMockBooking({ status: 'available' });
    const swapInfo = createMockSwapInfo({
      hasActiveProposals: true,
      acceptanceStrategy: 'auction',
      timeRemaining: 12 * 60 * 60 * 1000, // 12 hours
    });

    render(
      <BrowserActions
        booking={booking}
        swapInfo={swapInfo}
        onMakeProposal={mockOnMakeProposal}
      />
    );

    expect(screen.getByText('Bid Now!')).toBeInTheDocument();
  });

  it('calls onMakeProposal when proposal button is clicked', () => {
    const booking = createMockBooking({ status: 'available' });
    const swapInfo = createMockSwapInfo({ hasActiveProposals: true });

    render(
      <BrowserActions
        booking={booking}
        swapInfo={swapInfo}
        onMakeProposal={mockOnMakeProposal}
      />
    );

    fireEvent.click(screen.getByText('Make Proposal'));
    expect(mockOnMakeProposal).toHaveBeenCalled();
  });
});

describe('ProposerActions', () => {
  const mockOnViewProposal = vi.fn();
  const mockOnEditProposal = vi.fn();
  const mockOnWithdrawProposal = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders view proposal button', () => {
    const booking = createMockBooking();
    const swapInfo = createMockSwapInfo({
      userProposalStatus: 'pending',
    });

    render(
      <ProposerActions
        booking={booking}
        swapInfo={swapInfo}
        onViewProposal={mockOnViewProposal}
      />
    );

    expect(screen.getByText('View Proposal')).toBeInTheDocument();
  });

  it('shows update bid button for pending auction proposals', () => {
    const booking = createMockBooking();
    const swapInfo = createMockSwapInfo({
      userProposalStatus: 'pending',
      acceptanceStrategy: 'auction',
    });

    render(
      <ProposerActions
        booking={booking}
        swapInfo={swapInfo}
        onEditProposal={mockOnEditProposal}
      />
    );

    expect(screen.getByText('Update Bid')).toBeInTheDocument();
  });

  it('shows withdraw button for pending proposals', () => {
    const booking = createMockBooking();
    const swapInfo = createMockSwapInfo({
      userProposalStatus: 'pending',
    });

    render(
      <ProposerActions
        booking={booking}
        swapInfo={swapInfo}
        onWithdrawProposal={mockOnWithdrawProposal}
      />
    );

    expect(screen.getByText('Withdraw')).toBeInTheDocument();
  });

  it('does not show edit button for non-auction proposals', () => {
    const booking = createMockBooking();
    const swapInfo = createMockSwapInfo({
      userProposalStatus: 'pending',
      acceptanceStrategy: 'first-match',
    });

    render(
      <ProposerActions
        booking={booking}
        swapInfo={swapInfo}
        onEditProposal={mockOnEditProposal}
      />
    );

    expect(screen.queryByText('Update Bid')).not.toBeInTheDocument();
  });

  it('calls onViewProposal when view proposal button is clicked', () => {
    const booking = createMockBooking();
    const swapInfo = createMockSwapInfo({
      userProposalStatus: 'pending',
    });

    render(
      <ProposerActions
        booking={booking}
        swapInfo={swapInfo}
        onViewProposal={mockOnViewProposal}
      />
    );

    fireEvent.click(screen.getByText('View Proposal'));
    expect(mockOnViewProposal).toHaveBeenCalled();
  });
});