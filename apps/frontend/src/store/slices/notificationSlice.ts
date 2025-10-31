import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Notification } from '@booking-swap/shared';
import { NotificationService } from '../../services/notificationService';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  total: number;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
}

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  total: 0,
  loading: false,
  error: null,
  hasMore: true,
};

const notificationService = NotificationService.getInstance();

// Async thunks
export const fetchNotifications = createAsyncThunk(
  'notifications/fetchNotifications',
  async (
    options: { limit?: number; offset?: number; unreadOnly?: boolean } = {}
  ) => {
    return await notificationService.getNotifications(options);
  }
);

export const fetchUnreadCount = createAsyncThunk(
  'notifications/fetchUnreadCount',
  async () => {
    return await notificationService.getUnreadCount();
  }
);

export const markNotificationAsRead = createAsyncThunk(
  'notifications/markAsRead',
  async (notificationId: string) => {
    await notificationService.markAsRead(notificationId);
    return notificationId;
  }
);

export const markAllNotificationsAsRead = createAsyncThunk(
  'notifications/markAllAsRead',
  async () => {
    await notificationService.markAllAsRead();
  }
);

export const loadMoreNotifications = createAsyncThunk(
  'notifications/loadMore',
  async (_, { getState }) => {
    const state = getState() as { notifications: NotificationState };
    const offset = state.notifications.notifications.length;
    return await notificationService.getNotifications({ offset, limit: 20 });
  }
);

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    addNotification: (state, action: PayloadAction<Notification>) => {
      // Add new notification to the beginning of the list
      state.notifications.unshift(action.payload);
      state.total += 1;

      // Update unread count if notification is unread
      if (!action.payload.readAt) {
        state.unreadCount += 1;
      }
    },

    updateNotificationStatus: (
      state,
      action: PayloadAction<{ id: string; status: string; readAt?: Date }>
    ) => {
      const notification = state.notifications.find(
        n => n.id === action.payload.id
      );
      if (notification) {
        notification.status = action.payload.status as any;
        if (action.payload.readAt) {
          notification.readAt = action.payload.readAt;
          // Decrease unread count if notification was previously unread
          if (!notification.readAt) {
            state.unreadCount = Math.max(0, state.unreadCount - 1);
          }
        }
      }
    },

    clearNotifications: state => {
      state.notifications = [];
      state.unreadCount = 0;
      state.total = 0;
      state.hasMore = true;
    },

    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },

    clearError: state => {
      state.error = null;
    },
  },
  extraReducers: builder => {
    builder
      // Fetch notifications
      .addCase(fetchNotifications.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.notifications = action.payload.notifications;
        state.unreadCount = action.payload.unreadCount;
        state.total = action.payload.total;
        state.hasMore = action.payload.notifications.length === 20; // Assuming 20 is the default limit
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch notifications';
      })

      // Fetch unread count
      .addCase(fetchUnreadCount.fulfilled, (state, action) => {
        state.unreadCount = action.payload;
      })

      // Mark as read
      .addCase(markNotificationAsRead.fulfilled, (state, action) => {
        const notification = state.notifications.find(
          n => n.id === action.payload
        );
        if (notification && !notification.readAt) {
          notification.readAt = new Date();
          notification.status = 'read';
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      })

      // Mark all as read
      .addCase(markAllNotificationsAsRead.fulfilled, state => {
        state.notifications.forEach(notification => {
          if (!notification.readAt) {
            notification.readAt = new Date();
            notification.status = 'read';
          }
        });
        state.unreadCount = 0;
      })

      // Load more notifications
      .addCase(loadMoreNotifications.pending, state => {
        state.loading = true;
      })
      .addCase(loadMoreNotifications.fulfilled, (state, action) => {
        state.loading = false;
        const newNotifications = action.payload.notifications.filter(
          newNotif =>
            !state.notifications.some(existing => existing.id === newNotif.id)
        );
        state.notifications.push(...newNotifications);
        state.hasMore = newNotifications.length === 20;
      })
      .addCase(loadMoreNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.error.message || 'Failed to load more notifications';
      });
  },
});

export const {
  addNotification,
  updateNotificationStatus,
  clearNotifications,
  setError,
  clearError,
} = notificationSlice.actions;

export default notificationSlice.reducer;
