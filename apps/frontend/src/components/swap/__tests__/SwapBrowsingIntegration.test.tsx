import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { SwapBrowser } from '../SwapBrowser';
import { swapFilterService } from '@/services/SwapFilterService';
import { SwapWithBookings } from '@/services/bookingService';

/**
 * Integration tests for end-to-end browsing with filtering applied
 * Tests the complete user journey from loading swaps to applying filters
 * and viewing filtered results as required by task 10.5
 */

// Mock the SwapFilterService with real implementation
jest.mock('@/services/SwapFilterService', () => {
  const actualService = jest.requireActual('@/services/SwapFilterService');
  return {
    swapFilterService: actualService.swapFilterService,
    SwapFilterService: actualService.SwapFilterService
  };
});

// Mock other dependencies
jest.mock('@/hooks/useDebounce', () => ({
  useDebounce: (value: any) => value,
}));

jest.mock('../SwapCard', () => ({
  SwapCard: ({ swap, onAction }: any) => (
    <div data-testid={`swap-card-${swap.id}`} data-swap-type={swap.swapType}>
      <h3>{swap.sourceBooking?.title}</h3>
      <p data-testid="location">{swap.sourceBooking?.location?.city}, {swap.sourceBooking?.location?.country}</p>
      <p data-testid="price">${swap.swapType === 'cash' ? swap.cashDetails?.preferredAmount || 'N/A' : swap.sourceBooking?.swapValue}</p>
      <p data-testid="dates">{swap.sourceBooking?.dateRange?.checkIn} to {swap.sourceBooking?.dateRange?.checkOut}</p>
      <button onClick={() => onAction?.('propose', swap)}>Propose Swap</button>
    </div>
  ),
}));

jest.mock('@/components/booking/FilterPanel', () => ({
  FilterPanel: ({ filters, onChange, onReset }: any) => (
    <div data-testid="filter-panel">
      <input
        data-testid="city-filter"
        placeholder="City"
        value={filters.location?.city || ''}
        onChange={(e) => onChange({ 
          ...filters, 
          location: { ...filters.location, city: e.target.value } 
        })}
      />
      <input
        data-testid="country-filter"
        placeholder="Country"
        value={filters.location?.country || ''}
        onChange={(e) => onChange({ 
          ...filters, 
          location: { ...filters.location, country: e.target.value } 
        })}
      />
      <input
        data-testid="min-price-filter"
        type="number"
        placeholder="Min Price"
        value={filters.priceRange?.min || ''}
        onChange={(e) => onChange({ 
          ...filters, 
          priceRange: { ...filters.priceRange, min: parseInt(e.target.value) || undefined } 
        })}
      />
      <input
        data-testid="max-price-filter"
        type="number"
        placeholder="Max Price"
        value={filters.priceRange?.max || ''}
        onChange={(e) => onChange({ 
          ...filters, 
          priceRange: { ...filters.priceRange, max: parseInt(e.target.value) || undefined } 
        })}
      />
      <select
        data-testid="swap-type-filter"
        value={filters.swapType || 'both'}
        onChange={(e) => onChange({ 
          ...filters, 
          swapType: e.target.value as 'booking' | 'cash' | 'both'
        })}
      >
        <option value="both">All Types</option>
        <option value="booking">Booking Swaps</option>
        <option value="cash">Cash Swaps</option>
      </select>
      <input
        data-testid="date-start-filter"
        type="date"
        value={filters.dateRange?.start?.toISOString().split('T')[0] || ''}
        onChange={(e) => onChange({ 
          ...filters, 
          dateRange: { 
            ...filters.dateRange, 
            start: e.target.value ? new Date(e.target.value) : undefined 
          } 
        })}
      />
      <input
        data-testid="date-end-filter"
        type="date"
        value={filters.dateRange?.end?.toISOString().split('T')[0] || ''}
        onChange={(e) => onChange({ 
          ...filters, 
          dateRange: { 
            ...filters.dateRange, 
            end: e.target.value ? new Date(e.target.value) : undefined 
          } 
        })}
      />
      <button data-testid="reset-filters" onClick={onReset}>Reset Filters</button>
    </div>
  ),
}));

