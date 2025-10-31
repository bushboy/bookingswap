import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AdminDashboard } from '../AdminDashboard';
import { adminService } from '../../../services/adminService';

// Mock the admin service
jest.mock('../../../services/adminService');

const mockAdminService = adminService as jest.Mocked<typeof adminService>;

describe('AdminDashboard', () => {
  const mockStatistics = {
    users: {
      total: 1000,
      active: 750,
      verified: 500,
      flagged: 10,
    },
    bookings: {
      total: 2500,
      available: 1200,
      swapped: 1100,
      cancelled: 200,
    },
    swaps: {
      total: 1500,
      pending: 50,
      completed: 1100,
      rejected: 350,
    },
    blockchain: {
      totalTransactions: 15420,
      failedTransactions: 23,
      averageTransactionTime: 3.2,
    },
    revenue: {
      totalVolume: 2450000,
      platformFees: 24500,
      monthlyGrowth: 15.3,
    },
  };

  const mockRecentActivity = [
    {
      id: 'swap1',
      type: 'swap',
      status: 'completed',
      sourceBooking: { id: 'booking1', title: 'Hotel Booking' },
      targetBooking: { id: 'booking2', title: 'Flight Booking' },
      proposer: { id: 'user1', name: 'John Doe' },
      owner: { id: 'user2', name: 'Jane Smith' },
      updatedAt: '2024-02-15T10:30:00Z',
    },
    {
      id: 'swap2',
      type: 'swap',
      status: 'pending',
      sourceBooking: { id: 'booking3', title: 'Concert Tickets' },
      targetBooking: { id: 'booking4', title: 'Theater Show' },
      proposer: { id: 'user3', name: 'Bob Wilson' },
      owner: { id: 'user4', name: 'Alice Brown' },
      updatedAt: '2024-02-15T09:15:00Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render loading state initially', () => {
    mockAdminService.getStatistics.mockImplementation(
      () => new Promise(() => {})
    );
    mockAdminService.getRecentActivity.mockImplementation(
      () => new Promise(() => {})
    );

    render(<AdminDashboard />);

    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
  });

  it('should render dashboard with statistics and activity', async () => {
    mockAdminService.getStatistics.mockResolvedValue({ data: mockStatistics });
    mockAdminService.getRecentActivity.mockResolvedValue({
      data: mockRecentActivity,
    });

    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Platform Overview')).toBeInTheDocument();
    });

    // Check user statistics
    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText('1,000')).toBeInTheDocument();
    expect(screen.getByText('Active Users')).toBeInTheDocument();
    expect(screen.getByText('750')).toBeInTheDocument();

    // Check booking statistics
    expect(screen.getByText('Total Bookings')).toBeInTheDocument();
    expect(screen.getByText('2,500')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByText('1,200')).toBeInTheDocument();

    // Check swap statistics
    expect(screen.getByText('Total Swaps')).toBeInTheDocument();
    expect(screen.getByText('1,500')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();

    // Check recent activity
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(
      screen.getByText('Hotel Booking ↔ Flight Booking')
    ).toBeInTheDocument();
  });

  it('should handle error state', async () => {
    mockAdminService.getStatistics.mockRejectedValue(new Error('API Error'));
    mockAdminService.getRecentActivity.mockRejectedValue(
      new Error('API Error')
    );

    render(<AdminDashboard />);

    await waitFor(() => {
      expect(
        screen.getByText('Failed to load dashboard data')
      ).toBeInTheDocument();
    });

    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('should retry loading data when retry button is clicked', async () => {
    mockAdminService.getStatistics.mockRejectedValueOnce(
      new Error('API Error')
    );
    mockAdminService.getRecentActivity.mockRejectedValueOnce(
      new Error('API Error')
    );

    render(<AdminDashboard />);

    await waitFor(() => {
      expect(
        screen.getByText('Failed to load dashboard data')
      ).toBeInTheDocument();
    });

    // Mock successful retry
    mockAdminService.getStatistics.mockResolvedValue({ data: mockStatistics });
    mockAdminService.getRecentActivity.mockResolvedValue({
      data: mockRecentActivity,
    });

    const retryButton = screen.getByText('Retry');
    retryButton.click();

    await waitFor(() => {
      expect(screen.getByText('Platform Overview')).toBeInTheDocument();
    });
  });

  it('should display correct status colors for activities', async () => {
    mockAdminService.getStatistics.mockResolvedValue({ data: mockStatistics });
    mockAdminService.getRecentActivity.mockResolvedValue({
      data: mockRecentActivity,
    });

    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    });

    // Check status badges
    const completedBadge = screen.getByText('completed');
    const pendingBadge = screen.getByText('pending');

    expect(completedBadge).toHaveClass('bg-green-100', 'text-green-800');
    expect(pendingBadge).toHaveClass('bg-yellow-100', 'text-yellow-800');
  });

  it('should format numbers correctly', async () => {
    mockAdminService.getStatistics.mockResolvedValue({ data: mockStatistics });
    mockAdminService.getRecentActivity.mockResolvedValue({
      data: mockRecentActivity,
    });

    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Platform Overview')).toBeInTheDocument();
    });

    // Check that large numbers are formatted with commas
    expect(screen.getByText('2,450,000')).toBeInTheDocument(); // Total volume
    expect(screen.getByText('15,420')).toBeInTheDocument(); // Total transactions
  });

  it('should display blockchain and revenue statistics', async () => {
    mockAdminService.getStatistics.mockResolvedValue({ data: mockStatistics });
    mockAdminService.getRecentActivity.mockResolvedValue({
      data: mockRecentActivity,
    });

    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Blockchain')).toBeInTheDocument();
      expect(screen.getByText('Revenue')).toBeInTheDocument();
    });

    // Check blockchain stats
    expect(screen.getByText('15,420')).toBeInTheDocument(); // Total transactions
    expect(screen.getByText('23')).toBeInTheDocument(); // Failed transactions
    expect(screen.getByText('3')).toBeInTheDocument(); // Avg transaction time (rounded)

    // Check revenue stats
    expect(screen.getByText('2,450,000')).toBeInTheDocument(); // Total volume
    expect(screen.getByText('24,500')).toBeInTheDocument(); // Platform fees
    expect(screen.getByText('15')).toBeInTheDocument(); // Monthly growth (rounded)
  });
});
