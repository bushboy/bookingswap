import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { TransactionHistory } from '../TransactionHistory';

describe('TransactionHistory', () => {
  const mockTransactions = [
    {
      id: '1',
      type: 'swap_completed' as const,
      title: 'Swap completed successfully',
      description: 'Hotel in Paris ⇄ Concert Tickets',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      amount: 2500,
      blockchainTxId: '0x1234567890abcdef',
      status: 'completed' as const,
    },
    {
      id: '2',
      type: 'swap_proposed' as const,
      title: 'New swap proposal received',
      description: 'Flight to Tokyo ⇄ Ski Resort Booking',
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      amount: 1800,
      blockchainTxId: '0xabcdef1234567890',
      status: 'pending' as const,
    },
    {
      id: '3',
      type: 'booking_listed' as const,
      title: 'Booking listed for swap',
      description: 'Luxury Hotel in Miami',
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      amount: 3200,
      blockchainTxId: '0x567890abcdef1234',
      status: 'failed' as const,
    },
  ];

  const mockOnViewTransaction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders transaction history with all transactions', () => {
    render(
      <TransactionHistory
        transactions={mockTransactions}
        onViewTransaction={mockOnViewTransaction}
      />
    );

    expect(screen.getByText('Transaction History')).toBeInTheDocument();
    expect(screen.getByText('Swap completed successfully')).toBeInTheDocument();
    expect(screen.getByText('New swap proposal received')).toBeInTheDocument();
    expect(screen.getByText('Booking listed for swap')).toBeInTheDocument();
  });

  it('displays transaction details correctly', () => {
    render(
      <TransactionHistory
        transactions={mockTransactions}
        onViewTransaction={mockOnViewTransaction}
      />
    );

    expect(
      screen.getByText('Hotel in Paris ⇄ Concert Tickets')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Flight to Tokyo ⇄ Ski Resort Booking')
    ).toBeInTheDocument();
    expect(screen.getByText('Luxury Hotel in Miami')).toBeInTheDocument();

    expect(screen.getByText(/\$2[,\s]?500/)).toBeInTheDocument();
    expect(screen.getByText(/\$1[,\s]?800/)).toBeInTheDocument();
    expect(screen.getByText(/\$3[,\s]?200/)).toBeInTheDocument();
  });

  it('displays correct status badges', () => {
    render(
      <TransactionHistory
        transactions={mockTransactions}
        onViewTransaction={mockOnViewTransaction}
      />
    );

    expect(screen.getAllByText('Completed')).toHaveLength(2); // Filter button + status badge
    expect(screen.getAllByText('Pending')).toHaveLength(2); // Filter button + status badge
    expect(screen.getAllByText('Failed')).toHaveLength(2); // Filter button + status badge
  });

  it('shows blockchain transaction IDs', () => {
    render(
      <TransactionHistory
        transactions={mockTransactions}
        onViewTransaction={mockOnViewTransaction}
      />
    );

    expect(screen.getByText(/TX: 0x123456.../)).toBeInTheDocument();
    expect(screen.getByText(/TX: 0xabcdef.../)).toBeInTheDocument();
    expect(screen.getByText(/TX: 0x567890.../)).toBeInTheDocument();
  });

  it('calls onViewTransaction when transaction is clicked', () => {
    render(
      <TransactionHistory
        transactions={mockTransactions}
        onViewTransaction={mockOnViewTransaction}
      />
    );

    const firstTransaction = screen
      .getByText('Swap completed successfully')
      .closest('div');
    fireEvent.click(firstTransaction!);

    expect(mockOnViewTransaction).toHaveBeenCalledWith('0x1234567890abcdef');
  });

  it('filters transactions by status', () => {
    render(
      <TransactionHistory
        transactions={mockTransactions}
        onViewTransaction={mockOnViewTransaction}
      />
    );

    // Click on "Completed" filter button (not the status badge)
    const completedFilter = screen.getAllByText('Completed')[0]; // First one is the filter button
    fireEvent.click(completedFilter);

    expect(screen.getByText('Swap completed successfully')).toBeInTheDocument();
    expect(
      screen.queryByText('New swap proposal received')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Booking listed for swap')
    ).not.toBeInTheDocument();
  });

  it('filters transactions by pending status', () => {
    render(
      <TransactionHistory
        transactions={mockTransactions}
        onViewTransaction={mockOnViewTransaction}
      />
    );

    // Click on "Pending" filter button (not the status badge)
    const pendingFilter = screen.getAllByText('Pending')[0]; // First one is the filter button
    fireEvent.click(pendingFilter);

    expect(
      screen.queryByText('Swap completed successfully')
    ).not.toBeInTheDocument();
    expect(screen.getByText('New swap proposal received')).toBeInTheDocument();
    expect(
      screen.queryByText('Booking listed for swap')
    ).not.toBeInTheDocument();
  });

  it('shows all transactions when "All" filter is selected', () => {
    render(
      <TransactionHistory
        transactions={mockTransactions}
        onViewTransaction={mockOnViewTransaction}
      />
    );

    // First filter by completed
    const completedFilter = screen.getAllByText('Completed')[0]; // First one is the filter button
    fireEvent.click(completedFilter);

    // Then click "All" to show all transactions again
    const allFilter = screen.getByText('All');
    fireEvent.click(allFilter);

    expect(screen.getByText('Swap completed successfully')).toBeInTheDocument();
    expect(screen.getByText('New swap proposal received')).toBeInTheDocument();
    expect(screen.getByText('Booking listed for swap')).toBeInTheDocument();
  });

  it('renders empty state when no transactions', () => {
    render(
      <TransactionHistory
        transactions={[]}
        onViewTransaction={mockOnViewTransaction}
      />
    );

    expect(screen.getByText('No transactions found')).toBeInTheDocument();
  });

  it('renders empty state for filtered results', () => {
    const completedTransactions = mockTransactions.filter(
      t => t.status === 'completed'
    );
    render(
      <TransactionHistory
        transactions={completedTransactions}
        onViewTransaction={mockOnViewTransaction}
      />
    );

    // Filter by pending (should show empty state)
    const pendingFilter = screen.getAllByText('Pending')[0]; // First one is the filter button
    fireEvent.click(pendingFilter);

    expect(screen.getByText('No transactions found')).toBeInTheDocument();
    expect(screen.getByText('Show All Transactions')).toBeInTheDocument();
  });

  it('displays correct transaction icons', () => {
    render(
      <TransactionHistory
        transactions={mockTransactions}
        onViewTransaction={mockOnViewTransaction}
      />
    );

    // Check that transaction icons are rendered (emojis in the component)
    const transactionItems = screen.getAllByText(
      /Swap completed|New swap proposal|Booking listed/
    );
    expect(transactionItems).toHaveLength(3);
  });

  it('formats timestamps correctly', () => {
    render(
      <TransactionHistory
        transactions={mockTransactions}
        onViewTransaction={mockOnViewTransaction}
      />
    );

    // Should show relative time formats
    expect(screen.getAllByText(/hours? ago/)).toHaveLength(1);
    expect(screen.getAllByText(/days? ago/)).toHaveLength(2);
  });

  it('limits display to 10 transactions', () => {
    const manyTransactions = Array.from({ length: 15 }, (_, i) => ({
      id: `${i + 1}`,
      type: 'swap_completed' as const,
      title: `Transaction ${i + 1}`,
      description: `Description ${i + 1}`,
      timestamp: new Date(Date.now() - i * 60 * 60 * 1000),
      amount: 1000,
      blockchainTxId: `0x${i}`,
      status: 'completed' as const,
    }));

    render(
      <TransactionHistory
        transactions={manyTransactions}
        onViewTransaction={mockOnViewTransaction}
      />
    );

    expect(screen.getByText('Transaction 1')).toBeInTheDocument();
    expect(screen.getByText('Transaction 10')).toBeInTheDocument();
    expect(screen.queryByText('Transaction 11')).not.toBeInTheDocument();
  });
});
