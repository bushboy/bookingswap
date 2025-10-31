import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { tokens } from '../../design-system/tokens';
import { Notification } from '@booking-swap/shared';
import { NotificationToast } from './NotificationToast';
import { notificationPersistenceService } from '../../services/notificationPersistenceService';

interface ToastContainerProps {
  maxToasts?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  maxToasts = 3,
  position = 'top-right',
}) => {
  const [activeToasts, setActiveToasts] = useState<Notification[]>([]);
  const { notifications } = useSelector(
    (state: RootState) => state.notifications
  );

  // Listen for new notifications and show as toasts
  useEffect(() => {
    // Get the latest notifications that should be shown as toasts
    const recentNotifications = notifications
      .filter(n => {
        // Show swap-related and proposal-related notifications as toasts
        const toastTypes = [
          'swap_proposal', 'swap_accepted', 'swap_rejected', 'swap_cancelled', 'swap_expired',
          'proposal_accepted', 'proposal_rejected', 'proposal_payment_completed', 'proposal_payment_failed',
          'payment_processing', 'payment_completed', 'payment_failed'
        ];

        if (!toastTypes.includes(n.type)) return false;

        // Only show notifications from the last 30 seconds
        const thirtySecondsAgo = new Date(Date.now() - 30000);
        return new Date(n.createdAt) > thirtySecondsAgo;
      })
      .slice(0, maxToasts);

    // Add new notifications to active toasts and persist them
    recentNotifications.forEach(notification => {
      if (!activeToasts.some(toast => toast.id === notification.id)) {
        // Add to persistence service
        notificationPersistenceService.addToHistory(notification);

        setActiveToasts(prev => {
          const newToasts = [notification, ...prev].slice(0, maxToasts);
          return newToasts;
        });
      }
    });
  }, [notifications, maxToasts, activeToasts]);

  const handleToastClose = (notificationId: string) => {
    // Mark as dismissed in persistence service
    notificationPersistenceService.markAsDismissed(notificationId, 'auto_dismissed');
    setActiveToasts(prev => prev.filter(toast => toast.id !== notificationId));
  };

  const handleToastAction = (notification: Notification, action: string) => {
    // Mark as interacted in persistence service
    notificationPersistenceService.markAsDismissed(notification.id, 'action_taken');

    switch (action) {
      case 'view':
        if (notification.data?.swapId) {
          window.location.href = `/swaps/${notification.data.swapId}`;
        } else if (notification.data?.proposalId) {
          window.location.href = `/proposals/${notification.data.proposalId}`;
        } else if (notification.data?.transactionId) {
          window.location.href = `/payments/${notification.data.transactionId}`;
        } else {
          window.location.href = '/dashboard';
        }
        break;
      case 'retry':
        // Handle retry action for failed payments
        if (notification.data?.proposalId) {
          window.location.href = `/proposals/${notification.data.proposalId}?retry=payment`;
        }
        break;
      case 'dismiss':
        // Just close the toast
        break;
      default:
        console.log('Unknown toast action:', action);
    }
  };

  const getPositionStyles = () => {
    const baseStyles = {
      position: 'fixed' as const,
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: tokens.spacing[2],
      maxWidth: '400px',
      width: 'calc(100vw - 32px)',
    };

    switch (position) {
      case 'top-right':
        return {
          ...baseStyles,
          top: tokens.spacing[4],
          right: tokens.spacing[4],
        };
      case 'top-left':
        return {
          ...baseStyles,
          top: tokens.spacing[4],
          left: tokens.spacing[4],
        };
      case 'bottom-right':
        return {
          ...baseStyles,
          bottom: tokens.spacing[4],
          right: tokens.spacing[4],
          flexDirection: 'column-reverse' as const,
        };
      case 'bottom-left':
        return {
          ...baseStyles,
          bottom: tokens.spacing[4],
          left: tokens.spacing[4],
          flexDirection: 'column-reverse' as const,
        };
      default:
        return {
          ...baseStyles,
          top: tokens.spacing[4],
          right: tokens.spacing[4],
        };
    }
  };

  if (activeToasts.length === 0) {
    return null;
  }

  return (
    <div style={getPositionStyles()}>
      {activeToasts.map((notification, index) => (
        <div
          key={notification.id}
          style={{
            transform: `translateY(${index * 4}px)`,
            zIndex: 1000 - index,
          }}
        >
          <NotificationToast
            notification={notification}
            onClose={() => handleToastClose(notification.id)}
            onAction={action => handleToastAction(notification, action)}
            autoClose={true}
            duration={getToastDuration(notification.type)}
          />
        </div>
      ))}
    </div>
  );
};

// Helper function to determine toast duration based on notification type
function getToastDuration(notificationType: string): number {
  const durationMap: Record<string, number> = {
    swap_proposal: 8000, // 8 seconds - important
    swap_accepted: 6000, // 6 seconds - good news
    swap_rejected: 5000, // 5 seconds - bad news, shorter
    swap_cancelled: 4000, // 4 seconds - neutral
    swap_expired: 7000, // 7 seconds - important warning
    booking_verified: 5000, // 5 seconds - good news
    booking_expired: 8000, // 8 seconds - important warning
    proposal_accepted: 6000, // 6 seconds - good news
    proposal_rejected: 5000, // 5 seconds - neutral
    proposal_payment_completed: 7000, // 7 seconds - important success
    proposal_payment_failed: 10000, // 10 seconds - important error, needs attention
    payment_processing: 0, // Don't auto-close processing notifications
    payment_completed: 6000, // 6 seconds - good news
    payment_failed: 8000, // 8 seconds - important error
  };

  return durationMap[notificationType] || 5000; // Default 5 seconds
}
