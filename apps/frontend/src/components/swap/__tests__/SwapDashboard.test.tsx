import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi } from 'vitest';
import { SwapDashboard } from '../SwapDashboard';
import { swapsSlice } from '../../../store/slices/swapsSlice';

// Mock the SwapCard component
vi.mock('../SwapCard', () => ({
  SwapCard: ({ swap }: any) => (
    <div data-testid={`swap-card-${swap.id}`}>
      Mock SwapCard: {swap.sourceBooking.title}
    </div>
  ),
}));

// Mock the thunks
vi.mock('../../../store/thunks/swapThunks', () => ({
  fetchSwaps: vi.fn(() => ({ type: 'fetchSwaps', payload: [] })),
  fetchUserSwapStats: vi.fn(() => ({
    type: 'fetchUserSwapStats',
    payload: null,
  })),
  refreshSwaps: vi.fn(() => ({ type: 'refreshSwaps', payload: [] })),
}));

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

describe('SwapDashboard', () => {
  const defaultProps = {
    userId: 'user-1',
    onCreateSwap: vi.fn(),
    onBrowseBookings: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dashboard header correctly', () => {
    const store = createMockStore();

    render(
      <Provider store={store}>
        <SwapDashboard {...defaultProps} />
      </Provider>
    );

    expect(screen.getByText('My Proposals')).toBeInTheDocument();
    expect(screen.getByText('Refresh')).toBeInTheDocument();
    expect(screen.getByText('Browse Bookings')).toBeInTheDocument();
    expect(screen.getByText('Create Swap')).toBeInTheDocument();
  });

  it('shows empty state when no swaps exist', () => {
    const store = createMockStore();

    render(
      <Provider store={store}>
        <SwapDashboard {...defaultProps} />
      </Provider>
    );

    expect(screen.getByText('No swaps yet')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Start by browsing available bookings and proposing your first swap.'
      )
    ).toBeInTheDocument();
  });

  it('shows loading state', () => {
    const store = createMockStore({
      loading: true,
    });

    render(
      <Provider store={store}>
        <SwapDashboard {...defaultProps} />
      </Provider>
    );

    expect(screen.getByText('Loading swaps...')).toBeInTheDocument();
  });

  it('shows error state', () => {
    const store = createMockStore({
      error: 'Failed to load swaps',
    });

    render(
      <Provider store={store}>
        <SwapDashboard {...defaultProps} />
      </Provider>
    );

    expect(screen.getByText('Error loading swaps')).toBeInTheDocument();
    expect(screen.getByText('Failed to load swaps')).toBeInTheDocument();
  });
});
