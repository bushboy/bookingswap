import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { BookingOverview } from '../BookingOverview';

describe('BookingOverview', () => {
  const mockBookings = [
    {
      id: '1',
      title: 'Luxury Hotel Paris',
      type: 'hotel' as const,
      location: { city: 'Paris', country: 'France' },
      dateRange: {
        checkIn: new Date('2024-06-15'),
        checkOut: new Date('2024-06-20'),
      },
      status: 'available' as const,
      swapValue: 2500,
    },
    {
      id: '2',
      title: 'Concert Tickets',
      type: 'event' as const,
      location: { city: 'New York', country: 'USA' },
      dateRange: {
        checkIn: new Date('2024-07-10'),
        checkOut: new Date('2024-07-10'),
      },
      status: 'locked' as const,
      swapValue: 800,
    },
    {
      id: '3',
      title: 'Flight to Tokyo',
      type: 'flight' as const,
      location: { city: 'Tokyo', country: 'Japan' },
      dateRange: {
        checkIn: new Date('2024-08-01'),
        checkOut: new Date('2024-08-01'),
      },
      status: 'swapped' as const,
      swapValue: 1200,
    },
  ];

  const mockOnViewAll = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders booking overview with bookings', () => {
    render(
      <BookingOverview bookings={mockBookings} onViewAll={mockOnViewAll} />
    );

    expect(screen.getByText('Your Bookings')).toBeInTheDocument();
    expect(screen.getByText('🏨 Luxury Hotel Paris')).toBeInTheDocument();
    expect(screen.getByText('🎫 Concert Tickets')).toBeInTheDocument();
    expect(screen.getByText('✈️ Flight to Tokyo')).toBeInTheDocument();
  });

  it('displays correct booking details', () => {
    render(
      <BookingOverview bookings={mockBookings} onViewAll={mockOnViewAll} />
    );

    expect(screen.getByText('Paris, France')).toBeInTheDocument();
    expect(screen.getByText('New York, USA')).toBeInTheDocument();
    expect(screen.getByText('Tokyo, Japan')).toBeInTheDocument();

    expect(screen.getByText(/\$2[,\s]?500/)).toBeInTheDocument();
    expect(screen.getByText(/\$800/)).toBeInTheDocument();
    expect(screen.getByText(/\$1[,\s]?200/)).toBeInTheDocument();
  });

  it('displays correct status badges', () => {
    render(
      <BookingOverview bookings={mockBookings} onViewAll={mockOnViewAll} />
    );

    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByText('Locked')).toBeInTheDocument();
    expect(screen.getByText('Swapped')).toBeInTheDocument();
  });

  it('shows view all button with correct count', () => {
    render(
      <BookingOverview bookings={mockBookings} onViewAll={mockOnViewAll} />
    );

    const viewAllButton = screen.getByText('View All (3)');
    expect(viewAllButton).toBeInTheDocument();
  });

  it('calls onViewAll when view all button is clicked', () => {
    render(
      <BookingOverview bookings={mockBookings} onViewAll={mockOnViewAll} />
    );

    const viewAllButton = screen.getByText('View All (3)');
    fireEvent.click(viewAllButton);

    expect(mockOnViewAll).toHaveBeenCalledTimes(1);
  });

  it('renders empty state when no bookings', () => {
    render(<BookingOverview bookings={[]} onViewAll={mockOnViewAll} />);

    expect(screen.getByText('No bookings yet')).toBeInTheDocument();
    expect(screen.getByText('List Your First Booking')).toBeInTheDocument();
    expect(screen.queryByText('View All')).not.toBeInTheDocument();
  });

  it('limits display to 5 bookings', () => {
    const manyBookings = Array.from({ length: 10 }, (_, i) => ({
      id: `${i + 1}`,
      title: `Booking ${i + 1}`,
      type: 'hotel' as const,
      location: { city: 'City', country: 'Country' },
      dateRange: {
        checkIn: new Date('2024-06-15'),
        checkOut: new Date('2024-06-20'),
      },
      status: 'available' as const,
      swapValue: 1000,
    }));

    render(
      <BookingOverview bookings={manyBookings} onViewAll={mockOnViewAll} />
    );

    // Should show "View All (10)" but only display first 5 bookings
    expect(screen.getByText('View All (10)')).toBeInTheDocument();
    expect(screen.getByText(/🏨\s*Booking 1/)).toBeInTheDocument();
    expect(screen.getByText(/🏨\s*Booking 5/)).toBeInTheDocument();
    expect(screen.queryByText(/🏨\s*Booking 6/)).not.toBeInTheDocument();
  });

  it('formats dates correctly', () => {
    render(
      <BookingOverview bookings={mockBookings} onViewAll={mockOnViewAll} />
    );

    expect(screen.getByText('Jun 15, 2024 - Jun 20, 2024')).toBeInTheDocument();
    expect(screen.getByText('Jul 10, 2024 - Jul 10, 2024')).toBeInTheDocument();
  });

  it('displays correct icons for different booking types', () => {
    render(
      <BookingOverview bookings={mockBookings} onViewAll={mockOnViewAll} />
    );

    expect(screen.getByText('🏨 Luxury Hotel Paris')).toBeInTheDocument();
    expect(screen.getByText('🎫 Concert Tickets')).toBeInTheDocument();
    expect(screen.getByText('✈️ Flight to Tokyo')).toBeInTheDocument();
  });
});
