import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../store';
import { useWebSocket } from '../../hooks/useWebSocket';
import {
  addNotification,
  updateNotificationStatus,
  fetchUnreadCount,
} from '../../store/slices/notificationSlice';
import { Notification } from '@booking-swap/shared';
import { SwapNotificationHandler } from './SwapNotificationHandler';
import { ToastContainer } from './ToastContainer';

interface NotificationProviderProps {
  children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
}) => {
  const dispatch = useDispatch<AppDispatch>();

  const { isConnected } = useWebSocket({
    onNotification: (notification: Notification) => {
      // Add notification to store
      dispatch(addNotification(notification));

      // Show browser notification if permission granted
      showBrowserNotification(notification);

      // Play notification sound (optional)
      playNotificationSound();
    },

    onConnect: () => {
      console.log('WebSocket connected - refreshing notification count');
      dispatch(fetchUnreadCount());
    },

    onDisconnect: () => {
      console.log('WebSocket disconnected');
    },
  });

  useEffect(() => {
    // Request notification permission on mount
    requestNotificationPermission();
  }, []);

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (error) {
        console.warn('Failed to request notification permission:', error);
      }
    }
  };

  const showBrowserNotification = (notification: Notification) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const browserNotification = new Notification(notification.title, {
          body: notification.message,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: notification.id,
          requireInteraction: false,
          silent: false,
        });

        // Auto-close after 5 seconds
        setTimeout(() => {
          browserNotification.close();
        }, 5000);

        // Handle click to focus window and navigate
        browserNotification.onclick = () => {
          window.focus();
          browserNotification.close();

          // Navigate based on notification type
          if (notification.type.startsWith('swap_')) {
            window.location.href = '/dashboard';
          }
        };
      } catch (error) {
        console.warn('Failed to show browser notification:', error);
      }
    }
  };

  const playNotificationSound = () => {
    try {
      // Create a subtle notification sound
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(
        0.1,
        audioContext.currentTime + 0.01
      );
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.2
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
      // Silently fail if audio context is not available
      console.debug('Could not play notification sound:', error);
    }
  };

  return (
    <SwapNotificationHandler>
      {children}

      {/* Toast Notifications */}
      <ToastContainer position="top-right" maxToasts={3} />

      {/* Connection Status Indicator (for development) */}
      {import.meta.env.DEV && (
        <div className="fixed bottom-4 left-4 z-50">
          <div
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              isConnected
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </div>
        </div>
      )}
    </SwapNotificationHandler>
  );
};
