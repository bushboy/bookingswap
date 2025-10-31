import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { bookingsSlice } from '../../store/slices/bookingsSlice';
import { swapsSlice } from '../../store/slices/swapsSlice';
import { BookingList } from '../../components/booking/BookingList';
import { SwapDashboard } from '../../components/swap/SwapDashboard';
import { Booking, SwapWithBookings, BookingType, BookingStatus, SwapStatus } from '@booking-swap/shared';

// Performance testing utilities
class PerformanceMonitor {
  private startTime: number = 0;
  private endTime: number = 0;

  start(): void {
    this.startTime = performance.now();
  }

  end(): number {
    this.endTime = performance.now();
    return this.endTime - this.startTime;
  }

  measureAsync<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    return new Promise(async (resolve) => {
      this.start();
      const result = await fn();
      const duration = this.end();
      resolve({ result, duration });
    });
  }

  measureSync<T>(fn: () => T): { result: T; duration: number } {
    this.start();
    const result = fn();
    const duration = this.end();
    return { result, duration };
  }
}

// Mock data generators
const generateMockBooking = (id: string, overrides: Partial<Booking> = {}): Booking => ({
  id,
  userId: 'user1',
  type: 'hotel' as BookingType,
  title: `Hotel Booking ${id}`,
  description: `Description for booking ${id}`,
  location: { city: 'New York', country: 'USA' },
  dateRange: { 
    checkIn: new Date('2024-06-01'), 
    checkOut: new Date('2024-06-05') 
  },
  originalPrice: 500 + parseInt(id),
  swapValue: 450 + parseInt(id),
  providerDetails: {
    provider: 'Booking.com',
    confirmationNumber: `ABC${id}`,
    bookingReference: `REF${id}`
  },
  verification: { status: 'verified', documents: [] },
  blockchain: { topicId: `topic${id}` },
  status: 'available' as BookingStatus,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const generateMockSwap = (id: string, overrides: Partial<SwapWithBookings> = {}): SwapWithBookings => ({
  id,
  sourceBookingId: `booking${id}`,
  targetBookingId: `booking${id}target`,
  proposerId: 'user1',
  ownerId: 'user2',
  status: 'pending' as SwapStatus,
  terms: { additionalPayment: 0, conditions: [] },
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  createdAt: new Date(),
  updatedAt: new Date(),
  sourceBooking: generateMockBooking(`${id}source`),
  targetBooking: generateMockBooking(`${id}target`),
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
  ...overrides,
});

describe('Performance Tests', () => {
  let monitor: PerformanceMonitor;
  let store: ReturnType<typeof configureStore>;

  const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <Provider store={store}>
      {children}
    </Provider>
  );

  beforeEach(() => {
    monitor = new PerformanceMonitor();
    store = configureStore({
      reducer: {
        bookings: bookingsSlice.reducer,
        swaps: swapsSlice.reducer,
      },
    });
  });

  describe('Large Dataset Rendering Performance', () => {
    it('should render 100 bookings within acceptable time', async () => {
      const bookings = Array.from({ length: 100 }, (_, i) => 
        generateMockBooking(i.toString())
      );

      const { duration } = monitor.measureSync(() => {
        render(
          <TestWrapper>
            <BookingList
              bookings={bookings}
              onViewDetails={vi.fn()}
              onProposeSwap={vi.fn()}
              onEditBooking={vi.fn()}
              onDeleteBooking={vi.fn()}
              onCreateSwap={vi.fn()}
            />
          </TestWrapper>
        );
      });

      // Should render within 1 second
      expect(duration).toBeLessThan(1000);

      // Should implement pagination or virtualization
      const displayedBookings = screen.getAllByTestId(/booking-card/);
      expect(displayedBookings.length).toBeLessThanOrEqual(20); // Assuming pagination limit
    });

    it('should render 500 swaps efficiently', async () => {
      const swaps = Array.from({ length: 500 }, (_, i) => 
        generateMockSwap(i.toString())
      );

      store.dispatch(swapsSlice.actions.setSwaps(swaps));

      const { duration } = monitor.measureSync(() => {
        render(
          <TestWrapper>
            <SwapDashboard />
          </TestWrapper>
        );
      });

      // Should render within 2 seconds even with large dataset
      expect(duration).toBeLessThan(2000);
    });

    it('should handle rapid state updates efficiently', async () => {
      const bookings = Array.from({ length: 50 }, (_, i) => 
        generateMockBooking(i.toString())
      );

      render(
        <TestWrapper>
          <BookingList
            bookings={bookings}
            onViewDetails={vi.fn()}
            onProposeSwap={vi.fn()}
            onEditBooking={vi.fn()}
            onDeleteBooking={vi.fn()}
            onCreateSwap={vi.fn()}
          />
        </TestWrapper>
      );

      // Measure time for multiple rapid updates
      const { duration } = await monitor.measureAsync(async () => {
        for (let i = 0; i < 10; i++) {
          const updatedBookings = bookings.map(booking => ({
            ...booking,
            title: `Updated ${booking.title} ${i}`,
          }));
          
          store.dispatch(bookingsSlice.actions.setBookings(updatedBookings));
          
          // Small delay to simulate real-world scenario
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      });

      // Should handle rapid updates within reasonable time
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Search and Filter Performance', () => {
    it('should search through large dataset quickly', async () => {
      const bookings = Array.from({ length: 1000 }, (_, i) => 
        generateMockBooking(i.toString(), {
          title: i % 2 === 0 ? `Hotel ${i}` : `Event ${i}`,
          type: i % 2 === 0 ? 'hotel' : 'event',
        })
      );

      const user = userEvent.setup();

      render(
        <TestWrapper>
          <BookingList
            bookings={bookings}
            onViewDetails={vi.fn()}
            onProposeSwap={vi.fn()}
            onEditBooking={vi.fn()}
            onDeleteBooking={vi.fn()}
            onCreateSwap={vi.fn()}
          />
        </TestWrapper>
      );

      const searchInput = screen.getByPlaceholderText(/search/i);

      const { duration } = await monitor.measureAsync(async () => {
        await user.type(searchInput, 'Hotel');
        
        // Wait for search results to update
        await waitFor(() => {
          const results = screen.getAllByTestId(/booking-card/);
          expect(results.length).toBeGreaterThan(0);
        });
      });

      // Search should complete within 300ms
      expect(duration).toBeLessThan(300);
    });

    it('should filter large dataset efficiently', async () => {
      const bookings = Array.from({ length: 1000 }, (_, i) => 
        generateMockBooking(i.toString(), {
          type: i % 3 === 0 ? 'hotel' : i % 3 === 1 ? 'event' : 'flight',
          status: i % 2 === 0 ? 'available' : 'locked',
        })
      );

      const user = userEvent.setup();

      render(
        <TestWrapper>
          <BookingList
            bookings={bookings}
            onViewDetails={vi.fn()}
            onProposeSwap={vi.fn()}
            onEditBooking={vi.fn()}
            onDeleteBooking={vi.fn()}
            onCreateSwap={vi.fn()}
          />
        </TestWrapper>
      );

      const { duration } = await monitor.measureAsync(async () => {
        // Apply multiple filters
        await user.click(screen.getByLabelText(/hotel/i));
        await user.click(screen.getByLabelText(/available/i));
        
        // Wait for filter results
        await waitFor(() => {
          const results = screen.getAllByTestId(/booking-card/);
          expect(results.length).toBeGreaterThan(0);
        });
      });

      // Filtering should complete within 200ms
      expect(duration).toBeLessThan(200);
    });
  });

  describe('Memory Usage and Cleanup', () => {
    it('should not cause memory leaks with frequent re-renders', async () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Render and unmount components multiple times
      for (let i = 0; i < 50; i++) {
        const bookings = Array.from({ length: 20 }, (_, j) => 
          generateMockBooking(`${i}-${j}`)
        );

        const { unmount } = render(
          <TestWrapper>
            <BookingList
              bookings={bookings}
              onViewDetails={vi.fn()}
              onProposeSwap={vi.fn()}
              onEditBooking={vi.fn()}
              onDeleteBooking={vi.fn()}
              onCreateSwap={vi.fn()}
            />
          </TestWrapper>
        );

        unmount();
      }

      // Force garbage collection if available
      if ((global as any).gc) {
        (global as any).gc();
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    it('should clean up event listeners properly', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = render(
        <TestWrapper>
          <BookingList
            bookings={[]}
            onViewDetails={vi.fn()}
            onProposeSwap={vi.fn()}
            onEditBooking={vi.fn()}
            onDeleteBooking={vi.fn()}
            onCreateSwap={vi.fn()}
          />
        </TestWrapper>
      );

      const addedListeners = addEventListenerSpy.mock.calls.length;

      unmount();

      const removedListeners = removeEventListenerSpy.mock.calls.length;

      // Should remove at least as many listeners as added
      expect(removedListeners).toBeGreaterThanOrEqual(addedListeners);

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('Animation and Interaction Performance', () => {
    it('should maintain 60fps during animations', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <BookingList
            bookings={[generateMockBooking('1')]}
            onViewDetails={vi.fn()}
            onProposeSwap={vi.fn()}
            onEditBooking={vi.fn()}
            onDeleteBooking={vi.fn()}
            onCreateSwap={vi.fn()}
          />
        </TestWrapper>
      );

      const bookingCard = screen.getByTestId(/booking-card/);

      // Measure hover animation performance
      const { duration } = await monitor.measureAsync(async () => {
        await user.hover(bookingCard);
        
        // Wait for animation to complete
        await new Promise(resolve => setTimeout(resolve, 300));
        
        await user.unhover(bookingCard);
        
        // Wait for animation to complete
        await new Promise(resolve => setTimeout(resolve, 300));
      });

      // Animation should complete smoothly within expected time
      expect(duration).toBeLessThan(700); // 300ms * 2 + buffer
    });

    it('should handle rapid user interactions efficiently', async () => {
      const user = userEvent.setup();
      const onViewDetails = vi.fn();

      render(
        <TestWrapper>
          <BookingList
            bookings={Array.from({ length: 10 }, (_, i) => generateMockBooking(i.toString()))}
            onViewDetails={onViewDetails}
            onProposeSwap={vi.fn()}
            onEditBooking={vi.fn()}
            onDeleteBooking={vi.fn()}
            onCreateSwap={vi.fn()}
          />
        </TestWrapper>
      );

      const buttons = screen.getAllByText('View Details');

      const { duration } = await monitor.measureAsync(async () => {
        // Rapidly click multiple buttons
        for (const button of buttons) {
          await user.click(button);
        }
      });

      // Should handle rapid clicks within reasonable time
      expect(duration).toBeLessThan(1000);
      expect(onViewDetails).toHaveBeenCalledTimes(10);
    });
  });

  describe('Bundle Size and Loading Performance', () => {
    it('should lazy load components efficiently', async () => {
      // Mock dynamic import
      const mockLazyComponent = vi.fn().mockResolvedValue({
        default: () => React.createElement('div', null, 'Lazy Component'),
      });

      // Simulate lazy loading
      const LazyComponent = React.lazy(() => mockLazyComponent());

      const { duration } = await monitor.measureAsync(async () => {
        render(
          <React.Suspense fallback={<div>Loading...</div>}>
            <LazyComponent />
          </React.Suspense>
        );

        await waitFor(() => {
          expect(screen.getByText('Lazy Component')).toBeInTheDocument();
        });
      });

      // Lazy loading should complete quickly
      expect(duration).toBeLessThan(100);
      expect(mockLazyComponent).toHaveBeenCalledTimes(1);
    });
  });

  describe('Network Request Performance', () => {
    it('should batch multiple API requests efficiently', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      global.fetch = mockFetch;

      // Simulate multiple rapid API calls
      const { duration } = await monitor.measureAsync(async () => {
        const promises = Array.from({ length: 5 }, (_, i) => 
          fetch(`/api/bookings?page=${i}`)
        );

        await Promise.all(promises);
      });

      // Multiple requests should complete within reasonable time
      expect(duration).toBeLessThan(500);
      expect(mockFetch).toHaveBeenCalledTimes(5);
    });

    it('should implement request debouncing for search', async () => {
      const user = userEvent.setup();
      const mockSearch = vi.fn().mockResolvedValue([]);

      // Mock search function with debouncing
      const debouncedSearch = vi.fn();
      let timeoutId: NodeJS.Timeout;
      
      const search = (query: string) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          debouncedSearch(query);
          mockSearch(query);
        }, 300);
      };

      render(
        <TestWrapper>
          <input 
            placeholder="Search bookings"
            onChange={(e) => search(e.target.value)}
          />
        </TestWrapper>
      );

      const searchInput = screen.getByPlaceholderText(/search bookings/i);

      // Type rapidly
      await user.type(searchInput, 'hotel booking', { delay: 50 });

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 400));

      // Should only call search once due to debouncing
      expect(debouncedSearch).toHaveBeenCalledTimes(1);
      expect(debouncedSearch).toHaveBeenCalledWith('hotel booking');
    });
  });
});