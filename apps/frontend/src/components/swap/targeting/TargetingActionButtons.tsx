import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { tokens } from '@/design-system/tokens';
import { TargetingAction } from './TargetingDetails';
import styles from './targeting-display.module.css';

export interface TargetingActionButtonsProps {
    targetId: string;
    swapId: string;
    targetType: 'incoming' | 'outgoing';
    status: 'active' | 'accepted' | 'rejected' | 'cancelled';
    actionable: boolean;
    onAction: (action: TargetingAction) => Promise<void>;
    disabled?: boolean;
    className?: string;
}

/**
 * Action buttons for targeting operations
 * Handles accept/reject for incoming targets and retarget/cancel for outgoing targets
 * Requirements: 5.1, 5.2, 5.5
 */
export const TargetingActionButtons: React.FC<TargetingActionButtonsProps> = ({
    targetId,
    swapId,
    targetType,
    status,
    actionable,
    onAction,
    disabled = false,
    className = ''
}) => {
    const [loadingAction, setLoadingAction] = useState<string | null>(null);

    const handleAction = useCallback(async (actionType: TargetingAction['type']) => {
        if (disabled || !actionable || loadingAction) return;

        setLoadingAction(actionType);
        try {
            await onAction({
                type: actionType,
                targetId,
                swapId,
                metadata: {
                    timestamp: new Date().toISOString(),
                    targetType,
                    status
                }
            });
        } catch (error) {
            console.error(`Failed to execute ${actionType}:`, error);
        } finally {
            setLoadingAction(null);
        }
    }, [targetId, swapId, targetType, status, actionable, disabled, loadingAction, onAction]);

    // Don't render if not actionable or status doesn't allow actions
    if (!actionable || status !== 'active') {
        return null;
    }

    return (
        <div className={`${styles.targetingActions} ${className}`}>
            {targetType === 'incoming' && (
                <>
                    <Button
                        size="small"
                        variant="primary"
                        onClick={() => handleAction('accept_target')}
                        disabled={disabled || loadingAction !== null}
                        loading={loadingAction === 'accept_target'}
                        style={{
                            backgroundColor: tokens.colors.success[500],
                            borderColor: tokens.colors.success[500],
                            color: 'white',
                            minWidth: '80px'
                        }}
                        aria-label={`Accept targeting proposal for ${targetId}`}
                    >
                        {loadingAction === 'accept_target' ? 'Accepting...' : 'Accept'}
                    </Button>
                    <Button
                        size="small"
                        variant="outline"
                        onClick={() => handleAction('reject_target')}
                        disabled={disabled || loadingAction !== null}
                        loading={loadingAction === 'reject_target'}
                        style={{
                            borderColor: tokens.colors.error[500],
                            color: tokens.colors.error[500],
                            minWidth: '80px'
                        }}
                        aria-label={`Reject targeting proposal for ${targetId}`}
                    >
                        {loadingAction === 'reject_target' ? 'Rejecting...' : 'Reject'}
                    </Button>
                </>
            )}

            {targetType === 'outgoing' && (
                <>
                    <Button
                        size="small"
                        variant="outline"
                        onClick={() => handleAction('retarget')}
                        disabled={disabled || loadingAction !== null}
                        loading={loadingAction === 'retarget'}
                        style={{
                            borderColor: tokens.colors.primary[500],
                            color: tokens.colors.primary[500],
                            minWidth: '80px'
                        }}
                        aria-label={`Retarget swap ${swapId}`}
                    >
                        {loadingAction === 'retarget' ? 'Retargeting...' : 'Retarget'}
                    </Button>
                    <Button
                        size="small"
                        variant="ghost"
                        onClick={() => handleAction('cancel_targeting')}
                        disabled={disabled || loadingAction !== null}
                        loading={loadingAction === 'cancel_targeting'}
                        style={{
                            color: tokens.colors.neutral[600],
                            minWidth: '80px'
                        }}
                        aria-label={`Cancel targeting for swap ${swapId}`}
                    >
                        {loadingAction === 'cancel_targeting' ? 'Cancelling...' : 'Cancel'}
                    </Button>
                </>
            )}
        </div>
    );
};

export default TargetingActionButtons;