import React from 'react';
import { ErrorFallbackProps } from './ComponentErrorBoundary';
import './ErrorBoundary.css';

/**
 * Connection status values for fallback display
 */
enum ConnectionStatus {
    CONNECTED = 'connected',
    CONNECTING = 'connecting',
    RECONNECTING = 'reconnecting',
    DISCONNECTED = 'disconnected',
    FAILED = 'failed',
    FALLBACK = 'fallback',
}

/**
 * Specialized error fallback component for ConnectionStatusIndicator errors
 */
export const ConnectionStatusFallback: React.FC<ErrorFallbackProps & {
    status?: string;
    showTooltip?: boolean;
}> = ({
    error,
    resetError,
    componentName = 'ConnectionStatusIndicator',
    status = 'unknown',
}) => {
        /**
         * Get text-based fallback for connection status
         */
        const getTextFallback = (status: string): { text: string; color: string; icon: string } => {
            switch (status.toLowerCase()) {
                case ConnectionStatus.CONNECTED:
                    return { text: 'Connected', color: '#16a34a', icon: '●' };
                case ConnectionStatus.CONNECTING:
                    return { text: 'Connecting...', color: '#ca8a04', icon: '◐' };
                case ConnectionStatus.RECONNECTING:
                    return { text: 'Reconnecting...', color: '#ca8a04', icon: '◑' };
                case ConnectionStatus.DISCONNECTED:
                    return { text: 'Disconnected', color: '#dc2626', icon: '○' };
                case ConnectionStatus.FAILED:
                    return { text: 'Connection Failed', color: '#dc2626', icon: '✕' };
                case ConnectionStatus.FALLBACK:
                    return { text: 'Fallback Mode', color: '#2563eb', icon: '◒' };
                default:
                    return { text: 'Status Unknown', color: '#6b7280', icon: '?' };
            }
        };

        const statusConfig = getTextFallback(status);

        const handleRetry = () => {
            resetError();
        };

        const handleRefresh = () => {
            window.location.reload();
        };

        // Minimal text-based connection status display
        const renderMinimalIndicator = () => {
            const indicatorStyles = {
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                backgroundColor: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '12px',
                fontSize: '12px',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                color: statusConfig.color,
            };

            const iconStyles = {
                fontSize: '10px',
                color: statusConfig.color,
            };

            return (
                <div style={indicatorStyles} title={`Connection Status: ${statusConfig.text}`}>
                    <span style={iconStyles}>{statusConfig.icon}</span>
                    <span>{statusConfig.text}</span>
                </div>
            );
        };

        // If it's a minor rendering error, show minimal indicator
        if (error.message.includes('Badge') || error.message.includes('token') || error.message.includes('style')) {
            return renderMinimalIndicator();
        }

        // For more serious errors, show full error UI with fallback
        return (
            <div className="error-boundary-fallback connection-status-error-fallback" role="alert">
                <div className="error-boundary-content">
                    <div className="error-icon">🔌</div>
                    <h3>Connection Status Error</h3>
                    <p>
                        The connection status indicator encountered an error.
                    </p>

                    {/* Show the minimal status indicator as fallback */}
                    <div className="connection-status-fallback">
                        <strong>Current Status:</strong>
                        {renderMinimalIndicator()}
                    </div>

                    <div className="error-actions">
                        <button
                            onClick={handleRetry}
                            className="error-boundary-retry-button"
                            type="button"
                        >
                            Retry Indicator
                        </button>

                        <button
                            onClick={handleRefresh}
                            className="error-boundary-refresh-button"
                            type="button"
                        >
                            Refresh Page
                        </button>
                    </div>

                    {process.env.NODE_ENV === 'development' && (
                        <details className="error-details">
                            <summary>Connection Status Error Details</summary>
                            <div className="error-info">
                                <p><strong>Status:</strong> {status}</p>
                                <p><strong>Error:</strong> {error.message}</p>
                                <p><strong>Component:</strong> {componentName}</p>
                            </div>
                        </details>
                    )}
                </div>
            </div>
        );
    };

/**
 * Simple text-only connection status component for severe errors
 */
export const TextConnectionStatus: React.FC<{ status?: string }> = ({
    status = 'unknown'
}) => {
    const statusConfig = {
        connected: { text: 'Online', color: '#16a34a' },
        connecting: { text: 'Connecting...', color: '#ca8a04' },
        reconnecting: { text: 'Reconnecting...', color: '#ca8a04' },
        disconnected: { text: 'Offline', color: '#dc2626' },
        failed: { text: 'Failed', color: '#dc2626' },
        fallback: { text: 'Limited', color: '#2563eb' },
    }[status.toLowerCase()] || { text: 'Unknown', color: '#6b7280' };

    const textStyles = {
        fontSize: '12px',
        fontWeight: '500',
        color: statusConfig.color,
        fontFamily: 'system-ui, -apple-system, sans-serif',
    };

    return (
        <span style={textStyles} title={`Connection: ${statusConfig.text}`}>
            {statusConfig.text}
        </span>
    );
};

export default ConnectionStatusFallback;