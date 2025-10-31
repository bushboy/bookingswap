import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { tokens } from '@/design-system/tokens';
import { useResponsive } from '@/hooks/useResponsive';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { LoadingSpinner } from '@/components/ui/LoadingIndicator';
import { Modal } from '@/components/ui/Modal';
import { TargetingModal } from './TargetingModal';
import { TargetingHistory } from './TargetingHistory';
import { TargetingStatusDisplay } from './TargetingStatusDisplay';
import {
    SwapTarget,
    SwapWithTargeting,
} from '@booking-swap/shared';
import {
    selectCurrentTarget,
    selectTargetingLoading,
    selectTargetingError,
    selectTargetingOperation,
    selectIsTargeting,
    selectIsRetargeting,
    selectIsRemovingTarget,
    openTargetingModal,
    closeTargetingModal,
} from '@/store/slices/targetingSlice';
import {
    removeTarget,
} from '@/store/thunks/targetingThunks';

interface TargetManagerProps {
    userSwap: SwapWithTargeting;
    currentTarget?: SwapTarget | null;
    onTargetChange?: (targetSwapId: string | null) => void;
    onRetarget?: (newTargetSwapId: string) => void;
    className?: string;
    style?: React.CSSProperties;
    showHistory?: boolean;
    showStatusDisplay?: boolean;
    showIncomingTargets?: boolean;
}

interface TargetingControlsProps {
    userSwap: SwapWithTargeting;
    currentTarget: SwapTarget | null;
    isLoading: boolean;
    onOpenTargeting: () => void;
    onRetarget: () => void;
    onRemoveTarget: () => void;
}

interface RemoveTargetConfirmationProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    currentTarget: SwapTarget | null;
    isLoading: boolean;
}

