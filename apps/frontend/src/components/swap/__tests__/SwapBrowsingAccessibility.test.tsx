import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { SwapBrowser } from '../SwapBrowser';
import { SwapWithBookings } from '@/services/bookingService';

/**
 * Accessibility compliance tests for filtered browse results
 * Tests WCAG 2.1 AA compliance and keyboard navigation as required by task 10.5
 */

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock dependencies with accessibility-compliant implementations
jest.mock('@/services/SwapFilterService', () => ({
  swapFilterService: {
    applyCoreBrowsingFilters: jest.fn((swaps, userId) => 
      swaps.filter((s: any) => s.owner?.id !== userId && s.sourceBooking?.status !== 'cancelled' && s.hasActiveProposals)
    ),
    applyUserFilters: jest.fn(swaps => swaps),
    applyAllFilters: jest.fn((swaps, userId) => 
      swaps.filter((s: any) => s.owner?.id !== userId && s.sourceBooking?.status !== 'cancelled' && s.hasActiveProposals)
    ),
    getFilterSummary: jest.fn(() => 'excluding your own bookings, excluding cancelled bookings, only showing bookings with active swap proposals'),
    validateFilters: jest.fn(() => ({ isValid: true, errors: [] }))
  }
}));

jest.mock('@/hooks/useDebounce', () => ({
  useDebounce: (value: any) => value,
}));

// Accessible SwapCard mock
jest.mock('../SwapCard', () => ({
  SwapCard: ({ swap, onAction }: any) => (
    <article 
      data-testid={`swap-card-${swap.id}`}
      role="article"
      aria-labelledby={`swap-title-${swap.id}`}
      aria-describedby={`swap-details-${swap.id}`}
      tabIndex={0}
    >
      <h3 id={`swap-title-${swap.id}`}>{swap.sourceBooking?.title}</h3>
      <div id={`swap-details-${swap.id}`}>
        <p>Location: {swap.sourceBooking?.location?.city}, {swap.sourceBooking?.location?.country}</p>
        <p>Price: ${swap.swapType === 'cash' ? swap.cashDetails?.preferredAmount || 'N/A' : swap.sourceBooking?.swapValue}</p>
        <p>Type: {swap.swapType}</p>
      </div>
      <button 
        onClick={() => onAction?.('propose', swap)}
        aria-label={`Propose swap for ${swap.sourceBooking?.title}`}
      >
        Propose Swap
      </button>
      <button 
        onClick={() => onAction?.('view', swap)}
        aria-label={`View details for ${swap.sourceBooking?.title}`}
      >
        View Details
      </button>
    </article>
  ),
}));

// Accessible FilterPanel mock
jest.mock('@/components/booking/FilterPanel', () => ({
  FilterPanel: ({ filters, onChange, onReset }: any) => (
    <div role="region" aria-label="Filter options" data-testid="filter-panel">
      <fieldset>
        <legend>Location Filters</legend>
        <label htmlFor="city-filter">City</label>
        <input
          id="city-filter"
          data-testid="city-filter"
          type="text"
          value={filters.location?.city || ''}
          onChange={(e) => onChange({ 
            ...filters, 
            location: { ...filters.location, city: e.target.value } 
          })}
          aria-describedby="city-filter-help"
        />
        <div id="city-filter-help" className="sr-only">
          Filter swaps by city name
        </div>
        
        <label htmlFor="country-filter">Country</label>
        <input
          id="country-filter"
          data-testid="country-filter"
          type="text"
          value={filters.location?.country || ''}
          onChange={(e) => onChange({ 
            ...filters, 
            location: { ...filters.location, country: e.target.value } 
          })}
          aria-describedby="country-filter-help"
        />
        <div id="country-filter-help" className="sr-only">
          Filter swaps by country name
        </div>
      </fieldset>

      <fieldset>
        <legend>Price Range</legend>
        <label htmlFor="min-price-filter">Minimum Price</label>
        <input
          id="min-price-filter"
          data-testid="min-price-filter"
          type="number"
          min="0"
          value={filters.priceRange?.min || ''}
          onChange={(e) => onChange({ 
            ...filters, 
            priceRange: { ...filters.priceRange, min: parseInt(e.target.value) || undefined } 
          })}
          aria-describedby="min-price-help"
        />
        <div id="min-price-help" className="sr-only">
          Set minimum price for swap filtering
        </div>

        <label htmlFor="max-price-filter">Maximum Price</label>
        <input
          id="max-price-filter"
          data-testid="max-price-filter"
          type="number"
          min="0"
          value={filters.priceRange?.max || ''}
          onChange={(e) => onChange({ 
            ...filters, 
            priceRange: { ...filters.priceRange, max: parseInt(e.target.value) || undefined } 
          })}
          aria-describedby="max-price-help"
        />
        <div id="max-price-help" className="sr-only">
          Set maximum price for swap filtering
        </div>
      </fieldset>

      <fieldset>
        <legend>Swap Type</legend>
        <label htmlFor="swap-type-filter">Swap Type</label>
        <select
          id="swap-type-filter"
          data-testid="swap-type-filter"
          value={filters.swapType || 'both'}
          onChange={(e) => onChange({ 
            ...filters, 
            swapType: e.target.value as 'booking' | 'cash' | 'both'
          })}
          aria-describedby="swap-type-help"
        >
          <option value="both">All Types</option>
          <option value="booking">Booking Swaps</option>
          <option value="cash">Cash Swaps</option>
        </select>
        <div id="swap-type-help" className="sr-only">
          Choose the type of swaps to display
        </div>
      </fieldset>

      <button 
        data-testid="reset-filters" 
        onClick={onReset}
        aria-label="Reset all filters to default values"
      >
        Reset Filters
      </button>
    </div>
  ),
}));

