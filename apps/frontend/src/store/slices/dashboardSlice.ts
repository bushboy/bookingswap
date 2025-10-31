import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface DashboardStats {
  activeBookings: number;
  pendingSwaps: number;
  completedSwaps: number;
  totalValue: string;
}

interface Transaction {
  id: string;
  type:
    | 'swap_completed'
    | 'swap_proposed'
    | 'booking_listed'
    | 'swap_rejected'
    | 'swap_cancelled';
  title: string;
  description: string;
  timestamp: Date;
  amount?: number;
  blockchainTxId?: string;
  status: 'completed' | 'pending' | 'failed';
}

interface Notification {
  id: string;
  type:
    | 'swap_proposal'
    | 'swap_accepted'
    | 'swap_rejected'
    | 'swap_completed'
    | 'booking_expired'
    | 'system';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
  priority: 'low' | 'medium' | 'high';
}

interface SwapProposal {
  id: string;
  sourceBookingTitle: string;
  targetBookingTitle: string;
  proposerName: string;
  status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';
  expiresAt: Date;
  additionalPayment?: number;
  isIncoming: boolean;
}

interface DashboardState {
  stats: DashboardStats;
  transactions: Transaction[];
  notifications: Notification[];
  swapProposals: SwapProposal[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

const initialState: DashboardState = {
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

export const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setStats: (state, action: PayloadAction<DashboardStats>) => {
      state.stats = action.payload;
      state.lastUpdated = new Date();
    },
    setTransactions: (state, action: PayloadAction<Transaction[]>) => {
      state.transactions = action.payload;
    },
    addTransaction: (state, action: PayloadAction<Transaction>) => {
      state.transactions.unshift(action.payload);
      // Keep only the latest 50 transactions
      if (state.transactions.length > 50) {
        state.transactions = state.transactions.slice(0, 50);
      }
    },
    setNotifications: (state, action: PayloadAction<Notification[]>) => {
      state.notifications = action.payload;
    },
    addNotification: (state, action: PayloadAction<Notification>) => {
      state.notifications.unshift(action.payload);
      // Keep only the latest 100 notifications
      if (state.notifications.length > 100) {
        state.notifications = state.notifications.slice(0, 100);
      }
    },
    markNotificationAsRead: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find(
        n => n.id === action.payload
      );
      if (notification) {
        notification.read = true;
      }
    },
    markAllNotificationsAsRead: state => {
      state.notifications.forEach(notification => {
        notification.read = true;
      });
    },
    setSwapProposals: (state, action: PayloadAction<SwapProposal[]>) => {
      state.swapProposals = action.payload;
    },
    updateSwapProposal: (state, action: PayloadAction<SwapProposal>) => {
      const index = state.swapProposals.findIndex(
        s => s.id === action.payload.id
      );
      if (index !== -1) {
        state.swapProposals[index] = action.payload;
      }
    },
    removeSwapProposal: (state, action: PayloadAction<string>) => {
      state.swapProposals = state.swapProposals.filter(
        s => s.id !== action.payload
      );
    },
    refreshDashboard: state => {
      state.lastUpdated = new Date();
    },
  },
});

export const {
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
} = dashboardSlice.actions;
