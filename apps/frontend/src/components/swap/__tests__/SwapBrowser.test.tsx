import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SwapBrowser } from '../SwapBrowser';
import { SwapWithBookings, Booking } from '@/services/bookingService';
import { swapFilterService } from '@/services/SwapFilterService';

// Mock the SwapFilterService
jest.mock('@/services/SwapFilterService', () => ({
  swapFilterService: {
    applyCoreBrowsingFilters: jest.fn(),
    applyUserFilters: jest.fn(),
    getFilterSummary: jest.fn(),
  },
}));

// Mock the useDebounce hook
jest.mock('@/hooks/useDebounce', () => ({
  useDebounce: (value: any) => value,
}));

// Mock the SwapCard component
jest.mock('../SwapCard', () => ({
  SwapCard: ({ swap, onAction }: any) => (
    <div data-testid={`swap-card-${swap.id}`}>
      <h3>{swap.sourceBooking?.title}</h3>
      <button onClick={() => onAction?.('propose', swap)}>Propose Swap</button>
      <button onClick={() => onAction?.('view', swap)}>View Details</button>
    </div>
  ),
}));

// Mock the FilterPanel component
jest.mock('@/components/booking/FilterPanel', () => ({
  FilterPanel: ({ filters, onChange, onReset }: any) => (
    <div data-testid="filter-panel">
      <button onClick={() => onChange({ location: { city: 'New York' } })}>
        Apply Location Filter
      </button>
      <button onClick={onReset}>Reset Filters</button>
    </div>
  ),
}));