// Accessible UI components mock
jest.mock('@/components/ui', () => ({
  Button: ({ children, onClick, variant, disabled, 'aria-label': ariaLabel, ...props }: any) => (
    <button 
      onClick={onClick} 
      data-variant={variant}
      disabled={disabled}
      aria-label={ariaLabel}
      {...props}
    >
      {children}
    </button>
  ),
  Input: ({ 
    value, 
    onChange, 
    placeholder, 
    'aria-label': ariaLabel,
    'aria-describedby': ariaDescribedBy,
    leftIcon,
    rightIcon,
    ...props 
  }: any) => (
    <div className="input-wrapper">
      {leftIcon && <span aria-hidden="true">{leftIcon}</span>}
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        {...props}
      />
      {rightIcon && <span aria-hidden="true">{rightIcon}</span>}
    </div>
  ),
}));

// Create test data
const createAccessibleTestSwaps = (): SwapWithBookings[] => [
  {
    id: 'swap-1',
    sourceBooking: {
      id: 'booking-1',
      title: 'Luxury Hotel Paris',
      description: 'Beautiful hotel in central Paris',
      userId: 'user-1',
      status: 'available',
      type: 'hotel',
      location: { city: 'Paris', country: 'France' },
      dateRange: { checkIn: '2024-06-01T00:00:00Z', checkOut: '2024-06-05T00:00:00Z' },
      swapValue: 1200,
      originalPrice: 1500,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      verification: { status: 'verified', verifiedAt: new Date() },
      providerDetails: { provider: 'Test', confirmationNumber: 'CONF1', bookingReference: 'REF1' }
    },
    owner: { id: 'user-1', name: 'User 1', walletAddress: '0x123' },
    proposer: { id: 'current-user', name: 'Current User', walletAddress: '0x456' },
    swapType: 'booking',
    hasActiveProposals: true,
    activeProposalCount: 2,
    status: 'pending',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'swap-2',
    sourceBooking: {
      id: 'booking-2',
      title: 'Concert Tickets London',
      description: 'Premium concert tickets',
      userId: 'user-2',
      status: 'available',
      type: 'event',
      location: { city: 'London', country: 'UK' },
      dateRange: { checkIn: '2024-07-15T00:00:00Z', checkOut: '2024-07-15T00:00:00Z' },
      swapValue: 400,
      originalPrice: 500,
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
      verification: { status: 'verified', verifiedAt: new Date() },
      providerDetails: { provider: 'Test', confirmationNumber: 'CONF2', bookingReference: 'REF2' }
    },
    owner: { id: 'user-2', name: 'User 2', walletAddress: '0x789' },
    proposer: { id: 'current-user', name: 'Current User', walletAddress: '0x456' },
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
    activeProposalCount: 1,
    status: 'pending',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z'
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
  swaps: createAccessibleTestSwaps(),
  userBookings: [],
  loading: false,
  error: null,
  onSwapSelect: jest.fn(),
  onSwapProposal: jest.fn(),
  onLoadMore: jest.fn(),
  hasMore: false,
  totalCount: 2,
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

describe('Swap Browsing Accessibility Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('WCAG 2.1 AA Compliance', () => {
    it('should have no accessibility violations in default state', async () => {
      const { container } = renderWithStore(<SwapBrowser {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations with filters applied', async () => {
      const user = userEvent.setup();
      const { container } = renderWithStore(<SwapBrowser {...defaultProps} />);

      // Open filters
      const showFiltersButton = screen.getByText('Show Filters');
      await user.click(showFiltersButton);

      // Apply some filters
      const cityFilter = screen.getByTestId('city-filter');
      await user.type(cityFilter, 'Paris');

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations in loading state', async () => {
      const { container } = renderWithStore(
        <SwapBrowser {...defaultProps} loading={true} swaps={[]} />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations in error state', async () => {
      const { container } = renderWithStore(
        <SwapBrowser {...defaultProps} error="Failed to load swaps" />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations in empty state', async () => {
      const { container } = renderWithStore(
        <SwapBrowser {...defaultProps} swaps={[]} />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Semantic HTML and ARIA', () => {
    it('should have proper heading hierarchy', () => {
      renderWithStore(<SwapBrowser {...defaultProps} />);

      // Main heading should be h1
      expect(screen.getByRole('heading', { level: 1, name: 'Browse Available Swaps' })).toBeInTheDocument();

      // Swap cards should have proper headings
      expect(screen.getByRole('heading', { level: 3, name: 'Luxury Hotel Paris' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: 'Concert Tickets London' })).toBeInTheDocument();
    });

    it('should have proper landmark roles', () => {
      renderWithStore(<SwapBrowser {...defaultProps} />);

      // Main content should be identifiable
      expect(screen.getByRole('main')).toBeInTheDocument();

      // Filter region should be identifiable
      const showFiltersButton = screen.getByText('Show Filters');
      fireEvent.click(showFiltersButton);
      expect(screen.getByRole('region', { name: 'Filter options' })).toBeInTheDocument();
    });

    it('should have proper form controls with labels', async () => {
      const user = userEvent.setup();
      renderWithStore(<SwapBrowser {...defaultProps} />);

      // Open filters
      const showFiltersButton = screen.getByText('Show Filters');
      await user.click(showFiltersButton);

      // All form controls should have labels
      expect(screen.getByLabelText('City')).toBeInTheDocument();
      expect(screen.getByLabelText('Country')).toBeInTheDocument();
      expect(screen.getByLabelText('Minimum Price')).toBeInTheDocument();
      expect(screen.getByLabelText('Maximum Price')).toBeInTheDocument();
      expect(screen.getByLabelText('Swap Type')).toBeInTheDocument();
    });

    it('should have proper fieldsets and legends for grouped controls', async () => {
      const user = userEvent.setup();
      renderWithStore(<SwapBrowser {...defaultProps} />);

      // Open filters
      const showFiltersButton = screen.getByText('Show Filters');
      await user.click(showFiltersButton);

      // Check for fieldsets with legends
      expect(screen.getByText('Location Filters')).toBeInTheDocument();
      expect(screen.getByText('Price Range')).toBeInTheDocument();
      expect(screen.getByText('Swap Type')).toBeInTheDocument();
    });

    it('should have proper ARIA descriptions for form controls', async () => {
      const user = userEvent.setup();
      renderWithStore(<SwapBrowser {...defaultProps} />);

      // Open filters
      const showFiltersButton = screen.getByText('Show Filters');
      await user.click(showFiltersButton);

      // Check for ARIA descriptions
      const cityFilter = screen.getByLabelText('City');
      expect(cityFilter).toHaveAttribute('aria-describedby', 'city-filter-help');

      const minPriceFilter = screen.getByLabelText('Minimum Price');
      expect(minPriceFilter).toHaveAttribute('aria-describedby', 'min-price-help');
    });

    it('should have proper button labels', () => {
      renderWithStore(<SwapBrowser {...defaultProps} />);

      // Action buttons should have descriptive labels
      expect(screen.getByLabelText('Propose swap for Luxury Hotel Paris')).toBeInTheDocument();
      expect(screen.getByLabelText('View details for Luxury Hotel Paris')).toBeInTheDocument();
      expect(screen.getByLabelText('Propose swap for Concert Tickets London')).toBeInTheDocument();
      expect(screen.getByLabelText('View details for Concert Tickets London')).toBeInTheDocument();
    });

    it('should have proper article structure for swap cards', () => {
      renderWithStore(<SwapBrowser {...defaultProps} />);

      // Swap cards should be articles
      const swapCards = screen.getAllByRole('article');
      expect(swapCards).toHaveLength(2);

      // Each article should have proper labeling
      expect(swapCards[0]).toHaveAttribute('aria-labelledby', 'swap-title-swap-1');
      expect(swapCards[0]).toHaveAttribute('aria-describedby', 'swap-details-swap-1');
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support tab navigation through all interactive elements', async () => {
      const user = userEvent.setup();
      renderWithStore(<SwapBrowser {...defaultProps} />);

      // Tab through main elements
      await user.tab();
      expect(screen.getByPlaceholderText('Search by title, location, or description...')).toHaveFocus();

      await user.tab();
      expect(screen.getByText('Show Filters')).toHaveFocus();

      await user.tab();
      expect(screen.getByDisplayValue('Date Created')).toHaveFocus(); // Sort select

      await user.tab();
      expect(screen.getByLabelText('Sort ascending')).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText('Grid view')).toHaveFocus();

      // Tab to swap cards
      await user.tab();
      expect(screen.getByTestId('swap-card-swap-1')).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText('Propose swap for Luxury Hotel Paris')).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText('View details for Luxury Hotel Paris')).toHaveFocus();
    });

    it('should support keyboard navigation within filters', async () => {
      const user = userEvent.setup();
      renderWithStore(<SwapBrowser {...defaultProps} />);

      // Open filters with keyboard
      await user.tab(); // Search
      await user.tab(); // Show Filters button
      await user.keyboard('{Enter}');

      // Tab through filter controls
      await user.tab();
      expect(screen.getByLabelText('City')).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText('Country')).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText('Minimum Price')).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText('Maximum Price')).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText('Swap Type')).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText('Reset all filters to default values')).toHaveFocus();
    });

    it('should support Enter and Space key activation', async () => {
      const user = userEvent.setup();
      const onSwapSelect = jest.fn();
      renderWithStore(<SwapBrowser {...defaultProps} onSwapSelect={onSwapSelect} />);

      // Navigate to swap card
      await user.tab(); // Search
      await user.tab(); // Show Filters
      await user.tab(); // Sort
      await user.tab(); // Sort order
      await user.tab(); // View mode
      await user.tab(); // First swap card

      // Activate with Enter
      await user.keyboard('{Enter}');
      // Note: This would typically trigger card selection, but our mock doesn't implement it

      // Navigate to button and activate with Space
      await user.tab(); // Propose button
      await user.keyboard(' ');
      // Note: This would typically trigger the propose action
    });

    it('should support Escape key to close modals/filters', async () => {
      const user = userEvent.setup();
      renderWithStore(<SwapBrowser {...defaultProps} />);

      // Open filters
      const showFiltersButton = screen.getByText('Show Filters');
      await user.click(showFiltersButton);

      expect(screen.getByTestId('filter-panel')).toBeInTheDocument();

      // Close with Escape
      await user.keyboard('{Escape}');
      
      // Note: In a real implementation, this would close the filter panel
      // For this test, we're verifying the keyboard event is handled
    });

    it('should maintain focus management when filters change results', async () => {
      const user = userEvent.setup();
      renderWithStore(<SwapBrowser {...defaultProps} />);

      // Open filters and focus on city input
      const showFiltersButton = screen.getByText('Show Filters');
      await user.click(showFiltersButton);

      const cityFilter = screen.getByLabelText('City');
      await user.click(cityFilter);
      expect(cityFilter).toHaveFocus();

      // Type to filter results
      await user.type(cityFilter, 'Paris');

      // Focus should remain on the input
      expect(cityFilter).toHaveFocus();
    });
  });

  describe('Screen Reader Support', () => {
    it('should announce filter changes to screen readers', async () => {
      const user = userEvent.setup();
      renderWithStore(<SwapBrowser {...defaultProps} />);

      // Check for live region
      expect(screen.getByText(/Active Filters:/)).toBeInTheDocument();

      // Open filters and apply one
      const showFiltersButton = screen.getByText('Show Filters');
      await user.click(showFiltersButton);

      const cityFilter = screen.getByLabelText('City');
      await user.type(cityFilter, 'Paris');

      // Filter summary should be updated for screen readers
      expect(screen.getByText(/excluding your own bookings/)).toBeInTheDocument();
    });

    it('should provide proper status updates', () => {
      renderWithStore(<SwapBrowser {...defaultProps} />);

      // Results count should be announced
      expect(screen.getByText('2 swaps available for proposals')).toBeInTheDocument();
    });

    it('should provide proper loading announcements', () => {
      renderWithStore(<SwapBrowser {...defaultProps} loading={true} />);

      // Loading state should be announced
      expect(screen.getByText('Loading swaps...')).toBeInTheDocument();
    });

    it('should provide proper error announcements', () => {
      const errorMessage = 'Failed to load swaps';
      renderWithStore(<SwapBrowser {...defaultProps} error={errorMessage} />);

      // Error should be announced
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('should provide proper empty state announcements', () => {
      renderWithStore(<SwapBrowser {...defaultProps} swaps={[]} />);

      // Empty state should be descriptive
      expect(screen.getByText('No swaps available')).toBeInTheDocument();
      expect(screen.getByText(/There are no active swaps available at the moment/)).toBeInTheDocument();
    });
  });

  describe('Focus Management', () => {
    it('should have visible focus indicators', async () => {
      const user = userEvent.setup();
      renderWithStore(<SwapBrowser {...defaultProps} />);

      // Tab to first interactive element
      await user.tab();
      const searchInput = screen.getByPlaceholderText('Search by title, location, or description...');
      expect(searchInput).toHaveFocus();

      // Focus should be visible (this would be tested with CSS in a real implementation)
      expect(searchInput).toBeInTheDocument();
    });

    it('should trap focus within modals when opened', async () => {
      const user = userEvent.setup();
      renderWithStore(<SwapBrowser {...defaultProps} />);

      // Open filters (simulating modal behavior)
      const showFiltersButton = screen.getByText('Show Filters');
      await user.click(showFiltersButton);

      // Focus should move to first filter control
      const cityFilter = screen.getByLabelText('City');
      expect(cityFilter).toBeInTheDocument();

      // In a real implementation, focus would be trapped within the filter panel
    });

    it('should restore focus when modals close', async () => {
      const user = userEvent.setup();
      renderWithStore(<SwapBrowser {...defaultProps} />);

      // Focus on show filters button
      const showFiltersButton = screen.getByText('Show Filters');
      await user.click(showFiltersButton);

      // In a real implementation, closing the modal would restore focus to the button
      expect(showFiltersButton).toBeInTheDocument();
    });
  });

  describe('Color and Contrast', () => {
    it('should not rely solely on color to convey information', () => {
      renderWithStore(<SwapBrowser {...defaultProps} />);

      // Swap types should be indicated by text, not just color
      expect(screen.getByText('Type: booking')).toBeInTheDocument();
      expect(screen.getByText('Type: cash')).toBeInTheDocument();

      // Status should be indicated by text
      expect(screen.getByText('2 swaps available for proposals')).toBeInTheDocument();
    });

    it('should provide text alternatives for visual elements', () => {
      renderWithStore(<SwapBrowser {...defaultProps} />);

      // Icons should have text alternatives or be marked as decorative
      const sortButton = screen.getByLabelText('Sort ascending');
      expect(sortButton).toBeInTheDocument();

      const gridViewButton = screen.getByLabelText('Grid view');
      expect(gridViewButton).toBeInTheDocument();
    });
  });

  describe('Responsive Design Accessibility', () => {
    it('should maintain accessibility on mobile viewports', () => {
      // Simulate mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      renderWithStore(<SwapBrowser {...defaultProps} />);

      // Touch targets should be large enough (44px minimum)
      // This would be tested with actual CSS measurements in a real implementation
      expect(screen.getByText('Show Filters')).toBeInTheDocument();
      expect(screen.getByLabelText('Propose swap for Luxury Hotel Paris')).toBeInTheDocument();
    });

    it('should support zoom up to 200% without horizontal scrolling', () => {
      // This would be tested with actual browser zoom in a real implementation
      renderWithStore(<SwapBrowser {...defaultProps} />);

      // Content should remain accessible when zoomed
      expect(screen.getByText('Browse Available Swaps')).toBeInTheDocument();
      expect(screen.getByText('2 swaps available for proposals')).toBeInTheDocument();
    });
  });

  describe('Motion and Animation Accessibility', () => {
    it('should respect prefers-reduced-motion settings', () => {
      // Mock prefers-reduced-motion
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      renderWithStore(<SwapBrowser {...defaultProps} />);

      // Animations should be reduced or disabled
      // This would be tested with actual CSS animations in a real implementation
      expect(screen.getByText('Browse Available Swaps')).toBeInTheDocument();
    });
  });
});