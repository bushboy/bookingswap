import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { useSwapWebSocket } from '../../hooks/useSwapWebSocket';
import {
  addNotification,
  updateNotificationStatus,
} from '../../store/slices/notificationSlice';
import { refreshSwap, refreshSwaps } from '../../store/thunks/swapThunks';
import { Notification } from '@booking-swap/shared';
import { SwapEvent } from '../../services/swapService';

interface SwapNotificationHandlerProps {
  children: React.ReactNode;
}

export const SwapNotificationHandler: React.FC<
  SwapNotificationHandlerProps
> = ({ children }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((state: RootState) => state.auth);

  const handleSwapNotification = (notification: Notification) => {
    // Only handle swap-related notifications
    if (!notification.type.startsWith('swap_')) {
      return;
    }

    // Add notification to store
    dispatch(addNotification(notification));

    // Show browser notification with swap-specific content
    showSwapBrowserNotification(notification);

    // Play notification sound based on importance
    playSwapNotificationSound(notification.type);

    // Refresh relevant swap data
    if (notification.data?.swapId) {
      dispatch(refreshSwap(notification.data.swapId));
    }
  };

  const handleSwapUpdate = (swapId: string, event: SwapEvent) => {
    // Create in-app notification for swap updates
    const notification: Partial<Notification> = {
      id: `swap-update-${event.id}`,
      userId: user?.id || '',
      type: getNotificationTypeFromEvent(event.type),
      title: getSwapUpdateTitle(event.type),
      message: getSwapUpdateMessage(event),
      data: { swapId, eventId: event.id },
      channel: 'in_app',
      status: 'delivered',
      createdAt: new Date(event.timestamp),
    };

    dispatch(addNotification(notification as Notification));
  };

  const handleProposalReceived = (swapId: string, proposalId: string) => {
    // Create notification for new proposal
    const notification: Partial<Notification> = {
      id: `proposal-${proposalId}`,
      userId: user?.id || '',
      type: 'swap_proposal',
      title: 'New Swap Proposal',
      message: 'You have received a new swap proposal',
      data: { swapId, proposalId },
      channel: 'in_app',
      status: 'delivered',
      createdAt: new Date(),
    };

    dispatch(addNotification(notification as Notification));

    // Show browser notification
    showSwapBrowserNotification(notification as Notification);

    // Play notification sound
    playSwapNotificationSound('swap_proposal');
  };

  // Initialize WebSocket with swap-specific handlers
  const { isConnected } = useSwapWebSocket({
    onSwapUpdate: handleSwapUpdate,
    onProposalReceived: handleProposalReceived,
  });

  const showSwapBrowserNotification = (notification: Notification) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const browserNotification = new Notification(notification.title, {
          body: notification.message,
          icon: getSwapNotificationIcon(notification.type),
          badge: '/favicon.ico',
          tag: `swap-${notification.data?.swapId || notification.id}`,
          requireInteraction: isHighPriorityNotification(notification.type),
          silent: false,
          data: {
            swapId: notification.data?.swapId,
            notificationId: notification.id,
            type: notification.type,
          },
        });

        // Auto-close based on priority
        const autoCloseDelay = isHighPriorityNotification(notification.type)
          ? 10000
          : 5000;
        setTimeout(() => {
          browserNotification.close();
        }, autoCloseDelay);

        // Handle click to navigate to swap
        browserNotification.onclick = () => {
          window.focus();
          browserNotification.close();

          // Navigate to swap details or dashboard
          if (notification.data?.swapId) {
            window.location.href = `/swaps/${notification.data.swapId}`;
          } else {
            window.location.href = '/dashboard';
          }

          // Mark notification as read
          dispatch(
            updateNotificationStatus({
              id: notification.id,
              status: 'read',
              readAt: new Date(),
            })
          );
        };
      } catch (error) {
        console.warn('Failed to show swap browser notification:', error);
      }
    }
  };

  const playSwapNotificationSound = (notificationType: string) => {
    try {
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Different sounds for different notification types
      const soundConfig = getSwapSoundConfig(notificationType);

      oscillator.frequency.setValueAtTime(
        soundConfig.frequency1,
        audioContext.currentTime
      );
      oscillator.frequency.setValueAtTime(
        soundConfig.frequency2,
        audioContext.currentTime + 0.1
      );

      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(
        soundConfig.volume,
        audioContext.currentTime + 0.01
      );
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + soundConfig.duration
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + soundConfig.duration);
    } catch (error) {
      console.debug('Could not play swap notification sound:', error);
    }
  };

  return <>{children}</>;
};