// Mock the SwapProposalModal component
jest.mock('../SwapProposalModal', () => ({
  SwapProposalModal: ({ isOpen, onClose, onSubmit }: any) =>
    isOpen ? (
      <div data-testid="swap-proposal-modal">
        <button onClick={() => onSubmit({ message: 'Test proposal' })}>
          Submit Proposal
        </button>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

// Mock UI components
jest.mock('@/components/ui', () => ({
  Button: ({ children, onClick, variant, ...props }: any) => (
    <button onClick={onClick} data-variant={variant} {...props}>
      {children}
    </button>
  ),
  Input: ({
    value,
    onChange,
    placeholder,
    leftIcon,
    rightIcon,
    ...props
  }: any) => (
    <div>
      {leftIcon}
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        {...props}
      />
      {rightIcon}
    </div>
  ),
}));

const mockSwaps: SwapWithBookings[] = [
  {
    id: 'swap-1',
    sourceBooking: {
      id: 'booking-1',
      title: 'Hotel in Paris',
      description: 'Luxury hotel in central Paris',
      userId: 'user-2',
      status: 'active',
      type: 'hotel',
      city: 'Paris',
      country: 'France',
      location: { city: 'Paris', country: 'France' },
      dateRange: { checkIn: '2024-06-01', checkOut: '2024-06-05' },
      checkInDate: '2024-06-01',
      checkOutDate: '2024-06-05',
      originalPrice: 500,
      swapValue: 450,
      createdAt: '2024-01-01T00:00:00Z',
    },
    owner: { id: 'user-2', name: 'John Doe' },
    proposer: { id: 'user-1', name: 'Jane Smith' },
    swapType: 'booking',
    hasActiveProposals: true,
    activeProposalCount: 2,
    status: 'pending',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'swap-2',
    sourceBooking: {
      id: 'booking-2',
      title: 'Flight to Tokyo',
      description: 'Round trip flight to Tokyo',
      userId: 'user-1', // User's own swap - should be filtered out
      status: 'active',
      type: 'flight',
      city: 'Tokyo',
      country: 'Japan',
      location: { city: 'Tokyo', country: 'Japan' },
      dateRange: { checkIn: '2024-07-01', checkOut: '2024-07-10' },
      checkInDate: '2024-07-01',
      checkOutDate: '2024-07-10',
      originalPrice: 800,
      swapValue: 750,
      createdAt: '2024-01-02T00:00:00Z',
    },
    owner: { id: 'user-1', name: 'Jane Smith' },
    proposer: { id: 'user-3', name: 'Bob Wilson' },
    swapType: 'booking',
    hasActiveProposals: true,
    activeProposalCount: 1,
    status: 'pending',
    createdAt: '2024-01-02T00:00:00Z',
  },
  {
    id: 'swap-3',
    sourceBooking: {
      id: 'booking-3',
      title: 'Cancelled Hotel',
      description: 'This booking was cancelled',
      userId: 'user-3',
      status: 'cancelled', // Should be filtered out
      type: 'hotel',
      city: 'London',
      country: 'UK',
      location: { city: 'London', country: 'UK' },
      dateRange: { checkIn: '2024-08-01', checkOut: '2024-08-05' },
      checkInDate: '2024-08-01',
      checkOutDate: '2024-08-05',
      originalPrice: 300,
      swapValue: 280,
      createdAt: '2024-01-03T00:00:00Z',
    },
    owner: { id: 'user-3', name: 'Bob Wilson' },
    proposer: { id: 'user-1', name: 'Jane Smith' },
    swapType: 'booking',
    hasActiveProposals: false, // Should be filtered out
    activeProposalCount: 0,
    status: 'pending',
    createdAt: '2024-01-03T00:00:00Z',
  },
  {
    id: 'swap-4',
    sourceBooking: {
      id: 'booking-4',
      title: 'Event in Berlin',
      description: 'Concert tickets in Berlin',
      userId: 'user-4',
      status: 'active',
      type: 'event',
      city: 'Berlin',
      country: 'Germany',
      location: { city: 'Berlin', country: 'Germany' },
      dateRange: { checkIn: '2024-09-01', checkOut: '2024-09-01' },
      checkInDate: '2024-09-01',
      checkOutDate: '2024-09-01',
      originalPrice: 200,
      swapValue: 180,
      createdAt: '2024-01-04T00:00:00Z',
    },
    owner: { id: 'user-4', name: 'Alice Brown' },
    proposer: { id: 'user-1', name: 'Jane Smith' },
    swapType: 'cash',
    hasActiveProposals: true,
    activeProposalCount: 3,
    status: 'pending',
    createdAt: '2024-01-04T00:00:00Z',
  },
];

const mockUserBookings: Booking[] = [
  {
    id: 'user-booking-1',
    title: 'My Hotel Booking',
    description: 'My hotel in Rome',
    userId: 'user-1',
    status: 'active',
    type: 'hotel',
    city: 'Rome',
    country: 'Italy',
    location: { city: 'Rome', country: 'Italy' },
    dateRange: { checkIn: '2024-05-01', checkOut: '2024-05-05' },
    checkInDate: '2024-05-01',
    checkOutDate: '2024-05-05',
    originalPrice: 400,
    swapValue: 380,
    createdAt: '2024-01-05T00:00:00Z',
  },
];

const defaultProps = {
  swaps: mockSwaps,
  userBookings: mockUserBookings,
  loading: false,
  error: null,
  onSwapSelect: jest.fn(),
  onSwapProposal: jest.fn(),
  onLoadMore: jest.fn(),
  hasMore: false,
  totalCount: mockSwaps.length,
  currentUserId: 'user-1',
};

describe('SwapBrowser', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock implementations
    (
      swapFilterService.applyCoreBrowsingFilters as jest.Mock
    ).mockImplementation((swaps, currentUserId) => {
      return swaps.filter(
        (swap: SwapWithBookings) =>
          swap.owner?.id !== currentUserId &&
          swap.sourceBooking?.status !== 'cancelled' &&
          swap.hasActiveProposals
      );
    });

    (swapFilterService.applyUserFilters as jest.Mock).mockImplementation(
      swaps => swaps
    );

    (swapFilterService.getFilterSummary as jest.Mock).mockReturnValue(
      'excluding your own bookings, excluding cancelled bookings, only showing bookings with active swap proposals'
    );
  });

  describe('Core Filtering Behavior', () => {
    it('should apply core browsing filters using currentUserId', () => {
      render(<SwapBrowser {...defaultProps} />);

      expect(swapFilterService.applyCoreBrowsingFilters).toHaveBeenCalledWith(
        mockSwaps,
        'user-1'
      );
    });

    it('should only display swaps that pass core filtering rules', () => {
      render(<SwapBrowser {...defaultProps} />);

      // Should show swap-1 and swap-4 (valid swaps)
      expect(screen.getByTestId('swap-card-swap-1')).toBeInTheDocument();
      expect(screen.getByTestId('swap-card-swap-4')).toBeInTheDocument();

      // Should not show swap-2 (user's own) and swap-3 (cancelled/no proposals)
      expect(screen.queryByTestId('swap-card-swap-2')).not.toBeInTheDocument();
      expect(screen.queryByTestId('swap-card-swap-3')).not.toBeInTheDocument();
    });

    it('should display filter summary information', () => {
      render(<SwapBrowser {...defaultProps} />);

      expect(screen.getByText(/Active Filters:/)).toBeInTheDocument();
      expect(
        screen.getByText(/excluding your own bookings/)
      ).toBeInTheDocument();
    });

    it('should show correct count of filtered swaps', () => {
      render(<SwapBrowser {...defaultProps} />);

      // Should show 2 swaps available (after filtering)
      expect(
        screen.getByText('2 swaps available for proposals')
      ).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('should filter swaps based on search query', async () => {
      const user = userEvent.setup();
      render(<SwapBrowser {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(
        'Search by title, location, or description...'
      );
      await user.type(searchInput, 'Paris');

      // Should only show the Paris hotel swap
      expect(screen.getByTestId('swap-card-swap-1')).toBeInTheDocument();
      expect(screen.queryByTestId('swap-card-swap-4')).not.toBeInTheDocument();
    });

    it('should clear search when clear button is clicked', async () => {
      const user = userEvent.setup();
      render(<SwapBrowser {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(
        'Search by title, location, or description...'
      );
      await user.type(searchInput, 'Paris');

      // Clear the search
      const clearButton = screen.getByLabelText('Clear search');
      await user.click(clearButton);

      expect(searchInput).toHaveValue('');
    });
  });

  describe('User Filters', () => {
    it('should apply user filters on top of core filters', async () => {
      const user = userEvent.setup();
      render(<SwapBrowser {...defaultProps} />);

      // Open filters
      const showFiltersButton = screen.getByText('Show Filters');
      await user.click(showFiltersButton);

      // Apply a location filter
      const applyFilterButton = screen.getByText('Apply Location Filter');
      await user.click(applyFilterButton);

      expect(swapFilterService.applyUserFilters).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          location: { city: 'New York' },
          excludeOwnSwaps: true,
          excludeCancelledBookings: true,
          requireActiveProposals: true,
        })
      );
    });

    it('should reset all filters when reset button is clicked', async () => {
      const user = userEvent.setup();
      render(<SwapBrowser {...defaultProps} />);

      // Open filters and apply some
      const showFiltersButton = screen.getByText('Show Filters');
      await user.click(showFiltersButton);

      const applyFilterButton = screen.getByText('Apply Location Filter');
      await user.click(applyFilterButton);

      // Reset filters
      const resetButton = screen.getByText('Reset Filters');
      await user.click(resetButton);

      // Should clear search and filters
      const searchInput = screen.getByPlaceholderText(
        'Search by title, location, or description...'
      );
      expect(searchInput).toHaveValue('');
    });
  });

  describe('Empty States', () => {
    it('should show appropriate empty state when no swaps are available', () => {
      render(<SwapBrowser {...defaultProps} swaps={[]} />);

      expect(screen.getByText('No swaps available')).toBeInTheDocument();
      expect(
        screen.getByText(/There are no active swaps available at the moment/)
      ).toBeInTheDocument();
    });

    it('should show filtering context when swaps are filtered out', () => {
      // Mock filter service to return empty array (all filtered out)
      (swapFilterService.applyCoreBrowsingFilters as jest.Mock).mockReturnValue(
        []
      );

      render(<SwapBrowser {...defaultProps} />);

      expect(
        screen.getByText('No swaps match your criteria')
      ).toBeInTheDocument();
      expect(
        screen.getByText(/All available swaps are filtered out/)
      ).toBeInTheDocument();
      expect(screen.getByText(/Your own swaps are hidden/)).toBeInTheDocument();
      expect(
        screen.getByText(/Cancelled bookings are excluded/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Only swaps with active proposals are shown/)
      ).toBeInTheDocument();
    });

    it('should show clear filters button in filtered empty state', async () => {
      const user = userEvent.setup();
      (swapFilterService.applyCoreBrowsingFilters as jest.Mock).mockReturnValue(
        []
      );

      render(<SwapBrowser {...defaultProps} />);

      // Apply a search filter first
      const searchInput = screen.getByPlaceholderText(
        'Search by title, location, or description...'
      );
      await user.type(searchInput, 'nonexistent');

      expect(screen.getByText('Clear all filters')).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('should show loading indicator when loading', () => {
      render(<SwapBrowser {...defaultProps} loading={true} swaps={[]} />);

      expect(screen.getByText('Loading swaps...')).toBeInTheDocument();
    });

    it('should show loading more indicator when loading with existing swaps', () => {
      render(<SwapBrowser {...defaultProps} loading={true} />);

      expect(screen.getByText('Loading more...')).toBeInTheDocument();
    });
  });

  describe('Error States', () => {
    it('should display error message when error occurs', () => {
      const errorMessage = 'Failed to load swaps';
      render(<SwapBrowser {...defaultProps} error={errorMessage} />);

      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  describe('Swap Actions', () => {
    it('should handle swap proposal action', async () => {
      const user = userEvent.setup();
      const onSwapProposal = jest.fn();

      render(<SwapBrowser {...defaultProps} onSwapProposal={onSwapProposal} />);

      // Click propose on first swap
      const proposeButton = screen.getAllByText('Propose Swap')[0];
      await user.click(proposeButton);

      // Should open proposal modal
      expect(screen.getByTestId('swap-proposal-modal')).toBeInTheDocument();

      // Submit proposal
      const submitButton = screen.getByText('Submit Proposal');
      await user.click(submitButton);

      expect(onSwapProposal).toHaveBeenCalledWith({ message: 'Test proposal' });
    });

    it('should handle swap selection action', async () => {
      const user = userEvent.setup();
      const onSwapSelect = jest.fn();

      render(<SwapBrowser {...defaultProps} onSwapSelect={onSwapSelect} />);

      // Click view details on first swap
      const viewButton = screen.getAllByText('View Details')[0];
      await user.click(viewButton);

      expect(onSwapSelect).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'swap-1' })
      );
    });
  });

  describe('Sorting and View Controls', () => {
    it('should handle sorting changes', async () => {
      const user = userEvent.setup();
      render(<SwapBrowser {...defaultProps} />);

      const sortSelect = screen.getByDisplayValue('Date Created');
      await user.selectOptions(sortSelect, 'price');

      expect(sortSelect).toHaveValue('price');
    });

    it('should toggle sort order', async () => {
      const user = userEvent.setup();
      render(<SwapBrowser {...defaultProps} />);

      const sortOrderButton = screen.getByLabelText('Sort ascending');
      await user.click(sortOrderButton);

      expect(screen.getByLabelText('Sort descending')).toBeInTheDocument();
    });

    it('should toggle view mode between grid and list', async () => {
      const user = userEvent.setup();
      render(<SwapBrowser {...defaultProps} />);

      const listViewButton = screen.getByLabelText('List view');
      await user.click(listViewButton);

      expect(listViewButton).toHaveAttribute('data-variant', 'primary');
    });
  });

  describe('Pagination', () => {
    it('should show load more button when hasMore is true', () => {
      render(<SwapBrowser {...defaultProps} hasMore={true} />);

      expect(screen.getByText('Load More Swaps')).toBeInTheDocument();
    });

    it('should call onLoadMore when load more button is clicked', async () => {
      const user = userEvent.setup();
      const onLoadMore = jest.fn();

      render(
        <SwapBrowser {...defaultProps} hasMore={true} onLoadMore={onLoadMore} />
      );

      const loadMoreButton = screen.getByText('Load More Swaps');
      await user.click(loadMoreButton);

      expect(onLoadMore).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(<SwapBrowser {...defaultProps} />);

      // Check for main heading
      expect(
        screen.getByRole('heading', { name: 'Browse Available Swaps' })
      ).toBeInTheDocument();

      // Check for search input
      expect(
        screen.getByPlaceholderText(
          'Search by title, location, or description...'
        )
      ).toBeInTheDocument();

      // Check for filter controls
      expect(screen.getByText('Show Filters')).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<SwapBrowser {...defaultProps} />);

      // Tab through interactive elements
      await user.tab();
      expect(
        screen.getByPlaceholderText(
          'Search by title, location, or description...'
        )
      ).toHaveFocus();

      await user.tab();
      expect(screen.getByText('Show Filters')).toHaveFocus();
    });
  });

  describe('Filter Integration', () => {
    it('should pass currentUserId to filter service consistently', () => {
      const currentUserId = 'test-user-123';
      render(<SwapBrowser {...defaultProps} currentUserId={currentUserId} />);

      expect(swapFilterService.applyCoreBrowsingFilters).toHaveBeenCalledWith(
        mockSwaps,
        currentUserId
      );

      expect(swapFilterService.getFilterSummary).toHaveBeenCalledWith(
        expect.objectContaining({
          excludeOwnSwaps: true,
          excludeCancelledBookings: true,
          requireActiveProposals: true,
        }),
        currentUserId
      );
    });

    it('should maintain filter state across re-renders', () => {
      const { rerender } = render(<SwapBrowser {...defaultProps} />);

      // Apply core filters on initial render
      expect(swapFilterService.applyCoreBrowsingFilters).toHaveBeenCalledTimes(
        1
      );

      // Re-render with same props
      rerender(<SwapBrowser {...defaultProps} />);

      // Should apply filters again
      expect(swapFilterService.applyCoreBrowsingFilters).toHaveBeenCalledTimes(
        2
      );
    });
  });
});
