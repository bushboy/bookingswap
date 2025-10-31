import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { tokens } from '@/design-system/tokens';
import { TargetingAction } from './TargetingDetails';
import styles from './targeting-display.module.css';

export interface TargetingConfirmationDialogProps {
    isOpen: boolean;
    action: TargetingAction | null;
    targetDetails?: {
        bookingTitle: string;
        ownerName: string;
        location: string;
        price: number;
    };
    onConfirm: () => Promise<void>;
    onCancel: () => void;
    loading?: boolean;
}

/**
 * Confirmation dialog for targeting actions
 * Provides clear context and confirmation for destructive or important actions
 * Requirements: 5.3, 5.5, 5.6
 */
export const TargetingConfirmationDialog: React.FC<TargetingConfirmationDialogProps> = ({
    isOpen,
    action,
    targetDetails,
    onConfirm,
    onCancel,
    loading = false
}) => {
    const [isConfirming, setIsConfirming] = useState(false);

    const handleConfirm = useCallback(async () => {
        if (loading || isConfirming) return;

        setIsConfirming(true);
        try {
            await onConfirm();
        } catch (error) {
            console.error('Confirmation action failed:', error);
        } finally {
            setIsConfirming(false);
        }
    }, [onConfirm, loading, isConfirming]);

    const handleCancel = useCallback(() => {
        if (loading || isConfirming) return;
        onCancel();
    }, [onCancel, loading, isConfirming]);

    if (!isOpen || !action) {
        return null;
    }

    const getActionConfig = () => {
        switch (action.type) {
            case 'accept_target':
                return {
                    title: 'Accept Targeting Proposal',
                    message: `Are you sure you want to accept this targeting proposal from ${targetDetails?.ownerName || 'this user'}?`,
                    details: targetDetails ? [
                        `Booking: ${targetDetails.bookingTitle}`,
                        `Location: ${targetDetails.location}`,
                        `Value: $${targetDetails.price.toLocaleString()}`
                    ] : [],
                    confirmText: 'Accept Proposal',
                    confirmStyle: {
                        backgroundColor: tokens.colors.success[500],
                        borderColor: tokens.colors.success[500],
                        color: 'white'
                    },
                    icon: '✅',
                    severity: 'success' as const
                };

            case 'reject_target':
                return {
                    title: 'Reject Targeting Proposal',
                    message: `Are you sure you want to reject this targeting proposal from ${targetDetails?.ownerName || 'this user'}?`,
                    details: targetDetails ? [
                        `Booking: ${targetDetails.bookingTitle}`,
                        `Location: ${targetDetails.location}`,
                        `Value: $${targetDetails.price.toLocaleString()}`
                    ] : [],
                    confirmText: 'Reject Proposal',
                    confirmStyle: {
                        backgroundColor: tokens.colors.error[500],
                        borderColor: tokens.colors.error[500],
                        color: 'white'
                    },
                    icon: '❌',
                    severity: 'error' as const
                };

            case 'retarget':
                return {
                    title: 'Retarget Swap',
                    message: 'This will cancel your current targeting and allow you to select a new target.',
                    details: [
                        'Your current targeting proposal will be cancelled',
                        'You will be able to browse and select a new target',
                        'The target owner will be notified of the change'
                    ],
                    confirmText: 'Continue Retargeting',
                    confirmStyle: {
                        backgroundColor: tokens.colors.primary[500],
                        borderColor: tokens.colors.primary[500],
                        color: 'white'
                    },
                    icon: '🔄',
                    severity: 'warning' as const
                };

            case 'cancel_targeting':
                return {
                    title: 'Cancel Targeting',
                    message: 'Are you sure you want to cancel your targeting proposal?',
                    details: [
                        'This action cannot be undone',
                        'Your swap will no longer target any other swap',
                        'The target owner will be notified of the cancellation'
                    ],
                    confirmText: 'Cancel Targeting',
                    confirmStyle: {
                        backgroundColor: tokens.colors.error[500],
                        borderColor: tokens.colors.error[500],
                        color: 'white'
                    },
                    icon: '🚫',
                    severity: 'error' as const
                };

            default:
                return {
                    title: 'Confirm Action',
                    message: 'Are you sure you want to perform this action?',
                    details: [],
                    confirmText: 'Confirm',
                    confirmStyle: {
                        backgroundColor: tokens.colors.primary[500],
                        borderColor: tokens.colors.primary[500],
                        color: 'white'
                    },
                    icon: '❓',
                    severity: 'info' as const
                };
        }
    };

    const config = getActionConfig();

    return (
        <div className={styles.dialogOverlay} onClick={handleCancel}>
            <div
                className={`${styles.confirmationDialog} ${styles[config.severity]}`}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="dialog-title"
                aria-describedby="dialog-description"
            >
                <div className={styles.dialogHeader}>
                    <div className={styles.dialogIcon}>
                        {config.icon}
                    </div>
                    <h3 id="dialog-title" className={styles.dialogTitle}>
                        {config.title}
                    </h3>
                </div>

                <div className={styles.dialogContent}>
                    <p id="dialog-description" className={styles.dialogMessage}>
                        {config.message}
                    </p>

                    {config.details.length > 0 && (
                        <div className={styles.dialogDetails}>
                            <ul>
                                {config.details.map((detail, index) => (
                                    <li key={index}>{detail}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                <div className={styles.dialogActions}>
                    <Button
                        variant="ghost"
                        onClick={handleCancel}
                        disabled={loading || isConfirming}
                        style={{
                            color: tokens.colors.neutral[600]
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleConfirm}
                        disabled={loading || isConfirming}
                        loading={loading || isConfirming}
                        style={config.confirmStyle}
                    >
                        {loading || isConfirming ? 'Processing...' : config.confirmText}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default TargetingConfirmationDialog;