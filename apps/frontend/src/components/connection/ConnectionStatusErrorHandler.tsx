import React from 'react';
import { ErrorFallbackProps } from '@/components/error/ComponentErrorBoundary';
import { ConnectionStatus } from '@/services/connectionStatusManager';
import { tokens } from '@/design-system/tokens';

/**
 * Props for the ConnectionStatusErrorHandler component
 */
interface ConnectionStatusErrorHandlerProps extends ErrorFallbackProps {
    /** Current connection status */
    status?: ConnectionStatus;
    /** Whether to show tooltip */
    showTooltip?: boolean;
    /** Click handler */
    onClick?: () => void;
    /** Additional CSS classes */
    className?: string;
}

/**
 * Specialized error handler for ConnectionStatusIndicator component.
 * Provides fallback rendering when the Badge component fails or other errors occur.
 */
export class ConnectionStatusErrorHandler {
    /**
     * Handle Badge component errors by providing text-based fallback
     */
    static handleBadgeError(error: Error, status: ConnectionStatus): React.ReactElement {
        console.warn('Badge component error in ConnectionStatusIndicator:', error);
        return ConnectionStatusErrorHandler.renderTextFallback(status);
    }

    /**
     * Handle general connection status errors
     */
    static handleStatusError(error: Error): ConnectionStatus {
        console.warn('Connection status error:', error);
        return ConnectionStatus.FALLBACK;
    }

    /**
     * Render text-based fallback when Badge component fails
     */
    static renderTextFallback(status: ConnectionStatus): React.ReactElement {
        const config = ConnectionStatusErrorHandler.getStatusConfig(status);

        const textStyles: React.CSSProperties = {
            display: 'inline-flex',
            alignItems: 'center',
            gap: tokens.spacing[1],
            padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
            borderRadius: tokens.borderRadius.sm,
            backgroundColor: tokens.colors.neutral[100],
            border: `1px solid ${config.color}`,
            color: config.color,
            fontSize: tokens.fontSize.sm,
            fontWeight: tokens.fontWeight.medium,
            lineHeight: 1,
        };

        const iconStyles: React.CSSProperties = {
            fontSize: '12px',
            color: config.color,
        };

        return (
            <span style={textStyles} title={config.text}>
                <span style={iconStyles}>{config.icon}</span>
                <span>{config.text}</span>
            </span>
        );
    }

    /**
     * Render minimal indicator for severe error cases
     */
    static renderMinimalIndicator(status: ConnectionStatus): React.ReactElement {
        const config = ConnectionStatusErrorHandler.getStatusConfig(status);

        const minimalStyles: React.CSSProperties = {
            display: 'inline-block',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: config.color,
            title: config.text,
        };

        return <span style={minimalStyles} title={config.text} />;
    }

    /**
     * Get configuration for different connection statuses
     */
    private static getStatusConfig(status: ConnectionStatus) {
        switch (status) {
            case ConnectionStatus.CONNECTED:
                return {
                    icon: '●',
                    text: 'Connected',
                    color: tokens.colors.success[600],
                };
            case ConnectionStatus.CONNECTING:
                return {
                    icon: '◐',
                    text: 'Connecting',
                    color: tokens.colors.warning[600],
                };
            case ConnectionStatus.RECONNECTING:
                return {
                    icon: '◑',
                    text: 'Reconnecting',
                    color: tokens.colors.warning[600],
                };
            case ConnectionStatus.DISCONNECTED:
                return {
                    icon: '○',
                    text: 'Disconnected',
                    color: tokens.colors.error[600],
                };
            case ConnectionStatus.FAILED:
                return {
                    icon: '✕',
                    text: 'Failed',
                    color: tokens.colors.error[600],
                };
            case ConnectionStatus.FALLBACK:
                return {
                    icon: '◒',
                    text: 'Fallback Mode',
                    color: tokens.colors.blue[600],
                };
            default:
                return {
                    icon: '?',
                    text: 'Unknown',
                    color: tokens.colors.neutral[600],
                };
        }
    }

    /**
     * Attempt to recover from error state
     */
    static async attemptRecovery(): Promise<boolean> {
        try {
            // Simple recovery attempt - wait a moment and return success
            await new Promise(resolve => setTimeout(resolve, 100));
            return true;
        } catch (error) {
            console.error('Recovery attempt failed:', error);
            return false;
        }
    }

    /**
     * Reset component state (placeholder for future implementation)
     */
    static resetComponent(): void {
        // This would be implemented based on specific component needs
        console.log('Resetting ConnectionStatusIndicator component');
    }
}

/**
 * React component that serves as error fallback for ConnectionStatusIndicator
 */
export const ConnectionStatusFallback: React.FC<ConnectionStatusErrorHandlerProps> = ({
    error,
    resetError,
    status = ConnectionStatus.FALLBACK,
    showTooltip = true,
    onClick,
    className = '',
}) => {
    const handleRetry = async () => {
        const recoverySuccess = await ConnectionStatusErrorHandler.attemptRecovery();
        if (recoverySuccess) {
            resetError();
        }
    };

    const fallbackStyles: React.CSSProperties = {
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: tokens.spacing[1],
    };

    const errorMessageStyles: React.CSSProperties = {
        fontSize: tokens.fontSize.xs,
        color: tokens.colors.error[600],
        marginTop: tokens.spacing[1],
    };

    const retryButtonStyles: React.CSSProperties = {
        fontSize: tokens.fontSize.xs,
        color: tokens.colors.blue[600],
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        textDecoration: 'underline',
        padding: 0,
        marginTop: tokens.spacing[1],
    };

    return (
        <div
            style={fallbackStyles}
            className={className}
            onClick={onClick}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
        >
            {ConnectionStatusErrorHandler.renderTextFallback(status)}

            {process.env.NODE_ENV === 'development' && (
                <div style={errorMessageStyles}>
                    Connection status error
                </div>
            )}

            <button
                style={retryButtonStyles}
                onClick={handleRetry}
                type="button"
            >
                Retry
            </button>
        </div>
    );
};

export default ConnectionStatusErrorHandler;