import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi } from 'vitest';
import { ProposalResponseModal } from '../ProposalResponseModal';
import { swapsSlice } from '../../../store/slices/swapsSlice';
import { SwapWithBookings, SwapProposal } from '../../../services/swapService';
import { BookingType } from '@booking-swap/shared';

// Mock the thunks
const mockAcceptProposal = vi.fn();
const mockRejectProposal = vi.fn();
const mockFetchProposals = vi.fn();

vi.mock('../../../store/thunks/swapThunks', () => ({
  acceptProposal: mockAcceptProposal,
  rejectProposal: mockRejectProposal,
  fetchProposals: mockFetchProposals,
}));

const mockSwap: SwapWithBookings = {
  id: 'swap-1',
  sourceBookingId: 'booking-1',
  targetBookingId: 'booking-2',
  proposerId: 'user-1',
  ownerId: 'user-2',
  status: 'pending',
  terms: {
    additionalPayment: 100,
    conditions: ['Flexible dates'],
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  },
  timeline: {
    createdAt: new Date('2024-01-01'),
    proposedAt: new Date('2024-01-01'),
    respondedAt: undefined,
    completedAt: undefined,
  },
  sourceBooking: {
    id: 'booking-1',
    userId: 'user-1',
    type: 'hotel' as BookingType,
    title: 'Hotel in Paris',
    description: 'Luxury hotel',
    location: {
      city: 'Paris',
      country: 'France',
      address: '123 Main St',
      coordinates: { lat: 48.8566, lng: 2.3522 },
    },
    dateRange: {
      checkIn: new Date('2024-12-15'),
      checkOut: new Date('2024-12-20'),
      flexible: false,
    },
    originalPrice: 1000,
    swapValue: 1000,
    status: 'confirmed',
    verificationStatus: 'verified',
    providerDetails: {
      name: 'Hotel Provider',
      confirmationNumber: 'CONF123',
      contactInfo: 'contact@hotel.com',
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  targetBooking: {
    id: 'booking-2',
    userId: 'user-2',
    type: 'event' as BookingType,
    title: 'Concert Tickets',
    description: 'Rock concert',
    location: {
      city: 'New York',
      country: 'USA',
      address: '456 Broadway',
      coordinates: { lat: 40.7128, lng: -74.006 },
    },
    dateRange: {
      checkIn: new Date('2024-01-15'),
      checkOut: new Date('2024-01-15'),
      flexible: false,
    },
    originalPrice: 750,
    swapValue: 750,
    status: 'confirmed',
    verificationStatus: 'verified',
    providerDetails: {
      name: 'Event Provider',
      confirmationNumber: 'CONF456',
      contactInfo: 'contact@event.com',
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  proposer: {
    id: 'user-1',
    walletAddress: '0x123',
    verificationLevel: 'verified',
    reputation: 95,
  },
  owner: {
    id: 'user-2',
    walletAddress: '0x456',
    verificationLevel: 'verified',
    reputation: 90,
  },
};

const mockProposal: SwapProposal = {
  id: 'proposal-1',
  swapId: 'swap-1',
  proposerId: 'user-3',
  bookingId: 'booking-3',
  message: 'I would love to swap with you!',
  additionalPayment: 50,
  conditions: ['Flexible check-in time', 'Pet-friendly'],
  status: 'pending',
  createdAt: new Date('2024-01-02'),
  respondedAt: undefined,
};

const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      swaps: swapsSlice.reducer,
    },
    preloadedState: {
      swaps: {
        swaps: [],
        currentSwap: null,
        proposals: {},
        currentProposals: [],
        swapHistory: {},
        currentSwapHistory: [],
        pendingSwaps: [],
        activeSwaps: [],
        completedSwaps: [],
        loading: false,
        error: null,
        filters: {},
        currentPage: 1,
        totalPages: 1,
        lastUpdateTime: null,
        lastFetchTime: null,
        cacheExpiry: 3 * 60 * 1000,
        userStats: null,
        ...initialState,
      },
    },
  });
};

