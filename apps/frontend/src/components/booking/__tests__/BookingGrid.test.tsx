import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BookingGrid } from '../BookingGrid';
import { Booking } from '@booking-swap/shared';

const mockBookings: Booking[] = [
  {
    id: '1',
    userId: 'user1',
    type: 'hotel',
    title: 'Hotel Paris',
    description: 'Nice hotel',
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
      bookingReference: 'REF456',
    },
    verification: { status: 'verified', documents: [] },
    blockchain: { transactionId: 'tx1', topicId: 'topic1' },
    status: 'available',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '2',
    userId: 'user2',
    type: 'event',
    title: 'Concert Tickets',
    description: 'Great concert',
    location: { city: 'London', country: 'UK' },
    dateRange: {
      checkIn: new Date('2024-07-01'),
      checkOut: new Date('2024-07-01'),
    },
    originalPrice: 200,
    swapValue: 180,
    providerDetails: {
      provider: 'Ticketmaster',
      confirmationNumber: 'DEF789',
      bookingReference: 'REF123',
    },
    verification: { status: 'pending', documents: [] },
    blockchain: { transactionId: 'tx2', topicId: 'topic2' },
    status: 'available',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe('BookingGrid', () => {
  const mockOnViewDetails = vi.fn();
  const mockOnProposeSwap = vi.fn();

  beforeEach(() => {
    mockOnViewDetails.mockClear();
    mockOnProposeSwap.mockClear();
  });

  it('renders booking cards when bookings are provided', () => {
    render(
      <BookingGrid
        bookings={mockBookings}
        onViewDetails={mockOnViewDetails}
        onProposeSwap={mockOnProposeSwap}
      />
    );

    expect(screen.getByText('Hotel Paris')).toBeInTheDocument();
    expect(screen.getByText('Concert Tickets')).toBeInTheDocument();
    expect(screen.getByText('2 bookings found')).toBeInTheDocument();
  });

  it('shows loading skeletons when loading', () => {
    render(
      <BookingGrid
        bookings={[]}
        loading={true}
        onViewDetails={mockOnViewDetails}
        onProposeSwap={mockOnProposeSwap}
      />
    );

    // Should show skeleton loaders (we can't easily test the animation, but we can check structure)
    const skeletons = document.querySelectorAll('[style*="pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty state when no bookings are found', () => {
    render(
      <BookingGrid
        bookings={[]}
        onViewDetails={mockOnViewDetails}
        onProposeSwap={mockOnProposeSwap}
      />
    );

    expect(screen.getByText('No bookings found')).toBeInTheDocument();
    expect(
      screen.getByText(/try adjusting your search filters/i)
    ).toBeInTheDocument();
    expect(screen.getByText('🔍')).toBeInTheDocument();
  });

  it('shows custom empty message when provided', () => {
    const customMessage = 'No results for your search criteria';

    render(
      <BookingGrid
        bookings={[]}
        onViewDetails={mockOnViewDetails}
        onProposeSwap={mockOnProposeSwap}
        emptyMessage={customMessage}
      />
    );

    expect(screen.getByText(customMessage)).toBeInTheDocument();
  });

  it('shows correct count for single booking', () => {
    render(
      <BookingGrid
        bookings={[mockBookings[0]]}
        onViewDetails={mockOnViewDetails}
        onProposeSwap={mockOnProposeSwap}
      />
    );

    expect(screen.getByText('1 booking found')).toBeInTheDocument();
  });

  it('shows correct count for multiple bookings', () => {
    render(
      <BookingGrid
        bookings={mockBookings}
        onViewDetails={mockOnViewDetails}
        onProposeSwap={mockOnProposeSwap}
      />
    );

    expect(screen.getByText('2 bookings found')).toBeInTheDocument();
  });

  it('displays "Available Bookings" header when bookings exist', () => {
    render(
      <BookingGrid
        bookings={mockBookings}
        onViewDetails={mockOnViewDetails}
        onProposeSwap={mockOnProposeSwap}
      />
    );

    expect(screen.getByText('Available Bookings')).toBeInTheDocument();
  });

  it('does not show header when no bookings exist', () => {
    render(
      <BookingGrid
        bookings={[]}
        onViewDetails={mockOnViewDetails}
        onProposeSwap={mockOnProposeSwap}
      />
    );

    expect(screen.queryByText('Available Bookings')).not.toBeInTheDocument();
  });

  it('renders booking cards in a grid layout', () => {
    render(
      <BookingGrid
        bookings={mockBookings}
        onViewDetails={mockOnViewDetails}
        onProposeSwap={mockOnProposeSwap}
      />
    );

    // Check that both booking titles are present (indicating cards are rendered)
    expect(screen.getByText('Hotel Paris')).toBeInTheDocument();
    expect(screen.getByText('Concert Tickets')).toBeInTheDocument();

    // Check that the grid container exists with proper styling
    const gridContainer = screen
      .getByText('Hotel Paris')
      .closest('[style*="grid"]');
    expect(gridContainer).toBeInTheDocument();
  });
});
