import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { BookingBrowser } from '../BookingBrowser';
import { Booking } from '@booking-swap/shared';

// Mock the useDebounce hook
vi.mock('@/hooks/useDebounce', () => ({
  useDebounce: (value: any) => value,
}));

const mockBookings: Booking[] = [
  {
    id: '1',
    userId: 'user1',
    type: 'hotel',
    title: 'Luxury Hotel in NYC',
    description: 'Amazing hotel in Manhattan',
    location: {
      city: 'New York',
      country: 'United States',
      coordinates: [40.7128, -74.006],
    },
    dateRange: {
      checkIn: new Date('2024-06-01'),
      checkOut: new Date('2024-06-05'),
    },
    originalPrice: 1200,
    swapValue: 1000,
    providerDetails: {
      provider: 'Booking.com',
      confirmationNumber: 'BK123456',
      bookingReference: 'REF123',
    },
    verification: {
      status: 'verified',
      verifiedAt: new Date('2024-01-01'),
      documents: ['doc1'],
    },
    blockchain: {
      topicId: 'topic1',
    },
    status: 'available',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: '2',
    userId: 'user2',
    type: 'event',
    title: 'Concert Tickets',
    description: 'Front row seats for amazing concert',
    location: {
      city: 'Los Angeles',
      country: 'United States',
      coordinates: [34.0522, -118.2437],
    },
    dateRange: {
      checkIn: new Date('2024-07-15'),
      checkOut: new Date('2024-07-15'),
    },
    originalPrice: 500,
    swapValue: 450,
    providerDetails: {
      provider: 'Ticketmaster',
      confirmationNumber: 'TM789',
      bookingReference: 'REF789',
    },
    verification: {
      status: 'verified',
      verifiedAt: new Date('2024-01-01'),
      documents: ['doc2'],
    },
    blockchain: {
      topicId: 'topic2',
    },
    status: 'available',
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
  },
];

const mockUserBookings: Booking[] = [
  {
    id: '3',
    userId: 'currentUser',
    type: 'flight',
    title: 'Flight to Paris',
    description: 'Round trip flight to Paris',
    location: {
      city: 'Paris',
      country: 'France',
      coordinates: [48.8566, 2.3522],
    },
    dateRange: {
      checkIn: new Date('2024-08-01'),
      checkOut: new Date('2024-08-10'),
    },
    originalPrice: 800,
    swapValue: 750,
    providerDetails: {
      provider: 'Air France',
      confirmationNumber: 'AF456',
      bookingReference: 'REF456',
    },
    verification: {
      status: 'verified',
      verifiedAt: new Date('2024-01-01'),
      documents: ['doc3'],
    },
    blockchain: {
      topicId: 'topic3',
    },
    status: 'available',
    createdAt: new Date('2024-01-03'),
    updatedAt: new Date('2024-01-03'),
  },
];

const defaultProps = {
  bookings: mockBookings,
  userBookings: mockUserBookings,
  loading: false,
  error: undefined,
  onBookingSelect: vi.fn(),
  onSwapProposal: vi.fn(),
  onLoadMore: vi.fn(),
  hasMore: false,
  totalCount: 2,
};

