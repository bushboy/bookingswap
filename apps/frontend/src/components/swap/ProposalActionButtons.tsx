import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { tokens } from '../../design-system/tokens';
import { useResponsive } from '../../hooks/useResponsive';
import { proposalToastService } from '../../services/proposalToastService';
import { ProposalStatusDisplay, ProposalStatusData } from './ProposalStatusDisplay';
import { PaymentTransaction, PaymentStatus } from '@booking-swap/shared';

export interface ProposalActionButtonsProps {
    /** Unique identifier for the proposal */
    proposalId: string;

    /** Current status of the proposal */
    status: 'pending' | 'accepted' | 'rejected' | 'expired';

    /** Proposal type for better messaging */
    proposalType?: 'booking' | 'cash';

    /** Target title for better messaging */
    targetTitle?: string;

    /** Whether the buttons should be disabled */
    disabled?: boolean;

    /** Whether any action is currently processing */
    isProcessing?: boolean;

    /** Callback when accept button is clicked */
    onAccept: (proposalId: string) => Promise<void> | void;

    /** Callback when reject button is clicked */
    onReject: (proposalId: string, reason?: string) => Promise<void> | void;

    /** Whether to show confirmation dialogs */
    showConfirmation?: boolean;

    /** Custom styling */
    className?: string;

    /** Layout orientation */
    orientation?: 'horizontal' | 'vertical';

    /** Button size */
    size?: 'sm' | 'md' | 'lg';

    /** Whether to show toast notifications */
    showToasts?: boolean;

    /** Payment and blockchain status data */
    statusData?: ProposalStatusData;

    /** Whether to show payment/blockchain status */
    showStatus?: boolean;

    /** Callback when retry is requested */
    onRetry?: (proposalId: string) => void;
}

