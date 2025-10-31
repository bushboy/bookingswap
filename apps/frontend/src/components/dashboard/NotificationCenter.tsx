import React, { useState } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { tokens } from '@/design-system/tokens';

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

interface NotificationCenterProps {
  notifications: Notification[];
  onMarkAsRead: (notificationId: string) => void;
  onMarkAllAsRead: () => void;
  onNotificationClick: (notification: Notification) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onNotificationClick,
}) => {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const notificationItemStyles = (notification: Notification) => ({
    display: 'flex',
    alignItems: 'flex-start',
    gap: tokens.spacing[3],
    padding: tokens.spacing[4],
    borderBottom: `1px solid ${tokens.colors.neutral[200]}`,
    backgroundColor: notification.read
      ? 'transparent'
      : tokens.colors.primary[25],
    cursor: 'pointer',
    transition: 'background-color 0.2s ease-in-out',
  });

  const notificationIconStyles = {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: tokens.typography.fontSize.base,
    flexShrink: 0,
  };

  const notificationContentStyles = {
    flex: 1,
    minWidth: 0,
  };

  const notificationTitleStyles = (read: boolean) => ({
    fontSize: tokens.typography.fontSize.base,
    fontWeight: read
      ? tokens.typography.fontWeight.normal
      : tokens.typography.fontWeight.medium,
    color: tokens.colors.neutral[900],
    marginBottom: tokens.spacing[1],
  });

  const notificationMessageStyles = {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.neutral[600],
    marginBottom: tokens.spacing[1],
    lineHeight: tokens.typography.lineHeight.normal,
  };

  const notificationTimeStyles = {
    fontSize: tokens.typography.fontSize.xs,
    color: tokens.colors.neutral[500],
  };

  const priorityIndicatorStyles = (priority: Notification['priority']) => ({
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: getPriorityColor(priority),
    flexShrink: 0,
    marginTop: tokens.spacing[2],
  });

  const filterButtonStyles = (isActive: boolean) => ({
    padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
    fontSize: tokens.typography.fontSize.sm,
    border: `1px solid ${isActive ? tokens.colors.primary[300] : tokens.colors.neutral[300]}`,
    backgroundColor: isActive ? tokens.colors.primary[50] : 'white',
    color: isActive ? tokens.colors.primary[700] : tokens.colors.neutral[600],
    borderRadius: tokens.borderRadius.md,
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
  });

  const emptyStateStyles = {
    textAlign: 'center' as const,
    padding: tokens.spacing[8],
    color: tokens.colors.neutral[500],
  };

  function getNotificationIcon(type: Notification['type']) {
    switch (type) {
      case 'swap_proposal':
        return { icon: '🔄', bg: tokens.colors.primary[100] };
      case 'swap_accepted':
        return { icon: '✅', bg: tokens.colors.success[100] };
      case 'swap_rejected':
        return { icon: '❌', bg: tokens.colors.error[100] };
      case 'swap_completed':
        return { icon: '🎉', bg: tokens.colors.success[100] };
      case 'booking_expired':
        return { icon: '⏰', bg: tokens.colors.warning[100] };
      case 'system':
        return { icon: '🔔', bg: tokens.colors.secondary[100] };
      default:
        return { icon: '📢', bg: tokens.colors.neutral[100] };
    }
  }

  function getPriorityColor(priority: Notification['priority']) {
    switch (priority) {
      case 'high':
        return tokens.colors.error[500];
      case 'medium':
        return tokens.colors.warning[500];
      case 'low':
        return tokens.colors.success[500];
      default:
        return tokens.colors.neutral[400];
    }
  }

  function formatTimestamp(timestamp: Date) {
    const now = new Date();
    const diffInMinutes = Math.floor(
      (now.getTime() - timestamp.getTime()) / (1000 * 60)
    );

    if (diffInMinutes < 1) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }
  }

  const filteredNotifications = notifications.filter(
    notification => filter === 'all' || !notification.read
  );

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <Card variant="outlined">
      <CardHeader>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: tokens.spacing[4],
          }}
        >
          <h2
            style={{
              fontSize: tokens.typography.fontSize.xl,
              fontWeight: tokens.typography.fontWeight.semibold,
              margin: 0,
            }}
          >
            Notifications
            {unreadCount > 0 && (
              <span
                style={{
                  marginLeft: tokens.spacing[2],
                  padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                  borderRadius: tokens.borderRadius.full,
                  fontSize: tokens.typography.fontSize.xs,
                  fontWeight: tokens.typography.fontWeight.medium,
                  backgroundColor: tokens.colors.primary[600],
                  color: 'white',
                }}
              >
                {unreadCount}
              </span>
            )}
          </h2>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={onMarkAllAsRead}>
              Mark All Read
            </Button>
          )}
        </div>
        <div style={{ display: 'flex', gap: tokens.spacing[2] }}>
          <button
            style={filterButtonStyles(filter === 'all')}
            onClick={() => setFilter('all')}
          >
            All ({notifications.length})
          </button>
          <button
            style={filterButtonStyles(filter === 'unread')}
            onClick={() => setFilter('unread')}
          >
            Unread ({unreadCount})
          </button>
        </div>
      </CardHeader>
      <CardContent style={{ padding: 0 }}>
        {filteredNotifications.length === 0 ? (
          <div style={emptyStateStyles}>
            <div
              style={{
                fontSize: tokens.typography.fontSize['2xl'],
                marginBottom: tokens.spacing[2],
              }}
            >
              {filter === 'unread' ? '✨' : '🔔'}
            </div>
            <p>
              {filter === 'unread'
                ? 'All caught up! No unread notifications.'
                : 'No notifications yet'}
            </p>
          </div>
        ) : (
          filteredNotifications.map(notification => {
            const iconData = getNotificationIcon(notification.type);
            return (
              <div
                key={notification.id}
                style={notificationItemStyles(notification)}
                onClick={() => {
                  if (!notification.read) {
                    onMarkAsRead(notification.id);
                  }
                  onNotificationClick(notification);
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = notification.read
                    ? tokens.colors.neutral[50]
                    : tokens.colors.primary[50];
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = notification.read
                    ? 'transparent'
                    : tokens.colors.primary[25];
                }}
              >
                <div
                  style={{
                    ...notificationIconStyles,
                    backgroundColor: iconData.bg,
                  }}
                >
                  {iconData.icon}
                </div>
                <div style={notificationContentStyles}>
                  <div style={notificationTitleStyles(notification.read)}>
                    {notification.title}
                  </div>
                  <div style={notificationMessageStyles}>
                    {notification.message}
                  </div>
                  <div style={notificationTimeStyles}>
                    {formatTimestamp(notification.timestamp)}
                  </div>
                </div>
                <div style={priorityIndicatorStyles(notification.priority)} />
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};
