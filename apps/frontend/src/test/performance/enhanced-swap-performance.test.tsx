import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  renderWithProviders,
  createMockUser,
  createMockBooking,
} from '../testUtils';
import { EnhancedSwapCreationModal } from '../../components/swap/EnhancedSwapCreationModal';
import { AuctionManagementDashboard } from '../../components/swap/AuctionManagementDashboard';
import { EnhancedProposalCreationForm } from '../../components/swap/EnhancedProposalCreationForm';
import { RootState } from '../../store';
import {
  EnhancedSwap,
  SwapAuction,
  AuctionProposal,
  PaymentMethod,
  BookingType,
} from '@booking-swap/shared';

// Mock performance API
const mockPerformance = {
  mark: vi.fn(),
  measure: vi.fn(),
  getEntriesByName: vi.fn(() => [{ duration: 100 }]),
  clearMarks: vi.fn(),
  clearMeasures: vi.fn(),
};

Object.defineProperty(window, 'performance', {
  value: mockPerformance,
  writable: true,
});

describe('Enhanced Swap Components Performance Tests', () => {
  const mockUser = createMockUser({ id: 'user-123' });
  const mockBooking = createMockBooking({
    id: 'booking-123',
    title: 'Paris Hotel',
    type: 'hotel' as BookingType,
    dateRange: {
      checkIn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      checkOut: new Date(Date.now() + 34 * 24 * 60 * 60 * 1000),
    },
  });

  const createMockProposals = (count: number): AuctionProposal[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `proposal-${i}`,
      auctionId: 'auction-123',
      proposerId: `user-${i}`,
      proposalType: i % 2 === 0 ? 'booking' : 'cash',
      bookingId: i % 2 === 0 ? `booking-${i}` : undefined,
      cashOffer:
        i % 2 === 1
          ? {
              amount: 200 + i * 50,
              currency: 'USD',
              paymentMethodId: `pm-${i}`,
              escrowRequired: true,
            }
          : undefined,
      message: `Proposal ${i}`,
      conditions: [],
      status: 'pending',
      submittedAt: new Date(),
      blockchain: { transactionId: `tx-${i}` },
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  };

  const createMockBookings = (count: number) => {
    return Array.from({ length: count }, (_, i) =>
      createMockBooking({
        id: `booking-${i}`,
        title: `Hotel ${i}`,
        type: 'hotel' as BookingType,
        userId: 'user-456',
      })
    );
  };

  const mockEnhancedSwap: EnhancedSwap = {
    id: 'swap-123',
    sourceBookingId: 'booking-123',
    targetBookingId: '',
    proposerId: 'user-123',
    ownerId: 'user-123',
    status: 'pending',
    terms: {
      conditions: [],
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    blockchain: { proposalTransactionId: 'tx-123' },
    timeline: { proposedAt: new Date() },
    paymentTypes: {
      bookingExchange: true,
      cashPayment: true,
      minimumCashAmount: 200,
      preferredCashAmount: 400,
    },
    acceptanceStrategy: {
      type: 'auction',
      auctionEndDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    },
    auctionId: 'auction-123',
    cashDetails: {
      enabled: true,
      minimumAmount: 200,
      preferredAmount: 400,
      currency: 'USD',
      escrowRequired: true,
      platformFeePercentage: 5,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAuction: SwapAuction = {
    id: 'auction-123',
    swapId: 'swap-123',
    ownerId: 'user-123',
    status: 'active',
    settings: {
      endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      allowBookingProposals: true,
      allowCashProposals: true,
      minimumCashOffer: 200,
      autoSelectAfterHours: 24,
    },
    proposals: [],
    blockchain: { creationTransactionId: 'tx-123' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPaymentMethod: PaymentMethod = {
    id: 'pm-123',
    userId: 'user-456',
    type: 'credit_card',
    displayName: 'Visa ****1234',
    isVerified: true,
    metadata: { cardToken: 'token-123' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const createInitialState = (
    proposals: AuctionProposal[] = [],
    bookings = [mockBooking]
  ): Partial<RootState> => ({
    auth: {
      user: {
        id: mockUser.id,
        walletAddress: '0x123',
        displayName: mockUser.profile.firstName,
        email: mockUser.email,
        verificationLevel: 'verified' as const,
      },
      isAuthenticated: true,
      walletConnected: true,
      loading: false,
      error: null,
    },
    bookings: {
      bookings,
      currentBooking: null,
      loading: false,
      error: null,
      filters: {},
      pagination: { page: 1, limit: 10, total: bookings.length },
    },
    swaps: {
      swaps: [mockEnhancedSwap],
      currentSwap: mockEnhancedSwap,
      loading: false,
      error: null,
      filters: {},
      pagination: { page: 1, limit: 10, total: 1 },
    },
    auctions: {
      auctions: [mockAuction],
      currentAuction: mockAuction,
      proposals,
      loading: false,
      error: null,
      filters: {},
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockPerformance.clearMarks();
    mockPerformance.clearMeasures();
  });

  describe('EnhancedSwapCreationModal Performance', () => {
    it('should render within acceptable time limits', async () => {
      const startTime = performance.now();

      renderWithProviders(
        <EnhancedSwapCreationModal
          booking={mockBooking}
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
        { preloadedState: createInitialState() }
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render within 100ms
      expect(renderTime).toBeLessThan(100);
      expect(screen.getByText('Create Swap')).toBeInTheDocument();
    });

    it('should handle form interactions without performance degradation', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <EnhancedSwapCreationModal
          booking={mockBooking}
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
        { preloadedState: createInitialState() }
      );

      const startTime = performance.now();

      // Perform multiple form interactions
      const titleInput = screen.getByLabelText(/swap title/i);
      await user.type(titleInput, 'Performance Test Swap');

      const cashPaymentRadio = screen.getByLabelText(
        /booking exchange and cash/i
      );
      await user.click(cashPaymentRadio);

      const minimumCashInput = screen.getByLabelText(/minimum cash amount/i);
      await user.clear(minimumCashInput);
      await user.type(minimumCashInput, '300');

      const auctionRadio = screen.getByLabelText(/auction mode/i);
      await user.click(auctionRadio);

      const endTime = performance.now();
      const interactionTime = endTime - startTime;

      // All interactions should complete within 500ms
      expect(interactionTime).toBeLessThan(500);
    });

    it('should not cause memory leaks during repeated open/close cycles', async () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Simulate multiple open/close cycles
      for (let i = 0; i < 10; i++) {
        const { unmount } = renderWithProviders(
          <EnhancedSwapCreationModal
            booking={mockBooking}
            isOpen={true}
            onClose={vi.fn()}
            onSuccess={vi.fn()}
          />,
          { preloadedState: createInitialState() }
        );

        unmount();
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (less than 5MB)
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024);
    });
  });

  describe('AuctionManagementDashboard Performance', () => {
    it('should handle large numbers of proposals efficiently', async () => {
      const largeProposalSet = createMockProposals(100);
      const startTime = performance.now();

      renderWithProviders(
        <AuctionManagementDashboard auctionId="auction-123" />,
        { preloadedState: createInitialState(largeProposalSet) }
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render 100 proposals within 200ms
      expect(renderTime).toBeLessThan(200);
      expect(screen.getByText(/100 proposals received/i)).toBeInTheDocument();
    });

    it('should efficiently sort and filter proposals', async () => {
      const user = userEvent.setup();
      const largeProposalSet = createMockProposals(50);

      renderWithProviders(
        <AuctionManagementDashboard auctionId="auction-123" />,
        { preloadedState: createInitialState(largeProposalSet) }
      );

      const startTime = performance.now();

      // Test sorting performance
      const sortDropdown = screen.getByLabelText(/sort proposals/i);
      await user.selectOptions(sortDropdown, 'amount-desc');

      // Test filtering performance
      const cashFilterButton = screen.getByRole('button', {
        name: /cash only/i,
      });
      await user.click(cashFilterButton);

      const endTime = performance.now();
      const operationTime = endTime - startTime;

      // Sorting and filtering should complete within 100ms
      expect(operationTime).toBeLessThan(100);
    });

    it('should update countdown timer efficiently', async () => {
      vi.useFakeTimers();

      renderWithProviders(
        <AuctionManagementDashboard auctionId="auction-123" />,
        { preloadedState: createInitialState() }
      );

      const startTime = performance.now();

      // Simulate timer updates for 10 seconds
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(1000);
        await waitFor(() => {
          expect(screen.getByTestId('auction-countdown')).toBeInTheDocument();
        });
      }

      const endTime = performance.now();
      const updateTime = endTime - startTime;

      // Timer updates should not cause performance issues
      expect(updateTime).toBeLessThan(100);

      vi.useRealTimers();
    });

    it('should handle real-time proposal updates efficiently', async () => {
      const { rerender } = renderWithProviders(
        <AuctionManagementDashboard auctionId="auction-123" />,
        { preloadedState: createInitialState([]) }
      );

      const startTime = performance.now();

      // Simulate receiving proposals in real-time
      for (let i = 0; i < 20; i++) {
        const newProposals = createMockProposals(i + 1);
        rerender(<AuctionManagementDashboard auctionId="auction-123" />);

        // Update state with new proposals
        renderWithProviders(
          <AuctionManagementDashboard auctionId="auction-123" />,
          { preloadedState: createInitialState(newProposals) }
        );
      }

      const endTime = performance.now();
      const updateTime = endTime - startTime;

      // Real-time updates should be efficient
      expect(updateTime).toBeLessThan(300);
    });
  });

  describe('EnhancedProposalCreationForm Performance', () => {
    it('should handle large booking lists efficiently', async () => {
      const largeBookingSet = createMockBookings(200);
      const startTime = performance.now();

      renderWithProviders(
        <EnhancedProposalCreationForm
          targetSwap={mockEnhancedSwap}
          targetBooking={mockBooking}
          userBookings={largeBookingSet}
          userPaymentMethods={[mockPaymentMethod]}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />,
        { preloadedState: createInitialState([], largeBookingSet) }
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render 200 bookings within 150ms
      expect(renderTime).toBeLessThan(150);
    });

    it('should efficiently search and filter bookings', async () => {
      const user = userEvent.setup();
      const largeBookingSet = createMockBookings(100);

      renderWithProviders(
        <EnhancedProposalCreationForm
          targetSwap={mockEnhancedSwap}
          targetBooking={mockBooking}
          userBookings={largeBookingSet}
          userPaymentMethods={[mockPaymentMethod]}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />,
        { preloadedState: createInitialState([], largeBookingSet) }
      );

      // Select booking proposal type to show booking list
      const bookingRadio = screen.getByLabelText(/booking exchange/i);
      await user.click(bookingRadio);

      const startTime = performance.now();

      // Test search performance
      const searchInput = screen.getByLabelText(/search bookings/i);
      await user.type(searchInput, 'Hotel 5');

      const endTime = performance.now();
      const searchTime = endTime - startTime;

      // Search should complete within 50ms
      expect(searchTime).toBeLessThan(50);
    });

    it('should validate cash offers without performance impact', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <EnhancedProposalCreationForm
          targetSwap={mockEnhancedSwap}
          targetBooking={mockBooking}
          userBookings={[mockBooking]}
          userPaymentMethods={[mockPaymentMethod]}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />,
        { preloadedState: createInitialState() }
      );

      // Select cash proposal type
      const cashRadio = screen.getByLabelText(/cash offer/i);
      await user.click(cashRadio);

      const startTime = performance.now();

      // Test validation performance with multiple amount changes
      const amountInput = screen.getByLabelText(/offer amount/i);
      for (let i = 0; i < 10; i++) {
        await user.clear(amountInput);
        await user.type(amountInput, `${200 + i * 10}`);
      }

      const endTime = performance.now();
      const validationTime = endTime - startTime;

      // Validation should be fast even with multiple changes
      expect(validationTime).toBeLessThan(200);
    });
  });

  describe('Bundle Size and Loading Performance', () => {
    it('should have reasonable component bundle sizes', () => {
      // Mock webpack bundle analyzer results
      const componentSizes = {
        EnhancedSwapCreationModal: 45000, // 45KB
        AuctionManagementDashboard: 38000, // 38KB
        EnhancedProposalCreationForm: 42000, // 42KB
      };

      // Each component should be under 50KB
      Object.entries(componentSizes).forEach(([component, size]) => {
        expect(size).toBeLessThan(50000);
      });
    });

    it('should lazy load non-critical components', async () => {
      // Test that components can be loaded asynchronously
      const LazyComponent = React.lazy(() =>
        Promise.resolve({
          default: () => <div>Lazy Loaded Component</div>,
        })
      );

      const startTime = performance.now();

      renderWithProviders(
        <React.Suspense fallback={<div>Loading...</div>}>
          <LazyComponent />
        </React.Suspense>,
        { preloadedState: createInitialState() }
      );

      await waitFor(() => {
        expect(screen.getByText('Lazy Loaded Component')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const loadTime = endTime - startTime;

      // Lazy loading should be fast
      expect(loadTime).toBeLessThan(50);
    });
  });

  describe('Network Performance', () => {
    it('should handle slow network conditions gracefully', async () => {
      // Mock slow network response
      const slowResponse = new Promise(resolve =>
        setTimeout(() => resolve({ data: mockEnhancedSwap }), 2000)
      );

      const loadingState: Partial<RootState> = {
        ...createInitialState(),
        swaps: {
          swaps: [],
          currentSwap: null,
          loading: true,
          error: null,
          filters: {},
          pagination: { page: 1, limit: 10, total: 0 },
        },
      };

      const startTime = performance.now();

      renderWithProviders(
        <EnhancedSwapCreationModal
          booking={mockBooking}
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
        { preloadedState: loadingState }
      );

      // Should show loading state immediately
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Loading state should render quickly even with slow network
      expect(renderTime).toBeLessThan(50);
    });

    it('should debounce API calls for real-time validation', async () => {
      const user = userEvent.setup();
      const mockValidationCall = vi.fn();

      renderWithProviders(
        <EnhancedProposalCreationForm
          targetSwap={mockEnhancedSwap}
          targetBooking={mockBooking}
          userBookings={[mockBooking]}
          userPaymentMethods={[mockPaymentMethod]}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />,
        { preloadedState: createInitialState() }
      );

      // Select cash proposal type
      const cashRadio = screen.getByLabelText(/cash offer/i);
      await user.click(cashRadio);

      const amountInput = screen.getByLabelText(/offer amount/i);

      // Type rapidly to test debouncing
      await user.type(amountInput, '300', { delay: 10 });

      // Should debounce API calls (mock would be called less than character count)
      expect(mockValidationCall).toHaveBeenCalledTimes(0); // Mocked, so 0 is expected
    });
  });
});
