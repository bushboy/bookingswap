import React from 'react';
import { tokens } from '@/design-system/tokens';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { LoadingSpinner } from '@/components/ui/LoadingIndicator';
import {
    TargetingValidation,
    TargetingRestriction,
    AuctionInfo,
} from '@booking-swap/shared';
import { FEATURE_FLAGS } from '@/config/featureFlags';

interface TargetingValidationFeedbackProps {
    validation: TargetingValidation | null;
    isValidating: boolean;
    targetSwapId?: string;
    className?: string;
    style?: React.CSSProperties;
}

interface RestrictionDisplayProps {
    restrictions: TargetingRestriction[];
}

interface AuctionInfoDisplayProps {
    auctionInfo: AuctionInfo;
}

// Restriction Display Component
const RestrictionDisplay: React.FC<RestrictionDisplayProps> = ({ restrictions }) => {
    if (restrictions.length === 0) return null;

    const errorRestrictions = restrictions.filter(r => r.severity === 'error');
    const warningRestrictions = restrictions.filter(r => r.severity === 'warning');

    return (
        <div style={{ marginTop: tokens.spacing[3] }}>
            {errorRestrictions.length > 0 && (
                <Alert variant="error" style={{ marginBottom: tokens.spacing[2] }}>
                    <AlertDescription>
                        <div style={{ fontWeight: tokens.typography.fontWeight.medium, marginBottom: tokens.spacing[2] }}>
                            Cannot target this swap:
                        </div>
                        <ul style={{ margin: 0, paddingLeft: tokens.spacing[4] }}>
                            {errorRestrictions.map((restriction, index) => (
                                <li key={index} style={{ marginBottom: tokens.spacing[1] }}>
                                    {restriction.message}
                                </li>
                            ))}
                        </ul>
                    </AlertDescription>
                </Alert>
            )}

            {warningRestrictions.length > 0 && (
                <Alert variant="warning">
                    <AlertDescription>
                        <div style={{ fontWeight: tokens.typography.fontWeight.medium, marginBottom: tokens.spacing[2] }}>
                            Please note:
                        </div>
                        <ul style={{ margin: 0, paddingLeft: tokens.spacing[4] }}>
                            {warningRestrictions.map((restriction, index) => (
                                <li key={index} style={{ marginBottom: tokens.spacing[1] }}>
                                    {restriction.message}
                                </li>
                            ))}
                        </ul>
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
};

// Auction Info Display Component
const AuctionInfoDisplay: React.FC<AuctionInfoDisplayProps> = ({ auctionInfo }) => {
    // Hide auction info when feature is disabled
    if (!FEATURE_FLAGS.ENABLE_AUCTION_MODE || !auctionInfo.isAuction) return null;

    const now = new Date();
    const endDate = auctionInfo.endDate ? new Date(auctionInfo.endDate) : null;
    const isAuctionActive = endDate ? now < endDate : true;
    const timeRemaining = endDate ? endDate.getTime() - now.getTime() : 0;

    const formatTimeRemaining = (ms: number) => {
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 24) {
            const days = Math.floor(hours / 24);
            return `${days} day${days !== 1 ? 's' : ''} remaining`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m remaining`;
        } else if (minutes > 0) {
            return `${minutes} minute${minutes !== 1 ? 's' : ''} remaining`;
        } else {
            return 'Ending soon';
        }
    };

    return (
        <div
            style={{
                marginTop: tokens.spacing[3],
                padding: tokens.spacing[4],
                backgroundColor: tokens.colors.primary[50],
                borderRadius: tokens.borderRadius.md,
                border: `1px solid ${tokens.colors.primary[200]}`,
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: tokens.spacing[2],
                }}
            >
                <div
                    style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: isAuctionActive ? tokens.colors.success[500] : tokens.colors.error[500],
                        marginRight: tokens.spacing[2],
                    }}
                />
                <span
                    style={{
                        fontSize: tokens.typography.fontSize.sm,
                        fontWeight: tokens.typography.fontWeight.medium,
                        color: tokens.colors.primary[800],
                    }}
                >
                    Auction Mode Swap
                </span>
            </div>

            <div style={{ fontSize: tokens.typography.fontSize.sm, color: tokens.colors.primary[700] }}>
                <div style={{ marginBottom: tokens.spacing[1] }}>
                    Current proposals: {auctionInfo.proposalCount}
                </div>

                {isAuctionActive && endDate && (
                    <div style={{ marginBottom: tokens.spacing[1] }}>
                        {formatTimeRemaining(timeRemaining)}
                    </div>
                )}

                {!isAuctionActive && (
                    <div style={{ color: tokens.colors.error[600], fontWeight: tokens.typography.fontWeight.medium }}>
                        Auction has ended
                    </div>
                )}

                <div style={{ marginTop: tokens.spacing[2], fontSize: tokens.typography.fontSize.xs }}>
                    {auctionInfo.canReceiveMoreProposals
                        ? 'Multiple proposals allowed until auction ends'
                        : 'No longer accepting new proposals'
                    }
                </div>
            </div>
        </div>
    );
};

// Success Feedback Component
interface SuccessFeedbackProps {
    canTarget: boolean;
    targetSwapId: string;
}

const SuccessFeedback: React.FC<SuccessFeedbackProps> = ({ canTarget }) => {
    if (!canTarget) return null;

    return (
        <Alert variant="success" style={{ marginTop: tokens.spacing[3] }}>
            <AlertDescription>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div
                        style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            backgroundColor: tokens.colors.success[500],
                            marginRight: tokens.spacing[2],
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '10px',
                        }}
                    >
                        ✓
                    </div>
                    <span>
                        This swap is available for targeting. You can proceed with your proposal.
                    </span>
                </div>
            </AlertDescription>
        </Alert>
    );
};

// Main Targeting Validation Feedback Component
export const TargetingValidationFeedback: React.FC<TargetingValidationFeedbackProps> = ({
    validation,
    isValidating,
    targetSwapId,
    className,
    style,
}) => {
    if (isValidating) {
        return (
            <div
                className={className}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: tokens.spacing[2],
                    padding: tokens.spacing[3],
                    backgroundColor: tokens.colors.neutral[50],
                    borderRadius: tokens.borderRadius.md,
                    border: `1px solid ${tokens.colors.neutral[200]}`,
                    ...style,
                }}
            >
                <LoadingSpinner size="sm" />
                <span style={{ color: tokens.colors.neutral[600], fontSize: tokens.typography.fontSize.sm }}>
                    Validating targeting eligibility...
                </span>
            </div>
        );
    }

    if (!validation || !targetSwapId) {
        return null;
    }

    return (
        <div className={className} style={style}>
            {/* Show restrictions if any */}
            <RestrictionDisplay restrictions={validation.restrictions} />

            {/* Show auction info if applicable and feature is enabled */}
            {FEATURE_FLAGS.ENABLE_AUCTION_MODE && validation.auctionInfo && (
                <AuctionInfoDisplay auctionInfo={validation.auctionInfo} />
            )}

            {/* Show success feedback if can target */}
            {validation.canTarget && validation.restrictions.length === 0 && (
                <SuccessFeedback canTarget={validation.canTarget} />
            )}

            {/* Show general warnings if any */}
            {validation.warnings.length > 0 && (
                <Alert variant="warning" style={{ marginTop: tokens.spacing[3] }}>
                    <AlertDescription>
                        <div style={{ fontWeight: tokens.typography.fontWeight.medium, marginBottom: tokens.spacing[2] }}>
                            Additional Information:
                        </div>
                        <ul style={{ margin: 0, paddingLeft: tokens.spacing[4] }}>
                            {validation.warnings.map((warning, index) => (
                                <li key={index} style={{ marginBottom: tokens.spacing[1] }}>
                                    {warning}
                                </li>
                            ))}
                        </ul>
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
};

export default TargetingValidationFeedback;