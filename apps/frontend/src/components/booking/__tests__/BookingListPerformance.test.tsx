import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { renderWithProviders, createMockBooking, TestPerformanceMonitor } from '@/test/testUtils';
import { BookingListings } from '../BookingListings';
import { EnhancedBookingCard } from '../EnhancedBookingCard';
import { IntegratedFilterPanel } from '../IntegratedFilterPanel';
import { BookingWithSwapInfo, EnhancedBookingFilters } from '@booking-swap/shared';

// Performance test utilities
const performanceMonitor = new TestPerformanceMonitor();

// Mock large datasets
const createLargeBookingDataset = (size: number): BookingWithSwapInfo[] => {
  return Array.from({ length: size }, (_, index) => {
    const hasSwap = index % 3 === 0; // Every 3rd booking has swap info
    const acceptsCash = index % 5 === 0; // Every 5th booking accepts cash
    const isAuction = index % 7 === 0; // Every 7th booking is auction mode

    return createMockBooking({
      id: `perf-booking-${index}`,
      title: `Performance Test Booking ${index}`,
      description: `This is a performance test booking with index ${index}. It contains enough text to simulate real booking descriptions that users might write when creating their bookings.`,
      location: {
        city: `City${index % 20}`, // 20 different cities
        country: `Country${index % 10}`, // 10 different countries
      },
      originalPrice: 100 + (index % 500), // Varied prices
      swapValue: hasSwap ? 90 + (index % 450) : undefined,
      swapInfo: hasSwap ? {
        swapId: `swap-${index}`,
        paymentTypes: acceptsCash ? ['booking', 'cash'] : ['booking'],
        acceptanceStrategy: isAuction ? 'auction' : 'first-match',
        minCashAmount: acceptsCash ? 50 + (index % 200) : undefined,
        maxCashAmount: acceptsCash ? 300 + (index % 700) : undefined,
        hasActiveProposals: index % 4 === 0, // 25% have active proposals
        activeProposalCount: index % 4 === 0 ? (index % 5) + 1 : 0,
        userProposalStatus: index % 8 === 0 ? 'pending' : 'none',
        auctionEndDate: isAuction ? new Date(Date.now() + (index % 7) * 24 * 60 * 60 * 1000) : undefined,
        timeRemaining: isAuction ? (index % 7) * 24 * 60 * 60 * 1000 : undefined,
      } : undefined,
    });
  });
};

const mockFilters: EnhancedBookingFilters = {
  type: undefined,
  location: undefined,
  dateRange: undefined,
  priceRange: undefined,
  swapAvailable: false,
  acceptsCash: false,
  auctionMode: false,
  swapType: undefined,
};

