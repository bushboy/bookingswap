import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { tokens } from '../../design-system/tokens';
import { Notification } from '@booking-swap/shared';
import { NotificationService } from '../../services/notificationService';
import {
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  loadMoreNotifications,
} from '../../store/slices/notificationSlice';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onNotificationClick?: (notification: Notification) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  onNotificationClick,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { notifications, unreadCount, loading, hasMore } = useSelector(
    (state: RootState) => state.notifications
  );

  const [filter, setFilter] = useState<'all' | 'unread' | 'swap'>('all');

  useEffect(() => {
    if (isOpen) {
      dispatch(fetchNotifications({ limit: 20 }));
    }
  }, [isOpen, dispatch]);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.readAt) {
      dispatch(markNotificationAsRead(notification.id));
    }
    onNotificationClick?.(notification);

    // Navigate based on notification type
    if (notification.type.startsWith('swap_') && notification.data?.swapId) {
      window.location.href = `/swaps/${notification.data.swapId}`;
    }
  };

  const handleMarkAllAsRead = () => {
    dispatch(markAllNotificationsAsRead());
  };

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      dispatch(loadMoreNotifications());
    }
  };

  const getFilteredNotifications = () => {
    switch (filter) {
      case 'unread':
        return notifications.filter(n => !n.readAt);
      case 'swap':
        return notifications.filter(n => n.type.startsWith('swap_'));
      default:
        return notifications;
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 999,
        }}
        onClick={onClose}
      />

      {/* Notification Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '400px',
          maxWidth: '100vw',
          height: '100vh',
          backgroundColor: tokens.colors.white,
          boxShadow: tokens.shadows.xl,
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: tokens.spacing[4],
            borderBottom: `1px solid ${tokens.colors.neutral[200]}`,
            backgroundColor: tokens.colors.neutral[50],
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: tokens.spacing[3],
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: tokens.typography.fontSize.lg,
                fontWeight: tokens.typography.fontWeight.semibold,
                color: tokens.colors.neutral[900],
              }}
            >
              Notifications
            </h2>

            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: tokens.spacing[1],
                color: tokens.colors.neutral[500],
                fontSize: '20px',
              }}
              aria-label="Close notifications"
            >
              ×
            </button>
          </div>

          {/* Filter Tabs */}
          <div
            style={{
              display: 'flex',
              gap: tokens.spacing[1],
              marginBottom: tokens.spacing[3],
            }}
          >
            {(['all', 'unread', 'swap'] as const).map(filterType => (
              <button
                key={filterType}
                onClick={() => setFilter(filterType)}
                style={{
                  padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                  border: 'none',
                  borderRadius: tokens.borderRadius.md,
                  backgroundColor:
                    filter === filterType
                      ? tokens.colors.primary[500]
                      : 'transparent',
                  color:
                    filter === filterType
                      ? tokens.colors.white
                      : tokens.colors.neutral[600],
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.medium,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  transition: 'all 0.2s ease',
                }}
              >
                {filterType}
                {filterType === 'unread' && unreadCount > 0 && (
                  <span
                    style={{
                      marginLeft: tokens.spacing[1],
                      padding: `2px ${tokens.spacing[1]}`,
                      backgroundColor: tokens.colors.error[500],
                      color: tokens.colors.white,
                      borderRadius: tokens.borderRadius.full,
                      fontSize: tokens.typography.fontSize.xs,
                    }}
                  >
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Mark All as Read */}
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              style={{
                padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                border: `1px solid ${tokens.colors.primary[500]}`,
                borderRadius: tokens.borderRadius.md,
                backgroundColor: 'transparent',
                color: tokens.colors.primary[500],
                fontSize: tokens.typography.fontSize.sm,
                fontWeight: tokens.typography.fontWeight.medium,
                cursor: 'pointer',
                width: '100%',
              }}
            >
              Mark All as Read
            </button>
          )}
        </div>

        {/* Notifications List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: tokens.spacing[2],
          }}
        >
          {loading && notifications.length === 0 ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '200px',
                color: tokens.colors.neutral[500],
              }}
            >
              Loading notifications...
            </div>
          ) : getFilteredNotifications().length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '200px',
                color: tokens.colors.neutral[500],
                textAlign: 'center',
              }}
            >
              <span
                style={{ fontSize: '48px', marginBottom: tokens.spacing[2] }}
              >
                📭
              </span>
              <p>No notifications yet</p>
            </div>
          ) : (
            <>
              {getFilteredNotifications().map(notification => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onClick={() => handleNotificationClick(notification)}
                />
              ))}

              {/* Load More Button */}
              {hasMore && (
                <button
                  onClick={handleLoadMore}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: tokens.spacing[3],
                    border: `1px solid ${tokens.colors.neutral[300]}`,
                    borderRadius: tokens.borderRadius.md,
                    backgroundColor: 'transparent',
                    color: tokens.colors.neutral[600],
                    fontSize: tokens.typography.fontSize.sm,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    marginTop: tokens.spacing[2],
                  }}
                >
                  {loading ? 'Loading...' : 'Load More'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onClick,
}) => {
  const isUnread = !notification.readAt;

  return (
    <div
      onClick={onClick}
      style={{
        padding: tokens.spacing[3],
        marginBottom: tokens.spacing[2],
        border: `1px solid ${tokens.colors.neutral[200]}`,
        borderRadius: tokens.borderRadius.md,
        backgroundColor: isUnread
          ? tokens.colors.primary[50]
          : tokens.colors.white,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        position: 'relative',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.backgroundColor = isUnread
          ? tokens.colors.primary[100]
          : tokens.colors.neutral[50];
      }}
      onMouseLeave={e => {
        e.currentTarget.style.backgroundColor = isUnread
          ? tokens.colors.primary[50]
          : tokens.colors.white;
      }}
    >
      {/* Unread Indicator */}
      {isUnread && (
        <div
          style={{
            position: 'absolute',
            top: tokens.spacing[3],
            right: tokens.spacing[3],
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: tokens.colors.primary[500],
          }}
        />
      )}

      {/* Content */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: tokens.spacing[2],
        }}
      >
        <span style={{ fontSize: '20px', flexShrink: 0 }}>
          {NotificationService.getNotificationIcon(notification.type)}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h4
            style={{
              margin: 0,
              marginBottom: tokens.spacing[1],
              fontSize: tokens.typography.fontSize.sm,
              fontWeight: tokens.typography.fontWeight.semibold,
              color: tokens.colors.neutral[900],
            }}
          >
            {notification.title}
          </h4>

          <p
            style={{
              margin: 0,
              marginBottom: tokens.spacing[2],
              fontSize: tokens.typography.fontSize.sm,
              color: tokens.colors.neutral[700],
              lineHeight: tokens.typography.lineHeight.relaxed,
            }}
          >
            {notification.message}
          </p>

          <div
            style={{
              fontSize: tokens.typography.fontSize.xs,
              color: tokens.colors.neutral[500],
            }}
          >
            {NotificationService.formatNotificationTime(notification.createdAt)}
          </div>
        </div>
      </div>
    </div>
  );
};
