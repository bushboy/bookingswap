import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { tokens } from '@/design-system/tokens';
import { OutgoingTargetInfo, EnhancedTargetingRestriction } from '@booking-swap/shared';

export interface TargetingActionsProps {
    swapId: string;
    currentTarget?: OutgoingTargetInfo;
    canTarget: boolean;
    restrictions?: EnhancedTargetingRestriction[];
    onTarget?: (swapId: string, targetSwapId: string) => Promise<void>;
    onRetarget?: (swapId: string, currentTargetId: string) => Promise<void>;
    onCancelTargeting?: (swapId: string, targetId: string) => Promise<void>;
    onBrowseTargets?: (swapId: string) => void;
    className?: string;
    size?: 'small' | 'medium' | 'large';
    variant?: 'compact' | 'full';
}

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText: string;
    confirmVariant?: 'primary' | 'danger';
    loading?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText,
    confirmVariant = 'primary',
    loading = false,
}) => (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
        <div style={{ padding: tokens.spacing[4] }}>
            <p style={{
                marginBottom: tokens.spacing[6],
                color: tokens.colors.neutral[700],
                lineHeight: tokens.typography.lineHeight.normal,
            }}>
                {message}
            </p>
            <div style={{
                display: 'flex',
                gap: tokens.spacing[3],
                justifyContent: 'flex-end',
            }}>
                <Button
                    variant="outline"
                    onClick={onClose}
                    disabled={loading}
                >
                    Cancel
                </Button>
                <Button
                    variant={confirmVariant}
                    onClick={onConfirm}
                    loading={loading}
                >
                    {confirmText}
                </Button>
            </div>
        </div>
    </Modal>
);

/**
 * Component for targeting management actions
 * Provides targeting, retargeting, and cancel targeting functionality with confirmation dialogs
 */
