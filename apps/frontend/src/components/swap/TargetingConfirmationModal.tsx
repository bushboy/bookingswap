import React, { useState } from 'react';
import { Modal, Button, Badge } from '../ui';
import { tokens } from '../../design-system/tokens';
import { SwapWithProposalInfo } from '@booking-swap/shared';
import { BookingType } from '@booking-swap/shared';

interface TargetingConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    sourceSwap: SwapWithProposalInfo;
    targetSwap: SwapWithProposalInfo;
    loading?: boolean;
    isRetargeting?: boolean;
    previousTarget?: SwapWithProposalInfo;
}

const getBookingTypeIcon = (type: BookingType): string => {
    switch (type) {
        case 'hotel':
            return '🏨';
        case 'vacation_rental':
            return '🏠';
        case 'resort':
            return '🏖️';
        case 'hostel':
            return '🏠';
        case 'bnb':
            return '🏡';
        case 'event':
            return '🎫';
        case 'concert':
            return '🎵';
        case 'sports':
            return '⚽';
        case 'theater':
            return '🎭';
        case 'flight':
            return '✈️';
        case 'rental':
            return '🚗';
        default:
            return '📋';
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

const SwapSummaryCard: React.FC<{ swap: SwapWithProposalInfo; title: string; variant: 'source' | 'target' }> = ({
    swap,
    title,
    variant,
}) => (
    <div
        style={{
            border: `2px solid ${variant === 'source' ? tokens.colors.primary[300] : tokens.colors.neutral[300]}`,
            borderRadius: tokens.borderRadius.lg,
            padding: tokens.spacing[4],
            backgroundColor: variant === 'source' ? tokens.colors.primary[50] : tokens.colors.neutral[50],
        }}
    >
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: tokens.spacing[2],
                marginBottom: tokens.spacing[3],
            }}
        >
            <span style={{ fontSize: '18px' }}>
                {getBookingTypeIcon(swap.sourceBooking?.type || 'hotel')}
            </span>
            <span
                style={{
                    fontSize: tokens.typography.fontSize.xs,
                    fontWeight: tokens.typography.fontWeight.medium,
                    color: variant === 'source' ? tokens.colors.primary[600] : tokens.colors.neutral[600],
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                }}
            >
                {title}
            </span>
        </div>

        <h4
            style={{
                fontSize: tokens.typography.fontSize.base,
                fontWeight: tokens.typography.fontWeight.semibold,
                color: tokens.colors.neutral[900],
                margin: `0 0 ${tokens.spacing[2]} 0`,
                lineHeight: tokens.typography.lineHeight.tight,
            }}
        >
            {swap.sourceBooking?.title || 'Untitled Booking'}
        </h4>

        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: tokens.spacing[1],
                marginBottom: tokens.spacing[2],
                color: tokens.colors.neutral[600],
                fontSize: tokens.typography.fontSize.sm,
            }}
        >
            <span>📍</span>
            <span>
                {swap.sourceBooking?.location?.city || 'Unknown'},{' '}
                {swap.sourceBooking?.location?.country || 'Unknown'}
            </span>
        </div>

        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: tokens.spacing[1],
                marginBottom: tokens.spacing[3],
                color: tokens.colors.neutral[600],
                fontSize: tokens.typography.fontSize.sm,
            }}
        >
            <span>📅</span>
            <span>
                {swap.sourceBooking?.dateRange?.checkIn && swap.sourceBooking?.dateRange?.checkOut
                    ? `${formatDate(swap.sourceBooking.dateRange.checkIn)} - ${formatDate(swap.sourceBooking.dateRange.checkOut)}`
                    : 'Dates TBD'}
            </span>
        </div>

        <div
            style={{
                fontSize: tokens.typography.fontSize.lg,
                fontWeight: tokens.typography.fontWeight.semibold,
                color: variant === 'source' ? tokens.colors.primary[600] : tokens.colors.neutral[700],
            }}
        >
            {formatCurrency(swap.sourceBooking?.swapValue || 0)}
        </div>
    </div>
);

