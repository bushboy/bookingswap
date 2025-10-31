import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { tokens } from '../../design-system/tokens';
import { NotificationCenter } from './NotificationCenter';

interface NotificationBellProps {
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
  className?: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  size = 'md',
  showCount = true,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { unreadCount } = useSelector(
    (state: RootState) => state.notifications
  );

  const getSizeStyles = () => {
    const sizeMap = {
      sm: {
        button: '32px',
        icon: '16px',
        badge: '16px',
        badgeFont: tokens.typography.fontSize.xs,
      },
      md: {
        button: '40px',
        icon: '20px',
        badge: '18px',
        badgeFont: tokens.typography.fontSize.xs,
      },
      lg: {
        button: '48px',
        icon: '24px',
        badge: '20px',
        badgeFont: tokens.typography.fontSize.sm,
      },
    };
    return sizeMap[size];
  };

  const sizeStyles = getSizeStyles();

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={className}
        style={{
          position: 'relative',
          width: sizeStyles.button,
          height: sizeStyles.button,
          border: 'none',
          borderRadius: '50%',
          backgroundColor: 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
          color: tokens.colors.neutral[600],
        }}
        onMouseEnter={e => {
          e.currentTarget.style.backgroundColor = tokens.colors.neutral[100];
          e.currentTarget.style.color = tokens.colors.neutral[900];
        }}
        onMouseLeave={e => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = tokens.colors.neutral[600];
        }}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        {/* Bell Icon */}
        <svg
          width={sizeStyles.icon}
          height={sizeStyles.icon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {/* Unread Count Badge */}
        {showCount && unreadCount > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '-2px',
              right: '-2px',
              minWidth: sizeStyles.badge,
              height: sizeStyles.badge,
              borderRadius: '50%',
              backgroundColor: tokens.colors.error[500],
              color: tokens.colors.white,
              fontSize: sizeStyles.badgeFont,
              fontWeight: tokens.typography.fontWeight.bold,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              border: `2px solid ${tokens.colors.white}`,
              boxShadow: tokens.shadows.sm,
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </div>
        )}

        {/* Pulse Animation for New Notifications */}
        {unreadCount > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: sizeStyles.button,
              height: sizeStyles.button,
              borderRadius: '50%',
              backgroundColor: tokens.colors.primary[500],
              opacity: 0.3,
              animation: 'pulse 2s infinite',
              pointerEvents: 'none',
            }}
          />
        )}
      </button>

      {/* Notification Center */}
      <NotificationCenter isOpen={isOpen} onClose={() => setIsOpen(false)} />

      {/* CSS Animation */}
      <style>
        {`
          @keyframes pulse {
            0% {
              transform: translate(-50%, -50%) scale(1);
              opacity: 0.3;
            }
            50% {
              transform: translate(-50%, -50%) scale(1.1);
              opacity: 0.1;
            }
            100% {
              transform: translate(-50%, -50%) scale(1);
              opacity: 0.3;
            }
          }
        `}
      </style>
    </>
  );
};