export const TargetingActions: React.FC<TargetingActionsProps> = ({
    swapId,
    currentTarget,
    canTarget,
    restrictions = [],
    onTarget,
    onRetarget,
    onCancelTargeting,
    onBrowseTargets,
    className = '',
    size = 'medium',
    variant = 'compact',
}) => {
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [confirmationModal, setConfirmationModal] = useState<{
        type: 'target' | 'retarget' | 'cancel';
        isOpen: boolean;
        targetSwapId?: string;
    }>({ type: 'target', isOpen: false });

    const hasActiveTarget = currentTarget?.status === 'active';
    const hasCompletedTarget = currentTarget && ['accepted', 'rejected'].includes(currentTarget.status);

    // Check for blocking restrictions
    const blockingRestrictions = restrictions.filter(r => r.severity === 'error');
    const warningRestrictions = restrictions.filter(r => r.severity === 'warning');
    const isBlocked = blockingRestrictions.length > 0 || !canTarget;

    const handleAction = async (action: 'target' | 'retarget' | 'cancel', targetSwapId?: string) => {
        setActionLoading(action);

        try {
            switch (action) {
                case 'target':
                    if (onTarget && targetSwapId) {
                        await onTarget(swapId, targetSwapId);
                    }
                    break;
                case 'retarget':
                    if (onRetarget && currentTarget) {
                        await onRetarget(swapId, currentTarget.targetId);
                    }
                    break;
                case 'cancel':
                    if (onCancelTargeting && currentTarget) {
                        await onCancelTargeting(swapId, currentTarget.targetId);
                    }
                    break;
            }
            setConfirmationModal({ type: action, isOpen: false });
        } catch (error) {
            console.error(`Failed to ${action}:`, error);
        } finally {
            setActionLoading(null);
        }
    };

    const openConfirmation = (type: 'target' | 'retarget' | 'cancel', targetSwapId?: string) => {
        setConfirmationModal({ type, isOpen: true, targetSwapId });
    };

    const closeConfirmation = () => {
        setConfirmationModal({ type: 'target', isOpen: false });
    };

    const getConfirmationProps = () => {
        const { type } = confirmationModal;

        switch (type) {
            case 'target':
                return {
                    title: 'Confirm Targeting',
                    message: 'Are you sure you want to target this swap? This will create a proposal that the other user can accept or reject.',
                    confirmText: 'Target Swap',
                    confirmVariant: 'primary' as const,
                };
            case 'retarget':
                return {
                    title: 'Confirm Retargeting',
                    message: 'This will cancel your current targeting and allow you to select a new target. Are you sure you want to continue?',
                    confirmText: 'Retarget',
                    confirmVariant: 'primary' as const,
                };
            case 'cancel':
                return {
                    title: 'Cancel Targeting',
                    message: 'Are you sure you want to cancel your targeting proposal? This action cannot be undone.',
                    confirmText: 'Cancel Targeting',
                    confirmVariant: 'danger' as const,
                };
            default:
                return {
                    title: '',
                    message: '',
                    confirmText: '',
                    confirmVariant: 'primary' as const,
                };
        }
    };

    const renderRestrictions = () => {
        if (restrictions.length === 0) return null;

        return (
            <div style={{ marginBottom: tokens.spacing[3] }}>
                {blockingRestrictions.map((restriction, index) => (
                    <Badge
                        key={index}
                        variant="error"
                        size="small"
                        style={{
                            marginRight: tokens.spacing[2],
                            marginBottom: tokens.spacing[1],
                            display: 'inline-block',
                        }}
                    >
                        {restriction.message}
                    </Badge>
                ))}
                {warningRestrictions.map((restriction, index) => (
                    <Badge
                        key={index}
                        variant="warning"
                        size="small"
                        style={{
                            marginRight: tokens.spacing[2],
                            marginBottom: tokens.spacing[1],
                            display: 'inline-block',
                        }}
                    >
                        {restriction.message}
                    </Badge>
                ))}
            </div>
        );
    };

    const renderCompactActions = () => {
        if (hasActiveTarget) {
            return (
                <div style={{ display: 'flex', gap: tokens.spacing[2] }}>
                    <Button
                        variant="outline"
                        size={size}
                        onClick={() => openConfirmation('cancel')}
                        disabled={!!actionLoading}
                        loading={actionLoading === 'cancel'}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="secondary"
                        size={size}
                        onClick={() => openConfirmation('retarget')}
                        disabled={!!actionLoading}
                        loading={actionLoading === 'retarget'}
                    >
                        Retarget
                    </Button>
                </div>
            );
        }

        if (hasCompletedTarget) {
            return (
                <Button
                    variant="primary"
                    size={size}
                    onClick={() => onBrowseTargets?.(swapId)}
                    disabled={isBlocked || !!actionLoading}
                >
                    Find New Target
                </Button>
            );
        }

        return (
            <Button
                variant="primary"
                size={size}
                onClick={() => onBrowseTargets?.(swapId)}
                disabled={isBlocked || !!actionLoading}
            >
                Target Swap
            </Button>
        );
    };

    const renderFullActions = () => (
        <Card className="targeting-actions-card" padding="medium">
            <CardHeader>
                <CardTitle>Targeting Actions</CardTitle>
            </CardHeader>
            <CardContent>
                {renderRestrictions()}

                <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[3] }}>
                    {!hasActiveTarget && (
                        <Button
                            variant="primary"
                            size={size}
                            fullWidth
                            onClick={() => onBrowseTargets?.(swapId)}
                            disabled={isBlocked || !!actionLoading}
                        >
                            {hasCompletedTarget ? 'Find New Target' : 'Browse Available Swaps'}
                        </Button>
                    )}

                    {hasActiveTarget && (
                        <>
                            <Button
                                variant="secondary"
                                size={size}
                                fullWidth
                                onClick={() => openConfirmation('retarget')}
                                disabled={!!actionLoading}
                                loading={actionLoading === 'retarget'}
                            >
                                Change Target
                            </Button>
                            <Button
                                variant="outline"
                                size={size}
                                fullWidth
                                onClick={() => openConfirmation('cancel')}
                                disabled={!!actionLoading}
                                loading={actionLoading === 'cancel'}
                            >
                                Cancel Targeting
                            </Button>
                        </>
                    )}
                </div>

                {isBlocked && (
                    <div style={{
                        marginTop: tokens.spacing[3],
                        padding: tokens.spacing[3],
                        backgroundColor: tokens.colors.error[50],
                        borderRadius: tokens.borderRadius.md,
                        fontSize: tokens.typography.fontSize.sm,
                        color: tokens.colors.error[700],
                    }}>
                        Targeting is currently unavailable due to restrictions above.
                    </div>
                )}
            </CardContent>
        </Card>
    );

    const containerStyles = {
        display: 'flex',
        flexDirection: variant === 'full' ? 'column' as const : 'row' as const,
        gap: tokens.spacing[2],
        alignItems: variant === 'compact' ? 'center' : 'stretch',
    };

    const confirmationProps = getConfirmationProps();

    return (
        <div className={`targeting-actions ${className}`} style={containerStyles}>
            {variant === 'compact' ? renderCompactActions() : renderFullActions()}

            <ConfirmationModal
                isOpen={confirmationModal.isOpen}
                onClose={closeConfirmation}
                onConfirm={() => handleAction(
                    confirmationModal.type,
                    confirmationModal.targetSwapId
                )}
                loading={!!actionLoading}
                {...confirmationProps}
            />
        </div>
    );
};

export default TargetingActions;