// Remove Target Confirmation Modal
const RemoveTargetConfirmation: React.FC<RemoveTargetConfirmationProps> = ({
    isOpen,
    onClose,
    onConfirm,
    currentTarget,
    isLoading,
}) => {
    const { isMobile } = useResponsive();

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Remove Target"
            size="sm"
        >
            <div style={{ textAlign: 'center' }}>
                <div
                    style={{
                        fontSize: tokens.typography.fontSize.lg,
                        color: tokens.colors.neutral[700],
                        marginBottom: tokens.spacing[4],
                    }}
                >
                    Are you sure you want to remove your current target?
                </div>

                {currentTarget && (
                    <Alert variant="warning" style={{ marginBottom: tokens.spacing[6] }}>
                        <AlertDescription>
                            This will cancel your proposal and make your swap available for general targeting again.
                        </AlertDescription>
                    </Alert>
                )}

                <div
                    style={{
                        display: 'flex',
                        gap: tokens.spacing[3],
                        justifyContent: 'center',
                        flexDirection: isMobile ? 'column' : 'row',
                    }}
                >
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isLoading}
                        style={{ minWidth: isMobile ? '100%' : '120px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="danger"
                        onClick={onConfirm}
                        loading={isLoading}
                        style={{ minWidth: isMobile ? '100%' : '120px' }}
                    >
                        Remove Target
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

// Targeting Controls Component
const TargetingControls: React.FC<TargetingControlsProps> = ({
    userSwap,
    currentTarget,
    isLoading,
    onOpenTargeting,
    onRetarget,
    onRemoveTarget,
}) => {
    const { isMobile } = useResponsive();

    const isTargeting = useSelector((state: any) => selectIsTargeting(state, userSwap.id));
    const isRetargeting = useSelector((state: any) => selectIsRetargeting(state, userSwap.id));
    const isRemoving = useSelector((state: any) => selectIsRemovingTarget(state, userSwap.id));

    const hasActiveTarget = currentTarget?.status === 'active';
    const isAnyOperationInProgress = isTargeting || isRetargeting || isRemoving || isLoading;

    return (
        <div
            style={{
                display: 'flex',
                gap: tokens.spacing[3],
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: isMobile ? 'stretch' : 'center',
            }}
        >
            {!hasActiveTarget ? (
                <Button
                    variant="primary"
                    onClick={onOpenTargeting}
                    disabled={isAnyOperationInProgress}
                    loading={isTargeting}
                    style={{ flex: isMobile ? 1 : 'none' }}
                >
                    Target a Swap
                </Button>
            ) : (
                <>
                    <Button
                        variant="outline"
                        onClick={onRetarget}
                        disabled={isAnyOperationInProgress}
                        loading={isRetargeting}
                        style={{ flex: isMobile ? 1 : 'none' }}
                    >
                        Change Target
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={onRemoveTarget}
                        disabled={isAnyOperationInProgress}
                        loading={isRemoving}
                        style={{
                            flex: isMobile ? 1 : 'none',
                            color: tokens.colors.error[600],
                        }}
                    >
                        Remove Target
                    </Button>
                </>
            )}
        </div>
    );
};

// Current Target Display Component
interface CurrentTargetDisplayProps {
    currentTarget: SwapTarget | null;
    isLoading: boolean;
}

const CurrentTargetDisplay: React.FC<CurrentTargetDisplayProps> = ({
    currentTarget,
    isLoading,
}) => {
    if (isLoading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2] }}>
                <LoadingSpinner size="sm" />
                <span style={{ color: tokens.colors.neutral[600] }}>
                    Loading target information...
                </span>
            </div>
        );
    }

    if (!currentTarget) {
        return (
            <Alert variant="info">
                <AlertDescription>
                    Your swap is available for general targeting. Use the "Target a Swap" button to target a specific swap.
                </AlertDescription>
            </Alert>
        );
    }

    const statusColors = {
        active: tokens.colors.success[600],
        cancelled: tokens.colors.neutral[500],
        accepted: tokens.colors.success[700],
        rejected: tokens.colors.error[600],
    };

    const statusLabels = {
        active: 'Active',
        cancelled: 'Cancelled',
        accepted: 'Accepted',
        rejected: 'Rejected',
    };

    return (
        <div
            style={{
                padding: tokens.spacing[4],
                backgroundColor: tokens.colors.neutral[50],
                borderRadius: tokens.borderRadius.md,
                border: `1px solid ${tokens.colors.neutral[200]}`,
            }}
        >
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: tokens.spacing[3],
                }}
            >
                <div>
                    <div
                        style={{
                            fontSize: tokens.typography.fontSize.sm,
                            color: tokens.colors.neutral[600],
                            marginBottom: tokens.spacing[1],
                        }}
                    >
                        Currently targeting:
                    </div>
                    <div
                        style={{
                            fontSize: tokens.typography.fontSize.lg,
                            fontWeight: tokens.typography.fontWeight.medium,
                            color: tokens.colors.neutral[900],
                        }}
                    >
                        Swap #{currentTarget.targetSwapId.slice(-8)}
                    </div>
                </div>

                <div
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: `${tokens.spacing[1]} ${tokens.spacing[3]}`,
                        backgroundColor: 'white',
                        borderRadius: tokens.borderRadius.full,
                        border: `1px solid ${statusColors[currentTarget.status]}`,
                        color: statusColors[currentTarget.status],
                        fontSize: tokens.typography.fontSize.sm,
                        fontWeight: tokens.typography.fontWeight.medium,
                    }}
                >
                    <div
                        style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: statusColors[currentTarget.status],
                            marginRight: tokens.spacing[2],
                        }}
                    />
                    {statusLabels[currentTarget.status]}
                </div>
            </div>

            <div
                style={{
                    fontSize: tokens.typography.fontSize.sm,
                    color: tokens.colors.neutral[600],
                }}
            >
                Targeted on {new Date(currentTarget.createdAt).toLocaleDateString()}
                {currentTarget.proposalId && (
                    <span style={{ marginLeft: tokens.spacing[2] }}>
                        • Proposal ID: {currentTarget.proposalId.slice(-8)}
                    </span>
                )}
            </div>
        </div>
    );
};

