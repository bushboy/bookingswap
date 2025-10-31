import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi } from 'vitest';
import { SwapCompletionModal } from '../SwapCompletionModal';
import { swapsSlice } from '../../../store/slices/swapsSlice';
import { SwapWithBookings } from '../../../services/swapService';
import { BookingType } from '@booking-swap/shared';

// Mock the thunks
const mockCompleteSwap = vi.fn();

vi.mock('../../../store/thunks/swapThunks', () => ({
  completeSwap: mockCompleteSwap,
}));

const mockSwap: SwapWithBookings = {
  id: 'swap-1',
  sourceBookingId: 'booking-1',
  targetBookingId: 'booking-2',
  proposerId: 'user-1',
  ownerId: 'user-2',
  status: 'accepted',
  terms: {
    additionalPayment: 100,
    conditions: ['Flexible dates'],
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  },
  timeline: {
    createdAt: new Date('2024-01-01'),
    proposedAt: new Date('2024-01-01'),
    respondedAt: new Date('2024-01-02'),
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

describe('SwapCompletionModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    swap: mockSwap,
    onSwapCompleted: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCompleteSwap.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({}) });
  });

  it('renders modal header correctly', () => {
    const store = createMockStore();

    render(
      <Provider store={store}>
        <SwapCompletionModal {...defaultProps} />
      </Provider>
    );

    expect(screen.getByText('Complete Swap Transaction')).toBeInTheDocument();
    expect(
      screen.getByText('Finalize the ownership transfer on the blockchain')
    ).toBeInTheDocument();
  });

  it('displays swap summary correctly', () => {
    const store = createMockStore();

    render(
      <Provider store={store}>
        <SwapCompletionModal {...defaultProps} />
      </Provider>
    );

    expect(screen.getByText('Swap Summary')).toBeInTheDocument();
    expect(screen.getByText('Hotel in Paris')).toBeInTheDocument();
    expect(screen.getByText('Concert Tickets')).toBeInTheDocument();
    expect(screen.getByText('$1,000.00')).toBeInTheDocument();
    expect(screen.getByText('$750.00')).toBeInTheDocument();
  });

  it('shows additional payment information when applicable', () => {
    const store = createMockStore();

    render(
      <Provider store={store}>
        <SwapCompletionModal {...defaultProps} />
      </Provider>
    );

    expect(
      screen.getByText('Additional payment required: $100.00')
    ).toBeInTheDocument();
  });

  it('displays completion steps', () => {
    const store = createMockStore();

    render(
      <Provider store={store}>
        <SwapCompletionModal {...defaultProps} />
      </Provider>
    );

    expect(screen.getByText('Completion Progress')).toBeInTheDocument();
    expect(screen.getByText('Validate Swap Details')).toBeInTheDocument();
    expect(
      screen.getByText('Prepare Blockchain Transaction')
    ).toBeInTheDocument();
    expect(screen.getByText('Sign Transaction')).toBeInTheDocument();
    expect(screen.getByText('Submit to Blockchain')).toBeInTheDocument();
    expect(screen.getByText('Transfer Ownership')).toBeInTheDocument();
    expect(screen.getByText('Finalize Swap')).toBeInTheDocument();
  });

  it('shows warning message initially', () => {
    const store = createMockStore();

    render(
      <Provider store={store}>
        <SwapCompletionModal {...defaultProps} />
      </Provider>
    );

    expect(screen.getByText('Important Notice')).toBeInTheDocument();
    expect(
      screen.getByText(/This action will transfer ownership/)
    ).toBeInTheDocument();
  });

  it('handles completion process', async () => {
    const store = createMockStore();

    render(
      <Provider store={store}>
        <SwapCompletionModal {...defaultProps} />
      </Provider>
    );

    const completeButton = screen.getByText('Complete Swap');
    fireEvent.click(completeButton);

    // Should start the completion process
    await waitFor(
      () => {
        expect(
          screen.getByText('Verifying booking information and swap terms')
        ).toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    // Wait for completion
    await waitFor(
      () => {
        expect(mockCompleteSwap).toHaveBeenCalledWith('swap-1');
      },
      { timeout: 10000 }
    );
  });

  it('shows success message when completed', async () => {
    const store = createMockStore();

    render(
      <Provider store={store}>
        <SwapCompletionModal {...defaultProps} />
      </Provider>
    );

    const completeButton = screen.getByText('Complete Swap');
    fireEvent.click(completeButton);

    // Wait for success message
    await waitFor(
      () => {
        expect(
          screen.getByText('Swap Completed Successfully!')
        ).toBeInTheDocument();
      },
      { timeout: 10000 }
    );

    expect(
      screen.getByText(/The ownership transfer has been completed/)
    ).toBeInTheDocument();
  });

  it('handles completion failure', async () => {
    mockCompleteSwap.mockReturnValue({
      unwrap: vi.fn().mockRejectedValue(new Error('Blockchain error')),
    });

    const store = createMockStore();

    render(
      <Provider store={store}>
        <SwapCompletionModal {...defaultProps} />
      </Provider>
    );

    const completeButton = screen.getByText('Complete Swap');
    fireEvent.click(completeButton);

    // Wait for error message
    await waitFor(
      () => {
        expect(screen.getByText('Completion Failed')).toBeInTheDocument();
      },
      { timeout: 10000 }
    );

    expect(screen.getByText('Blockchain error')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('closes modal when close button is clicked', () => {
    const store = createMockStore();

    render(
      <Provider store={store}>
        <SwapCompletionModal {...defaultProps} />
      </Provider>
    );

    const closeButton = screen.getByText('Cancel');
    fireEvent.click(closeButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onSwapCompleted when swap is completed', async () => {
    const store = createMockStore();

    render(
      <Provider store={store}>
        <SwapCompletionModal {...defaultProps} />
      </Provider>
    );

    const completeButton = screen.getByText('Complete Swap');
    fireEvent.click(completeButton);

    // Wait for completion
    await waitFor(
      () => {
        expect(defaultProps.onSwapCompleted).toHaveBeenCalledWith('swap-1');
      },
      { timeout: 10000 }
    );
  });

  it('does not show additional payment when not applicable', () => {
    const swapWithoutPayment = {
      ...mockSwap,
      terms: {
        ...mockSwap.terms,
        additionalPayment: 0,
      },
    };

    const store = createMockStore();

    render(
      <Provider store={store}>
        <SwapCompletionModal {...defaultProps} swap={swapWithoutPayment} />
      </Provider>
    );

    expect(
      screen.queryByText(/Additional payment required/)
    ).not.toBeInTheDocument();
  });

  it('shows transaction hash when available', async () => {
    const store = createMockStore();

    render(
      <Provider store={store}>
        <SwapCompletionModal {...defaultProps} />
      </Provider>
    );

    const completeButton = screen.getByText('Complete Swap');
    fireEvent.click(completeButton);

    // Wait for transaction hash to appear
    await waitFor(
      () => {
        expect(screen.getByText('Transaction Hash')).toBeInTheDocument();
      },
      { timeout: 8000 }
    );

    // Should show a mock transaction hash
    const hashElement = screen.getByText(/0x[a-f0-9]+/);
    expect(hashElement).toBeInTheDocument();
  });
});