describe('BookingBrowser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the component with bookings', () => {
    render(<BookingBrowser {...defaultProps} />);

    expect(screen.getByText('Browse Available Bookings')).toBeInTheDocument();
    expect(screen.getByText('Luxury Hotel in NYC')).toBeInTheDocument();
    expect(screen.getByText('Concert Tickets')).toBeInTheDocument();
  });

  it('displays the correct booking count', () => {
    render(<BookingBrowser {...defaultProps} />);

    expect(screen.getByText('2 of 2 bookings')).toBeInTheDocument();
  });

  it('handles search functionality', async () => {
    const user = userEvent.setup();
    render(<BookingBrowser {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(
      'Search by title, location, or description...'
    );
    await user.type(searchInput, 'hotel');

    // Should show only the hotel booking
    expect(screen.getByText('Luxury Hotel in NYC')).toBeInTheDocument();
    expect(screen.queryByText('Concert Tickets')).not.toBeInTheDocument();
  });

  it('shows and hides filter panel', async () => {
    const user = userEvent.setup();
    render(<BookingBrowser {...defaultProps} />);

    const filterButton = screen.getByText('Show Filters');
    await user.click(filterButton);

    expect(screen.getByText('Filter Bookings')).toBeInTheDocument();
    expect(screen.getByText('Hide Filters')).toBeInTheDocument();

    await user.click(screen.getByText('Hide Filters'));
    expect(screen.queryByText('Filter Bookings')).not.toBeInTheDocument();
  });

  it('handles sorting functionality', async () => {
    const user = userEvent.setup();
    render(<BookingBrowser {...defaultProps} />);

    const sortSelect = screen.getByDisplayValue('Date Created');
    await user.selectOptions(sortSelect, 'price');

    expect(sortSelect).toHaveValue('price');
  });

  it('toggles sort order', async () => {
    const user = userEvent.setup();
    render(<BookingBrowser {...defaultProps} />);

    // Default is descending, so button should say "Sort ascending"
    const sortOrderButton = screen.getByLabelText('Sort ascending');
    await user.click(sortOrderButton);

    expect(screen.getByLabelText('Sort descending')).toBeInTheDocument();
  });

  it('switches between grid and list view', async () => {
    const user = userEvent.setup();
    render(<BookingBrowser {...defaultProps} />);

    const listViewButton = screen.getByLabelText('List view');
    await user.click(listViewButton);

    // The grid should change to list layout (single column)
    const gridContainer = screen
      .getByText('Luxury Hotel in NYC')
      .closest('[style*="grid-template-columns"]');
    expect(gridContainer).toHaveStyle('grid-template-columns: 1fr');
  });

  it('handles booking selection', async () => {
    const user = userEvent.setup();
    render(<BookingBrowser {...defaultProps} />);

    const viewButton = screen.getAllByText('View Details')[0];
    await user.click(viewButton);

    // Bookings are sorted by creation date descending by default, so the second booking appears first
    expect(defaultProps.onBookingSelect).toHaveBeenCalledWith(mockBookings[1]);
  });

  it('opens swap proposal modal', async () => {
    const user = userEvent.setup();
    render(<BookingBrowser {...defaultProps} />);

    const proposeButtons = screen.getAllByText('Propose Swap');
    // Click the first propose button (which is on a booking card, not the modal title)
    await user.click(proposeButtons[0]);

    // Check that the modal is open by looking for the modal title
    const modalTitles = screen.getAllByText('Propose Swap');
    expect(modalTitles.length).toBeGreaterThan(2); // Should have buttons + modal title
    expect(
      screen.getByText('Create a swap proposal for "Concert Tickets"')
    ).toBeInTheDocument();
  });

  it('handles load more functionality', async () => {
    const user = userEvent.setup();
    const propsWithMore = { ...defaultProps, hasMore: true };
    render(<BookingBrowser {...propsWithMore} />);

    const loadMoreButton = screen.getByText('Load More Bookings');
    await user.click(loadMoreButton);

    expect(defaultProps.onLoadMore).toHaveBeenCalled();
  });

  it('displays loading state', () => {
    render(<BookingBrowser {...defaultProps} loading={true} bookings={[]} />);

    expect(screen.getByText('Loading bookings...')).toBeInTheDocument();
  });

  it('displays error state', () => {
    render(
      <BookingBrowser {...defaultProps} error="Failed to load bookings" />
    );

    expect(screen.getByText('Failed to load bookings')).toBeInTheDocument();
  });

  it('displays empty state when no bookings', () => {
    render(<BookingBrowser {...defaultProps} bookings={[]} />);

    expect(screen.getByText('No bookings found')).toBeInTheDocument();
    expect(
      screen.getByText(
        'There are no available bookings at the moment. Check back later!'
      )
    ).toBeInTheDocument();
  });

  it('displays filtered empty state', async () => {
    const user = userEvent.setup();
    render(<BookingBrowser {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(
      'Search by title, location, or description...'
    );
    await user.type(searchInput, 'nonexistent');

    expect(screen.getByText('No bookings found')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Try adjusting your search or filters to find more results.'
      )
    ).toBeInTheDocument();
  });

  it('clears search when clear button is clicked', async () => {
    const user = userEvent.setup();
    render(<BookingBrowser {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(
      'Search by title, location, or description...'
    );
    await user.type(searchInput, 'hotel');

    const clearButton = screen.getByLabelText('Clear search');
    await user.click(clearButton);

    expect(searchInput).toHaveValue('');
  });

  it('handles infinite scroll', () => {
    const propsWithMore = { ...defaultProps, hasMore: true };
    render(<BookingBrowser {...propsWithMore} />);

    // Simulate scroll to bottom
    Object.defineProperty(window, 'innerHeight', { value: 1000 });
    Object.defineProperty(document.documentElement, 'scrollTop', {
      value: 2000,
    });
    Object.defineProperty(document.documentElement, 'offsetHeight', {
      value: 2500,
    });

    fireEvent.scroll(window);

    expect(defaultProps.onLoadMore).toHaveBeenCalled();
  });

  it('filters bookings by type', async () => {
    const user = userEvent.setup();
    render(<BookingBrowser {...defaultProps} />);

    // Open filters
    await user.click(screen.getByText('Show Filters'));

    // The FilterPanel component would handle the actual filtering
    // This test verifies the integration
    expect(screen.getByText('Filter Bookings')).toBeInTheDocument();
  });

  it('shows loading more indicator', () => {
    render(<BookingBrowser {...defaultProps} loading={true} />);

    expect(screen.getByText('Loading more...')).toBeInTheDocument();
  });

  it('handles proposal submission', async () => {
    const user = userEvent.setup();
    render(<BookingBrowser {...defaultProps} />);

    // Open proposal modal
    const proposeButton = screen.getAllByText('Propose Swap')[0];
    await user.click(proposeButton);

    // The SwapProposalModal would handle the actual submission
    // This test verifies the modal is opened with correct props
    expect(
      screen.getByText('Select one of your bookings to offer in exchange')
    ).toBeInTheDocument();
  });
});
