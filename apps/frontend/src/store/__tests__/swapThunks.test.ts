import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { swapsSlice } from '../slices/swapsSlice';
import {
  fetchSwaps,
  createSwap,
  acceptSwap,
  rejectSwap,
} from '../thunks/swapThunks';
import { swapService } from '../../services/swapService';
import { SwapWithBookings } from '../../services/swapService';

// Mock the swap service
vi.mock('../../services/swapService');
const mockedSwapService = vi.mocked(swapService);

describe('Swap Thunks', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    vi.clearAllMocks();

    store = configureStore({
      reducer: {
        swaps: swapsSlice.reducer,
      },
    });
  });

  const mockSwapWithBookings: SwapWithBookings = {
    id: 'swap1',
    sourceBookingId: 'booking1',
    targetBookingId: 'booking2',
    proposerId: 'user1',
    ownerId: 'user2',
    status: 'pending',
    terms: {
      additionalPayment: 50,
      conditions: ['Flexible dates'],
      expiresAt: new Date('2024-12-31'),
    },
    blockchain: {
      proposalTransactionId: 'tx123',
    },
    timeline: {
      proposedAt: new Date(),
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    sourceBooking: {
      id: 'booking1',
      userId: 'user1',
      type: 'hotel',
      title: 'Source Hotel',
      description: 'Source booking',
      location: { city: 'NYC', country: 'USA' },
      dateRange: { checkIn: new Date(), checkOut: new Date() },
      originalPrice: 500,
      swapValue: 450,
      providerDetails: {
        provider: 'Provider1',
        confirmationNumber: 'CONF1',
        bookingReference: 'REF1',
      },
      verification: { status: 'verified', documents: [] },
      blockchain: { transactionId: 'tx1', topicId: 'topic1' },
      status: 'available',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any,
    targetBooking: {
      id: 'booking2',
      userId: 'user2',
      type: 'hotel',
      title: 'Target Hotel',
      description: 'Target booking',
      location: { city: 'LA', country: 'USA' },
      dateRange: { checkIn: new Date(), checkOut: new Date() },
      originalPrice: 400,
      swapValue: 400,
      providerDetails: {
        provider: 'Provider2',
        confirmationNumber: 'CONF2',
        bookingReference: 'REF2',
      },
      verification: { status: 'verified', documents: [] },
      blockchain: { transactionId: 'tx2', topicId: 'topic2' },
      status: 'available',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any,
    proposer: {
      id: 'user1',
      walletAddress: 'wallet1',
      verificationLevel: 'verified',
    },
    owner: {
      id: 'user2',
      walletAddress: 'wallet2',
      verificationLevel: 'verified',
    },
  };

  describe('fetchSwaps', () => {
    it('should fetch swaps successfully', async () => {
      const mockSwaps = [mockSwapWithBookings];
      mockedSwapService.getSwaps.mockResolvedValue(mockSwaps);

      const result = await store.dispatch(fetchSwaps({ userId: 'user1' }));

      expect(result.type).toBe('swaps/fetchSwaps/fulfilled');
      expect(result.payload).toEqual(mockSwaps);

      const state = store.getState();
      expect(state.swaps.swaps).toEqual(mockSwaps);
      expect(state.swaps.loading).toBe(false);
      expect(state.swaps.error).toBe(null);
    });

    it('should handle fetch swaps error', async () => {
      const errorMessage = 'Failed to fetch swaps';
      mockedSwapService.getSwaps.mockRejectedValue(new Error(errorMessage));

      const result = await store.dispatch(fetchSwaps({ userId: 'user1' }));

      expect(result.type).toBe('swaps/fetchSwaps/rejected');

      const state = store.getState();
      expect(state.swaps.loading).toBe(false);
      expect(state.swaps.error).toBe(errorMessage);
    });

    it('should categorize swaps by status', async () => {
      const pendingSwap = {
        ...mockSwapWithBookings,
        status: 'pending' as const,
      };
      const acceptedSwap = {
        ...mockSwapWithBookings,
        id: 'swap2',
        status: 'accepted' as const,
      };
      const completedSwap = {
        ...mockSwapWithBookings,
        id: 'swap3',
        status: 'completed' as const,
      };

      const mockSwaps = [pendingSwap, acceptedSwap, completedSwap];
      mockedSwapService.getSwaps.mockResolvedValue(mockSwaps);

      await store.dispatch(fetchSwaps({ userId: 'user1' }));

      const state = store.getState();
      expect(state.swaps.pendingSwaps).toHaveLength(1);
      expect(state.swaps.activeSwaps).toHaveLength(1);
      expect(state.swaps.completedSwaps).toHaveLength(1);
    });
  });

  describe('createSwap', () => {
    it('should create swap successfully', async () => {
      const swapData = {
        sourceBookingId: 'booking1',
        targetBookingId: 'booking2',
        terms: {
          additionalPayment: 50,
          conditions: ['Flexible dates'],
          expiresAt: new Date('2024-12-31'),
        },
        message: 'Interested in swapping',
      };

      const basicSwap = {
        id: 'swap1',
        sourceBookingId: 'booking1',
        targetBookingId: 'booking2',
        proposerId: 'user1',
        ownerId: 'user2',
        status: 'pending' as const,
        terms: swapData.terms,
        blockchain: { proposalTransactionId: 'tx123' },
        timeline: { proposedAt: new Date() },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockedSwapService.createSwap.mockResolvedValue(basicSwap);
      mockedSwapService.getSwap.mockResolvedValue(mockSwapWithBookings);

      const result = await store.dispatch(createSwap(swapData));

      expect(result.type).toBe('swaps/createSwap/fulfilled');
      expect(result.payload).toEqual(mockSwapWithBookings);

      const state = store.getState();
      expect(state.swaps.swaps).toContain(mockSwapWithBookings);
      expect(state.swaps.currentSwap).toEqual(mockSwapWithBookings);
    });

    it('should handle create swap error', async () => {
      const swapData = {
        sourceBookingId: '',
        targetBookingId: '',
        terms: {
          additionalPayment: -100,
          conditions: [],
          expiresAt: new Date('2020-01-01'),
        },
      };

      const errorMessage = 'Invalid swap data';
      mockedSwapService.createSwap.mockRejectedValue(new Error(errorMessage));

      const result = await store.dispatch(createSwap(swapData));

      expect(result.type).toBe('swaps/createSwap/rejected');

      const state = store.getState();
      expect(state.swaps.error).toBe(errorMessage);
    });
  });

  describe('acceptSwap', () => {
    it('should accept swap successfully', async () => {
      // Set up initial state with pending swap
      store.dispatch(swapsSlice.actions.addSwap(mockSwapWithBookings));

      const acceptedSwap = {
        ...mockSwapWithBookings,
        status: 'accepted' as const,
      };
      const basicAcceptedSwap = {
        id: 'swap1',
        status: 'accepted' as const,
        timeline: { ...mockSwapWithBookings.timeline, respondedAt: new Date() },
      };

      mockedSwapService.acceptSwap.mockResolvedValue(basicAcceptedSwap as any);
      mockedSwapService.getSwap.mockResolvedValue(acceptedSwap);

      const result = await store.dispatch(
        acceptSwap({ id: 'swap1', message: 'Looks good!' })
      );

      expect(result.type).toBe('swaps/acceptSwap/fulfilled');
      expect(result.payload).toEqual(acceptedSwap);

      const state = store.getState();
      const updatedSwap = state.swaps.swaps.find(s => s.id === 'swap1');
      expect(updatedSwap?.status).toBe('accepted');
    });

    it('should handle optimistic update and revert on error', async () => {
      // Set up initial state with pending swap
      store.dispatch(swapsSlice.actions.addSwap(mockSwapWithBookings));

      const errorMessage = 'Failed to accept swap';
      mockedSwapService.acceptSwap.mockRejectedValue(new Error(errorMessage));
      mockedSwapService.getSwap.mockResolvedValue(mockSwapWithBookings); // For revert

      const result = await store.dispatch(acceptSwap({ id: 'swap1' }));

      expect(result.type).toBe('swaps/acceptSwap/rejected');
      expect(mockedSwapService.getSwap).toHaveBeenCalledWith('swap1'); // Revert call

      const state = store.getState();
      expect(state.swaps.error).toBe(errorMessage);
    });
  });

  describe('rejectSwap', () => {
    it('should reject swap successfully', async () => {
      // Set up initial state with pending swap
      store.dispatch(swapsSlice.actions.addSwap(mockSwapWithBookings));

      const rejectedSwap = {
        ...mockSwapWithBookings,
        status: 'rejected' as const,
      };
      const basicRejectedSwap = {
        id: 'swap1',
        status: 'rejected' as const,
        timeline: { ...mockSwapWithBookings.timeline, respondedAt: new Date() },
      };

      mockedSwapService.rejectSwap.mockResolvedValue(basicRejectedSwap as any);
      mockedSwapService.getSwap.mockResolvedValue(rejectedSwap);

      const result = await store.dispatch(
        rejectSwap({ id: 'swap1', reason: 'Not suitable' })
      );

      expect(result.type).toBe('swaps/rejectSwap/fulfilled');
      expect(result.payload).toEqual(rejectedSwap);

      const state = store.getState();
      const updatedSwap = state.swaps.swaps.find(s => s.id === 'swap1');
      expect(updatedSwap?.status).toBe('rejected');
    });
  });
});
