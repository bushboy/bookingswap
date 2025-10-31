import React from 'react';
import { ConnectionStatus } from '@/services/connectionStatusManager';
import { tokens } from '@/design-system/tokens';

/**
 * Props for the TextConnectionStatus component
 */
interface TextConnectionStatusProps {
    /** Current connection status */
    status: ConnectionStatus;
    /** Whether to show detailed status messages */
    showDetails?: boolean;
    /** Click handler */
    onClick?: () => void;
    /** Additional CSS classes */
    className?: string;
    /** Custom status messages */
    customMessages?: Partial<Record<ConnectionStatus, string>>;
}

/**
 * Text-only connection status display component.
 * Used as a fallback when Badge component fails or for minimal UI requirements.
 */
export const TextConnectionStatus: React.FC<TextConnectionStatusProps> = ({
    status,
    showDetails = true,
    onClick,
    className = '',
    customMessages = {},
}) => {
    /**
     * Get fallback status messages for each connection state
     */
    const getStatusMessage = (status: ConnectionStatus): string => {
        // Use custom message if provided
        if (customMessages[status]) {
            return customMessages[status]!;
        }

        // Default fallback messages
        switch (status) {
            case ConnectionStatus.CONNECTED:
                return showDetails ? 'Connected to server' : 'Connected';
            case ConnectionStatus.CONNECTING:
                return showDetails ? 'Connecting to server...' : 'Connecting';
            case ConnectionStatus.RECONNECTING:
                return showDetails ? 'Reconnecting to server...' : 'Reconnecting';
            case ConnectionStatus.DISCONNECTED:
                return showDetails ? 'Disconnected from server' : 'Disconnected';
            case ConnectionStatus.FAILED:
                return showDetails ? 'Connection failed' : 'Failed';
            case ConnectionStatus.FALLBACK:
                return showDetails ? 'Running in fallback mode' : 'Fallback Mode';
            default:
                return showDetails ? 'Connection status unknown' : 'Unknown';
        }
    };

    /**
     * Get status color based on connection state
     */
    const getStatusColor = (status: ConnectionStatus): string => {
        switch (status) {
            case ConnectionStatus.CONNECTED:
                return tokens.colors.success[600];
            case ConnectionStatus.CONNECTING:
            case ConnectionStatus.RECONNECTING:
                return tokens.colors.warning[600];
            case ConnectionStatus.DISCONNECTED:
            case ConnectionStatus.FAILED:
                return tokens.colors.error[600];
            case ConnectionStatus.FALLBACK:
                return tokens.colors.blue[600];
            default:
                return tokens.colors.neutral[600];
        }
    };

    /**
     * Get status icon for visual indication
     */
    const getStatusIcon = (status: ConnectionStatus): string => {
        switch (status) {
            case ConnectionStatus.CONNECTED:
                return '●';
            case ConnectionStatus.CONNECTING:
                return '◐';
            case ConnectionStatus.RECONNECTING:
                return '◑';
            case ConnectionStatus.DISCONNECTED:
                return '○';
            case ConnectionStatus.FAILED:
                return '✕';
            case ConnectionStatus.FALLBACK:
                return '◒';
            default:
                return '?';
        }
    };

    const statusColor = getStatusColor(status);
    const statusMessage = getStatusMessage(status);
    const statusIcon = getStatusIcon(status);

    const containerStyles: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: tokens.spacing[1],
        color: statusColor,
        fontSize: tokens.fontSize.sm,
        fontWeight: tokens.fontWeight.medium,
        cursor: onClick ? 'pointer' : 'default',
        padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
        borderRadius: tokens.borderRadius.sm,
        backgroundColor: tokens.colors.neutral[50],
        border: `1px solid ${statusColor}`,
        transition: 'all 0.2s ease',
    };

    const iconStyles: React.CSSProperties = {
        fontSize: '12px',
        color: statusColor,
        animation: status === ConnectionStatus.CONNECTING || status === ConnectionStatus.RECONNECTING
            ? 'pulse 1.5s ease-in-out infinite'
            : 'none',
    };

    const textStyles: React.CSSProperties = {
        color: statusColor,
        whiteSpace: 'nowrap',
    };

    return (
        <div
            style={containerStyles}
            onClick={onClick}
            className={className}
            role={onClick ? 'button' : 'status'}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={onClick ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick();
                }
            } : undefined}
            title={statusMessage}
        >
            <span style={iconStyles}>{statusIcon}</span>
            <span style={textStyles}>{statusMessage}</span>
        </div>
    );
};

/**
 * Minimal text-only connection status (no styling, just text)
 */
export const MinimalTextConnectionStatus: React.FC<{
    status: ConnectionStatus;
    onClick?: () => void;
    className?: string;
}> = ({ status, onClick, className = '' }) => {
    const getSimpleStatusText = (status: ConnectionStatus): string => {
        switch (status) {
            case ConnectionStatus.CONNECTED:
                return 'Online';
            case ConnectionStatus.CONNECTING:
                return 'Connecting...';
            case ConnectionStatus.RECONNECTING:
                return 'Reconnecting...';
            case ConnectionStatus.DISCONNECTED:
                return 'Offline';
            case ConnectionStatus.FAILED:
                return 'Error';
            case ConnectionStatus.FALLBACK:
                return 'Fallback';
            default:
                return 'Unknown';
        }
    };

    const simpleStyles: React.CSSProperties = {
        fontSize: tokens.fontSize.sm,
        color: tokens.colors.neutral[700],
        cursor: onClick ? 'pointer' : 'default',
    };

    return (
        <span
            style={simpleStyles}
            onClick={onClick}
            className={className}
            role={onClick ? 'button' : 'status'}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={onClick ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick();
                }
            } : undefined}
        >
            {getSimpleStatusText(status)}
        </span>
    );
};

export default TextConnectionStatus;
</content >