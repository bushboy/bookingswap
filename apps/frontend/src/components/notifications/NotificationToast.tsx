import React, { useState, useEffect } from 'react';
import { tokens } from '../../design-system/tokens';
import { Notification } from '@booking-swap/shared';
import { NotificationService } from '../../services/notificationService';

interface NotificationToastProps {
  notification: Notification;
  onClose: () => void;
  onAction?: (action: string) => void;
  autoClose?: boolean;
  duration?: number;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  notification,
  onClose,
  onAction,
  autoClose = true,
  duration = 5000,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (autoClose) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [autoClose, duration]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose();
    }, 300); // Animation duration
  };

  const handleAction = (action: string) => {
    onAction?.(action);
    handleClose();
  };

  if (!isVisible) return null;

  const getNotificationStyle = () => {
    const baseStyle = {
      position: 'fixed' as const,
      top: tokens.spacing[4],
      right: tokens.spacing[4],
      width: '400px',
      maxWidth: 'calc(100vw - 32px)',
      backgroundColor: tokens.colors.white,
      border: `1px solid ${tokens.colors.neutral[200]}`,
      borderRadius: tokens.borderRadius.lg,
      boxShadow: tokens.shadows.lg,
      padding: tokens.spacing[4],
      zIndex: 1000,
      transform: isClosing ? 'translateX(100%)' : 'translateX(0)',
      opacity: isClosing ? 0 : 1,
      transition: 'all 0.3s ease-in-out',
    };

    // Add colored left border based on notification type
    const colorMap: Record<string, string> = {
      swap_proposal: tokens.colors.primary[500],
      swap_accepted: tokens.colors.success[500],
      swap_rejected: tokens.colors.error[500],
      swap_cancelled: tokens.colors.neutral[500],
      swap_expired: tokens.colors.warning[500],
      proposal_accepted: tokens.colors.success[500],
      proposal_rejected: tokens.colors.error[500],
      proposal_payment_completed: tokens.colors.success[500],
      proposal_payment_failed: tokens.colors.error[500],
      payment_processing: tokens.colors.primary[500],
      payment_completed: tokens.colors.success[500],
      payment_failed: tokens.colors.error[500],
    };

    return {
      ...baseStyle,
      borderLeft: `4px solid ${colorMap[notification.type] || tokens.colors.primary[500]}`,
    };
  };

  const getActionButtons = () => {
    const actions: Array<{
      label: string;
      action: string;
      variant: 'primary' | 'secondary';
    }> = [];

    switch (notification.type) {
      case 'swap_proposal':
        actions.push(
          { label: 'View', action: 'view', variant: 'primary' },
          { label: 'Dismiss', action: 'dismiss', variant: 'secondary' }
        );
        break;
      case 'swap_accepted':
        actions.push({
          label: 'View Swap',
          action: 'view',
          variant: 'primary',
        });
        break;
      case 'swap_rejected':
        actions.push({
          label: 'View Details',
          action: 'view',
          variant: 'secondary',
        });
        break;
      case 'proposal_accepted':
        actions.push({
          label: 'View Details',
          action: 'view',
          variant: 'primary',
        });
        break;
      case 'proposal_rejected':
        actions.push({
          label: 'View Proposals',
          action: 'view',
          variant: 'secondary',
        });
        break;
      case 'proposal_payment_completed':
        actions.push({
          label: 'View Transaction',
          action: 'view',
          variant: 'primary',
        });
        break;
      case 'proposal_payment_failed':
        actions.push(
          { label: 'Retry Payment', action: 'retry', variant: 'primary' },
          { label: 'View Details', action: 'view', variant: 'secondary' }
        );
        break;
      case 'payment_processing':
        actions.push({
          label: 'View Status',
          action: 'view',
          variant: 'secondary',
        });
        break;
      default:
        actions.push({ label: 'View', action: 'view', variant: 'secondary' });
    }

    return actions;
  };

  return (
    <div style={getNotificationStyle()}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: tokens.spacing[2],
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: tokens.spacing[2],
          }}
        >
          <span style={{ fontSize: '20px' }}>
            {NotificationService.getNotificationIcon(notification.type)}
          </span>
          <h4
            style={{
              margin: 0,
              fontSize: tokens.typography.fontSize.base,
              fontWeight: tokens.typography.fontWeight.semibold,
              color: tokens.colors.neutral[900],
            }}
          >
            {notification.title}
          </h4>
        </div>

        <button
          onClick={handleClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: tokens.spacing[1],
            color: tokens.colors.neutral[500],
            fontSize: '18px',
            lineHeight: 1,
          }}
          aria-label="Close notification"
        >
          ×
        </button>
      </div>

      {/* Message */}
      <p
        style={{
          margin: 0,
          marginBottom: tokens.spacing[3],
          fontSize: tokens.typography.fontSize.sm,
          color: tokens.colors.neutral[700],
          lineHeight: tokens.typography.lineHeight.relaxed,
        }}
      >
        {notification.message}
      </p>

      {/* Timestamp */}
      <div
        style={{
          fontSize: tokens.typography.fontSize.xs,
          color: tokens.colors.neutral[500],
          marginBottom: tokens.spacing[3],
        }}
      >
        {NotificationService.formatNotificationTime(notification.createdAt)}
      </div>

      {/* Action Buttons */}
      <div
        style={{
          display: 'flex',
          gap: tokens.spacing[2],
          justifyContent: 'flex-end',
        }}
      >
        {getActionButtons().map(button => (
          <button
            key={button.action}
            onClick={() => handleAction(button.action)}
            style={{
              padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
              border:
                button.variant === 'primary'
                  ? 'none'
                  : `1px solid ${tokens.colors.neutral[300]}`,
              borderRadius: tokens.borderRadius.md,
              backgroundColor:
                button.variant === 'primary'
                  ? tokens.colors.primary[500]
                  : 'transparent',
              color:
                button.variant === 'primary'
                  ? tokens.colors.white
                  : tokens.colors.neutral[700],
              fontSize: tokens.typography.fontSize.sm,
              fontWeight: tokens.typography.fontWeight.medium,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => {
              if (button.variant === 'primary') {
                e.currentTarget.style.backgroundColor =
                  tokens.colors.primary[600];
              } else {
                e.currentTarget.style.backgroundColor =
                  tokens.colors.neutral[50];
              }
            }}
            onMouseLeave={e => {
              if (button.variant === 'primary') {
                e.currentTarget.style.backgroundColor =
                  tokens.colors.primary[500];
              } else {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            {button.label}
          </button>
        ))}
      </div>
    </div>
  );
};
