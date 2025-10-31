import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MyBookingsFilterBar, MyBookingsStatus } from '../MyBookingsFilterBar';

describe('MyBookingsFilterBar', () => {
  const mockBookingCounts = {
    all: 10,
    active: 5,
    with_swaps: 2,
    completed: 2,
    expired: 1,
  };

  const mockOnChange = jest.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it('renders all filter tabs with correct counts', () => {
    render(
      <MyBookingsFilterBar
        currentFilter="all"
        bookingCounts={mockBookingCounts}
        onChange={mockOnChange}
      />
    );

    // Check that all tabs are rendered
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('With Swaps')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Expired')).toBeInTheDocument();

    // Check that counts are displayed
    expect(screen.getByText('10')).toBeInTheDocument(); // All
    expect(screen.getByText('5')).toBeInTheDocument();  // Active
    expect(screen.getByText('2')).toBeInTheDocument();  // With Swaps (appears twice)
    expect(screen.getByText('1')).toBeInTheDocument();  // Expired
  });

  it('displays total booking count in header', () => {
    render(
      <MyBookingsFilterBar
        currentFilter="all"
        bookingCounts={mockBookingCounts}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('10 total bookings')).toBeInTheDocument();
  });

  it('handles singular booking count correctly', () => {
    const singleBookingCounts = {
      all: 1,
      active: 1,
      with_swaps: 0,
      completed: 0,
      expired: 0,
    };

    render(
      <MyBookingsFilterBar
        currentFilter="all"
        bookingCounts={singleBookingCounts}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('1 total booking')).toBeInTheDocument();
  });

  it('calls onChange when a tab is clicked', () => {
    render(
      <MyBookingsFilterBar
        currentFilter="all"
        bookingCounts={mockBookingCounts}
        onChange={mockOnChange}
      />
    );

    fireEvent.click(screen.getByText('Active'));
    expect(mockOnChange).toHaveBeenCalledWith('active');
  });

  it('handles keyboard navigation', () => {
    render(
      <MyBookingsFilterBar
        currentFilter="all"
        bookingCounts={mockBookingCounts}
        onChange={mockOnChange}
      />
    );

    const activeTab = screen.getByText('Active').closest('[role="button"]');
    
    // Test Enter key
    fireEvent.keyDown(activeTab!, { key: 'Enter' });
    expect(mockOnChange).toHaveBeenCalledWith('active');

    mockOnChange.mockClear();

    // Test Space key
    fireEvent.keyDown(activeTab!, { key: ' ' });
    expect(mockOnChange).toHaveBeenCalledWith('active');
  });

  it('applies correct styling to active tab', () => {
    render(
      <MyBookingsFilterBar
        currentFilter="active"
        bookingCounts={mockBookingCounts}
        onChange={mockOnChange}
      />
    );

    const activeTab = screen.getByText('Active').closest('[role="button"]');
    expect(activeTab).toHaveAttribute('aria-pressed', 'true');
  });

  it('provides accessible labels and descriptions', () => {
    render(
      <MyBookingsFilterBar
        currentFilter="all"
        bookingCounts={mockBookingCounts}
        onChange={mockOnChange}
      />
    );

    const allTab = screen.getByLabelText(/All bookings: 10 items. All your bookings/);
    expect(allTab).toBeInTheDocument();

    const activeTab = screen.getByLabelText(/Active bookings: 5 items. Current and upcoming bookings/);
    expect(activeTab).toBeInTheDocument();

    const swapsTab = screen.getByLabelText(/With Swaps bookings: 2 items. Bookings with active swap proposals/);
    expect(swapsTab).toBeInTheDocument();
  });

  it('handles zero counts correctly', () => {
    const zeroBookingCounts = {
      all: 0,
      active: 0,
      with_swaps: 0,
      completed: 0,
      expired: 0,
    };

    render(
      <MyBookingsFilterBar
        currentFilter="all"
        bookingCounts={zeroBookingCounts}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('0 total bookings')).toBeInTheDocument();
    
    // All tabs should show 0
    const badges = screen.getAllByText('0');
    expect(badges).toHaveLength(5); // One for each tab
  });
});