// Main TargetManager Component
export const TargetManager: React.FC<TargetManagerProps> = ({
    userSwap,
    currentTarget: propCurrentTarget,
    onTargetChange,
    onRetarget,
    className,
    style,
    showHistory = true,
    showStatusDisplay = true,
    showIncomingTargets = true,
}) => {
    const dispatch = useDispatch();

    // Redux state
    const reduxCurrentTarget = useSelector(selectCurrentTarget);
    const isLoading = useSelector(selectTargetingLoading);
    const error = useSelector(selectTargetingError);
    const operation = useSelector(selectTargetingOperation);

    // Local state
    const [showRemoveConfirmation, setShowRemoveConfirmation] = useState(false);

    // Use prop target or redux target
    const currentTarget = propCurrentTarget ?? reduxCurrentTarget;

    // Effect to handle successful operations
    useEffect(() => {
        if (operation.step === 'success') {
            // Close modal after successful operation
            setTimeout(() => {
                dispatch(closeTargetingModal());
            }, 1500);
        }
    }, [operation.step, dispatch]);

    // Event handlers
    const handleOpenTargeting = () => {
        dispatch(openTargetingModal({ sourceSwapId: userSwap.id }));
    };

    const handleRetarget = () => {
        dispatch(openTargetingModal({
            sourceSwapId: userSwap.id,
            targetSwapId: currentTarget?.targetSwapId
        }));
    };

    const handleRemoveTarget = () => {
        setShowRemoveConfirmation(true);
    };

    const handleConfirmRemoveTarget = async () => {
        if (currentTarget) {
            try {
                await dispatch(removeTarget({ sourceSwapId: userSwap.id }) as any).unwrap();
                onTargetChange?.(null);
                setShowRemoveConfirmation(false);
            } catch (error) {
                // Error is handled by Redux
                console.error('Failed to remove target:', error);
            }
        }
    };

    const handleCloseRemoveConfirmation = () => {
        setShowRemoveConfirmation(false);
    };

    return (
        <div className={className} style={style}>
            <Card variant="outlined" padding="lg">
                <CardHeader>
                    <CardTitle>Swap Targeting</CardTitle>
                    <CardDescription>
                        Manage your swap's targeting to propose exchanges with other users
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    <div style={{ marginBottom: tokens.spacing[6] }}>
                        <CurrentTargetDisplay
                            currentTarget={currentTarget}
                            isLoading={isLoading}
                        />
                    </div>

                    {error && (
                        <Alert variant="error" style={{ marginBottom: tokens.spacing[4] }}>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <TargetingControls
                        userSwap={userSwap}
                        currentTarget={currentTarget}
                        isLoading={isLoading}
                        onOpenTargeting={handleOpenTargeting}
                        onRetarget={handleRetarget}
                        onRemoveTarget={handleRemoveTarget}
                    />

                    {/* Success message for completed operations */}
                    {operation.step === 'success' && (
                        <Alert variant="success" style={{ marginTop: tokens.spacing[4] }}>
                            <AlertDescription>
                                Targeting operation completed successfully!
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {/* Targeting Status Display */}
            {showStatusDisplay && (
                <div style={{ marginTop: tokens.spacing[6] }}>
                    <TargetingStatusDisplay
                        userSwap={userSwap}
                        showIncomingTargets={showIncomingTargets}
                    />
                </div>
            )}

            {/* Targeting History */}
            {showHistory && (
                <div style={{ marginTop: tokens.spacing[6] }}>
                    <TargetingHistory
                        swapId={userSwap.id}
                        maxItems={10}
                    />
                </div>
            )}

            {/* Remove Target Confirmation Modal */}
            <RemoveTargetConfirmation
                isOpen={showRemoveConfirmation}
                onClose={handleCloseRemoveConfirmation}
                onConfirm={handleConfirmRemoveTarget}
                currentTarget={currentTarget}
                isLoading={isLoading}
            />

            {/* Targeting Modal */}
            <TargetingModal
                userSwap={userSwap}
                onSwapSelect={onTargetChange}
            />
        </div>
    );
};

export default TargetManager;