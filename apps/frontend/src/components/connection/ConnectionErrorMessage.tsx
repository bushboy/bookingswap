import React from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { tokens } from '@/design-system/tokens';
import { ConnectionStatus } from '@/services/connectionStatusManager';

interface ConnectionErrorMessageProps {
    status: ConnectionStatus;
    onRetry?: () => void;
    onShowDiagnostics?: () => void;
    className?: string;
}

export const ConnectionErrorMessage: React.FC<ConnectionErrorMessageProps> = ({
    status,
    onRetry,
    onShowDiagnostics,
    className = '',
}) => {
    // Only show error messages for problematic states
    if (status === ConnectionStatus.CONNECTED) {
        return null;
    }

    const getErrorConfig = (status: ConnectionStatus) => {
        switch (status) {
            case ConnectionStatus.CONNECTING:
                return {
                    variant: 'info' as const,
                    title: 'Connecting...',
                    message: 'Establishing connection to the server. Please wait.',
                    showActions: false,
                };
            case ConnectionStatus.RECONNECTING:
                return {
                    variant: 'warning' as const,
                    title: 'Reconnecting...',
                    message: 'Connection was lost. Attempting to reconnect automatically.',
                    showActions: false,
                };
            case ConnectionStatus.DISCONNECTED:
                return {
                    variant: 'warning' as const,
                    title: 'Connection Lost',
                    message: 'You have been disconnected from the server. Some features may not work properly.',
                    showActions: true,
                };
            case ConnectionStatus.FAILED:
                return {
                    variant: 'error' as const,
                    title: 'Connection Failed',
                    message: 'Unable to connect to the server. Please check your internet connection and try again.',
                    showActions: true,
                };
            case ConnectionStatus.FALLBACK:
                return {
                    variant: 'info' as const,
                    title: 'Limited Connectivity',
                    message: 'Real-time features are temporarily unavailable. Using fallback mode with reduced functionality.',
                    showActions: true,
                };
            default:
                return {
                    variant: 'warning' as const,
                    title: 'Connection Status Unknown',
                    message: 'Unable to determine connection status.',
                    showActions: true,
                };
        }
    };

    const config = getErrorConfig(status);

    const actionsStyles = {
        display: 'flex',
        gap: tokens.spacing[2],
        marginTop: tokens.spacing[3],
    };

    return (
        <Alert variant={config.variant} className={className}>
            <div>
                <h4 style={{
                    fontSize: tokens.typography.fontSize.base,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    marginBottom: tokens.spacing[1],
                }}>
                    {config.title}
                </h4>
                <p style={{
                    fontSize: tokens.typography.fontSize.sm,
                    color: tokens.colors.neutral[600],
                    marginBottom: config.showActions ? tokens.spacing[2] : 0,
                }}>
                    {config.message}
                </p>

                {config.showActions && (
                    <div style={actionsStyles}>
                        {onRetry && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onRetry}
                            >
                                Retry Connection
                            </Button>
                        )}
                        {onShowDiagnostics && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onShowDiagnostics}
                            >
                                View Diagnostics
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </Alert>
    );
};