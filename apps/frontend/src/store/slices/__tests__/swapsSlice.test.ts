import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import {
  swapsSlice,
  setSwaps,
  addSwap,
  updateSwap,
  removeSwap,
  setSwapFilters,
  setSelectedSwap,
  clearSelectedSwap,
  setSwapError,
  clearSwapError,
  setSwapLoading,
  addProposal,
  updateProposal,
  removeProposal,
} from '../swapsSlice';
import {
  SwapWithBookings,
  SwapStatus,
  Booking,
  BookingType,
  BookingStatus,
} from '@booking-swap/shared';

describe('swapsSlice', () => {
  let store: ReturnType<typeof configureStore>;

  const mockBooking: Booking = {
    id: '1',
    userId: 'user1',
    type: 'hotel' as BookingType,
    title: 'Test Hotel',
    description: 'A test hotel booking',
    location: { city: 'New York', country: 'USA' },
    dateRange: {
      checkIn: new Date('2024-06-01'),
      checkOut: new Date('2024-06-05'),
    },
    originalPrice: 500,
    swapValue: 450,
    providerDetails: {
      provider: 'Booking.com',
      confirmationNumber: 'ABC123',
      bookingReference: 'REF123',
    },
    verification: { status: 'verified', documents: [] },
    blockchain: { topicId: 'topic1' },
    status: 'available' as BookingStatus,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSwap: SwapWithBookings = {
    id: 'swap1',
    sourceBookingId: 'booking1',
    targetBookingId: 'booking2',
    proposerId: 'user1',
    ownerId: 'user2',
    status: 'pending' as SwapStatus,
    terms: {
      additionalPayment: 0,
      conditions: [],
    },
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
    sourceBooking: mockBooking,
    targetBooking: { ...mockBooking, id: '2', userId: 'user2' },
    proposer: {
      id: 'user1',
      username: 'user1',
      email: 'user1@example.com',
      profile: {
        firstName: 'John',
        lastName: 'Doe',
        avatar: '',
        bio: '',
        location: { city: 'New York', country: 'USA' },
        preferences: {},
        reputation: { score: 5, reviewCount: 10 },
        verification: { status: 'verified', documents: [] },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    owner: {
      id: 'user2',
      username: 'user2',
      email: 'user2@example.com',
      profile: {
        firstName: 'Jane',
        lastName: 'Smith',
        avatar: '',
        bio: '',
        location: { city: 'Los Angeles', country: 'USA' },
        preferences: {},
        reputation: { score: 4.8, reviewCount: 15 },
        verification: { status: 'verified', documents: [] },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const initialState = {
    swaps: [],
    selectedSwap: null,
    filters: {
      status: [],
      type: [],
      location: {},
      dateRange: {},
    },
    categorizedSwaps: {
      pending: [],
      accepted: [],
      completed: [],
      rejected: [],
      expired: [],
    },
    proposals: {},
    loading: false,
    error: null,
  };

  beforeEach(() => {
    store = configureStore({
      reducer: {
        swaps: swapsSlice.reducer,
      },
    });
  });

  it('should return the initial state', () => {
    expect(swapsSlice.reducer(undefined, { type: undefined })).toEqual(
      initialState
    );
  });

  describe('setSwaps', () => {
    it('should set swaps list and categorize by status', () => {
      const swaps = [
        mockSwap,
        { ...mockSwap, id: 'swap2', status: 'accepted' as SwapStatus },
        { ...mockSwap, id: 'swap3', status: 'completed' as SwapStatus },
      ];

      const action = setSwaps(swaps);
      const state = swapsSlice.reducer(initialState, action);

      expect(state.swaps).toEqual(swaps);
      expect(state.categorizedSwaps.pending).toHaveLength(1);
      expect(state.categorizedSwaps.accepted).toHaveLength(1);
      expect(state.categorizedSwaps.completed).toHaveLength(1);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('addSwap', () => {
    it('should add a new swap and categorize it', () => {
      const action = addSwap(mockSwap);
      const state = swapsSlice.reducer(initialState, action);

      expect(state.swaps).toContain(mockSwap);
      expect(state.categorizedSwaps.pending).toContain(mockSwap);
    });

    it('should not add duplicate swap', () => {
      const stateWithSwap = {
        ...initialState,
        swaps: [mockSwap],
        categorizedSwaps: {
          ...initialState.categorizedSwaps,
          pending: [mockSwap],
        },
      };

      const action = addSwap(mockSwap);
      const state = swapsSlice.reducer(stateWithSwap, action);

      expect(state.swaps).toHaveLength(1);
      expect(state.categorizedSwaps.pending).toHaveLength(1);
    });
  });

  describe('updateSwap', () => {
    it('should update existing swap and recategorize', () => {
      const stateWithSwap = {
        ...initialState,
        swaps: [mockSwap],
        categorizedSwaps: {
          ...initialState.categorizedSwaps,
          pending: [mockSwap],
        },
      };

      const updatedSwap = { ...mockSwap, status: 'accepted' as SwapStatus };
      const action = updateSwap(updatedSwap);
      const state = swapsSlice.reducer(stateWithSwap, action);

      expect(state.swaps[0].status).toBe('accepted');
      expect(state.categorizedSwaps.pending).toHaveLength(0);
      expect(state.categorizedSwaps.accepted).toHaveLength(1);
    });

    it('should update selected swap if it matches', () => {
      const stateWithSelected = {
        ...initialState,
        swaps: [mockSwap],
        selectedSwap: mockSwap,
        categorizedSwaps: {
          ...initialState.categorizedSwaps,
          pending: [mockSwap],
        },
      };

      const updatedSwap = { ...mockSwap, status: 'accepted' as SwapStatus };
      const action = updateSwap(updatedSwap);
      const state = swapsSlice.reducer(stateWithSelected, action);

      expect(state.selectedSwap?.status).toBe('accepted');
    });
  });

  describe('removeSwap', () => {
    it('should remove swap by id and from categories', () => {
      const stateWithSwap = {
        ...initialState,
        swaps: [mockSwap],
        categorizedSwaps: {
          ...initialState.categorizedSwaps,
          pending: [mockSwap],
        },
      };

      const action = removeSwap('swap1');
      const state = swapsSlice.reducer(stateWithSwap, action);

      expect(state.swaps).toHaveLength(0);
      expect(state.categorizedSwaps.pending).toHaveLength(0);
    });

    it('should clear selected swap if removed', () => {
      const stateWithSelected = {
        ...initialState,
        swaps: [mockSwap],
        selectedSwap: mockSwap,
        categorizedSwaps: {
          ...initialState.categorizedSwaps,
          pending: [mockSwap],
        },
      };

      const action = removeSwap('swap1');
      const state = swapsSlice.reducer(stateWithSelected, action);

      expect(state.selectedSwap).toBeNull();
    });
  });

  describe('setSwapFilters', () => {
    it('should update filters', () => {
      const filters = {
        status: ['pending' as SwapStatus],
        type: ['hotel'],
        location: { city: 'New York' },
      };

      const action = setSwapFilters(filters);
      const state = swapsSlice.reducer(initialState, action);

      expect(state.filters.status).toEqual(['pending']);
      expect(state.filters.type).toEqual(['hotel']);
      expect(state.filters.location.city).toBe('New York');
    });
  });

  describe('setSelectedSwap', () => {
    it('should set selected swap', () => {
      const action = setSelectedSwap(mockSwap);
      const state = swapsSlice.reducer(initialState, action);

      expect(state.selectedSwap).toEqual(mockSwap);
    });
  });

  describe('clearSelectedSwap', () => {
    it('should clear selected swap', () => {
      const stateWithSelected = {
        ...initialState,
        selectedSwap: mockSwap,
      };

      const action = clearSelectedSwap();
      const state = swapsSlice.reducer(stateWithSelected, action);

      expect(state.selectedSwap).toBeNull();
    });
  });

  describe('setSwapLoading', () => {
    it('should set loading state', () => {
      const action = setSwapLoading(true);
      const state = swapsSlice.reducer(initialState, action);

      expect(state.loading).toBe(true);
    });

    it('should clear error when loading starts', () => {
      const stateWithError = {
        ...initialState,
        error: 'Previous error',
      };

      const action = setSwapLoading(true);
      const state = swapsSlice.reducer(stateWithError, action);

      expect(state.error).toBeNull();
    });
  });

  describe('setSwapError', () => {
    it('should set error state', () => {
      const error = 'Failed to load swaps';
      const action = setSwapError(error);
      const state = swapsSlice.reducer(initialState, action);

      expect(state.error).toBe(error);
      expect(state.loading).toBe(false);
    });
  });

  describe('clearSwapError', () => {
    it('should clear error state', () => {
      const stateWithError = {
        ...initialState,
        error: 'Some error',
      };

      const action = clearSwapError();
      const state = swapsSlice.reducer(stateWithError, action);

      expect(state.error).toBeNull();
    });
  });

  describe('proposal management', () => {
    const mockProposal = {
      id: 'proposal1',
      swapId: 'swap1',
      proposerId: 'user3',
      bookingId: 'booking3',
      message: 'Interested in this swap',
      status: 'pending' as const,
      createdAt: new Date(),
    };

    describe('addProposal', () => {
      it('should add proposal to swap', () => {
        const action = addProposal(mockProposal);
        const state = swapsSlice.reducer(initialState, action);

        expect(state.proposals['swap1']).toContain(mockProposal);
      });

      it('should create proposals array if it does not exist', () => {
        const action = addProposal(mockProposal);
        const state = swapsSlice.reducer(initialState, action);

        expect(state.proposals['swap1']).toBeDefined();
        expect(state.proposals['swap1']).toHaveLength(1);
      });
    });

    describe('updateProposal', () => {
      it('should update existing proposal', () => {
        const stateWithProposal = {
          ...initialState,
          proposals: {
            swap1: [mockProposal],
          },
        };

        const updatedProposal = {
          ...mockProposal,
          status: 'accepted' as const,
        };
        const action = updateProposal(updatedProposal);
        const state = swapsSlice.reducer(stateWithProposal, action);

        expect(state.proposals['swap1'][0].status).toBe('accepted');
      });
    });

    describe('removeProposal', () => {
      it('should remove proposal by id', () => {
        const stateWithProposal = {
          ...initialState,
          proposals: {
            swap1: [mockProposal],
          },
        };

        const action = removeProposal({
          swapId: 'swap1',
          proposalId: 'proposal1',
        });
        const state = swapsSlice.reducer(stateWithProposal, action);

        expect(state.proposals['swap1']).toHaveLength(0);
      });
    });
  });

  describe('categorization logic', () => {
    it('should correctly categorize swaps by status', () => {
      const swaps = [
        { ...mockSwap, id: 'swap1', status: 'pending' as SwapStatus },
        { ...mockSwap, id: 'swap2', status: 'accepted' as SwapStatus },
        { ...mockSwap, id: 'swap3', status: 'completed' as SwapStatus },
        { ...mockSwap, id: 'swap4', status: 'rejected' as SwapStatus },
        { ...mockSwap, id: 'swap5', status: 'expired' as SwapStatus },
      ];

      const action = setSwaps(swaps);
      const state = swapsSlice.reducer(initialState, action);

      expect(state.categorizedSwaps.pending).toHaveLength(1);
      expect(state.categorizedSwaps.accepted).toHaveLength(1);
      expect(state.categorizedSwaps.completed).toHaveLength(1);
      expect(state.categorizedSwaps.rejected).toHaveLength(1);
      expect(state.categorizedSwaps.expired).toHaveLength(1);
    });

    it('should handle expired swaps based on expiration date', () => {
      const expiredSwap = {
        ...mockSwap,
        id: 'expired-swap',
        status: 'pending' as SwapStatus,
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      };

      const action = addSwap(expiredSwap);
      const state = swapsSlice.reducer(initialState, action);

      // The slice should handle expired swaps appropriately
      expect(state.swaps).toContain(expiredSwap);
    });
  });
});