// Mock UI components
jest.mock('@/components/ui', () => ({
  Button: ({ children, onClick, variant, ...props }: any) => (
    <button onClick={onClick} data-variant={variant} {...props}>
      {children}
    </button>
  ),
  Input: ({ value, onChange, placeholder, ...props }: any) => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      {...props}
    />
  ),
}));

// Create comprehensive test data
const createTestSwaps = (): SwapWithBookings[] => [
  // User's own swap - should be filtered out
  {
    id: 'own-swap',
    sourceBooking: {
      id: 'own-booking',
      title: 'My Own Hotel',
      userId: 'current-user',
      status: 'available',
      type: 'hotel',
      location: { city: 'Paris', country: 'France' },
      dateRange: { checkIn: '2024-06-01T00:00:00Z', checkOut: '2024-06-05T00:00:00Z' },
      swapValue: 800,
      originalPrice: 1000,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      verification: { status: 'verified', verifiedAt: new Date() },
      providerDetails: { provider: 'Test', confirmationNumber: 'CONF1', bookingReference: 'REF1' }
    },
    owner: { id: 'current-user', name: 'Current User', walletAddress: '0x123' },
    proposer: { id: 'other-user', name: 'Other User', walletAddress: '0x456' },
    swapType: 'booking',
    hasActiveProposals: true,
    activeProposalCount: 1,
    status: 'pending',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  // Cancelled booking - should be filtered out
  {
    id: 'cancelled-swap',
    sourceBooking: {
      id: 'cancelled-booking',
      title: 'Cancelled Hotel',
      userId: 'user-2',
      status: 'cancelled',
      type: 'hotel',
      location: { city: 'London', country: 'UK' },
      dateRange: { checkIn: '2024-06-01T00:00:00Z', checkOut: '2024-06-05T00:00:00Z' },
      swapValue: 600,
      originalPrice: 800,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      verification: { status: 'verified', verifiedAt: new Date() },
      providerDetails: { provider: 'Test', confirmationNumber: 'CONF2', bookingReference: 'REF2' }
    },
    owner: { id: 'user-2', name: 'User 2', walletAddress: '0x789' },
    proposer: { id: 'current-user', name: 'Current User', walletAddress: '0x123' },
    swapType: 'booking',
    hasActiveProposals: true,
    activeProposalCount: 1,
    status: 'pending',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  // No active proposals - should be filtered out
  {
    id: 'no-proposals-swap',
    sourceBooking: {
      id: 'no-proposals-booking',
      title: 'Hotel Without Proposals',
      userId: 'user-3',
      status: 'available',
      type: 'hotel',
      location: { city: 'Rome', country: 'Italy' },
      dateRange: { checkIn: '2024-06-01T00:00:00Z', checkOut: '2024-06-05T00:00:00Z' },
      swapValue: 700,
      originalPrice: 900,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      verification: { status: 'verified', verifiedAt: new Date() },
      providerDetails: { provider: 'Test', confirmationNumber: 'CONF3', bookingReference: 'REF3' }
    },
    owner: { id: 'user-3', name: 'User 3', walletAddress: '0xabc' },
    proposer: { id: 'current-user', name: 'Current User', walletAddress: '0x123' },
    swapType: 'booking',
    hasActiveProposals: false,
    activeProposalCount: 0,
    status: 'pending',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  // Valid booking swap - Paris
  {
    id: 'valid-booking-paris',
    sourceBooking: {
      id: 'valid-booking-paris-id',
      title: 'Luxury Hotel Paris',
      userId: 'user-4',
      status: 'available',
      type: 'hotel',
      location: { city: 'Paris', country: 'France' },
      dateRange: { checkIn: '2024-06-01T00:00:00Z', checkOut: '2024-06-05T00:00:00Z' },
      swapValue: 1200,
      originalPrice: 1500,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      verification: { status: 'verified', verifiedAt: new Date() },
      providerDetails: { provider: 'Test', confirmationNumber: 'CONF4', bookingReference: 'REF4' }
    },
    owner: { id: 'user-4', name: 'User 4', walletAddress: '0xdef' },
    proposer: { id: 'current-user', name: 'Current User', walletAddress: '0x123' },
    swapType: 'booking',
    hasActiveProposals: true,
    activeProposalCount: 2,
    status: 'pending',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  // Valid booking swap - London
  {
    id: 'valid-booking-london',
    sourceBooking: {
      id: 'valid-booking-london-id',
      title: 'Business Hotel London',
      userId: 'user-5',
      status: 'available',
      type: 'hotel',
      location: { city: 'London', country: 'UK' },
      dateRange: { checkIn: '2024-07-01T00:00:00Z', checkOut: '2024-07-05T00:00:00Z' },
      swapValue: 800,
      originalPrice: 1000,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      verification: { status: 'verified', verifiedAt: new Date() },
      providerDetails: { provider: 'Test', confirmationNumber: 'CONF5', bookingReference: 'REF5' }
    },
    owner: { id: 'user-5', name: 'User 5', walletAddress: '0xghi' },
    proposer: { id: 'current-user', name: 'Current User', walletAddress: '0x123' },
    swapType: 'booking',
    hasActiveProposals: true,
    activeProposalCount: 1,
    status: 'pending',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  // Valid cash swap - Paris
  {
    id: 'valid-cash-paris',
    sourceBooking: {
      id: 'valid-cash-paris-id',
      title: 'Concert Tickets Paris',
      userId: 'user-6',
      status: 'available',
      type: 'event',
      location: { city: 'Paris', country: 'France' },
      dateRange: { checkIn: '2024-06-15T00:00:00Z', checkOut: '2024-06-15T00:00:00Z' },
      swapValue: 400,
      originalPrice: 500,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      verification: { status: 'verified', verifiedAt: new Date() },
      providerDetails: { provider: 'Test', confirmationNumber: 'CONF6', bookingReference: 'REF6' }
    },
    owner: { id: 'user-6', name: 'User 6', walletAddress: '0xjkl' },
    proposer: { id: 'current-user', name: 'Current User', walletAddress: '0x123' },
    swapType: 'cash',
    cashDetails: {
      minAmount: 300,
      maxAmount: 500,
      preferredAmount: 400,
      currency: 'USD',
      paymentMethods: ['Credit Card'],
      escrowRequired: true,
      platformFeePercentage: 3
    },
    hasActiveProposals: true,
    activeProposalCount: 3,
    status: 'pending',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  // Valid cash swap - Tokyo (high price)
  {
    id: 'valid-cash-tokyo',
    sourceBooking: {
      id: 'valid-cash-tokyo-id',
      title: 'Flight to Tokyo',
      userId: 'user-7',
      status: 'available',
      type: 'flight',
      location: { city: 'Tokyo', country: 'Japan' },
      dateRange: { checkIn: '2024-08-01T00:00:00Z', checkOut: '2024-08-01T00:00:00Z' },
      swapValue: 1800,
      originalPrice: 2000,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      verification: { status: 'verified', verifiedAt: new Date() },
      providerDetails: { provider: 'Test', confirmationNumber: 'CONF7', bookingReference: 'REF7' }
    },
    owner: { id: 'user-7', name: 'User 7', walletAddress: '0xmno' },
    proposer: { id: 'current-user', name: 'Current User', walletAddress: '0x123' },
    swapType: 'cash',
    cashDetails: {
      minAmount: 1500,
      maxAmount: 2000,
      preferredAmount: 1800,
      currency: 'USD',
      paymentMethods: ['Bank Transfer'],
      escrowRequired: true,
      platformFeePercentage: 3
    },
    hasActiveProposals: true,
    activeProposalCount: 1,
    status: 'pending',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  }
];

// Mock Redux store
const createMockStore = () => configureStore({
  reducer: {
    swaps: (state = { items: [], loading: false, error: null }, action) => state,
    bookings: (state = { items: [], loading: false, error: null }, action) => state,
    ui: (state = { modals: {} }, action) => state
  }
});

const defaultProps = {
  swaps: createTestSwaps(),
  userBookings: [],
  loading: false,
  error: null,
  onSwapSelect: jest.fn(),
  onSwapProposal: jest.fn(),
  onLoadMore: jest.fn(),
  hasMore: false,
  totalCount: 0,
  currentUserId: 'current-user'
};

const renderWithStore = (component: React.ReactElement) => {
  const store = createMockStore();
  return render(
    <Provider store={store}>
      {component}
    </Provider>
  );
};

describe('Swap Browsing Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Core Filtering Integration', () => {
    it('should apply core browsing filters and display only valid swaps', async () => {
      renderWithStore(<SwapBrowser {...defaultProps} />);

      // Should only show valid swaps (4 total: 2 booking + 2 cash)
      // Excluded: own-swap (user's own), cancelled-swap (cancelled), no-proposals-swap (no proposals)
      await waitFor(() => {
        expect(screen.getByTestId('swap-card-valid-booking-paris')).toBeInTheDocument();
        expect(screen.getByTestId('swap-card-valid-booking-london')).toBeInTheDocument();
        expect(screen.getByTestId('swap-card-valid-cash-paris')).toBeInTheDocument();
        expect(screen.getByTestId('swap-card-valid-cash-tokyo')).toBeInTheDocument();
      });

      // Should not show filtered out swaps
      expect(screen.queryByTestId('swap-card-own-swap')).not.toBeInTheDocument();
      expect(screen.queryByTestId('swap-card-cancelled-swap')).not.toBeInTheDocument();
      expect(screen.queryByTestId('swap-card-no-proposals-swap')).not.toBeInTheDocument();

      // Should show correct count
      expect(screen.getByText('4 swaps available for proposals')).toBeInTheDocument();
    });

    it('should display filter summary with core restrictions', async () => {
      renderWithStore(<SwapBrowser {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Active Filters:/)).toBeInTheDocument();
        expect(screen.getByText(/excluding your own bookings/)).toBeInTheDocument();
        expect(screen.getByText(/excluding cancelled bookings/)).toBeInTheDocument();
        expect(screen.getByText(/only showing bookings with active swap proposals/)).toBeInTheDocument();
      });
    });
  });

  describe('Location Filtering Integration', () => {
    it('should filter swaps by city', async () => {
      const user = userEvent.setup();
      renderWithStore(<SwapBrowser {...defaultProps} />);

      // Open filters
      const showFiltersButton = screen.getByText('Show Filters');
      await user.click(showFiltersButton);

      // Apply city filter
      const cityFilter = screen.getByTestId('city-filter');
      await user.type(cityFilter, 'Paris');

      await waitFor(() => {
        // Should only show Paris swaps
        expect(screen.getByTestId('swap-card-valid-booking-paris')).toBeInTheDocument();
        expect(screen.getByTestId('swap-card-valid-cash-paris')).toBeInTheDocument();
        
        // Should not show non-Paris swaps
        expect(screen.queryByTestId('swap-card-valid-booking-london')).not.toBeInTheDocument();
        expect(screen.queryByTestId('swap-card-valid-cash-tokyo')).not.toBeInTheDocument();
      });

      // Should show updated count
      expect(screen.getByText('2 swaps available for proposals')).toBeInTheDocument();
    });

    it('should filter swaps by country', async () => {
      const user = userEvent.setup();
      renderWithStore(<SwapBrowser {...defaultProps} />);

      // Open filters
      const showFiltersButton = screen.getByText('Show Filters');
      await user.click(showFiltersButton);

      // Apply country filter
      const countryFilter = screen.getByTestId('country-filter');
      await user.type(countryFilter, 'France');

      await waitFor(() => {
        // Should only show France swaps
        expect(screen.getByTestId('swap-card-valid-booking-paris')).toBeInTheDocument();
        expect(screen.getByTestId('swap-card-valid-cash-paris')).toBeInTheDocument();
        
        // Should not show non-France swaps
        expect(screen.queryByTestId('swap-card-valid-booking-london')).not.toBeInTheDocument();
        expect(screen.queryByTestId('swap-card-valid-cash-tokyo')).not.toBeInTheDocument();
      });
    });

    it('should combine city and country filters', async () => {
      const user = userEvent.setup();
      renderWithStore(<SwapBrowser {...defaultProps} />);

      // Open filters
      const showFiltersButton = screen.getByText('Show Filters');
      await user.click(showFiltersButton);

      // Apply both city and country filters
      const cityFilter = screen.getByTestId('city-filter');
      const countryFilter = screen.getByTestId('country-filter');
      
      await user.type(cityFilter, 'Paris');
      await user.type(countryFilter, 'France');

      await waitFor(() => {
        // Should only show Paris, France swaps
        expect(screen.getByTestId('swap-card-valid-booking-paris')).toBeInTheDocument();
        expect(screen.getByTestId('swap-card-valid-cash-paris')).toBeInTheDocument();
        
        // Should not show other swaps
        expect(screen.queryByTestId('swap-card-valid-booking-london')).not.toBeInTheDocument();
        expect(screen.queryByTestId('swap-card-valid-cash-tokyo')).not.toBeInTheDocument();
      });
    });
  });

  describe('Price Range Filtering Integration', () => {
    it('should filter swaps by minimum price', async () => {
      const user = userEvent.setup();
      renderWithStore(<SwapBrowser {...defaultProps} />);

      // Open filters
      const showFiltersButton = screen.getByText('Show Filters');
      await user.click(showFiltersButton);

      // Apply minimum price filter
      const minPriceFilter = screen.getByTestId('min-price-filter');
      await user.type(minPriceFilter, '1000');

      await waitFor(() => {
        // Should only show high-price swaps
        expect(screen.getByTestId('swap-card-valid-booking-paris')).toBeInTheDocument(); // 1200
        expect(screen.getByTestId('swap-card-valid-cash-tokyo')).toBeInTheDocument(); // 1800
        
        // Should not show low-price swaps
        expect(screen.queryByTestId('swap-card-valid-booking-london')).not.toBeInTheDocument(); // 800
        expect(screen.queryByTestId('swap-card-valid-cash-paris')).not.toBeInTheDocument(); // 400
      });
    });

    it('should filter swaps by maximum price', async () => {
      const user = userEvent.setup();
      renderWithStore(<SwapBrowser {...defaultProps} />);

      // Open filters
      const showFiltersButton = screen.getByText('Show Filters');
      await user.click(showFiltersButton);

      // Apply maximum price filter
      const maxPriceFilter = screen.getByTestId('max-price-filter');
      await user.type(maxPriceFilter, '1000');

      await waitFor(() => {
        // Should only show low-price swaps
        expect(screen.getByTestId('swap-card-valid-booking-london')).toBeInTheDocument(); // 800
        expect(screen.getByTestId('swap-card-valid-cash-paris')).toBeInTheDocument(); // 400
        
        // Should not show high-price swaps
        expect(screen.queryByTestId('swap-card-valid-booking-paris')).not.toBeInTheDocument(); // 1200
        expect(screen.queryByTestId('swap-card-valid-cash-tokyo')).not.toBeInTheDocument(); // 1800
      });
    });

    it('should filter swaps by price range', async () => {
      const user = userEvent.setup();
      renderWithStore(<SwapBrowser {...defaultProps} />);

      // Open filters
      const showFiltersButton = screen.getByText('Show Filters');
      await user.click(showFiltersButton);

      // Apply price range filter
      const minPriceFilter = screen.getByTestId('min-price-filter');
      const maxPriceFilter = screen.getByTestId('max-price-filter');
      
      await user.type(minPriceFilter, '500');
      await user.type(maxPriceFilter, '1500');

      await waitFor(() => {
        // Should show swaps in range
        expect(screen.getByTestId('swap-card-valid-booking-london')).toBeInTheDocument(); // 800
        expect(screen.getByTestId('swap-card-valid-booking-paris')).toBeInTheDocument(); // 1200
        
        // Should not show swaps outside range
        expect(screen.queryByTestId('swap-card-valid-cash-paris')).not.toBeInTheDocument(); // 400
        expect(screen.queryByTestId('swap-card-valid-cash-tokyo')).not.toBeInTheDocument(); // 1800
      });
    });
  });

  describe('Swap Type Filtering Integration', () => {
    it('should filter to booking swaps only', async () => {
      const user = userEvent.setup();
      renderWithStore(<SwapBrowser {...defaultProps} />);

      // Open filters
      const showFiltersButton = screen.getByText('Show Filters');
      await user.click(showFiltersButton);

      // Apply swap type filter
      const swapTypeFilter = screen.getByTestId('swap-type-filter');
      await user.selectOptions(swapTypeFilter, 'booking');

      await waitFor(() => {
        // Should only show booking swaps
        expect(screen.getByTestId('swap-card-valid-booking-paris')).toBeInTheDocument();
        expect(screen.getByTestId('swap-card-valid-booking-london')).toBeInTheDocument();
        
        // Should not show cash swaps
        expect(screen.queryByTestId('swap-card-valid-cash-paris')).not.toBeInTheDocument();
        expect(screen.queryByTestId('swap-card-valid-cash-tokyo')).not.toBeInTheDocument();
      });

      // Verify swap type in displayed cards
      const bookingCards = screen.getAllByTestId(/swap-card-valid-booking/);
      bookingCards.forEach(card => {
        expect(card).toHaveAttribute('data-swap-type', 'booking');
      });
    });

    it('should filter to cash swaps only', async () => {
      const user = userEvent.setup();
      renderWithStore(<SwapBrowser {...defaultProps} />);

      // Open filters
      const showFiltersButton = screen.getByText('Show Filters');
      await user.click(showFiltersButton);

      // Apply swap type filter
      const swapTypeFilter = screen.getByTestId('swap-type-filter');
      await user.selectOptions(swapTypeFilter, 'cash');

      await waitFor(() => {
        // Should only show cash swaps
        expect(screen.getByTestId('swap-card-valid-cash-paris')).toBeInTheDocument();
        expect(screen.getByTestId('swap-card-valid-cash-tokyo')).toBeInTheDocument();
        
        // Should not show booking swaps
        expect(screen.queryByTestId('swap-card-valid-booking-paris')).not.toBeInTheDocument();
        expect(screen.queryByTestId('swap-card-valid-booking-london')).not.toBeInTheDocument();
      });

      // Verify swap type in displayed cards
      const cashCards = screen.getAllByTestId(/swap-card-valid-cash/);
      cashCards.forEach(card => {
        expect(card).toHaveAttribute('data-swap-type', 'cash');
      });
    });
  });

  describe('Date Range Filtering Integration', () => {
    it('should filter swaps by date range', async () => {
      const user = userEvent.setup();
      renderWithStore(<SwapBrowser {...defaultProps} />);

      // Open filters
      const showFiltersButton = screen.getByText('Show Filters');
      await user.click(showFiltersButton);

      // Apply date range filter (June 2024)
      const dateStartFilter = screen.getByTestId('date-start-filter');
      const dateEndFilter = screen.getByTestId('date-end-filter');
      
      await user.type(dateStartFilter, '2024-06-01');
      await user.type(dateEndFilter, '2024-06-30');

      await waitFor(() => {
        // Should show June swaps
        expect(screen.getByTestId('swap-card-valid-booking-paris')).toBeInTheDocument(); // June 1-5
        expect(screen.getByTestId('swap-card-valid-cash-paris')).toBeInTheDocument(); // June 15
        
        // Should not show non-June swaps
        expect(screen.queryByTestId('swap-card-valid-booking-london')).not.toBeInTheDocument(); // July
        expect(screen.queryByTestId('swap-card-valid-cash-tokyo')).not.toBeInTheDocument(); // August
      });
    });
  });

  describe('Combined Filtering Integration', () => {
    it('should apply multiple filters simultaneously', async () => {
      const user = userEvent.setup();
      renderWithStore(<SwapBrowser {...defaultProps} />);

      // Open filters
      const showFiltersButton = screen.getByText('Show Filters');
      await user.click(showFiltersButton);

      // Apply multiple filters: Paris + Cash + Price range 300-500
      const cityFilter = screen.getByTestId('city-filter');
      const swapTypeFilter = screen.getByTestId('swap-type-filter');
      const minPriceFilter = screen.getByTestId('min-price-filter');
      const maxPriceFilter = screen.getByTestId('max-price-filter');
      
      await user.type(cityFilter, 'Paris');
      await user.selectOptions(swapTypeFilter, 'cash');
      await user.type(minPriceFilter, '300');
      await user.type(maxPriceFilter, '500');

      await waitFor(() => {
        // Should only show Paris cash swap in price range
        expect(screen.getByTestId('swap-card-valid-cash-paris')).toBeInTheDocument(); // Paris, cash, 400
        
        // Should not show other swaps
        expect(screen.queryByTestId('swap-card-valid-booking-paris')).not.toBeInTheDocument(); // Not cash
        expect(screen.queryByTestId('swap-card-valid-cash-tokyo')).not.toBeInTheDocument(); // Not Paris, price too high
        expect(screen.queryByTestId('swap-card-valid-booking-london')).not.toBeInTheDocument(); // Not Paris, not cash
      });

      // Should show count of 1
      expect(screen.getByText('1 swaps available for proposals')).toBeInTheDocument();
    });

    it('should show empty state when all swaps are filtered out', async () => {
      const user = userEvent.setup();
      renderWithStore(<SwapBrowser {...defaultProps} />);

      // Open filters
      const showFiltersButton = screen.getByText('Show Filters');
      await user.click(showFiltersButton);

      // Apply filters that exclude all swaps
      const cityFilter = screen.getByTestId('city-filter');
      await user.type(cityFilter, 'NonexistentCity');

      await waitFor(() => {
        // Should show empty state
        expect(screen.getByText('No swaps match your criteria')).toBeInTheDocument();
        expect(screen.getByText(/All available swaps are filtered out/)).toBeInTheDocument();
        
        // Should not show any swap cards
        expect(screen.queryByTestId(/swap-card-/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Filter Reset Integration', () => {
    it('should reset all filters and show all valid swaps', async () => {
      const user = userEvent.setup();
      renderWithStore(<SwapBrowser {...defaultProps} />);

      // Open filters and apply some
      const showFiltersButton = screen.getByText('Show Filters');
      await user.click(showFiltersButton);

      const cityFilter = screen.getByTestId('city-filter');
      await user.type(cityFilter, 'Paris');

      // Verify filtered state
      await waitFor(() => {
        expect(screen.getByText('2 swaps available for proposals')).toBeInTheDocument();
      });

      // Reset filters
      const resetButton = screen.getByTestId('reset-filters');
      await user.click(resetButton);

      await waitFor(() => {
        // Should show all valid swaps again
        expect(screen.getByText('4 swaps available for proposals')).toBeInTheDocument();
        expect(screen.getByTestId('swap-card-valid-booking-paris')).toBeInTheDocument();
        expect(screen.getByTestId('swap-card-valid-booking-london')).toBeInTheDocument();
        expect(screen.getByTestId('swap-card-valid-cash-paris')).toBeInTheDocument();
        expect(screen.getByTestId('swap-card-valid-cash-tokyo')).toBeInTheDocument();
      });

      // Filter inputs should be cleared
      expect(cityFilter).toHaveValue('');
    });
  });

  describe('Search Integration with Filtering', () => {
    it('should combine search with filters', async () => {
      const user = userEvent.setup();
      renderWithStore(<SwapBrowser {...defaultProps} />);

      // Apply search
      const searchInput = screen.getByPlaceholderText('Search by title, location, or description...');
      await user.type(searchInput, 'Hotel');

      // Open filters and apply additional filter
      const showFiltersButton = screen.getByText('Show Filters');
      await user.click(showFiltersButton);

      const cityFilter = screen.getByTestId('city-filter');
      await user.type(cityFilter, 'Paris');

      await waitFor(() => {
        // Should show only Paris hotel (combines search + filter)
        expect(screen.getByTestId('swap-card-valid-booking-paris')).toBeInTheDocument();
        
        // Should not show London hotel (filtered out by city)
        expect(screen.queryByTestId('swap-card-valid-booking-london')).not.toBeInTheDocument();
        
        // Should not show Paris concert (filtered out by search)
        expect(screen.queryByTestId('swap-card-valid-cash-paris')).not.toBeInTheDocument();
      });
    });
  });

  describe('Real-time Filter Updates', () => {
    it('should update results immediately as filters change', async () => {
      const user = userEvent.setup();
      renderWithStore(<SwapBrowser {...defaultProps} />);

      // Open filters
      const showFiltersButton = screen.getByText('Show Filters');
      await user.click(showFiltersButton);

      const cityFilter = screen.getByTestId('city-filter');

      // Type 'P' - should show Paris swaps
      await user.type(cityFilter, 'P');
      await waitFor(() => {
        expect(screen.getByTestId('swap-card-valid-booking-paris')).toBeInTheDocument();
        expect(screen.getByTestId('swap-card-valid-cash-paris')).toBeInTheDocument();
      });

      // Complete 'Paris' - should still show Paris swaps
      await user.type(cityFilter, 'aris');
      await waitFor(() => {
        expect(screen.getByTestId('swap-card-valid-booking-paris')).toBeInTheDocument();
        expect(screen.getByTestId('swap-card-valid-cash-paris')).toBeInTheDocument();
        expect(screen.queryByTestId('swap-card-valid-booking-london')).not.toBeInTheDocument();
      });

      // Clear and type 'London'
      await user.clear(cityFilter);
      await user.type(cityFilter, 'London');
      await waitFor(() => {
        expect(screen.getByTestId('swap-card-valid-booking-london')).toBeInTheDocument();
        expect(screen.queryByTestId('swap-card-valid-booking-paris')).not.toBeInTheDocument();
        expect(screen.queryByTestId('swap-card-valid-cash-paris')).not.toBeInTheDocument();
      });
    });
  });

  describe('Filter Persistence', () => {
    it('should maintain filters when swaps data updates', async () => {
      const user = userEvent.setup();
      const { rerender } = renderWithStore(<SwapBrowser {...defaultProps} />);

      // Apply filters
      const showFiltersButton = screen.getByText('Show Filters');
      await user.click(showFiltersButton);

      const cityFilter = screen.getByTestId('city-filter');
      await user.type(cityFilter, 'Paris');

      await waitFor(() => {
        expect(screen.getByText('2 swaps available for proposals')).toBeInTheDocument();
      });

      // Update swaps data (simulate new data from API)
      const updatedSwaps = [...createTestSwaps()];
      rerender(
        <Provider store={createMockStore()}>
          <SwapBrowser {...defaultProps} swaps={updatedSwaps} />
        </Provider>
      );

      // Filters should still be applied
      await waitFor(() => {
        expect(cityFilter).toHaveValue('Paris');
        expect(screen.getByText('2 swaps available for proposals')).toBeInTheDocument();
      });
    });
  });
});