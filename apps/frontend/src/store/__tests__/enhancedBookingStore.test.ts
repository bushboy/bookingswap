import { describe, it, expect, beforeEach, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { bookingsSlice } from '../slices/bookingsSlice';
import { uiSlice } from '../slices/uiSlice';
import { swapsSlice } from '../slices/swapsSlice';
import {
  selectFilteredBookingsWithSwapInfo,
  selectBookingsByUserRole,
  selectBookingsWithActiveSwaps,
  selectBookingStatistics,
  selectFilterSummary,
} from '../selectors/enhancedBookingSelectors';
import { BookingWithSwapInfo, SwapInfo } from '@booking-swap/shared';

// Mock data
const mockBookingWithSwapInfo: BookingWithSwapInfo = {
  id: 'booking-1',
  userId: 'user-1',
  type: 'hotel',
  title: 'Test Hotel Booking',
  description: 'A test hotel booking',
  location: {
    city: 'New York',
    country: 'USA',
    coordinates: [40.7128, -74.0060],
  },
  dateRange: {
    checkIn: new Date('2024-06-01'),
    checkOut: new Date('2024-06-05'),
  },
  originalPrice: 500,
  swapValue: 500,
  providerDetails: {
    provider: 'booking.com',
    confirmationNumber: 'ABC123',
    bookingReference: 'REF123',
  },
  verification: {
    status: 'verified',
    verifiedAt: new Date(),
    documents: [],
  },
  blockchain: {
    topicId: 'topic-1',
  },
  status: 'available',
  createdAt: new Date(),
  updatedAt: new Date(),
  swapInfo: {
    swapId: 'swap-1',
    paymentTypes: ['booking', 'cash'],
    acceptanceStrategy: 'auction',
    auctionEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    minCashAmount: 100,
    maxCashAmount: 200,
    hasActiveProposals: true,
    activeProposalCount: 2,
    userProposalStatus: 'none',
    swapConditions: ['No smoking', 'Pet friendly'],
  },
};

const mockBookingWithoutSwap: BookingWithSwapInfo = {
  ...mockBookingWithSwapInfo,
  id: 'booking-2',
  title: 'Regular Booking',
  swapInfo: undefined,
};

describe('Enhanced Booking Store', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        bookings: bookingsSlice.reducer,
        ui: uiSlice.reducer,
        swaps: swapsSlice.reducer,
      },
    });
  });

  describe('Bookings Slice Enhanced Functionality', () => {
    it('should handle setBookingsWithSwapInfo', () => {
      const bookings = [mockBookingWithSwapInfo, mockBookingWithoutSwap];
      
      store.dispatch(bookingsSlice.actions.setBookingsWithSwapInfo(bookings));
      
      const state = store.getState();
      expect(state.bookings.bookingsWithSwapInfo).toEqual(bookings);
      expect(state.bookings.swappableBookings).toHaveLength(1);
      expect(state.bookings.swappableBookings[0].id).toBe('booking-1');
      expect(state.bookings.swapInfoCache['booking-1']).toEqual(mockBookingWithSwapInfo.swapInfo);
    });

    it('should handle updateSwapInfo', () => {
      // First set initial bookings
      store.dispatch(bookingsSlice.actions.setBookingsWithSwapInfo([mockBookingWithSwapInfo]));
      
      const updatedSwapInfo: SwapInfo = {
        ...mockBookingWithSwapInfo.swapInfo!,
        activeProposalCount: 5,
        userProposalStatus: 'pending',
      };
      
      store.dispatch(bookingsSlice.actions.updateSwapInfo({
        bookingId: 'booking-1',
        swapInfo: updatedSwapInfo,
      }));
      
      const state = store.getState();
      expect(state.bookings.swapInfoCache['booking-1']).toEqual(updatedSwapInfo);
      expect(state.bookings.bookingsWithSwapInfo[0].swapInfo).toEqual(updatedSwapInfo);
    });

    it('should handle removeSwapInfo', () => {
      // First set initial bookings
      store.dispatch(bookingsSlice.actions.setBookingsWithSwapInfo([mockBookingWithSwapInfo]));
      
      store.dispatch(bookingsSlice.actions.removeSwapInfo('booking-1'));
      
      const state = store.getState();
      expect(state.bookings.swapInfoCache['booking-1']).toBeUndefined();
      expect(state.bookings.bookingsWithSwapInfo[0].swapInfo).toBeUndefined();
      expect(state.bookings.swappableBookings).toHaveLength(0);
    });
  });

  describe('UI Slice Enhanced Functionality', () => {
    it('should handle booking form state', () => {
      store.dispatch(uiSlice.actions.openBookingForm({
        mode: 'create',
        swapEnabled: true,
      }));
      
      const state = store.getState();
      expect(state.ui.activeBookingForm.isOpen).toBe(true);
      expect(state.ui.activeBookingForm.mode).toBe('create');
      expect(state.ui.activeBookingForm.swapEnabled).toBe(true);
    });

    it('should handle inline proposal state', () => {
      store.dispatch(uiSlice.actions.openInlineProposal({
        bookingId: 'booking-1',
        proposalType: 'cash',
      }));
      
      const state = store.getState();
      expect(state.ui.inlineProposals['booking-1']).toEqual({
        isOpen: true,
        proposalType: 'cash',
        loading: false,
      });
    });

    it('should handle swap filters', () => {
      store.dispatch(uiSlice.actions.setSwapFilters({
        showSwappableOnly: true,
        showCashAccepting: true,
      }));
      
      const state = store.getState();
      expect(state.ui.filters.showSwappableOnly).toBe(true);
      expect(state.ui.filters.showCashAccepting).toBe(true);
      expect(state.ui.filters.activeFiltersCount).toBe(2);
    });

    it('should handle booking card expansion', () => {
      store.dispatch(uiSlice.actions.toggleBookingCardExpanded('booking-1'));
      
      const state = store.getState();
      expect(state.ui.expandedBookingCards.includes('booking-1')).toBe(true);
      
      // Toggle again
      store.dispatch(uiSlice.actions.toggleBookingCardExpanded('booking-1'));
      const newState = store.getState();
      expect(newState.ui.expandedBookingCards.includes('booking-1')).toBe(false);
    });
  });

  describe('Enhanced Selectors', () => {
    beforeEach(() => {
      // Set up test data
      const bookings = [mockBookingWithSwapInfo, mockBookingWithoutSwap];
      store.dispatch(bookingsSlice.actions.setBookingsWithSwapInfo(bookings));
    });

    it('should select filtered bookings with swap info', () => {
      // Apply swap filter
      store.dispatch(uiSlice.actions.setSwapFilters({ showSwappableOnly: true }));
      
      const state = store.getState();
      const filtered = selectFilteredBookingsWithSwapInfo(state);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('booking-1');
    });

    it('should select bookings by user role', () => {
      const state = store.getState();
      
      // Test owner role
      const ownerBookings = selectBookingsByUserRole(state, 'user-1', 'owner');
      expect(ownerBookings).toHaveLength(2);
      
      // Test browser role
      const browserBookings = selectBookingsByUserRole(state, 'user-2', 'browser');
      expect(browserBookings).toHaveLength(1); // Only swappable bookings
      expect(browserBookings[0].id).toBe('booking-1');
    });

    it('should select bookings with active swaps', () => {
      const state = store.getState();
      const activeSwaps = selectBookingsWithActiveSwaps(state);
      
      expect(activeSwaps).toHaveLength(1);
      expect(activeSwaps[0].id).toBe('booking-1');
    });

    it('should calculate booking statistics', () => {
      const state = store.getState();
      const stats = selectBookingStatistics(state);
      
      expect(stats.totalBookings).toBe(2);
      expect(stats.swappableBookings).toBe(1);
      expect(stats.cashAcceptingBookings).toBe(1);
      expect(stats.auctionBookings).toBe(1);
      expect(stats.averageCashOffer).toBe(100);
      expect(stats.swappablePercentage).toBe(50);
    });

    it('should generate filter summary', () => {
      // Apply some filters
      store.dispatch(uiSlice.actions.setSwapFilters({ 
        showSwappableOnly: true,
        showCashAccepting: true,
      }));
      
      store.dispatch(bookingsSlice.actions.setFilters({
        location: { city: 'New York' },
        priceRange: { min: 50, max: 150 },
      }));
      
      const state = store.getState();
      const summary = selectFilterSummary(state);
      
      expect(summary.hasActiveFilters).toBe(true);
      expect(summary.count).toBeGreaterThan(0);
      expect(summary.activeFilters).toContain('Swappable Only');
      expect(summary.activeFilters).toContain('Accepts Cash');
      expect(summary.activeFilters).toContain('City: New York');
      expect(summary.activeFilters).toContain('Price: $50 - $150');
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete booking with swap workflow', () => {
      // Start with empty state
      expect(store.getState().bookings.bookingsWithSwapInfo).toHaveLength(0);
      
      // Open booking form with swap enabled
      store.dispatch(uiSlice.actions.openBookingForm({
        mode: 'create',
        swapEnabled: true,
      }));
      
      // Add booking with swap info
      store.dispatch(bookingsSlice.actions.addBooking(mockBookingWithSwapInfo));
      
      // Open inline proposal
      store.dispatch(uiSlice.actions.openInlineProposal({
        bookingId: 'booking-1',
        proposalType: 'cash',
      }));
      
      // Apply filters
      store.dispatch(uiSlice.actions.setSwapFilters({ showSwappableOnly: true }));
      
      const state = store.getState();
      
      // Verify booking form state
      expect(state.ui.activeBookingForm.isOpen).toBe(true);
      expect(state.ui.activeBookingForm.swapEnabled).toBe(true);
      
      // Verify booking was added
      expect(state.bookings.bookingsWithSwapInfo).toHaveLength(1);
      expect(state.bookings.swappableBookings).toHaveLength(1);
      
      // Verify inline proposal state
      expect(state.ui.inlineProposals['booking-1'].isOpen).toBe(true);
      expect(state.ui.inlineProposals['booking-1'].proposalType).toBe('cash');
      
      // Verify filters
      expect(state.ui.filters.showSwappableOnly).toBe(true);
      
      // Test selectors with integrated state
      const filtered = selectFilteredBookingsWithSwapInfo(state);
      expect(filtered).toHaveLength(1);
      
      const stats = selectBookingStatistics(state);
      expect(stats.totalBookings).toBe(1);
      expect(stats.swappableBookings).toBe(1);
    });

    it('should handle swap info updates and cache management', () => {
      // Add initial booking
      store.dispatch(bookingsSlice.actions.setBookingsWithSwapInfo([mockBookingWithSwapInfo]));
      
      const initialState = store.getState();
      expect(initialState.bookings.swapInfoCache['booking-1']).toBeDefined();
      expect(initialState.bookings.lastSwapInfoUpdate).toBeDefined();
      
      // Update swap info
      const updatedSwapInfo: SwapInfo = {
        ...mockBookingWithSwapInfo.swapInfo!,
        activeProposalCount: 10,
        userProposalStatus: 'accepted',
      };
      
      store.dispatch(bookingsSlice.actions.updateSwapInfo({
        bookingId: 'booking-1',
        swapInfo: updatedSwapInfo,
      }));
      
      const updatedState = store.getState();
      expect(updatedState.bookings.swapInfoCache['booking-1']).toEqual(updatedSwapInfo);
      expect(updatedState.bookings.lastSwapInfoUpdate).toBeGreaterThan(
        initialState.bookings.lastSwapInfoUpdate!
      );
      
      // Remove swap info
      store.dispatch(bookingsSlice.actions.removeSwapInfo('booking-1'));
      
      const finalState = store.getState();
      expect(finalState.bookings.swapInfoCache['booking-1']).toBeUndefined();
      expect(finalState.bookings.swappableBookings).toHaveLength(0);
    });
  });
});