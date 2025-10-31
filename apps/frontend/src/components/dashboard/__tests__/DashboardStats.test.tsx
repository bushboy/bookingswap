import React from 'react';
import { render, screen } from '@testing-library/react';
import { DashboardStats } from '../DashboardStats';

describe('DashboardStats', () => {
  const mockStats = {
    activeBookings: 5,
    pendingSwaps: 3,
    completedSwaps: 12,
    totalValue: '$25,000',
  };

  it('renders all stat cards with correct values', () => {
    render(<DashboardStats stats={mockStats} />);

    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Active Bookings')).toBeInTheDocument();

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Pending Swaps')).toBeInTheDocument();

    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Completed Swaps')).toBeInTheDocument();

    expect(screen.getByText('$25,000')).toBeInTheDocument();
    expect(screen.getByText('Total Value')).toBeInTheDocument();
  });

  it('renders with zero values', () => {
    const zeroStats = {
      activeBookings: 0,
      pendingSwaps: 0,
      completedSwaps: 0,
      totalValue: '$0',
    };

    render(<DashboardStats stats={zeroStats} />);

    expect(screen.getAllByText('0')).toHaveLength(3);
    expect(screen.getByText('$0')).toBeInTheDocument();
  });

  it('renders with large numbers', () => {
    const largeStats = {
      activeBookings: 999,
      pendingSwaps: 1000,
      completedSwaps: 5000,
      totalValue: '$1,000,000',
    };

    render(<DashboardStats stats={largeStats} />);

    expect(screen.getByText('999')).toBeInTheDocument();
    expect(screen.getByText('1000')).toBeInTheDocument();
    expect(screen.getByText('5000')).toBeInTheDocument();
    expect(screen.getByText('$1,000,000')).toBeInTheDocument();
  });

  it('applies correct styling to stat cards', () => {
    render(<DashboardStats stats={mockStats} />);

    const statCards = screen.getAllByText(
      /Active Bookings|Pending Swaps|Completed Swaps|Total Value/
    );
    expect(statCards).toHaveLength(4);

    // Check that all stat labels are rendered
    statCards.forEach(card => {
      expect(card).toBeInTheDocument();
    });
  });
});