export const ProposalActionButtons: React.FC<ProposalActionButtonsProps> = ({
    proposalId,
    status,
    proposalType = 'booking',
    targetTitle = 'Unknown',
    disabled = false,
    isProcessing = false,
    onAccept,
    onReject,
    showConfirmation = true,
    className = '',
    orientation = 'horizontal',
    size = 'md',
    showToasts = true,
    statusData,
    showStatus = true,
    onRetry,
}) => {
    const { isMobile } = useResponsive();

    const [actionLoading, setActionLoading] = useState<'accept' | 'reject' | null>(null);
    const [showAcceptConfirm, setShowAcceptConfirm] = useState(false);
    const [showRejectConfirm, setShowRejectConfirm] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [processingToastId, setProcessingToastId] = useState<string | null>(null);

    // Don't show buttons if proposal is not pending
    const canTakeAction = status === 'pending' && !disabled;

    if (!canTakeAction) {
        return null;
    }

    const handleAcceptClick = async () => {
        if (showConfirmation && !showAcceptConfirm) {
            setShowAcceptConfirm(true);
            return;
        }

        let toastId: string | null = null;

        try {
            setActionLoading('accept');
            setShowAcceptConfirm(false);

            // Show processing toast if enabled
            if (showToasts) {
                toastId = proposalToastService.showProcessingToast(
                    proposalId,
                    'accepting',
                    targetTitle
                );
                setProcessingToastId(toastId);
            }

            await onAccept(proposalId);

            // Show success toast
            if (showToasts) {
                if (toastId) {
                    proposalToastService.updateProcessingToast(
                        toastId,
                        { success: true, proposalId },
                        targetTitle
                    );
                }
                proposalToastService.showAcceptanceSuccess(
                    proposalId,
                    proposalType,
                    targetTitle
                );
            }
        } catch (error) {
            console.error('Error accepting proposal:', error);

            // Show error toast
            if (showToasts) {
                if (toastId) {
                    proposalToastService.updateProcessingToast(
                        toastId,
                        {
                            success: false,
                            proposalId,
                            errorMessage: error instanceof Error ? error.message : 'Unknown error'
                        },
                        targetTitle
                    );
                } else {
                    proposalToastService.showError(
                        proposalId,
                        error instanceof Error ? error.message : 'Failed to accept proposal',
                        targetTitle
                    );
                }
            }
        } finally {
            setActionLoading(null);
            setProcessingToastId(null);
        }
    };

    const handleRejectClick = async () => {
        if (showConfirmation && !showRejectConfirm) {
            setShowRejectConfirm(true);
            return;
        }

        let toastId: string | null = null;

        try {
            setActionLoading('reject');
            setShowRejectConfirm(false);

            // Show processing toast if enabled
            if (showToasts) {
                toastId = proposalToastService.showProcessingToast(
                    proposalId,
                    'rejecting',
                    targetTitle
                );
                setProcessingToastId(toastId);
            }

            await onReject(proposalId, rejectionReason.trim() || undefined);

            // Show success toast
            if (showToasts) {
                if (toastId) {
                    proposalToastService.updateProcessingToast(
                        toastId,
                        { success: true, proposalId },
                        targetTitle
                    );
                }
                proposalToastService.showRejectionSuccess(
                    proposalId,
                    proposalType,
                    targetTitle,
                    rejectionReason.trim() || undefined
                );
            }

            // Clear rejection reason
            setRejectionReason('');
        } catch (error) {
            console.error('Error rejecting proposal:', error);

            // Show error toast
            if (showToasts) {
                if (toastId) {
                    proposalToastService.updateProcessingToast(
                        toastId,
                        {
                            success: false,
                            proposalId,
                            errorMessage: error instanceof Error ? error.message : 'Unknown error'
                        },
                        targetTitle
                    );
                } else {
                    proposalToastService.showError(
                        proposalId,
                        error instanceof Error ? error.message : 'Failed to reject proposal',
                        targetTitle
                    );
                }
            }
        } finally {
            setActionLoading(null);
            setProcessingToastId(null);
        }
    };

    const handleCancelConfirm = () => {
        setShowAcceptConfirm(false);
        setShowRejectConfirm(false);
        setRejectionReason('');
    };

    const isButtonDisabled = isProcessing || actionLoading !== null;
    const actualOrientation = isMobile ? 'vertical' : orientation;

    const containerStyles = {
        display: 'flex',
        gap: tokens.spacing[3],
        flexDirection: actualOrientation === 'vertical' ? 'column' : 'row',
        alignItems: actualOrientation === 'vertical' ? 'stretch' : 'center',
        justifyContent: actualOrientation === 'horizontal' ? 'flex-end' : 'stretch',
    } as const;

    const confirmationStyles = {
        position: 'fixed' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: tokens.spacing[4],
    };

    const confirmationContentStyles = {
        backgroundColor: 'white',
        borderRadius: tokens.borderRadius.lg,
        padding: tokens.spacing[6],
        maxWidth: '400px',
        width: '100%',
        boxShadow: tokens.shadows.lg,
    };

    const confirmationButtonStyles = {
        display: 'flex',
        gap: tokens.spacing[3],
        justifyContent: 'flex-end',
        marginTop: tokens.spacing[4],
    };

    return (
        <>
            {/* Payment and Blockchain Status Display */}
            {showStatus && statusData && (
                <ProposalStatusDisplay
                    statusData={statusData}
                    compact={false}
                    showDetailsDefault={false}
                    allowToggleDetails={true}
                    onRetry={onRetry}
                    canRetry={!!onRetry && statusData.overallStatus === 'failed'}
                />
            )}

            <div className={className} style={containerStyles}>
                <Button
                    variant="outline"
                    size={size}
                    onClick={handleRejectClick}
                    disabled={isButtonDisabled}
                    loading={actionLoading === 'reject'}
                    style={{
                        borderColor: tokens.colors.error[300],
                        color: tokens.colors.error[700],
                        backgroundColor: actionLoading === 'reject' ? tokens.colors.error[50] : undefined,
                    }}
                    aria-label={`Reject proposal ${proposalId}`}
                    data-testid="reject-proposal-button"
                >
                    {actionLoading === 'reject' ? (
                        <>
                            <span role="img" aria-label="Processing">⏳</span>
                            Rejecting...
                        </>
                    ) : (
                        <>
                            <span role="img" aria-label="Reject">❌</span>
                            Reject
                        </>
                    )}
                </Button>

                <Button
                    variant="primary"
                    size={size}
                    onClick={handleAcceptClick}
                    disabled={isButtonDisabled}
                    loading={actionLoading === 'accept'}
                    style={{
                        backgroundColor: actionLoading === 'accept'
                            ? tokens.colors.success[600]
                            : tokens.colors.success[500],
                    }}
                    aria-label={`Accept proposal ${proposalId}`}
                    data-testid="accept-proposal-button"
                >
                    {actionLoading === 'accept' ? (
                        <>
                            <span role="img" aria-label="Processing">⏳</span>
                            Accepting...
                        </>
                    ) : (
                        <>
                            <span role="img" aria-label="Accept">✅</span>
                            Accept
                        </>
                    )}
                </Button>
            </div>

            {/* Accept Confirmation Dialog */}
            {showAcceptConfirm && (
                <div style={confirmationStyles} role="dialog" aria-modal="true" aria-labelledby="accept-confirm-title">
                    <div style={confirmationContentStyles}>
                        <h3
                            id="accept-confirm-title"
                            style={{
                                fontSize: tokens.typography.fontSize.lg,
                                fontWeight: tokens.typography.fontWeight.semibold,
                                color: tokens.colors.neutral[900],
                                margin: `0 0 ${tokens.spacing[3]} 0`,
                            }}
                        >
                            Accept Proposal
                        </h3>
                        <p style={{
                            fontSize: tokens.typography.fontSize.base,
                            color: tokens.colors.neutral[700],
                            margin: `0 0 ${tokens.spacing[4]} 0`,
                            lineHeight: tokens.typography.lineHeight.relaxed,
                        }}>
                            Are you sure you want to accept this proposal? This action will initiate the swap process and cannot be undone.
                        </p>
                        <div style={confirmationButtonStyles}>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCancelConfirm}
                                aria-label="Cancel acceptance"
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={handleAcceptClick}
                                loading={actionLoading === 'accept'}
                                style={{
                                    backgroundColor: tokens.colors.success[500],
                                }}
                                aria-label="Confirm acceptance"
                            >
                                Yes, Accept
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Confirmation Dialog */}
            {showRejectConfirm && (
                <div style={confirmationStyles} role="dialog" aria-modal="true" aria-labelledby="reject-confirm-title">
                    <div style={confirmationContentStyles}>
                        <h3
                            id="reject-confirm-title"
                            style={{
                                fontSize: tokens.typography.fontSize.lg,
                                fontWeight: tokens.typography.fontWeight.semibold,
                                color: tokens.colors.neutral[900],
                                margin: `0 0 ${tokens.spacing[3]} 0`,
                            }}
                        >
                            Reject Proposal
                        </h3>
                        <p style={{
                            fontSize: tokens.typography.fontSize.base,
                            color: tokens.colors.neutral[700],
                            margin: `0 0 ${tokens.spacing[4]} 0`,
                            lineHeight: tokens.typography.lineHeight.relaxed,
                        }}>
                            Are you sure you want to reject this proposal? The proposer will be notified of your decision.
                        </p>

                        {/* Rejection Reason Input */}
                        <div style={{ marginBottom: tokens.spacing[4] }}>
                            <label style={{
                                display: 'block',
                                fontSize: tokens.typography.fontSize.sm,
                                fontWeight: tokens.typography.fontWeight.medium,
                                color: tokens.colors.neutral[700],
                                marginBottom: tokens.spacing[2],
                            }}>
                                Reason for rejection (optional)
                            </label>
                            <textarea
                                placeholder="Let them know why you're rejecting this proposal..."
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                maxLength={200}
                                rows={3}
                                style={{
                                    width: '100%',
                                    padding: tokens.spacing[2],
                                    fontSize: tokens.typography.fontSize.sm,
                                    lineHeight: tokens.typography.lineHeight.normal,
                                    border: `1px solid ${tokens.colors.neutral[300]}`,
                                    borderRadius: tokens.borderRadius.md,
                                    backgroundColor: 'white',
                                    color: tokens.colors.neutral[900],
                                    outline: 'none',
                                    transition: 'all 0.2s ease-in-out',
                                    resize: 'vertical',
                                    fontFamily: 'inherit',
                                }}
                                onFocus={(e) => {
                                    e.target.style.borderColor = tokens.colors.primary[500];
                                    e.target.style.boxShadow = `0 0 0 3px ${tokens.colors.primary[200]}`;
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = tokens.colors.neutral[300];
                                    e.target.style.boxShadow = 'none';
                                }}
                            />
                            <p style={{
                                fontSize: tokens.typography.fontSize.xs,
                                color: tokens.colors.neutral[500],
                                margin: `${tokens.spacing[1]} 0 0 0`,
                                textAlign: 'right',
                            }}>
                                {rejectionReason.length}/200 characters
                            </p>
                        </div>

                        <div style={confirmationButtonStyles}>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCancelConfirm}
                                aria-label="Cancel rejection"
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="danger"
                                size="sm"
                                onClick={handleRejectClick}
                                loading={actionLoading === 'reject'}
                                aria-label="Confirm rejection"
                            >
                                Yes, Reject
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ProposalActionButtons;