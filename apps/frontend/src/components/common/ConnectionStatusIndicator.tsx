import React from 'react';
import { tokens } from '../../design-system/tokens';

interface ConnectionHealth {
    status: 'connected' | 'connecting' | 'disconnected' | 'error';
    latency: number;
    lastPing: Date | null;
    reconnectAttempts: number;
    maxReconnectAttempts: number;
    isHealthy: boolean;
    errorMessage?: string;
}

interface ConnectionStatusIndicatorProps {
    health: ConnectionHealth;
    onReconnect?: () => void;
    showDetails?: boolean;
    className?: string;
}

export const ConnectionStatusIndicator: React.FC<ConnectionStatusIndicatorProps> = ({
    health,
    onReconnect,
    showDetails = false,
    className = '',
}) => {
    const getStatusColor = () => {
        switch (health.status) {
            case 'connected':
                return health.isHealthy ? tokens.colors.success[500] : tokens.colors.warning[500];
            case 'connecting':
                return tokens.colors.warning[500];
            case 'disconnected':
            case 'error':
                return tokens.colors.error[500];
            default:
                return tokens.colors.neutral[400];
        }
    };

    const getStatusText = () => {
        switch (health.status) {
            case 'connected':
                return health.isHealthy ? 'Connected' : 'Connected (Poor)';
            case 'connecting':
                return 'Connecting...';
            case 'disconnected':
                return 'Disconnected';
            case 'error':
                return 'Connection Error';
            default:
                return 'Unknown';
        }
    };

    const getStatusIcon = () => {
        switch (health.status) {
            case 'connected':
                return health.isHealthy ? '●' : '◐';
            case 'connecting':
                return '◔';
            case 'disconnected':
            case 'error':
                return '○';
            default:
                return '?';
        }
    };

    const formatLatency = (latency: number) => {
        if (latency < 1000) {
            return `${latency}ms`;
        }
        return `${(latency / 1000).toFixed(1)}s`;
    };

    const shouldShowReconnectButton = () => {
        return (health.status === 'disconnected' || health.status === 'error') &&
            health.reconnectAttempts < health.maxReconnectAttempts;
    };

    return (
        <div
            className={`connection-status-indicator ${className}`}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: tokens.spacing[1],
                padding: tokens.spacing[1],
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.neutral[600],
            }}
        >
            <span
                style={{
                    color: getStatusColor(),
                    fontSize: '12px',
                    lineHeight: 1,
                }}
                title={`Status: ${getStatusText()}`}
            >
                {getStatusIcon()}
            </span>

            <span style={{ fontSize: tokens.typography.fontSize.xs }}>
                {getStatusText()}
            </span>

            {showDetails && health.status === 'connected' && (
                <span
                    style={{
                        fontSize: tokens.typography.fontSize.xs,
                        color: tokens.colors.neutral[500],
                    }}
                >
                    ({formatLatency(health.latency)})
                </span>
            )}

            {health.status === 'connecting' && health.reconnectAttempts > 0 && (
                <span
                    style={{
                        fontSize: tokens.typography.fontSize.xs,
                        color: tokens.colors.neutral[500],
                    }}
                >
                    (Attempt {health.reconnectAttempts}/{health.maxReconnectAttempts})
                </span>
            )}

            {shouldShowReconnectButton() && onReconnect && (
                <button
                    onClick={onReconnect}
                    style={{
                        background: 'none',
                        border: `1px solid ${tokens.colors.primary[500]}`,
                        color: tokens.colors.primary[500],
                        padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                        borderRadius: tokens.borderRadius.sm,
                        fontSize: tokens.typography.fontSize.xs,
                        cursor: 'pointer',
                        marginLeft: tokens.spacing[1],
                    }}
                    onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = tokens.colors.primary[500];
                        e.currentTarget.style.color = 'white';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = tokens.colors.primary[500];
                    }}
                >
                    Reconnect
                </button>
            )}

            {health.errorMessage && showDetails && (
                <span
                    style={{
                        fontSize: tokens.typography.fontSize.xs,
                        color: tokens.colors.error[500],
                        fontStyle: 'italic',
                    }}
                    title={health.errorMessage}
                >
                    ({health.errorMessage.length > 20
                        ? health.errorMessage.substring(0, 20) + '...'
                        : health.errorMessage})
                </span>
            )}
        </div>
    );
};