describe('Booking List Performance Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    performanceMonitor.clear();
  });

  describe('Large Dataset Rendering Performance', () => {
    it('should render 100 bookings within acceptable time', async () => {
      const bookings = createLargeBookingDataset(100);
      
      performanceMonitor.mark('render-start');
      
      renderWithProviders(
        <BookingListings
          bookings={bookings}
          loading={false}
          onBookingClick={vi.fn()}
          onMakeProposal={vi.fn()}
          onEditBooking={vi.fn()}
        />
      );

      // Wait for all booking cards to render
      await waitFor(() => {
        expect(screen.getAllByTestId('booking-card')).toHaveLength(100);
      });

      performanceMonitor.mark('render-end');
      const renderTime = performanceMonitor.measure('render-start', 'render-end');

      // Should render 100 bookings within 2 seconds
      expect(renderTime).toBeLessThan(2000);
    });

    it('should render 500 bookings within acceptable time', async () => {
      const bookings = createLargeBookingDataset(500);
      
      performanceMonitor.mark('render-start');
      
      renderWithProviders(
        <BookingListings
          bookings={bookings}
          loading={false}
          onBookingClick={vi.fn()}
          onMakeProposal={vi.fn()}
          onEditBooking={vi.fn()}
          virtualizeThreshold={50} // Enable virtualization for large lists
        />
      );

      // Wait for initial viewport to render
      await waitFor(() => {
        const visibleCards = screen.getAllByTestId('booking-card');
        expect(visibleCards.length).toBeGreaterThan(0);
        expect(visibleCards.length).toBeLessThan(100); // Should virtualize
      });

      performanceMonitor.mark('render-end');
      const renderTime = performanceMonitor.measure('render-start', 'render-end');

      // Should render initial viewport within 3 seconds even with 500 bookings
      expect(renderTime).toBeLessThan(3000);
    });

    it('should handle 1000 bookings with virtualization', async () => {
      const bookings = createLargeBookingDataset(1000);
      
      performanceMonitor.mark('render-start');
      
      renderWithProviders(
        <BookingListings
          bookings={bookings}
          loading={false}
          onBookingClick={vi.fn()}
          onMakeProposal={vi.fn()}
          onEditBooking={vi.fn()}
          virtualizeThreshold={20}
        />
      );

      // Should only render visible items
      await waitFor(() => {
        const visibleCards = screen.getAllByTestId('booking-card');
        expect(visibleCards.length).toBeLessThan(50); // Much less than total
      });

      performanceMonitor.mark('render-end');
      const renderTime = performanceMonitor.measure('render-start', 'render-end');

      // Should render quickly with virtualization
      expect(renderTime).toBeLessThan(1000);
    });
  });

  describe('Filtering Performance', () => {
    it('should filter large datasets quickly', async () => {
      const user = userEvent.setup();
      const bookings = createLargeBookingDataset(200);
      const onFiltersChange = vi.fn();
      
      renderWithProviders(
        <div>
          <IntegratedFilterPanel
            filters={mockFilters}
            onChange={onFiltersChange}
            onReset={vi.fn()}
          />
          <BookingListings
            bookings={bookings}
            loading={false}
            onBookingClick={vi.fn()}
            onMakeProposal={vi.fn()}
            onEditBooking={vi.fn()}
          />
        </div>
      );

      performanceMonitor.mark('filter-start');

      // Apply swap filter
      const swapFilter = screen.getByLabelText('Available for swapping');
      await user.click(swapFilter);

      performanceMonitor.mark('filter-end');
      const filterTime = performanceMonitor.measure('filter-start', 'filter-end');

      // Filter application should be fast
      expect(filterTime).toBeLessThan(100);
      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({ swapAvailable: true })
      );
    });

    it('should handle rapid filter changes efficiently', async () => {
      const user = userEvent.setup();
      const bookings = createLargeBookingDataset(100);
      const onFiltersChange = vi.fn();
      
      renderWithProviders(
        <IntegratedFilterPanel
          filters={mockFilters}
          onChange={onFiltersChange}
          onReset={vi.fn()}
        />
      );

      performanceMonitor.mark('rapid-filter-start');

      // Rapidly toggle filters
      const swapFilter = screen.getByLabelText('Available for swapping');
      const cashFilter = screen.getByLabelText('Accepts cash offers');
      const auctionFilter = screen.getByLabelText('Auction mode active');

      for (let i = 0; i < 10; i++) {
        await user.click(swapFilter);
        await user.click(cashFilter);
        await user.click(auctionFilter);
      }

      performanceMonitor.mark('rapid-filter-end');
      const rapidFilterTime = performanceMonitor.measure('rapid-filter-start', 'rapid-filter-end');

      // Should handle rapid changes within 1 second
      expect(rapidFilterTime).toBeLessThan(1000);
    });

    it('should debounce search input for performance', async () => {
      const user = userEvent.setup();
      const onFiltersChange = vi.fn();
      
      renderWithProviders(
        <IntegratedFilterPanel
          filters={mockFilters}
          onChange={onFiltersChange}
          onReset={vi.fn()}
        />
      );

      const searchInput = screen.getByLabelText('Search bookings');
      
      performanceMonitor.mark('search-start');

      // Type rapidly
      await user.type(searchInput, 'Paris Hotel');

      // Should debounce calls
      await waitFor(() => {
        expect(onFiltersChange).toHaveBeenCalledTimes(1); // Only final call after debounce
      }, { timeout: 1000 });

      performanceMonitor.mark('search-end');
      const searchTime = performanceMonitor.measure('search-start', 'search-end');

      expect(searchTime).toBeLessThan(1500); // Including debounce delay
    });
  });

  describe('Individual Component Performance', () => {
    it('should render EnhancedBookingCard quickly with complex swap info', () => {
      const complexBooking = createMockBooking({
        id: 'complex-booking',
        title: 'Complex Booking with Extensive Swap Information',
        description: 'This booking has a very long description with lots of details about the accommodation, amenities, location, and special requirements that might affect rendering performance.',
        swapInfo: {
          swapId: 'complex-swap',
          paymentTypes: ['booking', 'cash'],
          acceptanceStrategy: 'auction',
          minCashAmount: 100,
          maxCashAmount: 500,
          hasActiveProposals: true,
          activeProposalCount: 15,
          userProposalStatus: 'pending',
          auctionEndDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          timeRemaining: 2 * 24 * 60 * 60 * 1000,
        },
      });

      performanceMonitor.mark('card-render-start');

      renderWithProviders(
        <EnhancedBookingCard
          booking={complexBooking}
          swapInfo={complexBooking.swapInfo}
          userRole="browser"
          onViewDetails={vi.fn()}
          onMakeProposal={vi.fn()}
        />
      );

      performanceMonitor.mark('card-render-end');
      const cardRenderTime = performanceMonitor.measure('card-render-start', 'card-render-end');

      // Individual card should render very quickly
      expect(cardRenderTime).toBeLessThan(50);
    });

    it('should handle proposal form interactions efficiently', async () => {
      const user = userEvent.setup();
      const booking = createMockBooking({
        swapInfo: {
          swapId: 'test-swap',
          paymentTypes: ['booking', 'cash'],
          acceptanceStrategy: 'first-match',
          minCashAmount: 100,
          hasActiveProposals: true,
          activeProposalCount: 3,
        },
      });

      renderWithProviders(
        <EnhancedBookingCard
          booking={booking}
          swapInfo={booking.swapInfo}
          userRole="browser"
          onViewDetails={vi.fn()}
          onMakeProposal={vi.fn()}
        />
      );

      performanceMonitor.mark('interaction-start');

      // Open proposal form
      const proposalButton = screen.getByText('Make Proposal');
      await user.click(proposalButton);

      // Interact with form elements
      const cashRadio = screen.getByLabelText(/cash offer/i);
      await user.click(cashRadio);

      const cashInput = screen.getByLabelText(/cash amount/i);
      await user.type(cashInput, '250');

      const messageInput = screen.getByLabelText(/message/i);
      await user.type(messageInput, 'Interested in this swap!');

      performanceMonitor.mark('interaction-end');
      const interactionTime = performanceMonitor.measure('interaction-start', 'interaction-end');

      // Form interactions should be responsive
      expect(interactionTime).toBeLessThan(500);
    });
  });

  describe('Memory Usage and Cleanup', () => {
    it('should not leak memory when unmounting large lists', () => {
      const bookings = createLargeBookingDataset(100);
      
      const { unmount } = renderWithProviders(
        <BookingListings
          bookings={bookings}
          loading={false}
          onBookingClick={vi.fn()}
          onMakeProposal={vi.fn()}
          onEditBooking={vi.fn()}
        />
      );

      // Measure memory before unmount
      const beforeUnmount = performance.memory?.usedJSHeapSize || 0;

      unmount();

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Memory should not increase significantly after unmount
      const afterUnmount = performance.memory?.usedJSHeapSize || 0;
      const memoryIncrease = afterUnmount - beforeUnmount;

      // Allow for some variance but should not leak significantly
      expect(memoryIncrease).toBeLessThan(1024 * 1024); // Less than 1MB increase
    });

    it('should clean up event listeners and timers', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      const setIntervalSpy = vi.spyOn(window, 'setInterval');
      const clearIntervalSpy = vi.spyOn(window, 'clearInterval');

      const bookings = createLargeBookingDataset(50);
      
      const { unmount } = renderWithProviders(
        <BookingListings
          bookings={bookings}
          loading={false}
          onBookingClick={vi.fn()}
          onMakeProposal={vi.fn()}
          onEditBooking={vi.fn()}
        />
      );

      const eventListenersAdded = addEventListenerSpy.mock.calls.length;
      const intervalsSet = setIntervalSpy.mock.calls.length;

      unmount();

      // Should clean up event listeners
      expect(removeEventListenerSpy).toHaveBeenCalledTimes(eventListenersAdded);
      
      // Should clean up intervals
      expect(clearIntervalSpy).toHaveBeenCalledTimes(intervalsSet);

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
    });
  });

  describe('Scroll Performance', () => {
    it('should handle smooth scrolling through large lists', async () => {
      const bookings = createLargeBookingDataset(200);
      
      renderWithProviders(
        <BookingListings
          bookings={bookings}
          loading={false}
          onBookingClick={vi.fn()}
          onMakeProposal={vi.fn()}
          onEditBooking={vi.fn()}
          virtualizeThreshold={50}
        />
      );

      const scrollContainer = screen.getByTestId('booking-list-container');

      performanceMonitor.mark('scroll-start');

      // Simulate scrolling
      for (let i = 0; i < 10; i++) {
        scrollContainer.scrollTop = i * 100;
        
        // Trigger scroll event
        scrollContainer.dispatchEvent(new Event('scroll'));
        
        // Wait for any updates
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      performanceMonitor.mark('scroll-end');
      const scrollTime = performanceMonitor.measure('scroll-start', 'scroll-end');

      // Scrolling should be smooth and responsive
      expect(scrollTime).toBeLessThan(1000);
    });

    it('should throttle scroll events for performance', async () => {
      const onScroll = vi.fn();
      const bookings = createLargeBookingDataset(100);
      
      renderWithProviders(
        <BookingListings
          bookings={bookings}
          loading={false}
          onBookingClick={vi.fn()}
          onMakeProposal={vi.fn()}
          onEditBooking={vi.fn()}
          onScroll={onScroll}
        />
      );

      const scrollContainer = screen.getByTestId('booking-list-container');

      // Rapidly fire scroll events
      for (let i = 0; i < 100; i++) {
        scrollContainer.dispatchEvent(new Event('scroll'));
      }

      await waitFor(() => {
        // Should throttle scroll events (much fewer than 100 calls)
        expect(onScroll.mock.calls.length).toBeLessThan(20);
      });
    });
  });

  describe('Network Performance Simulation', () => {
    it('should handle slow loading states gracefully', async () => {
      const bookings = createLargeBookingDataset(50);
      
      // Start with loading state
      const { rerender } = renderWithProviders(
        <BookingListings
          bookings={[]}
          loading={true}
          onBookingClick={vi.fn()}
          onMakeProposal={vi.fn()}
          onEditBooking={vi.fn()}
        />
      );

      // Should show loading skeleton
      expect(screen.getAllByTestId('booking-card-skeleton')).toHaveLength(10); // Default skeleton count

      performanceMonitor.mark('load-start');

      // Simulate data arriving
      rerender(
        <BookingListings
          bookings={bookings}
          loading={false}
          onBookingClick={vi.fn()}
          onMakeProposal={vi.fn()}
          onEditBooking={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getAllByTestId('booking-card')).toHaveLength(50);
      });

      performanceMonitor.mark('load-end');
      const loadTime = performanceMonitor.measure('load-start', 'load-end');

      // Transition from loading to loaded should be fast
      expect(loadTime).toBeLessThan(500);
    });

    it('should handle incremental loading efficiently', async () => {
      const allBookings = createLargeBookingDataset(100);
      const initialBookings = allBookings.slice(0, 20);
      
      const { rerender } = renderWithProviders(
        <BookingListings
          bookings={initialBookings}
          loading={false}
          onBookingClick={vi.fn()}
          onMakeProposal={vi.fn()}
          onEditBooking={vi.fn()}
        />
      );

      expect(screen.getAllByTestId('booking-card')).toHaveLength(20);

      performanceMonitor.mark('incremental-start');

      // Load more bookings incrementally
      for (let i = 20; i < 100; i += 20) {
        const currentBookings = allBookings.slice(0, i + 20);
        
        rerender(
          <BookingListings
            bookings={currentBookings}
            loading={false}
            onBookingClick={vi.fn()}
            onMakeProposal={vi.fn()}
            onEditBooking={vi.fn()}
          />
        );

        await waitFor(() => {
          expect(screen.getAllByTestId('booking-card')).toHaveLength(Math.min(i + 20, 100));
        });
      }

      performanceMonitor.mark('incremental-end');
      const incrementalTime = performanceMonitor.measure('incremental-start', 'incremental-end');

      // Incremental loading should be efficient
      expect(incrementalTime).toBeLessThan(2000);
    });
  });

  describe('Concurrent Updates Performance', () => {
    it('should handle multiple simultaneous updates efficiently', async () => {
      const user = userEvent.setup();
      const bookings = createLargeBookingDataset(50);
      const onMakeProposal = vi.fn();
      
      renderWithProviders(
        <BookingListings
          bookings={bookings}
          loading={false}
          onBookingClick={vi.fn()}
          onMakeProposal={onMakeProposal}
          onEditBooking={vi.fn()}
        />
      );

      performanceMonitor.mark('concurrent-start');

      // Simulate multiple users interacting simultaneously
      const proposalButtons = screen.getAllByText('Make Proposal');
      
      // Click multiple proposal buttons rapidly
      const clickPromises = proposalButtons.slice(0, 5).map(button => 
        user.click(button)
      );

      await Promise.all(clickPromises);

      performanceMonitor.mark('concurrent-end');
      const concurrentTime = performanceMonitor.measure('concurrent-start', 'concurrent-end');

      // Should handle concurrent interactions efficiently
      expect(concurrentTime).toBeLessThan(1000);
      expect(onMakeProposal).toHaveBeenCalledTimes(5);
    });
  });
});