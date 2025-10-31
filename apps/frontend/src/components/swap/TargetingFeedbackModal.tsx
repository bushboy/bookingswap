import React from 'react';
import { Modal, Button, Badge } from '../ui';
import { tokens } from '../../design-system/tokens';
import { SwapWithProposalInfo } from '@booking-swap/shared';
import { FEATURE_FLAGS } from '../../config/featureFlags';

interface TargetingFeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'success' | 'error' | 'warning';
    title: string;
    message: string;
    targetSwap?: SwapWithProposalInfo;
    sourceSwap?: SwapWithProposalInfo;
    details?: string[];
    actionButton?: {
        text: string;
        onClick: () => void;
        variant?: 'primary' | 'outline' | 'ghost';
    };
    isRetargeting?: boolean;
}

const getIconForType = (type: 'success' | 'error' | 'warning'): string => {
    switch (type) {
        case 'success':
            return '✅';
        case 'error':
            return '❌';
        case 'warning':
            return '⚠️';
        default:
            return 'ℹ️';
    }
};

const getColorForType = (type: 'success' | 'error' | 'warning') => {
    switch (type) {
        case 'success':
            return {
                bg: tokens.colors.success[50],
                border: tokens.colors.success[200],
                text: tokens.colors.success[700],
                icon: tokens.colors.success[600],
            };
        case 'error':
            return {
                bg: tokens.colors.error[50],
                border: tokens.colors.error[200],
                text: tokens.colors.error[700],
                icon: tokens.colors.error[600],
            };
        case 'warning':
            return {
                bg: tokens.colors.warning[50],
                border: tokens.colors.warning[200],
                text: tokens.colors.warning[700],
                icon: tokens.colors.warning[600],
            };
        default:
            return {
                bg: tokens.colors.neutral[50],
                border: tokens.colors.neutral[200],
                text: tokens.colors.neutral[700],
                icon: tokens.colors.neutral[600],
            };
    }
};

const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(amount);
};