describe('ProposalResponseModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    swap: mockSwap,
    proposals: [mockProposal],
    onProposalAccepted: vi.fn(),
    onProposalRejected: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAcceptProposal.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({}),
    });
    mockRejectProposal.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({}),
    });
    mockFetchProposals.mockReturnValue({ type: 'fetchProposals' });
  });

  it('renders modal header correctly', () => {
    const store = createMockStore();

    render(
      <Provider store={store}>
        <ProposalResponseModal {...defaultProps} />
      </Provider>
    );

    expect(screen.getByText('Review Swap Proposals')).toBeInTheDocument();
    expect(screen.getByText('Swap Proposals')).toBeInTheDocument();
    expect(
      screen.getByText('1 pending proposal for your swap')
    ).toBeInTheDocument();
  });

  it('displays original swap information', () => {
    const store = createMockStore();

    render(
      <Provider store={store}>
        <ProposalResponseModal {...defaultProps} />
      </Provider>
    );

    expect(screen.getByText('Your Original Swap Request')).toBeInTheDocument();
    expect(screen.getByText('Hotel in Paris')).toBeInTheDocument();
    expect(screen.getByText('Concert Tickets')).toBeInTheDocument();
    expect(screen.getByText('📍 Paris, France')).toBeInTheDocument();
    expect(screen.getByText('📍 New York, USA')).toBeInTheDocument();
  });

  it('displays proposal details correctly', () => {
    const store = createMockStore();

    render(
      <Provider store={store}>
        <ProposalResponseModal {...defaultProps} />
      </Provider>
    );

    expect(screen.getByText('Incoming Proposals (1)')).toBeInTheDocument();
    expect(screen.getByText('Proposal from User')).toBeInTheDocument();
    expect(screen.getByText('Additional payment: $50.00')).toBeInTheDocument();
    expect(screen.getByText('Flexible check-in time')).toBeInTheDocument();
    expect(screen.getByText('Pet-friendly')).toBeInTheDocument();
    expect(
      screen.getByText('"I would love to swap with you!"')
    ).toBeInTheDocument();
  });

  it('shows empty state when no proposals exist', () => {
    const store = createMockStore();

    render(
      <Provider store={store}>
        <ProposalResponseModal {...defaultProps} proposals={[]} />
      </Provider>
    );

    expect(screen.getByText('No proposals yet')).toBeInTheDocument();
    expect(
      screen.getByText(
        "When users propose swaps for your booking, they'll appear here."
      )
    ).toBeInTheDocument();
  });

  it('handles proposal acceptance', async () => {
    const store = createMockStore();

    render(
      <Provider store={store}>
        <ProposalResponseModal {...defaultProps} />
      </Provider>
    );

    const acceptButton = screen.getByText('Accept Proposal');
    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(mockAcceptProposal).toHaveBeenCalledWith({
        swapId: 'swap-1',
        proposalId: 'proposal-1',
      });
    });
  });

  it('handles proposal rejection with reason', async () => {
    const store = createMockStore();

    render(
      <Provider store={store}>
        <ProposalResponseModal {...defaultProps} />
      </Provider>
    );

    // Click reject button
    const rejectButton = screen.getByText('Reject');
    fireEvent.click(rejectButton);

    // Should open reject modal
    expect(screen.getByText('Reject Proposal')).toBeInTheDocument();
    expect(
      screen.getByText('Are you sure you want to reject this proposal?')
    ).toBeInTheDocument();

    // Enter rejection reason
    const reasonInput = screen.getByPlaceholderText(
      "Let them know why you're rejecting..."
    );
    fireEvent.change(reasonInput, {
      target: { value: 'Not suitable for my needs' },
    });

    // Confirm rejection
    const confirmRejectButton = screen.getByText('Reject Proposal');
    fireEvent.click(confirmRejectButton);

    await waitFor(() => {
      expect(mockRejectProposal).toHaveBeenCalledWith({
        swapId: 'swap-1',
        proposalId: 'proposal-1',
        reason: 'Not suitable for my needs',
      });
    });
  });

  it('handles proposal rejection without reason', async () => {
    const store = createMockStore();

    render(
      <Provider store={store}>
        <ProposalResponseModal {...defaultProps} />
      </Provider>
    );

    // Click reject button
    const rejectButton = screen.getByText('Reject');
    fireEvent.click(rejectButton);

    // Confirm rejection without entering reason
    const confirmRejectButton = screen.getByText('Reject Proposal');
    fireEvent.click(confirmRejectButton);

    await waitFor(() => {
      expect(mockRejectProposal).toHaveBeenCalledWith({
        swapId: 'swap-1',
        proposalId: 'proposal-1',
        reason: undefined,
      });
    });
  });

  it('shows loading state', () => {
    const store = createMockStore({ loading: true });

    render(
      <Provider store={store}>
        <ProposalResponseModal {...defaultProps} />
      </Provider>
    );

    expect(screen.getByText('Loading proposals...')).toBeInTheDocument();
  });

  it('closes modal when close button is clicked', () => {
    const store = createMockStore();

    render(
      <Provider store={store}>
        <ProposalResponseModal {...defaultProps} />
      </Provider>
    );

    const closeButton = screen.getByText('Close');
    fireEvent.click(closeButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('cancels rejection modal', () => {
    const store = createMockStore();

    render(
      <Provider store={store}>
        <ProposalResponseModal {...defaultProps} />
      </Provider>
    );

    // Open reject modal
    const rejectButton = screen.getByText('Reject');
    fireEvent.click(rejectButton);

    // Cancel rejection
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    // Reject modal should be closed
    expect(screen.queryByText('Reject Proposal')).not.toBeInTheDocument();
  });

  it('filters only pending proposals', () => {
    const acceptedProposal: SwapProposal = {
      ...mockProposal,
      id: 'proposal-2',
      status: 'accepted',
    };

    const rejectedProposal: SwapProposal = {
      ...mockProposal,
      id: 'proposal-3',
      status: 'rejected',
    };

    const store = createMockStore();

    render(
      <Provider store={store}>
        <ProposalResponseModal
          {...defaultProps}
          proposals={[mockProposal, acceptedProposal, rejectedProposal]}
        />
      </Provider>
    );

    // Should only show pending proposals
    expect(
      screen.getByText('1 pending proposal for your swap')
    ).toBeInTheDocument();
    expect(screen.getByText('Incoming Proposals (1)')).toBeInTheDocument();
  });
});
