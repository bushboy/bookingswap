import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Tooltip } from '@/components/ui/Tooltip';
import { tokens } from '@/design-system/tokens';
import {
    ConnectionStatus,
    connectionStatusManager
} from '@/services/connectionStatusManager';
import { ComponentErrorBoundary } from '@/components/error/ComponentErrorBoundary';
import { ConnectionStatusFallback, ConnectionStatusErrorHandler } from './ConnectionStatusErrorHandler';

interface ConnectionStatusIndicatorProps {
    showTooltip?: boolean;
    onClick?: () => void;
    className?: string;
}

/**
 * Internal component that renders the connection status indicator
 * This is wrapped by the error boundary in the main export
 */
const ConnectionStatusIndicatorInternal: React.FC<ConnectionStatusIndicatorProps> = ({
    showTooltip = true,
    onClick,
    className = '',
}) => {
    const [status, setStatus] = useState<ConnectionStatus>(
        connectionStatusManager.getStatus()
    );

    useEffect(() => {
        const unsubscribe = connectionStatusManager.subscribe(setStatus);
        return unsubscribe;
    }, []);

    const getStatusConfig = (status: ConnectionStatus) => {
        switch (status) {
            case ConnectionStatus.CONNECTED:
                return {
                    variant: 'success' as const,
                    icon: '●',
                    text: 'Connected',
                    color: tokens.colors.success[600],
                };
            case ConnectionStatus.CONNECTING:
                return {
                    variant: 'warning' as const,
                    icon: '◐',
                    text: 'Connecting',
                    color: tokens.colors.warning[600],
                };
            case ConnectionStatus.RECONNECTING:
                return {
                    variant: 'warning' as const,
                    icon: '◑',
                    text: 'Reconnecting',
                    color: tokens.colors.warning[600],
                };
            case ConnectionStatus.DISCONNECTED:
                return {
                    variant: 'error' as const,
                    icon: '○',
                    text: 'Disconnected',
                    color: tokens.colors.error[600],
                };
            case ConnectionStatus.FAILED:
                return {
                    variant: 'error' as const,
                    icon: '✕',
                    text: 'Failed',
                    color: tokens.colors.error[600],
                };
            case ConnectionStatus.FALLBACK:
                return {
                    variant: 'info' as const,
                    icon: '◒',
                    text: 'Fallback Mode',
                    color: tokens.colors.blue[600],
                };
            default:
                return {
                    variant: 'default' as const,
                    icon: '?',
                    text: 'Unknown',
                    color: tokens.colors.neutral[600],
                };
        }
    };

    let config;
    let description;

    try {
        config = getStatusConfig(status);
        description = connectionStatusManager.getStatusDescription();
    } catch (error) {
        // Handle errors in status configuration
        console.warn('Error getting status config:', error);
        return ConnectionStatusErrorHandler.renderTextFallback(status);
    }

    const indicatorStyles = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: tokens.spacing[1],
        cursor: onClick ? 'pointer' : 'default',
        transition: 'opacity 0.2s ease',
    };

    const iconStyles = {
        fontSize: '12px',
        color: config.color,
        animation: status === ConnectionStatus.CONNECTING || status === ConnectionStatus.RECONNECTING
            ? 'pulse 1.5s ease-in-out infinite'
            : 'none',
    };

    let badgeComponent;
    try {
        badgeComponent = (
            <Badge variant={config.variant} size="sm">
                {config.text}
            </Badge>
        );
    } catch (error) {
        // Handle Badge component errors with text fallback
        console.warn('Badge component error:', error);
        badgeComponent = ConnectionStatusErrorHandler.handleBadgeError(error as Error, status);
    }

    const indicator = (
        <div
            style={indicatorStyles}
            onClick={onClick}
            className={className}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={onClick ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick();
                }
            } : undefined}
        >
            <span style={iconStyles}>{config.icon}</span>
            {badgeComponent}
        </div>
    );

    if (showTooltip) {
        try {
            return (
                <Tooltip content={description}>
                    {indicator}
                </Tooltip>
            );
        } catch (error) {
            // Handle Tooltip errors by returning indicator without tooltip
            console.warn('Tooltip component error:', error);
            return indicator;
        }
    }

    return indicator;
};

/**
 * Main ConnectionStatusIndicator component wrapped with error boundary
 */
export const ConnectionStatusIndicator: React.FC<ConnectionStatusIndicatorProps> = (props) => {
    return (
        <ComponentErrorBoundary
            componentName="ConnectionStatusIndicator"
            fallback={(fallbackProps) => (
                <ConnectionStatusFallback
                    {...fallbackProps}
                    status={connectionStatusManager.getStatus()}
                    showTooltip={props.showTooltip}
                    onClick={props.onClick}
                    className={props.className}
                />
            )}
            resetOnPropsChange={true}
            onError={(error, errorInfo) => {
                console.error('ConnectionStatusIndicator error:', error, errorInfo);
            }}
        >
            <ConnectionStatusIndicatorInternal {...props} />
        </ComponentErrorBoundary>
    );
};

// Add CSS animation for pulsing effect
const style = document.createElement('style');
style.textContent = `
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;
document.head.appendChild(style);