export const TargetingFeedbackModal: React.FC<TargetingFeedbackModalProps> = ({
    isOpen,
    onClose,
    type,
    title,
    message,
    targetSwap,
    sourceSwap,
    details,
    actionButton,
    isRetargeting = false,
}) => {
    const colors = getColorForType(type);
    const icon = getIconForType(type);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            size="md"
        >
            <div style={{ padding: tokens.spacing[6] }}>
                {/* Header with Icon */}
                <div
                    style={{
                        textAlign: 'center',
                        marginBottom: tokens.spacing[6],
                    }}
                >
                    <div
                        style={{
                            fontSize: '64px',
                            marginBottom: tokens.spacing[3],
                            color: colors.icon,
                        }}
                    >
                        {icon}
                    </div>
                    <h3
                        style={{
                            fontSize: tokens.typography.fontSize.xl,
                            fontWeight: tokens.typography.fontWeight.semibold,
                            color: tokens.colors.neutral[900],
                            margin: `0 0 ${tokens.spacing[2]} 0`,
                        }}
                    >
                        {title}
                    </h3>
                </div>

                {/* Main Message */}
                <div
                    style={{
                        padding: tokens.spacing[4],
                        backgroundColor: colors.bg,
                        borderRadius: tokens.borderRadius.md,
                        border: `1px solid ${colors.border}`,
                        marginBottom: tokens.spacing[6],
                    }}
                >
                    <p
                        style={{
                            fontSize: tokens.typography.fontSize.base,
                            color: colors.text,
                            margin: 0,
                            lineHeight: tokens.typography.lineHeight.relaxed,
                        }}
                    >
                        {message}
                    </p>
                </div>

                {/* Success Details */}
                {type === 'success' && targetSwap && (
                    <div
                        style={{
                            padding: tokens.spacing[4],
                            backgroundColor: tokens.colors.neutral[50],
                            borderRadius: tokens.borderRadius.md,
                            border: `1px solid ${tokens.colors.neutral[200]}`,
                            marginBottom: tokens.spacing[6],
                        }}
                    >
                        <h4
                            style={{
                                fontSize: tokens.typography.fontSize.base,
                                fontWeight: tokens.typography.fontWeight.semibold,
                                color: tokens.colors.neutral[900],
                                margin: `0 0 ${tokens.spacing[3]} 0`,
                                display: 'flex',
                                alignItems: 'center',
                                gap: tokens.spacing[2],
                            }}
                        >
                            <span>🎯</span>
                            {isRetargeting ? 'Retargeting Complete' : 'Targeting Active'}
                        </h4>

                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'auto 1fr',
                                gap: `${tokens.spacing[2]} ${tokens.spacing[4]}`,
                                fontSize: tokens.typography.fontSize.sm,
                                color: tokens.colors.neutral[700],
                            }}
                        >
                            <span style={{ fontWeight: tokens.typography.fontWeight.medium }}>
                                Target Swap:
                            </span>
                            <span>{targetSwap.sourceBooking?.title || 'Untitled Booking'}</span>

                            <span style={{ fontWeight: tokens.typography.fontWeight.medium }}>
                                Location:
                            </span>
                            <span>
                                {targetSwap.sourceBooking?.location?.city || 'Unknown'},{' '}
                                {targetSwap.sourceBooking?.location?.country || 'Unknown'}
                            </span>

                            <span style={{ fontWeight: tokens.typography.fontWeight.medium }}>
                                Value:
                            </span>
                            <span>{formatCurrency(targetSwap.sourceBooking?.swapValue || 0)}</span>

                            {FEATURE_FLAGS.ENABLE_AUCTION_MODE && targetSwap.auctionInfo?.isAuction && (
                                <>
                                    <span style={{ fontWeight: tokens.typography.fontWeight.medium }}>
                                        Mode:
                                    </span>
                                    <span>
                                        <Badge variant="primary" size="sm">
                                            🏆 Auction Mode
                                        </Badge>
                                    </span>
                                </>
                            )}

                            {FEATURE_FLAGS.ENABLE_AUCTION_MODE && targetSwap.auctionInfo?.endDate && (
                                <>
                                    <span style={{ fontWeight: tokens.typography.fontWeight.medium }}>
                                        {targetSwap.auctionInfo.isAuction ? 'Auction Ends:' : 'Expires:'}
                                    </span>
                                    <span>{formatDate(targetSwap.auctionInfo.endDate)}</span>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Error Details */}
                {type === 'error' && details && details.length > 0 && (
                    <div
                        style={{
                            padding: tokens.spacing[4],
                            backgroundColor: tokens.colors.error[50],
                            borderRadius: tokens.borderRadius.md,
                            border: `1px solid ${tokens.colors.error[200]}`,
                            marginBottom: tokens.spacing[6],
                        }}
                    >
                        <h4
                            style={{
                                fontSize: tokens.typography.fontSize.base,
                                fontWeight: tokens.typography.fontWeight.semibold,
                                color: tokens.colors.error[700],
                                margin: `0 0 ${tokens.spacing[3]} 0`,
                            }}
                        >
                            Error Details:
                        </h4>
                        <ul
                            style={{
                                margin: 0,
                                paddingLeft: tokens.spacing[5],
                                fontSize: tokens.typography.fontSize.sm,
                                color: tokens.colors.error[600],
                                lineHeight: tokens.typography.lineHeight.relaxed,
                            }}
                        >
                            {details.map((detail, index) => (
                                <li key={index} style={{ marginBottom: tokens.spacing[1] }}>
                                    {detail}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Warning Details */}
                {type === 'warning' && details && details.length > 0 && (
                    <div
                        style={{
                            padding: tokens.spacing[4],
                            backgroundColor: tokens.colors.warning[50],
                            borderRadius: tokens.borderRadius.md,
                            border: `1px solid ${tokens.colors.warning[200]}`,
                            marginBottom: tokens.spacing[6],
                        }}
                    >
                        <h4
                            style={{
                                fontSize: tokens.typography.fontSize.base,
                                fontWeight: tokens.typography.fontWeight.semibold,
                                color: tokens.colors.warning[700],
                                margin: `0 0 ${tokens.spacing[3]} 0`,
                            }}
                        >
                            Important Information:
                        </h4>
                        <ul
                            style={{
                                margin: 0,
                                paddingLeft: tokens.spacing[5],
                                fontSize: tokens.typography.fontSize.sm,
                                color: tokens.colors.warning[600],
                                lineHeight: tokens.typography.lineHeight.relaxed,
                            }}
                        >
                            {details.map((detail, index) => (
                                <li key={index} style={{ marginBottom: tokens.spacing[1] }}>
                                    {detail}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Next Steps for Success */}
                {type === 'success' && (
                    <div
                        style={{
                            padding: tokens.spacing[4],
                            backgroundColor: tokens.colors.blue[50],
                            borderRadius: tokens.borderRadius.md,
                            border: `1px solid ${tokens.colors.blue[200]}`,
                            marginBottom: tokens.spacing[6],
                        }}
                    >
                        <h4
                            style={{
                                fontSize: tokens.typography.fontSize.base,
                                fontWeight: tokens.typography.fontWeight.semibold,
                                color: tokens.colors.blue[700],
                                margin: `0 0 ${tokens.spacing[3]} 0`,
                            }}
                        >
                            What's Next:
                        </h4>
                        <ul
                            style={{
                                margin: 0,
                                paddingLeft: tokens.spacing[5],
                                fontSize: tokens.typography.fontSize.sm,
                                color: tokens.colors.blue[600],
                                lineHeight: tokens.typography.lineHeight.relaxed,
                            }}
                        >
                            <li style={{ marginBottom: tokens.spacing[2] }}>
                                {FEATURE_FLAGS.ENABLE_AUCTION_MODE && targetSwap?.auctionInfo?.isAuction
                                    ? 'Your proposal has been added to the auction'
                                    : 'A proposal has been created for the target swap'}
                            </li>
                            <li style={{ marginBottom: tokens.spacing[2] }}>
                                You'll receive notifications about proposal status changes
                            </li>
                            <li style={{ marginBottom: tokens.spacing[2] }}>
                                You can view targeting details in your swap dashboard
                            </li>
                            <li>
                                You can retarget or cancel targeting at any time before acceptance
                            </li>
                        </ul>
                    </div>
                )}

                {/* Action Buttons */}
                <div
                    style={{
                        display: 'flex',
                        gap: tokens.spacing[3],
                        justifyContent: 'flex-end',
                    }}
                >
                    {actionButton && (
                        <Button
                            variant={actionButton.variant || 'outline'}
                            onClick={actionButton.onClick}
                        >
                            {actionButton.text}
                        </Button>
                    )}
                    <Button
                        variant={type === 'success' ? 'primary' : 'outline'}
                        onClick={onClose}
                    >
                        {type === 'success' ? 'Great!' : 'Close'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

// Predefined feedback modal configurations
export const TargetingSuccessModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    targetSwap: SwapWithProposalInfo;
    sourceSwap: SwapWithProposalInfo;
    isRetargeting?: boolean;
    onViewDetails?: () => void;
}> = ({ isOpen, onClose, targetSwap, sourceSwap, isRetargeting = false, onViewDetails }) => (
    <TargetingFeedbackModal
        isOpen={isOpen}
        onClose={onClose}
        type="success"
        title={isRetargeting ? 'Retargeting Successful!' : 'Targeting Successful!'}
        message={
            isRetargeting
                ? `Your swap has been successfully retargeted to "${targetSwap.sourceBooking?.title}". Your previous target has been cancelled.`
                : `Your swap "${sourceSwap.sourceBooking?.title}" is now targeting "${targetSwap.sourceBooking?.title}".`
        }
        targetSwap={targetSwap}
        sourceSwap={sourceSwap}
        isRetargeting={isRetargeting}
        actionButton={
            onViewDetails
                ? {
                    text: 'View Details',
                    onClick: onViewDetails,
                    variant: 'outline',
                }
                : undefined
        }
    />
);

export const TargetingErrorModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    error: string;
    details?: string[];
    onRetry?: () => void;
}> = ({ isOpen, onClose, error, details, onRetry }) => (
    <TargetingFeedbackModal
        isOpen={isOpen}
        onClose={onClose}
        type="error"
        title="Targeting Failed"
        message={error}
        details={details}
        actionButton={
            onRetry
                ? {
                    text: 'Try Again',
                    onClick: onRetry,
                    variant: 'primary',
                }
                : undefined
        }
    />
);

export const TargetingRemovalModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    targetSwap: SwapWithProposalInfo;
    loading?: boolean;
}> = ({ isOpen, onClose, onConfirm, targetSwap, loading = false }) => (
    <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Remove Targeting"
        size="md"
    >
        <div style={{ padding: tokens.spacing[6] }}>
            <div
                style={{
                    textAlign: 'center',
                    marginBottom: tokens.spacing[6],
                }}
            >
                <div style={{ fontSize: '48px', marginBottom: tokens.spacing[2] }}>
                    🗑️
                </div>
                <h3
                    style={{
                        fontSize: tokens.typography.fontSize.xl,
                        fontWeight: tokens.typography.fontWeight.semibold,
                        color: tokens.colors.neutral[900],
                        margin: `0 0 ${tokens.spacing[2]} 0`,
                    }}
                >
                    Remove Targeting
                </h3>
                <p
                    style={{
                        fontSize: tokens.typography.fontSize.base,
                        color: tokens.colors.neutral[600],
                        margin: 0,
                    }}
                >
                    Are you sure you want to stop targeting this swap?
                </p>
            </div>

            <div
                style={{
                    padding: tokens.spacing[4],
                    backgroundColor: tokens.colors.warning[50],
                    borderRadius: tokens.borderRadius.md,
                    border: `1px solid ${tokens.colors.warning[200]}`,
                    marginBottom: tokens.spacing[6],
                }}
            >
                <h4
                    style={{
                        fontSize: tokens.typography.fontSize.base,
                        fontWeight: tokens.typography.fontWeight.semibold,
                        color: tokens.colors.warning[700],
                        margin: `0 0 ${tokens.spacing[2]} 0`,
                    }}
                >
                    Target: {targetSwap.sourceBooking?.title}
                </h4>
                <p
                    style={{
                        fontSize: tokens.typography.fontSize.sm,
                        color: tokens.colors.warning[600],
                        margin: `0 0 ${tokens.spacing[3]} 0`,
                    }}
                >
                    Removing targeting will:
                </p>
                <ul
                    style={{
                        margin: 0,
                        paddingLeft: tokens.spacing[5],
                        fontSize: tokens.typography.fontSize.sm,
                        color: tokens.colors.warning[600],
                    }}
                >
                    <li>Cancel any pending proposal for this swap</li>
                    <li>Return your swap to general availability</li>
                    <li>Allow you to target a different swap</li>
                </ul>
            </div>

            <div
                style={{
                    display: 'flex',
                    gap: tokens.spacing[3],
                    justifyContent: 'flex-end',
                }}
            >
                <Button variant="outline" onClick={onClose} disabled={loading}>
                    Cancel
                </Button>
                <Button variant="danger" onClick={onConfirm} disabled={loading}>
                    {loading ? (
                        <>
                            <span style={{ marginRight: tokens.spacing[2] }}>⏳</span>
                            Removing...
                        </>
                    ) : (
                        <>
                            <span style={{ marginRight: tokens.spacing[2] }}>🗑️</span>
                            Remove Targeting
                        </>
                    )}
                </Button>
            </div>
        </div>
    </Modal>
);