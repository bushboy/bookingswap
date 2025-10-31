import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingList } from '../BookingList';
import { Booking, BookingType, BookingStatus } from '@booking-swap/shared';

// Mock the BookingSearch component
vi.mock('../BookingSearch', () => ({
  BookingSearch: ({ onSearch }: { onSearch: (filters: any) => void }) => (
    <div data-testid="booking-search">
      <button
        onClick={() =>
          onSearch({
            query: 'test',
            location: '',
            type: 'all',
            minPrice: 0,
            maxPrice: 10000,
            dateFrom: '',
            dateTo: '',
          })
        }
      >
        Search
      </button>
    </div>
  ),
}));

const mockBookings: Booking[] = [
  {
    id: '1',
    userId: 'user1',
    type: 'hotel' as BookingType,
    title: 'Luxury Hotel Paris',
    description: 'Beautiful hotel in the heart of Paris',
    location: { city: 'Paris', country: 'France' },
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
  },
  {
    id: '2',
    userId: 'user2',
    type: 'event' as BookingType,
    title: 'Concert Tickets',
    description: 'Amazing concert in London',
    location: { city: 'London', country: 'UK' },
    dateRange: {
      checkIn: new Date('2024-07-01'),
      checkOut: new Date('2024-07-01'),
    },
    originalPrice: 200,
    swapValue: 180,
    providerDetails: {
      provider: 'Ticketmaster',
      confirmationNumber: 'DEF456',
      bookingReference: 'REF456',
    },
    verification: { status: 'pending', documents: [] },
    blockchain: { topicId: 'topic2' },
    status: 'locked' as BookingStatus,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const defaultProps = {
  bookings: mockBookings,
  onViewDetails: vi.fn(),
  onProposeSwap: vi.fn(),
  onEditBooking: vi.fn(),
  onDeleteBooking: vi.fn(),
  onCreateSwap: vi.fn(),
};

describe('BookingList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders booking list with search and filters', () => {
    render(<BookingList {...defaultProps} />);

    expect(screen.getByTestId('booking-search')).toBeInTheDocument();
    expect(screen.getByText('Available Bookings')).toBeInTheDocument();
    expect(screen.getByText('2 bookings found')).toBeInTheDocument();
  });

  it('displays bookings in grid view by default', () => {
    render(<BookingList {...defaultProps} />);

    expect(screen.getByText('Luxury Hotel Paris')).toBeInTheDocument();
    expect(screen.getByText('Concert Tickets')).toBeInTheDocument();
  });

  it('filters bookings by status', async () => {
    const user = userEvent.setup();
    render(<BookingList {...defaultProps} />);

    // Click on "Available" status filter
    const availableFilter = screen.getByText('Available');
    await user.click(availableFilter);

    // Should show only available bookings
    expect(screen.getByText('Luxury Hotel Paris')).toBeInTheDocument();
    expect(screen.queryByText('Concert Tickets')).not.toBeInTheDocument();
  });

  it('sorts bookings by different criteria', async () => {
    const user = userEvent.setup();
    render(<BookingList {...defaultProps} />);

    // Change sort to price
    const sortSelect = screen.getByDisplayValue('Date');
    await user.selectOptions(sortSelect, 'price');

    expect(sortSelect).toHaveValue('price');
  });

  it('toggles between grid and list view', async () => {
    const user = userEvent.setup();
    render(<BookingList {...defaultProps} />);

    // Click list view button
    const listViewButton = screen.getByTitle('List view');
    await user.click(listViewButton);

    // Verify list view is active (button should be highlighted)
    expect(listViewButton).toHaveStyle({ backgroundColor: expect.any(String) });
  });

  it('handles pagination correctly', () => {
    // Create more bookings to test pagination
    const manyBookings = Array.from({ length: 25 }, (_, i) => ({
      ...mockBookings[0],
      id: `booking-${i}`,
      title: `Booking ${i}`,
    }));

    render(<BookingList {...defaultProps} bookings={manyBookings} />);

    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('shows empty state when no bookings match filters', () => {
    render(<BookingList {...defaultProps} bookings={[]} />);

    expect(screen.getByText('No bookings found')).toBeInTheDocument();
    expect(
      screen.getByText('No bookings found. Try adjusting your search filters.')
    ).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<BookingList {...defaultProps} loading={true} />);

    // Should show loading skeletons
    const skeletons = screen.getAllByRole('generic');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('handles booking actions correctly', async () => {
    const user = userEvent.setup();
    render(<BookingList {...defaultProps} variant="own" />);

    // Click view details on first booking
    const viewButtons = screen.getAllByText('View Details');
    await user.click(viewButtons[0]);

    expect(defaultProps.onViewDetails).toHaveBeenCalledWith('1');
  });

  it('shows different actions based on variant', () => {
    const { rerender } = render(
      <BookingList {...defaultProps} variant="own" />
    );

    // In "own" variant, should show Edit and Create Swap buttons
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Create Swap')).toBeInTheDocument();

    // In "browse" variant, should show Propose Swap button
    rerender(<BookingList {...defaultProps} variant="browse" />);
    expect(screen.getByText('Propose Swap')).toBeInTheDocument();
  });

  it('handles search filters correctly', async () => {
    const user = userEvent.setup();
    render(<BookingList {...defaultProps} />);

    // Trigger search
    const searchButton = screen.getByText('Search');
    await user.click(searchButton);

    // Should filter bookings (mocked search returns test query)
    await waitFor(() => {
      expect(screen.getByText('0 bookings found')).toBeInTheDocument();
    });
  });

  it('supports keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<BookingList {...defaultProps} />);

    // Find the first booking card
    const bookingCard = screen.getByLabelText(
      /hotel booking: Luxury Hotel Paris/i
    );

    // Focus and press Enter
    bookingCard.focus();
    await user.keyboard('{Enter}');

    expect(defaultProps.onViewDetails).toHaveBeenCalledWith('1');
  });

  it('shows correct booking count and pagination info', () => {
    render(<BookingList {...defaultProps} />);

    expect(screen.getByText('2 bookings found')).toBeInTheDocument();
  });

  it('handles sort order toggle', async () => {
    const user = userEvent.setup();
    render(<BookingList {...defaultProps} />);

    // Click sort order toggle button
    const sortOrderButton = screen.getByTitle('Sort descending');
    await user.click(sortOrderButton);

    expect(screen.getByTitle('Sort ascending')).toBeInTheDocument();
  });
});
