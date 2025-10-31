import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import {
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  loadMoreNotifications,
} from '../../store/slices/notificationSlice';
import { NotificationService } from '../../services/notificationService';
import { Notification } from '@booking-swap/shared';

interface NotificationListProps {
  className?: string;
  maxHeight?: string;
  showMarkAllRead?: boolean;
}

export const NotificationList: React.FC<NotificationListProps> = ({
  className = '',
  maxHeight = '400px',
  showMarkAllRead = true,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { notifications, unreadCount, loading, hasMore } = useSelector(
    (state: RootState) => state.notifications
  );
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    dispatch(fetchNotifications());
  }, [dispatch]);

  const handleMarkAsRead = async (notification: Notification) => {
    if (!notification.readAt) {
      dispatch(markNotificationAsRead(notification.id));
    }
  };

  const handleMarkAllAsRead = () => {
    if (unreadCount > 0) {
      dispatch(markAllNotificationsAsRead());
    }
  };

  const handleLoadMore = async () => {
    if (!loading && hasMore) {
      setLoadingMore(true);
      await dispatch(loadMoreNotifications());
      setLoadingMore(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    return NotificationService.getNotificationIcon(type);
  };

  const getNotificationColor = (type: string) => {
    return NotificationService.getNotificationColor(type);
  };

  const formatTime = (date: Date | string) => {
    return NotificationService.formatNotificationTime(date);
  };

  if (loading && notifications.length === 0) {
    return (
      <div className={`notification-list ${className}`}>
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`notification-list ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">
          Notifications
          {unreadCount > 0 && (
            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
              {unreadCount}
            </span>
          )}
        </h3>
        {showMarkAllRead && unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Notification List */}
      <div className="overflow-y-auto" style={{ maxHeight }}>
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-gray-500">
            <div className="text-4xl mb-2">🔔</div>
            <p className="text-sm">No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {notifications.map(notification => (
              <div
                key={notification.id}
                className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                  !notification.readAt ? 'bg-blue-50' : ''
                }`}
                onClick={() => handleMarkAsRead(notification)}
              >
                <div className="flex items-start space-x-3">
                  {/* Icon */}
                  <div className="flex-shrink-0">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium bg-${getNotificationColor(
                        notification.type
                      )}-500`}
                    >
                      {getNotificationIcon(notification.type)}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {notification.title}
                      </p>
                      <div className="flex items-center space-x-2">
                        {!notification.readAt && (
                          <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                        )}
                        <p className="text-xs text-gray-500 whitespace-nowrap">
                          {formatTime(notification.createdAt)}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {notification.message}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {/* Load More Button */}
            {hasMore && (
              <div className="p-4 text-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                >
                  {loadingMore ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                      Loading...
                    </div>
                  ) : (
                    'Load more'
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
