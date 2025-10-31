import {
  dashboardSlice,
  setLoading,
  setError,
  setStats,
  setTransactions,
  addTransaction,
  setNotifications,
  addNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  setSwapProposals,
  updateSwapProposal,
  removeSwapProposal,
  refreshDashboard,
} from '../dashboardSlice';

describe('dashboardSlice', () => {
  const initialState = {
    stats: {
      activeBookings: 0,
      pendingSwaps: 0,
      completedSwaps: 0,
      totalValue: '$0',
    },
    transactions: [],
    notifications: [],
    swapProposals: [],
    loading: false,
    error: null,
    lastUpdated: null,
  };

  it('should return the initial state', () => {
    expect(dashboardSlice.reducer(undefined, { type: 'unknown' })).toEqual(
      initialState
    );
  });

  it('should handle setLoading', () => {
    const actual = dashboardSlice.reducer(initialState, setLoading(true));
    expect(actual.loading).toBe(true);
  });

  it('should handle setError', () => {
    const errorMessage = 'Something went wrong';
    const actual = dashboardSlice.reducer(initialState, setError(errorMessage));
    expect(actual.error).toBe(errorMessage);
  });

  it('should handle setStats', () => {
    const stats = {
      activeBookings: 5,
      pendingSwaps: 3,
      completedSwaps: 12,
      totalValue: '$25,000',
    };
    const actual = dashboardSlice.reducer(initialState, setStats(stats));
    expect(actual.stats).toEqual(stats);
    expect(actual.lastUpdated).toBeInstanceOf(Date);
  });

  it('should handle setTransactions', () => {
    const transactions = [
      {
        id: '1',
        type: 'swap_completed' as const,
        title: 'Swap completed',
        description: 'Test swap',
        timestamp: new Date(),
        amount: 1000,
        blockchainTxId: '0x123',
        status: 'completed' as const,
      },
    ];
    const actual = dashboardSlice.reducer(
      initialState,
      setTransactions(transactions)
    );
    expect(actual.transactions).toEqual(transactions);
  });

  it('should handle addTransaction', () => {
    const existingTransaction = {
      id: '1',
      type: 'swap_completed' as const,
      title: 'Existing swap',
      description: 'Test swap',
      timestamp: new Date(),
      amount: 1000,
      blockchainTxId: '0x123',
      status: 'completed' as const,
    };
    const stateWithTransaction = {
      ...initialState,
      transactions: [existingTransaction],
    };

    const newTransaction = {
      id: '2',
      type: 'swap_proposed' as const,
      title: 'New swap',
      description: 'New test swap',
      timestamp: new Date(),
      amount: 2000,
      blockchainTxId: '0x456',
      status: 'pending' as const,
    };

    const actual = dashboardSlice.reducer(
      stateWithTransaction,
      addTransaction(newTransaction)
    );
    expect(actual.transactions).toHaveLength(2);
    expect(actual.transactions[0]).toEqual(newTransaction); // New transaction should be first
    expect(actual.transactions[1]).toEqual(existingTransaction);
  });

  it('should limit transactions to 50 when adding new ones', () => {
    const manyTransactions = Array.from({ length: 50 }, (_, i) => ({
      id: `${i + 1}`,
      type: 'swap_completed' as const,
      title: `Transaction ${i + 1}`,
      description: 'Test',
      timestamp: new Date(),
      amount: 1000,
      blockchainTxId: `0x${i}`,
      status: 'completed' as const,
    }));

    const stateWithManyTransactions = {
      ...initialState,
      transactions: manyTransactions,
    };

    const newTransaction = {
      id: '51',
      type: 'swap_proposed' as const,
      title: 'New transaction',
      description: 'Test',
      timestamp: new Date(),
      amount: 1000,
      blockchainTxId: '0x51',
      status: 'pending' as const,
    };

    const actual = dashboardSlice.reducer(
      stateWithManyTransactions,
      addTransaction(newTransaction)
    );
    expect(actual.transactions).toHaveLength(50);
    expect(actual.transactions[0]).toEqual(newTransaction);
    expect(actual.transactions[49].id).toBe('49'); // Last transaction should be removed
  });

  it('should handle setNotifications', () => {
    const notifications = [
      {
        id: '1',
        type: 'swap_proposal' as const,
        title: 'New proposal',
        message: 'Test message',
        timestamp: new Date(),
        read: false,
        priority: 'high' as const,
      },
    ];
    const actual = dashboardSlice.reducer(
      initialState,
      setNotifications(notifications)
    );
    expect(actual.notifications).toEqual(notifications);
  });

  it('should handle addNotification', () => {
    const newNotification = {
      id: '1',
      type: 'swap_proposal' as const,
      title: 'New proposal',
      message: 'Test message',
      timestamp: new Date(),
      read: false,
      priority: 'high' as const,
    };

    const actual = dashboardSlice.reducer(
      initialState,
      addNotification(newNotification)
    );
    expect(actual.notifications).toHaveLength(1);
    expect(actual.notifications[0]).toEqual(newNotification);
  });

  it('should limit notifications to 100 when adding new ones', () => {
    const manyNotifications = Array.from({ length: 100 }, (_, i) => ({
      id: `${i + 1}`,
      type: 'swap_proposal' as const,
      title: `Notification ${i + 1}`,
      message: 'Test',
      timestamp: new Date(),
      read: false,
      priority: 'medium' as const,
    }));

    const stateWithManyNotifications = {
      ...initialState,
      notifications: manyNotifications,
    };

    const newNotification = {
      id: '101',
      type: 'swap_completed' as const,
      title: 'New notification',
      message: 'Test',
      timestamp: new Date(),
      read: false,
      priority: 'high' as const,
    };

    const actual = dashboardSlice.reducer(
      stateWithManyNotifications,
      addNotification(newNotification)
    );
    expect(actual.notifications).toHaveLength(100);
    expect(actual.notifications[0]).toEqual(newNotification);
    expect(actual.notifications[99].id).toBe('99'); // Last notification should be removed
  });

  it('should handle markNotificationAsRead', () => {
    const notifications = [
      {
        id: '1',
        type: 'swap_proposal' as const,
        title: 'Unread notification',
        message: 'Test message',
        timestamp: new Date(),
        read: false,
        priority: 'high' as const,
      },
      {
        id: '2',
        type: 'swap_completed' as const,
        title: 'Another notification',
        message: 'Test message',
        timestamp: new Date(),
        read: false,
        priority: 'medium' as const,
      },
    ];

    const stateWithNotifications = {
      ...initialState,
      notifications,
    };

    const actual = dashboardSlice.reducer(
      stateWithNotifications,
      markNotificationAsRead('1')
    );
    expect(actual.notifications[0].read).toBe(true);
    expect(actual.notifications[1].read).toBe(false);
  });

  it('should handle markAllNotificationsAsRead', () => {
    const notifications = [
      {
        id: '1',
        type: 'swap_proposal' as const,
        title: 'Unread notification 1',
        message: 'Test message',
        timestamp: new Date(),
        read: false,
        priority: 'high' as const,
      },
      {
        id: '2',
        type: 'swap_completed' as const,
        title: 'Unread notification 2',
        message: 'Test message',
        timestamp: new Date(),
        read: false,
        priority: 'medium' as const,
      },
    ];

    const stateWithNotifications = {
      ...initialState,
      notifications,
    };

    const actual = dashboardSlice.reducer(
      stateWithNotifications,
      markAllNotificationsAsRead()
    );
    expect(actual.notifications[0].read).toBe(true);
    expect(actual.notifications[1].read).toBe(true);
  });

  it('should handle setSwapProposals', () => {
    const swapProposals = [
      {
        id: '1',
        sourceBookingTitle: 'Hotel A',
        targetBookingTitle: 'Hotel B',
        proposerName: 'John Doe',
        status: 'pending' as const,
        expiresAt: new Date(),
        isIncoming: true,
      },
    ];

    const actual = dashboardSlice.reducer(
      initialState,
      setSwapProposals(swapProposals)
    );
    expect(actual.swapProposals).toEqual(swapProposals);
  });

  it('should handle updateSwapProposal', () => {
    const swapProposals = [
      {
        id: '1',
        sourceBookingTitle: 'Hotel A',
        targetBookingTitle: 'Hotel B',
        proposerName: 'John Doe',
        status: 'pending' as const,
        expiresAt: new Date(),
        isIncoming: true,
      },
    ];

    const stateWithSwaps = {
      ...initialState,
      swapProposals,
    };

    const updatedSwap = {
      ...swapProposals[0],
      status: 'accepted' as const,
    };

    const actual = dashboardSlice.reducer(
      stateWithSwaps,
      updateSwapProposal(updatedSwap)
    );
    expect(actual.swapProposals[0].status).toBe('accepted');
  });

  it('should handle removeSwapProposal', () => {
    const swapProposals = [
      {
        id: '1',
        sourceBookingTitle: 'Hotel A',
        targetBookingTitle: 'Hotel B',
        proposerName: 'John Doe',
        status: 'pending' as const,
        expiresAt: new Date(),
        isIncoming: true,
      },
      {
        id: '2',
        sourceBookingTitle: 'Hotel C',
        targetBookingTitle: 'Hotel D',
        proposerName: 'Jane Doe',
        status: 'pending' as const,
        expiresAt: new Date(),
        isIncoming: false,
      },
    ];

    const stateWithSwaps = {
      ...initialState,
      swapProposals,
    };

    const actual = dashboardSlice.reducer(
      stateWithSwaps,
      removeSwapProposal('1')
    );
    expect(actual.swapProposals).toHaveLength(1);
    expect(actual.swapProposals[0].id).toBe('2');
  });

  it('should handle refreshDashboard', () => {
    const actual = dashboardSlice.reducer(initialState, refreshDashboard());
    expect(actual.lastUpdated).toBeInstanceOf(Date);
  });
});
