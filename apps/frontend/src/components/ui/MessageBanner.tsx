import React, { useEffect, useState } from 'react';
import { tokens } from '@/design-system/tokens';

export interface MessageBannerProps {
    /**
     * The message to display to the user
     */
    message: string;

    /**
     * The type of message which determines styling
     */
    type?: 'info' | 'warning' | 'error' | 'success';

    /**
     * Whether the banner can be dismissed manually
     */
    dismissible?: boolean;

    /**
     * Auto-dismiss timeout in milliseconds (0 to disable)
     */
    autoDissmissTimeout?: number;

    /**
     * Callback when the banner is dismissed
     */
    onDismiss?: () => void;

    /**
     * Additional CSS class name
     */
    className?: string;
}

/**
 * MessageBanner component for displaying temporary user feedback messages
 * 
 * Features:
 * - Support for different message types (info, warning, error, success)
 * - Auto-dismiss functionality with configurable timeout
 * - Manual dismiss option with close button
 * - Accessible design with proper ARIA attributes
 * 
 * Requirements: 2.2, 2.4, 3.2
 */
export const MessageBanner: React.FC<MessageBannerProps> = ({
    message,
    type = 'info',
    dismissible = true,
    autoDissmissTimeout = 5000,
    onDismiss,
    className = '',
}) => {
    const [isVisible, setIsVisible] = useState(true);

    // Auto-dismiss functionality
    useEffect(() => {
        if (autoDissmissTimeout > 0) {
            const timer = setTimeout(() => {
                handleDismiss();
            }, autoDissmissTimeout);

            return () => clearTimeout(timer);
        }
    }, [autoDissmissTimeout]);

    const handleDismiss = () => {
        setIsVisible(false);
        onDismiss?.();
    };

    if (!isVisible) {
        return null;
    }

    // Get styling based on message type
    const getTypeStyles = () => {
        switch (type) {
            case 'success':
                return {
                    backgroundColor: tokens.colors.success[50],
                    borderColor: tokens.colors.success[200],
                    textColor: tokens.colors.success[800],
                    iconColor: tokens.colors.success[600],
                    icon: '✅',
                };
            case 'warning':
                return {
                    backgroundColor: tokens.colors.warning[50],
                    borderColor: tokens.colors.warning[200],
                    textColor: tokens.colors.warning[800],
                    iconColor: tokens.colors.warning[600],
                    icon: '⚠️',
                };
            case 'error':
                return {
                    backgroundColor: tokens.colors.error[50],
                    borderColor: tokens.colors.error[200],
                    textColor: tokens.colors.error[800],
                    iconColor: tokens.colors.error[600],
                    icon: '❌',
                };
            case 'info':
            default:
                return {
                    backgroundColor: tokens.colors.primary[50],
                    borderColor: tokens.colors.primary[200],
                    textColor: tokens.colors.primary[800],
                    iconColor: tokens.colors.primary[600],
                    icon: 'ℹ️',
                };
        }
    };

    const typeStyles = getTypeStyles();

    const bannerStyles: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing[3],
        padding: tokens.spacing[4],
        backgroundColor: typeStyles.backgroundColor,
        border: `1px solid ${typeStyles.borderColor}`,
        borderRadius: tokens.borderRadius.md,
        boxShadow: tokens.shadows.sm,
        marginBottom: tokens.spacing[4],
        position: 'relative',
        animation: 'slideIn 0.3s ease-out',
    };

    const iconStyles: React.CSSProperties = {
        fontSize: '20px',
        color: typeStyles.iconColor,
        flexShrink: 0,
    };

    const messageStyles: React.CSSProperties = {
        flex: 1,
        fontSize: tokens.typography.fontSize.sm,
        color: typeStyles.textColor,
        lineHeight: tokens.typography.lineHeight.relaxed,
        margin: 0,
    };

    const closeButtonStyles: React.CSSProperties = {
        background: 'none',
        border: 'none',
        fontSize: '18px',
        cursor: 'pointer',
        color: typeStyles.textColor,
        padding: tokens.spacing[1],
        borderRadius: tokens.borderRadius.sm,
        transition: 'background-color 0.2s ease',
        flexShrink: 0,
    };

    return (
        <div
            className={`message-banner message-banner--${type} ${className}`}
            style={bannerStyles}
            role="alert"
            aria-live="polite"
        >
            <span style={iconStyles} aria-hidden="true">
                {typeStyles.icon}
            </span>

            <p style={messageStyles}>
                {message}
            </p>

            {dismissible && (
                <button
                    style={closeButtonStyles}
                    onClick={handleDismiss}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = typeStyles.borderColor;
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                    aria-label="Dismiss message"
                    title="Dismiss message"
                >
                    ×
                </button>
            )}

            <style>{`
                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>
        </div>
    );
};

export default MessageBanner;