export const TargetingConfirmationModal: React.FC<TargetingConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    sourceSwap,
    targetSwap,
    loading = false,
    isRetargeting = false,
    previousTarget,
}) => {
    const [understood, setUnderstood] = useState(false);

    const isAuctionMode = targetSwap.auctionInfo?.isAuction ?? false;
    const auctionEnded = targetSwap.auctionInfo?.endDate ? new Date(targetSwap.auctionInfo.endDate) <= new Date() : false;

    const handleConfirm = () => {
        if (!understood) return;
        onConfirm();
    };

    const handleClose = () => {
        setUnderstood(false);
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={isRetargeting ? 'Confirm Retargeting' : 'Confirm Swap Targeting'}
            size="lg"
        >
            <div style={{ padding: tokens.spacing[6] }}>
                {/* Header */}
                <div
                    style={{
                        textAlign: 'center',
                        marginBottom: tokens.spacing[6],
                    }}
                >
                    <div style={{ fontSize: '48px', marginBottom: tokens.spacing[2] }}>
                        🎯
                    </div>
                    <h3
                        style={{
                            fontSize: tokens.typography.fontSize.xl,
                            fontWeight: tokens.typography.fontWeight.semibold,
                            color: tokens.colors.neutral[900],
                            margin: `0 0 ${tokens.spacing[2]} 0`,
                        }}
                    >
                        {isRetargeting ? 'Retarget Your Swap' : 'Target This Swap'}
                    </h3>
                    <p
                        style={{
                            fontSize: tokens.typography.fontSize.base,
                            color: tokens.colors.neutral[600],
                            margin: 0,
                        }}
                    >
                        {isRetargeting
                            ? 'You are about to change your targeting to a different swap'
                            : 'You are about to target this swap with your booking'}
                    </p>
                </div>

                {/* Retargeting Warning */}
                {isRetargeting && previousTarget && (
                    <div
                        style={{
                            padding: tokens.spacing[4],
                            backgroundColor: tokens.colors.warning[50],
                            borderRadius: tokens.borderRadius.md,
                            border: `1px solid ${tokens.colors.warning[200]}`,
                            marginBottom: tokens.spacing[6],
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: tokens.spacing[2],
                                marginBottom: tokens.spacing[2],
                            }}
                        >
                            <span style={{ fontSize: '16px' }}>⚠️</span>
                            <span
                                style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    fontWeight: tokens.typography.fontWeight.semibold,
                                    color: tokens.colors.warning[700],
                                }}
                            >
                                Current Target Will Be Cancelled
                            </span>
                        </div>
                        <p
                            style={{
                                fontSize: tokens.typography.fontSize.sm,
                                color: tokens.colors.warning[600],
                                margin: 0,
                            }}
                        >
                            Your current targeting of "{previousTarget.sourceBooking?.title}" will be cancelled and any pending proposal will be withdrawn.
                        </p>
                    </div>
                )}

                {/* Swap Comparison */}
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto 1fr',
                        gap: tokens.spacing[4],
                        alignItems: 'center',
                        marginBottom: tokens.spacing[6],
                    }}
                >
                    <SwapSummaryCard
                        swap={sourceSwap}
                        title="Your Booking"
                        variant="source"
                    />

                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: tokens.spacing[2],
                        }}
                    >
                        <div
                            style={{
                                fontSize: '24px',
                                color: tokens.colors.primary[500],
                            }}
                        >
                            🎯
                        </div>
                        <div
                            style={{
                                fontSize: tokens.typography.fontSize.xs,
                                color: tokens.colors.neutral[500],
                                textAlign: 'center',
                                fontWeight: tokens.typography.fontWeight.medium,
                            }}
                        >
                            TARGETING
                        </div>
                    </div>

                    <SwapSummaryCard
                        swap={targetSwap}
                        title="Target Booking"
                        variant="target"
                    />
                </div>

                {/* Auction Mode Information */}
                {isAuctionMode && (
                    <div
                        style={{
                            padding: tokens.spacing[4],
                            backgroundColor: tokens.colors.primary[50],
                            borderRadius: tokens.borderRadius.md,
                            border: `1px solid ${tokens.colors.primary[200]}`,
                            marginBottom: tokens.spacing[6],
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: tokens.spacing[2],
                                marginBottom: tokens.spacing[2],
                            }}
                        >
                            <span style={{ fontSize: '16px' }}>🏆</span>
                            <span
                                style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    fontWeight: tokens.typography.fontWeight.semibold,
                                    color: tokens.colors.primary[700],
                                }}
                            >
                                Auction Mode Active
                            </span>
                            <Badge variant="primary" size="sm">
                                {targetSwap.auctionInfo?.proposalCount || 0} proposals
                            </Badge>
                        </div>
                        <p
                            style={{
                                fontSize: tokens.typography.fontSize.sm,
                                color: tokens.colors.primary[600],
                                margin: 0,
                            }}
                        >
                            This swap is in auction mode. Your proposal will compete with others until the auction ends on{' '}
                            {targetSwap.auctionInfo?.endDate ? formatDate(targetSwap.auctionInfo.endDate) : 'the end date'}.
                        </p>
                    </div>
                )}

                {/* One-for-One Mode Information */}
                {!isAuctionMode && (
                    <div
                        style={{
                            padding: tokens.spacing[4],
                            backgroundColor: tokens.colors.blue[50],
                            borderRadius: tokens.borderRadius.md,
                            border: `1px solid ${tokens.colors.blue[200]}`,
                            marginBottom: tokens.spacing[6],
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: tokens.spacing[2],
                                marginBottom: tokens.spacing[2],
                            }}
                        >
                            <span style={{ fontSize: '16px' }}>1️⃣</span>
                            <span
                                style={{
                                    fontSize: tokens.typography.fontSize.sm,
                                    fontWeight: tokens.typography.fontWeight.semibold,
                                    color: tokens.colors.blue[700],
                                }}
                            >
                                One-for-One Mode
                            </span>
                        </div>
                        <p
                            style={{
                                fontSize: tokens.typography.fontSize.sm,
                                color: tokens.colors.blue[600],
                                margin: 0,
                            }}
                        >
                            This swap accepts only one proposal at a time. Your targeting will create a proposal immediately if no other proposal is pending.
                        </p>
                    </div>
                )}

                {/* What Happens Next */}
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
                        }}
                    >
                        What happens next:
                    </h4>
                    <ul
                        style={{
                            margin: 0,
                            paddingLeft: tokens.spacing[5],
                            fontSize: tokens.typography.fontSize.sm,
                            color: tokens.colors.neutral[700],
                            lineHeight: tokens.typography.lineHeight.relaxed,
                        }}
                    >
                        <li style={{ marginBottom: tokens.spacing[2] }}>
                            Your swap will be updated to target this specific booking
                        </li>
                        <li style={{ marginBottom: tokens.spacing[2] }}>
                            {isAuctionMode
                                ? 'A proposal will be automatically created and added to the auction'
                                : 'A proposal will be created if no other proposal is currently pending'}
                        </li>
                        <li style={{ marginBottom: tokens.spacing[2] }}>
                            You'll receive notifications about the proposal status
                        </li>
                        <li>
                            You can retarget or cancel targeting at any time before acceptance
                        </li>
                    </ul>
                </div>

                {/* Confirmation Checkbox */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: tokens.spacing[3],
                        marginBottom: tokens.spacing[6],
                    }}
                >
                    <input
                        type="checkbox"
                        id="understand-targeting"
                        checked={understood}
                        onChange={(e) => setUnderstood(e.target.checked)}
                        style={{
                            marginTop: '2px',
                            width: '16px',
                            height: '16px',
                        }}
                    />
                    <label
                        htmlFor="understand-targeting"
                        style={{
                            fontSize: tokens.typography.fontSize.sm,
                            color: tokens.colors.neutral[700],
                            cursor: 'pointer',
                            lineHeight: tokens.typography.lineHeight.relaxed,
                        }}
                    >
                        I understand that {isRetargeting ? 'retargeting' : 'targeting'} will{' '}
                        {isRetargeting ? 'cancel my current target and ' : ''}
                        {isAuctionMode
                            ? 'create a proposal in the auction for this swap'
                            : 'attempt to create a proposal for this swap'}
                        . I can cancel or retarget at any time before the proposal is accepted.
                    </label>
                </div>

                {/* Action Buttons */}
                <div
                    style={{
                        display: 'flex',
                        gap: tokens.spacing[3],
                        justifyContent: 'flex-end',
                    }}
                >
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleConfirm}
                        disabled={!understood || loading}
                    >
                        {loading ? (
                            <>
                                <span style={{ marginRight: tokens.spacing[2] }}>⏳</span>
                                {isRetargeting ? 'Retargeting...' : 'Targeting...'}
                            </>
                        ) : (
                            <>
                                <span style={{ marginRight: tokens.spacing[2] }}>🎯</span>
                                {isRetargeting ? 'Confirm Retargeting' : 'Confirm Targeting'}
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};