// Helper functions
function getNotificationTypeFromEvent(
  eventType: SwapEvent['type']
): Notification['type'] {
  const typeMap: Record<SwapEvent['type'], Notification['type']> = {
    created: 'swap_proposal',
    proposed: 'swap_proposal',
    accepted: 'swap_accepted',
    rejected: 'swap_rejected',
    completed: 'swap_accepted', // Using accepted as closest match
    cancelled: 'swap_cancelled',
  };
  return typeMap[eventType] || 'swap_proposal';
}

function getSwapUpdateTitle(eventType: SwapEvent['type']): string {
  const titleMap: Record<SwapEvent['type'], string> = {
    created: 'Swap Created',
    proposed: 'New Proposal',
    accepted: 'Swap Accepted',
    rejected: 'Swap Rejected',
    completed: 'Swap Completed',
    cancelled: 'Swap Cancelled',
  };
  return titleMap[eventType] || 'Swap Update';
}

function getSwapUpdateMessage(event: SwapEvent): string {
  const baseMessages: Record<SwapEvent['type'], string> = {
    created: 'A new swap has been created',
    proposed: 'You have received a new swap proposal',
    accepted: 'Your swap proposal has been accepted',
    rejected: 'Your swap proposal has been rejected',
    completed: 'Your swap has been completed successfully',
    cancelled: 'The swap has been cancelled',
  };

  let message = baseMessages[event.type] || 'Swap status updated';

  // Add additional context from event data if available
  if (event.data?.reason && event.type === 'rejected') {
    message += `: ${event.data.reason}`;
  }

  return message;
}

function getSwapNotificationIcon(notificationType: string): string {
  // Return appropriate icon URL based on notification type
  const iconMap: Record<string, string> = {
    swap_proposal: '/icons/swap-proposal.png',
    swap_accepted: '/icons/swap-accepted.png',
    swap_rejected: '/icons/swap-rejected.png',
    swap_cancelled: '/icons/swap-cancelled.png',
    swap_expired: '/icons/swap-expired.png',
  };
  return iconMap[notificationType] || '/favicon.ico';
}

function isHighPriorityNotification(notificationType: string): boolean {
  const highPriorityTypes = ['swap_accepted', 'swap_rejected', 'swap_expired'];
  return highPriorityTypes.includes(notificationType);
}

function getSwapSoundConfig(notificationType: string) {
  const soundConfigs: Record<
    string,
    { frequency1: number; frequency2: number; volume: number; duration: number }
  > = {
    swap_proposal: {
      frequency1: 800,
      frequency2: 600,
      volume: 0.1,
      duration: 0.2,
    },
    swap_accepted: {
      frequency1: 600,
      frequency2: 800,
      volume: 0.15,
      duration: 0.3,
    },
    swap_rejected: {
      frequency1: 400,
      frequency2: 300,
      volume: 0.1,
      duration: 0.15,
    },
    swap_cancelled: {
      frequency1: 500,
      frequency2: 400,
      volume: 0.08,
      duration: 0.1,
    },
    swap_expired: {
      frequency1: 700,
      frequency2: 500,
      volume: 0.12,
      duration: 0.25,
    },
  };

  return soundConfigs[notificationType] || soundConfigs['swap_proposal'];
}
