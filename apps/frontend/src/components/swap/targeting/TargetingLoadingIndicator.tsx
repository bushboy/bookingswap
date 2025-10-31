import React from 'react';
import { Badge } from '@/components/ui/Badge';
import { tokens } from '@/design-system/tokens';
import { useOptimisticTargeting } from '@/hooks/useOptimisticTargeting';

export interface TargetingLoadingIndicatorProps {
    swapId?: string;
    targetId?: string;
    className?: string;
    size?: 'small' | 'medium' | 'large';
    showDetails?: boolean;
}

/**
 * Component for displaying loading states and progress indicators for targeting actions
 * Shows pending optimistic updates and retry attempts
 */
export const TargetingLoadingIndicator: React.FC<TargetingLoadingIndicatorProps> = ({
    swapId,
    targetId,
    className = '',
    size = 'medium',
    showDetails = false,
}) => {
    const { getPendingActions, isActionPending } = useOptimisticTargeting();

    const pendingActions = getPendingActions();
    const filteredActions = pendingActions.filter(action => {
        if (swapId && action.swapId !== swapId) return false;
        if (targetId && action.targetId !== targetId) return false;
        return true;
    });

    if (filteredActions.length === 0) {
        return null;
    }

    const getActionIcon = (actionType: string) => {
        switch (actionType) {
            case 'create_target':
                return '🎯';
            case 'accept_target':
                return '✅';
            case 'reject_target':
                return '❌';
            case 'cancel_target':
                return '🚫';
            case 'retarget':
                return '🔄';
            default:
                return '⏳';
        }
    };

    const getActionLabel = (actionType: string) => {
        switch (actionType) {
            case 'create_target':
                return 'Creating proposal';
            case 'accept_target':
                return 'Accepting';
            case 'reject_target':
                return 'Rejecting';
            case 'cancel_target':
                return 'Cancelling';
            case 'retarget':
                return 'Retargeting';
            default:
                return 'Processing';
        }
    };

    const containerStyles = {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing[2],
        flexWrap: 'wrap' as const,
    };

    const spinnerStyles = {
        display: 'inline-block',
        width: size === 'small' ? '12px' : size === 'medium' ? '16px' : '20px',
        height: size === 'small' ? '12px' : size === 'medium' ? '16px' : '20px',
        border: `2px solid ${tokens.colors.neutral[200]}`,
        borderTop: `2px solid ${tokens.colors.primary[500]}`,
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
    };

    const detailsStyles = {
        fontSize: tokens.typography.fontSize.xs,
        color: tokens.colors.neutral[600],
        marginTop: tokens.spacing[1],
    };

    return (
        <div className={`targeting-loading-indicator ${className}`} style={containerStyles}>
            {filteredActions.map((action) => (
                <Badge
                    key={action.id}
                    variant="info"
                    size={size}
                    title={`${getActionLabel(action.type)} - Started ${action.timestamp.toLocaleTimeString()}`}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[1] }}>
                        <div style={spinnerStyles} />
                        <span>{getActionIcon(action.type)}</span>
                        {showDetails && (
                            <span style={{ fontSize: '0.8em' }}>
                                {getActionLabel(action.type)}
                            </span>
                        )}
                    </div>
                </Badge>
            ))}

            {showDetails && filteredActions.length > 0 && (
                <div style={detailsStyles}>
                    {filteredActions.length} action{filteredActions.length > 1 ? 's' : ''} in progress
                </div>
            )}

            <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
        </div>
    );
};

/**
 * Component for displaying retry indicators
 */
export const TargetingRetryIndicator: React.FC<{
    actionType: string;
    targetId?: string;
    retryCount?: number;
    maxRetries?: number;
    className?: string;
}> = ({
    actionType,
    targetId,
    retryCount = 0,
    maxRetries = 3,
    className = '',
}) => {
        if (retryCount === 0) return null;

        const progress = (retryCount / maxRetries) * 100;

        return (
            <div className={`targeting-retry-indicator ${className}`}>
                <Badge
                    variant="warning"
                    size="small"
                    title={`Retry attempt ${retryCount} of ${maxRetries}`}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[1] }}>
                        <span>🔄</span>
                        <span style={{ fontSize: '0.8em' }}>
                            Retry {retryCount}/{maxRetries}
                        </span>
                    </div>
                </Badge>

                <div
                    style={{
                        width: '100%',
                        height: '2px',
                        backgroundColor: tokens.colors.neutral[200],
                        borderRadius: '1px',
                        marginTop: tokens.spacing[1],
                        overflow: 'hidden',
                    }}
                >
                    <div
                        style={{
                            width: `${progress}%`,
                            height: '100%',
                            backgroundColor: tokens.colors.warning[500],
                            transition: 'width 0.3s ease-in-out',
                        }}
                    />
                </div>
            </div>
        );
    };

/**
 * Component for displaying error recovery options
 */
export const TargetingErrorRecovery: React.FC<{
    error: string;
    actionType: string;
    onRetry?: () => void;
    onCancel?: () => void;
    className?: string;
}> = ({
    error,
    actionType,
    onRetry,
    onCancel,
    className = '',
}) => {
        const getActionLabel = (type: string) => {
            switch (type) {
                case 'create_target':
                    return 'create targeting proposal';
                case 'accept_target':
                    return 'accept proposal';
                case 'reject_target':
                    return 'reject proposal';
                case 'cancel_target':
                    return 'cancel targeting';
                case 'retarget':
                    return 'retarget swap';
                default:
                    return 'perform action';
            }
        };

        return (
            <div className={`targeting-error-recovery ${className}`}>
                <Badge variant="error" size="small">
                    <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[1] }}>
                        <span>⚠️</span>
                        <span style={{ fontSize: '0.8em' }}>
                            Failed to {getActionLabel(actionType)}
                        </span>
                    </div>
                </Badge>

                <div
                    style={{
                        fontSize: tokens.typography.fontSize.xs,
                        color: tokens.colors.error[600],
                        marginTop: tokens.spacing[1],
                        marginBottom: tokens.spacing[2],
                    }}
                >
                    {error}
                </div>

                <div style={{ display: 'flex', gap: tokens.spacing[2] }}>
                    {onRetry && (
                        <button
                            onClick={onRetry}
                            style={{
                                fontSize: tokens.typography.fontSize.xs,
                                color: tokens.colors.primary[600],
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                            }}
                        >
                            Retry
                        </button>
                    )}
                    {onCancel && (
                        <button
                            onClick={onCancel}
                            style={{
                                fontSize: tokens.typography.fontSize.xs,
                                color: tokens.colors.neutral[600],
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                            }}
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </div>
        );
    };

export default TargetingLoadingIndicator;